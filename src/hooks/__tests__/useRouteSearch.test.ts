import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRouteSearch } from '../useRouteSearch';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';

jest.mock('@/services/route', () => ({
  routeService: {
    getDiverseRoutes: jest.fn(),
  },
}));

jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(),
}));

const mockGetDiverseRoutes = (routeService as unknown as { getDiverseRoutes: jest.Mock }).getDiverseRoutes;
const mockUseDelayDetection = useDelayDetection as jest.Mock;

describe('useRouteSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDelayDetection.mockReturnValue({ delays: [], loading: false });
    mockGetDiverseRoutes.mockReturnValue([
      {
        segments: [{ fromStationId: 'a', toStationId: 'b', lineId: '2', isTransfer: false, fromStationName: '강남', toStationName: '잠실' }],
        totalMinutes: 25,
        transferCount: 0,
        lineIds: ['2'],
      },
    ]);
  });

  it('returns idle when fromId or toId missing', async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useRouteSearch({ fromId: undefined, toId: 'b', departureTime: null, departureMode: 'now' })
      );
      // Advance past the 300ms debounce so the idle guard actually executes.
      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(result.current.routes).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(mockGetDiverseRoutes).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('fetches routes when both ids provided', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledWith('a', 'b');
  });

  it('enriches each route with etaMinutes and etaConfidenceMinutes', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    const route = result.current.routes[0]!;
    expect(route.etaMinutes).toBe(25);
    // 0 transfer + 0 delay → baseline 2 (formula: 2 + transferCount + delayLines * 2, clamped [2,8])
    expect(route.etaConfidenceMinutes).toBe(2);
    expect(Array.isArray(route.delayRiskLineIds)).toBe(true);
  });

  it('eta confidence reflects transfer count and delay risk', async () => {
    mockUseDelayDetection.mockReturnValue({
      delays: [{ lineId: '2', lineName: '2호선', delayMinutes: 5, timestamp: new Date() }],
      loading: false,
    });
    mockGetDiverseRoutes.mockReturnValue([
      {
        segments: [
          {
            fromStationId: 'a',
            toStationId: 'b',
            lineId: '2',
            isTransfer: false,
            fromStationName: '강남',
            toStationName: '잠실',
          },
        ],
        totalMinutes: 25,
        transferCount: 1,
        lineIds: ['2'],
      },
    ]);
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    // Formula: 2 (baseline) + 1 (transfer) + 2 (1 delay line × 2) = 5
    expect(result.current.routes[0]!.etaConfidenceMinutes).toBe(5);
  });

  it('marks delayRiskLineIds when route uses delayed line', async () => {
    mockUseDelayDetection.mockReturnValue({
      delays: [{ lineId: '2', lineName: '2호선', delayMinutes: 5, timestamp: new Date() }],
      loading: false,
    });
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(result.current.routes[0]!.delayRiskLineIds).toEqual(['2']);
  });

  // Hook-level: stable rerender should not trigger a second fetch.
  // True cacheKey hit semantics (same key within 60s after intentional invalidation)
  // are exercised at the integration layer in RoutesTabScreen tests (Task 6).
  it('does not refetch when props unchanged on rerender', async () => {
    const { result, rerender } = renderHook(
      (props: { fromId: string; toId: string }) =>
        useRouteSearch({ fromId: props.fromId, toId: props.toId, departureTime: null, departureMode: 'now' }),
      { initialProps: { fromId: 'a', toId: 'b' } }
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1);

    rerender({ fromId: 'a', toId: 'b' });
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1);
  });

  it('refetch invalidates cache and re-calls service', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(2));
  });

  it('sets error state when service throws', async () => {
    mockGetDiverseRoutes.mockImplementation(() => {
      throw new Error('graph error');
    });
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('경로');
  });

  it('sets same-id error and skips service call when fromId === toId', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'a', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('같습니다');
    expect(result.current.routes).toEqual([]);
    expect(mockGetDiverseRoutes).not.toHaveBeenCalled();
  });
});
