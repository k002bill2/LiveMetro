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
