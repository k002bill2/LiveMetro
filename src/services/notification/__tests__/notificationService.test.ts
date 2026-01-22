/**
 * Notification Service Tests
 * Tests for push notification handling and notification settings
 */

import { notificationService, NotificationType } from '../notificationService';
import { NotificationSettings } from '../../../models/user';

import * as Notifications from 'expo-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
    DEFAULT: 'default',
    LOW: 'low',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('NotificationService', () => {
  const defaultNotificationSettings: NotificationSettings = {
    enabled: true,
    delayThresholdMinutes: 5,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '07:00',
    },
    weekdaysOnly: false,
    alertTypes: {
      delays: true,
      suspensions: true,
      congestion: false,
      alternativeRoutes: true,
      serviceUpdates: true,
    },
    pushNotifications: true,
    emailNotifications: false,
    soundSettings: {
      soundEnabled: true,
      soundId: 'default',
      volume: 80,
      vibrationEnabled: true,
      vibrationPattern: 'default',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Initialize service with permissions for shouldSendNotification tests
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as Notifications.PermissionResponse);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as Notifications.PermissionResponse);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[xxxxxx]',
      type: 'expo',
    });
    mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
    await notificationService.initialize();
  });

  describe('shouldSendNotification', () => {
    it('should return false when notifications are disabled', () => {
      const settings: NotificationSettings = {
        ...defaultNotificationSettings,
        enabled: false,
      };

      const result = notificationService.shouldSendNotification(
        settings,
        NotificationType.DELAY_ALERT
      );

      expect(result).toBe(false);
    });

    describe('quiet hours', () => {
      it('should block notifications during quiet hours (same day)', () => {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '23:00',
          },
        };

        // 22:30 - within quiet hours
        const duringQuietHours = new Date('2024-01-15T22:30:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, duringQuietHours)
        ).toBe(false);

        // 21:30 - before quiet hours
        const beforeQuietHours = new Date('2024-01-15T21:30:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, beforeQuietHours)
        ).toBe(true);

        // 23:30 - after quiet hours
        const afterQuietHours = new Date('2024-01-15T23:30:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, afterQuietHours)
        ).toBe(true);
      });

      it('should block notifications during overnight quiet hours', () => {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '07:00',
          },
        };

        // 23:00 - within quiet hours (before midnight)
        const lateNight = new Date('2024-01-15T23:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, lateNight)
        ).toBe(false);

        // 03:00 - within quiet hours (after midnight)
        const earlyMorning = new Date('2024-01-15T03:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, earlyMorning)
        ).toBe(false);

        // 08:00 - outside quiet hours
        const morning = new Date('2024-01-15T08:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, morning)
        ).toBe(true);

        // 21:00 - outside quiet hours (before start)
        const evening = new Date('2024-01-15T21:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, evening)
        ).toBe(true);
      });

      it('should allow notifications when quiet hours are disabled', () => {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '07:00',
          },
        };

        const lateNight = new Date('2024-01-15T23:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, lateNight)
        ).toBe(true);
      });
    });

    describe('weekdays only', () => {
      it('should block notifications on weekends when weekdaysOnly is enabled', () => {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          weekdaysOnly: true,
        };

        // Saturday
        const saturday = new Date('2024-01-13T12:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, saturday)
        ).toBe(false);

        // Sunday
        const sunday = new Date('2024-01-14T12:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, sunday)
        ).toBe(false);
      });

      it('should allow notifications on weekdays', () => {
        const settings: NotificationSettings = {
          ...defaultNotificationSettings,
          weekdaysOnly: true,
        };

        // Monday
        const monday = new Date('2024-01-15T12:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, monday)
        ).toBe(true);

        // Friday
        const friday = new Date('2024-01-19T12:00:00');
        expect(
          notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT, friday)
        ).toBe(true);
      });
    });

    describe('alert types', () => {
      it('should respect delay alert setting', () => {
        const settingsEnabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, delays: true } };
        const settingsDisabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, delays: false } };

        expect(notificationService.shouldSendNotification(settingsEnabled, NotificationType.DELAY_ALERT)).toBe(true);
        expect(notificationService.shouldSendNotification(settingsDisabled, NotificationType.DELAY_ALERT)).toBe(false);
      });

      it('should respect emergency alert (suspensions) setting', () => {
        const settingsEnabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, suspensions: true } };
        const settingsDisabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, suspensions: false } };

        expect(notificationService.shouldSendNotification(settingsEnabled, NotificationType.EMERGENCY_ALERT)).toBe(true);
        expect(notificationService.shouldSendNotification(settingsDisabled, NotificationType.EMERGENCY_ALERT)).toBe(false);
      });

      it('should respect service update setting', () => {
        const settingsEnabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, serviceUpdates: true } };
        const settingsDisabled = { ...defaultNotificationSettings, alertTypes: { ...defaultNotificationSettings.alertTypes, serviceUpdates: false } };

        expect(notificationService.shouldSendNotification(settingsEnabled, NotificationType.SERVICE_UPDATE)).toBe(true);
        expect(notificationService.shouldSendNotification(settingsDisabled, NotificationType.SERVICE_UPDATE)).toBe(false);
      });

      it('should allow unspecified notification types by default', () => {
        expect(notificationService.shouldSendNotification(defaultNotificationSettings, NotificationType.ARRIVAL_REMINDER)).toBe(true);
        expect(notificationService.shouldSendNotification(defaultNotificationSettings, NotificationType.COMMUTE_REMINDER)).toBe(true);
      });
    });
  });

  describe('getPushToken', () => {
    it('should return push token after initialization', () => {
      expect(notificationService.getPushToken()).toBe('ExponentPushToken[xxxxxx]');
    });
  });

  describe('getPermissionStatus', () => {
    it('should return permission status after initialization', () => {
      const status = notificationService.getPermissionStatus();
      expect(status?.granted).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with granted permissions', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xxxxxx]',
        type: 'expo',
      });
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);

      const result = await notificationService.initialize();

      expect(result).toBe(true);
      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalled();
    });

    it('should return false when permissions are denied', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);

      const result = await notificationService.initialize();

      expect(result).toBe(false);
    });
  });

  describe('sendLocalNotification', () => {
    beforeEach(async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xxxxxx]',
        type: 'expo',
      });
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
      await notificationService.initialize();
    });

    it('should schedule a notification', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('notification-id-123');

      const result = await notificationService.sendLocalNotification({
        type: NotificationType.DELAY_ALERT,
        title: 'Test Title',
        body: 'Test Body',
        priority: 'high',
      });

      expect(result).toBe('notification-id-123');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: 'Test Title',
          body: 'Test Body',
        }),
        trigger: null,
      });
    });
  });

  describe('sendDelayAlert', () => {
    beforeEach(async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xxxxxx]',
        type: 'expo',
      });
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
      await notificationService.initialize();
    });

    it('should send delay alert with formatted message', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('delay-alert-id');

      await notificationService.sendDelayAlert('강남', '2호선', 10, '혼잡으로 인한 지연');

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: '🚇 2호선 지연 알림',
          body: '강남역에서 10분 지연이 발생했습니다. 사유: 혼잡으로 인한 지연',
        }),
        trigger: null,
      });
    });

    it('should send delay alert without reason', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('delay-alert-id');

      await notificationService.sendDelayAlert('강남', '2호선', 5);

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          body: '강남역에서 5분 지연이 발생했습니다.',
        }),
        trigger: null,
      });
    });
  });

  describe('sendEmergencyAlert', () => {
    beforeEach(async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xxxxxx]',
        type: 'expo',
      });
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
      await notificationService.initialize();
    });

    it('should send emergency alert', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('emergency-id');

      await notificationService.sendEmergencyAlert(
        '운행 중단',
        '2호선 전 구간 운행이 중단되었습니다.',
        ['2호선']
      );

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: '🚨 운행 중단',
          body: '2호선 전 구간 운행이 중단되었습니다.',
        }),
        trigger: null,
      });
    });
  });

  describe('sendArrivalReminder', () => {
    beforeEach(async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.PermissionResponse);
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[xxxxxx]',
        type: 'expo',
      });
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
      await notificationService.initialize();
    });

    it('should send arrival reminder for imminent arrivals', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('arrival-id');

      const result = await notificationService.sendArrivalReminder('강남', '2호선', 3);

      expect(result).toBe('arrival-id');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          title: '🚇 2호선 도착 안내',
          body: '강남역에 3분 후 도착합니다.',
        }),
        trigger: null,
      });
    });

    it('should not send arrival reminder for arrivals more than 5 minutes away', async () => {
      const result = await notificationService.sendArrivalReminder('강남', '2호선', 10);

      expect(result).toBeNull();
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel a scheduled notification', async () => {
      mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

      await notificationService.cancelNotification('notification-id-123');

      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id-123');
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all scheduled notifications', async () => {
      mockNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);

      await notificationService.cancelAllNotifications();

      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('notification listeners', () => {
    it('should add notification received listener', () => {
      const callback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockNotifications.addNotificationReceivedListener.mockReturnValue(mockSubscription as any);

      const subscription = notificationService.addNotificationListener(callback);

      expect(mockNotifications.addNotificationReceivedListener).toHaveBeenCalledWith(callback);
      expect(subscription).toBe(mockSubscription);
    });

    it('should add notification response listener', () => {
      const callback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockNotifications.addNotificationResponseReceivedListener.mockReturnValue(mockSubscription as any);

      const subscription = notificationService.addNotificationResponseListener(callback);

      expect(mockNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(callback);
      expect(subscription).toBe(mockSubscription);
    });
  });
});
