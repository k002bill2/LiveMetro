/**
 * hasRedundantLineRevisit — detects U-turn routes that leave a line and return
 * to it after a detour (e.g. 4→1→4 at 서울역 when the 4호선 runs straight
 * through). Such routes are valid graph paths but never a sensible suggestion.
 */
import { hasRedundantLineRevisit } from '../kShortestPath';
import { createRoute, type RouteSegment } from '@/models/route';

const train = (lineId: string): RouteSegment => ({
  fromStationId: 'a',
  fromStationName: 'A',
  toStationId: 'b',
  toStationName: 'B',
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: 5,
  isTransfer: false,
});

const transfer = (lineId: string): RouteSegment => ({
  fromStationId: 'b',
  fromStationName: 'B',
  toStationId: 'b',
  toStationName: 'B',
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: 4,
  isTransfer: true,
});

describe('hasRedundantLineRevisit', () => {
  it('flags a U-turn that returns to the same line after a detour (4→1→4)', () => {
    const route = createRoute([
      train('4'),
      transfer('1'),
      train('1'),
      transfer('4'),
      train('4'),
    ]);
    expect(hasRedundantLineRevisit(route)).toBe(true);
  });

  it('does not flag a single-line direct route (4)', () => {
    const route = createRoute([train('4'), train('4'), train('4')]);
    expect(hasRedundantLineRevisit(route)).toBe(false);
  });

  it('does not flag a normal single transfer (4→2)', () => {
    const route = createRoute([train('4'), transfer('2'), train('2')]);
    expect(hasRedundantLineRevisit(route)).toBe(false);
  });

  it('does not flag a two-transfer route across distinct lines (4→1→2)', () => {
    const route = createRoute([
      train('4'),
      transfer('1'),
      train('1'),
      transfer('2'),
      train('2'),
    ]);
    expect(hasRedundantLineRevisit(route)).toBe(false);
  });

  it('does not flag a branch-shuttle revisit on the same trunk line (2→2)', () => {
    // 본선↔지선은 trunk lineId가 같으므로(예: 둘 다 '2') 연속 압축으로 보존된다.
    const route = createRoute([train('2'), transfer('2'), train('2')]);
    expect(hasRedundantLineRevisit(route)).toBe(false);
  });

  it('handles an empty route safely', () => {
    expect(hasRedundantLineRevisit(createRoute([]))).toBe(false);
  });
});
