# 출근 시각 자동 알림 (Commute Departure Reminder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출퇴근 설정의 출근 출발시각에, 선택한 요일마다 앱이 꺼져 있어도 OS가 발사하는 로컬 "출발 알림"을 자동 예약한다.

**Architecture:** 신규 `commuteReminderService`가 설정값(출발시각 + activeDays)을 받아 활성 요일마다 expo-notifications weekly 트리거 로컬 알림을 예약하고, 예약 ID를 AsyncStorage에 영속한다. `CommuteSettingsScreen`의 기존 `alertEnabled` 토글이 schedule/cancel을 호출한다. 서버·백그라운드 태스크 미사용.

**Tech Stack:** TypeScript(strict), expo-notifications ~0.20.1(`WeeklyTriggerInput`), `@react-native-async-storage/async-storage`(via `storageUtils`), Jest + React Native Testing Library.

설계 출처: `docs/superpowers/specs/2026-06-20-commute-departure-reminder-design.md`

## Global Constraints

- `any` 금지 → 구체 타입/`unknown`. exported 함수는 명시적 반환 타입. (typescript-strict.md)
- 서비스 함수는 에러 시 빈 배열/`null` 반환, throw 금지. console.error는 개발 로깅만 허용. (error-handling.md)
- path alias `@/` 필수, 상대경로 금지. (path-aliases.md)
- 불변성 — 새 객체 생성, mutation 금지. (coding-style)
- jest.mock factory는 inline 정의(호이스팅 함정), 외부 변수 참조 금지. partial mock 시 `...jest.requireActual()` 누락 주의.
- **leadMinutes 기본 0(정각)**. **출근(morning)만**. ML 보정·퇴근·서버푸시 범위 밖.
- **취소는 저장된 ID 기반만** — `NotificationType.COMMUTE_REMINDER` 타입 일괄 취소 금지(기존 ML 출발 알림이 같은 타입이라 오삭제됨).
- 요일 표현 3종: `activeDays` index 0=Mon..6=Sun / 앱 DayOfWeek 0=Sun / **expo weekday 1=Sun..7=Sat**.
- 검증 게이트: `npx tsc --noEmit` 0 / `npm run lint` / `npx jest <file> --watchman=false` (watchman 샌드박스 크래시 회피).
- 커밋 직전 `git branch --show-current`로 `feat/guidance-transfer-soft-confirm` 확인(공유 워킹트리 병렬 세션 hijack 방지). 커밋은 명시 파일만 stage(병렬 WIP `.claude/skills/*` 제외).

---

### Task 1: 요일·시각 매핑 순수 함수 (`computeWeeklyTrigger`)

`activeDays` index와 출발시각/lead를 expo weekly 트리거 입력으로 변환하는 순수 함수. 요일 번호 3종 충돌의 단일 격리 지점.

**Files:**
- Create: `src/services/notification/commuteReminderService.ts` (이 task에선 순수 함수 + 타입만)
- Test: `src/services/notification/__tests__/commuteReminderService.test.ts`

**Interfaces:**
- Produces:
  - `interface CommuteReminderConfig { departureTime: string; activeDays: readonly boolean[]; leadMinutes?: number }`
  - `interface ScheduledReminder { weekday: number; notificationId: string; time: string }`
  - `interface WeeklyTriggerSpec { weekday: number; hour: number; minute: number; time: string }`
  - `function computeWeeklyTrigger(departureTime: string, leadMinutes: number, activeDayIndex: number): WeeklyTriggerSpec | null`
    - `activeDayIndex` 0=Mon..6=Sun. 반환 `weekday`는 expo 1=Sun..7=Sat. 잘못된 입력(형식 오류)이면 `null`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/notification/__tests__/commuteReminderService.test.ts
import { computeWeeklyTrigger } from '../commuteReminderService';

describe('computeWeeklyTrigger', () => {
  // activeDays index 0=Mon..6=Sun  →  expo weekday 1=Sun..7=Sat
  it.each([
    [0, 2], // Mon
    [1, 3], // Tue
    [2, 4], // Wed
    [3, 5], // Thu
    [4, 6], // Fri
    [5, 7], // Sat
    [6, 1], // Sun
  ])('maps activeDay index %i to expo weekday %i', (index, expectedWeekday) => {
    const spec = computeWeeklyTrigger('08:15', 0, index);
    expect(spec).not.toBeNull();
    expect(spec?.weekday).toBe(expectedWeekday);
  });

  it('keeps hour/minute at departureTime when leadMinutes is 0', () => {
    const spec = computeWeeklyTrigger('08:15', 0, 0);
    expect(spec).toEqual({ weekday: 2, hour: 8, minute: 15, time: '08:15' });
  });

  it('subtracts leadMinutes within the same day', () => {
    const spec = computeWeeklyTrigger('08:15', 10, 0); // Mon 08:05
    expect(spec).toEqual({ weekday: 2, hour: 8, minute: 5, time: '08:05' });
  });

  it('wraps to previous day when lead crosses midnight', () => {
    // Mon 00:05, lead 10 → Sun 23:55 (weekday shifts Mon(2) → Sun(1))
    const spec = computeWeeklyTrigger('00:05', 10, 0);
    expect(spec).toEqual({ weekday: 1, hour: 23, minute: 55, time: '23:55' });
  });

  it('returns null on malformed departureTime', () => {
    expect(computeWeeklyTrigger('xx:yy', 0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: FAIL — "Cannot find module '../commuteReminderService'" 또는 "computeWeeklyTrigger is not a function".

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/services/notification/commuteReminderService.ts
export interface CommuteReminderConfig {
  readonly departureTime: string;          // "HH:mm" (morning leg)
  readonly activeDays: readonly boolean[]; // 7-element [Mon..Sun]
  readonly leadMinutes?: number;           // default 0
}

export interface ScheduledReminder {
  readonly weekday: number;       // expo 1=Sun..7=Sat
  readonly notificationId: string;
  readonly time: string;          // "HH:mm" fire time
}

export interface WeeklyTriggerSpec {
  readonly weekday: number;
  readonly hour: number;
  readonly minute: number;
  readonly time: string;
}

// activeDays index (0=Mon..6=Sun) → expo weekday (1=Sun..7=Sat)
const activeDayIndexToExpoWeekday = (index: number): number => ((index + 1) % 7) + 1;

// shift an expo weekday by whole days (negative = earlier), staying in 1..7
const shiftExpoWeekday = (weekday: number, dayOffset: number): number =>
  (((weekday - 1 + dayOffset) % 7) + 7) % 7 + 1;

export function computeWeeklyTrigger(
  departureTime: string,
  leadMinutes: number,
  activeDayIndex: number,
): WeeklyTriggerSpec | null {
  const parts = departureTime.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(h) || !Number.isInteger(m)) {
    return null;
  }

  const totalMinutes = h * 60 + m - leadMinutes;
  const dayOffset = Math.floor(totalMinutes / 1440); // -1 when wrapped before midnight
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const weekday = shiftExpoWeekday(activeDayIndexToExpoWeekday(activeDayIndex), dayOffset);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { weekday, hour, minute, time };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # MUST be feat/guidance-transfer-soft-confirm
git add src/services/notification/commuteReminderService.ts src/services/notification/__tests__/commuteReminderService.test.ts
git commit -m "feat(commute): 출근 리마인더 요일·시각 매핑 순수 함수 (computeWeeklyTrigger)"
```

---

### Task 2: `notificationService.scheduleWeeklyReminder`

weekly 트리거 로컬 알림 1건 예약. 알림 API를 notificationService에 응집.

**Files:**
- Modify: `src/services/notification/notificationService.ts` (`scheduleArrivalAlert` 메서드 뒤, 약 :355)
- Test: `src/services/notification/__tests__/notificationService.weeklyReminder.test.ts`

**Interfaces:**
- Consumes: `expo-notifications` `scheduleNotificationAsync`, `NotificationType.COMMUTE_REMINDER`.
- Produces: `notificationService.scheduleWeeklyReminder(weekday: number, hour: number, minute: number, title: string, body: string): Promise<string | null>`
  - 성공 시 notification identifier, 실패 시 `null`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/notification/__tests__/notificationService.weeklyReminder.test.ts
import * as Notifications from 'expo-notifications';
import { notificationService } from '../notificationService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

describe('notificationService.scheduleWeeklyReminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('schedules a weekly-trigger notification and returns the identifier', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('weekly-id-1');

    const id = await notificationService.scheduleWeeklyReminder(2, 8, 15, '출발 시간', '지금 출발하세요');

    expect(id).toBe('weekly-id-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: '출발 시간', body: '지금 출발하세요' }),
        trigger: { weekday: 2, hour: 8, minute: 15, repeats: true },
      }),
    );
  });

  it('returns null when scheduling throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(new Error('boom'));

    const id = await notificationService.scheduleWeeklyReminder(2, 8, 15, 't', 'b');

    expect(id).toBeNull();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/notification/__tests__/notificationService.weeklyReminder.test.ts --watchman=false`
Expected: FAIL — "scheduleWeeklyReminder is not a function".

- [ ] **Step 3: Write minimal implementation**

`src/services/notification/notificationService.ts`, `scheduleArrivalAlert` 메서드 닫는 `}` 직후(약 :355)에 추가:

```typescript
  /**
   * Schedule a repeating WEEKLY local notification at a given weekday/time.
   * weekday는 expo 규약(1=일..7=토). 출근 시각 자동 리마인더를 위해 사용.
   * Returns the identifier for later cancellation, or null on error.
   */
  async scheduleWeeklyReminder(
    weekday: number,
    hour: number,
    minute: number,
    title: string,
    body: string,
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: NotificationType.COMMUTE_REMINDER },
          sound: 'default',
        },
        trigger: { weekday, hour, minute, repeats: true },
      });
      return identifier;
    } catch (error) {
      console.error('Error scheduling weekly reminder:', error);
      return null;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/notification/__tests__/notificationService.weeklyReminder.test.ts --watchman=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # feat/guidance-transfer-soft-confirm
git add src/services/notification/notificationService.ts src/services/notification/__tests__/notificationService.weeklyReminder.test.ts
git commit -m "feat(notification): scheduleWeeklyReminder — weekly 트리거 로컬 알림"
```

---

### Task 3: `commuteReminderService` 취소·조회 (영속성)

저장된 예약 ID를 AsyncStorage(`storageUtils`)에서 읽고/지운다. schedule보다 먼저 만들어 cancel-before-schedule를 보장.

**Files:**
- Modify: `src/services/notification/commuteReminderService.ts` (Task 1 파일에 추가)
- Test: `src/services/notification/__tests__/commuteReminderService.test.ts` (Task 1 파일에 추가)

**Interfaces:**
- Consumes: `storageUtils.getItem/setItem/removeItem` (`@/utils/storageUtils`), `notificationService.cancelNotification`.
- Produces:
  - `commuteReminderService.getCommuteReminders(uid: string): Promise<ScheduledReminder[]>`
  - `commuteReminderService.cancelCommuteReminders(uid: string): Promise<void>`
  - storage key: `@livemetro_commute_reminders:<uid>` → `ScheduledReminder[]`

- [ ] **Step 1: Write the failing test**

테스트 상단(import 아래)에 mock 추가하고 describe 블록을 추가한다:

```typescript
import { storageUtils } from '@/utils/storageUtils';
import { notificationService } from '../notificationService';
import { commuteReminderService } from '../commuteReminderService';

jest.mock('@/utils/storageUtils', () => ({
  storageUtils: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../notificationService', () => ({
  notificationService: {
    cancelNotification: jest.fn(),
    scheduleWeeklyReminder: jest.fn(),
    requestPermissions: jest.fn(),
  },
}));

describe('commuteReminderService cancel/get', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getCommuteReminders reads the stored array for the uid', async () => {
    const stored = [{ weekday: 2, notificationId: 'n1', time: '08:15' }];
    (storageUtils.getItem as jest.Mock).mockResolvedValue(stored);

    const result = await commuteReminderService.getCommuteReminders('user-1');

    expect(storageUtils.getItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
    expect(result).toEqual(stored);
  });

  it('getCommuteReminders returns [] when nothing stored', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null);
    expect(await commuteReminderService.getCommuteReminders('user-1')).toEqual([]);
  });

  it('cancelCommuteReminders cancels every stored id then clears storage', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue([
      { weekday: 2, notificationId: 'n1', time: '08:15' },
      { weekday: 3, notificationId: 'n2', time: '08:15' },
    ]);

    await commuteReminderService.cancelCommuteReminders('user-1');

    expect(notificationService.cancelNotification).toHaveBeenCalledWith('n1');
    expect(notificationService.cancelNotification).toHaveBeenCalledWith('n2');
    expect(storageUtils.removeItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
  });

  it('cancelCommuteReminders is a no-op (still clears) when nothing stored', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null);
    await commuteReminderService.cancelCommuteReminders('user-1');
    expect(notificationService.cancelNotification).not.toHaveBeenCalled();
    expect(storageUtils.removeItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: FAIL — "commuteReminderService is not defined" / "getCommuteReminders is not a function".

- [ ] **Step 3: Write minimal implementation**

`commuteReminderService.ts` 하단에 추가:

```typescript
import { storageUtils } from '@/utils/storageUtils';
import { notificationService } from './notificationService';

const STORAGE_PREFIX = '@livemetro_commute_reminders:';
const storageKey = (uid: string): string => `${STORAGE_PREFIX}${uid}`;

class CommuteReminderService {
  async getCommuteReminders(uid: string): Promise<ScheduledReminder[]> {
    const stored = await storageUtils.getItem<ScheduledReminder[]>(storageKey(uid));
    return stored ?? [];
  }

  async cancelCommuteReminders(uid: string): Promise<void> {
    const existing = await this.getCommuteReminders(uid);
    for (const reminder of existing) {
      await notificationService.cancelNotification(reminder.notificationId);
    }
    await storageUtils.removeItem(storageKey(uid));
  }
}

export const commuteReminderService = new CommuteReminderService();
export default commuteReminderService;
```

(`import` 두 줄은 파일 상단으로 올려 정리해도 무방 — 동작 동일.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: PASS (Task 1 6건 + 이번 4건).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # feat/guidance-transfer-soft-confirm
git add src/services/notification/commuteReminderService.ts src/services/notification/__tests__/commuteReminderService.test.ts
git commit -m "feat(commute): commuteReminderService 취소·조회 + AsyncStorage 영속"
```

---

### Task 4: `commuteReminderService.scheduleCommuteReminders` + index export

활성 요일마다 weekly 알림을 예약하고 ID를 영속. cancel-before-schedule로 멱등 재예약.

**Files:**
- Modify: `src/services/notification/commuteReminderService.ts`
- Modify: `src/services/notification/index.ts` (export 추가)
- Test: `src/services/notification/__tests__/commuteReminderService.test.ts`

**Interfaces:**
- Consumes: `computeWeeklyTrigger`(Task 1), `notificationService.scheduleWeeklyReminder`(Task 2), `cancelCommuteReminders`(Task 3), `storageUtils.setItem`.
- Produces: `commuteReminderService.scheduleCommuteReminders(uid: string, config: CommuteReminderConfig): Promise<ScheduledReminder[]>`
  - 활성 요일마다 1건 예약, 성공분을 storage에 저장하고 반환. 호출 시작에 `cancelCommuteReminders` 선행.

- [ ] **Step 1: Write the failing test**

```typescript
describe('commuteReminderService.scheduleCommuteReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (storageUtils.getItem as jest.Mock).mockResolvedValue(null); // no existing
    (notificationService.scheduleWeeklyReminder as jest.Mock).mockImplementation(
      async (weekday: number) => `id-${weekday}`,
    );
  });

  it('schedules one reminder per active day (Mon/Wed) and persists them', async () => {
    // activeDays index 0=Mon..6=Sun → Mon(true), Wed(true) only
    const activeDays = [true, false, true, false, false, false, false];

    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays,
    });

    // Mon→expo 2, Wed→expo 4
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledTimes(2);
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledWith(2, 8, 15, expect.any(String), expect.any(String));
    expect(notificationService.scheduleWeeklyReminder).toHaveBeenCalledWith(4, 8, 15, expect.any(String), expect.any(String));
    expect(result).toEqual([
      { weekday: 2, notificationId: 'id-2', time: '08:15' },
      { weekday: 4, notificationId: 'id-4', time: '08:15' },
    ]);
    expect(storageUtils.setItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1', result);
  });

  it('cancels existing reminders before scheduling (idempotent reschedule)', async () => {
    (storageUtils.getItem as jest.Mock).mockResolvedValueOnce([
      { weekday: 6, notificationId: 'old', time: '07:00' },
    ]);

    await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [true, false, false, false, false, false, false],
    });

    expect(notificationService.cancelNotification).toHaveBeenCalledWith('old');
    // cancel happened before the new schedule
    const cancelOrder = (notificationService.cancelNotification as jest.Mock).mock.invocationCallOrder[0];
    const scheduleOrder = (notificationService.scheduleWeeklyReminder as jest.Mock).mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(scheduleOrder);
  });

  it('schedules nothing when no active days', async () => {
    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [false, false, false, false, false, false, false],
    });
    expect(notificationService.scheduleWeeklyReminder).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(storageUtils.setItem).toHaveBeenCalledWith('@livemetro_commute_reminders:user-1', []);
  });

  it('persists only successful schedules (skips nulls)', async () => {
    (notificationService.scheduleWeeklyReminder as jest.Mock)
      .mockResolvedValueOnce('id-2')   // Mon ok
      .mockResolvedValueOnce(null);    // Tue fails
    const result = await commuteReminderService.scheduleCommuteReminders('user-1', {
      departureTime: '08:15',
      activeDays: [true, true, false, false, false, false, false],
    });
    expect(result).toEqual([{ weekday: 2, notificationId: 'id-2', time: '08:15' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: FAIL — "scheduleCommuteReminders is not a function".

- [ ] **Step 3: Write minimal implementation**

`CommuteReminderService` 클래스에 메서드 추가:

```typescript
  async scheduleCommuteReminders(
    uid: string,
    config: CommuteReminderConfig,
  ): Promise<ScheduledReminder[]> {
    await this.cancelCommuteReminders(uid); // cancel-before-schedule (멱등)

    const leadMinutes = config.leadMinutes ?? 0;
    const title = '출발 시간이에요';
    const body = '지금 출발하세요';
    const scheduled: ScheduledReminder[] = [];

    for (let index = 0; index < config.activeDays.length; index++) {
      if (!config.activeDays[index]) continue;
      const spec = computeWeeklyTrigger(config.departureTime, leadMinutes, index);
      if (!spec) continue;
      const id = await notificationService.scheduleWeeklyReminder(
        spec.weekday, spec.hour, spec.minute, title, body,
      );
      if (id) {
        scheduled.push({ weekday: spec.weekday, notificationId: id, time: spec.time });
      }
    }

    await storageUtils.setItem(storageKey(uid), scheduled);
    return scheduled;
  }
```

`src/services/notification/index.ts`에 export 추가:

```typescript
export { commuteReminderService } from './commuteReminderService';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/notification/__tests__/commuteReminderService.test.ts --watchman=false`
Expected: PASS (전체).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # feat/guidance-transfer-soft-confirm
git add src/services/notification/commuteReminderService.ts src/services/notification/index.ts src/services/notification/__tests__/commuteReminderService.test.ts
git commit -m "feat(commute): scheduleCommuteReminders — 활성 요일별 예약 + 영속 + index export"
```

---

### Task 5: `CommuteSettingsScreen` 토글/설정변경 배선

`alertEnabled` 토글과 `departureTime`/`activeDays` 변경을 schedule/cancel에 연결. 권한 게이트.

**Files:**
- Modify: `src/screens/settings/CommuteSettingsScreen.tsx` (`handleToggleAlertEnabled` :450, `handleToggleDay` :455, `handleChangeDepartureTime` :482)
- Test: `src/screens/settings/__tests__/CommuteSettingsScreen.test.tsx` (배선 케이스 추가)

**Interfaces:**
- Consumes: `commuteReminderService.scheduleCommuteReminders/cancelCommuteReminders`(Task 4), `notificationService.requestPermissions`, `user.id`, `morningRoute.departureTime`, `activeDays`.
- Produces: 화면 동작 — 토글 ON+granted→schedule / OFF→cancel / 시각·요일 변경(enabled)→재예약.

- [ ] **Step 1: Write the failing test**

기존 `CommuteSettingsScreen.test.tsx`의 mock에 `commuteReminderService`·`notificationService.requestPermissions`를 추가하고, 새 describe를 추가한다. (testID는 컴포넌트 소스에서 알림 토글의 실제 testID를 먼저 확인해 사용 — 없으면 toggle 접근에 `getByRole('switch')` 또는 추가 testID 부여.)

```typescript
// 파일 상단 mock 영역 (inline factory)
jest.mock('@/services/notification', () => ({
  commuteReminderService: {
    scheduleCommuteReminders: jest.fn().mockResolvedValue([]),
    cancelCommuteReminders: jest.fn().mockResolvedValue(undefined),
  },
  notificationService: { requestPermissions: jest.fn() },
}));

// describe('CommuteSettingsScreen 알림 배선', ...)
it('toggle ON + 권한 granted → scheduleCommuteReminders 호출', async () => {
  (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: true });
  // ... render with a signed-in user + morningRoute.departureTime='08:15', alertEnabled=false
  // 알림 토글 ON
  // await waitFor(() =>
  expect(commuteReminderService.scheduleCommuteReminders).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ departureTime: '08:15', activeDays: expect.any(Array) }),
  );
});

it('toggle ON + 권한 denied → schedule 미호출, 토글 OFF 유지', async () => {
  (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: false });
  // 토글 ON 시도
  expect(commuteReminderService.scheduleCommuteReminders).not.toHaveBeenCalled();
});

it('toggle OFF → cancelCommuteReminders 호출', async () => {
  // alertEnabled=true 상태에서 토글 OFF
  expect(commuteReminderService.cancelCommuteReminders).toHaveBeenCalledWith('user-1');
});
```

> 실행자 노트: 이 화면 테스트는 기존 파일의 render 헬퍼(AuthContext/Theme provider, useFirestoreMorningCommute mock 등) 패턴을 그대로 따른다. 기존 테스트의 setup을 복사해 user/route를 주입하고, 알림 토글 행의 실제 testID/접근 방식을 소스에서 확인해 사용한다. (BANNED: `getByText` 중복 텍스트 → `getByTestId`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/settings/__tests__/CommuteSettingsScreen.test.tsx --watchman=false`
Expected: FAIL — schedule/cancel 미호출(배선 전).

- [ ] **Step 3: Write minimal implementation**

`CommuteSettingsScreen.tsx`:

(a) import 추가:
```typescript
import { commuteReminderService } from '@/services/notification';
import { notificationService } from '@/services/notification';
```

(b) `handleToggleAlertEnabled`를 교체 — 권한 게이트 + schedule/cancel:
```typescript
const handleToggleAlertEnabled = useCallback(
  async (value: boolean): Promise<void> => {
    if (!user) return;
    if (value) {
      const permission = await notificationService.requestPermissions();
      if (!permission.granted) {
        Alert.alert('알림 권한 필요', '설정에서 알림을 허용해 주세요.');
        return; // 토글 OFF 유지 (상태 갱신 안 함)
      }
      await updateCommuteSchedule({ alertEnabled: true });
      const departureTime = morningRoute?.departureTime;
      if (departureTime) {
        await commuteReminderService.scheduleCommuteReminders(user.id, { departureTime, activeDays });
      }
    } else {
      await updateCommuteSchedule({ alertEnabled: false });
      await commuteReminderService.cancelCommuteReminders(user.id);
    }
  },
  [user, updateCommuteSchedule, morningRoute, activeDays],
);
```

(c) `handleToggleDay`와 `handleChangeDepartureTime`에 "enabled면 재예약" 추가. 각 핸들러에서 `updateCommuteSchedule`/`saveCommuteRoutes` 성공 후:
```typescript
// handleToggleDay 내부, updateCommuteSchedule({ activeDays: next }) 이후:
if (alertEnabled && user && morningRoute?.departureTime) {
  await commuteReminderService.scheduleCommuteReminders(user.id, {
    departureTime: morningRoute.departureTime,
    activeDays: next,
  });
}
```
```typescript
// handleChangeDepartureTime 내부, morning 저장 성공(result.success) 후:
if (kind === 'morning' && alertEnabled && user) {
  await commuteReminderService.scheduleCommuteReminders(user.id, {
    departureTime: newTime,
    activeDays,
  });
}
```
(deps 배열에 `alertEnabled`, `activeDays`, `morningRoute`, `user` 추가.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/screens/settings/__tests__/CommuteSettingsScreen.test.tsx --watchman=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # feat/guidance-transfer-soft-confirm
git add src/screens/settings/CommuteSettingsScreen.tsx src/screens/settings/__tests__/CommuteSettingsScreen.test.tsx
git commit -m "feat(commute): CommuteSettings 알림 토글/설정변경 → 출근 리마인더 schedule/cancel 배선"
```

---

### Task 6: 통합 검증 게이트

**Files:** 없음(검증만)

- [ ] **Step 1: 타입 체크**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: 린트(변경 파일)**

Run: `npx eslint src/services/notification/commuteReminderService.ts src/services/notification/notificationService.ts src/screens/settings/CommuteSettingsScreen.tsx`
Expected: 0 errors (신규 console.error는 기존 패턴·error-handling.md 허용).

- [ ] **Step 3: 전체 테스트 + 커버리지**

Run: `npx jest --watchman=false --coverage`
Expected: 0 failures, 커버리지 임계값 충족.

- [ ] **Step 4: Red-Green 역검증 (핵심 1건)**

Task 4의 scheduleCommuteReminders 본문을 임시 주석 처리 → 해당 테스트 FAIL 확인 → 복원 → PASS. (verification.md Iron Law)

## Self-Review

**1. Spec coverage:**
- 신규 commuteReminderService → Task 1·3·4 ✓
- scheduleWeeklyReminder → Task 2 ✓
- CommuteSettings 토글 배선 → Task 5 ✓
- 요일 매핑 3종(전수 테스트) → Task 1 ✓
- 권한 게이트 → Task 5 ✓
- 영속/취소 → Task 3·4 ✓
- 빈 activeDays/부분 실패 → Task 4 ✓
- 자정 wrap → Task 1 ✓
- 2-store(departureTime↔activeDays) → Task 5(둘 다 화면 스코프) ✓
- **spec §7 orphan-net(타입 일괄 취소) → 의도적 제외**: 기존 ML 출발 알림이 같은 COMMUTE_REMINDER 타입이라 오삭제 위험. 저장 ID 기반 정밀 취소로 대체(Global Constraints에 명시). spec보다 안전한 정밀화.

**2. Placeholder scan:** 모든 코드 step에 실제 코드 포함. Task 5의 화면 테스트는 기존 render 헬퍼 재사용(실행자 노트로 명시)이라 setup 복붙 지시 — 플레이스홀더 아님.

**3. Type consistency:** `ScheduledReminder{weekday,notificationId,time}`, `CommuteReminderConfig{departureTime,activeDays,leadMinutes?}`, `computeWeeklyTrigger(...)→WeeklyTriggerSpec|null`, `scheduleCommuteReminders(uid,config)`, `cancelCommuteReminders(uid)`, `getCommuteReminders(uid)`, `scheduleWeeklyReminder(weekday,hour,minute,title,body)` — Task 간 일관.

**알려진 비범위(수용 기준)**: 로컬 예약 알림 실제 발사는 Expo Go/시뮬레이터에서 신뢰성 낮음 → EAS/dev 빌드 실기기 검증이 최종 수용 기준(C단계).
