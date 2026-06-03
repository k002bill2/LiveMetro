/**
 * routeMeta — derived route metadata (fare, walking, direction).
 *
 * Focus: `deriveFare` correctness — hop→stationCount conversion, transfer
 * segments excluded from station count, distance-tier boundaries.
 */
import { deriveFare, estimateWalkingMinutes } from '../routeMeta';
import { createRoute, type RouteSegment } from '@/models/route';

const train = (estimatedMinutes = 2.5): RouteSegment => ({
  fromStationId: 'a',
  fromStationName: 'A',
  toStationId: 'b',
  toStationName: 'B',
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes,
  isTransfer: false,
});

const transfer = (): RouteSegment => ({
  fromStationId: 'b',
  fromStationName: 'B',
  toStationId: 'b',
  toStationName: 'B',
  lineId: '3',
  lineName: '3호선',
  estimatedMinutes: 4,
  isTransfer: true,
});

describe('deriveFare', () => {
  it('returns base fare (1,400원) for a short route within base distance', () => {
    // 5 hops → stationCount 6 → 6km ≤ 10km base → 1,400원
    const route = createRoute(Array.from({ length: 5 }, () => train()));
    expect(deriveFare(route)).toBe(1400);
  });

  it('excludes transfer segments from the station count', () => {
    // 12 train hops + 1 transfer → stationCount 13 (transfer not counted)
    // → 14.4km → 1 additional unit → 1,400 + 100 = 1,500원
    const withTransfer = createRoute([
      ...Array.from({ length: 6 }, () => train()),
      transfer(),
      ...Array.from({ length: 6 }, () => train()),
    ]);
    const withoutTransfer = createRoute(Array.from({ length: 12 }, () => train()));
    // Same 12 hops → identical fare regardless of the transfer in between.
    expect(deriveFare(withTransfer)).toBe(deriveFare(withoutTransfer));
    expect(deriveFare(withTransfer)).toBe(1500);
  });

  it('returns base fare for an empty route (distance 0)', () => {
    const route = createRoute([]);
    expect(deriveFare(route)).toBe(1400);
  });

  it('adds distance-tier surcharge for a long route', () => {
    // 40 hops → stationCount 41 → 48km → additional 38km
    // → ceil(38/5) = 8 units × 100 = 800 → 1,400 + 800 = 2,200원
    const route = createRoute(Array.from({ length: 40 }, () => train()));
    expect(deriveFare(route)).toBe(2200);
  });
});

describe('estimateWalkingMinutes', () => {
  it('adds 1 minute per transfer on top of the 6-minute baseline', () => {
    const route = createRoute([train(), transfer(), train()]);
    expect(estimateWalkingMinutes(route)).toBe(7);
  });
});
