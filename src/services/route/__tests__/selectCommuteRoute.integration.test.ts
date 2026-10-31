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
import { resolveInternalStationId } from '@utils/stationIdResolver';

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

// 같은 노선 OD에서 사용자가 "직행 (환승 없음)"을 고르면 routePreference='direct'로
// 저장된다. 강남→홍대입구는 SSOT 최단이 환승 경로라, 직행 선호가 없으면 설정 카드·홈이
// 사용자가 고르지 않은 경로를 안내한다(#421 REPORT §8).
describe("selectCommuteRoute routePreference 'direct' — real graph", () => {
  it('강남(0222)→홍대입구(0239): direct preference yields a transfer-free route', () => {
    const fastest = selectCommuteRoute('0222', '0239');
    const direct = selectCommuteRoute('0222', '0239', undefined, 'direct');
    expect(fastest?.transferCount).toBeGreaterThan(0);
    expect(direct?.transferCount).toBe(0);
    const from = resolveInternalStationId('0222')!;
    const to = resolveInternalStationId('0239')!;
    expect(direct).toEqual(getDiverseRoutes(from, to).find((r) => r.transferCount === 0));
  });

  it('cross-line OD without a direct ride falls back to the fastest route', () => {
    expect(selectCommuteRoute('s_ec82b0ea', 'seolleung', undefined, 'direct')).toEqual(
      selectCommuteRoute('s_ec82b0ea', 'seolleung'),
    );
  });
});

