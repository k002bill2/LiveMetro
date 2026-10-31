/**
 * selectCommuteRoute (no via) — result pinned to the pre-R3 formula
 * `getDiverseRoutes(from, to)[0]`.
 *
 * R3 swaps the no-via branch to `getFastestRoute` (proven-equal fast path) to
 * cut the edit screen's first-entry cost. Every caller — home/weekly hero,
 * settings RouteCard, ML timeline, 길안내 시작 — reads this function, so its
 * Route must not change by a single field.
 *
 * Real graph, no mocks. ODs = the three representative commute ODs + the
 * REPORT-R2 seeded random sample (same generator and seed).
 */
import { getDiverseRoutes } from '@services/route/kShortestPath';
import { selectCommuteRoute } from '@services/route/selectCommuteRoute';
import * as routeCache from '@services/route/routeCache';
import { STATIONS } from '@/utils/subwayMapData';

// 산곡(s_ec82b0ea)→선릉, 신길→선릉, 서울역→선릉 — the OD pairs measured in REPORT-R2.
const ODS: readonly [string, string][] = [
  ['s_ec82b0ea', 'seolleung'],
  ['s_1032', 'seolleung'],
  ['seoul', 'seolleung'],
];

/** Identical to fastestRoute.integration.test.ts (seed 20261101). */
const seededPairs = (count: number): [string, string][] => {
  let seed = 20261101;
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

describe('selectCommuteRoute (no via) — same Route as getDiverseRoutes[0]', () => {
  const pairs: [string, string][] = [...ODS, ...seededPairs(40)];

  it('covers the 3 representative ODs + at least 30 sampled ODs', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(33);
  });

  it.each(pairs)('%s → %s', (a, b) => {
    routeCache.clear();
    const actual = selectCommuteRoute(a, b);
    routeCache.clear();
    expect(actual).toEqual(getDiverseRoutes(a, b)[0] ?? null);
  });
});
