/**
 * Train Service - Real-time subway data integration
 * Handles Seoul Metropolitan Subway API integration and real-time updates
 */

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  orderBy,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { throttle } from '../../utils/performanceUtils';
import {
  Train,
  Station,
  SubwayLine,
  TrainDelay,
  CongestionData,
  // TrainStatus, // Will be used in future updates
  DelaySeverity
} from '../../models/train';
import { seoulSubwayApi, SeoulTimetableRow } from '../api/seoulSubwayApi';
import { getLocalStation, getLocalStationsByLine, searchLocalStations } from '../data/stationsDataService';

let allStationsCache: Promise<Station[]> | null = null;

/** Test-only: clear in-memory stations cache between specs. */
export const __resetStationsCacheForTesting = (): void => {
  allStationsCache = null;
};
import { locationService } from '../location/locationService';

class TrainService {
  private unsubscribeCallbacks: Map<string, Unsubscribe> = new Map();

  /**
   * Get all subway lines
   */
  async getSubwayLines(): Promise<SubwayLine[]> {
    try {
      const linesSnapshot = await getDocs(collection(firestore, 'subwayLines'));
      return linesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SubwayLine));
    } catch (error) {
      console.error('Firebase error fetching subway lines:', error);
      return []; // 에러 시 빈 배열 반환
    }
  }

  /**
   * Get stations for a specific line
   * Falls back to local data if not found in Firebase
   */
  async getStationsByLine(lineId: string): Promise<Station[]> {
    try {
      // Try Firebase first
      const stationsQuery = query(
        collection(firestore, 'stations'),
        where('lineId', '==', lineId),
        orderBy('sequence')
      );

      const stationsSnapshot = await getDocs(stationsQuery);
      const firestoreStations = stationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Station));

      if (firestoreStations.length > 0) {
        return firestoreStations;
      }

      // Fallback to local data if Firebase has no results
      console.warn(`No stations found in Firebase for line ${lineId}, trying local data`);
      const localStations = getLocalStationsByLine(lineId);

      if (localStations.length > 0) {
        console.log(`✅ Loaded ${localStations.length} stations for line ${lineId} from local data`);
        return localStations;
      }

      console.error(`❌ No stations found for line ${lineId} in Firebase or local data`);
      return [];
    } catch (error) {
      // Firebase connection error - use local fallback
      console.error('Firebase error fetching stations, falling back to local data:', error);
      return getLocalStationsByLine(lineId);
    }
  }

  /**
   * Get station details by ID
   * Falls back to local data if not found in Firebase
   */
  async getStation(stationId: string): Promise<Station | null> {
    try {
      // Try Firebase first
      const stationDoc = await getDoc(doc(firestore, 'stations', stationId));

      if (stationDoc.exists()) {
        return {
          id: stationDoc.id,
          ...stationDoc.data()
        } as Station;
      }

      // Fallback to local data
      console.warn(`Station not found in Firebase: ${stationId}, trying local data`);
      const localStation = getLocalStation(stationId);

      if (localStation) {
        console.log(`✅ Loaded station ${stationId} from local data`);
        return localStation;
      }

      console.error(`❌ Station ${stationId} not found in Firebase or local data`);
      return null;
    } catch (error) {
      // Firebase 연결 오류 시 로컬 데이터로 폴백
      console.error('Firebase error fetching station, falling back to local data:', error);
      return getLocalStation(stationId);
    }
  }

  /**
   * Subscribe to real-time train updates for a station
   * Callback is throttled to prevent excessive UI updates
   */
  subscribeToTrainUpdates(
    stationId: string,
    callback: (trains: Train[]) => void
  ): () => void {
    const trainsQuery = query(
      collection(firestore, 'trains'),
      where('currentStationId', '==', stationId),
      orderBy('arrivalTime')
    );

    // Throttle callback to prevent UI blocking from rapid updates
    const throttledCallback = throttle(callback, 1000);

    const unsubscribe = onSnapshot(
      trainsQuery,
      (snapshot) => {
        const trains: Train[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          arrivalTime: doc.data().arrivalTime?.toDate() || null,
          lastUpdated: doc.data().lastUpdated.toDate()
        } as Train));

        throttledCallback(trains);
      },
      (error) => {
        console.error('Error in train updates subscription:', error);
        callback([]);
      }
    );

    // Store unsubscribe callback
    const subscriptionKey = `trains_${stationId}`;
    this.unsubscribeCallbacks.set(subscriptionKey, unsubscribe);

    // Return cleanup function
    return () => {
      throttledCallback.cancel(); // Clean up throttle timer
      unsubscribe();
      this.unsubscribeCallbacks.delete(subscriptionKey);
    };
  }

  /**
   * Subscribe to delay alerts
   */
  subscribeToDelayAlerts(
    lineIds: string[],
    callback: (delays: TrainDelay[]) => void
  ): () => void {
    const delaysQuery = query(
      collection(firestore, 'trainDelays'),
      where('lineId', 'in', lineIds),
      where('severity', 'in', [DelaySeverity.MODERATE, DelaySeverity.MAJOR, DelaySeverity.SEVERE]),
      orderBy('reportedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      delaysQuery,
      (snapshot) => {
        const delays: TrainDelay[] = snapshot.docs.map(doc => ({
          ...doc.data(),
          reportedAt: doc.data().reportedAt.toDate(),
          estimatedResolutionTime: doc.data().estimatedResolutionTime?.toDate() || null
        } as TrainDelay));

        callback(delays);
      },
      (error) => {
        console.error('Error in delay alerts subscription:', error);
        callback([]);
      }
    );

    const subscriptionKey = `delays_${lineIds.join('_')}`;
    this.unsubscribeCallbacks.set(subscriptionKey, unsubscribe);

    return () => {
      unsubscribe();
      this.unsubscribeCallbacks.delete(subscriptionKey);
    };
  }

  /**
   * Get congestion data for a train
   */
  async getTrainCongestion(trainId: string): Promise<CongestionData[]> {
    try {
      const congestionQuery = query(
        collection(firestore, 'congestionData'),
        where('trainId', '==', trainId),
        orderBy('carNumber')
      );

      const congestionSnapshot = await getDocs(congestionQuery);
      return congestionSnapshot.docs.map(doc => ({
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated.toDate()
      } as CongestionData));
    } catch (error) {
      console.error('Error fetching congestion data:', error);
      return [];
    }
  }

  /**
   * Search stations by name
   * Falls back to local data if Firebase fails or has no data
   */
  async searchStations(searchTerm: string): Promise<Station[]> {
    try {
      const allStations = await this.getAllStationsCached();
      if (allStations.length > 0) {
        return this.filterStations(allStations, searchTerm);
      }
      console.warn('No stations in Firebase, using local data for search');
      return searchLocalStations(searchTerm);
    } catch (error) {
      console.error('Firebase error searching stations, falling back to local:', error);
      return searchLocalStations(searchTerm);
    }
  }

  private filterStations(stations: Station[], searchTerm: string): Station[] {
    const term = searchTerm.toLowerCase();
    return stations
      .filter(s => s.name.toLowerCase().includes(term) || s.nameEn.toLowerCase().includes(term))
      .slice(0, 20);
  }

  /**
   * Module-level cache of the entire `stations` collection.
   *
   * Why: searchStations was downloading all stations on every keystroke.
   * Station metadata is effectively static within a session, so we cache the
   * in-flight Promise so concurrent callers share one network round-trip and
   * later calls return synchronously from memory. Cleared on failure so the
   * next caller can retry.
   */
  private getAllStationsCached(): Promise<Station[]> {
    if (allStationsCache) return allStationsCache;
    allStationsCache = (async (): Promise<Station[]> => {
      try {
        const snapshot = await getDocs(collection(firestore, 'stations'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Station));
      } catch (err) {
        allStationsCache = null;
        throw err;
      }
    })();
    return allStationsCache;
  }

  /**
   * Get nearby stations based on user location
   * Delegates to locationService for distance calculation (meters unit)
   */
  async getNearbyStations(
    latitude: number,
    longitude: number,
    radiusKm: number = 2
  ): Promise<Station[]> {
    try {
      const stationsSnapshot = await getDocs(collection(firestore, 'stations'));

      const allStations: Station[] = stationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Station));

      const radiusMeters = radiusKm * 1000;
      const nearbyStations = locationService.findNearbyStations(
        { latitude, longitude },
        allStations,
        radiusMeters
      );

      return nearbyStations.slice(0, 10);
    } catch (error) {
      console.error('Firebase error fetching nearby stations:', error);
      return [];
    }
  }

  /**
   * Cleanup all active subscriptions
   */
  cleanup(): void {
    this.unsubscribeCallbacks.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.unsubscribeCallbacks.clear();
  }

  /**
   * Get station schedule (timetable) from Seoul Open API
   * @param stationCode Station code
   * @param weekTag '1': Weekday, '2': Saturday, '3': Holiday/Sunday
   * @param direction '1': Up/Inner, '2': Down/Outer
   */
  async getStationSchedule(
    stationCode: string, 
    weekTag: '1' | '2' | '3' = '1', 
    direction: '1' | '2' = '1'
  ): Promise<SeoulTimetableRow[]> {
    try {
      return await seoulSubwayApi.getStationTimetable(stationCode, weekTag, direction);
    } catch (error) {
      console.error('Error fetching station schedule:', error);
      return [];
    }
  }
}


// Export singleton instance
export const trainService = new TrainService();