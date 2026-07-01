/**
 * notificationService.cancelScheduledCommuteReminders Tests
 *
 * Orphan-safe sweep: cancels EVERY weekly commute reminder on the OS queue,
 * including legacy orphans (no `source` marker) left by an earlier reconcile
 * race or app version. Must NOT touch the ML departure alert, which shares the
 * COMMUTE_REMINDER type but uses a date trigger.
 */
import * as Notifications from 'expo-notifications';
import { notificationService } from '../notificationService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

describe('notificationService.cancelScheduledCommuteReminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels weekly commute reminders on both platforms, preserves ML date alert and other types', async () => {
    // Legacy orphans carry NO source marker — exactly the shape already on
    // users' devices — so the sweep must match by type + weekly trigger only.
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      // Android weekly (legacy orphan)
      {
        identifier: 'legacy-android',
        content: { data: { type: 'commute_reminder' } },
        trigger: { type: 'weekly', weekday: 2, hour: 8, minute: 15 },
      },
      // iOS calendar with weekday, no calendar day (legacy orphan)
      {
        identifier: 'legacy-ios',
        content: { data: { type: 'commute_reminder' } },
        trigger: {
          type: 'calendar',
          repeats: true,
          dateComponents: { weekday: 2, hour: 8, minute: 15, isLeapMonth: false },
        },
      },
      // ML departure alert: same type, but a concrete date → MUST be preserved
      {
        identifier: 'ml-date',
        content: { data: { type: 'commute_reminder' } },
        trigger: {
          type: 'calendar',
          repeats: true,
          dateComponents: { year: 2026, month: 7, day: 3, hour: 8, minute: 0, isLeapMonth: false },
        },
      },
      // Arrival reminder weekly: different type → preserved
      {
        identifier: 'arrival',
        content: { data: { type: 'arrival_reminder' } },
        trigger: { type: 'weekly', weekday: 3, hour: 9, minute: 0 },
      },
      // Malformed / missing data → ignored, never throws
      { identifier: 'no-data', content: {}, trigger: null },
    ]);

    await notificationService.cancelScheduledCommuteReminders();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('legacy-android');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('legacy-ios');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('ml-date');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('arrival');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('no-data');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when nothing is scheduled', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    await notificationService.cancelScheduledCommuteReminders();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows errors from the OS query (never throws)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(notificationService.cancelScheduledCommuteReminders()).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
