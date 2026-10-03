/**
 * notificationService.scheduleWeeklyReminder Tests
 */
import * as Notifications from 'expo-notifications';
import { notificationService } from '../notificationService';

jest.mock('expo-notifications', () => ({
  // Mirrors expo-notifications' real SchedulableTriggerInputTypes (SDK 52+ triggers need `type`).
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

describe('notificationService.scheduleWeeklyReminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('schedules a weekly-trigger notification and returns the identifier', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('weekly-id-1');

    const id = await notificationService.scheduleWeeklyReminder(2, 8, 15, '출발 시간', '지금 출발하세요');

    expect(id).toBe('weekly-id-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: '출발 시간', body: '지금 출발하세요' }),
        trigger: { type: 'weekly', weekday: 2, hour: 8, minute: 15 },
      }),
    );
  });

  it('returns null when scheduling throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(new Error('boom'));

    const id = await notificationService.scheduleWeeklyReminder(2, 8, 15, 't', 'b');

    expect(id).toBeNull();
    consoleSpy.mockRestore();
  });
});
