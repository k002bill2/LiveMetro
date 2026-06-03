/**
 * sortRoutesByTab — pure client-side re-ordering of a route candidate pool by
 * the user-selected sort tab. No re-search; just a stable comparator per tab.
 */
import { sortRoutesByTab } from '../kShortestPath';
import type { Route } from '@/models/route';

/**
 * Minimal Route fixture. `segments: []` means `deriveFare` fallback would
 * yield base fare (1,400); tests that care about fare attach it explicitly.
 */
const mk = (totalMinutes: number, transferCount: number, fare?: number): Route => ({
  segments: [],
  totalMinutes,
  transferCount,
  lineIds: [],
  ...(fare !== undefined ? { fare } : {}),
});

describe('sortRoutesByTab', () => {
  // A: slow, no transfer, cheap   B: fastest, 2 transfers, cheap
  // C: slowest, no transfer, pricey
  const A = mk(30, 0, 1400);
  const B = mk(25, 2, 1400);
  const C = mk(40, 0, 1500);
  const pool = [A, B, C];

  it("'fastest' orders by totalMinutes ascending", () => {
    expect(sortRoutesByTab(pool, 'fastest')).toEqual([B, A, C]);
  });

  it("'min-transfer' orders by transferCount then time", () => {
    // transfer 0: A(30), C(40) — time tie-break; then transfer 2: B
    expect(sortRoutesByTab(pool, 'min-transfer')).toEqual([A, C, B]);
  });

  it("'min-fare' orders by fare then time", () => {
    // fare 1400: B(25), A(30) — time tie-break; then fare 1500: C
    expect(sortRoutesByTab(pool, 'min-fare')).toEqual([B, A, C]);
  });

  it("'optimal' orders by time + transfer penalty (×4)", () => {
    // scores → A:30, B:25+8=33, C:40 → A, B, C
    expect(sortRoutesByTab(pool, 'optimal')).toEqual([A, B, C]);
  });

  it('does not mutate the input array', () => {
    const input = [A, B, C];
    sortRoutesByTab(input, 'fastest');
    expect(input).toEqual([A, B, C]);
  });

  it("'min-fare' falls back to deriveFare when fare is absent", () => {
    // No explicit fare → both derive base 1,400 (empty segments) → time tie-break.
    const x = mk(20, 1);
    const y = mk(10, 1);
    expect(sortRoutesByTab([x, y], 'min-fare')).toEqual([y, x]);
  });
});
