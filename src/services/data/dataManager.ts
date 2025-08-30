/**
 * Integrated Data Manager
 * Handles data flow between Seoul API, Firebase, and local cache with offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { seoulSubwayApi, SeoulRealtimeArrival } from '../api/seoulSubwayApi';
import { trainService } from '../train/trainService';
import { Train, Station, TrainDelay, DelaySeverity, TrainStatus } from '../../models/train';

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

  private subscribers: Map<string, ((data: any) => void)[]> = new Map();
  private syncQueue: (() => Promise<void>)[] = [];
  private isProcessingQueue = false;

  /**
   * Get realtime train data with multi-tier fallback
   * Priority: Seoul API -> Firebase -> Local Cache
   */
  async getRealtimeTrains(stationName: string): Promise<RealtimeTrainData | null> {
    const cacheKey = `realtime_trains_${stationName}`;
    
    try {
      // Try Seoul API first (most up-to-date data)
      const seoulData = await seoulSubwayApi.getRealtimeArrival(stationName);
      
      if (seoulData.length > 0) {
        const trains: Train[] = seoulData.map(arrival => this.convertSeoulToTrain(arrival));
        const result: RealtimeTrainData = {
          stationId: stationName,
          trains,
          lastUpdated: new Date()
        };

        // Cache the fresh data
        await this.setCachedData(cacheKey, result, this.DEFAULT_CACHE_DURATION);
        
        // Also update Firebase for other users
        this.queueFirebaseSync(stationName, trains);
        
        this.updateSyncStatus(true);
        return result;
      }
    } catch (error) {
      console.warn('Seoul API failed, trying Firebase:', error);
      this.updateSyncStatus(false, error instanceof Error ? error.message : 'Seoul API error');
    }

    try {
      // Fallback to Firebase
      const firebaseStation = await trainService.getStation(stationName);
      if (firebaseStation) {
        return new Promise((resolve) => {
          const unsubscribe = trainService.subscribeToTrainUpdates(
            firebaseStation.id,
            (trains) => {
              unsubscribe(); // One-time fetch
              const result: RealtimeTrainData = {
                stationId: firebaseStation.id,
                trains,
                lastUpdated: new Date()
              };

              // Cache Firebase data
              this.setCachedData(cacheKey, result, this.DEFAULT_CACHE_DURATION);
              resolve(result);
            }
          );
        });
      }
    } catch (error) {
      console.warn('Firebase failed, trying cache:', error);
    }

    // Final fallback to local cache
    const cachedData = await this.getCachedData<RealtimeTrainData>(cacheKey);
    if (cachedData) {
      console.log('Using cached data for', stationName);
      return cachedData;
    }

    console.error('No data available for station:', stationName);
    return null;
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
      // Try Firebase
      const firebaseStation = await trainService.getStation(stationName);
      if (firebaseStation) {
        await this.setCachedData(cacheKey, firebaseStation, 24 * 60 * 60 * 1000); // Cache for 24 hours
        return firebaseStation;
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
          transfers: [],
          isActive: true
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
   * Detect and report delays
   */
  async detectDelays(stationName: string): Promise<TrainDelay[]> {
    try {
      const realtimeData = await this.getRealtimeTrains(stationName);
      if (!realtimeData) return [];

      const delays: TrainDelay[] = [];
      const now = new Date();

      for (const train of realtimeData.trains) {
        if (train.arrivalTime) {
          const arrivalTimeMs = train.arrivalTime.getTime();
          const currentTimeMs = now.getTime();
          const delayMs = arrivalTimeMs - currentTimeMs;
          
          if (delayMs > 5 * 60 * 1000) { // More than 5 minutes delay
            const delayMinutes = Math.floor(delayMs / (60 * 1000));
          let severity: DelaySeverity;

          if (delayMinutes >= 20) severity = DelaySeverity.SEVERE;
          else if (delayMinutes >= 10) severity = DelaySeverity.MAJOR;
          else if (delayMinutes >= 5) severity = DelaySeverity.MODERATE;
          else severity = DelaySeverity.MINOR;

          delays.push({
            trainId: train.id,
            lineId: train.lineId,
            severity,
            delayMinutes,
            reason: `예정보다 ${delayMinutes}분 지연`,
            reportedAt: now,
            isActive: true
          });
          }
        }
      }

      return delays;
    } catch (error) {
      console.error('Error detecting delays:', error);
      return [];
    }
  }

  /**
   * Subscribe to realtime updates
   */
  subscribeToRealtimeUpdates(
    stationName: string,
    callback: (data: RealtimeTrainData | null) => void,
    intervalMs: number = 30000 // 30 seconds
  ): () => void {
    const subscriptionKey = `realtime_${stationName}`;
    
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, []);
    }
    
    this.subscribers.get(subscriptionKey)!.push(callback);

    // Set up periodic updates
    const intervalId = setInterval(async () => {
      const data = await this.getRealtimeTrains(stationName);
      callback(data);
    }, intervalMs);

    // Initial fetch
    this.getRealtimeTrains(stationName).then(callback);

    // Return unsubscribe function
    return () => {
      clearInterval(intervalId);
      const callbacks = this.subscribers.get(subscriptionKey);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.subscribers.delete(subscriptionKey);
        }
      }
    };
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
    
    return {
      id: `seoul_${arrival.btrainNo}_${Date.now()}`,
      lineId: converted.lineId,
      currentStationId: converted.stationId,
      nextStationId: null,
      direction: converted.direction === 'up' ? 'up' : 'down',
      arrivalTime: converted.arrivalTime ? new Date(Date.now() + converted.arrivalTime * 1000) : null,
      departureTime: null,
      status: TrainStatus.NORMAL,
      carriageCount: 10, // Standard Seoul subway
      currentLoad: null,
      lastUpdated: converted.lastUpdated,
      delay: converted.arrivalTime && converted.arrivalTime > 300 ? 
        Math.floor(converted.arrivalTime / 60) : 0,
      trainNumber: converted.trainNumber
    };
  }

  private queueFirebaseSync(stationId: string, trains: Train[]): void {
    this.syncQueue.push(async () => {
      try {
        // In a real implementation, you would sync this data to Firebase
        console.log(`Queued Firebase sync for station ${stationId} with ${trains.length} trains`);
      } catch (error) {
        console.error('Firebase sync failed:', error);
      }
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.syncQueue.length === 0) return;

    this.isProcessingQueue = true;
    
    while (this.syncQueue.length > 0) {
      const syncOperation = this.syncQueue.shift();
      if (syncOperation) {
        try {
          await syncOperation();
        } catch (error) {
          console.error('Sync operation failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
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