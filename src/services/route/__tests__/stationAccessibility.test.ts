/**
 * stationAccessibility 단위 테스트.
 *
 * 번들 JSON 을 jest.mock 으로 대체해 입력을 통제한다 (factory 내부 inline 정의 —
 * .claude/rules/coverage-thresholds.md 의 호이스팅 안전 패턴).
 */
jest.mock('@/data/stationAccessibility.json', () => ({
  generatedAt: '2026-05-21T00:00:00+09:00',
  source: 'test',
  stations: {
    'STN_WITH': { hasElevator: true, elevatorCount: 2 },
    'STN_WITHOUT': { hasElevator: false, elevatorCount: 0 },
  },
}));

import { stationHasElevator } from '../stationAccessibility';

describe('stationHasElevator', () => {
  it('엘리베이터 있는 역 → true', () => {
    expect(stationHasElevator('STN_WITH')).toBe(true);
  });

  it('엘리베이터 없는 역 → false', () => {
    expect(stationHasElevator('STN_WITHOUT')).toBe(false);
  });

  it('데이터셋에 없는 역 → undefined (unknown — "없음"으로 단정하지 않음)', () => {
    expect(stationHasElevator('STN_UNKNOWN')).toBeUndefined();
  });
});
