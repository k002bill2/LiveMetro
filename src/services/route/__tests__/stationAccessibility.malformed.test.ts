/**
 * stationAccessibility — malformed JSON 회귀 (설계 §4.7).
 *
 * 별도 파일인 이유: stationAccessibility.test.ts 는 stations 키가 있는 JSON 을
 * jest.mock 으로 고정한다. 같은 파일에서 jest.doMock + isolateModules 로
 * stations 없는 변형을 주입하려 하면 hoisted jest.mock 이 우선해 override 가
 * 안 된다 (Jest mock-hoisting 제약 — 모듈당 mock 1개 원칙). 따라서 분리한다.
 *
 * 검증 대상: loader 의 `const TABLE = FILE.stations ?? {}` fallback 경로.
 * stations 키가 없는 JSON 으로 모듈을 로드하면 빈 테이블로 graceful degrade —
 * 크래시 없이 모든 역이 undefined.
 */
jest.mock('@/data/stationAccessibility.json', () => ({
  generatedAt: 'test',
  source: 'test',
  // stations 키 없음 — loader 의 `FILE.stations ?? {}` fallback 경로 발현
}));

import { stationHasElevator } from '../stationAccessibility';

describe('stationHasElevator — malformed JSON (stations 키 부재)', () => {
  it('stations 키가 없어도 크래시 없이 undefined 반환 (graceful inert)', () => {
    expect(stationHasElevator('STN_WITH')).toBeUndefined();
  });

  it('임의의 다른 역도 undefined (빈 테이블 fallback)', () => {
    expect(stationHasElevator('STN_ANYTHING')).toBeUndefined();
  });
});
