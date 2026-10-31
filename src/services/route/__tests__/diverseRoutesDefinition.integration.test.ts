/**
 * Pins the exact definition of `getDiverseRoutes(a, b)[0]` (default options)
 * and the full card list, so a faster equivalent can be proven result-identical.
 *
 * Definition (derived from computeDiverseRoutes):
 *   paths = Yen K=15 (in-loop transfer-signature dedupe, emission order)
 *   cands = paths with transferCount ≤ 2, or [paths[0]] when none qualify
 *   [0]   = the FIRST cand (emission order) with the minimum totalMinutes,
 *           labelled category 'fastest' + fare.
 * "First on ties" holds because every path in `paths` has a distinct
 * transfer signature (so signature groups are singletons) and the
 * representative sort is stable.
 *
 * Real graph, no mocks.
 */
import {
  buildTransferSignature,
  findKShortestPaths,
  getDiverseRoutes,
} from '@services/route/kShortestPath';
import * as routeCache from '@services/route/routeCache';
import { deriveFare } from '@services/route/routeMeta';
import { STATIONS, LINE_STATIONS } from '@/utils/subwayMapData';
import type { Route } from '@models/route';

const K = 15;
const MAX_TRANSFERS = 2;

/** Legs that fall back to the full Yen search in getFastestRoute (REPORT-R3 §3). */
const FALLBACK_LEGS: readonly (readonly [string, string])[] = [
  ['incheon', 'seolleung'],
  ['yeongdeungpo', 'seolleung'],
  ['seoul', 's_1758'],
];

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

const PAIRS: [string, string][] = [
  ...FALLBACK_LEGS.map(([a, b]): [string, string] => [a, b]),
  ['s_ec82b0ea', 'seolleung'],
  ['s_1032', 'seolleung'],
  ['seoul', 'seolleung'],
  ...seededPairs(200, 20261102),
];

/** Reference implementation of the definition above. */
const definedFirst = (paths: readonly Route[]): Route | null => {
  if (paths.length === 0) return null;
  const filtered = paths.filter((r) => r.transferCount <= MAX_TRANSFERS);
  const cands = filtered.length > 0 ? filtered : [paths[0]!];
  let best = cands[0]!;
  for (const c of cands) if (c.totalMinutes < best.totalMinutes) best = c;
  return { ...best, category: 'fastest', fare: deriveFare(best) };
};

/** FNV-1a 32-bit — compact, stable digest for the full-card snapshot. */
const digest = (value: unknown): string => {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

const cardDigests: Record<string, string> = {};
let tiePairs = 0;

describe('getDiverseRoutes[0] — pinned definition', () => {
  it('covers the fallback legs and at least 200 seeded pairs', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(206);
  });

  it('every LINE_STATIONS id exists in STATIONS (route segments map 1:1 to graph edges)', () => {
    const missing = Object.values(LINE_STATIONS)
      .flat(2)
      .filter((id) => typeof id === 'string' && id.length > 0 && !STATIONS[id]);
    expect(missing).toEqual([]);
  });

  it.each(PAIRS)('%s → %s', (a, b) => {
    const paths = findKShortestPaths(a, b, K).paths;
    routeCache.clear();
    const cards = getDiverseRoutes(a, b);
    routeCache.clear();

    // Distinct transfer signatures → singleton groups → "first on ties".
    const sigs = paths.map(buildTransferSignature);
    expect(new Set(sigs).size).toBe(sigs.length);

    expect(cards[0] ?? null).toEqual(definedFirst(paths));

    const filtered = paths.filter((r) => r.transferCount <= MAX_TRANSFERS);
    const min = Math.min(...filtered.map((r) => r.totalMinutes));
    if (filtered.filter((r) => r.totalMinutes === min).length > 1) tiePairs++;
    cardDigests[`${a}→${b}`] = digest(cards);
  });

  it('full card lists are unchanged (digest snapshot)', () => {
    expect(Object.keys(cardDigests).length).toBe(PAIRS.length);
    expect(cardDigests).toMatchSnapshot();
  });

  it('records how many pairs hit a minimum-time tie (tie rule exercised)', () => {
    expect(tiePairs).toMatchSnapshot();
  });
});
