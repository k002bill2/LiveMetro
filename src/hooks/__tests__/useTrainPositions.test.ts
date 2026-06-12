/**
 * useTrainPositions hook tests — polling, focus gating, cache fallback.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useTrainPositions } from '../useTrainPositions';

jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimePosition: jest.fn(),
    convertToTrainPosition: jest.fn((row: { trainNo: string; updnLine: string }) => ({
      trainNo: row.trainNo,
      subwayId: '1002',
      stationId: '0205',
      stationName: '동대문역사문화공원',
      direction: row.updnLine === '0' ? 'up' : 'down',
      terminalName: '성수',
      status: 'arrived',
      isExpress: false,
      isLastTrain: false,
      receivedAt: 1700000000000,
    })),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockApi = require('@/services/api/seoulSubwayApi').seoulSubwayApi;

const positionRow = (trainNo: string) => ({
  trainNo,
  updnLine: '1',
});

/** Flush pending microtasks under fake timers. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useTrainPositions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches positions on mount and maps rows through the converter', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([positionRow('2445'), positionRow('2447')]);

    const { result } = renderHook(() => useTrainPositions('2'));
    await flush();

    expect(mockApi.getRealtimePosition).toHaveBeenCalledWith('2호선');
    expect(result.current.loading).toBe(false);
    expect(result.current.positions).toHaveLength(2);
    expect(result.current.positions[0]?.trainNo).toBe('2445');
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when disabled (focus gating)', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([]);

    const { result } = renderHook(() => useTrainPositions('2', { enabled: false }));
    await flush();

    expect(mockApi.getRealtimePosition).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('re-fetches on the 30s polling interval', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([positionRow('2445')]);

    renderHook(() => useTrainPositions('2'));
    await flush();
    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await flush();

    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(2);
  });

  it('clamps sub-30s refetchInterval up to the Seoul API minimum', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([]);

    renderHook(() => useTrainPositions('2', { refetchInterval: 5000 }));
    await flush();
    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    await flush();

    // 15s < 30s minimum — no extra fetch despite the 5s option.
    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);
  });

  it('returns empty positions with an error message when fetch fails cold', async () => {
    mockApi.getRealtimePosition.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useTrainPositions('7'));
    await flush();

    expect(result.current.positions).toEqual([]);
    expect(result.current.error).toBe('열차 위치를 불러오지 못했습니다');
    expect(result.current.isStale).toBe(false);
  });

  it('falls back to the last successful result and flags isStale on failure', async () => {
    mockApi.getRealtimePosition.mockResolvedValueOnce([positionRow('9001')]);

    const { result, unmount } = renderHook(() => useTrainPositions('9'));
    await flush();
    expect(result.current.positions).toHaveLength(1);
    unmount();

    mockApi.getRealtimePosition.mockRejectedValue(new Error('quota'));
    const { result: second } = renderHook(() => useTrainPositions('9'));
    await flush();

    expect(second.current.positions).toHaveLength(1);
    expect(second.current.positions[0]?.trainNo).toBe('9001');
    expect(second.current.isStale).toBe(true);
    expect(second.current.error).toBe('열차 위치를 불러오지 못했습니다');
  });

  it('stops polling after unmount (subscription cleanup)', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([]);

    const { unmount } = renderHook(() => useTrainPositions('2'));
    await flush();
    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });

    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);
  });

  it('maps 경의선 to the official API name 경의중앙선 (regression: INFO-200 empty screen)', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([positionRow('5129')]);

    const { result } = renderHook(() => useTrainPositions('경의선'));
    await flush();

    expect(mockApi.getRealtimePosition).toHaveBeenCalledWith('경의중앙선');
    expect(result.current.positions).toHaveLength(1);
    expect(result.current.unsupported).toBe(false);
  });

  it('skips the API call entirely and reports unsupported for 인천2 (regression: Seoul Line 2 trains shown as Incheon Line 2)', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([positionRow('2445')]);

    const { result } = renderHook(() => useTrainPositions('인천2'));
    await flush();

    expect(mockApi.getRealtimePosition).not.toHaveBeenCalled();
    expect(result.current.unsupported).toBe(true);
    expect(result.current.positions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('refetch is a no-op for unsupported lines (no stuck loading state)', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([]);

    const { result } = renderHook(() => useTrainPositions('김포도시철도'));
    await flush();

    await act(async () => {
      result.current.refetch();
    });
    await flush();

    expect(mockApi.getRealtimePosition).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('refetch triggers an immediate new fetch', async () => {
    mockApi.getRealtimePosition.mockResolvedValue([]);

    const { result } = renderHook(() => useTrainPositions('2'));
    await flush();
    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });
    await flush();

    expect(mockApi.getRealtimePosition).toHaveBeenCalledTimes(2);
  });
});
