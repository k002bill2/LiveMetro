/**
 * getFastestRoute's early-stopping Yen path must return exactly
 * `getDiverseRoutes(a, b)[0]` — whole object (segments, totalMinutes,
 * transferCount, lineIds, category, fare) — and must actually be exercised.
 *
 * Real graph, no mocks. Legs = the three REPORT-R3 fallback legs + 200 seeded
 * random pairs (independent seed from diverseRoutesDefinition).
 */
import {
  getDiverseRoutes,
  getFastestRoute,
  getFastestRouteStats,
} from '@services/route/kShortestPath';
import * as routeCache from '@services/route/routeCache';
import { STATIONS } from '@/utils/subwayMapData';

const seededPairs = (count: number, seed0: number): [string, string][] => {
  let seed = seed0;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ids = Object.keys(STATIONS).filter((id) => (STATIONS[id]?.lines?.length ?? 0) > 0);
  const pairs: [string, string][] = [];
  while (pairs.length < count) {
    const a = ids[Math.floor(rnd() * ids.length)]!;
    const b = ids[Math.floor(rnd() * ids.length)]!;
    if (a !== b) pairs.push([a, b]);
  }
  return pairs;
};

const LEGS: [string, string][] = [
  ['incheon', 'seolleung'],
  ['yeongdeungpo', 'seolleung'],
  ['seoul', 's_1758'],
  ...seededPairs(200, 20261103),
];

describe('getFastestRoute — early-stopping Yen == getDiverseRoutes[0]', () => {
  it('incheon→seolleung (R3 fallback leg) exits through the early stop', () => {
    const before = getFastestRouteStats().earlyStop;
    routeCache.clear();
    getFastestRoute('incheon', 'seolleung');
    expect(getFastestRouteStats().earlyStop - before).toBe(1);
  });

  it.each(LEGS)('%s → %s', (a, b) => {
    routeCache.clear();
    const fast = getFastestRoute(a, b);
    routeCache.clear();
    expect(fast).toEqual(getDiverseRoutes(a, b)[0] ?? null);
  });

  it('the early-stop exit was taken on the sweep (accelerated legs > 0)', () => {
    const stats = getFastestRouteStats();
    expect(stats.earlyStop).toBeGreaterThan(0);
    expect(stats.proven + stats.earlyStop + stats.fullYen).toBeGreaterThanOrEqual(200);
  });
});
