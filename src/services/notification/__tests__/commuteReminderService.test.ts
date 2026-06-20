/**
 * commuteReminderService Tests
 */
import { storageUtils } from '@/utils/storageUtils';
import { notificationService } from '../notificationService';
import { computeWeeklyTrigger, commuteReminderService } from '../commuteReminderService';

jest.mock('@/utils/storageUtils', () => ({
  storageUtils: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../notificationService', () => ({
  notificationService: {
    cancelNotification: jest.fn(),
    scheduleWeeklyReminder: jest.fn(),
    requestPermissions: jest.fn(),
  },
}));

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

describe('commuteReminderService cancel/get', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getCommuteReminders reads the stored array for the uid', async () => {
    const stored = [{ weekday: 2, notificationId: 'n1', time: '08:15' }];
    (storageUtils.getItem as jest.Mock).mockResolvedValue(stored);

    const result = await commuteReminderService.getCommuteReminders('user-1');

    expect(storageUtils.getItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
    expect(result).toEqual(stored);
  });

  it('getCommuteReminders returns [] when nothing stored', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null);
    expect(await commuteReminderService.getCommuteReminders('user-1')).toEqual([]);
  });

  it('cancelCommuteReminders cancels every stored id then clears storage', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue([
      { weekday: 2, notificationId: 'n1', time: '08:15' },
      { weekday: 3, notificationId: 'n2', time: '08:15' },
    ]);

    await commuteReminderService.cancelCommuteReminders('user-1');

    expect(notificationService.cancelNotification).toHaveBeenCalledWith('n1');
    expect(notificationService.cancelNotification).toHaveBeenCalledWith('n2');
    expect(storageUtils.removeItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
  });

  it('cancelCommuteReminders is a no-op (still clears) when nothing stored', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null);
    await commuteReminderService.cancelCommuteReminders('user-1');
    expect(notificationService.cancelNotification).not.toHaveBeenCalled();
    expect(storageUtils.removeItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
  });
});

describe('commuteReminderService.scheduleCommuteReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null); // no existing
    (notificationService.scheduleWeeklyReminder as jest.Mock).mockImplementation(
      async (weekday: number) => `id-${weekday}`,
    );
  });

  it('schedules one reminder per active day (Mon/Wed) and persists them', async () => {
    // activeDays index 0=Mon..6=Sun → Mon(true), Wed(true) only
    const activeDays = [true, false, true, false, false, false, false];

    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays,
    });

    // Mon→expo 2, Wed→expo 4
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledTimes(2);
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledWith(2, 8, 15, expect.any(String), expect.any(String));
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledWith(4, 8, 15, expect.any(String), expect.any(String));
    expect(result).toEqual([
      { weekday: 2, notificationId: 'id-2', time: '08:15' },
      { weekday: 4, notificationId: 'id-4', time: '08:15' },
    ]);
    expect(storageUtils.setItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1', result);
  });

  it('cancels existing reminders before scheduling (idempotent reschedule)', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValueOnce([
      { weekday: 6, notificationId: 'old', time: '07:00' },
    ]);

    await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [true, false, false, false, false, false, false],
    });

    expect(notificationService.cancelNotification).toHaveBeenCalledWith('old');
    // cancel happened before the new schedule
    const cancelOrder = (notificationService.cancelNotification as jest.Mock).mock.invocationCallOrder[0];
    const scheduleOrder = (notificationService.scheduleWeeklyReminder as jest.Mock).mock.invocationCallOrder[0];
    expect(cancelOrder).toBeDefined();
    expect(scheduleOrder).toBeDefined();
    expect(cancelOrder).toBeLessThan(scheduleOrder as number);
  });

  it('schedules nothing when no active days', async () => {
    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [false, false, false, false, false, false, false],
    });
    expect(notificationService.scheduleWeeklyReminder).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(storageUtils.setItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1', []);
  });

  it('persists only successful schedules (skips nulls)', async () => {
    (notificationService.scheduleWeeklyReminder as jest.Mock)
      .mockResolvedValueOnce('id-2') // Mon ok
      .mockResolvedValueOnce(null); // Tue fails
    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [true, true, false, false, false, false, false],
    });
    expect(result).toEqual([{ weekday: 2, notificationId: 'id-2', time: '08:15' }]);
  });
});
