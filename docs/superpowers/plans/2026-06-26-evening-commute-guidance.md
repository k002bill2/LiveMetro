# 퇴근경로 시간 자동 전환 길안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 통근 카드를 시계 기반으로 출근/퇴근 자동 전환시켜, 오후엔 이미 저장된 퇴근 OD로 카드 전체(제목·facts·길안내 CTA)가 바뀌게 한다.

**Architecture:** 순수 헬퍼 `resolveActiveCommuteType(now)`가 active leg을 결정 → `useFirestoreMorningCommute`를 `useFirestoreCommuteLeg(leg)`로 일반화해 evening 저장을 읽음 → `useCommuteHeroEstimate`에 opt-in `direction` 파라미터 추가(기본 `'morning'`이라 WeeklyPrediction 무변경) → HomeScreen이 `'auto'`로 호출하고 active OD/제목을 배선. ML은 출근 단일 모델이라 퇴근은 그래프 추정치만 사용(정직).

**Tech Stack:** React Native 0.72 · TypeScript strict · Jest + React Native Testing Library · Firebase onSnapshot.

**설계 spec:** `docs/superpowers/specs/2026-06-26-evening-commute-guidance-design.md`

## Global Constraints

- TypeScript strict — `any` 금지, exported 함수 명시적 반환 타입.
- Path alias 필수: `@/`, `@hooks/`, `@components/`, `@screens/`, `@services/`, `@utils/`, `@models/`. 상대경로 import 금지.
- 서비스/훅 에러 정책: throw 금지, `null` 반환.
- 프로덕션 코드 `console.log` 금지 (`console.warn` 진단은 기존 패턴 한정 허용).
- 시간 경계는 **로컬 wall-clock 시각**(`Date.getHours()`). 테스트는 `new Date(y,m,d,hour,...)` 로컬 생성으로 TZ flake 회피.
- `direction` 기본값 `'morning'` 불변 — WeeklyPredictionScreen은 한 줄도 건드리지 않는다(회귀 0).
- 퇴근 카드 헤드라인 분은 **그래프 ride 추정치**만 (ML 재사용 금지). 퇴근 미설정·토글 off → 설정 placeholder.
- 각 태스크: 검증 게이트 `npx tsc --noEmit` (exit 0) + `npx jest <파일> --watchman=false --runInBand` (0 fail) 후 커밋.

---

### Task 1: `resolveActiveCommuteType` 순수 헬퍼

**Files:**
- Create: `src/utils/commuteSchedule.ts`
- Test: `src/utils/__tests__/commuteSchedule.test.ts`

**Interfaces:**
- Produces: `type CommuteLeg = 'morning' | 'evening'`; `resolveActiveCommuteType(now: Date): CommuteLeg`.

- [ ] **Step 1: 실패 테스트 작성** — `src/utils/__tests__/commuteSchedule.test.ts`

```ts
import { resolveActiveCommuteType } from '@utils/commuteSchedule';

/** 로컬 wall-clock 시각으로 Date 생성 — getHours()가 hour를 그대로 반환(TZ-safe). */
const at = (hour: number, minute = 0): Date =>
  new Date(2026, 5, 26, hour, minute, 0, 0);

describe('resolveActiveCommuteType', () => {
  it('05:59 → morning (새벽, 다음 이동=출근)', () => {
    expect(resolveActiveCommuteType(at(5, 59))).toBe('morning');
  });
  it('06:00 → morning (출근 active 시작)', () => {
    expect(resolveActiveCommuteType(at(6, 0))).toBe('morning');
  });
  it('10:59 → morning (출근 구간 내)', () => {
    expect(resolveActiveCommuteType(at(10, 59))).toBe('morning');
  });
  it('11:00 → evening (다음 이동=퇴근으로 전환)', () => {
    expect(resolveActiveCommuteType(at(11, 0))).toBe('evening');
  });
  it('16:59 → evening (오후, 퇴근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(16, 59))).toBe('evening');
  });
  it('17:00 → evening (퇴근 active 시작)', () => {
    expect(resolveActiveCommuteType(at(17, 0))).toBe('evening');
  });
  it('22:59 → evening (퇴근 구간 내)', () => {
    expect(resolveActiveCommuteType(at(22, 59))).toBe('evening');
  });
  it('23:00 → morning (다음 이동=출근으로 복귀)', () => {
    expect(resolveActiveCommuteType(at(23, 0))).toBe('morning');
  });
  it('00:00 → morning (자정, 출근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(0, 0))).toBe('morning');
  });
  it('03:00 → morning (심야, 출근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(3, 0))).toBe('morning');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/utils/__tests__/commuteSchedule.test.ts --watchman=false --runInBand`
Expected: FAIL — `Cannot find module '@utils/commuteSchedule'`.

- [ ] **Step 3: 구현** — `src/utils/commuteSchedule.ts`

```ts
/**
 * commuteSchedule — 시간대 → active 통근 leg 해석 (홈 통근 카드 출근/퇴근 자동 전환).
 *
 * `useAutoCommuteLog.detectCommuteType`(로깅 게이트라 공백 구간 null)과 달리, 이 리졸버는
 * 절대 null을 반환하지 않는다: "지금 가장 관련 있는 이동"을 다음 이동 기준으로 답해
 * 카드가 항상 보여줄 방향을 갖게 한다.
 *
 *   morning = 23:00–11:00 (출근 active 06–11 + 심야/새벽: 다음 이동=출근)
 *   evening = 11:00–23:00 (퇴근 active 17–23 + 오후: 다음 이동=퇴근)
 *
 * 경계는 로컬 wall-clock 시각(사용자 기기 TZ) — 통근자가 "아침/저녁"을 생각하는 방식과 일치.
 */
export type CommuteLeg = 'morning' | 'evening';

/** 이 시각(포함)부터 active leg이 morning→evening으로 전환. */
const EVENING_START_HOUR = 11;
/** 이 시각(포함)부터 active leg이 evening→morning으로 전환. */
const MORNING_START_HOUR = 23;

export function resolveActiveCommuteType(now: Date): CommuteLeg {
  const hour = now.getHours();
  // evening은 [11, 23) 구간; 그 외(23–24, 0–11)는 전부 morning.
  return hour >= EVENING_START_HOUR && hour < MORNING_START_HOUR
    ? 'evening'
    : 'morning';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/utils/__tests__/commuteSchedule.test.ts --watchman=false --runInBand`
Expected: PASS (11 tests).

- [ ] **Step 5: tsc + 커밋**

```bash
npx tsc --noEmit && \
git add src/utils/commuteSchedule.ts src/utils/__tests__/commuteSchedule.test.ts && \
git commit -m "feat(commute): resolveActiveCommuteType — 시간대별 active 통근 leg 순수 헬퍼"
```

---

### Task 2: `useFirestoreMorningCommute` → `useFirestoreCommuteLeg` 일반화

**Files:**
- Modify: `src/hooks/useFirestoreMorningCommute.ts` (전체 교체)
- Test: `src/hooks/__tests__/useFirestoreCommuteLeg.test.ts` (신규)

**Interfaces:**
- Consumes: `CommuteLeg` (Task 1), `subscribeCommuteRoutes(uid, cb)` → `cb(settings: CommuteSettings | null)` where `CommuteSettings = { morningRoute: CommuteRoute | null; eveningRoute: CommuteRoute | null; eveningEnabled: boolean; … }`.
- Produces: `useFirestoreCommuteLeg(uid?: string, leg: CommuteLeg, refreshNonce?: number, enabled?: boolean): CommuteTime | null`; `useFirestoreMorningCommute(uid?, refreshNonce?)` thin wrapper (보존).

- [ ] **Step 1: 실패 테스트 작성** — `src/hooks/__tests__/useFirestoreCommuteLeg.test.ts`

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirestoreCommuteLeg } from '@hooks/useFirestoreMorningCommute';

const mockSubscribe = jest.fn();
jest.mock('@/services/commute/commuteService', () => ({
  subscribeCommuteRoutes: (uid: string, cb: (s: unknown) => void) =>
    mockSubscribe(uid, cb),
}));

const makeRoute = (over: Record<string, unknown> = {}) => ({
  departureTime: '08:00',
  departureStationId: '0220',
  arrivalStationId: '0239',
  bufferMinutes: 5,
  transferStations: [],
  ...over,
});

beforeEach(() => {
  mockSubscribe.mockReset();
  // Default: immediately deliver a settings object, return a no-op unsubscribe.
  mockSubscribe.mockImplementation((_uid: string, cb: (s: unknown) => void) => {
    cb({ morningRoute: makeRoute(), eveningRoute: makeRoute({ departureTime: '19:00' }), eveningEnabled: true });
    return () => {};
  });
});

describe('useFirestoreCommuteLeg', () => {
  it('morning leg reads morningRoute → CommuteTime', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('u1', 'morning'));
    await waitFor(() => expect(result.current?.departureTime).toBe('08:00'));
    expect(result.current?.stationId).toBe('0220');
    expect(result.current?.destinationStationId).toBe('0239');
  });

  it('evening leg reads eveningRoute → CommuteTime', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('u1', 'evening'));
    await waitFor(() => expect(result.current?.departureTime).toBe('19:00'));
  });

  it('evening leg returns null when eveningEnabled is false (toggled off)', async () => {
    mockSubscribe.mockImplementation((_uid: string, cb: (s: unknown) => void) => {
      cb({ morningRoute: makeRoute(), eveningRoute: makeRoute({ departureTime: '19:00' }), eveningEnabled: false });
      return () => {};
    });
    const { result } = renderHook(() => useFirestoreCommuteLeg('u1', 'evening'));
    // give the effect a tick; value must stay null
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('returns null when the leg route is incomplete (missing arrival id)', async () => {
    mockSubscribe.mockImplementation((_uid: string, cb: (s: unknown) => void) => {
      cb({ morningRoute: makeRoute({ arrivalStationId: undefined }), eveningRoute: null, eveningEnabled: true });
      return () => {};
    });
    const { result } = renderHook(() => useFirestoreCommuteLeg('u1', 'morning'));
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('does not subscribe when enabled=false (no-op)', () => {
    renderHook(() => useFirestoreCommuteLeg('u1', 'evening', 0, false));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when uid is undefined', () => {
    renderHook(() => useFirestoreCommuteLeg(undefined, 'morning'));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});

describe('useFirestoreMorningCommute (back-compat wrapper)', () => {
  it('still reads morningRoute', async () => {
    const { useFirestoreMorningCommute } = require('@hooks/useFirestoreMorningCommute');
    const { result } = renderHook(() => useFirestoreMorningCommute('u1'));
    await waitFor(() => expect(result.current?.departureTime).toBe('08:00'));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/hooks/__tests__/useFirestoreCommuteLeg.test.ts --watchman=false --runInBand`
Expected: FAIL — `useFirestoreCommuteLeg` is not exported.

- [ ] **Step 3: 구현** — `src/hooks/useFirestoreMorningCommute.ts` 전체를 아래로 교체

```ts
/**
 * useFirestoreCommuteLeg — bridge between onboarding-side commute settings
 * (Firestore `commuteSettings/<uid>`) and the HomeScreen-side `CommuteTime`
 * shape. Reads the morning OR evening leg and adapts the row to `CommuteTime`.
 *
 * Background: onboarding persists via `saveCommuteRoutes(uid, morning, evening)`
 * to a dedicated collection; the HomeScreen card historically read only the
 * profile `morningCommute`. This hook bridges the onboarding store as a
 * uniform fallback, now for either leg.
 *
 * Returns `null` when: no uid, disabled (`enabled=false`), the evening leg is
 * toggled off (`eveningEnabled === false`), the leg route is missing/incomplete,
 * or on read error (logged inside commuteService).
 */
import { useEffect, useState } from 'react';
import { subscribeCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteTime } from '@/models/user';
import type { CommuteLeg } from '@/utils/commuteSchedule';

export function useFirestoreCommuteLeg(
  uid: string | undefined,
  leg: CommuteLeg,
  // Bump to force the live subscription to re-establish (focus refresh).
  refreshNonce: number = 0,
  // When false, skip the subscription entirely (the inactive leg in 'morning'
  // direction should not open a needless onSnapshot).
  enabled: boolean = true,
): CommuteTime | null {
  const [value, setValue] = useState<CommuteTime | null>(null);

  useEffect(() => {
    if (!uid || !enabled) {
      setValue(null);
      return;
    }
    const unsubscribe = subscribeCommuteRoutes(uid, (settings) => {
      const route = leg === 'morning' ? settings?.morningRoute : settings?.eveningRoute;
      // Respect the evening leg toggle: a saved-but-disabled 퇴근 route reads as
      // "not set" (legacy docs without the flag default to enabled = true).
      const legDisabled = leg === 'evening' && settings?.eveningEnabled === false;
      if (
        legDisabled ||
        !route ||
        !route.departureStationId ||
        !route.arrivalStationId ||
        !route.departureTime
      ) {
        if (settings && !legDisabled) {
          // Presence-only log (never the values — commute route is user data).
          console.warn(
            `[useFirestoreCommuteLeg] commute document found but ${leg} ` +
              'route is incomplete — falling back to null',
            {
              leg,
              hasRoute: !!route,
              hasDepartureStationId: !!route?.departureStationId,
              hasArrivalStationId: !!route?.arrivalStationId,
              hasDepartureTime: !!route?.departureTime,
            },
          );
        }
        setValue(null);
        return;
      }
      setValue({
        departureTime: route.departureTime,
        stationId: route.departureStationId,
        destinationStationId: route.arrivalStationId,
        bufferMinutes: route.bufferMinutes ?? 0,
        // First chosen transfer drives the via-constrained canonical route.
        transferStationId: route.transferStations?.[0]?.stationId,
      });
    });
    return unsubscribe;
  }, [uid, leg, refreshNonce, enabled]);

  return value;
}

/**
 * useFirestoreMorningCommute — back-compat wrapper preserving the original
 * morning-only signature for existing callers (useCommuteHeroEstimate, tests).
 */
export function useFirestoreMorningCommute(
  uid: string | undefined,
  refreshNonce: number = 0,
): CommuteTime | null {
  return useFirestoreCommuteLeg(uid, 'morning', refreshNonce);
}

export default useFirestoreMorningCommute;
```

- [ ] **Step 4: 통과 확인 (신규 + 기존 회귀)**

Run: `npx jest src/hooks/__tests__/useFirestoreCommuteLeg.test.ts src/hooks/__tests__/useFirestoreMorningCommute.test.ts --watchman=false --runInBand`
Expected: PASS (신규 7 + 기존 모두). 기존 `useFirestoreMorningCommute.test.ts`가 있으면 그대로 통과해야 한다(wrapper가 동일 동작 보존). 없으면 신규 파일만 PASS.

- [ ] **Step 5: tsc + 커밋**

```bash
npx tsc --noEmit && \
git add src/hooks/useFirestoreMorningCommute.ts src/hooks/__tests__/useFirestoreCommuteLeg.test.ts && \
git commit -m "feat(commute): useFirestoreCommuteLeg — morning/evening leg 일반화 + eveningEnabled 게이트"
```

---

### Task 3: `useCommuteHeroEstimate` 방향 인식 (opt-in `direction`)

**Files:**
- Modify: `src/hooks/useCommuteHeroEstimate.ts`
- Test: `src/hooks/__tests__/useCommuteHeroEstimate.test.ts` (확장 — describe 'direction=auto' 추가)

**Interfaces:**
- Consumes: `resolveActiveCommuteType` (Task 1), `useFirestoreCommuteLeg` (Task 2), `isUsableCommuteTime`, `CommuteTime`.
- Produces: `useCommuteHeroEstimate(refreshNonce?: number, direction?: 'morning' | 'auto'): CommuteHeroEstimate` with **added** fields `activeCommute: CommuteTime | null`, `activeCommuteType: CommuteLeg`. 기존 필드(`morningCommute`, `routeSummary`, `commuteStationNames`, `effectiveHero`, `effectiveDepartureTime`, `hasRealPrediction`, `profileMorningCommute`, `onboardingMorningCommute`) 보존.

- [ ] **Step 1: 실패 테스트 작성** — `useCommuteHeroEstimate.test.ts`에 아래 describe 추가

```ts
// 상단 import 영역에 추가:
import * as commuteSchedule from '@utils/commuteSchedule';
// (기존 mock들 — useMLPrediction, useFirestoreMorningCommute/Leg, trainService,
//  useCommuteRouteSummary, AuthContext — 는 기존 테스트 설정을 재사용. evening
//  leg를 검증하려면 useFirestoreCommuteLeg mock이 leg 인자에 따라 분기하도록 설정.)

describe('useCommuteHeroEstimate direction=auto (evening switch)', () => {
  afterEach(() => jest.restoreAllMocks());

  it("PM + 퇴근설정 → activeCommuteType='evening', 그래프 추정치(ML 무시)", () => {
    jest.spyOn(commuteSchedule, 'resolveActiveCommuteType').mockReturnValue('evening');
    // useFirestoreCommuteLeg mock이 leg==='evening'에 evening OD를 반환하도록 설정,
    // useCommuteRouteSummary mock이 ready+rideMinutes를 반환하도록 설정,
    // trainService.getStation mock이 origin/dest 이름을 해석하도록 설정,
    // useMLPrediction mock이 prediction 객체를 반환(=morning ML 존재)하도록 설정.
    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));
    expect(result.current.activeCommuteType).toBe('evening');
    expect(result.current.activeCommute?.stationId).toBe(/* evening 출발역 id */ EVENING_FROM);
    // ML이 존재해도 evening에선 그래프 추정치만 → hasRealPrediction=false
    expect(result.current.hasRealPrediction).toBe(false);
  });

  it("AM + 출근설정 → activeCommuteType='morning', 오늘과 동일(ML 적용)", () => {
    jest.spyOn(commuteSchedule, 'resolveActiveCommuteType').mockReturnValue('morning');
    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));
    expect(result.current.activeCommuteType).toBe('morning');
    expect(result.current.hasRealPrediction).toBe(true);
  });

  it('PM + 퇴근 null → activeCommute null', () => {
    jest.spyOn(commuteSchedule, 'resolveActiveCommuteType').mockReturnValue('evening');
    // useFirestoreCommuteLeg('evening') mock → null, profile evening 없음
    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));
    expect(result.current.activeCommute).toBeNull();
  });

  it("기본 direction='morning' → activeCommuteType='morning' (회귀 — Weekly 보호)", () => {
    const { result } = renderHook(() => useCommuteHeroEstimate());
    expect(result.current.activeCommuteType).toBe('morning');
    // morningCommute 필드는 기존 동작 그대로
  });
});
```

> 구현자 메모: 기존 `useCommuteHeroEstimate.test.ts`의 mock 구조(특히 `useFirestoreMorningCommute`/`useCommuteRouteSummary`/`useMLPrediction`/`trainService`/`AuthContext` mock)를 먼저 읽고, evening leg 분기를 위해 `useFirestoreCommuteLeg`를 leg 인자로 분기하는 mock으로 보강한다. `EVENING_FROM` 등은 mock에 넣은 실제 id로 치환.

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/hooks/__tests__/useCommuteHeroEstimate.test.ts --watchman=false --runInBand`
Expected: FAIL — `activeCommuteType`/`activeCommute` undefined, evening 분기 미구현.

- [ ] **Step 3: 구현** — `useCommuteHeroEstimate.ts` 수정

3a. import 추가:
```ts
import { resolveActiveCommuteType, type CommuteLeg } from '@/utils/commuteSchedule';
import { useFirestoreCommuteLeg } from '@/hooks/useFirestoreMorningCommute';
```

3b. `CommuteHeroEstimate` 인터페이스에 필드 추가:
```ts
  /** Time-resolved active commute (morning or evening). HomeScreen consumes this. */
  activeCommute: CommuteTime | null;
  /** Which leg is active right now ('morning' for direction='morning'). */
  activeCommuteType: CommuteLeg;
```

3c. 시그니처에 `direction` 추가:
```ts
export function useCommuteHeroEstimate(
  refreshNonce: number = 0,
  direction: 'morning' | 'auto' = 'morning',
): CommuteHeroEstimate {
```

3d. morning 해석 직후(기존 `morningCommute` 산출 다음)에 activeLeg + evening 해석 + activeCommute 추가:
```ts
  // morningCommute 산출(기존) — 필드명 진실 유지, ML이 morning 기반이라 항상 해석.
  // ...(기존 morningCommute 라인 그대로)...

  const activeLeg: CommuteLeg =
    direction === 'auto' ? resolveActiveCommuteType(new Date()) : 'morning';

  // Evening leg — only subscribed in 'auto' mode (enabled gate avoids a needless
  // onSnapshot for WeeklyPrediction / 'morning' callers).
  const profileEveningCommute =
    user?.preferences.commuteSchedule?.weekdays?.eveningCommute;
  const onboardingEveningCommute = useFirestoreCommuteLeg(
    user?.id,
    'evening',
    refreshNonce,
    direction === 'auto',
  );
  const eveningCommute =
    (isUsableCommuteTime(profileEveningCommute) ? profileEveningCommute : null) ??
    onboardingEveningCommute;

  const activeCommute: CommuteTime | null =
    activeLeg === 'evening' ? eveningCommute : morningCommute;
```

3e. `routeSummary`를 `activeCommute` 기준으로 변경:
```ts
  const routeSummary = useCommuteRouteSummary(
    activeCommute?.stationId,
    activeCommute?.destinationStationId,
    activeCommute?.transferStationId,
  );
```

3f. 역이름 effect를 `activeCommute` 기준으로 변경 (기존 `morningCommute` 3곳 → `activeCommute`):
```ts
  useEffect(() => {
    if (!activeCommute) {
      setCommuteStationNames({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [origin, dest] = await Promise.all([
          trainService.getStation(activeCommute.stationId).catch(() => null),
          trainService.getStation(activeCommute.destinationStationId).catch(() => null),
        ]);
        if (cancelled) return;
        setCommuteStationNames({
          origin: origin?.name,
          destination: dest?.name,
          originLineId: origin?.lineId,
        });
      } catch {
        // ignore — consumers tolerate missing endpoint names
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCommute]);
```

3g. `registeredCommuteHero`를 `activeCommute` 기준으로 변경 (기존 `morningCommute` → `activeCommute`):
```ts
  const registeredCommuteHero = useMemo<CommuteHeroValue | null>(() => {
    if (!activeCommute) return null;
    if (!commuteStationNames.origin || !commuteStationNames.destination) return null;
    if (!routeSummary.ready || routeSummary.rideMinutes === undefined) return null;
    const arrival = addMinutesToHHmm(
      activeCommute.departureTime,
      routeSummary.rideMinutes,
    );
    if (!arrival) return null;
    return {
      predictedMinutes: routeSummary.rideMinutes,
      deltaMinutes: undefined,
      arrivalTime: arrival,
      confidence: undefined,
      origin: commuteStationNames.origin,
      destination: commuteStationNames.destination,
    };
  }, [activeCommute, commuteStationNames, routeSummary]);
```

3h. ML 게이팅 — `effectiveHero` / `effectiveDepartureTime` / `hasRealPrediction` 변경:
```ts
  // ML(heroProps)은 morning 기반 단일 모델 → morning leg에서만 기여. evening은
  // 그래프 추정치(registeredCommuteHero)만 사용(방향 오인 회피, 정직).
  const effectiveHero =
    (activeLeg === 'morning' ? heroProps : null) ?? registeredCommuteHero;

  const effectiveDepartureTime =
    (activeLeg === 'morning' ? mlPrediction?.predictedDepartureTime : undefined) ??
    activeCommute?.departureTime;

  // ...return 객체...
  return {
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    activeCommute,
    activeCommuteType: activeLeg,
    routeSummary,
    commuteStationNames,
    effectiveHero,
    effectiveDepartureTime,
    hasRealPrediction: activeLeg === 'morning' && mlPrediction !== null,
  };
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/hooks/__tests__/useCommuteHeroEstimate.test.ts --watchman=false --runInBand`
Expected: PASS (기존 + 신규 4). 기존 테스트가 깨지면 mock에 evening leg(null 기본) 보강 필요 — 단 `activeCommuteType==='morning'` 기본이라 기존 동작 동일해야 한다.

- [ ] **Step 5: tsc + 커밋**

```bash
npx tsc --noEmit && \
git add src/hooks/useCommuteHeroEstimate.ts src/hooks/__tests__/useCommuteHeroEstimate.test.ts && \
git commit -m "feat(commute): useCommuteHeroEstimate direction=auto — 시간대별 active leg + 퇴근 그래프 추정치"
```

---

### Task 4: `CommuteRouteCard` 메인 카드 `title` 프롭화

**Files:**
- Modify: `src/components/design/CommuteRouteCard.tsx`
- Test: `src/components/design/__tests__/CommuteRouteCard.test.tsx` (확장)

**Interfaces:**
- Produces: `CommuteRouteCardProps`에 `title?: string` 추가 (기본 `'오늘의 출근 경로'`). 헤더 라벨 + accessibilityLabel에 사용.

- [ ] **Step 1: 실패 테스트 작성** — `CommuteRouteCard.test.tsx`에 추가

```ts
it('renders the provided title (퇴근) in the header', () => {
  const { getByText } = render(
    <CommuteRouteCard origin="잠실" destination="홍대입구" title="오늘의 퇴근 경로" />,
  );
  expect(getByText('오늘의 퇴근 경로')).toBeTruthy();
});

it("defaults the title to '오늘의 출근 경로' when omitted", () => {
  const { getByText } = render(
    <CommuteRouteCard origin="홍대입구" destination="잠실" />,
  );
  expect(getByText('오늘의 출근 경로')).toBeTruthy();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/design/__tests__/CommuteRouteCard.test.tsx --watchman=false --runInBand`
Expected: FAIL — '오늘의 퇴근 경로' not found (title 프롭 미지원, 헤더 하드코딩).

- [ ] **Step 3: 구현** — 3곳 수정

3a. `CommuteRouteCardProps`에 prop 추가 (interface 내, `origin?` 위 또는 인접):
```ts
  /** Card header label. Defaults to the morning copy. */
  title?: string;
```

3b. 구조분해 + 기본값 (`CommuteRouteCardImpl`의 props 구조분해에 `title` 추가):
```ts
const CommuteRouteCardImpl: React.FC<CommuteRouteCardProps> = ({
  title = '오늘의 출근 경로',
  origin,
  destination,
  // ...나머지 동일...
}) => {
```

3c. accessibilityLabel(기존 `'오늘의 출근 경로'` 리터럴)과 헤더 라벨(`오늘의 출근 경로` 텍스트)을 `title`로 치환:
```ts
  const accessibilityLabel = [
    title,
    `${origin}에서 ${destination}`,
    departureTime && arrivalTime ? `${departureTime}부터 ${arrivalTime}` : null,
    lineId ? `${lineId}호선 이용` : null,
  ]
    .filter(Boolean)
    .join(', ');
```
그리고 헤더:
```tsx
          <Text style={[styles.headerLabel, { color: semantic.labelAlt }]}>
            {title}
          </Text>
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/components/design/__tests__/CommuteRouteCard.test.tsx --watchman=false --runInBand`
Expected: PASS (기존 + 신규 2).

- [ ] **Step 5: tsc + 커밋**

```bash
npx tsc --noEmit && \
git add src/components/design/CommuteRouteCard.tsx src/components/design/__tests__/CommuteRouteCard.test.tsx && \
git commit -m "feat(commute): CommuteRouteCard title 프롭 — 출근/퇴근 헤더 분기"
```

---

### Task 5: HomeScreen 시간 자동 전환 배선

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx`
- Test: `src/screens/home/__tests__/HomeScreen.test.tsx` (확장)

**Interfaces:**
- Consumes: `useCommuteHeroEstimate(nonce, 'auto')` → `activeCommute`, `activeCommuteType` (Task 3); `CommuteRouteCard title` (Task 4).

- [ ] **Step 1: 실패 테스트 작성** — `HomeScreen.test.tsx`에 추가

```ts
// useCommuteHeroEstimate mock이 activeCommuteType/activeCommute를 반환하도록 보강.
it("evening 활성 시 통근 카드 제목이 '오늘의 퇴근 경로'", () => {
  // mockUseCommuteHeroEstimate가 activeCommuteType='evening',
  // commuteStationNames={origin:'잠실',destination:'홍대입구'},
  // activeCommute={stationId, destinationStationId, ...} 반환하도록 설정.
  const { getByText } = renderHome();
  expect(getByText('오늘의 퇴근 경로')).toBeTruthy();
});

it('evening 미설정 시(활성 commute 없음) 설정 placeholder 노출', () => {
  // mock: activeCommute=null, commuteStationNames={} (이름 없음),
  // activeCommuteType='evening'
  const { getByTestId } = renderHome();
  expect(getByTestId('commute-route-card-placeholder')).toBeTruthy();
});
```

> 구현자 메모: 기존 HomeScreen.test.tsx의 `useCommuteHeroEstimate` mock 반환에 `activeCommute`, `activeCommuteType`를 추가한다(없으면 morning 기본). `renderHome`은 기존 테스트의 렌더 헬퍼 명칭에 맞춰 치환.

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/screens/home/__tests__/HomeScreen.test.tsx --watchman=false --runInBand`
Expected: FAIL — 제목이 '오늘의 출근 경로' 고정이라 '오늘의 퇴근 경로' 미발견.

- [ ] **Step 3: 구현** — HomeScreen.tsx 4곳 수정

3a. 훅 호출에 `'auto'` + 구조분해에 active 필드 추가 (현 143–151):
```ts
  const {
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    activeCommute,
    activeCommuteType,
    routeSummary,
    commuteStationNames,
    effectiveHero,
    effectiveDepartureTime,
  } = useCommuteHeroEstimate(commuteRefreshNonce, 'auto');
```

3b. 길안내 핸들러를 `activeCommute`로 배선 (현 207–213):
```ts
  const startCommuteGuidance = useStartCommuteGuidance({
    fromStationId: activeCommute?.stationId,
    toStationId: activeCommute?.destinationStationId,
    viaTransferId: activeCommute?.transferStationId,
    fromStationName: commuteStationNames.origin,
    toStationName: commuteStationNames.destination,
  });
```

3c. 카드 제목 파생 상수 추가 (렌더 직전, 예: handleOpenCommuteSettings 정의 부근):
```ts
  const commuteCardTitle =
    activeCommuteType === 'evening' ? '오늘의 퇴근 경로' : '오늘의 출근 경로';
```

3d. 렌더 JSX에 `title` 전달 (현 402–417):
```tsx
        {commuteStationNames.origin && commuteStationNames.destination ? (
          <CommuteRouteCard
            title={commuteCardTitle}
            origin={commuteStationNames.origin}
            destination={commuteStationNames.destination}
            lineId={(routeSummary.lineId ?? commuteStationNames.originLineId) as LineId | undefined}
            departureTime={effectiveDepartureTime}
            arrivalTime={effectiveHero?.arrivalTime}
            rideMinutes={effectiveHero?.predictedMinutes}
            transferCount={routeSummary.transferCount}
            stationCount={routeSummary.stationCount}
            fareKrw={routeSummary.fareKrw}
            onPressEdit={handleOpenCommuteSettings}
            onStartGuidance={startCommuteGuidance ?? undefined}
            testID="home-commute-route-card"
          />
        ) : (
          <CommuteRouteCardPlaceholder
            title={commuteCardTitle}
            onPress={handleOpenCommuteSettings}
          />
        )}
```

> 참고: `useCommuteDiagnostics`에 넘기는 `morningCommute` 등은 그대로 둔다(진단은 morning 기준 유지, dev-only).

- [ ] **Step 4: 통과 확인 (전체 회귀 포함)**

Run: `npx jest src/screens/home/__tests__/HomeScreen.test.tsx --watchman=false --runInBand`
Expected: PASS (기존 + 신규 2).

- [ ] **Step 5: tsc + lint + 커밋**

```bash
npx tsc --noEmit && \
npx eslint src/screens/home/HomeScreen.tsx --max-warnings 0 && \
git add src/screens/home/HomeScreen.tsx src/screens/home/__tests__/HomeScreen.test.tsx && \
git commit -m "feat(commute): HomeScreen 시간 자동 전환 — 퇴근 OD 길안내 + 카드 제목/placeholder 분기"
```

---

### Task 6: 통합 검증 게이트 (커밋 없음 — green 확인)

- [ ] **Step 1: 전체 타입체크**

Run: `npx tsc --noEmit; echo "exit=$?"`
Expected: `exit=0`.

- [ ] **Step 2: 변경 영역 테스트 일괄**

Run: `npx jest src/utils/__tests__/commuteSchedule.test.ts src/hooks/__tests__/useFirestoreCommuteLeg.test.ts src/hooks/__tests__/useCommuteHeroEstimate.test.ts src/components/design/__tests__/CommuteRouteCard.test.tsx src/screens/home/__tests__/HomeScreen.test.tsx --watchman=false --runInBand`
Expected: 0 fail.

- [ ] **Step 3: lint (변경 파일)**

Run: `npx eslint src/utils/commuteSchedule.ts src/hooks/useFirestoreMorningCommute.ts src/hooks/useCommuteHeroEstimate.ts src/components/design/CommuteRouteCard.tsx src/screens/home/HomeScreen.tsx --max-warnings 0`
Expected: 0 errors.

- [ ] **Step 4: 회귀 확인 — WeeklyPredictionScreen 무영향**

Run: `npx jest src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx --watchman=false --runInBand`
Expected: PASS (direction 기본 'morning'이라 무변경).

---

## Self-Review

**1. Spec coverage:**
- §4.1 resolveActiveCommuteType → Task 1 ✓
- §4.2 useFirestoreCommuteLeg 일반화 + enabled → Task 2 ✓ (+ eveningEnabled 게이트, spec보다 강화)
- §4.3 hero 훅 방향 인식·ML 게이팅·신규 반환 → Task 3 ✓
- §4.4 HomeScreen 배선(auto·active OD·제목·placeholder) → Task 5 ✓
- §4.5 CommuteRouteCard title 프롭 → Task 4 ✓
- §6 테스트(경계 전수·leg read·auto 분기·회귀·HomeScreen) → 각 Task Step 1 + Task 6 ✓
- §2 Non-Goals(ML 퇴근 예측 안 함·역방향 파생 안 함·Weekly 무변경) → Task 3 ML 게이팅 + 기본 'morning' + Task 6 Step 4 ✓

**2. Placeholder scan:** Task 3/5의 테스트 mock 구체값(EVENING_FROM, renderHome 등)은 "기존 테스트 mock 구조에 맞춰 치환"으로 명시 — 구현자가 기존 파일을 읽고 채우는 의도적 위임(기존 mock 명칭을 plan이 단정할 수 없음). 구현 코드 블록엔 placeholder 없음.

**3. Type consistency:** `CommuteLeg`(Task1) → Task2/3 import 동일. `useFirestoreCommuteLeg(uid, leg, nonce, enabled)` 시그니처 Task2 정의 = Task3 호출 일치. `activeCommute`/`activeCommuteType` 필드명 Task3 정의 = Task5 소비 일치. `title` 프롭 Task4 정의 = Task5 전달 일치.
