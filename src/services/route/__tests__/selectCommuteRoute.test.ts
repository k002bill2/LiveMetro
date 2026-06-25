/**
 * selectCommuteRoute tests — the single SSOT that turns a commute OD pair
 * (+ optional via transfer) into a Route, used by useCommuteRouteSummary,
 * useCommuteRouteSteps, and the home "길안내 시작" CTA.
 *
 * The three graph seams (getDiverseRoutes / routeVia / resolveInternalStationId)
 * have their own unit tests, so here we mock them — identity resolver — and
 * verify only this function's COMPOSITION and its graceful-fail modes, without
 * coupling to which fixture slugs exist in stations.json. Mirrors the approach
 * in useCommuteRouteSteps.test.ts.
 */
import { getDiverseRoutes } from '@services/route';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import type { Route } from '@/models/route';
import { selectCommuteRoute } from '../selectCommuteRoute';

jest.mock('@services/route', () => ({ getDiverseRoutes: jest.fn() }));
jest.mock('@services/route/routeVia', () => ({ routeVia: jest.fn() }));
jest.mock('@utils/stationIdResolver', () => ({
  resolveInternalStationId: jest.fn((id?: string | null) => id ?? null),
}));

const mockedDiverse = getDiverseRoutes as jest.Mock;
const mockedRouteVia = routeVia as jest.Mock;
const mockedResolve = resolveInternalStationId as jest.Mock;

const ROUTE = {
  segments: [{ isTransfer: false }],
  totalMinutes: 12,
  transferCount: 0,
  lineIds: ['2'],
} as unknown as Route;

const VIA_ROUTE = {
  segments: [{ isTransfer: false }, { isTransfer: true }, { isTransfer: false }],
  totalMinutes: 20,
  transferCount: 1,
  lineIds: ['2', '3'],
} as unknown as Route;

describe('selectCommuteRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolve.mockImplementation((id?: string | null) => id ?? null);
  });

  it('returns the fastest route (getDiverseRoutes[0]) for a valid OD pair', () => {
    mockedDiverse.mockReturnValue([ROUTE]);
    const result = selectCommuteRoute('hongdae', 'gangnam');
    expect(result).toBe(ROUTE);
    expect(mockedDiverse).toHaveBeenCalledWith('hongdae', 'gangnam');
    expect(mockedRouteVia).not.toHaveBeenCalled();
  });

  it('constrains the path through the via transfer when one is given', () => {
    mockedRouteVia.mockReturnValue(VIA_ROUTE);
    const result = selectCommuteRoute('hongdae', 'gangnam', 'sindorim');
    expect(result).toBe(VIA_ROUTE);
    expect(mockedRouteVia).toHaveBeenCalledWith('hongdae', 'sindorim', 'gangnam');
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns null when either station id is missing', () => {
    expect(selectCommuteRoute(undefined, 'gangnam')).toBeNull();
    expect(selectCommuteRoute('hongdae', undefined)).toBeNull();
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns null when origin and destination are the same id', () => {
    expect(selectCommuteRoute('gangnam', 'gangnam')).toBeNull();
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns null when an id cannot be resolved to an internal slug', () => {
    mockedResolve.mockImplementation((id?: string | null) =>
      id === 'gangnam' ? null : (id ?? null),
    );
    expect(selectCommuteRoute('hongdae', 'gangnam')).toBeNull();
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns null when resolved slugs collapse to the same station', () => {
    mockedResolve.mockReturnValue('same');
    expect(selectCommuteRoute('0220', 'gangnam')).toBeNull();
    expect(mockedDiverse).not.toHaveBeenCalled();
  });

  it('returns null when graph search yields no path', () => {
    mockedDiverse.mockReturnValue([]);
    expect(selectCommuteRoute('hongdae', 'gangnam')).toBeNull();
  });

  it('returns null when routeVia finds no constrained path', () => {
    mockedRouteVia.mockReturnValue(null);
    expect(selectCommuteRoute('hongdae', 'gangnam', 'sindorim')).toBeNull();
  });

  it('returns null (no throw) when the graph layer throws', () => {
    mockedDiverse.mockImplementation(() => {
      throw new Error('graph boom');
    });
    expect(() => selectCommuteRoute('hongdae', 'gangnam')).not.toThrow();
    expect(selectCommuteRoute('hongdae', 'gangnam')).toBeNull();
  });
});
