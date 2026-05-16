/**
 * Integrated Data Manager
 * Handles data flow between Seoul API, Firebase, and local cache with offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { seoulSubwayApi, SeoulRealtimeArrival } from '../api/seoulSubwayApi';
import { arrivalService, ArrivalInfo } from '../arrival/arrivalService';
import { trainService } from '../train/trainService';
import { Train, Station, TrainDelay, DelaySeverity, TrainStatus, ServiceDisruption } from '../../models/train';
import { getLocalStationByName } from './stationsDataService';

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface RealtimeTrainData {
  stationId: string;
  trains: Train[];
  lastUpdated: Date;
}

interface DataSyncStatus {
  lastSync: Date;
  isOnline: boolean;
  pendingSyncs: number;
  errors: string[];
}

class DataManager {
  private readonly CACHE_PREFIX = '@livemetro_cache_';
  private readonly DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  // Cache duration for offline scenarios  
  // private readonly OFFLINE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  // Maximum retry attempts for API calls
  // private readonly MAX_RETRY_ATTEMPTS = 3;
  
  private syncStatus: DataSyncStatus = {
    lastSync: new Date(),
    isOnline: true,
    pendingSyncs: 0,
    errors: []
  };

  private subscribers: Map<string, ((data: RealtimeTrainData | null) => void)[]> = new Map();
  private activeIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  /**
   * Get realtime train data with Stale-While-Revalidate pattern
   * 1. Cache hit → return immediately (even if stale)
   * 2. Background: fetch from Seoul API → update cache
   * 3. Cache miss → await Seoul API directly
   */
  async getRealtimeTrains(stationName: string): Promise<RealtimeTrainData | null> {
    const cacheKey = `realtime_trains_${stationName}`;

    // Check cache first (Stale-While-Revalidate)
    const cachedData = await this.getCachedData<RealtimeTrainData>(cacheKey);

    if (cachedData) {
      // Return cached data immediately, refresh in background
      this.refreshInBackground(stationName, cacheKey);
      return cachedData;
    }

    // No cache → must await Seoul API
    return this.fetchFromSeoulApi(stationName, cacheKey);
  }

  /**
   * Fetch fresh data from Seoul API and update cache
   */
  private async fetchFromSeoulApi(stationName: string, cacheKey: string): Promise<RealtimeTrainData | null> {
    try {
      const seoulData = await seoulSubwayApi.getRealtimeArrival(stationName);

      if (seoulData.length > 0) {
        // Filter arvlCd '2' (당역 출발) — already-departed trains have no
        // meaningful arrival time and would render as info-less rows.
        // Mirrors the filter in arrivalService.convertToArrivalInfo so both
        // paths agree on what is "currently approaching".
        const trains: Train[] = seoulData
          .filter(arrival => arrival.arvlCd !== '2')
          .map(arrival => this.convertSeoulToTrain(arrival));
        const result: RealtimeTrainData = {
          stationId: stationName,
          trains,
          lastUpdated: new Date()
        };

        await this.setCachedData(cacheKey, result, this.DEFAULT_CACHE_DURATION);
        this.updateSyncStatus(true);
        return result;
      }

      // API returned empty data
      this.updateSyncStatus(true);
      return { stationId: stationName, trains: [], lastUpdated: new Date() };
    } catch (error) {
      console.warn('Seoul API failed:', error);
      this.updateSyncStatus(false, error instanceof Error ? error.message : 'Seoul API error');
      return null;
    }
  }

  /**
   * Refresh data in background without blocking the caller.
   * Notifies subscribers when fresh data arrives.
   */
  private refreshInBackground(stationName: string, cacheKey: string): void {
    this.fetchFromSeoulApi(stationName, cacheKey)
      .then((result) => {
        if (result) {
          this.notifySubscribers(stationName, result);
        }
      })
      .catch(() => {
        // Background refresh failure is non-critical, already returned cached data
      });
  }

  /**
   * Notify all subscribers for a station with fresh data
   */
  private notifySubscribers(stationName: string, data: RealtimeTrainData): void {
    const subscriptionKey = `realtime_${stationName}`;
    const callbacks = this.subscribers.get(subscriptionKey);
    callbacks?.forEach(cb => cb(data));
  }

  /**
   * Get station information with caching
   */
  async getStationInfo(stationName: string): Promise<Station | null> {
    const cacheKey = `station_info_${stationName}`;
    
    // Try cache first for station info (rarely changes)
    const cachedStation = await this.getCachedData<Station>(cacheKey);
    if (cachedStation) {
      return cachedStation;
    }

    try {
      // First try to get station from local data by name
      const localStation = getLocalStationByName(stationName);

      // Try Firebase with station ID if we have it (for more accurate data)
      if (localStation?.id) {
        try {
          const firebaseStation = await trainService.getStation(localStation.id);
          if (firebaseStation) {
            await this.setCachedData(cacheKey, firebaseStation, 24 * 60 * 60 * 1000); // Cache for 24 hours
            return firebaseStation;
          }
        } catch (firebaseError) {
          console.warn('Firebase station lookup failed, using local data:', firebaseError);
        }
      }

      // Use local station data if available
      if (localStation) {
        await this.setCachedData(cacheKey, localStation, 24 * 60 * 60 * 1000); // Cache for 24 hours
        return localStation;
      }

      // Fallback to Seoul API for station coordinates
      const seoulStations = await seoulSubwayApi.getAllStations();
      const seoulStation = seoulStations.find(s => s.STATION_NM === stationName);
      
      if (seoulStation) {
        const station: Station = {
          id: seoulStation.STATION_CD,
          name: seoulStation.STATION_NM,
          nameEn: seoulStation.STATION_NM, // Seoul API doesn't provide English names
          lineId: seoulStation.LINE_NUM,
          coordinates: {
            latitude: parseFloat(seoulStation.YPOS),
            longitude: parseFloat(seoulStation.XPOS)
          },
          transfers: []
        };

        await this.setCachedData(cacheKey, station, 24 * 60 * 60 * 1000);
        return station;
      }
    } catch (error) {
      console.error('Error getting station info:', error);
    }

    return null;
  }

  /**
   * Detect and report delays.
   *
   * @deprecated The previous implementation was semantically wrong: it treated
   * "time until arrival" as schedule deviation and flagged every train arriving
   * more than 5 minutes from now as "delayed". Seoul API does not expose
   * schedule deviation directly — a correct implementation must compare
   * realtime arrivals against the published timetable
   * (`seoulSubwayApi.getStationTimetable`). Until that work is done, this
   * function returns an empty list to avoid generating false delay alerts
   * that erode user trust. Track the proper implementation in a follow-up.
   *
   * @param stationName Station name (kept for signature compatibility)
   */
  async detectDelays(stationName: string): Promise<TrainDelay[]> {
    void stationName;
    console.warn(
      '[dataManager.detectDelays] deprecated — returns []. ' +
        'Schedule-vs-actual comparison required for correct delay detection.'
    );
    return [];
  }

  /**
   * Detect service disruptions and suspensions from realtime feeds
   */
  async detectServiceDisruptions(stationName: string): Promise<ServiceDisruption[]> {
    try {
      const arrivals = await seoulSubwayApi.getRealtimeArrival(stationName);
      if (!arrivals || arrivals.length === 0) {
        return [];
      }

      const suspensionKeywords = ['운행중단', '운행 중단', '운행중지', '운행 중지', '전면중단', '전면 중단', '운행불가', '운행 불가'];
      const incidentKeywords = ['장애', '고장', '사고', '탈선', '화재', '정전'];

      const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();

      const disruptions: ServiceDisruption[] = [];
      const now = new Date();

      for (const arrival of arrivals) {
        const messageParts = [arrival.arvlMsg2, arrival.arvlMsg3, arrival.btrainSttus].filter(Boolean) as string[];
        if (messageParts.length === 0) {
          continue;
        }

        const combinedMessage = messageParts.join(' ').trim();
        if (!combinedMessage) {
          continue;
        }

        const normalizedMessage = normalize(combinedMessage);

        const isSuspension = suspensionKeywords.some(keyword => normalizedMessage.includes(normalize(keyword)));
        const isIncident = !isSuspension && incidentKeywords.some(keyword => normalizedMessage.includes(normalize(keyword)));

        if (!isSuspension && !isIncident) {
          continue;
        }

        const status = isSuspension ? TrainStatus.SUSPENDED : TrainStatus.EMERGENCY;
        const severity = isSuspension ? DelaySeverity.SEVERE : DelaySeverity.MAJOR;

        const reportedAt = arrival.recptnDt ? new Date(arrival.recptnDt) : now;

        let affectedDirections: ('up' | 'down')[] = [];
        if (arrival.updnLine === '상행') {
          affectedDirections = ['up'];
        } else if (arrival.updnLine === '하행') {
          affectedDirections = ['down'];
        } else {
          affectedDirections = ['up', 'down'];
        }

        const disruptionId = `${arrival.subwayId || arrival.trainLineNm || 'line'}_${arrival.statnId || arrival.statnNm}_${status}_${reportedAt.getTime()}`;

        disruptions.push({
          id: disruptionId,
          lineId: arrival.subwayId || arrival.trainLineNm,
          lineName: arrival.trainLineNm || arrival.subwayId || '',
          stationName: arrival.statnNm,
          status,
          message: combinedMessage,
          severity,
          reportedAt,
          affectedDirections
        });
      }

      return disruptions;
    } catch (error) {
      console.error('Error detecting service disruptions:', error);
      return [];
    }
  }

  /**
   * Subscribe to realtime updates.
   *
   * Internally delegates to {@link arrivalService.subscribe} so the app has a
   * single polling source per station. arrivalService handles rate limiting,
   * retry, caching, and per-station interval deduplication. We adapt its
   * `ArrivalInfo` payload back to {@link RealtimeTrainData} so existing
   * callers (e.g. `useRealtimeTrains`) keep working unchanged.
   *
   * @deprecated Prefer {@link arrivalService.subscribe} directly when writing
   * new code. This wrapper exists for legacy compatibility.
   */
  subscribeToRealtimeUpdates(
    stationName: string,
    callback: (data: RealtimeTrainData | null, error?: unknown) => void,
    intervalMs: number = 30000
  ): () => void {
    // G4: arrivalService의 error 인자를 consumer까지 forward — 이전엔 `_error`로
    // 무시했음. SeoulApiError(category=quota/auth/transient/...) 등 구조화된
    // 에러가 ErrorFallback의 category 분기까지 도달 가능. arrivalService가 현재
    // 대부분의 에러를 cache fallback으로 swallow하지만, fetchWithRetry가
    // initial subscribe에서 reject할 때(getArrivals.catch) error가 살아남아
    // 여기로 전달됨. 미래 arrivalService refactor가 더 많은 에러를 surface하면
    // 본 wiring이 자동으로 category 분기를 활성화.
    return arrivalService.subscribe(
      stationName,
      (info, error) => {
        callback(this.adaptArrivalInfoToRealtimeData(info), error);
      },
      intervalMs
    );
  }

  /**
   * Adapter: convert arrivalService's `ArrivalInfo` to legacy `RealtimeTrainData`.
   *
   * Maintains backward compatibility for legacy consumers of
   * {@link subscribeToRealtimeUpdates}. New code should consume `ArrivalInfo`
   * directly via {@link arrivalService.subscribe}.
   */
  private adaptArrivalInfoToRealtimeData(
    info: ArrivalInfo | null
  ): RealtimeTrainData | null {
    if (!info) return null;

    const trains: Train[] = info.arrivals.map((arrival) => ({
      id: arrival.trainId,
      lineId: arrival.lineId,
      currentStationId: info.stationId,
      nextStationId: null,
      finalDestination: arrival.destination || '종착역 미확인',
      direction: arrival.direction,
      arrivalTime:
        arrival.arrivalSeconds !== null
          ? new Date(Date.now() + arrival.arrivalSeconds * 1000)
          : null,
      status: TrainStatus.NORMAL,
      lastUpdated: info.lastUpdated,
      delayMinutes: 0,
      trainType: arrival.trainType,
    }));

    return {
      stationId: info.stationId,
      trains,
      lastUpdated: info.lastUpdated,
    };
  }

  /**
   * Unsubscribe from all realtime updates
   */
  unsubscribeAll(): void {
    // Clear all intervals
    for (const intervalId of this.activeIntervals.values()) {
      clearInterval(intervalId);
    }
    this.activeIntervals.clear();
    this.subscribers.clear();
  }

  /**
   * Clean up all resources - call when service is no longer needed
   */
  destroy(): void {
    this.unsubscribeAll();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): DataSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Force sync with all data sources
   */
  async forceSync(): Promise<boolean> {
    try {
      this.syncStatus.pendingSyncs = 1;
      
      // Test Seoul API connectivity
      const isSeoulApiOnline = await seoulSubwayApi.checkServiceStatus();
      
      // Clear old errors
      this.syncStatus.errors = [];
      
      if (isSeoulApiOnline) {
        console.log('Force sync completed successfully');
        this.updateSyncStatus(true);
        return true;
      } else {
        throw new Error('Seoul API is not accessible');
      }
    } catch (error) {
      console.error('Force sync failed:', error);
      this.updateSyncStatus(false, error instanceof Error ? error.message : 'Force sync failed');
      return false;
    } finally {
      this.syncStatus.pendingSyncs = 0;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`Cleared ${cacheKeys.length} cached items`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache info for debugging
   */
  async getCacheInfo(): Promise<{ totalItems: number; totalSize: number; items: string[] }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }

      return {
        totalItems: cacheKeys.length,
        totalSize,
        items: cacheKeys.map(key => key.replace(this.CACHE_PREFIX, ''))
      };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { totalItems: 0, totalSize: 0, items: [] };
    }
  }

  // Private helper methods

  private async setCachedData<T>(key: string, data: T, duration: number): Promise<void> {
    try {
      const cachedItem: CachedData<T> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + duration
      };
      
      await AsyncStorage.setItem(`${this.CACHE_PREFIX}${key}`, JSON.stringify(cachedItem));
    } catch (error) {
      console.error('Error setting cached data:', error);
    }
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const cachedItem: CachedData<T> = JSON.parse(cached);
      
      if (Date.now() > cachedItem.expiry) {
        // Clean up expired cache
        await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
        return null;
      }

      return cachedItem.data;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  private convertSeoulToTrain(arrival: SeoulRealtimeArrival): Train {
    const converted = seoulSubwayApi.convertToAppTrain(arrival);

    // Stable id matching arrivalService.convertToArrivalInfo. Both paths must
    // produce the same id for the same train so React keys stay stable when a
    // screen mixes one-shot fetches (getRealtimeTrains) with subscriptions
    // (subscribeToRealtimeUpdates → arrivalService).
    const stableKey = arrival.btrainNo || arrival.ordkey || arrival.statnId;
    return {
      id: `train_${stableKey}_${arrival.statnId}`,
      lineId: converted.lineId,
      currentStationId: converted.stationId,
      nextStationId: null,
      finalDestination: converted.destinationStation || '종착역 미확인',
      direction: converted.direction === 'up' ? 'up' : 'down',
      arrivalTime: converted.arrivalTime !== null
        ? new Date(Date.now() + converted.arrivalTime * 1000)
        : null,
      status: TrainStatus.NORMAL,
      lastUpdated: converted.lastUpdated,
      delayMinutes: 0, // Seoul API doesn't provide schedule deviation; use detectDelays() separately
      trainType: converted.trainType,
    };
  }

  private updateSyncStatus(isOnline: boolean, error?: string): void {
    this.syncStatus.isOnline = isOnline;
    this.syncStatus.lastSync = new Date();
    
    if (error) {
      this.syncStatus.errors.push(`${new Date().toISOString()}: ${error}`);
      // Keep only last 10 errors
      if (this.syncStatus.errors.length > 10) {
        this.syncStatus.errors = this.syncStatus.errors.slice(-10);
      }
    }
  }
}

// Export singleton instance
export const dataManager = new DataManager();
export type { RealtimeTrainData, DataSyncStatus };
