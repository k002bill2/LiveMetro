import { deriveLoopDirection } from '@/utils/loopDirection';

/**
 * deriveLoopDirection tests.
 *
 * Line 2's circular trunk (LINE_STATIONS['2'][0]) is the single source of
 * truth. These tests feed REAL lines.json slugs — no mock — because the id
 * domain matching the graph output is itself the contract under test (a
 * mocked seam would hide a slug-domain mismatch).
 */
describe('deriveLoopDirection', () => {
  it('returns "down" (외선) for 신도림→강남 — 사당 경유가 내선보다 짧다', () => {
    expect(deriveLoopDirection('2', 'sindorim', 'gangnam')).toBe('down');
  });

  it('returns "up" (내선) for 강남→신도림 — 반대 방향', () => {
    expect(deriveLoopDirection('2', 'gangnam', 'sindorim')).toBe('up');
  });

  it('returns "up" for adjacent 시청→을지로3가 (내선, wrap 아님)', () => {
    expect(deriveLoopDirection('2', 'city_hall_1', 'euljiro3ga')).toBe('up');
  });

  it('returns "up" across the 충정로→시청 wrap boundary', () => {
    expect(deriveLoopDirection('2', 'chungjeongno', 'city_hall_1')).toBe('up');
  });

  it('returns undefined when a station is only on a 지선 (성수지선 s_0244)', () => {
    // s_0244 lives in subarray 1 (성수지선), not the loop trunk — 지선은 상/하행
    // 운행이라 내/외선 방향이 정의되지 않는다.
    expect(deriveLoopDirection('2', 's_0244', 'gangnam')).toBeUndefined();
    expect(deriveLoopDirection('2', 'gangnam', 's_0244')).toBeUndefined();
  });

  it('returns undefined for non-loop lines (lineId "1")', () => {
    expect(deriveLoopDirection('1', 'city_hall_1', 'euljiro3ga')).toBeUndefined();
  });

  it('returns undefined for identical origin and destination (no direction)', () => {
    expect(deriveLoopDirection('2', 'gangnam', 'gangnam')).toBeUndefined();
  });

  it('returns undefined when either station is unknown to the trunk', () => {
    expect(deriveLoopDirection('2', 'nonexistent_station', 'gangnam')).toBeUndefined();
    expect(deriveLoopDirection('2', 'gangnam', 'nonexistent_station')).toBeUndefined();
  });
});
