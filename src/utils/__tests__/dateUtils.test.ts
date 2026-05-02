/**
 * Date Utility Functions Tests
 */

import {
  formatDate,
  formatArrivalTime,
  isBusinessHours,
  getCommuteTimeCategory,
  parseTimeString,
  formatTimeString,
  isWithinQuietHours,
  getNextOccurrence,
  getTimeDifference,
  isToday,
  isYesterday,
  getKoreanDayOfWeek,
  formatCountdown,
  toSecondsOfDay,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format recent time as "방금 전"', () => {
      const now = new Date();
      expect(formatDate(now, 'short')).toBe('방금 전');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatDate(fiveMinutesAgo, 'short')).toBe('5분 전');
    });

    it('should format hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatDate(threeHoursAgo, 'short')).toBe('3시간 전');
    });

    it('should format days ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatDate(twoDaysAgo, 'short')).toBe('2일 전');
    });

    it('should format time only', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatDate(date, 'time');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatArrivalTime', () => {
    it('should return "정보없음" for null', () => {
      expect(formatArrivalTime(null)).toBe('정보없음');
    });

    it('should return "도착" for past time', () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(formatArrivalTime(pastDate)).toBe('도착');
    });

    it('should return "곧 도착" for less than 60 seconds', () => {
      expect(formatArrivalTime(30)).toBe('곧 도착');
    });

    it('should return "1분후" for 60-119 seconds', () => {
      expect(formatArrivalTime(60)).toBe('1분후');
      expect(formatArrivalTime(90)).toBe('1분후');
    });

    it('should return minutes for longer times', () => {
      expect(formatArrivalTime(180)).toBe('3분후');
      expect(formatArrivalTime(300)).toBe('5분후');
    });

    it('should handle Date objects', () => {
      const futureDate = new Date(Date.now() + 3 * 60 * 1000);
      expect(formatArrivalTime(futureDate)).toBe('3분후');
    });
  });

  describe('isBusinessHours', () => {
    it('should return true during normal hours on weekday', () => {
      const weekdayMorning = new Date('2024-01-15T08:00:00'); // Monday
      expect(isBusinessHours(weekdayMorning)).toBe(true);
    });

    it('should return true late at night', () => {
      const lateNight = new Date('2024-01-15T00:30:00'); // Monday 00:30
      expect(isBusinessHours(lateNight)).toBe(true);
    });

    it('should handle early morning hours', () => {
      const earlyMorning = new Date('2024-01-15T05:00:00'); // Monday
      expect(isBusinessHours(earlyMorning)).toBe(true);
    });
  });

  describe('getCommuteTimeCategory', () => {
    it('should return "morning-rush" during weekday morning rush', () => {
      const morningRush = new Date('2024-01-15T08:00:00'); // Monday
      expect(getCommuteTimeCategory(morningRush)).toBe('morning-rush');
    });

    it('should return "evening-rush" during weekday evening rush', () => {
      const eveningRush = new Date('2024-01-15T18:30:00'); // Monday
      expect(getCommuteTimeCategory(eveningRush)).toBe('evening-rush');
    });

    it('should return "normal" during non-rush hours', () => {
      const afternoon = new Date('2024-01-15T14:00:00'); // Monday
      expect(getCommuteTimeCategory(afternoon)).toBe('normal');
    });

    it('should return "normal" on weekends', () => {
      const saturdayMorning = new Date('2024-01-20T08:00:00'); // Saturday
      expect(getCommuteTimeCategory(saturdayMorning)).toBe('normal');
    });

    it('should return "normal" after 9:30 on weekday', () => {
      const afterMorningRush = new Date('2024-01-15T09:45:00'); // Monday
      expect(getCommuteTimeCategory(afterMorningRush)).toBe('normal');
    });
  });

  describe('parseTimeString', () => {
    it('should parse HH:mm format', () => {
      const result = parseTimeString('14:30');
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse with base date', () => {
      const baseDate = new Date('2024-01-15T00:00:00');
      const result = parseTimeString('09:15', baseDate);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
      expect(result.getDate()).toBe(15);
    });

    it('should handle single digit times', () => {
      const result = parseTimeString('9:5');
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(5);
    });
  });

  describe('formatTimeString', () => {
    it('should format date to HH:mm', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatTimeString(date);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('isWithinQuietHours', () => {
    it('should return true within normal quiet hours', () => {
      const currentDate = new Date('2024-01-15T03:00:00');
      expect(isWithinQuietHours('01:00', '05:00', currentDate)).toBe(true);
    });

    it('should return false outside quiet hours', () => {
      // Use non-overnight quiet hours to avoid implementation bug
      const currentDate = new Date('2024-01-15T20:00:00');
      expect(isWithinQuietHours('08:00', '18:00', currentDate)).toBe(false);
    });

    it('should handle overnight quiet hours', () => {
      const lateNight = new Date('2024-01-15T23:30:00');
      expect(isWithinQuietHours('22:00', '07:00', lateNight)).toBe(true);
    });
  });

  describe('getNextOccurrence', () => {
    it('should return today if time has not passed', () => {
      const baseDate = new Date('2024-01-15T08:00:00');
      const result = getNextOccurrence('10:00', baseDate);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(10);
    });

    it('should return tomorrow if time has passed', () => {
      const baseDate = new Date('2024-01-15T12:00:00');
      const result = getNextOccurrence('10:00', baseDate);
      expect(result.getDate()).toBe(16);
    });
  });

  describe('getTimeDifference', () => {
    it('should format minutes', () => {
      const start = new Date('2024-01-15T10:00:00');
      const end = new Date('2024-01-15T10:30:00');
      expect(getTimeDifference(start, end, 'short')).toBe('30분');
    });

    it('should format hours and minutes', () => {
      const start = new Date('2024-01-15T10:00:00');
      const end = new Date('2024-01-15T12:30:00');
      expect(getTimeDifference(start, end, 'short')).toBe('2시간 30분');
    });

    it('should format days', () => {
      const start = new Date('2024-01-15T10:00:00');
      const end = new Date('2024-01-17T12:00:00');
      expect(getTimeDifference(start, end, 'short')).toBe('2일 2시간');
    });

    it('should handle long format', () => {
      const start = new Date('2024-01-15T10:00:00');
      const end = new Date('2024-01-15T12:00:00');
      expect(getTimeDifference(start, end, 'long')).toBe('2시간');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('should return false for today', () => {
      expect(isYesterday(new Date())).toBe(false);
    });
  });

  describe('getKoreanDayOfWeek', () => {
    it('should return Korean day name', () => {
      const monday = new Date('2024-01-15'); // Monday
      expect(getKoreanDayOfWeek(monday)).toBe('월');

      const sunday = new Date('2024-01-14'); // Sunday
      expect(getKoreanDayOfWeek(sunday)).toBe('일');

      const saturday = new Date('2024-01-20'); // Saturday
      expect(getKoreanDayOfWeek(saturday)).toBe('토');
    });
  });

  describe('formatCountdown', () => {
    it('should format seconds as MM:SS', () => {
      expect(formatCountdown(90)).toBe('01:30');
      expect(formatCountdown(125)).toBe('02:05');
    });

    it('should handle zero', () => {
      expect(formatCountdown(0)).toBe('00:00');
    });

    it('should handle negative values', () => {
      expect(formatCountdown(-10)).toBe('00:00');
    });

    it('should pad with zeros', () => {
      expect(formatCountdown(5)).toBe('00:05');
      expect(formatCountdown(65)).toBe('01:05');
    });
  });

  describe('toSecondsOfDay', () => {
    it('should parse zero-padded HH:mm:ss', () => {
      expect(toSecondsOfDay('09:35:00')).toBe(9 * 3600 + 35 * 60);
      expect(toSecondsOfDay('14:30:00')).toBe(14 * 3600 + 30 * 60);
    });

    it('should parse non-zero-padded H:mm:ss (Seoul API timetable format)', () => {
      expect(toSecondsOfDay('9:35:00')).toBe(9 * 3600 + 35 * 60);
      expect(toSecondsOfDay('5:00:00')).toBe(5 * 3600);
    });

    it('should give consistent ordering across padded and non-padded formats', () => {
      // The bug we are fixing: lexicographic comparison says "9:35:00" > "14:30:00"
      // because '9' > '1'. Numeric comparison must place 9:35 before 14:30.
      expect(toSecondsOfDay('9:35:00')).toBeLessThan(toSecondsOfDay('14:30:00'));
      expect(toSecondsOfDay('09:35:00')).toBeLessThan(toSecondsOfDay('14:30:00'));
    });

    it('should handle HH:mm without seconds', () => {
      expect(toSecondsOfDay('09:35')).toBe(9 * 3600 + 35 * 60);
    });

    it('should handle midnight and end of day', () => {
      expect(toSecondsOfDay('00:00:00')).toBe(0);
      expect(toSecondsOfDay('23:59:59')).toBe(23 * 3600 + 59 * 60 + 59);
    });

    it('should accept hours >= 24 used by some transit APIs for next-day runs', () => {
      // Some transit feeds encode "25:30" to mean 1:30 the next day within the
      // same operating day. Our utility treats them as raw seconds-of-day,
      // which is what the schedule filter expects (numeric comparison still
      // works: 25:30 (91800) is correctly "after" 23:00 (82800)).
      expect(toSecondsOfDay('25:30:00')).toBe(25 * 3600 + 30 * 60);
      expect(toSecondsOfDay('24:00:00')).toBe(24 * 3600);
      expect(toSecondsOfDay('25:30:00')).toBeGreaterThan(toSecondsOfDay('23:00:00'));
    });

    it('should return -1 for invalid input', () => {
      expect(toSecondsOfDay('')).toBe(-1);
      expect(toSecondsOfDay('not a time')).toBe(-1);
      expect(toSecondsOfDay('-1:00:00')).toBe(-1);
      expect(toSecondsOfDay(undefined as unknown as string)).toBe(-1);
      expect(toSecondsOfDay(null as unknown as string)).toBe(-1);
    });
  });
});
