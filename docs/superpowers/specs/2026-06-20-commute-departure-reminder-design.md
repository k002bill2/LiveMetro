# 출근 시각 자동 알림 (Commute Departure Reminder) — Design

- **Date**: 2026-06-20
- **Branch**: feat/guidance-transfer-soft-confirm (또는 별도 fix/feat 브랜치)
- **Status**: 설계 승인 대기
- **Scope tag**: B-(가) — 시각 기반 로컬 자동 출발 리마인더 (서버 불필요)

## 1. Problem

사용자는 "출근 시각에 자동으로 알림이 오고, 앱이 꺼져 있어도 알림이 오기"를 기대했다. 진단 결과
([[project_notification_firing_architecture_gaps]]):

- 출발 알림을 발사하는 유일한 경로(`departureAlertService.scheduleDepartureAlert`)는
  **사용자가 WeeklyPredictionScreen 버튼을 수동으로 1회 탭**해야만 동작하고, **ML 예측**
  (로그 ≥1건 + 신뢰도 ≥0.3)에 의존해 콜드스타트 시 예약조차 안 된다.
- `CommuteSettingsScreen`의 `alertEnabled`·`activeDays` 토글은 **저장만 되고 어떤 발사 경로도
  참조하지 않는 팬텀** 상태다.

→ "자동 시각 발동"이 구조적으로 존재하지 않는다.

## 2. Goal / Non-Goals

**Goal**: 출퇴근 설정의 **출근(morning) 출발시각**에, 사용자가 선택한 **요일마다**, 앱이
꺼져 있어도 OS가 발사하는 **로컬 알림**("지금 출발하세요")을 자동 예약한다. `CommuteSettings`의
기존 `alertEnabled` 토글로 on/off 한다.

**Non-Goals (YAGNI)**:
- ML 예측 보정 (설정 시각만 사용).
- 퇴근(evening) 리마인더 (이번 범위 밖 — 동일 패턴으로 후속 확장 가능).
- 실시간 동적 알림(지연/도착 임박) — 발사 조건을 미리 알 수 없어 서버 푸시/백그라운드 필요. 별도
  스코프 B-(나).
- 서버(FCM)·백그라운드 태스크 — 사용 안 함.

## 3. Key Decisions (확정)

| 결정 | 값 | 근거 |
|------|-----|------|
| 메커니즘 | 클라이언트 로컬 알림 (expo-notifications) | 시각을 미리 알 수 있음 → OS 예약이면 앱 닫혀도 발사. 서버 불필요 |
| 시각 소스 | 설정된 출발시각 (`commuteSettings.morningRoute.departureTime`) | 로그 0건이어도 항상 존재. ML 콜드스타트 회피 |
| 컨트롤 | 기존 `commuteSchedule.alertEnabled` 토글 배선 | 팬텀 토글 갭 동시 해결 + 명시적 on/off |
| 요일 | `commuteSchedule.activeDays` 존중, weekday 트리거 N건 | 일요일에 "출근하세요" 안 울림 |
| leadMinutes | 0 (정각) | "출발 시각 = 나서는 시각". 의미 가장 명확. 향후 설정화 여지 |

## 4. Architecture

### 4.1 신규: `src/services/notification/commuteReminderService.ts`

시각 기반 요일 출근 리마인더 전용 서비스 (ML 비결합, 단일 책임).

```
interface CommuteReminderConfig {
  departureTime: string;          // "HH:mm" (morning leg)
  activeDays: readonly boolean[]; // 7-element [Mon..Sun]
  leadMinutes?: number;           // default 0
}

interface ScheduledReminder {
  weekday: number;        // expo weekday 1=Sun..7=Sat
  notificationId: string;
  time: string;           // "HH:mm" (발사 시각 = departureTime - leadMinutes)
}
```

- `scheduleCommuteReminders(uid, config): Promise<ScheduledReminder[]>`
  1. 기존 예약 취소 (`cancelCommuteReminders(uid)` 먼저 호출 — 재예약 안전).
  2. 발사 시각 = `departureTime - leadMinutes` (자정 wrap 처리).
  3. `activeDays` 중 `true`인 index마다 expo weekday로 매핑 후
     `notificationService.scheduleWeeklyReminder(weekday, hour, minute, title, body)` 호출.
  4. 성공한 `ScheduledReminder[]`를 AsyncStorage(`@commute_reminders:<uid>`)에 저장하고 반환.
- `cancelCommuteReminders(uid): Promise<void>`
  - storage의 ID 전부 `notificationService.cancelNotification(id)` + storage 키 삭제.
- `getCommuteReminders(uid): Promise<ScheduledReminder[]>` — storage 조회.

### 4.2 신규 메서드: `notificationService.scheduleWeeklyReminder(...)`

알림 API를 한 곳에 응집 (기존 `scheduleCommuteReminder`(date 버전)·`scheduleArrivalAlert` 옆).

```
async scheduleWeeklyReminder(
  weekday: number, hour: number, minute: number, title: string, body: string
): Promise<string | null>
// Notifications.scheduleNotificationAsync({
//   content: { title, body, data: { type: COMMUTE_REMINDER }, sound: 'default' },
//   trigger: { weekday, hour, minute, repeats: true },  // WeeklyTriggerInput
// })
```

### 4.3 배선: `src/screens/settings/CommuteSettingsScreen.tsx`

이 화면이 오케스트레이션 지점 (이미 `route.departureTime` + `commuteSchedule.alertEnabled/activeDays`
둘 다 스코프에 보유 — 2-store 데이터 통합 지점).

- `alertEnabled` 토글 ON → `notificationService.requestPermissions()` → granted면
  `commuteReminderService.scheduleCommuteReminders(uid, {departureTime, activeDays})`.
  denied면 예약 안 함 + 토글 OFF 유지 + 안내 메시지.
- `alertEnabled` OFF → `commuteReminderService.cancelCommuteReminders(uid)`.
- `departureTime` 또는 `activeDays` 변경 저장 시 → `alertEnabled`면 cancel→schedule(재예약).

## 5. 요일 번호 매핑 (CRITICAL — correctness 핵심)

세 가지 표현이 충돌하므로 명시적 변환 함수로 격리한다.

| 표현 | 범위 | 비고 |
|------|------|------|
| `commuteSchedule.activeDays` | `boolean[7]`, **index 0=Mon..6=Sun** | user.ts:129 |
| 앱 `DayOfWeek` (models/pattern) | `0=Sun..6=Sat` | JS getDay |
| expo `WeeklyTriggerInput.weekday` | **1=Sun..7=Sat** | iOS Calendar |

변환 (activeDays index → expo weekday): `expoWeekday = (index + 1) % 7 + 1`
- Mon(idx0)→2, Tue→3, Wed→4, Thu→5, Fri→6, Sat(idx5)→7, Sun(idx6)→1.

이 변환은 순수 함수로 추출하고 **모든 7개 요일을 명시적으로 검증**하는 단위 테스트를 둔다.

## 6. Data Flow

```
[토글 ON]
 → requestPermissions()
   ├─ denied → 토글 OFF 유지 + 안내, 예약 없음
   └─ granted → scheduleCommuteReminders(uid, {departureTime(commuteSettings), activeDays(prefs)})
        → cancelCommuteReminders(uid)        // 멱등 재예약
        → 활성 요일마다 scheduleWeeklyReminder(expoWeekday, hour, minute, ...)
        → ScheduledReminder[] → AsyncStorage 저장
        → OS가 매주 해당 요일·시각 발사 (앱 닫혀도)

[토글 OFF / 설정 변경] → cancelCommuteReminders → (변경이면 재예약)
```

## 7. Error Handling

- 개별 요일 예약 실패 (`scheduleWeeklyReminder` → null) → 로깅 후 나머지 진행(부분 성공),
  storage엔 성공분만 기록.
- AsyncStorage 실패 → graceful 로깅. 다음 enable 시 안전망: `getAllScheduledNotificationsAsync`로
  `data.type === COMMUTE_REMINDER`인 잔여 예약을 정리 후 재예약 (ID 유실 대비 orphan 방지).
- 권한 denied → 예약 안 함 + 토글 OFF 유지 + 친화 안내(설정에서 알림 권한 필요).
- `departureTime` 누락/형식 오류 → 예약 스킵 + 로깅 (빈 배열 반환, throw 금지 — error-handling.md).

## 8. Testing (TDD, RED→GREEN)

### commuteReminderService 단위
- 요일 매핑 순수 함수: 월~일 7개 전부 expo weekday 검증 (Mon→2 … Sun→1).
- `scheduleCommuteReminders`: 활성 요일 수만큼 `scheduleWeeklyReminder` 호출 + storage 저장.
- 빈 `activeDays`(전부 false) → 예약 0건, storage 빈 배열.
- 재예약: schedule 호출 시 cancel이 **먼저** 실행 (cancel-before-schedule 순서).
- `cancelCommuteReminders`: 저장 ID 전부 cancel + storage 키 삭제.
- 자정 wrap: `departureTime`="00:05", leadMinutes=10 → 전날 23:55 + weekday-1 보정.
- 개별 예약 실패(null) → 부분 성공, storage엔 성공분만.
- AsyncStorage 영속: schedule 후 `getCommuteReminders`가 같은 결과 반환.

### CommuteSettings 배선
- 토글 ON + 권한 granted → schedule 호출.
- 토글 ON + 권한 denied → schedule 미호출 + 토글 OFF 유지.
- 토글 OFF → cancel 호출.
- `departureTime`/`activeDays` 변경(enabled) → 재예약(cancel→schedule).

Mock: `expo-notifications`(scheduleNotificationAsync/cancelScheduledNotificationAsync/
getAllScheduledNotificationsAsync), `@react-native-async-storage/async-storage`,
`notificationService`.

## 9. Files

| 파일 | 변경 |
|------|------|
| `src/services/notification/commuteReminderService.ts` | 신규 |
| `src/services/notification/notificationService.ts` | `scheduleWeeklyReminder` 메서드 추가 |
| `src/services/notification/index.ts` | export 추가 |
| `src/screens/settings/CommuteSettingsScreen.tsx` | 토글/설정변경 → schedule/cancel 배선 |
| `src/services/notification/__tests__/commuteReminderService.test.ts` | 신규 |
| `src/screens/settings/__tests__/CommuteSettingsScreen.test.tsx` | 배선 케이스 추가 |

→ 5-6 파일 (HARD-GATE 초과) → writing-plans로 단계 분해.

## 10. Risks

- **요일 번호 매핑 오류** → 엉뚱한 요일 발사. → 순수 함수 + 7요일 전수 테스트로 차단 (§5).
- **2-store 데이터** (departureTime ↔ activeDays 출처 분리) → 한쪽만 읽으면 stale.
  CommuteSettingsScreen에서 둘 다 읽어 통합 (§4.3).
- **Expo Go/시뮬레이터 검증 불가** → 로컬 예약 알림은 실기기/dev 빌드 필요. 사용자 현재 환경
  (Expo Go)에서는 미관측. **EAS/dev 빌드 실기기 검증이 수용 기준**. iOS 시뮬레이터는 로컬
  스케줄 알림 일부 발사하나 신뢰성 낮음.
- **weekday 트리거 Android 동작** → expo-notifications 0.20.1 `WeeklyTriggerInput` 타입 확인됨.
  Android 채널 필요 가능성 → 구현 시 채널 설정 확인.
- **alertEnabled 기본 true** (CommuteSettingsScreen:425) → 배선 후 departureTime 있는 사용자는
  화면 진입/저장 시 자동 예약될 수 있음. 예약은 명시적 토글/저장 액션에서만 발생하도록 게이트
  (마운트만으로 대량 예약 금지).

## 11. Success Criteria

- [ ] 토글 ON + 권한 → 활성 요일마다 weekly 로컬 알림 예약, AsyncStorage 영속.
- [ ] 토글 OFF / 설정 변경 → 정확히 취소/재예약 (orphan 0).
- [ ] 요일 매핑 7요일 전수 테스트 통과.
- [ ] 권한 denied → 예약 없음 + 토글 정직 반영.
- [ ] tsc 0 / lint / jest --coverage 통과.
- [ ] (수용) EAS/dev 빌드 실기기에서 선택 요일·시각 발사 확인.
