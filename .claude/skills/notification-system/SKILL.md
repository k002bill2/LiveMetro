---
name: notification-system
description: Push notification management, scheduling, and user preferences for LiveMetro subway alerts. Use when implementing notification features.
---

# Notification System Guidelines

## Architecture

LiveMetro notification system integrates Expo Notifications with Firebase Cloud Messaging:

```
Seoul API Delay Detection → NotificationService → Expo Notifications → User Device
                                  ↓
                           User Preferences
                           Schedule Management
```

## Core Service (src/services/notification/notificationService.ts)

### 1. Service Initialization

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notifications and get push token
   */
  async initialize(): Promise<string | null> {
    // Check if physical device
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    try {
      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id',
      });

      this.expoPushToken = token.data;

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Notification initialization error:', error);
      return null;
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('delays', {
      name: '지연 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF0000',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('arrivals', {
      name: '도착 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
      name: '일반 알림',
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }
}

export const notificationService = NotificationService.getInstance();
```

### 2. Send Local Notifications

```typescript
/**
 * Send delay alert notification
 */
async sendDelayAlert(
  stationName: string,
  lineName: string,
  delayMinutes: number,
  reason?: string
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 지하철 지연 알림',
        body: `${stationName} ${lineName} ${delayMinutes}분 지연${
          reason ? `\n사유: ${reason}` : ''
        }`,
        data: {
          type: 'delay',
          stationName,
          lineName,
          delayMinutes,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'delays',
      },
      trigger: null, // Send immediately
    });

    return notificationId;
  } catch (error) {
    console.error('Error sending delay alert:', error);
    return null;
  }
}

/**
 * Send arrival notification
 */
async sendArrivalNotification(
  stationName: string,
  lineName: string,
  arrivalMinutes: number
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚇 열차 도착 예정',
        body: `${stationName} ${lineName} ${arrivalMinutes}분 후 도착 예정`,
        data: {
          type: 'arrival',
          stationName,
          lineName,
          arrivalMinutes,
        },
        sound: true,
        categoryIdentifier: 'arrivals',
      },
      trigger: null,
    });

    return notificationId;
  } catch (error) {
    console.error('Error sending arrival notification:', error);
    return null;
  }
}

/**
 * Schedule notification for specific time
 */
async scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, any>
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel specific notification
 */
async cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
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
```

### 3. Notification Preferences Management

```typescript
/**
 * User notification preferences
 */
export interface NotificationPreferences {
  enabled: boolean;
  delayAlerts: boolean;
  arrivalAlerts: boolean;
  serviceDisruptions: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string;
  favoriteStationsOnly: boolean;
  minDelayMinutes: number; // Minimum delay to trigger alert
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  delayAlerts: true,
  arrivalAlerts: true,
  serviceDisruptions: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  favoriteStationsOnly: false,
  minDelayMinutes: 5,
};

/**
 * Check if notification should be sent based on preferences
 */
async shouldSendNotification(
  type: 'delay' | 'arrival' | 'disruption',
  preferences: NotificationPreferences
): Promise<boolean> {
  // Check if notifications enabled
  if (!preferences.enabled) {
    return false;
  }

  // Check notification type
  switch (type) {
    case 'delay':
      if (!preferences.delayAlerts) return false;
      break;
    case 'arrival':
      if (!preferences.arrivalAlerts) return false;
      break;
    case 'disruption':
      if (!preferences.serviceDisruptions) return false;
      break;
  }

  // Check quiet hours
  if (preferences.quietHoursEnabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    if (
      currentTime >= preferences.quietHoursStart ||
      currentTime <= preferences.quietHoursEnd
    ) {
      return false;
    }
  }

  return true;
}
```

## Custom Hook Pattern (src/hooks/useNotifications.ts)

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@services/notification/notificationService';

interface UseNotificationsReturn {
  pushToken: string | null;
  notification: Notifications.Notification | null;
  sendDelayAlert: (
    stationName: string,
    lineName: string,
    delayMinutes: number
  ) => Promise<void>;
  sendArrivalAlert: (
    stationName: string,
    lineName: string,
    minutes: number
  ) => Promise<void>;
}

/**
 * Hook for managing notifications
 */
export const useNotifications = (): UseNotificationsReturn => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  useEffect(() => {
    // Initialize notification service
    notificationService.initialize().then(setPushToken);

    // Listen for notifications
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const sendDelayAlert = useCallback(
    async (stationName: string, lineName: string, delayMinutes: number) => {
      await notificationService.sendDelayAlert(
        stationName,
        lineName,
        delayMinutes
      );
    },
    []
  );

  const sendArrivalAlert = useCallback(
    async (stationName: string, lineName: string, minutes: number) => {
      await notificationService.sendArrivalNotification(
        stationName,
        lineName,
        minutes
      );
    },
    []
  );

  return {
    pushToken,
    notification,
    sendDelayAlert,
    sendArrivalAlert,
  };
};
```

## Notification Response Handling

```typescript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

/**
 * Hook for handling notification taps
 */
export const useNotificationResponse = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { type, stationName, lineName } = response.notification.request.content.data;

        // Navigate based on notification type
        switch (type) {
          case 'delay':
          case 'arrival':
            navigation.navigate('StationDetail', {
              stationName,
              lineName,
            });
            break;

          case 'disruption':
            navigation.navigate('ServiceStatus');
            break;

          default:
            navigation.navigate('Home');
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [navigation]);
};
```

## Background Notifications (Cloud Functions)

```typescript
// functions/src/notifications.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Send push notification to users subscribed to a station
 */
export const sendDelayNotification = functions.firestore
  .document('delays/{delayId}')
  .onCreate(async (snapshot, context) => {
    const delay = snapshot.data();
    const { stationName, lineName, minutes, reason } = delay;

    // Get users subscribed to this station
    const usersSnapshot = await admin
      .firestore()
      .collection('users')
      .where('favoriteStations', 'array-contains', stationName)
      .get();

    const messages: ExpoPushMessage[] = [];

    usersSnapshot.docs.forEach((doc) => {
      const user = doc.data();
      if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
        return;
      }

      messages.push({
        to: user.pushToken,
        sound: 'default',
        title: '🚨 지하철 지연 알림',
        body: `${stationName} ${lineName} ${minutes}분 지연${
          reason ? `\n사유: ${reason}` : ''
        }`,
        data: {
          type: 'delay',
          stationName,
          lineName,
          minutes,
        },
      });
    });

    // Send notifications in batches
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }
  });
```

## Permission Handling UI

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

export const NotificationSettings: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();

    if (status === 'granted') {
      Alert.alert('성공', '알림 권한이 허용되었습니다');
      setPermissionStatus(status);
    } else {
      Alert.alert(
        '알림 권한 필요',
        '지하철 지연 및 도착 정보를 받으려면 알림 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  };

  return (
    <View>
      <Text>알림 권한 상태: {permissionStatus}</Text>
      <Button title="권한 확인" onPress={checkPermissions} />
      {permissionStatus !== 'granted' && (
        <Button title="권한 요청" onPress={requestPermissions} />
      )}
    </View>
  );
};
```

## Testing Notifications

```typescript
import * as Notifications from 'expo-notifications';

/**
 * Test notification sending
 */
export const testNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { test: true },
    },
    trigger: { seconds: 1 },
  });
};

/**
 * Mock notification service for testing
 */
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('test-id')),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
}));
```

## Remember

- ✅ Always check permissions before sending notifications
- ✅ Use appropriate notification channels for Android
- ✅ Respect user preferences (quiet hours, types)
- ✅ Handle notification taps with deep linking
- ✅ Test on physical devices (emulators don't support push)
- ✅ Use Expo push token for server notifications
- ✅ Batch notifications to avoid rate limits
- ✅ Clear user messaging for permission requests
- ✅ Cancel scheduled notifications when no longer needed
- ✅ Store push tokens in Firebase for targeted notifications

## Additional Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Tool](https://expo.dev/notifications)
- [iOS Notification Guidelines](https://developer.apple.com/design/human-interface-guidelines/notifications)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
