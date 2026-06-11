import {
  minutesBetween,
  addMinutesToHHmm,
  formatRelativeKorean,
  formatDateTimeLabel,
} from './homeTimeFormat';

describe('homeTimeFormat', () => {
  describe('minutesBetween', () => {
    it('computes minutes between two HH:mm times', () => {
      expect(minutesBetween('08:00', '08:45')).toBe(45);
    });

    it('wraps midnight (23:55 → 00:20 = 25 min)', () => {
      expect(minutesBetween('23:55', '00:20')).toBe(25);
    });

    it('returns null when departure equals arrival (zero duration)', () => {
      expect(minutesBetween('08:00', '08:00')).toBeNull();
    });

    it('returns null on missing input', () => {
      expect(minutesBetween(undefined, '08:00')).toBeNull();
      expect(minutesBetween('08:00', undefined)).toBeNull();
    });

    it('returns null on malformed input', () => {
      expect(minutesBetween('8am', '09:00')).toBeNull();
      expect(minutesBetween('08:00', '9:5')).toBeNull();
    });
  });

  describe('addMinutesToHHmm', () => {
    it('adds minutes within the same day', () => {
      expect(addMinutesToHHmm('08:30', 45)).toBe('09:15');
    });

    it('wraps past midnight', () => {
      expect(addMinutesToHHmm('23:50', 30)).toBe('00:20');
    });

    it('rounds fractional minutes', () => {
      expect(addMinutesToHHmm('08:00', 29.6)).toBe('08:30');
    });

    it('returns null on missing or non-finite input', () => {
      expect(addMinutesToHHmm(undefined, 10)).toBeNull();
      expect(addMinutesToHHmm('08:00', undefined)).toBeNull();
      expect(addMinutesToHHmm('08:00', Number.NaN)).toBeNull();
    });

    it('returns null on malformed time string', () => {
      expect(addMinutesToHHmm('morning', 10)).toBeNull();
    });
  });

  describe('formatRelativeKorean', () => {
    const now = new Date('2026-06-11T12:00:00');

    it('returns 방금 전 under a minute', () => {
      expect(formatRelativeKorean(new Date('2026-06-11T11:59:30'), now)).toBe('방금 전');
    });

    it('returns minutes / hours / days buckets', () => {
      expect(formatRelativeKorean(new Date('2026-06-11T11:48:00'), now)).toBe('12분 전');
      expect(formatRelativeKorean(new Date('2026-06-11T09:00:00'), now)).toBe('3시간 전');
      expect(formatRelativeKorean(new Date('2026-06-09T12:00:00'), now)).toBe('2일 전');
    });

    it('clamps future timestamps to 방금 전', () => {
      expect(formatRelativeKorean(new Date('2026-06-11T12:05:00'), now)).toBe('방금 전');
    });

    it('returns null when timestamp is missing', () => {
      expect(formatRelativeKorean(undefined, now)).toBeNull();
    });
  });

  describe('formatDateTimeLabel', () => {
    it('formats a morning timestamp with Korean day-of-week', () => {
      expect(formatDateTimeLabel(new Date('2026-05-03T08:32:00'))).toBe(
        '2026.05.03 (일) · 오전 8:32',
      );
    });

    it('formats afternoon as 오후 with 12-hour clock', () => {
      expect(formatDateTimeLabel(new Date('2026-06-11T15:05:00'))).toBe(
        '2026.06.11 (목) · 오후 3:05',
      );
    });

    it('renders midnight as 오전 12시', () => {
      expect(formatDateTimeLabel(new Date('2026-06-11T00:07:00'))).toBe(
        '2026.06.11 (목) · 오전 12:07',
      );
    });
  });
});
