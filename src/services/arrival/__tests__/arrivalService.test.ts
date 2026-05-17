/**
 * ArrivalService Tests
 * Coverage target: 80%
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrivalService, ArrivalInfo, ArrivalCallback } from '../arrivalService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn(),
    convertToAppTrain: jest.fn((data) => ({
      lineId: data.subwayId || '2',
      stationId: data.statnId,
      stationName: data.statnNm,
      direction: data.updnLine === '상행' ? 'up' : 'down',
      arrivalMessage: data.arvlMsg2 || '2분 후 도착',
      arrivalTime: 120,
      trainNumber: data.btrainNo || '1234',
      destinationStation: data.bstatnNm || '신도림',
      lastUpdated: new Date(),
    })),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSeoulSubwayApi =
  require('@/services/api/seoulSubwayApi').seoulSubwayApi;

describe('ArrivalService', () => {
  let service: ArrivalService;

  // Test fixtures
  const mockSeoulApiResponse = [
    {
      rowNum: '1',
      selectedCount: '10',
      totalCount: '10',
      subwayId: '1002',
      updnLine: '상행',
      trainLineNm: '2호선',
      subwayHeading: '신도림방면',
      statnFid: '0221',
      statnTid: '0223',
      statnId: '0222',
      statnNm: '강남',
      trainCo: '',
      ordkey: '01000강남0',
      subwayList: '',
      statnList: '',
      btrainSttus: '',
      barvlDt: '120',
      btrainNo: '2345',
      bstatnId: '',
      bstatnNm: '신도림',
      recptnDt: '2024-01-10 12:00:00',
      arvlMsg2: '2분 후 도착',
      arvlMsg3: '2번째 전역',
      arvlCd: '1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mocks
    mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(
      mockSeoulApiResponse
    );
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);

    // Create fresh service instance
    service = new ArrivalService({
      minPollingInterval: 30000,
      cacheTTL: 60000,
      maxRetries: 3,
      retryDelay: 100, // Fast retries for testing
    });
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  describe('getArrivals', () => {
    it('should return arrival info from API', async () => {
      const result = await service.getArrivals('강남');

      expect(result.stationName).toBe('강남');
      expect(result.source).toBe('api');
      expect(result.arrivals).toHaveLength(1);
      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledWith('강남');
    });

    it('should trim station name before fetching', async () => {
      await service.getArrivals('  강남  ');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledWith('강남');
    });

    it('should return empty arrivals for empty station name', async () => {
      const result = await service.getArrivals('');

      expect(result.arrivals).toHaveLength(0);
      expect(mockSeoulSubwayApi.getRealtimeArrival).not.toHaveBeenCalled();
    });

    it('should cache results after successful API call', async () => {
      await service.getArrivals('강남');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_arrival_강남',
        expect.any(String)
      );
    });

    it('should return cached data when within polling interval', async () => {
      // First call
      await service.getArrivals('강남');

      // Mock cache response
      const cachedData: ArrivalInfo = {
        stationName: '강남',
        stationId: '0222',
        arrivals: [],
        lastUpdated: new Date(),
        source: 'api',
      };
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          data: cachedData,
          expiry: Date.now() + 60000,
        })
      );

      // Second call immediately after (within 30s)
      const result = await service.getArrivals('강남');

      expect(result.source).toBe('cache');
      // API should only be called once (first call)
      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(1);
    });

    it('should call API after polling interval elapsed', async () => {
      // First call
      await service.getArrivals('강남');

      // Advance time past polling interval
      jest.advanceTimersByTime(31000);

      // No cache
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Second call after 31 seconds
      await service.getArrivals('강남');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should not call API within minPollingInterval', async () => {
      await service.getArrivals('강남');

      // Set up cache for subsequent calls
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          data: { stationName: '강남', arrivals: [], lastUpdated: new Date(), source: 'api', stationId: 'test' },
          expiry: Date.now() + 60000,
        })
      );

      // Try to fetch again immediately
      jest.advanceTimersByTime(10000); // 10 seconds
      await service.getArrivals('강남');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(1);
    });

    it('should call API after minPollingInterval with no cache', async () => {
      await service.getArrivals('강남');

      jest.advanceTimersByTime(31000);

      await service.getArrivals('강남');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should call API successfully after first failure', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      // Clear any previous mock calls
      mockSeoulSubwayApi.getRealtimeArrival.mockReset();

      mockSeoulSubwayApi.getRealtimeArrival
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSeoulApiResponse);

      const result = await testService.getArrivals('강남');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
      expect(result.source).toBe('api');

      testService.destroy();
      jest.useFakeTimers();
    });

    it('should return empty after max retries exceeded', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      // Clear any previous mock calls
      mockSeoulSubwayApi.getRealtimeArrival.mockReset();
      mockAsyncStorage.getItem.mockResolvedValue(null);

      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(
        new Error('Persistent error')
      );

      const result = await testService.getArrivals('강남');

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
      expect(result.arrivals).toHaveLength(0);

      testService.destroy();
      jest.useFakeTimers();
    });

    it('should use cache when API fails after retries', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      // Clear any previous mock calls
      mockSeoulSubwayApi.getRealtimeArrival.mockReset();

      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(
        new Error('All retries failed')
      );

      const cachedData: ArrivalInfo = {
        stationName: '강남',
        stationId: '0222',
        arrivals: [
          {
            trainId: 'cached-train',
            lineId: '2',
            direction: 'up',
            destination: '신도림',
            arrivalSeconds: 300,
            arrivalMessage: '5분 후 도착',
            trainNumber: '1111',
          },
        ],
        lastUpdated: new Date(),
        source: 'api',
      };

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          data: cachedData,
          expiry: Date.now() + 60000,
        })
      );

      const result = await testService.getArrivals('강남');

      expect(result.source).toBe('cache');
      expect(result.arrivals).toHaveLength(1);

      testService.destroy();
      jest.useFakeTimers();
    });
  });

  // Phase #2 (2026-05-17): throwOnError opt-in skips cache fallback so callers
  // routing errors to categorized UI (ErrorFallback) see the original error
  // instance (e.g. SeoulApiError with .category) instead of silently degrading
  // to stale cache. Default false preserves legacy behavior — separate test
  // above ('should use cache when API fails after retries') guards that.
  describe('throwOnError option', () => {
    it('rethrows the original error after retries when throwOnError=true and no cache', async () => {
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      mockSeoulSubwayApi.getRealtimeArrival.mockReset();
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const original = new Error('Persistent error');
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(original);

      await expect(
        testService.getArrivals('강남', { throwOnError: true }),
      ).rejects.toBe(original);

      // Retry chain still ran in full — throwOnError only controls the
      // cache-fallback layer, not retry behavior.
      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);

      testService.destroy();
      jest.useFakeTimers();
    });

    it('rethrows even when cache is available (cache fallback bypassed)', async () => {
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      mockSeoulSubwayApi.getRealtimeArrival.mockReset();

      const original = new Error('All retries failed');
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(original);

      // Cache is present, but throwOnError=true should ignore it.
      const cachedData: ArrivalInfo = {
        stationName: '강남',
        stationId: '0222',
        arrivals: [
          {
            trainId: 'cached-train',
            lineId: '2',
            direction: 'up',
            destination: '신도림',
            arrivalSeconds: 300,
            arrivalMessage: '5분 후 도착',
            trainNumber: '1111',
          },
        ],
        lastUpdated: new Date(),
        source: 'api',
      };
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ data: cachedData, expiry: Date.now() + 60000 }),
      );

      await expect(
        testService.getArrivals('강남', { throwOnError: true }),
      ).rejects.toBe(original);

      testService.destroy();
      jest.useFakeTimers();
    });

    it('preserves error instance identity (instanceof / category survives)', async () => {
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      mockSeoulSubwayApi.getRealtimeArrival.mockReset();
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Simulate SeoulApiError-like instance — what dataManager forwards to
      // ErrorFallback. We don't import the real class to keep this unit test
      // free of api module side effects; subclass identity is what matters.
      class FakeSeoulApiError extends Error {
        constructor(
          message: string,
          public category: 'quota' | 'auth' | 'transient',
        ) {
          super(message);
          this.name = 'SeoulApiError';
        }
      }
      const original = new FakeSeoulApiError('ERROR-336', 'transient');
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(original);

      const promise = testService.getArrivals('강남', { throwOnError: true });
      await expect(promise).rejects.toBe(original);
      await promise.catch((err: unknown) => {
        // Category survives — ErrorFallback can branch on it downstream.
        expect(err).toBeInstanceOf(FakeSeoulApiError);
        expect((err as FakeSeoulApiError).category).toBe('transient');
      });

      testService.destroy();
      jest.useFakeTimers();
    });

    it('subscribe forwards error to callback when throwOnError=true', async () => {
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 5,
      });

      mockSeoulSubwayApi.getRealtimeArrival.mockReset();
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const original = new Error('subscribe-time failure');
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(original);

      const callback: jest.MockedFunction<ArrivalCallback> = jest.fn();

      const unsubscribe = testService.subscribe(
        '강남',
        callback,
        30000,
        { throwOnError: true },
      );

      // Wait for initial getArrivals to settle (retry chain runs).
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Callback was invoked with (null, error) — exactly what dataManager
      // forwards to the consumer.
      expect(callback).toHaveBeenCalledWith(null, original);

      unsubscribe();
      testService.destroy();
      jest.useFakeTimers();
    });
  });

  describe('Caching', () => {
    it('should save to AsyncStorage after API call', async () => {
      await service.getArrivals('강남');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_arrival_강남',
        expect.stringContaining('"stationName":"강남"')
      );
    });

    it('should read from AsyncStorage when available', async () => {
      const cachedData: ArrivalInfo = {
        stationName: '강남',
        stationId: '0222',
        arrivals: [],
        lastUpdated: new Date().toISOString() as unknown as Date,
        source: 'api',
      };

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          data: cachedData,
          expiry: Date.now() + 60000,
        })
      );

      // First call - should use API
      await service.getArrivals('강남');

      // Second call within interval - should use cache
      const result = await service.getArrivals('강남');

      expect(result.source).toBe('cache');
    });

    it('should handle expired cache by calling API', async () => {
      // Setup: First call to set lastFetchTime
      await service.getArrivals('강남');

      // Advance time past polling interval
      jest.advanceTimersByTime(31000);

      // Now set expired cache
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          data: { stationName: '강남', arrivals: [], lastUpdated: new Date(), source: 'api', stationId: 'test' },
          expiry: Date.now() - 1000, // Expired
        })
      );

      // Second call should call API since cache is expired
      await service.getArrivals('강남');

      // Should have called API twice (first + after expiry)
      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledTimes(2);
    });

    it('should handle cache read errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await service.getArrivals('강남');

      expect(result.source).toBe('api');
      expect(result.stationName).toBe('강남');
    });

    it('should handle cache write errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Write error'));

      // Should not throw
      const result = await service.getArrivals('강남');

      expect(result.source).toBe('api');
    });
  });

  describe('subscribe', () => {
    it('should call callback with initial data', async () => {
      const callback = jest.fn();

      service.subscribe('강남', callback);

      // Wait for initial fetch
      await jest.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ stationName: '강남' })
      );
    });

    it('should poll at specified interval', async () => {
      const callback = jest.fn();

      service.subscribe('강남', callback, 30000);

      // Initial call
      await jest.runOnlyPendingTimersAsync();

      // Advance to next poll
      jest.advanceTimersByTime(30000);
      await jest.runOnlyPendingTimersAsync();

      // Should have been called at least twice (initial + 1 poll)
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should share polling for multiple subscribers', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.subscribe('강남', callback1);
      service.subscribe('강남', callback2);

      await jest.runOnlyPendingTimersAsync();

      // Both callbacks should receive data
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should stop polling when all subscribers unsubscribe', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsub1 = service.subscribe('강남', callback1);
      const unsub2 = service.subscribe('강남', callback2);

      await jest.runOnlyPendingTimersAsync();

      unsub1();
      unsub2();

      // Advance time
      jest.advanceTimersByTime(60000);
      await jest.runOnlyPendingTimersAsync();

      const callCount1 = callback1.mock.calls.length;
      const callCount2 = callback2.mock.calls.length;

      // Advance more time - no more calls should happen
      jest.advanceTimersByTime(60000);
      await jest.runOnlyPendingTimersAsync();

      expect(callback1.mock.calls.length).toBe(callCount1);
      expect(callback2.mock.calls.length).toBe(callCount2);
    });

    it('should return error for empty station name', async () => {
      const callback = jest.fn();

      service.subscribe('', callback);

      expect(callback).toHaveBeenCalledWith(null, expect.any(Error));
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific station', async () => {
      await service.clearCache('강남');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        '@livemetro_arrival_강남'
      );
    });

    it('should clear all cache when no station specified', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        '@livemetro_arrival_강남',
        '@livemetro_arrival_잠실',
        '@other_key',
      ]);

      await service.clearCache();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@livemetro_arrival_강남',
        '@livemetro_arrival_잠실',
      ]);
    });
  });

  describe('destroy', () => {
    it('should clear all intervals', () => {
      const callback = jest.fn();
      service.subscribe('강남', callback);
      service.subscribe('잠실', callback);

      service.destroy();

      // Advance time - no more calls should happen
      const callCount = callback.mock.calls.length;
      jest.advanceTimersByTime(120000);

      expect(callback.mock.calls.length).toBe(callCount);
    });

    it('should clear all subscriptions', async () => {
      const callback = jest.fn();
      service.subscribe('강남', callback);

      await jest.runOnlyPendingTimersAsync();
      const initialCallCount = callback.mock.calls.length;

      service.destroy();

      jest.advanceTimersByTime(60000);
      await jest.runOnlyPendingTimersAsync();

      expect(callback.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Error Handling', () => {
    it('should return empty arrivals on network error with no cache', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const testService = new ArrivalService({
        minPollingInterval: 30000,
        cacheTTL: 60000,
        maxRetries: 2,
        retryDelay: 10,
      });

      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(
        new Error('Network error')
      );

      const result = await testService.getArrivals('강남');

      expect(result.arrivals).toHaveLength(0);
      expect(result.stationName).toBe('강남');

      testService.destroy();
      jest.useFakeTimers();
    });

    it('should notify subscribers of errors', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(
        new Error('API error')
      );

      const callback: ArrivalCallback = jest.fn();

      service.subscribe('강남', callback);
      await jest.runOnlyPendingTimersAsync();

      // After all retries fail, should still receive a result (empty or cached)
      expect(callback).toHaveBeenCalled();
    });
  });
});
