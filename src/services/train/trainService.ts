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
import { 
  Train, 
  Station, 
  SubwayLine, 
  TrainDelay, 
  CongestionData,
  // TrainStatus, // Will be used in future updates
  DelaySeverity 
} from '../../models/train';

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
      console.error('Error fetching subway lines:', error);
      throw new Error('지하철 노선 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * Get stations for a specific line
   */
  async getStationsByLine(lineId: string): Promise<Station[]> {
    try {
      const stationsQuery = query(
        collection(firestore, 'stations'),
        where('lineId', '==', lineId),
        orderBy('sequence')
      );
      
      const stationsSnapshot = await getDocs(stationsQuery);
      return stationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Station));
    } catch (error) {
      console.error('Error fetching stations:', error);
      throw new Error('역 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * Get station details by ID
   */
  async getStation(stationId: string): Promise<Station | null> {
    try {
      const stationDoc = await getDoc(doc(firestore, 'stations', stationId));
      
      if (stationDoc.exists()) {
        return {
          id: stationDoc.id,
          ...stationDoc.data()
        } as Station;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching station:', error);
      throw new Error('역 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * Subscribe to real-time train updates for a station
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

    const unsubscribe = onSnapshot(
      trainsQuery,
      (snapshot) => {
        const trains: Train[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          arrivalTime: doc.data().arrivalTime?.toDate() || null,
          lastUpdated: doc.data().lastUpdated.toDate()
        } as Train));

        callback(trains);
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
   */
  async searchStations(searchTerm: string): Promise<Station[]> {
    try {
      // Firebase doesn't support full-text search, so we'll implement a simple approach
      // In production, consider using Algolia or similar service for better search
      const stationsSnapshot = await getDocs(collection(firestore, 'stations'));
      
      const allStations: Station[] = stationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Station));

      // Filter stations that match the search term (case-insensitive)
      const filteredStations = allStations.filter(station =>
        station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return filteredStations.slice(0, 20); // Limit results
    } catch (error) {
      console.error('Error searching stations:', error);
      throw new Error('역 검색에 실패했습니다.');
    }
  }

  /**
   * Get nearby stations based on user location
   */
  async getNearbyStations(
    latitude: number, 
    longitude: number, 
    radiusKm: number = 2
  ): Promise<Station[]> {
    try {
      // Simple distance calculation (not precise for production)
      // In production, use Geohash or Firebase Geofirestore for spatial queries
      const stationsSnapshot = await getDocs(collection(firestore, 'stations'));
      
      const allStations: Station[] = stationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Station));

      const nearbyStations = allStations.filter(station => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          station.coordinates.latitude,
          station.coordinates.longitude
        );
        return distance <= radiusKm;
      });

      // Sort by distance
      nearbyStations.sort((a, b) => {
        const distA = this.calculateDistance(latitude, longitude, a.coordinates.latitude, a.coordinates.longitude);
        const distB = this.calculateDistance(latitude, longitude, b.coordinates.latitude, b.coordinates.longitude);
        return distA - distB;
      });

      return nearbyStations.slice(0, 10); // Return closest 10 stations
    } catch (error) {
      console.error('Error fetching nearby stations:', error);
      throw new Error('주변 역 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
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
}

// Export singleton instance
export const trainService = new TrainService();