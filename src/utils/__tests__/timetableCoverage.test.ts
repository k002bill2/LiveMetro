/**
 * timetableCoverage tests
 *
 * Issue #173: 서울열린데이터광장 SearchSTNTimeTableByIDService(서울교통공사
 * 데이터셋)는 숫자 1~9호선만 시간표를 보유한다. Korail/사철 광역·경전철
 * 노선(경의중앙선·수인분당선·공항철도·신분당선 등)은 역코드와 무관하게
 * INFO-200("해당하는 데이터가 없습니다")를 반환한다.
 *
 * 아래 케이스는 라이브 API probe(2026-06-04, 노선별 대표역 1개씩)로 직접
 * 검증한 커버리지 맵에 1:1 대응한다 — covered=INFO-000, uncovered=INFO-200.
 */

import { isSeoulMetroTimetableLine } from '../timetableCoverage';

describe('isSeoulMetroTimetableLine', () => {
  describe('covered — 숫자 1~9호선 (probe: INFO-000)', () => {
    it.each(['1', '2', '3', '4', '5', '6', '7', '8', '9'])(
      'returns true for single-digit line "%s"',
      (line) => {
        expect(isSeoulMetroTimetableLine(line)).toBe(true);
      },
    );

    it.each(['1호선', '2호선', '5호선', '9호선'])(
      'returns true for "N호선" form "%s"',
      (line) => {
        expect(isSeoulMetroTimetableLine(line)).toBe(true);
      },
    );

    it.each(['01호선', '02호선', '08호선', '09호선'])(
      'returns true for zero-padded "0N호선" form "%s"',
      (line) => {
        expect(isSeoulMetroTimetableLine(line)).toBe(true);
      },
    );

    it('trims surrounding whitespace before matching', () => {
      expect(isSeoulMetroTimetableLine('  2  ')).toBe(true);
    });
  });

  describe('uncovered — Korail/사철 광역·경전철 (probe: INFO-200)', () => {
    // seoulStations.json line_num 표기 그대로
    it.each([
      '경의선',
      '경춘선',
      '공항철도',
      '수인분당선',
      '신분당선',
      '경강선',
      '서해선',
      '김포도시철도',
      'GTX-A',
      '인천선',
      '인천2호선',
      '신림선',
      '우이신설경전철',
      '용인경전철',
      '의정부경전철',
    ])('returns false for uncovered line "%s"', (line) => {
      expect(isSeoulMetroTimetableLine(line)).toBe(false);
    });

    // lineId가 가질 수 있는 흔한 별칭 표기도 동일하게 미커버로 판정
    it.each([
      '경의중앙선',
      '분당선',
      '우이신설선',
      '김포골드라인',
      '인천1호선',
      '신분당',
    ])('returns false for common alias "%s"', (line) => {
      expect(isSeoulMetroTimetableLine(line)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isSeoulMetroTimetableLine('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isSeoulMetroTimetableLine('   ')).toBe(false);
    });

    it('returns false for "0" (no line 0)', () => {
      expect(isSeoulMetroTimetableLine('0')).toBe(false);
    });

    it('returns false for "10" (no line 10 in the timetable dataset)', () => {
      expect(isSeoulMetroTimetableLine('10')).toBe(false);
    });

    it('returns false for a non-line numeric string like a station code', () => {
      expect(isSeoulMetroTimetableLine('1251')).toBe(false);
    });
  });
});
