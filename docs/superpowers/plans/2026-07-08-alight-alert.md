# 하차 임박 알림 (환승역 + 목적지) + 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실시간 길안내 중 열차 탑승(ride) 구간에서, 다음 하차 지점(환승역 또는 최종 목적지) 도착 N분 전에 pending 로컬 알림을 발사하고, 설정(토글 + 사전 시간 1/2/3분)으로 제어한다.

**Architecture:** 신규 `alightAlertService`가 `notificationService.scheduleArrivalAlert` 위에 하차-특화 라이프사이클(설정 게이트, 과거/임박 차단, stepKey dedup, 취소-후-교체)을 얹는다. `RouteGuidanceScreen`이 ride 스텝 진입/anchor 보정 시 틱-불변 도착 시각을 계산해 예약하고, 설정은 `NotificationSettings.alightAlert`(옵셔널, 기본 enabled/2분)로 저장·`NotificationTimeScreen`에서 편집한다.

**Tech Stack:** React Native 0.72 / Expo SDK 49, expo-notifications, TypeScript strict, Jest 29 + RNTL, Firebase (userPreferences 부분쓰기).

**Spec:** `docs/superpowers/specs/2026-07-08-alight-alert-design.md`

## Global Constraints

- `any` 금지, exported 함수 명시적 반환 타입 (`.claude/rules/typescript-strict.md`)
- import는 path alias (`@/`, `@models/` 등). 단, 같은 디렉토리 형제 파일은 기존 파일 관례(`./notificationService`)를 따른다
- 서비스 함수는 throw 금지 — 에러 시 `null` 반환 + `console.error` (`error-handling.md`)
- Immutability: `readonly` 인터페이스, 기본값 상수는 `Object.freeze`
- `useEffect`는 cleanup 필수, 인라인 스타일 금지(`StyleSheet.create`), `fontWeight` 단독 금지(`weightToFontFamily` 동반)
- Jest: `jest.mock()` factory는 inline 정의만 (외부 `jest.fn()` 참조 금지), 테스트 실행은 `--watchman=false`
- Firestore 설정 저장은 `updateUserPreferences` 부분쓰기만 — 전체 preferences 스프레드 setDoc 금지
- 알림 재예약은 "pending 취소 → 새로 예약"만. 발사 시각이 과거/임박이면 예약 자체를 생략 (즉시발사 강등 금지 — PR #287 회귀 클래스)
- 커밋은 Conventional Commits (`feat:`, `test:` 등), 각 태스크 끝에 커밋

---

### Task 1: 설정 모델 — `AlightAlertPreferences` + 기본값 리졸버

**Files:**
- Modify: `src/models/user.ts` (NotificationSettings에 필드 추가 + 신규 타입/헬퍼, 44-56줄 근처)
- Test: `src/models/__tests__/user.test.ts` (신규 파일)

**Interfaces:**
- Consumes: 없음 (기존 `NotificationSettings`만 확장)
- Produces (이후 모든 태스크가 사용):
  - `interface AlightAlertPreferences { readonly enabled: boolean; readonly leadMinutes: 1 | 2 | 3 }`
  - `NotificationSettings.alightAlert?: AlightAlertPreferences` (옵셔널 — 기존 Firestore 문서 하위호환)
  - `const DEFAULT_ALIGHT_ALERT: AlightAlertPreferences` (enabled: true, leadMinutes: 2, frozen)
  - `const resolveAlightAlertPreferences = (settings: Pick<NotificationSettings, 'alightAlert'> | null | undefined): AlightAlertPreferences`

- [ ] **Step 1: Write the failing test**

`src/models/__tests__/user.test.ts` 신규 작성:

```typescript
import {
  DEFAULT_ALIGHT_ALERT,
  resolveAlightAlertPreferences,
} from '@models/user';

describe('resolveAlightAlertPreferences', () => {
  it('returns defaults (enabled, 2분 전) when settings is null/undefined', () => {
    expect(resolveAlightAlertPreferences(null)).toEqual({ enabled: true, leadMinutes: 2 });
    expect(resolveAlightAlertPreferences(undefined)).toEqual({ enabled: true, leadMinutes: 2 });
  });

  it('returns defaults when alightAlert field is absent (기존 사용자 문서)', () => {
    expect(resolveAlightAlertPreferences({})).toEqual(DEFAULT_ALIGHT_ALERT);
    expect(resolveAlightAlertPreferences({ alightAlert: undefined })).toEqual(DEFAULT_ALIGHT_ALERT);
  });

  it('passes through a stored preference unchanged', () => {
    const stored = { enabled: false, leadMinutes: 3 as const };
    expect(resolveAlightAlertPreferences({ alightAlert: stored })).toBe(stored);
  });

  it('DEFAULT_ALIGHT_ALERT is frozen (immutability rule)', () => {
    expect(Object.isFrozen(DEFAULT_ALIGHT_ALERT)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/__tests__/user.test.ts --watchman=false`
Expected: FAIL — `DEFAULT_ALIGHT_ALERT`/`resolveAlightAlertPreferences` export가 없어 TS/모듈 에러

- [ ] **Step 3: Write minimal implementation**

`src/models/user.ts` — `NotificationSettings` 인터페이스(44-56줄)에 필드 추가:

```typescript
export interface NotificationSettings {
  readonly enabled: boolean;
  readonly delayThresholdMinutes: number;
  readonly quietHours: QuietHours;
  readonly weekdaysOnly: boolean;
  readonly alertTypes: NotificationAlertTypes;
  readonly pushNotifications: boolean;
  readonly emailNotifications: boolean;
  readonly soundSettings: SoundPreferences;
  readonly lineFilter?: readonly string[];        // (기존 주석 유지)
  readonly alertSources?: AlertSourcePreferences; // (기존 주석 유지)
  readonly perEventSound?: PerEventSoundOverrides; // (기존 주석 유지)
  readonly alightAlert?: AlightAlertPreferences;  // optional: 길안내 하차 임박 알림. undefined = 기본값(켜짐, 2분 전) — 기존 Firestore 문서 하위호환.
}
```

같은 파일, `PerEventSoundOverrides` 아래에 타입 + 헬퍼 추가:

```typescript
/**
 * 길안내 하차 임박 알림 설정 — ride 구간에서 다음 하차 지점(환승역/목적지)
 * 도착 `leadMinutes`분 전에 로컬 알림을 발사한다. Firestore 문서에 필드가
 * 없는 기존 사용자는 {@link DEFAULT_ALIGHT_ALERT}로 해석한다 —
 * `resolveAlightAlertPreferences`를 통해서만 읽을 것.
 */
export interface AlightAlertPreferences {
  readonly enabled: boolean;
  readonly leadMinutes: 1 | 2 | 3;
}

export const DEFAULT_ALIGHT_ALERT: AlightAlertPreferences = Object.freeze({
  enabled: true,
  leadMinutes: 2,
});

export const resolveAlightAlertPreferences = (
  settings: Pick<NotificationSettings, 'alightAlert'> | null | undefined
): AlightAlertPreferences => settings?.alightAlert ?? DEFAULT_ALIGHT_ALERT;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/__tests__/user.test.ts --watchman=false`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/models/user.ts src/models/__tests__/user.test.ts
git commit -m "feat(models): 하차 임박 알림 설정 AlightAlertPreferences + 기본값 리졸버"
```

---

### Task 2: `alightAlertService` — 예약/취소/dedup

**Files:**
- Create: `src/services/notification/alightAlertService.ts`
- Test: `src/services/notification/__tests__/alightAlertService.test.ts` (신규)

**Interfaces:**
- Consumes:
  - `notificationService.requestPermissions(): Promise<{ granted: boolean }>` (`./notificationService`)
  - `notificationService.shouldSendNotification(settings, NotificationType.ARRIVAL_REMINDER): boolean`
  - `notificationService.scheduleArrivalAlert(arrivalTime: Date, opts: { secondsBefore, title, body, data }): Promise<string | null>`
  - `notificationService.cancelNotification(id: string): Promise<void>`
  - `resolveAlightAlertPreferences` (Task 1)
- Produces (Task 3이 사용):
  - `interface AlightAlertParams { readonly stationName: string; readonly nextKind: 'transfer' | 'alight'; readonly toLineName?: string; readonly arrivalAtMs: number; readonly stepKey: string; readonly settings?: NotificationSettings | null }`
  - `scheduleAlightAlert(params: AlightAlertParams): Promise<string | null>`
  - `cancelAlightAlert(): Promise<void>`

**동작 규칙 (테스트가 그대로 검증):**
1. `resolveAlightAlertPreferences(settings).enabled === false` → 기존 pending 취소 후 `null` (설정 off는 pending도 제거 — 스펙)
2. 권한 미허용 → `null`
3. `settings != null`이고 `shouldSendNotification(settings, ARRIVAL_REMINDER) === false` → `null` (quietHours/전역 게이트)
4. `fireAtMs = arrivalAtMs - leadMinutes*60_000`. `fireAtMs - Date.now() < 5_000`이면 → `null` (과거/임박 — 즉시발사 강등 금지)
5. dedup: 같은 `stepKey`이고 `|fireAtMs - lastFireAtMs| <= 15_000`이며 추적 중인 id가 있으면 → 기존 id 반환 (재예약 없음). 그 외 → 기존 pending 취소 후 새로 예약
6. 카피 — `nextKind === 'transfer'`: title `` `곧 ${stationName}역 도착` ``, body `` `${toLineName} 환승을 준비하세요` `` / `nextKind === 'alight'`: 같은 title, body `'내릴 준비를 하세요'`
7. `scheduleArrivalAlert(new Date(arrivalAtMs), { secondsBefore: leadMinutes*60, title, body, data: { variant: nextKind, stationName } })` 호출, 성공 시 모듈 스코프에 `{ id, stepKey, fireAtMs }` 추적
8. 절대 throw하지 않음 — catch 시 `console.error` + `null`

- [ ] **Step 1: Write the failing test**

`src/services/notification/__tests__/alightAlertService.test.ts`:

```typescript
/**
 * alightAlertService — 하차 임박 알림 예약/취소/dedup.
 * 모듈 스코프 상태(추적 id/stepKey/fireAt)가 있어 jest.resetModules로 격리한다.
 */
jest.mock('../notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(),
    shouldSendNotification: jest.fn(),
    scheduleArrivalAlert: jest.fn(),
    cancelNotification: jest.fn(),
  },
  NotificationType: { ARRIVAL_REMINDER: 'arrival_reminder' },
}));

import type { NotificationSettings } from '@models/user';

const NOW = 1_750_000_000_000;

type Svc = typeof import('../alightAlertService');
type MockNotif = {
  requestPermissions: jest.Mock;
  shouldSendNotification: jest.Mock;
  scheduleArrivalAlert: jest.Mock;
  cancelNotification: jest.Mock;
};

// alightAlert만 실려 있으면 되므로 최소 형태로 캐스팅 (resolve/게이트 경로만 사용).
const settingsWith = (alightAlert?: { enabled: boolean; leadMinutes: 1 | 2 | 3 }): NotificationSettings =>
  ({ alightAlert } as unknown as NotificationSettings);

const baseParams = {
  stationName: '신도림',
  nextKind: 'transfer' as const,
  toLineName: '2호선',
  arrivalAtMs: NOW + 10 * 60_000, // 10분 뒤 도착
  stepKey: '1000:1',
  settings: settingsWith({ enabled: true, leadMinutes: 2 }),
};

let svc: Svc;
let notif: MockNotif;

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  svc = require('../alightAlertService');
  notif = require('../notificationService').notificationService;
  notif.requestPermissions.mockResolvedValue({ granted: true });
  notif.shouldSendNotification.mockReturnValue(true);
  notif.scheduleArrivalAlert.mockResolvedValue('alert-1');
  notif.cancelNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduleAlightAlert', () => {
  it('schedules leadMinutes*60 seconds before arrival with transfer copy', async () => {
    const id = await svc.scheduleAlightAlert(baseParams);
    expect(id).toBe('alert-1');
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      new Date(baseParams.arrivalAtMs),
      expect.objectContaining({
        secondsBefore: 120,
        title: '곧 신도림역 도착',
        body: '2호선 환승을 준비하세요',
        data: { variant: 'transfer', stationName: '신도림' },
      })
    );
  });

  it('uses alight copy for the final destination', async () => {
    await svc.scheduleAlightAlert({ ...baseParams, nextKind: 'alight', toLineName: undefined });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ body: '내릴 준비를 하세요', data: expect.objectContaining({ variant: 'alight' }) })
    );
  });

  it('applies leadMinutes from settings (3분 → 180s)', async () => {
    await svc.scheduleAlightAlert({
      ...baseParams,
      settings: settingsWith({ enabled: true, leadMinutes: 3 }),
    });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ secondsBefore: 180 })
    );
  });

  it('defaults to 2분 전 when settings is null (기본값 리졸브)', async () => {
    await svc.scheduleAlightAlert({ ...baseParams, settings: null });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ secondsBefore: 120 })
    );
  });

  it('returns null WITHOUT scheduling when fire time is past/imminent (즉시발사 강등 금지)', async () => {
    const id = await svc.scheduleAlightAlert({
      ...baseParams,
      arrivalAtMs: NOW + 2 * 60_000 + 3_000, // fireAt = NOW+3s < 5s 최소 리드
    });
    expect(id).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('dedups: same stepKey + fireAt within 15s tolerance → returns tracked id, no reschedule', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    const id = await svc.scheduleAlightAlert({ ...baseParams, arrivalAtMs: baseParams.arrivalAtMs + 10_000 });
    expect(id).toBe('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });

  it('reschedules (cancel → schedule) when fireAt shifts beyond tolerance — 열차 변경 rebase', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockResolvedValue('alert-2');
    const id = await svc.scheduleAlightAlert({ ...baseParams, arrivalAtMs: baseParams.arrivalAtMs + 60_000 });
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(id).toBe('alert-2');
  });

  it('reschedules when stepKey changes (다음 ride 구간)', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockResolvedValue('alert-2');
    const id = await svc.scheduleAlightAlert({ ...baseParams, stepKey: '1000:3' });
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(id).toBe('alert-2');
  });

  it('returns null and cancels pending when the setting is disabled', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    const id = await svc.scheduleAlightAlert({
      ...baseParams,
      settings: settingsWith({ enabled: false, leadMinutes: 2 }),
    });
    expect(id).toBeNull();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    notif.requestPermissions.mockResolvedValue({ granted: false });
    expect(await svc.scheduleAlightAlert(baseParams)).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null when shouldSendNotification gates it (quietHours 등)', async () => {
    notif.shouldSendNotification.mockReturnValue(false);
    expect(await svc.scheduleAlightAlert(baseParams)).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('never throws — returns null on scheduling error', async () => {
    notif.scheduleArrivalAlert.mockRejectedValue(new Error('boom'));
    await expect(svc.scheduleAlightAlert(baseParams)).resolves.toBeNull();
  });
});

describe('cancelAlightAlert', () => {
  it('cancels the tracked alert and is a no-op when none', async () => {
    await svc.cancelAlightAlert(); // no-op
    expect(notif.cancelNotification).not.toHaveBeenCalled();
    await svc.scheduleAlightAlert(baseParams);
    await svc.cancelAlightAlert();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    // 두 번째 호출은 no-op (추적 해제 확인)
    notif.cancelNotification.mockClear();
    await svc.cancelAlightAlert();
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/notification/__tests__/alightAlertService.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../alightAlertService'`

- [ ] **Step 3: Write the implementation**

`src/services/notification/alightAlertService.ts`:

```typescript
/**
 * alightAlertService — 길안내 "하차 임박 알림" (환승역/목적지 도착 N분 전).
 *
 * `notificationService.scheduleArrivalAlert` 위에 하차-특화 라이프사이클을 얹는다:
 *   - 설정 게이트: alightAlert.enabled(전용 토글) + shouldSendNotification(전역/quietHours),
 *   - 과거/임박 발사 시각은 예약 자체를 생략 — scheduleArrivalAlert의 즉시발사
 *     강등(trigger:null)에 절대 도달하지 않게 한다 (발사 후 재예약 반복 버그 클래스),
 *   - stepKey(세션 시각:스텝 인덱스) 단위 dedup: 같은 스텝의 틱/재렌더 재호출은
 *     기존 예약을 재사용하고, 도착 추정이 크게 바뀐 경우(열차 변경 rebase)만
 *     취소-후-교체한다.
 *
 * 추적 상태는 모듈 스코프(JS-heap) — boardingAlertService와 같은 이유로 화면
 * 라이프사이클과 분리한다. 서비스 함수는 throw하지 않는다.
 */
import { notificationService, NotificationType } from './notificationService';
import { resolveAlightAlertPreferences } from '@models/user';
import type { NotificationSettings } from '@models/user';

/** 발사 시각까지 최소 여유 — 이보다 임박하면 예약을 생략한다. */
const MIN_SCHEDULE_LEAD_MS = 5_000;
/** 같은 스텝에서 이 이내의 fireAt 변동은 틱 잡음으로 보고 재예약하지 않는다. */
const RESCHEDULE_TOLERANCE_MS = 15_000;

let trackedId: string | null = null;
let trackedStepKey: string | null = null;
let trackedFireAtMs: number | null = null;

export interface AlightAlertParams {
  /** 하차할 역 이름 (다음 스텝의 stationName). */
  readonly stationName: string;
  /** 다음 스텝 종류 — 환승 대기('transfer') 또는 최종 하차('alight'). */
  readonly nextKind: 'transfer' | 'alight';
  /** nextKind='transfer'일 때 갈아탈 노선 이름. */
  readonly toLineName?: string;
  /** 하차역 도착 예정 epoch ms (ride 스텝 anchor + duration — 틱 불변). */
  readonly arrivalAtMs: number;
  /** `${session.startedAt}:${stepIndex}` — 스텝 단위 dedup 키. */
  readonly stepKey: string;
  /** 사용자 알림 설정 — 없으면 기본값(켜짐, 2분 전)으로 해석. */
  readonly settings?: NotificationSettings | null;
}

/**
 * 하차 임박 알림을 예약한다. 예약된 identifier를, 게이트/임박/에러로 예약하지
 * 않은 경우 null을 반환한다. 설정이 꺼져 있으면 기존 pending도 취소한다.
 * Never throws.
 */
export const scheduleAlightAlert = async (
  params: AlightAlertParams
): Promise<string | null> => {
  const { stationName, nextKind, toLineName, arrivalAtMs, stepKey, settings } = params;

  try {
    const prefs = resolveAlightAlertPreferences(settings);
    if (!prefs.enabled) {
      await cancelAlightAlert();
      return null;
    }

    const permission = await notificationService.requestPermissions();
    if (!permission.granted) return null;

    if (
      settings != null &&
      !notificationService.shouldSendNotification(settings, NotificationType.ARRIVAL_REMINDER)
    ) {
      return null;
    }

    const fireAtMs = arrivalAtMs - prefs.leadMinutes * 60_000;
    if (fireAtMs - Date.now() < MIN_SCHEDULE_LEAD_MS) return null;

    if (
      trackedId !== null &&
      stepKey === trackedStepKey &&
      trackedFireAtMs !== null &&
      Math.abs(fireAtMs - trackedFireAtMs) <= RESCHEDULE_TOLERANCE_MS
    ) {
      return trackedId;
    }

    await cancelAlightAlert();

    const copy =
      nextKind === 'transfer'
        ? { title: `곧 ${stationName}역 도착`, body: `${toLineName ?? ''} 환승을 준비하세요`.trim() }
        : { title: `곧 ${stationName}역 도착`, body: '내릴 준비를 하세요' };

    const id = await notificationService.scheduleArrivalAlert(new Date(arrivalAtMs), {
      secondsBefore: prefs.leadMinutes * 60,
      title: copy.title,
      body: copy.body,
      data: { variant: nextKind, stationName },
    });

    if (id !== null) {
      trackedId = id;
      trackedStepKey = stepKey;
      trackedFireAtMs = fireAtMs;
    }
    return id;
  } catch (error) {
    console.error('Error scheduling alight alert:', error);
    return null;
  }
};

/** 추적 중인 하차 임박 알림을 취소한다. 없으면 no-op. Never throws. */
export const cancelAlightAlert = async (): Promise<void> => {
  if (trackedId === null) return;
  const id = trackedId;
  trackedId = null;
  trackedStepKey = null;
  trackedFireAtMs = null;
  try {
    await notificationService.cancelNotification(id);
  } catch (error) {
    console.error('Error cancelling alight alert:', error);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/notification/__tests__/alightAlertService.test.ts --watchman=false`
Expected: PASS (13 tests)

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/services/notification/alightAlertService.ts src/services/notification/__tests__/alightAlertService.test.ts
git commit -m "feat(notification): alightAlertService — 하차 임박 알림 예약/취소/dedup"
```

---

### Task 3: RouteGuidanceScreen 통합 — ride 스텝 예약/보정 재예약/종료 취소

**Files:**
- Modify: `src/screens/guidance/RouteGuidanceScreen.tsx` (import 블록, 355-374줄의 알림 브리지 근처, 434-443줄 `handleExit`)
- Test: `src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx` (기존 파일에 describe 블록 추가)

**Interfaces:**
- Consumes: `scheduleAlightAlert(params: AlightAlertParams)`, `cancelAlightAlert()` (Task 2), 기존 화면 로컬 값 `steps`, `currentIndex`, `currentStep`, `nowMs`, `elapsedInStepSec`, `session`, `notificationSettings`
- Produces: 없음 (말단 통합)

**핵심 계산 — 틱-불변 도착 시각:** `nowMs - elapsedInStepSec * 1000`은 정확히 현재 스텝의 시작 시각(anchor 파생)이므로, `+ durationMinutes * 60_000`은 매초 재렌더에도 값이 변하지 않는다. 이 값을 effect 의존성으로 쓰면 anchor 변경(goNextAt/rebaseAt)과 스텝 전환 시에만 재실행된다.

- [ ] **Step 1: Write the failing test**

`src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx`에 추가. **먼저 기존 파일의 mock/렌더 헬퍼 구성을 읽고 그 관례를 그대로 따를 것** (세션 store mock, useRealtimeTrains mock, useAuth mock 등). 기존 `jest.mock('@/services/notification/boardingAlertService', ...)`과 동일한 방식으로 alightAlertService mock을 추가:

```typescript
jest.mock('@/services/notification/alightAlertService', () => ({
  scheduleAlightAlert: jest.fn().mockResolvedValue('alight-1'),
  cancelAlightAlert: jest.fn().mockResolvedValue(undefined),
}));
```

추가할 테스트 케이스 (기존 헬퍼로 "board → 탑승 확인 → ride 스텝" 상태를 만드는 방식은 기존 soft-confirm/boarding-alert 테스트를 재사용):

```typescript
describe('하차 임박 알림 (alight alert)', () => {
  it('ride 스텝 진입 시 다음 하차 지점 정보로 scheduleAlightAlert를 호출한다', async () => {
    // 기존 테스트 헬퍼로 렌더 → 탑승 확인(confirmBoarded 경로)으로 ride 스텝 진입
    // 검증:
    const { scheduleAlightAlert } = require('@/services/notification/alightAlertService');
    expect(scheduleAlightAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        nextKind: expect.stringMatching(/^(transfer|alight)$/),
        stationName: expect.any(String),
        arrivalAtMs: expect.any(Number),
        stepKey: expect.stringMatching(/^\d+:\d+$/),
      })
    );
  });

  it('board/transfer 대기 스텝에서는 예약하지 않고 cancelAlightAlert를 호출한다', () => {
    // 초기 렌더(board 홀드 상태)에서:
    const { scheduleAlightAlert, cancelAlightAlert } = require('@/services/notification/alightAlertService');
    expect(scheduleAlightAlert).not.toHaveBeenCalled();
    expect(cancelAlightAlert).toHaveBeenCalled();
  });

  it('길안내 종료(handleExit) 시 cancelAlightAlert를 호출한다', () => {
    // 기존 handleExit 테스트와 같은 방식으로 종료 버튼 press 후:
    const { cancelAlightAlert } = require('@/services/notification/alightAlertService');
    expect(cancelAlightAlert).toHaveBeenCalled();
  });
});
```

(정확한 렌더/전이 코드는 기존 파일의 boarding alert 테스트 블록을 복제해 수정한다 — 파일마다 픽스처 이름이 다르므로 구현 시 기존 코드를 따른다. 케이스 3개는 전부 명시적으로 작성하고 생략 주석 금지.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx --watchman=false`
Expected: 새 describe 3케이스 FAIL (`scheduleAlightAlert` not called 등), 기존 테스트는 전부 PASS 유지

- [ ] **Step 3: Write the integration**

`src/screens/guidance/RouteGuidanceScreen.tsx`:

(a) import 추가 — 기존 boardingAlertService import(37-39줄) 옆에:

```typescript
import {
  scheduleAlightAlert,
  cancelAlightAlert,
} from '@/services/notification/alightAlertService';
```

(b) 기존 boarding-alert effect(356-366줄) 바로 아래에 추가:

```typescript
  // 하차 임박 알림 — ride 스텝의 도착 예정 시각으로 pending 알림을 예약한다.
  // `nowMs - elapsedInStepSec*1000`은 현재 스텝의 시작 시각(anchor 파생)이라
  // 1Hz 틱에 불변 → 이 값이 바뀌는 건 anchor 보정(goNextAt/rebaseAt)이나 스텝
  // 전환뿐이므로, effect 재실행 = 재예약 필요 시점과 정확히 일치한다.
  const rideAlightAtMs =
    currentStep?.kind === 'ride'
      ? Math.round(nowMs - elapsedInStepSec * 1000 + currentStep.durationMinutes * 60_000)
      : null;
  const nextStep = steps[currentIndex + 1];
  useEffect(() => {
    if (
      rideAlightAtMs === null ||
      nextStep === undefined ||
      (nextStep.kind !== 'transfer' && nextStep.kind !== 'alight')
    ) {
      // ride가 아닌 스텝(대기/도착)으로 이동 — 이전 ride의 pending은 더는 유효하지 않다.
      void cancelAlightAlert();
      return;
    }
    if (!session) return;
    void scheduleAlightAlert({
      stationName: nextStep.stationName,
      nextKind: nextStep.kind,
      toLineName: nextStep.kind === 'transfer' ? nextStep.toLineName : undefined,
      arrivalAtMs: rideAlightAtMs,
      stepKey: `${session.startedAt}:${currentIndex}`,
      settings: notificationSettings,
    });
  }, [rideAlightAtMs, nextStep, currentIndex, session, notificationSettings]);
```

(c) unmount cleanup effect(369-374줄)에 취소 추가:

```typescript
  useEffect(() => {
    return () => {
      clearAutoTimer();
      void cancelBoardingAlert();
      void cancelAlightAlert();
    };
  }, [clearAutoTimer]);
```

(d) `handleExit`(434-443줄)에 취소 추가 — `void cancelBoardingAlert();` 다음 줄:

```typescript
    void cancelAlightAlert();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx --watchman=false`
Expected: PASS (기존 + 신규 3 전부)

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/screens/guidance/RouteGuidanceScreen.tsx src/screens/guidance/__tests__/RouteGuidanceScreen.test.tsx
git commit -m "feat(guidance): ride 스텝 하차 임박 알림 예약/보정 재예약/종료 취소 연결"
```

---

### Task 4: 설정 UI — NotificationTimeScreen "길안내 알림" 섹션

**Files:**
- Modify: `src/screens/settings/NotificationTimeScreen.tsx` (import, 핸들러 ~264줄 근처, "방해 금지" SettingSection(318-358줄) 아래 섹션 추가, `createStyles`)
- Test: `src/screens/settings/__tests__/NotificationTimeScreen.test.tsx` (기존 파일에 describe 추가)

**Interfaces:**
- Consumes: `resolveAlightAlertPreferences`, `AlightAlertPreferences` (Task 1), 기존 `useAuth().updateUserPreferences`(부분쓰기), `SettingSection`, `SettingToggle`
- Produces: 없음 (말단 UI)

**UI 구성:** `SettingSection title="길안내 알림"` 안에 ① `SettingToggle`(label "하차 임박 알림", subtitle "길안내 중 환승·하차 역 도착 전에 미리 알려드려요", testID `alight-alert-toggle`) ② 토글 ON일 때만 보이는 사전 시간 선택 행 — `1분 전 / 2분 전 / 3분 전` TouchableOpacity 칩 3개 (testID `alight-lead-1|2|3`), DelayNotificationScreen의 threshold-step 칩과 같은 계열의 시각 패턴.

- [ ] **Step 1: Write the failing test**

`src/screens/settings/__tests__/NotificationTimeScreen.test.tsx`에 추가. 기존 파일의 useAuth mock/렌더 헬퍼 관례를 따른다:

```typescript
describe('하차 임박 알림 설정', () => {
  it('기본값으로 토글 ON + 2분 전이 선택되어 렌더된다 (alightAlert 필드 없는 기존 사용자)', () => {
    // 기존 렌더 헬퍼 사용
    // expect(getByTestId('alight-alert-toggle').props.value).toBe(true);
    // 2분 칩이 active 상태 (accessibilityState.selected 또는 testID 존재로 검증)
  });

  it('토글 OFF 시 updateUserPreferences를 alightAlert 부분으로 호출한다', async () => {
    // fireEvent(getByTestId('alight-alert-toggle'), 'valueChange', false);
    // expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
    //   notificationSettings: expect.objectContaining({
    //     alightAlert: { enabled: false, leadMinutes: 2 },
    //   }),
    // });
  });

  it('사전 시간 칩(3분) 선택 시 leadMinutes를 저장한다', async () => {
    // fireEvent.press(getByTestId('alight-lead-3'));
    // expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
    //   notificationSettings: expect.objectContaining({
    //     alightAlert: { enabled: true, leadMinutes: 3 },
    //   }),
    // });
  });

  it('토글 OFF 상태에서는 사전 시간 칩이 렌더되지 않는다', () => {
    // user mock의 notificationSettings.alightAlert = { enabled: false, leadMinutes: 2 }로 렌더
    // expect(queryByTestId('alight-lead-1')).toBeNull();
  });
});
```

(주석 스켈레톤이 아니라 기존 파일 헬퍼에 맞춘 실제 코드로 4케이스 전부 작성한다. `getByTestId` 사용 — `getByText`는 중복 텍스트 함정.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/settings/__tests__/NotificationTimeScreen.test.tsx --watchman=false`
Expected: 신규 4케이스 FAIL (`alight-alert-toggle` not found), 기존 PASS 유지

- [ ] **Step 3: Write the implementation**

`src/screens/settings/NotificationTimeScreen.tsx`:

(a) import 추가:

```typescript
import { resolveAlightAlertPreferences } from '@models/user';
import type { AlightAlertPreferences } from '@models/user';
```

(RN import에 `TouchableOpacity`가 없으면 추가.)

(b) 컴포넌트 본문 — 기존 `notificationSettings` 파생값(83줄) 아래:

```typescript
  const alightPrefs = resolveAlightAlertPreferences(notificationSettings);
```

(c) 핸들러 — 기존 quietHours 핸들러들(263-276줄) 아래, 같은 패턴:

```typescript
  const updateAlightAlert = useCallback(
    async (next: AlightAlertPreferences): Promise<void> => {
      if (!user) return;
      try {
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            alightAlert: next,
          },
        });
      } catch (error) {
        console.error('Error updating alight alert preferences:', error);
        Alert.alert('오류', '설정을 저장하지 못했어요. 다시 시도해주세요.');
      }
    },
    [user, updateUserPreferences]
  );

  const handleAlightToggle = useCallback(
    (enabled: boolean): void => {
      void updateAlightAlert({ ...alightPrefs, enabled });
    },
    [alightPrefs, updateAlightAlert]
  );

  const handleAlightLeadChange = useCallback(
    (leadMinutes: AlightAlertPreferences['leadMinutes']): void => {
      void updateAlightAlert({ ...alightPrefs, leadMinutes });
    },
    [alightPrefs, updateAlightAlert]
  );
```

(기존 파일이 `Alert` 미사용이면 import 추가; 기존 핸들러들이 Alert 없이 console.error만 쓰면 그 관례를 따르고 Alert 줄은 뺀다 — 구현 시 기존 quietHours 핸들러의 에러 처리와 동일하게 맞출 것.)

(d) JSX — "방해 금지" `</SettingSection>`(358줄) 아래에 새 섹션:

```tsx
        <SettingSection title="길안내 알림">
          <SettingToggle
            label="하차 임박 알림"
            subtitle="길안내 중 환승·하차 역 도착 전에 미리 알려드려요"
            value={alightPrefs.enabled}
            onValueChange={handleAlightToggle}
            testID="alight-alert-toggle"
          />
          {alightPrefs.enabled && (
            <View style={styles.leadRow}>
              <Text style={styles.leadLabel}>알림 시점</Text>
              <View style={styles.leadChips}>
                {([1, 2, 3] as const).map((m) => {
                  const active = alightPrefs.leadMinutes === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      testID={`alight-lead-${m}`}
                      style={[styles.leadChip, active && styles.leadChipActive]}
                      onPress={() => handleAlightLeadChange(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`도착 ${m}분 전 알림`}
                    >
                      <Text style={[styles.leadChipText, active && styles.leadChipTextActive]}>
                        {m}분 전
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </SettingSection>
```

(`onPress` 인라인 화살표는 map 내부 파라미터 바인딩이라 불가피 — 기존 DelayNotificationScreen threshold 칩(338줄)과 동일 관례. 터치 영역은 스타일에서 minHeight 44 보장.)

(e) `createStyles`에 스타일 추가 — 기존 토큰(`semantic`, `WANTED_TOKENS`, `weightToFontFamily`) 사용, 하드코딩 색상 금지:

```typescript
    leadRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leadLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    leadChips: {
      flexDirection: 'row',
      gap: 8,
    },
    leadChip: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.fillNeutral,
    },
    leadChipActive: {
      backgroundColor: semantic.fillPrimary,
    },
    leadChipText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    leadChipTextActive: {
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelInverse,
    },
```

(토큰 이름 `fillNeutral`/`fillPrimary`/`labelNeutral`/`labelInverse`는 이 파일의 기존 createStyles가 실제로 쓰는 semantic 키에 맞춘다 — 구현 시 파일 내 기존 스타일에서 사용 중인 키를 확인해 동일 계열로 교체. `lint:typography`(pre-commit)가 fontWeight 단독을 차단하므로 반드시 `weightToFontFamily` 유지.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/screens/settings/__tests__/NotificationTimeScreen.test.tsx --watchman=false`
Expected: PASS (기존 + 신규 4)

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/screens/settings/NotificationTimeScreen.tsx src/screens/settings/__tests__/NotificationTimeScreen.test.tsx
git commit -m "feat(settings): 하차 임박 알림 토글 + 사전 시간(1/2/3분) 설정 UI"
```

---

### Task 5: 전체 게이트 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 타입체크 + 린트**

```bash
npx tsc --noEmit
npx eslint src/models/user.ts src/services/notification/alightAlertService.ts src/screens/guidance/RouteGuidanceScreen.tsx src/screens/settings/NotificationTimeScreen.tsx --max-warnings 0
```
Expected: 둘 다 exit 0

- [ ] **Step 2: 전체 테스트 (커버리지 게이트 포함)**

```bash
npx jest --coverage --watchman=false
```
Expected: 0 failures, `jest.config.js`의 coverageThreshold 통과

- [ ] **Step 3: git status 확인 — untracked 잔여물 없음**

```bash
git status --porcelain
```
Expected: 출력 없음 (전부 커밋됨)
