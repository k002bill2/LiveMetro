/**
 * useCommuteRouteSummary tests — derives transfer/station/fare facts
 * for HomeScreen's CommuteRouteCard.
 *
 * The hook is pure given station IDs; tests pin the routeService /
 * fareService surface to verify both happy path and the four
 * graceful-fail modes (missing id, equal ids, null route, throw).
 */
import { renderHook } from '@testing-library/react-native';
import { routeService, fareService } from '@services/route';
import { useCommuteRouteSummary } from '../useCommuteRouteSummary';

jest.mock('@services/route', () => ({
  routeService: {
    calculateRoute: jest.fn(),
  },
  fareService: {
    calculateFare: jest.fn(),
  },
}));

const mockedCalc = routeService.calculateRoute as jest.Mock;
const mockedFare = fareService.calculateFare as jest.Mock;

describe('useCommuteRouteSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ready=false when fromStationId is missing', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary(undefined, 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedCalc).not.toHaveBeenCalled();
  });

  it('returns ready=false when toStationId is missing', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', undefined),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedCalc).not.toHaveBeenCalled();
  });

  it('returns ready=false when from and to are equal (no journey)', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'hongdae'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedCalc).not.toHaveBeenCalled();
  });

  it('returns ready=false when routeService returns null (disconnected)', () => {
    mockedCalc.mockReturnValue(null);
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
    expect(mockedFare).not.toHaveBeenCalled();
  });

  it('returns ready=false when calculation throws', () => {
    mockedCalc.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      useCommuteRouteSummary('hongdae', 'gangnam'),
    );
    expect(result.current).toEqual({ ready: false });
  });

  it('counts non-transfer segments as stationCount and computes fare', () => {
    mockedCalc.mockReturnValue({
      segments: [
        { isTransfer: false }, // station ride 1
        { isTransfer: false }, // station ride 2
        { isTransfer: true },  // transfer leg — excluded
        { isTransfer: false }, // station ride 3
      ],
      totalMinutes: 28,
      transferCount: 1,
      lineIds: ['2', '3'],
    });
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
    mockedCalc.mockReturnValue({
      segments: [{ isTransfer: false }],
      totalMinutes: 5,
      transferCount: 0,
      lineIds: ['2'],
    });
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
    expect(mockedCalc).toHaveBeenCalledTimes(1);
  });

  it('recomputes when station id pair changes', () => {
    mockedCalc.mockReturnValue({
      segments: [{ isTransfer: false }],
      totalMinutes: 5,
      transferCount: 0,
      lineIds: ['2'],
    });
    mockedFare.mockReturnValue({ totalFare: 1370 });

    const { rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) =>
        useCommuteRouteSummary(from, to),
      { initialProps: { from: 'hongdae', to: 'gangnam' } },
    );
    rerender({ from: 'hongdae', to: 'jamsil' });
    expect(mockedCalc).toHaveBeenCalledTimes(2);
  });
});
