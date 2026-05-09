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

  it('returns idle when fromId or toId missing', () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: undefined, toId: 'b', departureTime: null, departureMode: 'now' })
    );
    expect(result.current.routes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockGetDiverseRoutes).not.toHaveBeenCalled();
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
    expect(route.etaConfidenceMinutes).toBeGreaterThanOrEqual(2);
    expect(route.etaConfidenceMinutes).toBeLessThanOrEqual(8);
    expect(Array.isArray(route.delayRiskLineIds)).toBe(true);
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

  it('returns same routes on identical cacheKey within 60s', async () => {
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
});
