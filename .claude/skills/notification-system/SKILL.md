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

> 왜 disruptions가 MAX인가: 장애(운행중단·중대지연)는 이 앱 사용자의 핵심 요구("장애 빠른 정보")다. arrivals(곧 도착)와 본문 규격·우선순위·묵음 정책이 다르다 — 아래 [Service Disruption Alerts](#service-disruption-alerts-정확성-규격) 참조. **happy-path 도착 알림만 만들고 끝내지 말 것.**

## Service Disruption Alerts (정확성 규격)

장애 알림은 이 도메인의 최저 성숙도이자 사용자 핵심 요구의 정중앙이다. 도착 알림과 **별개의 3가지 규칙**을 반드시 지킨다. 이 셋은 함께 동작한다 — 하나만 구현하면 모순된다.

### (a) quietHours vs 긴급 장애 — severity-gated override

**문제(실코드에 존재):** `notificationService.shouldSendNotification()`(`src/services/notification/notificationService.ts` L382~454)는 quietHours 안이면 타입 분기보다 **먼저** `return false`(L411~415) 한다. 그래서 `EMERGENCY_ALERT`(=`alertTypes.suspensions`)조차 무음 시간대에 통째로 누락된다. references의 `DisruptionNotificationManager`(notification-examples.md L329)도 동일하게 `isQuietHours(prefs)`로 장애를 일괄 묵음한다.

**규칙:** quietHours gate에 **심각도 기준 carve-out**을 둔다. "장애는 무조건 override"가 아니다 — 그러면 2분 지연으로 새벽 3시에 깨운다.

| 이벤트 | quietHours override? | 근거 |
|--------|---------------------|------|
| 운행중단/긴급 (`NotificationType.EMERGENCY_ALERT`) | **항상 override** (MAX) | 사용자가 지금 알아야 갈아탄다 |
| 중대지연 (`DELAY_ALERT` && `maxDelayMinutes >= 주요지연 임계`) | override | 통근 불가 수준만 |
| 경미지연 (`DELAY_ALERT` && 임계 미만) | **묵음 유지** | 새벽 스팸 방지 |
| 도착 알림 (`ARRIVAL_REMINDER`) | override 없음 | 묵음 그대로 |

```typescript
// quietHours 차단 직전, 심각도 예외를 먼저 통과시킨다.
const isMajorDisruption =
  type === NotificationType.EMERGENCY_ALERT ||
  (type === NotificationType.DELAY_ALERT &&
    maxDelayMinutes >= MAJOR_DELAY_THRESHOLD_MINUTES);

if (settings.quietHours.enabled && !isMajorDisruption) {
  // ... 기존 overnight 시간대 계산 후 return false
}
// isMajorDisruption이면 quietHours를 건너뛰고 (b)·(c) 게이트로 진행
```

`delayResponseAlertService.ts`는 이미 `MIN_DELAY_THRESHOLD_MINUTES`(L98)와 `maxDelayMinutes`(L447)로 지연 심각도를 판정한다. 같은 어휘를 재사용하고, override 임계는 그보다 높게(주요 지연) 잡는다.

### (b) 장애/지연 알림 본문 정확성 규격

도착 알림("곧 도착")과 달리, 장애 본문은 **행동 가능한 3요소**를 포함해야 한다. 현 실코드는 일부만 충족 — 강화 대상이다.

| 요소 | 필수 | 현황 |
|------|------|------|
| **영향 노선** | O | `sendDelayAlert`는 `lineName`, `sendEmergencyAlert`는 `affectedLines`를 `data`에만 둠 — 본문 문장에 노출 필요 |
| **지연 분(分)** | O | `sendDelayAlert` body에 `${delayMinutes}분 지연` 있음. `EMERGENCY_ALERT`는 누락 |
| **'대체경로' CTA** | O | **현재 어느 본문에도 없음** — 핵심 갭. 탭하면 대체경로로 이동하는 CTA를 본문/`data.type='disruption'`에 추가 |

```typescript
// 도착(happy-path): body = `${stationName}역에 ${n}분 후 도착합니다.` — CTA 없음
// 장애: 영향 노선 + 지연 분 + 대체경로 CTA를 모두 담는다
body: `${affectedLines.join('·')} ${maxDelayMinutes}분 지연. 대체경로를 확인하세요.`,
data: { type: 'disruption', lineId, affectedLines, action: 'showAlternativeRoute' },
```

탭 핸들러는 이미 `case 'disruption'`(notification-examples.md L469)에서 Alerts 화면으로 보낸다 — CTA는 이 경로를 재사용한다.

### (c) 쿨다운/중복억제 — 실재 모듈로 강제

**중요:** references의 `sentDisruptions` Set은 **예시 전용**이다(notification-examples.md L324, src에 미존재). 실제 출하 패턴은 아래 모듈들이다. override가 quietHours를 건너뛰더라도 dedup·쿨다운은 **여전히 적용된다** — 안 그러면 장애 진행 내내 매 폴링마다 스팸이 된다.

| 모듈 (`src/services/notification/`) | 패턴 | 위치 |
|------|------|------|
| `trainArrivalAlertService.ts` | `alertsSent: Set<string>` 복합키 `${alertId}_${trainNumber}_${arrivalTime}` dedup | L64, L362~368 |
| `currentStationAlertService.ts` | `notificationHistory: Map<string, number>` + `cooldownMinutes:30` | L57, L213~217 |
| `delayResponseAlertService.ts` | `session.lastAlert` + `ALERT_COOLDOWN_MINUTES=30` 시간차 게이트 | L72, L434~440 |

> `notificationOptimizer.ts`는 쿨다운이 **아니다** — lead-time/dismiss-rate **학습** 서비스다. 중복억제를 여기서 찾지 말 것.

```typescript
// 장애 dedup: 복합키 Set (trainArrivalAlertService.alertsSent 패턴)
const key = `${lineId}_${disruptionType}_${startTime}`;
if (this.sentKeys.has(key)) return;      // 이미 보냄 → skip
// ... override·본문 작성 후 발송 ...
this.sentKeys.add(key);
setTimeout(() => this.sentKeys.delete(key), 30 * 60 * 1000); // 30분 쿨다운
```

**조합 순서:** severity override (a) → dedup/cooldown 통과 (c) → 정확한 본문 (b) → 발송. override는 quietHours만 우회하고, dedup·cooldown은 그대로 통과해야 한다.

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
   - **예외**: 긴급 장애(운행중단·중대지연)는 quietHours를 override 한다 — [(a) severity-gated override](#a-quiethours-vs-긴급-장애--severity-gated-override). 경미 지연·도착 알림은 묵음 유지

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
- DisruptionNotificationManager (예시 — `sentDisruptions` Set은 예시 전용, 실 모듈은 위 [(c)](#c-쿨다운중복억제--실재-모듈로-강제) 참조)
- Badge management
- Testing examples
