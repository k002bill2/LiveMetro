import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRouteSearch } from '../useRouteSearch';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';

jest.mock('@/services/route', () => {
  // applyRealtimeBoardingWait is exercised in its own unit test
  // (applyRealtimeBoardingWait.test.ts); here it is a passthrough so the hook's
  // base/enrich path is asserted without re-testing the overlay math.
  const applyRealtimeBoardingWait = jest.fn(
    (routes: unknown[]) => routes,
  );
  return {
    routeService: {
      getDiverseRoutes: jest.fn(),
      applyRealtimeBoardingWait,
    },
  };
});

jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(),
}));

// Default: unknown stationId → no realtime fetch (existing 'a'/'b' tests stay on
// baseline). The realtime wiring is asserted separately with mocked arrivals.
jest.mock('@/utils/subwayMapData', () => ({
  ...jest.requireActual('@/utils/subwayMapData'),
  getStationById: jest.fn(() => undefined),
}));

jest.mock('@/services/arrival/arrivalService', () => ({
  arrivalService: {
    getArrivals: jest.fn(),
  },
}));

const mockGetDiverseRoutes = (routeService as unknown as { getDiverseRoutes: jest.Mock }).getDiverseRoutes;
const mockApplyRealtimeBoardingWait = (routeService as unknown as { applyRealtimeBoardingWait: jest.Mock }).applyRealtimeBoardingWait;
const mockUseDelayDetection = useDelayDetection as jest.Mock;
const mockGetStationById = jest.requireMock('@/utils/subwayMapData').getStationById as jest.Mock;
const mockGetArrivals = jest.requireMock('@/services/arrival/arrivalService').arrivalService.getArrivals as jest.Mock;

describe('useRouteSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDelayDetection.mockReturnValue({ delays: [], loading: false });
    // Restore factory defaults (clearAllMocks wipes implementations set inside
    // the factory's jest.fn(impl), so re-assert them here).
    mockGetStationById.mockReturnValue(undefined);
    mockApplyRealtimeBoardingWait.mockImplementation((routes: unknown[]) => routes);
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

  it('preserves the service-attached fare on enriched routes', async () => {
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
        transferCount: 0,
        lineIds: ['2'],
        fare: 1500,
      },
    ]);
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(result.current.routes[0]!.fare).toBe(1500);
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

  // Regression: a warm-path re-overlay (e.g. delay-poll changes the delays
  // array identity → performFetch recreated → effect re-runs) must NOT flip
  // `loading` true. Cards are already rendered; toggling loading would briefly
  // invalidate RoutesTabScreen's `loading`-gated layout every ~30s.
  it('does not flip loading on a warm cache-hit re-fetch while the realtime fetch is pending', async () => {
    // Real station so the warm re-fetch actually invokes getArrivals (and can be
    // held pending — the production network call IS pending when setLoading would
    // commit). Checking loading DURING that pending window is deterministic,
    // unlike trying to observe a settled transient.
    mockGetStationById.mockReturnValue({ id: 'a', name: '강남', lines: ['2'] });
    const arrivalsInfo = {
      stationName: '강남',
      stationId: '0222',
      arrivals: [] as unknown[],
      lastUpdated: new Date(),
      source: 'api' as const,
    };
    mockGetArrivals.mockResolvedValue(arrivalsInfo);

    const { result, rerender } = renderHook(
      (props: { delays: { lineId: string; lineName: string; delayMinutes: number; timestamp: Date }[] }) => {
        mockUseDelayDetection.mockReturnValue({ delays: props.delays, loading: false });
        return useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' });
      },
      { initialProps: { delays: [] } }
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Hold the NEXT (warm) realtime fetch open so we can inspect loading mid-flight.
    let resolvePending: (v: typeof arrivalsInfo) => void = () => {};
    mockGetArrivals.mockReturnValueOnce(
      new Promise((r) => {
        resolvePending = r;
      })
    );

    // New (empty) delays array → new identity → effect re-runs → warm re-overlay.
    rerender({ delays: [] });
    await waitFor(() => expect(mockGetArrivals).toHaveBeenCalledTimes(2));

    // Realtime fetch is pending here. On the warm path loading must stay false
    // (cards already rendered). Unconditional setLoading(true) would read true.
    expect(result.current.loading).toBe(false);
    // Structural pool was not recomputed (warm).
    expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePending(arrivalsInfo);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(result.current.loading).toBe(false);
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

  describe('realtime boarding-wait overlay (1회 조회)', () => {
    it('fetches origin arrivals by station name and overlays them onto base routes', async () => {
      mockGetStationById.mockReturnValue({ id: 'a', name: '강남', lines: ['2'] });
      mockGetArrivals.mockResolvedValue({
        stationName: '강남',
        stationId: '0222',
        arrivals: [
          { trainId: 't1', lineId: '2', direction: 'up', destination: '잠실', arrivalSeconds: 180, arrivalMessage: '', trainNumber: '' },
        ],
        lastUpdated: new Date(),
        source: 'api',
      });

      const { result } = renderHook(() =>
        useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
      );
      await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));

      expect(mockGetStationById).toHaveBeenCalledWith('a');
      expect(mockGetArrivals).toHaveBeenCalledWith('강남');
      // Overlay receives base routes + mapped arrivals (RealtimeArrival shape).
      expect(mockApplyRealtimeBoardingWait).toHaveBeenCalledWith(
        expect.any(Array),
        [{ lineId: '2', secondsUntilArrival: 180 }]
      );
    });

    it('drops null arrivalSeconds (does NOT coerce null→0 / fake imminent arrival)', async () => {
      mockGetStationById.mockReturnValue({ id: 'a', name: '강남', lines: ['2'] });
      mockGetArrivals.mockResolvedValue({
        stationName: '강남',
        stationId: '0222',
        arrivals: [
          { trainId: 't1', lineId: '2', direction: 'up', destination: '잠실', arrivalSeconds: null, arrivalMessage: '', trainNumber: '' },
          { trainId: 't2', lineId: '2', direction: 'up', destination: '잠실', arrivalSeconds: 0, arrivalMessage: '', trainNumber: '' },
          { trainId: 't3', lineId: '3', direction: 'up', destination: '오금', arrivalSeconds: 240, arrivalMessage: '', trainNumber: '' },
        ],
        lastUpdated: new Date(),
        source: 'api',
      });

      const { result } = renderHook(() =>
        useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
      );
      await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));

      // null dropped; 0 (valid 도착) kept; 240 kept. Order preserved.
      expect(mockApplyRealtimeBoardingWait).toHaveBeenCalledWith(expect.any(Array), [
        { lineId: '2', secondsUntilArrival: 0 },
        { lineId: '3', secondsUntilArrival: 240 },
      ]);
    });

    it('skips realtime fetch when the origin station id is unknown', async () => {
      mockGetStationById.mockReturnValue(undefined);
      const { result } = renderHook(() =>
        useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
      );
      await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
      expect(mockGetArrivals).not.toHaveBeenCalled();
      // Overlay still runs (with empty arrivals) so routes flow through unchanged.
      expect(mockApplyRealtimeBoardingWait).toHaveBeenCalledWith(expect.any(Array), []);
    });

    it('falls back to base routes when realtime fetch throws (graceful)', async () => {
      mockGetStationById.mockReturnValue({ id: 'a', name: '강남', lines: ['2'] });
      mockGetArrivals.mockRejectedValue(new Error('seoul api 500'));

      const { result } = renderHook(() =>
        useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
      );
      await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));

      // Error swallowed → empty arrivals → overlay no-op → base routes render.
      expect(result.current.error).toBeNull();
      expect(mockApplyRealtimeBoardingWait).toHaveBeenCalledWith(expect.any(Array), []);
      expect(result.current.routes[0]!.etaMinutes).toBe(25);
    });
  });
});
