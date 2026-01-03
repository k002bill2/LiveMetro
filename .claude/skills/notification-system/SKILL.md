---
name: notification-system
description: Push notification system using Expo Notifications for train arrival alerts and service disruption notifications. Use when implementing notification features.
---

# Notification System Guidelines

## When to Use
- Setting up push notifications
- Scheduling arrival alerts
- Handling notification permissions
- Managing notification preferences

## Setup

### Installation
```bash
npx expo install expo-notifications expo-device expo-constants
```

### Configuration (app.json)
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#0066CC",
      "iosDisplayInForeground": true
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "useNextNotificationsApi": true
    }
  }
}
```

## Core Patterns

### Configure Handler
```typescript
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Request Permission
```typescript
const requestPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false; // Only physical devices

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};
```

### Schedule Notification
```typescript
const scheduleArrivalNotification = async (
  stationName: string,
  arrivalTime: number
): Promise<string> => {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: `Train Arriving Soon!`,
      body: `Your train to ${stationName} arrives in ${arrivalTime} minutes`,
      data: { stationName, arrivalTime },
      sound: true,
    },
    trigger: { seconds: (arrivalTime - 2) * 60 },
  });
};
```

### Cancel Notification
```typescript
await Notifications.cancelScheduledNotificationAsync(notificationId);
await Notifications.cancelAllScheduledNotificationsAsync();
```

### Send Immediate
```typescript
await Notifications.scheduleNotificationAsync({
  content: { title, body, data },
  trigger: null, // Send immediately
});
```

## Notification Categories

| Category | Android Importance | Use Case |
|----------|-------------------|----------|
| `arrivals` | HIGH | Train arrival alerts |
| `disruptions` | MAX | Service disruptions |
| `updates` | DEFAULT | General updates |

## User Preferences Pattern

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
```

## Best Practices

1. **Request Permission at Right Time**
   ```tsx
   // ❌ Bad: On app launch
   // ✅ Good: When user enables alerts
   const handleEnableAlerts = async () => {
     const hasPermission = await requestPermission();
     if (hasPermission) { /* enable */ }
   };
   ```

2. **Respect User Preferences**
   - Check `enabled` and `quietHours` before sending
   - Allow granular control (arrivals vs disruptions)

3. **Clean Up Old Notifications**
   - Cancel outdated scheduled notifications
   - Clear badge when app opens

4. **Handle Notification Taps**
   - Parse `data` from notification
   - Navigate to relevant screen

## Error Handling

```typescript
const handleNotificationError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('device')) {
      return 'Notifications only work on physical devices';
    }
    if (error.message.includes('permission')) {
      return 'Notification permission is required';
    }
  }
  return 'Notification error occurred';
};
```

## Important Notes

- Notifications only work on physical devices (not simulators)
- Always clean up listeners in useEffect return
- Use appropriate channels on Android
- Test notification tap handling thoroughly
- Monitor delivery rates in production

## Reference Documentation

For complete implementations, see [references/notification-examples.md](references/notification-examples.md):
- useNotifications hook
- Android notification channels
- User preferences management
- ArrivalNotificationManager class
- Badge management
- Testing examples
