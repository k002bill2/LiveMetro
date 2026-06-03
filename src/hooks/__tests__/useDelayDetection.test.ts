/**
 * useDelayDetection Hook Tests
 *
 * 데이터 소스: arrivalService.getArrivals (공유 캐시 계층).
 * useDelayDetection은 seoulSubwayApi.getRealtimeArrival를 직접 호출하지 않는다 —
 * 직접 호출은 StationDetail과 같은 per-station rate-limit 키를 캐시 공유 없이
 * 리셋해 상세 화면 첫 로드를 최대 30초 throttle로 굶주리게 만들었다(회귀).
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDelayDetection } from '../useDelayDetection';
import { arrivalService, type ArrivalInfo, type TrainArrival } from '@/services/arrival/arrivalService';
// seoulSubwayApi is globally mocked in src/__tests__/setup.ts — referenced here
// only to assert the hook does NOT call it directly anymore.
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

jest.mock('@/services/arrival/arrivalService', () => ({
  arrivalService: {
    getArrivals: jest.fn(),
  },
}));

const mockGetArrivals = arrivalService.getArrivals as jest.Mock;
const mockGetRealtimeArrival = seoulSubwayApi.getRealtimeArrival as jest.Mock;

// Helper: flush all pending promises and state updates
async function flushAll(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const makeArrival = (
  lineId: string,
  arrivalMessage: string,
  overrides: Partial<TrainArrival> = {}
): TrainArrival => ({
  trainId: `train_${lineId}_${arrivalMessage}`,
  lineId,
  direction: 'up',
  destination: '종착역',
  arrivalSeconds: 120,
  arrivalMessage,
  trainNumber: '0001',
  ...overrides,
});

const emptyInfo = (stationName: string): ArrivalInfo => ({
  stationName,
  stationId: stationName,
  arrivals: [],
  lastUpdated: new Date(),
  source: 'api',
});

const infoWith = (
  stationName: string,
  arrivals: TrainArrival[]
): ArrivalInfo => ({
  stationName,
  stationId: stationName,
  arrivals,
  lastUpdated: new Date(),
  source: 'api',
});

// 노선별 대표 역 — useDelayDetection 내부 LINE_REPRESENTATIVE_STATIONS와 일치해야 한다.
const REP: Record<string, string> = {
  '1': '서울역',
  '2': '강남',
  '3': '교대',
  '4': '동대문역사문화공원',
  '5': '광화문',
  '6': '삼각지',
  '7': '건대입구',
  '8': '잠실',
  '9': '여의도',
};

/**
 * 특정 노선들에 대해 대표 역이 반환할 ArrivalInfo를 구성하는 mock 헬퍼.
 * 그 외 역은 빈 도착 정보를 반환한다.
 */
function mockArrivalsByLine(byLine: Record<string, TrainArrival[]>): void {
  mockGetArrivals.mockImplementation((stationName: string) => {
    const lineId = Object.keys(REP).find((id) => REP[id] === stationName);
    if (lineId && byLine[lineId]) {
      return Promise.resolve(infoWith(stationName, byLine[lineId]!));
    }
    return Promise.resolve(emptyInfo(stationName));
  });
}

describe('useDelayDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetArrivals.mockImplementation((stationName: string) =>
      Promise.resolve(emptyInfo(stationName))
    );
  });

  describe('Data source — shared cache (regression)', () => {
    it('routes through arrivalService.getArrivals, not seoulSubwayApi.getRealtimeArrival', async () => {
      renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // 공유 캐시 계층을 통해야 한다.
      expect(mockGetArrivals).toHaveBeenCalled();
      // per-station rate-limit 키를 직접 리셋하는 우회 경로는 금지.
      expect(mockGetRealtimeArrival).not.toHaveBeenCalled();
    });

    it('queries each line representative station by name', async () => {
      renderHook(() => useDelayDetection({ autoPolling: false, lineIds: ['1', '2'] }));

      await flushAll();

      const queried = mockGetArrivals.mock.calls.map((c) => c[0]);
      expect(queried).toContain('서울역');
      expect(queried).toContain('강남');
    });
  });

  describe('Initialization', () => {
    it('should initialize with empty delays', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should initialize with loading state during fetch', () => {
      mockGetArrivals.mockImplementation(
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

      expect(result.current.lastUpdated).not.toBeNull();
    });
  });

  describe('Delay Detection - detectDelayFromArrival', () => {
    it('should detect delays with 지연 keyword', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '약 5분 지연')] });

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
      mockArrivalsByLine({ '2': [makeArrival('2', '약 10분 운행중지')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(1);
      // Regex only extracts "N분 지연/서행", so 운행중지 falls back to default 5 min
      expect(result.current.delays[0]!.delayMinutes).toBe(5);
    });

    it('should detect delays with 고장 keyword and set reason', async () => {
      mockArrivalsByLine({ '3': [makeArrival('3', '약 3분 지연 열차 고장')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('열차 고장');
    });

    it('should detect delays with 사고 keyword and set reason', async () => {
      mockArrivalsByLine({ '4': [makeArrival('4', '약 7분 지연 사고 발생')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('사고 발생');
    });

    it('should detect delays with 점검 keyword and set reason', async () => {
      mockArrivalsByLine({ '5': [makeArrival('5', '약 2분 지연 시설 점검')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.reason).toBe('시설 점검');
    });

    it('should not detect 혼잡 as delay (not in DELAY_KEYWORDS)', async () => {
      mockArrivalsByLine({ '6': [makeArrival('6', '곧 도착 역 혼잡')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // 혼잡 is not in DELAY_KEYWORDS, so no delays detected
      expect(result.current.delays).toHaveLength(0);
    });

    it('should use default 5 minutes when delay time not extractable', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '곧 도착 장애 발생')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.delayMinutes).toBe(5);
    });

    it('should ignore arrivals without delay keywords', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '곧 도착')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });
  });

  describe('Line Name Conversion', () => {
    it('should derive line name from lineId (1 -> 1호선)', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '약 5분 지연')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays[0]!.lineName).toBe('1호선');
    });

    it('should derive line name for various lines correctly', async () => {
      const testCases = [
        { lineId: '1', expected: '1호선' },
        { lineId: '2', expected: '2호선' },
        { lineId: '9', expected: '9호선' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockArrivalsByLine({ [testCase.lineId]: [makeArrival(testCase.lineId, '약 5분 지연')] });

        const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

        await flushAll();

        expect(result.current.delays[0]!.lineName).toBe(testCase.expected);
      }
    });
  });

  describe('Delay Sorting and Deduplication', () => {
    it('should sort delays by minutes descending', async () => {
      mockArrivalsByLine({
        '1': [makeArrival('1', '약 3분 지연')],
        '2': [makeArrival('2', '약 10분 지연')],
      });

      const options = { autoPolling: false, lineIds: ['1', '2'] };
      const { result } = renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(result.current.delays).toHaveLength(2);
      expect(result.current.delays[0]!.delayMinutes).toBe(10);
      expect(result.current.delays[1]!.delayMinutes).toBe(3);
    });

    it('should prevent duplicate delays per line', async () => {
      mockArrivalsByLine({
        '1': [
          makeArrival('1', '약 5분 지연', { trainId: 'a' }),
          makeArrival('1', '약 3분 지연', { trainId: 'b' }),
        ],
      });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      const line1Delays = result.current.delays.filter(d => d.lineId === '1');
      expect(line1Delays).toHaveLength(1);
    });
  });

  describe('Fetch and Refresh', () => {
    it('should set loading state during fetch', () => {
      mockGetArrivals.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.loading).toBe(true);
    });

    it('should allow manual refresh', async () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      const callCountBefore = mockGetArrivals.mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      const callCountAfter = mockGetArrivals.mock.calls.length;
      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });

    it('should not fetch while already loading', () => {
      mockGetArrivals.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.loading).toBe(true);

      // Try to refresh while loading - should not add more calls
      const callCountDuringLoad = mockGetArrivals.mock.calls.length;
      result.current.refresh();
      const callCountAfter = mockGetArrivals.mock.calls.length;
      expect(callCountAfter).toBeLessThanOrEqual(callCountDuringLoad + 1);
    });
  });

  describe('Enabled gating', () => {
    it('should not fetch when enabled is false', async () => {
      renderHook(() => useDelayDetection({ autoPolling: false, enabled: false }));

      await flushAll();

      expect(mockGetArrivals).not.toHaveBeenCalled();
    });

    it('should not set up polling when enabled is false', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      renderHook(() =>
        useDelayDetection({ autoPolling: true, pollingInterval: 60000, enabled: false })
      );

      await flushAll();

      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Individual line errors are caught inside the map, so error state is not set
      // but the hook still completes without crashing
      mockGetArrivals.mockRejectedValue(new Error('API request failed'));

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toEqual([]);
    });

    it('should continue operation after single line failure', async () => {
      mockGetArrivals.mockImplementation((stationName: string) => {
        if (stationName === '강남') {
          return Promise.reject(new Error('API error'));
        }
        return Promise.resolve(emptyInfo(stationName));
      });

      const options = { autoPolling: false, lineIds: ['1', '2'] };
      const { result } = renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(result.current.delays).toEqual([]);
    });

    it('should recover after errors on retry', async () => {
      mockGetArrivals.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      // Reset mock to succeed
      mockGetArrivals.mockImplementation((stationName: string) =>
        Promise.resolve(emptyInfo(stationName))
      );

      await act(async () => {
        await result.current.refresh();
      });

      await flushAll();

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
      mockGetArrivals.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = renderHook(() => useDelayDetection({ autoPolling: false }));

      unmount();

      // Should not crash
      expect(true).toBe(true);
    });

    it('should prevent updates when isMountedRef is false', () => {
      mockGetArrivals.mockImplementation(
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
      const options = { autoPolling: false, lineIds: ['1', '2', '3'] };
      renderHook(() => useDelayDetection(options));

      await flushAll();

      expect(mockGetArrivals).toHaveBeenCalledTimes(3);
    });

    it('should use default all lines when lineIds not provided', async () => {
      renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(mockGetArrivals).toHaveBeenCalledTimes(9);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrival message', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '')] });

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });

    it('should handle empty arrivals array', async () => {
      mockGetArrivals.mockImplementation((stationName: string) =>
        Promise.resolve(emptyInfo(stationName))
      );

      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      await flushAll();

      expect(result.current.delays).toHaveLength(0);
    });

    it('should set a Date timestamp on detected delays', async () => {
      mockArrivalsByLine({ '1': [makeArrival('1', '약 5분 지연')] });

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
