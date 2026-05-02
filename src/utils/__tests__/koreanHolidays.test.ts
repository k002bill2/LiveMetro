/**
 * Korean Holidays Tests
 */

import { isKoreanHoliday, __toLocalIsoDate } from '../koreanHolidays';

describe('koreanHolidays', () => {
  describe('isKoreanHoliday', () => {
    it('detects fixed-date holidays', () => {
      expect(isKoreanHoliday(new Date(2026, 0, 1))).toBe(true);   // 신정
      expect(isKoreanHoliday(new Date(2026, 4, 5))).toBe(true);   // 어린이날
      expect(isKoreanHoliday(new Date(2026, 11, 25))).toBe(true); // 성탄절
    });

    it('detects lunar-based holidays (설날, 추석)', () => {
      // 2026 설날 = 2026-02-17 (음력 1/1)
      expect(isKoreanHoliday(new Date(2026, 1, 16))).toBe(true);
      expect(isKoreanHoliday(new Date(2026, 1, 17))).toBe(true);
      expect(isKoreanHoliday(new Date(2026, 1, 18))).toBe(true);

      // 2026 추석 = 2026-09-25 (음력 8/15)
      expect(isKoreanHoliday(new Date(2026, 8, 24))).toBe(true);
      expect(isKoreanHoliday(new Date(2026, 8, 25))).toBe(true);
      expect(isKoreanHoliday(new Date(2026, 8, 26))).toBe(true);
    });

    it('detects substitute holidays (대체공휴일)', () => {
      // 2026 삼일절 (일요일) → 3/2 대체공휴일
      expect(isKoreanHoliday(new Date(2026, 2, 2))).toBe(true);
      // 2026 광복절 (토요일) → 8/17 대체공휴일
      expect(isKoreanHoliday(new Date(2026, 7, 17))).toBe(true);
    });

    it('returns false for ordinary weekdays', () => {
      // 2026-04-27 평일 (월)
      expect(isKoreanHoliday(new Date(2026, 3, 27))).toBe(false);
      // 2026-06-15 평일 (월)
      expect(isKoreanHoliday(new Date(2026, 5, 15))).toBe(false);
    });

    it('returns false for ordinary weekends that are not holidays', () => {
      // 2026-04-25 토요일 (보통 토)
      expect(isKoreanHoliday(new Date(2026, 3, 25))).toBe(false);
    });

    it('handles year boundary correctly', () => {
      expect(isKoreanHoliday(new Date(2025, 11, 31))).toBe(false); // not a holiday
      expect(isKoreanHoliday(new Date(2026, 0, 1))).toBe(true);    // 신정
    });

    it('uses local-date keys (no UTC offset bug)', () => {
      // Construct date for 2026-05-05 in local time. Should match holiday list
      // regardless of timezone — KST device, EST CI, UTC test runner.
      const childrensDay = new Date(2026, 4, 5); // local
      expect(isKoreanHoliday(childrensDay)).toBe(true);
    });

    it('defaults to current date when no argument given', () => {
      // Just ensure it doesn't throw and returns a boolean
      expect(typeof isKoreanHoliday()).toBe('boolean');
    });
  });

  describe('__toLocalIsoDate', () => {
    it('formats as YYYY-MM-DD', () => {
      expect(__toLocalIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(__toLocalIsoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
    });

    it('zero-pads single-digit months and days', () => {
      expect(__toLocalIsoDate(new Date(2026, 4, 5))).toBe('2026-05-05');
      expect(__toLocalIsoDate(new Date(2026, 8, 9))).toBe('2026-09-09');
    });
  });
});
