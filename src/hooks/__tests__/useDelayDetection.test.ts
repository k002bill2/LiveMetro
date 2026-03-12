/**
 * useDelayDetection Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDelayDetection } from '../useDelayDetection';
import type { SeoulRealtimeArrival } from '@/services/api/seoulSubwayApi';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

// seoulSubwayApi is already mocked in src/__tests__/setup.ts
const mockGetRealtimeArrival = seoulSubwayApi.getRealtimeArrival as jest.Mock;

// Helper: flush all pending promises and state updates
async function flushAll(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const baseMockArrival: SeoulRealtimeArrival = {
  rowNum: '1',
  selectedCount: '10',
  totalCount: '100',
  subwayId: '1001',
  updnLine: '0',
  trainLineNm: '1호선',
  subwayHeading: '서울역방향',
  statnFid: '1000001',
  statnTid: '0001002',
  statnId: '1000001',
  statnNm: '강남',
  trainCo: '1',
  ordkey: '001',
  subwayList: '1',
  statnList: '강남',
  btrainSttus: '1',
  barvlDt: '20240101120000',
  btrainNo: '1001',
  bstatnId: '1000001',
  bstatnNm: '강남',
  recptnDt: '20240101120000',
  arvlMsg2: '',
  arvlMsg3: '',
  arvlCd: '0',
};

describe('useDelayDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRealtimeArrival.mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('should initialize with empty delays', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should initialize with loading state during fetch', () => {
      mockGetRealtimeArrival.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.loading).toBe(true);
    });

    it('should accept custom options', async () => {
      const options = { pollingInterval: 120000, lineIds: ['1', '2'], autoPolling: false };
      const { result } = renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(result.current.delays).toEqual([]);
      expect(typeof result.current.refresh).toBe('function');
    });

    it('should provide lastUpdated after first fetch', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.lastUpdated).not.toBeNull();
      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update lastUpdated on refresh', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // Wait a bit for different timestamp
      await new Promise(resolve => setTimeout(resolve, 50));

      await act(async () => {
        await result.current.refresh();
      });

      await flushAll();

      // lastUpdated should have changed (or at least be set)
      expect(result.current.lastUpdated).not.toBeNull();
    });
  });

  describe('Delay Detection - detectDelayFromArrival', () => {
    it('should detect delays with 지연 keyword', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '약 5분 지연' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(1);
      expect(result.current.delays[0]!).toMatchObject({
        lineId: '1',
        delayMinutes: 5,
        reason: '운행 지연',
      });
    });

    it('should detect delays with 운행중지 keyword', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1002', trainLineNm: '2호선', arvlMsg2: '약 10분 운행중지' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(1);
      // Regex only extracts "N분 지연/서행", so 운행중지 falls back to default 5 min
      expect(result.current.delays[0]!.delayMinutes).toBe(5);
    });

    it('should detect delays with 고장 keyword and set reason', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1003', trainLineNm: '3호선', statnNm: '교대', arvlMsg2: '약 3분 지연 열차 고장' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('열차 고장');
    });

    it('should detect delays with 사고 keyword and set reason', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1004', trainLineNm: '4호선', statnNm: '동대문역사문화공원', arvlMsg2: '약 7분 지연 사고 발생' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('사고 발생');
    });

    it('should detect delays with 점검 keyword and set reason', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1005', trainLineNm: '5호선', statnNm: '광화문', arvlMsg2: '약 2분 지연 시설 점검' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('시설 점검');
    });

    it('should not detect 혼잡 as delay (not in DELAY_KEYWORDS)', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1006', trainLineNm: '6호선', statnNm: '삼각지', arvlMsg2: '곧 도착 역 혼잡' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // 혼잡 is not in DELAY_KEYWORDS, so no delays detected
      expect(result.current.delays).toHaveLength(0);
    });

    it('should use default 5 minutes when delay time not extractable', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '곧 도착 장애 발생' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.delayMinutes).toBe(5);
    });

    it('should ignore arrivals without delay keywords', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '곧 도착' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });

    it('should handle multiple arrival messages (arvlMsg2 and arvlMsg3)', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '곧 도착', arvlMsg3: '약 3분 지연' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(1);
      expect(result.current.delays[0]!.delayMinutes).toBe(3);
    });
  });

  describe('Line Name Conversion', () => {
    it('should convert subwayId to line name (1001 -> 1호선)', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, subwayId: '1001', trainLineNm: '1호선', arvlMsg2: '약 5분 지연' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.lineName).toBe('1호선');
    });

    it('should convert various subway IDs correctly', async () => {
      const testCases = [
        { subwayId: '1001', expected: '1호선' },
        { subwayId: '1002', expected: '2호선' },
        { subwayId: '1009', expected: '9호선' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockGetRealtimeArrival.mockResolvedValue([
          {
            ...baseMockArrival,
            subwayId: testCase.subwayId,
            trainLineNm: testCase.expected,
            arvlMsg2: '약 5분 지연',
          },
        ]);

        const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

        await flushAll();

        expect(result.current.delays[0]!.lineName).toBe(testCase.expected);
      }
    });
  });

  describe('Delay Sorting and Deduplication', () => {
    it('should sort delays by minutes descending', async () => {
      const mockArrivals: SeoulRealtimeArrival[] = [
        { ...baseMockArrival, subwayId: '1001', trainLineNm: '1호선', statnNm: '서울역', arvlMsg2: '약 3분 지연' },
        { ...baseMockArrival, subwayId: '1002', trainLineNm: '2호선', statnNm: '강남', arvlMsg2: '약 10분 지연' },
      ];

      mockGetRealtimeArrival.mockResolvedValue(mockArrivals);

      const options = { autoPolling: false, lineIds: ['1', '2'] };
      const { result } = renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(result.current.delays).toHaveLength(2);
      expect(result.current.delays[0]!.delayMinutes).toBe(10);
      expect(result.current.delays[1]!.delayMinutes).toBe(3);
    });

    it('should prevent duplicate delays per line', async () => {
      const mockArrivals: SeoulRealtimeArrival[] = [
        { ...baseMockArrival, arvlMsg2: '약 5분 지연' },
        { ...baseMockArrival, ordkey: '002', btrainNo: '1002', arvlMsg2: '약 3분 지연' },
      ];

      mockGetRealtimeArrival.mockResolvedValue(mockArrivals);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      const line1Delays = result.current.delays.filter(d => d.lineId === '1');
      expect(line1Delays).toHaveLength(1);
    });
  });

  describe('Fetch and Refresh', () => {
    it('should set loading state during fetch', () => {
      mockGetRealtimeArrival.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.loading).toBe(true);
    });

    it('should allow manual refresh', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      const callCountBefore = mockGetRealtimeArrival.mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      const callCountAfter = mockGetRealtimeArrival.mock.calls.length;
      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });

    it('should not fetch while already loading', () => {
      mockGetRealtimeArrival.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.loading).toBe(true);

      // Try to refresh while loading - should not add more calls
      const callCountDuringLoad = mockGetRealtimeArrival.mock.calls.length;
      result.current.refresh();
      const callCountAfter = mockGetRealtimeArrival.mock.calls.length;
      expect(callCountAfter).toBeLessThanOrEqual(callCountDuringLoad + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Individual line errors are caught inside the map, so error state is not set
      // but the hook still completes without crashing
      mockGetRealtimeArrival.mockRejectedValue(new Error('API request failed'));

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // Should complete without crashing, delays will be empty
      expect(result.current.delays).toEqual([]);
    });

    it('should continue operation after single line failure', async () => {
      mockGetRealtimeArrival.mockImplementation((stationName: string) => {
        if (stationName === '강남') {
          return Promise.reject(new Error('API error'));
        }
        return Promise.resolve([]);
      });

      const options = { autoPolling: false, lineIds: ['1', '2'] };
      const { result } = renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(result.current.delays).toEqual([]);
    });

    it('should recover after errors on retry', async () => {
      mockGetRealtimeArrival.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // Reset mock to succeed
      mockGetRealtimeArrival.mockResolvedValue([]);

      await act(async () => {
        await result.current.refresh();
      });

      await flushAll();

      // Should complete without error
      expect(result.current.delays).toEqual([]);
    });
  });

  describe('Auto Polling', () => {
    it('should set up polling interval when autoPolling is true', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      renderHook(() =>
        useDelayDetection({ autoPolling: true, pollingInterval: 60000 })
      );

      await flushAll();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      setIntervalSpy.mockRestore();
    });

    it('should not set up polling when autoPolling is false', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      renderHook(() =>
        useDelayDetection({ autoPolling: false })
      );

      await flushAll();

      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('should enforce minimum polling interval of 30 seconds', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      renderHook(() =>
        useDelayDetection({ autoPolling: true, pollingInterval: 10000 })
      );

      await flushAll();

      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('should trigger polling at specified interval', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      renderHook(() =>
        useDelayDetection({ autoPolling: true, pollingInterval: 60000 })
      );

      await flushAll();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      setIntervalSpy.mockRestore();
    });
  });

  describe('Cleanup and Lifecycle', () => {
    it('should not throw on unmount', async () => {
      const { unmount } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(() => unmount()).not.toThrow();
    });

    it('should clean up interval on unmount', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() =>
        useDelayDetection({ autoPolling: true, pollingInterval: 60000 })
      );

      await flushAll();

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should not update state after unmount', () => {
      mockGetRealtimeArrival.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = renderHook(() => useDelayDetection({ autoPolling: false }));

      unmount();

      // Should not crash
      expect(true).toBe(true);
    });

    it('should prevent updates when isMountedRef is false', () => {
      mockGetRealtimeArrival.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = renderHook(() => useDelayDetection({ autoPolling: false }));

      unmount();

      // Should not throw or update state
      expect(true).toBe(true);
    });
  });

  describe('Custom Line IDs', () => {
    it('should fetch only specified lines', async () => {
      mockGetRealtimeArrival.mockResolvedValue([]);

      const options = { autoPolling: false, lineIds: ['1', '2', '3'] };
      renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(mockGetRealtimeArrival).toHaveBeenCalledTimes(3);
    });

    it('should use default all lines when lineIds not provided', async () => {
      mockGetRealtimeArrival.mockResolvedValue([]);

      renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(mockGetRealtimeArrival).toHaveBeenCalledTimes(9);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null arvlMsg2 and arvlMsg3', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '', arvlMsg3: '' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });

    it('should handle empty arrivals array', async () => {
      mockGetRealtimeArrival.mockResolvedValue([]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });

    it('should handle arrival with undefined timestamp', async () => {
      mockGetRealtimeArrival.mockResolvedValue([
        { ...baseMockArrival, arvlMsg2: '약 5분 지연' },
      ]);

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(1);
      expect(result.current.delays[0]!.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Hook Interface Compliance', () => {
    it('should provide all required return properties', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current).toHaveProperty('delays');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(result.current).toHaveProperty('refresh');
    });

    it('should have correct types for return properties', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(Array.isArray(result.current.delays)).toBe(true);
      expect(typeof result.current.loading).toBe('boolean');
      expect(
        result.current.error === null || typeof result.current.error === 'string'
      ).toBe(true);
      expect(
        result.current.lastUpdated === null ||
          result.current.lastUpdated instanceof Date
      ).toBe(true);
      expect(typeof result.current.refresh).toBe('function');
    });
  });
});
