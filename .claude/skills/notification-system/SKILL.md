---
name: notification-system
description: Push notification system using Expo Notifications for train arrival alerts and service disruption notifications. Use when implementing notification features.
---

# Notification System Guidelines

## When to Use This Skill
- Setting up push notifications
- Scheduling arrival alerts
- Handling notification permissions
- Responding to notification taps
- Managing notification preferences

## Core Setup

### 1. Installation
```bash
npx expo install expo-notifications expo-device expo-constants
```

### 2. Configuration (app.json)
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#0066CC",
      "iosDisplayInForeground": true,
      "androidMode": "default",
      "androidCollapsedTitle": "#{unread_notifications} new notifications"
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "useNextNotificationsApi": true,
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

## Permission Handling

### useNotifications Hook Pattern
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
    try {
      // Only works on physical devices
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
    } catch (err) {
      setError('Failed to request notification permission');
      return false;
    }
  };

  const registerForPushNotifications = async (): Promise<string | null> => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        return null;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      // Android specific: Set notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0066CC',
        });
      }

      return token.data;
    } catch (err) {
      setError('Failed to get push token');
      return null;
    }
  };

  useEffect(() => {
    registerForPushNotifications().then(setExpoPushToken);

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        setNotification(notification);
      }
    );

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        // Handle notification tap (navigate to screen, etc.)
        handleNotificationTap(data);
      }
    );

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    error,
    requestPermission,
  };
};

const handleNotificationTap = (data: Record<string, any>): void => {
  // Navigate based on notification data
  if (data.stationId) {
    // Navigate to station detail screen
  }
};
```

## Scheduling Notifications

### Local Notifications
```typescript
// Schedule a notification
const scheduleArrivalNotification = async (
  stationName: string,
  arrivalTime: number // minutes
): Promise<string> => {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Train Arriving Soon! 🚇`,
      body: `Your train to ${stationName} arrives in ${arrivalTime} minutes`,
      data: { stationName, arrivalTime },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      seconds: (arrivalTime - 2) * 60, // Notify 2 minutes before
    },
  });

  return notificationId;
};

// Cancel a scheduled notification
const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

// Cancel all scheduled notifications
const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// Get all scheduled notifications
const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  return await Notifications.getAllScheduledNotificationsAsync();
};
```

### Immediate Notifications
```typescript
const sendImmediateNotification = async (
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string> => {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Send immediately
  });
};

// Example: Service disruption alert
const notifyServiceDisruption = async (lineName: string, message: string): Promise<void> => {
  await sendImmediateNotification(
    `⚠️ Service Disruption - ${lineName}`,
    message,
    { type: 'service_disruption', lineName }
  );
};
```

## Notification Categories

### Android Channels
```typescript
// Create notification channels for different types
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

## User Preferences

### Notification Settings Management
```typescript
interface NotificationPreferences {
  enabled: boolean;
  arrivalAlerts: boolean;
  serviceDisruptions: boolean;
  reminderMinutes: number; // How many minutes before arrival to notify
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
  };
}

const saveNotificationPreferences = async (
  prefs: NotificationPreferences
): Promise<void> => {
  await AsyncStorage.setItem(
    'notification_preferences',
    JSON.stringify(prefs)
  );
};

const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const stored = await AsyncStorage.getItem('notification_preferences');

  if (stored) {
    return JSON.parse(stored);
  }

  // Default preferences
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

// Check if current time is in quiet hours
const isQuietHours = (prefs: NotificationPreferences): boolean => {
  if (!prefs.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

  const { start, end } = prefs.quietHours;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
};
```

## Smart Notification Logic

### Train Arrival Monitoring
```typescript
class ArrivalNotificationManager {
  private scheduledNotifications = new Map<string, string>(); // stationId -> notificationId

  async monitorStation(
    stationId: string,
    stationName: string
  ): Promise<void> {
    const prefs = await getNotificationPreferences();

    if (!prefs.enabled || !prefs.arrivalAlerts) {
      return;
    }

    if (isQuietHours(prefs)) {
      return;
    }

    // Subscribe to real-time train data
    const unsubscribe = dataManager.subscribe(stationId, async (trains) => {
      // Find next arriving train
      const nextTrain = trains.find(train =>
        train.arrivalTime > Date.now()
      );

      if (!nextTrain) return;

      const minutesUntilArrival = Math.floor(
        (nextTrain.arrivalTime - Date.now()) / 60000
      );

      // Schedule notification if within reminder window
      if (minutesUntilArrival <= prefs.reminderMinutes) {
        await this.scheduleArrivalAlert(
          stationId,
          stationName,
          minutesUntilArrival
        );
      }
    });

    // Store unsubscribe function for cleanup
  }

  private async scheduleArrivalAlert(
    stationId: string,
    stationName: string,
    minutes: number
  ): Promise<void> {
    // Cancel existing notification for this station
    const existingId = this.scheduledNotifications.get(stationId);
    if (existingId) {
      await cancelNotification(existingId);
    }

    // Schedule new notification
    const notificationId = await scheduleArrivalNotification(
      stationName,
      minutes
    );

    this.scheduledNotifications.set(stationId, notificationId);
  }

  async stopMonitoring(stationId: string): Promise<void> {
    const notificationId = this.scheduledNotifications.get(stationId);
    if (notificationId) {
      await cancelNotification(notificationId);
      this.scheduledNotifications.delete(stationId);
    }
  }
}

export const arrivalNotificationManager = new ArrivalNotificationManager();
```

## Badge Management

### Update App Icon Badge
```typescript
// Set badge count
const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

// Clear badge
const clearBadge = async (): Promise<void> => {
  await Notifications.setBadgeCountAsync(0);
};

// Increment badge
const incrementBadge = async (): Promise<void> => {
  const current = await Notifications.getBadgeCountAsync();
  await Notifications.setBadgeCountAsync(current + 1);
};
```

## Testing

### Test Notifications
```typescript
// Test notification delivery
const testNotification = async (): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test notification from LiveMetro',
      data: { test: true },
    },
    trigger: {
      seconds: 2,
    },
  });
};

// Mock notification for testing
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

## Error Handling

### Common Notification Errors
```typescript
const handleNotificationError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('device')) {
      return 'Notifications only work on physical devices';
    }
    if (error.message.includes('permission')) {
      return 'Notification permission is required';
    }
    if (error.message.includes('token')) {
      return 'Failed to register for push notifications';
    }
  }
  return 'Notification error occurred';
};
```

## Best Practices

### 1. Request Permission at Right Time
```tsx
// ❌ Bad: Request immediately on app launch
useEffect(() => {
  requestNotificationPermission();
}, []);

// ✅ Good: Request when user wants to enable alerts
const handleEnableAlerts = async () => {
  const hasPermission = await requestNotificationPermission();
  if (hasPermission) {
    // Enable arrival alerts
  }
};
```

### 2. Respect User Preferences
```typescript
// Always check preferences before sending
const shouldSendNotification = async (): Promise<boolean> => {
  const prefs = await getNotificationPreferences();
  return prefs.enabled && !isQuietHours(prefs);
};
```

### 3. Clean Up Scheduled Notifications
```typescript
// Cancel outdated notifications
const cleanupOldNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const now = Date.now();

  for (const notification of scheduled) {
    const trigger = notification.trigger as any;
    if (trigger.date && trigger.date < now) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }
};
```

## Important Notes
- Notifications only work on physical devices (not simulators/emulators)
- Always explain why you need notification permission
- Respect quiet hours and user preferences
- Clean up scheduled notifications when no longer needed
- Test notification tap handling thoroughly
- Use appropriate notification channels on Android
- Handle permission denial gracefully
- Monitor notification delivery rates in production
