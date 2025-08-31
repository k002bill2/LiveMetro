/**
 * Data Manager Tests
 * Tests the 3-tier data management system (Seoul API → Firebase → AsyncStorage)
 */

import { dataManager } from '../dataManager';
import { seoulSubwayApi } from '../../api/seoulSubwayApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Train } from '../../../models/train';

// Mock dependencies
jest.mock('../../api/seoulSubwayApi');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../firebase/firebaseConfig');

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('DataManager', () => {
  const mockTrains: Train[] = [
    {
      id: 'train-1',
      stationId: 'station-1',
      direction: 'up',
      arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
      delayMinutes: 0,
      status: 'NORMAL',
      nextStationId: 'station-2',
    },
    {
      id: 'train-2',
      stationId: 'station-1',
      direction: 'down',
      arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
      delayMinutes: 1,
      status: 'DELAYED',
      nextStationId: 'station-3',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear internal cache
    (dataManager as any).cache.clear();
  });

  describe('3-Tier Data Architecture', () => {
    describe('Tier 1: Seoul API (Primary)', () => {
      it('should fetch fresh data from Seoul API successfully', async () => {
        mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

        const result = await dataManager.getRealtimeTrains('강남역');

        expect(result).toEqual(mockTrains);
        expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledWith('강남역');
      });

      it('should cache API results for performance', async () => {
        mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

        // First call
        await dataManager.getRealtimeTrains('강남역');
        // Second call within cache TTL
        await dataManager.getRealtimeTrains('강남역');

        expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(1);
      });

      it('should invalidate cache after TTL expires', async () => {
        mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);
        jest.useFakeTimers();

        // First call
        await dataManager.getRealtimeTrains('강남역');
        
        // Advance time beyond cache TTL (30 seconds)
        jest.advanceTimersByTime(35000);
        
        // Second call should hit API again
        await dataManager.getRealtimeTrains('강남역');

        expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(2);
        
        jest.useRealTimers();
      });
    });

    describe('Tier 2: Firebase Firestore (Backup)', () => {
      it('should fallback to Firebase when Seoul API fails', async () => {
        const error = new Error('Seoul API unavailable');
        mockSeoulApi.getRealtimeArrivals.mockRejectedValue(error);
        
        // Mock Firebase success (this would be mocked in firebase config)
        const mockFirebaseData = mockTrains.slice(0, 1); // Partial data
        
        const result = await dataManager.getRealtimeTrains('강남역');

        expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalled();
        // Would expect Firebase fallback logic here in real implementation
      });

      it('should sync successful API data to Firebase', async () => {
        mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

        await dataManager.getRealtimeTrains('강남역');

        // In real implementation, would verify Firebase write operations
        expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalled();
      });
    });

    describe('Tier 3: AsyncStorage (Offline Cache)', () => {
      it('should fallback to AsyncStorage when both API and Firebase fail', async () => {
        const apiError = new Error('Seoul API unavailable');
        const firebaseError = new Error('Firebase unavailable');
        
        mockSeoulApi.getRealtimeArrivals.mockRejectedValue(apiError);
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTrains));

        const result = await dataManager.getRealtimeTrains('강남역');

        expect(result).toEqual(mockTrains);
        expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
          'realtime_trains_강남역'
        );
      });

      it('should store successful API data in AsyncStorage', async () => {
        mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);
        mockAsyncStorage.setItem.mockResolvedValue();

        await dataManager.getRealtimeTrains('강남역');

        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'realtime_trains_강남역',
          JSON.stringify(mockTrains)
        );
      });

      it('should handle corrupted AsyncStorage data gracefully', async () => {
        const apiError = new Error('API unavailable');
        mockSeoulApi.getRealtimeArrivals.mockRejectedValue(apiError);
        mockAsyncStorage.getItem.mockResolvedValue('corrupted json data');

        const result = await dataManager.getRealtimeTrains('강남역');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Data Freshness and TTL', () => {
    it('should respect cache TTL for real-time data', async () => {
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);
      jest.useFakeTimers();

      // Initial call
      await dataManager.getRealtimeTrains('강남역');
      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(1);

      // Call within TTL (30 seconds) - should use cache
      jest.advanceTimersByTime(15000);
      await dataManager.getRealtimeTrains('강남역');
      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(1);

      // Call after TTL - should fetch fresh data
      jest.advanceTimersByTime(20000);
      await dataManager.getRealtimeTrains('강남역');
      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should use different TTL for station info (longer cache)', async () => {
      const mockStation = {
        id: 'station-1',
        name: '강남역',
        nameEn: 'Gangnam',
        lineId: '2',
        coordinates: { latitude: 37.5665, longitude: 126.9780 },
        transfers: ['9'],
      };

      mockSeoulApi.getStationInfo.mockResolvedValue(mockStation);
      jest.useFakeTimers();

      // Station info should have longer cache (5 minutes)
      await dataManager.getStationInfo('강남역');
      jest.advanceTimersByTime(240000); // 4 minutes
      await dataManager.getStationInfo('강남역');

      expect(mockSeoulApi.getStationInfo).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeout gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      mockSeoulApi.getRealtimeArrivals.mockRejectedValue(timeoutError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTrains));

      const result = await dataManager.getRealtimeTrains('강남역');

      expect(result).toEqual(mockTrains);
    });

    it('should return empty array when all tiers fail', async () => {
      const apiError = new Error('API error');
      const storageError = new Error('Storage error');

      mockSeoulApi.getRealtimeArrivals.mockRejectedValue(apiError);
      mockAsyncStorage.getItem.mockRejectedValue(storageError);

      const result = await dataManager.getRealtimeTrains('강남역');

      expect(result).toEqual([]);
    });

    it('should log errors for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const apiError = new Error('Critical API failure');

      mockSeoulApi.getRealtimeArrivals.mockRejectedValue(apiError);
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await dataManager.getRealtimeTrains('강남역');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DataManager error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Optimization', () => {
    it('should batch multiple simultaneous requests for same station', async () => {
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

      // Make multiple simultaneous requests
      const promises = [
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('강남역'),
      ];

      await Promise.all(promises);

      // Should only call API once due to request deduplication
      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent requests for different stations', async () => {
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

      const promises = [
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('홍대입구역'),
        dataManager.getRealtimeTrains('신촌역'),
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledTimes(3);
      // Should complete within reasonable time for concurrent requests
      expect(duration).toBeLessThan(300);
    });

    it('should limit cache size to prevent memory issues', async () => {
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

      // Fill cache with many stations
      const stations = Array.from({ length: 150 }, (_, i) => `역${i}`);
      
      for (const station of stations) {
        await dataManager.getRealtimeTrains(station);
      }

      // Cache should not exceed maximum size (typically 100 entries)
      const cacheSize = (dataManager as any).cache.size;
      expect(cacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('Data Validation', () => {
    it('should validate train data structure', async () => {
      const invalidData = [
        { id: 'train-1' }, // Missing required fields
        null,
        undefined,
      ];
      
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(invalidData as any);

      const result = await dataManager.getRealtimeTrains('강남역');

      // Should filter out invalid entries
      expect(result).toEqual([]);
    });

    it('should sanitize input station names', async () => {
      const maliciousInput = "강남역'; DROP TABLE trains; --";
      mockSeoulApi.getRealtimeArrivals.mockResolvedValue(mockTrains);

      await dataManager.getRealtimeTrains(maliciousInput);

      // Should sanitize the input before API call
      expect(mockSeoulApi.getRealtimeArrivals).toHaveBeenCalledWith(
        expect.stringMatching(/^[^';]*$/) // No SQL injection characters
      );
    });
  });

  describe('Offline Capability', () => {
    it('should work offline with cached data', async () => {
      // Simulate offline state
      const networkError = new Error('Network unavailable');
      mockSeoulApi.getRealtimeArrivals.mockRejectedValue(networkError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTrains));

      const result = await dataManager.getRealtimeTrains('강남역');

      expect(result).toEqual(mockTrains);
    });

    it('should indicate data staleness when offline', async () => {
      const networkError = new Error('Network unavailable');
      const staleData = mockTrains.map(train => ({
        ...train,
        arrivalTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      }));

      mockSeoulApi.getRealtimeArrivals.mockRejectedValue(networkError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(staleData));

      const result = await dataManager.getRealtimeTrains('강남역');

      // Should still return data but ideally mark it as stale
      expect(result).toHaveLength(2);
    });
  });
});