/**
 * Push Notification Service
 * Handles real-time delay alerts, emergency notifications, and personalized commute alerts
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationSettings } from '../../models/user';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export enum NotificationType {
  DELAY_ALERT = 'delay_alert',
  EMERGENCY_ALERT = 'emergency_alert',
  ARRIVAL_REMINDER = 'arrival_reminder',
  SERVICE_UPDATE = 'service_update',
  COMMUTE_REMINDER = 'commute_reminder'
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  channelId?: string;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private isInitialized: boolean = false;
  private permissionStatus: Notifications.PermissionResponse | null = null;

  /**
   * Initialize notification service
   */
  async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const permission = await this.requestPermissions();
      if (!permission.granted) {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Get Expo push token
      this.expoPushToken = await this.getExpoPushToken();
      
      // Set up notification channels (Android)
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      this.isInitialized = true;
      console.log('Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<Notifications.PermissionResponse> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.permissionStatus = {
        status: finalStatus,
        granted: finalStatus === 'granted',
        canAskAgain: finalStatus !== 'denied',
        expires: 'never'
      } as Notifications.PermissionResponse;

      return this.permissionStatus;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      throw error;
    }
  }

  /**
   * Get Expo push token for remote notifications
   */
  private async getExpoPushToken(): Promise<string | null> {
    try {
      if (!this.permissionStatus?.granted) {
        console.warn('Cannot get push token without permissions');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo push token:', token);
      return token;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    const channels = [
      {
        id: 'delay_alerts',
        name: '지연 알림',
        importance: Notifications.AndroidImportance.HIGH,
        description: '지하철 지연 및 운행 중단 알림',
        sound: 'default',
        vibrate: [0, 250, 250, 250],
      },
      {
        id: 'emergency_alerts',
        name: '긴급 알림',
        importance: Notifications.AndroidImportance.MAX,
        description: '긴급 상황 및 서비스 중단 알림',
        sound: 'default',
        vibrate: [0, 500, 200, 500],
      },
      {
        id: 'general_notifications',
        name: '일반 알림',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: '일반적인 앱 알림',
        sound: 'default',
        vibrate: [0, 250],
      },
    ];

    for (const channel of channels) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        description: channel.description,
        sound: channel.sound,
        vibrationPattern: channel.vibrate,
        lightColor: '#2563eb',
      });
    }
  }

  /**
   * Send local notification
   */
  async sendLocalNotification(payload: NotificationPayload): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        console.warn('Notification service not initialized');
        return null;
      }

      if (!this.permissionStatus?.granted) {
        console.warn('No notification permissions');
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          priority: this.convertPriority(payload.priority),
          sound: 'default',
          badge: 0,
        },
        trigger: null, // Send immediately
      });

      return identifier;
    } catch (error) {
      console.error('Error sending local notification:', error);
      return null;
    }
  }

  /**
   * Send delay alert notification
   */
  async sendDelayAlert(
    stationName: string,
    lineName: string,
    delayMinutes: number,
    reason?: string
  ): Promise<string | null> {
    const payload: NotificationPayload = {
      type: NotificationType.DELAY_ALERT,
      title: `🚇 ${lineName} 지연 알림`,
      body: `${stationName}역에서 ${delayMinutes}분 지연이 발생했습니다.${reason ? ` 사유: ${reason}` : ''}`,
      priority: 'high',
      channelId: 'delay_alerts',
      data: {
        stationName,
        lineName,
        delayMinutes,
        reason,
        timestamp: new Date().toISOString(),
      }
    };

    return this.sendLocalNotification(payload);
  }

  /**
   * Send emergency alert notification
   */
  async sendEmergencyAlert(
    title: string,
    message: string,
    affectedLines: string[]
  ): Promise<string | null> {
    const payload: NotificationPayload = {
      type: NotificationType.EMERGENCY_ALERT,
      title: `🚨 ${title}`,
      body: message,
      priority: 'high',
      channelId: 'emergency_alerts',
      data: {
        affectedLines,
        timestamp: new Date().toISOString(),
      }
    };

    return this.sendLocalNotification(payload);
  }

  /**
   * Send arrival reminder notification
   */
  async sendArrivalReminder(
    stationName: string,
    lineName: string,
    arrivalMinutes: number
  ): Promise<string | null> {
    if (arrivalMinutes > 5) return null; // Only send for imminent arrivals

    const payload: NotificationPayload = {
      type: NotificationType.ARRIVAL_REMINDER,
      title: `🚇 ${lineName} 도착 안내`,
      body: `${stationName}역에 ${arrivalMinutes}분 후 도착합니다.`,
      priority: 'normal',
      channelId: 'general_notifications',
      data: {
        stationName,
        lineName,
        arrivalMinutes,
        timestamp: new Date().toISOString(),
      }
    };

    return this.sendLocalNotification(payload);
  }

  /**
   * Schedule commute reminder notification
   */
  async scheduleCommuteReminder(
    title: string,
    body: string,
    scheduledTime: Date
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: NotificationType.COMMUTE_REMINDER },
          sound: 'default',
        },
        trigger: {
          date: scheduledTime,
          repeats: true,
        },
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling commute reminder:', error);
      return null;
    }
  }

  /**
   * Cancel notification by identifier
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Check if notifications should be sent based on user settings
   */
  shouldSendNotification(
    settings: NotificationSettings,
    type: NotificationType,
    currentTime: Date = new Date()
  ): boolean {
    if (!settings.enabled || !this.permissionStatus?.granted) {
      return false;
    }

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const [startHour = 0, startMinute = 0] = settings.quietHours.startTime
        .split(':')
        .map(Number);
      const [endHour = 0, endMinute = 0] = settings.quietHours.endTime
        .split(':')
        .map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours
      if (startTimeMinutes > endTimeMinutes) {
        if (currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes) {
          return false;
        }
      } else {
        if (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes) {
          return false;
        }
      }
    }

    // Check weekdays only setting
    if (settings.weekdaysOnly) {
      const dayOfWeek = currentTime.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        return false;
      }
    }

    // Per-event override gates (Wanted handoff "이벤트별" toggles). These let
    // users silence specific event categories without flipping alertTypes
    // globally. Mappings:
    //   - ARRIVAL_REMINDER ↔ perEventSound.trainArrival (열차 도착)
    //   - DELAY_ALERT      ↔ perEventSound.delayDetected (지연 발생)
    // perEventSound.communityReport has no NotificationType yet (community
    // reports do not flow through this service); reserved for a future
    // notification path.
    if (settings.perEventSound) {
      if (type === NotificationType.ARRIVAL_REMINDER && !settings.perEventSound.trainArrival) {
        return false;
      }
      if (type === NotificationType.DELAY_ALERT && !settings.perEventSound.delayDetected) {
        return false;
      }
    }

    // Check specific alert type settings
    switch (type) {
      case NotificationType.DELAY_ALERT:
        return settings.alertTypes.delays;
      case NotificationType.EMERGENCY_ALERT:
        return settings.alertTypes.suspensions;
      case NotificationType.SERVICE_UPDATE:
        return settings.alertTypes.serviceUpdates;
      default:
        return true;
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Get permission status
   */
  getPermissionStatus(): Notifications.PermissionResponse | null {
    return this.permissionStatus;
  }

  /**
   * Convert priority to Expo priority
   */
  private convertPriority(priority?: string): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'high':
        return Notifications.AndroidNotificationPriority.HIGH;
      case 'low':
        return Notifications.AndroidNotificationPriority.LOW;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  /**
   * Add notification listener
   */
  addNotificationListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export type { NotificationPayload };
