/**
 * useCommuteRouteSummary tests — derives transfer/station/fare facts
 * for HomeScreen's CommuteRouteCard.
 *
 * The hook is pure given station IDs; tests pin the routeService /
 * fareService surface to verify both happy path and the four
 * graceful-fail modes (missing id, equal ids, null route, throw).
 */
import { renderHook } from '@testing-library/react-native';
import { fareService, getDiverseRoutes } from '@services/route';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { useCommuteRouteSummary } from '../useCommuteRouteSummary';

jest.mock('@services/route', () => ({
  fareService: {
    calculateFare: jest.fn(),
  },
  getDiverseRoutes: jest.fn(),
}));

// resolver is exercised by its own unit tests (stationIdResolver.test.ts).
// Mock it as identity here so this file can verify the hook's contract
// without coupling to which fixture slugs happen to exist in stations.json.
jest.mock('@utils/stationIdResolver', () => ({
  resolveInternalStationId: jest.fn((id?: string | null) => id ?? null),
}));

const mockedDiverse = getDiverseRoutes as jest.Mock;
const mockedFare = fareService.calculateFare as jest.Mock;
const mockedResolve = resolveInternalStationId as jest.Mock;

describe('useCommuteRouteSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks wipes the factory-set implementation; restore the
    // default identity mapping so tests that don't customize resolver
    // behavior still see slug pass-through.
    mockedResolve.mockImplementation((id?: string | null) => id ?? null);
  });

  it('returns ready=false when fromStationId is missing', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary(undefined, 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns ready=false when toStationId is missing', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', undefined),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns ready=false when from and to are equal (no journey)', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'hongdae'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns ready=false when getDiverseRoutes finds no path', () => {
    mockedDiverse.mockReturnValue([]);
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedFare).not.toHaveBeenCalled();
  });

  it('returns ready=false when calculation throws', () => {
    mockedDiverse.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
  });

  it('counts non-transfer segments as stationCount and computes fare', () => {
    mockedDiverse.mockReturnValue([
      {
        segments: [
          { isTransfer: false }, // station ride 1
          { isTransfer: false }, // station ride 2
          { isTransfer: true },  // transfer leg — excluded
          { isTransfer: false }, // station ride 3
        ],
        totalMinutes: 28,
        transferCount: 1,
        lineIds: ['2', '3'],
      },
    ]);
    mockedFare.mockReturnValue({ totalFare: 1450 });

    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'gangnam'),
    );

    expect(result.current).toEqual({
      transferCount: 1,
      stationCount: 3,
      fareKrw: 1450,
      rideMinutes: 28,
      ready: true,
    });
    expect(mockedFare).toHaveBeenCalledWith(3);
  });

  it('memoizes by station id pair (same inputs → no re-call)', () => {
    mockedDiverse.mockReturnValue([
      {
        segments: [{ isTransfer: false }],
        totalMinutes: 5,
        transferCount: 0,
        lineIds: ['2'],
      },
    ]);
    mockedFare.mockReturnValue({ totalFare: 1370 });

    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) =>
        useCommuteRouteSummary(from, to),
      { initialProps: { from: 'hongdae', to: 'gangnam' } },
    );
    const first = result.current;
    rerender({ from: 'hongdae', to: 'gangnam' });
    // useMemo same identity preserved across rerenders with same deps
    expect(result.current).toBe(first);
    expect(mockedDiverse).toHaveBeenCalledTimes(1);
  });

  it('normalizes external station_cd to internal slug before route lookup', () => {
    // Caller passes Seoul Metro station_cd ("3762", "0220") — what onboarding
    // actually persists. resolver swaps to slugs before getDiverseRoutes runs.
    mockedResolve.mockImplementation((id?: string | null) => {
      if (id === '3762') return 's_ec82b0ea';
      if (id === '0220') return 'seolleung';
      return id ?? null;
    });
    mockedDiverse.mockReturnValue([
      {
        segments: [{ isTransfer: false }],
        totalMinutes: 5,
        transferCount: 0,
        lineIds: ['7'],
      },
    ]);
    mockedFare.mockReturnValue({ totalFare: 1450 });

    renderHook(() => useCommuteRouteSummary('3762', '0220'));

    expect(mockedDiverse).toHaveBeenCalledWith('s_ec82b0ea', 'seolleung');
  });

  it('returns ready=false when resolver cannot map an id', () => {
    mockedResolve.mockReturnValue(null);
    const { result } = renderHook(() =>
      useCommuteRouteSummary('99999', '0220'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('recomputes when station id pair changes', () => {
    mockedDiverse.mockReturnValue([
      {
        segments: [{ isTransfer: false }],
        totalMinutes: 5,
        transferCount: 0,
        lineIds: ['2'],
      },
    ]);
    mockedFare.mockReturnValue({ totalFare: 1370 });

    const { rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) =>
        useCommuteRouteSummary(from, to),
      { initialProps: { from: 'hongdae', to: 'gangnam' } },
    );
    rerender({ from: 'hongdae', to: 'jamsil' });
    expect(mockedDiverse).toHaveBeenCalledTimes(2);
  });
});
