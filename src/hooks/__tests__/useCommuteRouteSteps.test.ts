/**
 * useCommuteRouteSteps tests — derives the guidance-style step timeline
 * (board → ride → (transfer → ride)* → alight) from a pair of station IDs.
 *
 * The hook is pure given station IDs; it normalizes ids to internal slugs
 * (resolveInternalStationId), picks the fastest route (getDiverseRoutes[0]),
 * and reshapes it via routeToGuidanceSteps. Tests pin those three seams so
 * we verify the hook's composition + the six graceful-fail modes without
 * coupling to which fixture slugs exist in stations.json.
 */
import { renderHook } from '@testing-library/react-native';
import { getDiverseRoutes } from '@services/route';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import type { GuidanceStep } from '@/models/guidance';
import { useCommuteRouteSteps } from '../useCommuteRouteSteps';

jest.mock('@services/route', () => ({
  getDiverseRoutes: jest.fn(),
}));

jest.mock('@services/route/routeVia', () => ({ routeVia: jest.fn() }));

// resolver is exercised by its own unit tests (stationIdResolver.test.ts).
// Mock it as identity here so this file verifies the hook's contract without
// coupling to which fixture slugs happen to exist in stations.json.
jest.mock('@utils/stationIdResolver', () => ({
  resolveInternalStationId: jest.fn((id?: string | null) => id ?? null),
}));

// routeToGuidanceSteps has its own unit tests (guidanceSteps.test.ts). Mock
// it to a sentinel so we assert the hook *delegates* to it with the chosen
// Route, not re-test the reshape logic here.
jest.mock('@/services/guidance/guidanceSteps', () => ({
  routeToGuidanceSteps: jest.fn(),
}));

const mockedDiverse = getDiverseRoutes as jest.Mock;
const mockedRouteVia = routeVia as jest.Mock;
const mockedResolve = resolveInternalStationId as jest.Mock;
const mockedToSteps = routeToGuidanceSteps as jest.Mock;

// Minimal sentinel step set — identity asserted, contents irrelevant here.
const SENTINEL_STEPS = [
  { kind: 'board', id: 'board-0' },
  { kind: 'ride', id: 'ride-1' },
  { kind: 'alight', id: 'alight-2' },
] as unknown as GuidanceStep[];

const ROUTE = {
  segments: [{ isTransfer: false }],
  totalMinutes: 12,
  transferCount: 0,
};

describe('useCommuteRouteSteps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks resets call data (.mock.calls/.results) but NOT
    // implementations — a prior test's mockReturnValue(null)/mockImplementation
    // override on the resolver persists into the next test. Re-set the default
    // identity mapping here so tests that don't customize the resolver still
    // pass slugs through.
    mockedResolve.mockImplementation((id?: string | null) => id ?? null);
  });

  it('returns [] when fromStationId is missing', () => {
    const { result } = renderHook(() => useCommuteRouteSteps(undefined, 'gangnam'));
    expect(result.current).toEqual([]);
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns [] when toStationId is missing', () => {
    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', undefined));
    expect(result.current).toEqual([]);
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns [] when from and to are equal (no journey)', () => {
    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', 'hongdae'));
    expect(result.current).toEqual([]);
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns [] when resolver cannot map an id to a slug', () => {
    mockedResolve.mockReturnValue(null);
    const { result } = renderHook(() => useCommuteRouteSteps('99999', '0220'));
    expect(result.current).toEqual([]);
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns [] when resolved slugs collapse to the same station', () => {
    mockedResolve.mockImplementation((id?: string | null) =>
      id === '0150' || id === '0151' ? 'seoul' : (id ?? null),
    );
    const { result } = renderHook(() => useCommuteRouteSteps('0150', '0151'));
    expect(result.current).toEqual([]);
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns [] when getDiverseRoutes finds no path', () => {
    mockedDiverse.mockReturnValue([]);
    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', 'gangnam'));
    expect(result.current).toEqual([]);
    expect(mockedToSteps).not.toHaveBeenCalled();
  });

  it('returns [] when routeToGuidanceSteps yields no actionable steps', () => {
    mockedDiverse.mockReturnValue([ROUTE]);
    mockedToSteps.mockReturnValue([]);
    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', 'gangnam'));
    expect(result.current).toEqual([]);
  });

  it('returns [] when calculation throws', () => {
    mockedDiverse.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', 'gangnam'));
    expect(result.current).toEqual([]);
  });

  it('reshapes the fastest route (index 0) into guidance steps', () => {
    const otherRoute = { segments: [], totalMinutes: 99, transferCount: 3 };
    mockedDiverse.mockReturnValue([ROUTE, otherRoute]);
    mockedToSteps.mockReturnValue(SENTINEL_STEPS);

    const { result } = renderHook(() => useCommuteRouteSteps('hongdae', 'gangnam'));

    expect(result.current).toBe(SENTINEL_STEPS);
    // Only the fastest (index 0) route is reshaped.
    expect(mockedToSteps).toHaveBeenCalledTimes(1);
    expect(mockedToSteps).toHaveBeenCalledWith(ROUTE);
  });

  it('uses routeVia (constrained) and reshapes it when a via transfer id is provided', () => {
    const viaRoute = { segments: [], totalMinutes: 40, transferCount: 1 };
    mockedRouteVia.mockReturnValue(viaRoute);
    mockedToSteps.mockReturnValue(SENTINEL_STEPS);

    const { result } = renderHook(() =>
      useCommuteRouteSteps('singil', 'seolleung', 'sindorim'),
    );

    expect(result.current).toBe(SENTINEL_STEPS);
    expect(mockedRouteVia).toHaveBeenCalledWith('singil', 'sindorim', 'seolleung');
    expect(mockedDiverse).not.toHaveBeenCalled();
    expect(mockedToSteps).toHaveBeenCalledWith(viaRoute);
  });

  it('normalizes external station_cd to internal slug before route lookup', () => {
    // Caller passes Seoul Metro station_cd ("0150", "0220") — what onboarding
    // actually persists. resolver swaps to slugs before getDiverseRoutes runs.
    mockedResolve.mockImplementation((id?: string | null) => {
      if (id === '0150') return 'seoul';
      if (id === '0220') return 'gangnam';
      return id ?? null;
    });
    mockedDiverse.mockReturnValue([ROUTE]);
    mockedToSteps.mockReturnValue(SENTINEL_STEPS);

    renderHook(() => useCommuteRouteSteps('0150', '0220'));

    expect(mockedDiverse).toHaveBeenCalledWith('seoul', 'gangnam');
  });

  it('memoizes by station id pair (same inputs → no re-call)', () => {
    mockedDiverse.mockReturnValue([ROUTE]);
    mockedToSteps.mockReturnValue(SENTINEL_STEPS);

    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useCommuteRouteSteps(from, to),
      { initialProps: { from: 'hongdae', to: 'gangnam' } },
    );
    const first = result.current;
    rerender({ from: 'hongdae', to: 'gangnam' });
    expect(result.current).toBe(first);
    expect(mockedDiverse).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the station id pair changes', () => {
    mockedDiverse.mockReturnValue([ROUTE]);
    mockedToSteps.mockReturnValue(SENTINEL_STEPS);

    const { rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useCommuteRouteSteps(from, to),
      { initialProps: { from: 'hongdae', to: 'gangnam' } },
    );
    rerender({ from: 'hongdae', to: 'jamsil' });
    expect(mockedDiverse).toHaveBeenCalledTimes(2);
  });
});
