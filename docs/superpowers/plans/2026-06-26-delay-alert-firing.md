# 출퇴근 노선 공식 지연 포그라운드 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 앱이 포그라운드일 때 사용자의 즐겨찾기/출퇴근 노선에 공식 지연이 발생하면 로컬 알림을 발사한다(precision 우선, dedup, 설정 게이트).

**Architecture:** `officialDelayService.getActiveDelays()`(공식 소스)를 app-root에서 AppState 'active' 동안 90초 폴링 → 관심 노선 필터 → dedup → `shouldSendNotification` 게이트 → line-aware 로컬 알림. 클라이언트 전용, 죽은 `dataManager.detectDelays`/`monitorStationDelays` 미사용.

**Tech Stack:** React Native 0.72 / Expo Notifications / TS strict / Jest + RNTL / AppState.

## Global Constraints
- Path alias 필수(신규): `@/`, `@services/`, `@hooks/`, `@models/`. (App.tsx는 기존 상대경로 컨벤션 유지.)
- 서비스/순수함수 에러 시 `null`/`[]`/무동작, throw 금지(`error-handling.md`).
- 폴링 90s, `officialDelayService` 캐시 경유(서울 API 30s 최소·일 1000 준수, 전 노선 1콜).
- useEffect cleanup 필수(interval clear + AppState `subscription.remove()`).
- 테스트 실행: `npx jest --runInBand --watchman=false <path>`.
- 커밋: Conventional Commits, surgical, co-author 푸터 포함.
- 알림 게이트: `notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT)`.

---

### Task 1: `delayAlertDedup` 순수 dedup 로직

**Files:**
- Create: `src/services/notification/delayAlertDedup.ts`
- Test: `src/services/notification/__tests__/delayAlertDedup.test.ts`

**Interfaces:**
- Consumes: `OfficialDelay`, `DelayStatus` (`@services/delay/officialDelayService`).
- Produces: `interface AlertedState { readonly status: DelayStatus }`; `shouldAlert(prev: ReadonlyMap<string, AlertedState>, delay: OfficialDelay): boolean`; `nextDedupState(active: readonly OfficialDelay[]): Map<string, AlertedState>`.

- [ ] **Step 1: 실패 테스트**
```ts
import type { OfficialDelay } from '@services/delay/officialDelayService';
import { shouldAlert, nextDedupState, type AlertedState } from '../delayAlertDedup';

const d = (lineId: string, status: OfficialDelay['status']): OfficialDelay => ({
  lineId, lineName: `${lineId}호선`, status, updatedAt: new Date(0), source: 'seoul_metro',
});

describe('delayAlertDedup', () => {
  it('alerts when the line was not previously alerted', () => {
    expect(shouldAlert(new Map(), d('2', 'delayed'))).toBe(true);
  });
  it('does not re-alert the same line+status', () => {
    const prev = new Map<string, AlertedState>([['2', { status: 'delayed' }]]);
    expect(shouldAlert(prev, d('2', 'delayed'))).toBe(false);
  });
  it('re-alerts when status escalates (delayed -> suspended)', () => {
    const prev = new Map<string, AlertedState>([['2', { status: 'delayed' }]]);
    expect(shouldAlert(prev, d('2', 'suspended'))).toBe(true);
  });
  it('does not re-alert on de-escalation (suspended -> delayed)', () => {
    const prev = new Map<string, AlertedState>([['2', { status: 'suspended' }]]);
    expect(shouldAlert(prev, d('2', 'delayed'))).toBe(false);
  });
  it('nextDedupState rebuilds from active (prunes cleared lines)', () => {
    const prev = nextDedupState([d('2', 'delayed'), d('4', 'suspended')]);
    expect(prev.has('2')).toBe(true);
    const next = nextDedupState([d('4', 'suspended')]);
    expect(next.has('2')).toBe(false);
    expect(next.get('4')).toEqual({ status: 'suspended' });
  });
});
```
- [ ] **Step 2: 실패 확인** — `npx jest --runInBand --watchman=false src/services/notification/__tests__/delayAlertDedup.test.ts` → FAIL (module not found).
- [ ] **Step 3: 구현**
```ts
import type { OfficialDelay, DelayStatus } from '@services/delay/officialDelayService';

export interface AlertedState {
  readonly status: DelayStatus;
}

const SEVERITY: Record<DelayStatus, number> = {
  normal: 0, modified: 1, delayed: 2, suspended: 3,
};

/** True when this line has not been alerted, or its status escalated since last alert. */
export function shouldAlert(
  prev: ReadonlyMap<string, AlertedState>,
  delay: OfficialDelay,
): boolean {
  const seen = prev.get(delay.lineId);
  return !seen || SEVERITY[delay.status] > SEVERITY[seen.status];
}

/** Rebuild dedup state from the current active set — prunes cleared lines so a recurrence re-alerts. */
export function nextDedupState(active: readonly OfficialDelay[]): Map<string, AlertedState> {
  return new Map(active.map((delay) => [delay.lineId, { status: delay.status }]));
}
```
- [ ] **Step 4: 통과 확인** — 동일 jest → PASS.
- [ ] **Step 5: 커밋** — `feat(delay): 공식 지연 알림 dedup 순수 로직 (delayAlertDedup)`

---

### Task 2: `lineDelayAlert` — line-aware 알림 페이로드 + 발사

**Files:**
- Create: `src/services/notification/lineDelayAlert.ts`
- Test: `src/services/notification/__tests__/lineDelayAlert.test.ts`

**Interfaces:**
- Consumes: `OfficialDelay`, `notificationService`, `NotificationType`, `NotificationPayload`.
- Produces: `buildLineStatusPayload(delay: OfficialDelay): NotificationPayload`; `fireLineDelayAlert(delay: OfficialDelay): Promise<string | null>`.

**선행 확인(구현 중):** `notificationService.sendLocalNotification`이 public인지 확인. private면 notificationService에 `sendLineStatusAlert(delay)` 메서드를 추가하고 `fireLineDelayAlert`는 이를 호출. payload shape는 `sendDelayAlert`(notificationService.ts:211) 미러: `{ type, title, body, priority:'high', channelId:'delay_alerts', data }`.

- [ ] **Step 1: 실패 테스트** — 순수 빌더만 검증(expo 의존 없음).
```ts
import { buildLineStatusPayload } from '../lineDelayAlert';
import { NotificationType } from '@models/notification';
import type { OfficialDelay } from '@services/delay/officialDelayService';

const base = { lineId: '2', lineName: '2호선', updatedAt: new Date(0), source: 'seoul_metro' as const };

describe('buildLineStatusPayload', () => {
  it('delayed -> 지연 title + minutes/reason in body', () => {
    const p = buildLineStatusPayload({ ...base, status: 'delayed', delayMinutes: 8, reason: '신호 장애' });
    expect(p.type).toBe(NotificationType.DELAY_ALERT);
    expect(p.title).toContain('2호선');
    expect(p.title).toContain('지연');
    expect(p.body).toContain('8분');
    expect(p.body).toContain('신호 장애');
  });
  it('suspended -> 운행 중단 copy (no false "N분 지연")', () => {
    const p = buildLineStatusPayload({ ...base, status: 'suspended', reason: '사고' });
    expect(p.title).toContain('운행 중단');
    expect(p.body).not.toContain('분 지연');
    expect(p.body).toContain('사고');
  });
  it('modified -> 운행 변경 copy', () => {
    const p = buildLineStatusPayload({ ...base, status: 'modified' });
    expect(p.title).toContain('운행 변경');
  });
  it('delayed without delayMinutes omits the minutes phrase', () => {
    const p = buildLineStatusPayload({ ...base, status: 'delayed' });
    expect(p.body).not.toContain('undefined');
  });
});
```
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현** (channelId/priority는 sendDelayAlert와 동일)
```ts
import { NotificationType, type NotificationPayload } from '@models/notification';
import { notificationService } from './notificationService';
import type { OfficialDelay } from '@services/delay/officialDelayService';

export function buildLineStatusPayload(delay: OfficialDelay): NotificationPayload {
  const { lineName, status, delayMinutes, reason } = delay;
  const reasonSuffix = reason ? ` 사유: ${reason}` : '';
  let title: string;
  let body: string;
  if (status === 'suspended') {
    title = `🚇 ${lineName} 운행 중단`;
    body = `${lineName} 운행이 중단되었습니다.${reasonSuffix}`;
  } else if (status === 'modified') {
    title = `🚇 ${lineName} 운행 변경`;
    body = `${lineName} 운행에 변경이 있습니다.${reasonSuffix}`;
  } else {
    title = `🚇 ${lineName} 지연`;
    const mins = typeof delayMinutes === 'number' ? `약 ${delayMinutes}분 ` : '';
    body = `${lineName}에 ${mins}지연이 발생했습니다.${reasonSuffix}`;
  }
  return {
    type: NotificationType.DELAY_ALERT,
    title,
    body,
    priority: 'high',
    channelId: 'delay_alerts',
    data: { lineId: delay.lineId, lineName, status, delayMinutes, reason, timestamp: new Date().toISOString() },
  };
}

export async function fireLineDelayAlert(delay: OfficialDelay): Promise<string | null> {
  return notificationService.sendLineStatusAlert(buildLineStatusPayload(delay));
}
```
  + `notificationService`에 얇은 public 메서드 추가(같은 클래스의 `this.sendLocalNotification` 접근):
```ts
async sendLineStatusAlert(payload: NotificationPayload): Promise<string | null> {
  return this.sendLocalNotification(payload);
}
```
  (`NotificationPayload` import가 notification.ts에 있는지 확인; 없으면 기존 sendDelayAlert가 쓰는 타입 경로 사용.)
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 타입** — `npx tsc --noEmit` 0 errors(또는 커밋 pre-commit).
- [ ] **Step 6: 커밋** — `feat(delay): line-level 공식 지연 알림 페이로드/발사 (lineDelayAlert)`

---

### Task 3: `useWatchedLineIds` — 관심 노선 셀렉터

**Files:**
- Create: `src/hooks/useWatchedLineIds.ts`
- Test: `src/hooks/__tests__/useWatchedLineIds.test.ts`

**Interfaces:**
- Consumes: `useFavorites()` → `{ favoritesWithDetails: FavoriteWithDetails[] }` (각 항목 `.lineId`).
- Produces: `useWatchedLineIds(): readonly string[]` (중복 제거 + 정렬, 안정 참조).

- [ ] **Step 1: 실패 테스트**
```ts
import { renderHook } from '@testing-library/react-native';
import { useFavorites } from '@hooks/useFavorites';
import { useWatchedLineIds } from '../useWatchedLineIds';

jest.mock('@hooks/useFavorites', () => ({ useFavorites: jest.fn() }));
const mockUseFavorites = useFavorites as jest.Mock;

describe('useWatchedLineIds', () => {
  beforeEach(() => jest.clearAllMocks());
  it('returns unique, sorted line ids from favorites', () => {
    mockUseFavorites.mockReturnValue({ favoritesWithDetails: [
      { lineId: '2' }, { lineId: '4' }, { lineId: '2' },
    ] });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual(['2', '4']);
  });
  it('returns empty array when there are no favorites', () => {
    mockUseFavorites.mockReturnValue({ favoritesWithDetails: [] });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual([]);
  });
  it('skips entries without a lineId', () => {
    mockUseFavorites.mockReturnValue({ favoritesWithDetails: [{ lineId: '2' }, { lineId: undefined }] });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual(['2']);
  });
});
```
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현**
```ts
import { useMemo } from 'react';
import { useFavorites } from '@hooks/useFavorites';

export function useWatchedLineIds(): readonly string[] {
  const { favoritesWithDetails } = useFavorites();
  return useMemo(() => {
    const ids = new Set<string>();
    for (const fav of favoritesWithDetails) {
      if (fav.lineId) ids.add(fav.lineId);
    }
    return Array.from(ids).sort();
  }, [favoritesWithDetails]);
}

export default useWatchedLineIds;
```
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 커밋** — `feat(delay): useWatchedLineIds — 즐겨찾기 노선 셀렉터`

---

### Task 4: `useCommuteDelayAlerts` — 오케스트레이터 훅

**Files:**
- Create: `src/hooks/useCommuteDelayAlerts.ts`
- Test: `src/hooks/__tests__/useCommuteDelayAlerts.test.ts`

**Interfaces:**
- Consumes: `officialDelayService.getActiveDelays()`, `fireLineDelayAlert`(T2), `shouldAlert`/`nextDedupState`(T1), `notificationService.shouldSendNotification`, `NotificationType`, `useAuth`, `AppState`.
- Produces: `useCommuteDelayAlerts(watchedLineIds: readonly string[]): void`.

- [ ] **Step 1: 실패 테스트** (fake timers + 전 seam mock)
```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { officialDelayService } from '@services/delay/officialDelayService';
import { fireLineDelayAlert } from '@services/notification/lineDelayAlert';
import { notificationService } from '@services/notification/notificationService';
import { useAuth } from '@services/auth/AuthContext';
import { useCommuteDelayAlerts } from '../useCommuteDelayAlerts';

jest.mock('@services/delay/officialDelayService', () => ({ officialDelayService: { getActiveDelays: jest.fn() } }));
jest.mock('@services/notification/lineDelayAlert', () => ({ fireLineDelayAlert: jest.fn(() => Promise.resolve('id')) }));
jest.mock('@services/notification/notificationService', () => ({
  notificationService: { shouldSendNotification: jest.fn(() => true) },
  NotificationType: { DELAY_ALERT: 'delay_alert' },
}));
jest.mock('@services/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockGetActive = officialDelayService.getActiveDelays as jest.Mock;
const mockFire = fireLineDelayAlert as jest.Mock;
const mockShouldSend = notificationService.shouldSendNotification as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const delay = (lineId: string, status = 'delayed') => ({ lineId, lineName: `${lineId}호선`, status, updatedAt: new Date(0), source: 'seoul_metro' });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (AppState as unknown as { currentState: string }).currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  mockUseAuth.mockReturnValue({ user: { preferences: { notificationSettings: {} } } });
  mockShouldSend.mockReturnValue(true);
  mockGetActive.mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); });

it('fires an alert for a new delay on a watched line', async () => {
  mockGetActive.mockResolvedValue([delay('2'), delay('9')]);
  renderHook(() => useCommuteDelayAlerts(['2']));
  await waitFor(() => expect(mockFire).toHaveBeenCalledTimes(1));
  expect(mockFire.mock.calls[0][0].lineId).toBe('2');
});

it('ignores delays on unwatched lines', async () => {
  mockGetActive.mockResolvedValue([delay('9')]);
  renderHook(() => useCommuteDelayAlerts(['2']));
  await act(async () => { await Promise.resolve(); });
  expect(mockFire).not.toHaveBeenCalled();
});

it('does not re-fire the same delay on the next poll', async () => {
  mockGetActive.mockResolvedValue([delay('2')]);
  renderHook(() => useCommuteDelayAlerts(['2']));
  await waitFor(() => expect(mockFire).toHaveBeenCalledTimes(1));
  await act(async () => { jest.advanceTimersByTime(90_000); await Promise.resolve(); });
  expect(mockFire).toHaveBeenCalledTimes(1);
});

it('does not fire when shouldSendNotification is false', async () => {
  mockShouldSend.mockReturnValue(false);
  mockGetActive.mockResolvedValue([delay('2')]);
  renderHook(() => useCommuteDelayAlerts(['2']));
  await act(async () => { await Promise.resolve(); });
  expect(mockFire).not.toHaveBeenCalled();
});

it('does not poll when app is not active', async () => {
  (AppState as unknown as { currentState: string }).currentState = 'background';
  renderHook(() => useCommuteDelayAlerts(['2']));
  await act(async () => { await Promise.resolve(); });
  expect(mockGetActive).not.toHaveBeenCalled();
});

it('cleans up interval and AppState subscription on unmount', async () => {
  const remove = jest.fn();
  (AppState.addEventListener as jest.Mock).mockReturnValue({ remove });
  const clearSpy = jest.spyOn(global, 'clearInterval');
  mockGetActive.mockResolvedValue([]);
  const { unmount } = renderHook(() => useCommuteDelayAlerts(['2']));
  await act(async () => { await Promise.resolve(); });
  unmount();
  expect(remove).toHaveBeenCalled();
  clearSpy.mockRestore();
});
```
- [ ] **Step 2: 실패 확인** — jest → FAIL (module not found).
- [ ] **Step 3: 구현**
```ts
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { officialDelayService } from '@services/delay/officialDelayService';
import { fireLineDelayAlert } from '@services/notification/lineDelayAlert';
import { notificationService, NotificationType } from '@services/notification/notificationService';
import { useAuth } from '@services/auth/AuthContext';
import { shouldAlert, nextDedupState, type AlertedState } from '@services/notification/delayAlertDedup';

const POLL_MS = 90_000;

export function useCommuteDelayAlerts(watchedLineIds: readonly string[]): void {
  const { user } = useAuth();
  const watchedRef = useRef(watchedLineIds);
  watchedRef.current = watchedLineIds;
  const userRef = useRef(user);
  userRef.current = user;
  const dedupRef = useRef<Map<string, AlertedState>>(new Map());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async (): Promise<void> => {
      const watched = watchedRef.current;
      if (watched.length === 0) return;
      try {
        const active = await officialDelayService.getActiveDelays();
        const watchedActive = active.filter((d) => watched.includes(d.lineId));
        const settings = userRef.current?.preferences?.notificationSettings;
        for (const d of watchedActive) {
          if (!shouldAlert(dedupRef.current, d)) continue;
          const allowed = settings
            ? notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT)
            : true;
          if (allowed) await fireLineDelayAlert(d);
        }
        dedupRef.current = nextDedupState(watchedActive);
      } catch (error) {
        if (__DEV__) console.error('[useCommuteDelayAlerts] poll failed', error);
      }
    };

    const start = (): void => {
      if (timer) return;
      void check();
      timer = setInterval(() => void check(), POLL_MS);
    };
    const stop = (): void => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') start();
      else stop();
    });

    return () => { stop(); sub.remove(); };
  }, []);
}

export default useCommuteDelayAlerts;
```
- [ ] **Step 4: 통과 확인** — jest → PASS (6 cases).
- [ ] **Step 5: 커밋** — `feat(delay): useCommuteDelayAlerts — 포그라운드 공식 지연 모니터`

---

### Task 5: `App.tsx` 배선

**Files:**
- Modify: `App.tsx` (AppContent 본문 + import)

**Interfaces:**
- Consumes: `useWatchedLineIds`(T3), `useCommuteDelayAlerts`(T4).

- [ ] **Step 1: 구현** — import 추가(App.tsx 상대경로 컨벤션):
```ts
import { useWatchedLineIds } from './src/hooks/useWatchedLineIds';
import { useCommuteDelayAlerts } from './src/hooks/useCommuteDelayAlerts';
```
  `AppContent` 본문(`usePushRegistration();` 인근):
```ts
  // 포그라운드 동안 즐겨찾기/출퇴근 노선 공식 지연을 로컬 알림으로 발사.
  const watchedLineIds = useWatchedLineIds();
  useCommuteDelayAlerts(watchedLineIds);
```
  **주의**: `useWatchedLineIds`는 `useFavorites`를 호출하므로 `AppContent`가 `FavoritesProvider` 하위인지 확인(아니면 provider 안쪽 컴포넌트로 호출 이동).
- [ ] **Step 2: 타입 체크** — `npx tsc --noEmit` 0 errors.
- [ ] **Step 3: App 렌더 회귀** — App 테스트 있으면 실행; 없으면 tsc + 전체 sweep으로 충분.
- [ ] **Step 4: 커밋** — `feat(delay): app-root 포그라운드 지연 알림 배선`

---

### Task 6: 최종 검증

- [ ] **Step 1: 타입** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 2: 린트** — `npx eslint --no-ignore <변경 파일들>` → 0 errors(console warn 허용, 코드베이스 컨벤션).
- [ ] **Step 3: 관련 테스트** — `npx jest --runInBand --watchman=false src/services/notification src/services/delay src/hooks/__tests__/useWatchedLineIds src/hooks/__tests__/useCommuteDelayAlerts` → 0 failures.
- [ ] **Step 4: 커버리지 게이트** — `npx jest --runInBand --watchman=false --coverage` → All files 임계값(75/60/70/75) 상회.
- [ ] **Step 5: 의존 소비자 회귀** — `useFavorites`/`notificationService`/`officialDelayService` 소비자 sweep(usePredictionFactors 등) green.

## Self-Review
- **Spec coverage**: G1=T4(+T2 발사)·T5(배선) / G2=T4(shouldSendNotification) / G3=T1(dedup)·T4. §4.1=T3, §4.2=T4, §4.3=T1, §4.4=T2, §4.5=T5. 전부 대응. ✓
- **Placeholder scan**: 모든 코드 step에 실제 코드/명령. 단 T2의 `sendLocalNotification` public 여부·`NotificationPayload` 경로는 구현 중 확인(명시). ✓
- **Type consistency**: `OfficialDelay`/`DelayStatus`(officialDelayService) 전 태스크 일관; `AlertedState`(T1)→T4; `fireLineDelayAlert`(T2)→T4; `buildLineStatusPayload`→`NotificationPayload`; `useWatchedLineIds(): readonly string[]`(T3)→T5→T4 인자. ✓
