# Notification System - Code Examples

## useNotifications Hook

```typescript
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface UseNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const useNotifications = (): UseNotificationsReturn => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  const requestPermission = async (): Promise<boolean> => {
    if (!Device.isDevice) {
      setError('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      setError('Notification permission denied');
      return false;
    }

    return true;
  };

  const registerForPushNotifications = async (): Promise<string | null> => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066CC',
      });
    }

    return token.data;
  };

  useEffect(() => {
    registerForPushNotifications().then(setExpoPushToken);

    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => setNotification(notification)
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken, notification, error, requestPermission };
};
```

---

## Android Notification Channels

```typescript
const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  // Arrival alerts
  await Notifications.setNotificationChannelAsync('arrivals', {
    name: 'Train Arrivals',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0066CC',
    sound: 'arrival_sound.wav',
  });

  // Service disruptions
  await Notifications.setNotificationChannelAsync('disruptions', {
    name: 'Service Disruptions',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#FF0000',
    sound: 'alert_sound.wav',
  });

  // General updates
  await Notifications.setNotificationChannelAsync('updates', {
    name: 'General Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#0066CC',
  });
};
```

---

## User Preferences Management

```typescript
interface NotificationPreferences {
  enabled: boolean;
  arrivalAlerts: boolean;
  serviceDisruptions: boolean;
  reminderMinutes: number;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
  };
}

const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const stored = await AsyncStorage.getItem('notification_preferences');

  if (stored) {
    return JSON.parse(stored);
  }

  return {
    enabled: true,
    arrivalAlerts: true,
    serviceDisruptions: true,
    reminderMinutes: 5,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
    },
  };
};

const isQuietHours = (prefs: NotificationPreferences): boolean => {
  if (!prefs.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const { start, end } = prefs.quietHours;

  // Handle overnight quiet hours
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
};
```

---

## ArrivalNotificationManager

```typescript
class ArrivalNotificationManager {
  private scheduledNotifications = new Map<string, string>();

  async monitorStation(stationId: string, stationName: string): Promise<void> {
    const prefs = await getNotificationPreferences();

    if (!prefs.enabled || !prefs.arrivalAlerts || isQuietHours(prefs)) {
      return;
    }

    const unsubscribe = dataManager.subscribe(stationId, async (trains) => {
      const nextTrain = trains.find(train => train.arrivalTime > Date.now());
      if (!nextTrain) return;

      const minutesUntilArrival = Math.floor(
        (nextTrain.arrivalTime - Date.now()) / 60000
      );

      if (minutesUntilArrival <= prefs.reminderMinutes) {
        await this.scheduleArrivalAlert(stationId, stationName, minutesUntilArrival);
      }
    });
  }

  private async scheduleArrivalAlert(
    stationId: string,
    stationName: string,
    minutes: number
  ): Promise<void> {
    const existingId = this.scheduledNotifications.get(stationId);
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Train Arriving Soon!`,
        body: `Your train to ${stationName} arrives in ${minutes} minutes`,
        data: { stationName, minutes },
        sound: true,
      },
      trigger: { seconds: (minutes - 2) * 60 },
    });

    this.scheduledNotifications.set(stationId, notificationId);
  }

  async stopMonitoring(stationId: string): Promise<void> {
    const notificationId = this.scheduledNotifications.get(stationId);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      this.scheduledNotifications.delete(stationId);
    }
  }
}

export const arrivalNotificationManager = new ArrivalNotificationManager();
```

---

## Badge Management

```typescript
const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

const clearBadge = async (): Promise<void> => {
  await Notifications.setBadgeCountAsync(0);
};

const incrementBadge = async (): Promise<void> => {
  const current = await Notifications.getBadgeCountAsync();
  await Notifications.setBadgeCountAsync(current + 1);
};
```

---

## Testing

```typescript
const testNotification = async (): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test notification from LiveMetro',
      data: { test: true },
    },
    trigger: { seconds: 2 },
  });
};

// Mock for tests
const mockNotification: Notifications.Notification = {
  request: {
    identifier: 'test-notification',
    content: {
      title: 'Test Train Arrival',
      body: 'Your train arrives in 3 minutes',
      data: { stationId: '123' },
    },
    trigger: null,
  },
  date: Date.now(),
};
```

---

## Service Disruption Alerts

```typescript
interface ServiceDisruption {
  lineId: string;
  lineName: string;
  type: 'delay' | 'suspension' | 'emergency';
  message: string;
  startTime: Date;
  estimatedEndTime?: Date;
}

class DisruptionNotificationManager {
  private sentDisruptions = new Set<string>();

  async notifyDisruption(disruption: ServiceDisruption): Promise<void> {
    const prefs = await getNotificationPreferences();

    if (!prefs.enabled || !prefs.serviceDisruptions || isQuietHours(prefs)) {
      return;
    }

    // Prevent duplicate notifications
    const disruptionKey = `${disruption.lineId}-${disruption.type}-${disruption.startTime.getTime()}`;
    if (this.sentDisruptions.has(disruptionKey)) {
      return;
    }

    const severity = this.getSeverityEmoji(disruption.type);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${severity} ${disruption.lineName} Service Alert`,
        body: disruption.message,
        data: {
          type: 'disruption',
          lineId: disruption.lineId,
          disruptionType: disruption.type,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Immediate
    });

    this.sentDisruptions.add(disruptionKey);

    // Clean up old keys after 1 hour
    setTimeout(() => {
      this.sentDisruptions.delete(disruptionKey);
    }, 3600000);
  }

  private getSeverityEmoji(type: ServiceDisruption['type']): string {
    switch (type) {
      case 'emergency': return '🚨';
      case 'suspension': return '⚠️';
      case 'delay': return '⏰';
      default: return 'ℹ️';
    }
  }
}

export const disruptionNotificationManager = new DisruptionNotificationManager();
```

---

## Commute Reminder System

```typescript
interface CommuteSchedule {
  type: 'morning' | 'evening';
  departureTime: string; // "08:30"
  stationId: string;
  stationName: string;
  enabled: boolean;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ...
}

class CommuteReminderManager {
  async scheduleCommuteReminders(schedules: CommuteSchedule[]): Promise<void> {
    // Cancel all existing commute reminders first
    await this.cancelAllCommuteReminders();

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      for (const dayOfWeek of schedule.daysOfWeek) {
        await this.scheduleWeeklyReminder(schedule, dayOfWeek);
      }
    }
  }

  private async scheduleWeeklyReminder(
    schedule: CommuteSchedule,
    dayOfWeek: number
  ): Promise<void> {
    const [hours, minutes] = schedule.departureTime.split(':').map(Number);

    // Schedule 10 minutes before departure
    const reminderMinutes = minutes - 10;
    const reminderHours = reminderMinutes < 0 ? hours - 1 : hours;
    const adjustedMinutes = reminderMinutes < 0 ? reminderMinutes + 60 : reminderMinutes;

    const identifier = `commute-${schedule.type}-${dayOfWeek}`;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: schedule.type === 'morning' ? '🌅 Time to Leave!' : '🌆 Heading Home?',
        body: `Check train times for ${schedule.stationName}`,
        data: {
          type: 'commute_reminder',
          stationId: schedule.stationId,
          commuteType: schedule.type,
        },
        sound: true,
      },
      trigger: {
        weekday: dayOfWeek + 1, // Expo uses 1-7 (Sunday=1)
        hour: reminderHours,
        minute: adjustedMinutes,
        repeats: true,
      },
    });
  }

  async cancelAllCommuteReminders(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduled) {
      if (notification.identifier.startsWith('commute-')) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }
}

export const commuteReminderManager = new CommuteReminderManager();
```

---

## Notification Tap Handler

```typescript
const handleNotificationTap = (data: Record<string, unknown>): void => {
  const type = data.type as string;

  switch (type) {
    case 'arrival_alert':
      // Navigate to station detail
      navigationRef.navigate('StationDetail', {
        stationId: data.stationId as string,
      });
      break;

    case 'disruption':
      // Navigate to alerts screen with filter
      navigationRef.navigate('Alerts', {
        filterLine: data.lineId as string,
      });
      break;

    case 'commute_reminder':
      // Navigate to home with station pre-selected
      navigationRef.navigate('Home', {
        selectedStation: data.stationId as string,
      });
      break;

    default:
      // Default: go to home
      navigationRef.navigate('Home');
  }
};
```

---

## Jest Mocks

```typescript
// __tests__/setup.ts
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  getBadgeCountAsync: jest.fn().mockResolvedValue(0),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
  AndroidNotificationPriority: {
    DEFAULT: 0,
    HIGH: 1,
  },
}));
```
