/**
 * commuteReminderService Tests
 */
import { computeWeeklyTrigger } from '../commuteReminderService';

describe('computeWeeklyTrigger', () => {
  // activeDays index 0=Mon..6=Sun  →  expo weekday 1=Sun..7=Sat
  it.each([
    [0, 2], // Mon
    [1, 3], // Tue
    [2, 4], // Wed
    [3, 5], // Thu
    [4, 6], // Fri
    [5, 7], // Sat
    [6, 1], // Sun
  ])('maps activeDay index %i to expo weekday %i', (index, expectedWeekday) => {
    const spec = computeWeeklyTrigger('08:15', 0, index);
    expect(spec).not.toBeNull();
    expect(spec?.weekday).toBe(expectedWeekday);
  });

  it('keeps hour/minute at departureTime when leadMinutes is 0', () => {
    const spec = computeWeeklyTrigger('08:15', 0, 0);
    expect(spec).toEqual({ weekday: 2, hour: 8, minute: 15, time: '08:15' });
  });

  it('subtracts leadMinutes within the same day', () => {
    const spec = computeWeeklyTrigger('08:15', 10, 0); // Mon 08:05
    expect(spec).toEqual({ weekday: 2, hour: 8, minute: 5, time: '08:05' });
  });

  it('wraps to previous day when lead crosses midnight', () => {
    // Mon 00:05, lead 10 → Sun 23:55 (weekday shifts Mon(2) → Sun(1))
    const spec = computeWeeklyTrigger('00:05', 10, 0);
    expect(spec).toEqual({ weekday: 1, hour: 23, minute: 55, time: '23:55' });
  });

  it('returns null on malformed departureTime', () => {
    expect(computeWeeklyTrigger('xx:yy', 0, 0)).toBeNull();
  });
});
