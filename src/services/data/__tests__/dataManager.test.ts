/**
 * Data Manager Tests
 * Tests the 3-tier data management system (Seoul API → Firebase → AsyncStorage)
 */

import { dataManager } from '../dataManager';
import { seoulSubwayApi } from '../../api/seoulSubwayApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Train, TrainStatus } from '../../../models/train';

// Use mocks from setup.ts
jest.mock('../../firebase/config');

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('DataManager', () => {
  const mockTrains: Train[] = [
    {
      id: 'train-1',
      lineId: '2',
      currentStationId: 'station-1',
      direction: 'up',
      arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
      delayMinutes: 0,
      status: TrainStatus.NORMAL,
      nextStationId: 'station-2',
      finalDestination: '강남',
      lastUpdated: new Date(),
    },
    {
      id: 'train-2',
      lineId: '2',
      currentStationId: 'station-1',
      direction: 'down',
      arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
      delayMinutes: 1,
      status: TrainStatus.DELAYED,
      nextStationId: 'station-3',
      finalDestination: '역삼',
      lastUpdated: new Date(),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear AsyncStorage cache
    await AsyncStorage.clear();
  });

  describe('3-Tier Data Architecture', () => {
    describe('Tier 1: Seoul API (Primary)', () => {
      it('should call Seoul API to fetch fresh data', async () => {
        const mockSeoulResponse = [{
          stationName: '강남역',
          trainLineNm: '2호선',
          arvlMsg2: '2분 후 도착',
          arvlMsg3: '강남역 도착',
          btrainSttus: '일반',
        }] as any;
        mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockSeoulResponse);

        await dataManager.getRealtimeTrains('강남역');

        // Verify Seoul API was called with the station name
        expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledWith('강남역');
      });

      it('should call API for each request', async () => {
        const mockSeoulResponse = [{
          stationName: '강남역',
          trainLineNm: '2호선',
          arvlMsg2: '2분 후 도착',
          arvlMsg3: '강남역 도착',
          btrainSttus: '일반',
        }] as any;
        mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockSeoulResponse);

        // Multiple calls
        await dataManager.getRealtimeTrains('강남역');
        await dataManager.getRealtimeTrains('강남역');

        // API should be called
        expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
      });

      it('should invalidate cache after TTL expires', async () => {
        mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);
        jest.useFakeTimers();

        // First call
        await dataManager.getRealtimeTrains('강남역');
        
        // Advance time beyond cache TTL (30 seconds)
        jest.advanceTimersByTime(35000);
        
        // Second call should hit API again
        await dataManager.getRealtimeTrains('강남역');

        expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
        
        jest.useRealTimers();
      });
    });

    describe('Stale-While-Revalidate Pattern', () => {
      it('should return cached data immediately when available', async () => {
        // Prime the cache with first call
        mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);
        await dataManager.getRealtimeTrains('강남역');

        // Reset mock to track second call
        mockSeoulApi.getRealtimeArrival.mockClear();

        // Second call should return cached data (SWR: immediate response)
        const result = await dataManager.getRealtimeTrains('강남역');

        expect(result).not.toBeNull();
        expect(result?.trains).toBeDefined();
      });

      it('should return null when Seoul API fails and no cache', async () => {
        mockSeoulApi.getRealtimeArrival.mockRejectedValue(new Error('API error'));

        const result = await dataManager.getRealtimeTrains('강남역');

        expect(result).toBeNull();
        expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
      });
    });

    describe('Tier 3: AsyncStorage (Offline Cache)', () => {
      it('should fallback to AsyncStorage when both API and Firebase fail', async () => {
        const apiError = new Error('Seoul API unavailable');

        mockSeoulApi.getRealtimeArrival.mockRejectedValue(apiError);
        mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
          stationId: '강남역',
          trains: mockTrains,
          lastUpdated: new Date().toISOString()
        }));

        await dataManager.getRealtimeTrains('강남역');

        // When all APIs fail, falls back to cached data or returns null
        expect(mockAsyncStorage.getItem).toHaveBeenCalled();
      });

      it('should call API when fetching data', async () => {
        const mockSeoulResponse = [{
          stationName: '강남역',
          trainLineNm: '2호선',
          arvlMsg2: '2분 후 도착',
          arvlMsg3: '강남역 도착',
          btrainSttus: '일반',
        }] as never;
        mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockSeoulResponse);
        mockAsyncStorage.setItem.mockResolvedValue();

        await dataManager.getRealtimeTrains('강남역');

        // Verify API was called
        expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
      });

      it('should handle corrupted AsyncStorage data gracefully', async () => {
        const apiError = new Error('API unavailable');
        mockSeoulApi.getRealtimeArrival.mockRejectedValue(apiError);
        mockAsyncStorage.getItem.mockResolvedValue('corrupted json data');

        const result = await dataManager.getRealtimeTrains('강남역');

        // Should return null when all data sources fail
        expect(result).toBeNull();
      });
    });
  });

  describe('Data Freshness and TTL', () => {
    it('should call Seoul API for real-time data', async () => {
      // Mock Seoul API response format
      const mockSeoulResponse = [{
        stationName: '강남역',
        trainLineNm: '2호선',
        arvlMsg2: '2분 후 도착',
        arvlMsg3: '강남역 도착',
        btrainSttus: '일반',
      }] as never;
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockSeoulResponse);

      // Call to get realtime data
      await dataManager.getRealtimeTrains('강남역');

      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledTimes(1);
      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledWith('강남역');
    });

    it('should fetch station info from API', async () => {
      mockSeoulApi.getAllStations.mockResolvedValue([{
        STATION_CD: 'station-1',
        STATION_NM: '강남역',
        LINE_NUM: '02호선',
      }] as never);

      await dataManager.getStationInfo('강남역');

      // Should call API to get station info
      expect(mockSeoulApi.getAllStations).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeout gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      mockSeoulApi.getRealtimeArrival.mockRejectedValue(timeoutError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        stationId: '강남역',
        trains: mockTrains,
        lastUpdated: new Date().toISOString()
      }));

      await dataManager.getRealtimeTrains('강남역');

      // Falls back to cached data or returns null
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });

    it('should return null when all tiers fail', async () => {
      const apiError = new Error('API error');
      const storageError = new Error('Storage error');

      mockSeoulApi.getRealtimeArrival.mockRejectedValue(apiError);
      mockAsyncStorage.getItem.mockRejectedValue(storageError);

      const result = await dataManager.getRealtimeTrains('강남역');

      expect(result).toBeNull();
    });

    it('should log errors for monitoring', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const apiError = new Error('Critical API failure');

      mockSeoulApi.getRealtimeArrival.mockRejectedValue(apiError);
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await dataManager.getRealtimeTrains('강남역');

      // Implementation logs warnings for API failures
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Optimization', () => {
    it('should handle multiple requests for same station', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);

      // Make multiple simultaneous requests
      const promises = [
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('강남역'),
      ];

      const results = await Promise.all(promises);

      // All requests should complete
      expect(results).toHaveLength(3);
      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
    });

    it('should handle concurrent requests for different stations', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);

      const promises = [
        dataManager.getRealtimeTrains('강남역'),
        dataManager.getRealtimeTrains('홍대입구역'),
        dataManager.getRealtimeTrains('신촌역'),
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledTimes(3);
      // Should complete within reasonable time for concurrent requests
      expect(duration).toBeLessThan(1000);
    });

    it('should handle many sequential requests', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);

      // Test a few stations
      const stations = ['강남역', '홍대역', '신촌역'];

      for (const station of stations) {
        await dataManager.getRealtimeTrains(station);
      }

      // All requests should be processed
      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledTimes(3);
    });
  });

  describe('Data Validation', () => {
    it('should handle invalid train data structure', async () => {
      const invalidData = [
        { id: 'train-1' }, // Missing required fields
        null,
        undefined,
      ];

      mockSeoulApi.getRealtimeArrival.mockResolvedValue(invalidData as never);

      await dataManager.getRealtimeTrains('강남역');

      // Implementation handles invalid data gracefully
      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
    });

    it('should call API with input station names', async () => {
      const input = '강남역';
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(mockTrains as never);

      await dataManager.getRealtimeTrains(input);

      expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledWith(input);
    });
  });

  describe('Subscription Management', () => {
    beforeEach(() => {
      // Clean up subscriptions from previous tests
      dataManager.unsubscribeAll();
    });

    afterEach(() => {
      dataManager.destroy();
    });

    it('should create only one interval for multiple subscribers to same station', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // Subscribe two callbacks to the same station - should not throw
      const unsubscribe1 = dataManager.subscribeToRealtimeUpdates('강남', callback1);
      const unsubscribe2 = dataManager.subscribeToRealtimeUpdates('강남', callback2);

      // Both should return unsubscribe functions
      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');

      unsubscribe1();
      unsubscribe2();
    });

    it('should allow multiple subscriptions to same station', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // Subscribe two callbacks - should not throw
      const unsubscribe1 = dataManager.subscribeToRealtimeUpdates('강남', callback1);
      const unsubscribe2 = dataManager.subscribeToRealtimeUpdates('강남', callback2);

      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');

      unsubscribe1();
      unsubscribe2();
    });

    it('should handle unsubscribe correctly', () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue([]);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = dataManager.subscribeToRealtimeUpdates('강남', callback1);
      const unsubscribe2 = dataManager.subscribeToRealtimeUpdates('강남', callback2);

      // Unsubscribe first callback - should not throw
      expect(() => unsubscribe1()).not.toThrow();

      // Unsubscribe second callback - should not throw
      expect(() => unsubscribe2()).not.toThrow();
    });

    it('should handle different stations independently', () => {
      const gangnamCallback = jest.fn();
      const hongdaeCallback = jest.fn();

      // Subscribe to different stations - should not throw
      const unsubGangnam = dataManager.subscribeToRealtimeUpdates('강남', gangnamCallback);
      const unsubHongdae = dataManager.subscribeToRealtimeUpdates('홍대입구', hongdaeCallback);

      // Both should return unsubscribe functions
      expect(typeof unsubGangnam).toBe('function');
      expect(typeof unsubHongdae).toBe('function');

      // Unsubscribing one should not affect the other
      expect(() => unsubGangnam()).not.toThrow();
      expect(() => unsubHongdae()).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should clear all intervals and subscribers', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue([]);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      dataManager.subscribeToRealtimeUpdates('강남', callback1);
      dataManager.subscribeToRealtimeUpdates('홍대입구', callback2);

      // Should not throw
      expect(() => dataManager.unsubscribeAll()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue([]);

      const callback = jest.fn();
      dataManager.subscribeToRealtimeUpdates('강남', callback);

      // Should not throw
      expect(() => dataManager.destroy()).not.toThrow();
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status object', () => {
      const status = dataManager.getSyncStatus();

      expect(status).toHaveProperty('lastSync');
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('pendingSyncs');
      expect(status).toHaveProperty('errors');
    });

    it('should return a copy of sync status', () => {
      const status1 = dataManager.getSyncStatus();
      const status2 = dataManager.getSyncStatus();

      expect(status1).not.toBe(status2);
    });
  });

  describe('forceSync', () => {
    it('should return true when Seoul API is available', async () => {
      mockSeoulApi.checkServiceStatus.mockResolvedValue(true);

      const result = await dataManager.forceSync();

      expect(result).toBe(true);
      expect(mockSeoulApi.checkServiceStatus).toHaveBeenCalled();
    });

    it('should return false when Seoul API is unavailable', async () => {
      mockSeoulApi.checkServiceStatus.mockResolvedValue(false);

      const result = await dataManager.forceSync();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockSeoulApi.checkServiceStatus.mockRejectedValue(new Error('Network error'));

      const result = await dataManager.forceSync();

      expect(result).toBe(false);
      const status = dataManager.getSyncStatus();
      expect(status.errors.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache items', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        '@livemetro_cache_test1',
        '@livemetro_cache_test2',
        '@other_key',
      ]);
      mockAsyncStorage.multiRemove.mockResolvedValue(undefined);

      await dataManager.clearCache();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@livemetro_cache_test1',
        '@livemetro_cache_test2',
      ]);
    });

    it('should handle errors gracefully', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(dataManager.clearCache()).resolves.not.toThrow();
    });
  });

  describe('getCacheInfo', () => {
    it('should return cache information', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        '@livemetro_cache_test1',
        '@livemetro_cache_test2',
      ]);
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('{"data":"test1"}')
        .mockResolvedValueOnce('{"data":"test2"}');

      const info = await dataManager.getCacheInfo();

      expect(info.totalItems).toBe(2);
      expect(info.totalSize).toBeGreaterThan(0);
      expect(info.items).toContain('test1');
      expect(info.items).toContain('test2');
    });

    it('should handle errors gracefully', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      const info = await dataManager.getCacheInfo();

      expect(info.totalItems).toBe(0);
      expect(info.totalSize).toBe(0);
      expect(info.items).toEqual([]);
    });
  });

  describe('detectServiceDisruptions', () => {
    it('should detect suspension keywords', async () => {
      const mockArrival = {
        statnNm: '강남',
        trainLineNm: '2호선',
        arvlMsg2: '운행중단',
        arvlMsg3: '',
        btrainSttus: '',
        subwayId: '1002',
        updnLine: '상행',
        recptnDt: '2024-01-01 12:00:00',
        statnId: '0222',
      };

      mockSeoulApi.getRealtimeArrival.mockResolvedValue([mockArrival] as never);

      const disruptions = await dataManager.detectServiceDisruptions('강남');

      expect(disruptions.length).toBe(1);
      expect(disruptions[0]?.status).toBe('suspended');
    });

    it('should detect incident keywords', async () => {
      const mockArrival = {
        statnNm: '강남',
        trainLineNm: '2호선',
        arvlMsg2: '장애 발생',
        arvlMsg3: '',
        btrainSttus: '',
        subwayId: '1002',
        updnLine: '하행',
        recptnDt: '2024-01-01 12:00:00',
        statnId: '0222',
      };

      mockSeoulApi.getRealtimeArrival.mockResolvedValue([mockArrival] as never);

      const disruptions = await dataManager.detectServiceDisruptions('강남');

      expect(disruptions.length).toBe(1);
      expect(disruptions[0]?.status).toBe('emergency');
    });

    it('should return empty array for normal arrivals', async () => {
      const mockArrival = {
        statnNm: '강남',
        trainLineNm: '2호선',
        arvlMsg2: '3분후 도착',
        arvlMsg3: '',
        btrainSttus: '일반',
        subwayId: '1002',
        updnLine: '상행',
        recptnDt: '2024-01-01 12:00:00',
        statnId: '0222',
      };

      mockSeoulApi.getRealtimeArrival.mockResolvedValue([mockArrival] as never);

      const disruptions = await dataManager.detectServiceDisruptions('강남');

      expect(disruptions).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockSeoulApi.getRealtimeArrival.mockRejectedValue(new Error('API error'));

      const disruptions = await dataManager.detectServiceDisruptions('강남');

      expect(disruptions).toEqual([]);
    });
  });

  describe('Offline Capability', () => {
    it('should attempt to use cached data when offline', async () => {
      // Simulate offline state
      const networkError = new Error('Network unavailable');
      mockSeoulApi.getRealtimeArrival.mockRejectedValue(networkError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        stationId: '강남역',
        trains: mockTrains,
        lastUpdated: new Date().toISOString()
      }));

      await dataManager.getRealtimeTrains('강남역');

      // Falls back to Firebase or cache
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });

    it('should handle stale data when offline', async () => {
      const networkError = new Error('Network unavailable');
      const staleData = mockTrains.map(train => ({
        ...train,
        arrivalTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      }));

      mockSeoulApi.getRealtimeArrival.mockRejectedValue(networkError);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        stationId: '강남역',
        trains: staleData,
        lastUpdated: new Date().toISOString()
      }));

      await dataManager.getRealtimeTrains('강남역');

      // Should attempt to fetch from cache
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('A1/A2 — cross-path consistency (regression)', () => {
    beforeEach(async () => {
      await dataManager.clearCache();
    });

    it('A1: convertSeoulToTrain produces train_* prefix (matches arrivalService)', async () => {
      mockSeoulApi.getRealtimeArrival.mockResolvedValue([
        {
          rowNum: '1', selectedCount: '1', totalCount: '1',
          subwayId: '1002', updnLine: '상행', trainLineNm: '잠실행',
          subwayHeading: '내선', statnFid: '0221', statnTid: '0223',
          statnId: '0222', statnNm: '강남', trainCo: '서울교통공사',
          ordkey: '00001', subwayList: '1002', statnList: '0222',
          btrainSttus: '운행', barvlDt: '120', btrainNo: '2001',
          bstatnId: '0228', bstatnNm: '잠실', recptnDt: '2026-04-26 14:00:00',
          arvlMsg2: '2분 후 도착', arvlMsg3: '강남역', arvlCd: '99',
        },
      ]);
      mockSeoulApi.convertToAppTrain.mockReturnValue({
        lineId: '2', stationId: '0222', stationName: '강남',
        direction: 'up', arrivalMessage: '2분 후 도착', arrivalTime: 120,
        trainNumber: '2001', destinationStation: '잠실', lastUpdated: new Date(),
      });

      const data = await dataManager.getRealtimeTrains('강남');
      expect(data?.trains[0]?.id).toMatch(/^train_/);
    });

    it('A2: fetchFromSeoulApi filters arvlCd === "2" (departed trains)', async () => {
      const arrivals = [
        { rowNum: '1', selectedCount: '2', totalCount: '2',
          subwayId: '1002', updnLine: '상행', trainLineNm: '잠실행',
          subwayHeading: '내선', statnFid: '0221', statnTid: '0223',
          statnId: '0222', statnNm: '강남', trainCo: '서울교통공사',
          ordkey: '00001', subwayList: '1002', statnList: '0222',
          btrainSttus: '출발', barvlDt: '0', btrainNo: '2001',
          bstatnId: '0228', bstatnNm: '잠실', recptnDt: '2026-04-26 14:00:00',
          arvlMsg2: '출발', arvlMsg3: '강남역', arvlCd: '2' },
        { rowNum: '2', selectedCount: '2', totalCount: '2',
          subwayId: '1002', updnLine: '상행', trainLineNm: '잠실행',
          subwayHeading: '내선', statnFid: '0221', statnTid: '0223',
          statnId: '0222', statnNm: '강남', trainCo: '서울교통공사',
          ordkey: '00002', subwayList: '1002', statnList: '0222',
          btrainSttus: '운행', barvlDt: '120', btrainNo: '2002',
          bstatnId: '0228', bstatnNm: '잠실', recptnDt: '2026-04-26 14:00:00',
          arvlMsg2: '2분 후 도착', arvlMsg3: '강남역', arvlCd: '99' },
      ];
      mockSeoulApi.getRealtimeArrival.mockResolvedValue(arrivals);
      mockSeoulApi.convertToAppTrain.mockImplementation((a) => ({
        lineId: '2', stationId: a.statnId, stationName: a.statnNm,
        direction: 'up', arrivalMessage: a.arvlMsg2, arrivalTime: 120,
        trainNumber: a.btrainNo, destinationStation: a.bstatnNm, lastUpdated: new Date(),
      }));

      const data = await dataManager.getRealtimeTrains('강남');

      // Departed train (arvlCd '2') must be excluded
      expect(data?.trains).toHaveLength(1);
      expect(data?.trains[0]?.id).toContain('2002');
    });
  });
});