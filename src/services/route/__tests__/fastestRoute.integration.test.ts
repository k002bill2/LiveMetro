/**
 * getFastestRoute — result-invariant fast path for `getDiverseRoutes(a, b)[0]`.
 *
 * routeVia stitches two legs, each `getDiverseRoutes(leg)[0]` (a full Yen
 * K=15 search, ~50–110ms on V8). The commute edit screen runs routeVia once per
 * transfer candidate during a synchronous render, so the legs must come from a
 * cheaper search that returns the SAME route — otherwise the minutes on the
 * screen would drift from what the settings card / home show for the saved via
 * (both go through selectCommuteRoute → routeVia).
 *
 * Real graph, no mocks. Legs = every 1-transfer candidate leg of the three
 * representative commute ODs + a seeded random sample.
 */
import { getDiverseRoutes, getFastestRoute } from '@services/route/kShortestPath';
import { routeVia } from '@services/route/routeVia';
import * as routeCache from '@services/route/routeCache';
import { STATIONS } from '@/utils/subwayMapData';
import {
  createRoute,
  getLineName,
  AVG_TRANSFER_TIME,
  type Route,
  type RouteSegment,
} from '@models/route';

// 산곡(s_ec82b0ea)→선릉, 신길→선릉, 서울역→선릉 — the OD pairs measured in REPORT-R2.
const ODS: readonly (readonly [string, string])[] = [
  ['s_ec82b0ea', 'seolleung'],
  ['s_1032', 'seolleung'],
  ['seoul', 'seolleung'],
];

/** Same membership rule the edit screen uses for 1-transfer candidates. */
const candidateVias = (from: string, to: string): string[] => {
  const fl = STATIONS[from]?.lines ?? [];
  const tl = STATIONS[to]?.lines ?? [];
  return Object.entries(STATIONS)
    .filter(([id, s]) => {
      if (id === from || id === to) return false;
      const a = fl.find((l) => s.lines?.includes(l));
      return !!a && tl.some((l) => l !== a && s.lines?.includes(l));
    })
    .map(([id]) => id);
};

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

const pathOf = (r: Route | null | undefined) =>
  r ? { segments: r.segments, totalMinutes: r.totalMinutes, transferCount: r.transferCount } : null;

/** routeVia as it was before R2: both legs straight from getDiverseRoutes[0]. */
const referenceRouteVia = (from: string, via: string, to: string): Route | null => {
  const legA = getDiverseRoutes(from, via)[0];
  const legB = getDiverseRoutes(via, to)[0];
  if (!legA || !legB || legA.segments.length === 0 || legB.segments.length === 0) return null;
  const into = [...legA.segments].reverse().find((s) => !s.isTransfer)?.lineId;
  const out = legB.segments.find((s) => !s.isTransfer)?.lineId;
  const name = legA.segments[legA.segments.length - 1]!.toStationName;
  const marker: RouteSegment[] =
    into && out && into !== out
      ? [
          {
            fromStationId: via,
            fromStationName: name,
            toStationId: via,
            toStationName: name,
            lineId: out,
            lineName: getLineName(out),
            estimatedMinutes: AVG_TRANSFER_TIME,
            isTransfer: true,
          },
        ]
      : [];
  return createRoute([...legA.segments, ...marker, ...legB.segments]);
};

describe('getFastestRoute — same route as getDiverseRoutes[0]', () => {
  const legs: [string, string][] = [
    ...ODS.flatMap(([f, t]) =>
      candidateVias(f, t).flatMap((v): [string, string][] => [
        [f, v],
        [v, t],
      ]),
    ),
    ...seededPairs(40),
  ];

  it('covers at least 50 legs', () => {
    expect(legs.length).toBeGreaterThanOrEqual(50);
  });

  it.each(legs)('%s → %s', (a, b) => {
    routeCache.clear();
    const fast = getFastestRoute(a, b);
    routeCache.clear();
    expect(pathOf(fast)).toEqual(pathOf(getDiverseRoutes(a, b)[0]));
  });

  it('returns null when there is no route (unknown station)', () => {
    expect(getFastestRoute('no_such_station', 'seolleung')).toBeNull();
  });
});

describe('routeVia — result unchanged by the fast leg search', () => {
  const cases = ODS.flatMap(([f, t]) =>
    candidateVias(f, t).map((v): [string, string, string] => [f, v, t]),
  );

  it.each(cases)('%s → (%s) → %s', (f, v, t) => {
    routeCache.clear();
    const actual = routeVia(f, v, t);
    routeCache.clear();
    expect(actual).toEqual(referenceRouteVia(f, v, t));
  });
});
