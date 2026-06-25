# 출퇴근 동선 ↔ 라이브 길안내 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 홈 "오늘의 출근 경로" 카드에서 원탭으로 라이브 길안내를 시작하고, 진행 중엔 "안내 중" 배너로 복귀하며, 앱 재시작 후에도 세션이 유지(TTL 만료 가드)되게 한다.

**Architecture:** `guidanceSessionStore`를 observable+persistent로 승격하는 것이 중추. CTA는 기존 `GuidanceSession` 핸드오프 재사용. 버려지던 commute Route 계산을 `selectCommuteRoute` 순수 함수로 추출(SSOT).

**Tech Stack:** React Native 0.72 / Expo SDK 49 / TS strict / Jest + RNTL / AsyncStorage / `useSyncExternalStore`.

## Global Constraints
- Path alias 필수(신규 파일): `@/`, `@services/`, `@hooks/`, `@components/`, `@models/`. 상대경로 금지.
- 서비스/순수함수: 에러 시 `null`/`[]` 반환, throw 금지(`error-handling.md`).
- 컴포넌트: `StyleSheet.create`, `React.memo`, 터치 ≥44pt, `accessibilityLabel` 필수, 하드코딩 색상 금지(semantic/WANTED_TOKENS).
- 테스트 실행: `npx jest --runInBand --watchman=false <path>` (병렬 워커가 이 샌드박스에서 크래시 — exit 144).
- 커밋: Conventional Commits, surgical(요청 파일만 stage). co-author 푸터 포함.
- TTL 상수: `GUIDANCE_SESSION_TTL_MS = 3 * 60 * 60 * 1000`. 저장 키: `@livemetro/guidance_session`.
- CTA 카피: "이 경로로 길안내 시작" (경로탭과 일치). 배너 카피: "안내 중".

---

### Task 1: `selectCommuteRoute` 순수 선택기 (SSOT 추출)

**Files:**
- Create: `src/services/route/selectCommuteRoute.ts`
- Test: `src/services/route/__tests__/selectCommuteRoute.test.ts`

**Interfaces:**
- Consumes: `getDiverseRoutes`, `routeVia`, `resolveInternalStationId`, `Route`.
- Produces: `selectCommuteRoute(fromStationId?: string, toStationId?: string, viaTransferId?: string): Route | null`

- [ ] **Step 1: 실패 테스트 작성** — 케이스: (a) 정상 OD → `route.segments.length>0` truthy, (b) id 누락 → null, (c) 동일역 → null, (d) 미해결 id(resolve→null mock) → null, (e) via 지정 시 `routeVia` 경유. graph 함수는 실제 데이터로 호출(역 slug는 기존 테스트 픽스처 참조: 예 `getDiverseRoutes` 통과하는 실제 두 역). resolver는 통과시킴.
- [ ] **Step 2: 실패 확인** — `npx jest --runInBand --watchman=false src/services/route/__tests__/selectCommuteRoute.test.ts` → FAIL (module not found).
- [ ] **Step 3: 구현** — `useCommuteRouteSummary.ts:57-97`의 정규화+선택 로직 추출:
```ts
import { getDiverseRoutes } from '@services/route';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import type { Route } from '@/models/route';

export function selectCommuteRoute(
  fromStationId?: string,
  toStationId?: string,
  viaTransferId?: string,
): Route | null {
  if (!fromStationId || !toStationId || fromStationId === toStationId) return null;
  const fromSlug = resolveInternalStationId(fromStationId);
  const toSlug = resolveInternalStationId(toStationId);
  if (!fromSlug || !toSlug || fromSlug === toSlug) return null;
  try {
    const viaSlug = viaTransferId ? resolveInternalStationId(viaTransferId) : null;
    const route = viaSlug ? routeVia(fromSlug, viaSlug, toSlug) : getDiverseRoutes(fromSlug, toSlug)[0] ?? null;
    return route ?? null;
  } catch {
    return null;
  }
}
export default selectCommuteRoute;
```
- [ ] **Step 4: 통과 확인** — 위 jest 명령 → PASS.
- [ ] **Step 5: 커밋** — `git add src/services/route/selectCommuteRoute.ts src/services/route/__tests__/selectCommuteRoute.test.ts && git commit` — `refactor(route): commute OD→Route 선택 로직 selectCommuteRoute로 추출 (SSOT)`

---

### Task 2: `useCommuteRouteSummary` / `useCommuteRouteSteps` → selector 사용 (DRY)

**Files:**
- Modify: `src/hooks/useCommuteRouteSummary.ts:86-108`, `src/hooks/useCommuteRouteSteps.ts:44-64`
- Test: 기존 `src/hooks/__tests__/useCommuteRouteSteps.test.*` (회귀 보존)

**Interfaces:**
- Consumes: `selectCommuteRoute` (Task 1).

- [ ] **Step 1: 회귀 기준 실행** — `npx jest --runInBand --watchman=false src/hooks/useCommuteRouteSteps` → 현재 PASS 수 기록.
- [ ] **Step 2: 리팩터** — 두 훅 모두 내부 정규화+선택 블록을 `const route = selectCommuteRoute(fromStationId, toStationId, viaTransferId);` 한 줄로 치환. 이후 로직(`route.segments.filter…` / `routeToGuidanceSteps(route)`)은 유지. `resolveInternalStationId`/`routeVia`/`getDiverseRoutes` import가 더 이상 안 쓰이면 제거(summary는 `fareService`만 남김).
- [ ] **Step 3: 회귀 통과 확인** — 동일 jest → PASS 수 동일.
- [ ] **Step 4: 타입 체크** — `npx tsc --noEmit` (해당 파일 에러 0).
- [ ] **Step 5: 커밋** — `refactor(commute): 두 경로 훅을 selectCommuteRoute로 통일 (복붙 제거)`

---

### Task 3: `guidanceSessionStore` v2 — observable + persistent + TTL

**Files:**
- Modify (rewrite): `src/services/guidance/guidanceSessionStore.ts`
- Test: `src/services/guidance/__tests__/guidanceSessionStore.test.ts`

**Interfaces:**
- Consumes: `GuidanceSession` (`@/models/guidance`), `AsyncStorage`.
- Produces:
  - `getGuidanceSession(): GuidanceSession | null` (sync)
  - `setGuidanceSession(session: GuidanceSession): void`
  - `clearGuidanceSession(): void`
  - `subscribe(listener: () => void): () => void`
  - `hydrateGuidanceSession(nowMs?: number): Promise<void>`
  - `isSessionExpired(session: GuidanceSession, nowMs: number): boolean`
  - `GUIDANCE_SESSION_TTL_MS: number`

- [ ] **Step 1: 실패 테스트 작성** — AsyncStorage mock(기존 패턴 `src/services/statistics/__tests__/statisticsService.test.ts` 참조). 케이스:
  - set→get 동일 세션 반환, set이 AsyncStorage.setItem(key) 호출
  - subscribe 리스너가 set/clear 시 호출, 반환 함수로 unsubscribe
  - clear→get null + AsyncStorage.removeItem(key)
  - `isSessionExpired`: startedAt이 now-TTL 직전=false, 초과=true 경계
  - hydrate: 유효 저장본 → get 복원 + 리스너 emit
  - **hydrate: 만료 저장본 → get null + removeItem 호출** (좀비 방지)
  - hydrate: 저장 없음 → get null, throw 없음
- [ ] **Step 2: 실패 확인** — `npx jest --runInBand --watchman=false src/services/guidance/__tests__/guidanceSessionStore.test.ts` → FAIL.
- [ ] **Step 3: 구현**
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GuidanceSession } from '@/models/guidance';

const STORAGE_KEY = '@livemetro/guidance_session';
export const GUIDANCE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

let current: GuidanceSession | null = null;
const listeners = new Set<() => void>();
const emit = (): void => { listeners.forEach((l) => l()); };

export const getGuidanceSession = (): GuidanceSession | null => current;

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const isSessionExpired = (session: GuidanceSession, nowMs: number): boolean =>
  nowMs - session.startedAt > GUIDANCE_SESSION_TTL_MS;

export const setGuidanceSession = (session: GuidanceSession): void => {
  current = { ...session };
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch((e) => {
    if (__DEV__) console.error('[guidanceSessionStore] persist failed', e);
  });
};

export const clearGuidanceSession = (): void => {
  current = null;
  emit();
  AsyncStorage.removeItem(STORAGE_KEY).catch((e) => {
    if (__DEV__) console.error('[guidanceSessionStore] clear persist failed', e);
  });
};

export const hydrateGuidanceSession = async (nowMs: number = Date.now()): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as GuidanceSession;
    if (!parsed || typeof parsed.startedAt !== 'number' || isSessionExpired(parsed, nowMs)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    current = parsed;
    emit();
  } catch (e) {
    if (__DEV__) console.error('[guidanceSessionStore] hydrate failed', e);
  }
};
```
- [ ] **Step 4: 통과 확인** — 동일 jest → PASS.
- [ ] **Step 5: 기존 길안내 회귀** — `npx jest --runInBand --watchman=false src/screens/guidance` → 12 PASS 유지.
- [ ] **Step 6: 커밋** — `feat(guidance): 세션 스토어를 observable+영속(TTL 가드)으로 승격`

---

### Task 4: `useGuidanceSession` 반응형 훅

**Files:**
- Create: `src/hooks/useGuidanceSession.ts`
- Test: `src/hooks/__tests__/useGuidanceSession.test.ts`

**Interfaces:**
- Consumes: `subscribe`, `getGuidanceSession` (Task 3).
- Produces: `useGuidanceSession(): GuidanceSession | null`

- [ ] **Step 1: 실패 테스트** — `renderHook`: 초기 null; `act(() => setGuidanceSession(s))` 후 result.current === s; `act(() => clearGuidanceSession())` 후 null.
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현**
```ts
import { useSyncExternalStore } from 'react';
import { subscribe, getGuidanceSession } from '@services/guidance/guidanceSessionStore';
import type { GuidanceSession } from '@/models/guidance';

export function useGuidanceSession(): GuidanceSession | null {
  return useSyncExternalStore(subscribe, getGuidanceSession, getGuidanceSession);
}
export default useGuidanceSession;
```
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 커밋** — `feat(guidance): useGuidanceSession 반응형 훅`

---

### Task 5: `useStartCommuteGuidance` 시작 핸들러 훅

**Files:**
- Create: `src/hooks/useStartCommuteGuidance.ts`
- Test: `src/hooks/__tests__/useStartCommuteGuidance.test.ts`

**Interfaces:**
- Consumes: `selectCommuteRoute` (Task 1), `setGuidanceSession` (Task 3), `useNavigation`.
- Produces: `useStartCommuteGuidance(args: { fromStationId?: string; toStationId?: string; viaTransferId?: string; fromStationName?: string; toStationName?: string }): (() => void) | null`

- [ ] **Step 1: 실패 테스트** — `selectCommuteRoute` jest.mock. navigation mock(`useNavigation` → {navigate}). 케이스: (a) route+이름 있음 → 함수 반환, 호출 시 `setGuidanceSession`(route/이름/startedAt 포함) + `navigate('RouteGuidance')`; (b) route null → null 반환; (c) 이름 누락 → null 반환. `setGuidanceSession`도 jest.mock.
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현**
```ts
import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { selectCommuteRoute } from '@services/route/selectCommuteRoute';
import { setGuidanceSession } from '@services/guidance/guidanceSessionStore';
import type { RootStackParamList } from '@/navigation/types';

interface StartCommuteGuidanceArgs {
  fromStationId?: string; toStationId?: string; viaTransferId?: string;
  fromStationName?: string; toStationName?: string;
}
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useStartCommuteGuidance(args: StartCommuteGuidanceArgs): (() => void) | null {
  const navigation = useNavigation<Nav>();
  const { fromStationId, toStationId, viaTransferId, fromStationName, toStationName } = args;
  const route = useMemo(
    () => selectCommuteRoute(fromStationId, toStationId, viaTransferId),
    [fromStationId, toStationId, viaTransferId],
  );
  const handler = useCallback(() => {
    if (!route || !fromStationName || !toStationName) return;
    setGuidanceSession({ route, fromStationName, toStationName, startedAt: Date.now() });
    navigation.navigate('RouteGuidance');
  }, [route, fromStationName, toStationName, navigation]);
  if (!route || !fromStationName || !toStationName) return null;
  return handler;
}
export default useStartCommuteGuidance;
```
- [ ] **Step 4: 통과 확인** — jest → PASS. (`RootStackParamList`에 `RouteGuidance` 존재 확인: `navigation/types.ts:153`.)
- [ ] **Step 5: 커밋** — `feat(commute): useStartCommuteGuidance — 출퇴근 OD로 길안내 시작 핸들러`

---

### Task 6: `GuidanceActiveBanner` — "안내 중" 복귀 배너

**Files:**
- Create: `src/components/guidance/GuidanceActiveBanner.tsx`
- Test: `src/components/guidance/__tests__/GuidanceActiveBanner.test.tsx`

**Interfaces:**
- Consumes: `useGuidanceSession` (Task 4), `useSemanticTokens`.
- Produces: `GuidanceActiveBanner: React.FC<{ onPress: () => void; hidden?: boolean; testID?: string }>`

- [ ] **Step 1: 실패 테스트** — `useGuidanceSession` jest.mock. 케이스: (a) 세션 null → `queryByTestId('guidance-active-banner')` null; (b) 세션 있음 → "안내 중" + "{from} → {to}" 텍스트, onPress 발화; (c) hidden=true → null. (atom 직접 import, semantic mock; 메모리 atom-barrel cascade 주의 — 직접 경로 import.)
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현** — `Pressable`(hitSlop, ≥44pt), `StyleSheet.create`, `React.memo`, `accessibilityRole="button"`, `accessibilityLabel={안내 중, ${from}에서 ${to}로 가는 길안내로 돌아가기}`. 색상은 `useSemanticTokens()`/`WANTED_TOKENS`. 세션 없음 또는 hidden → `return null`.
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 커밋** — `feat(guidance): GuidanceActiveBanner 안내 중 복귀 배너`

---

### Task 7: `CommuteRouteCard` — "길안내 시작" CTA

**Files:**
- Modify: `src/components/design/CommuteRouteCard.tsx` (props + fact grid 아래 버튼, styles)
- Test: Create `src/components/design/__tests__/CommuteRouteCard.test.tsx`

**Interfaces:**
- Produces: prop 추가 `onStartGuidance?: () => void` (CommuteRouteCardProps).

- [ ] **Step 1: 실패 테스트** — 케이스: (a) `onStartGuidance` 전달 → `getByTestId('commute-route-card-start')` 존재 + onPress 발화; (b) 미전달 → `queryByTestId('commute-route-card-start')` null; (c) origin/dest 누락 → 카드 null(기존 동작 보존). LineBadge/lucide mock 필요(기존 design 테스트 mock 패턴 참조).
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현** — `CommuteRouteCardProps`에 `onStartGuidance?: () => void` 추가. fact grid `</View>` 뒤(card `</View>` 직전)에:
```tsx
{onStartGuidance && (
  <Pressable
    testID="commute-route-card-start"
    onPress={onStartGuidance}
    accessibilityRole="button"
    accessibilityLabel={`${origin}에서 ${destination}까지 이 경로로 길안내 시작`}
    style={[styles.startCta, { backgroundColor: WANTED_TOKENS.blue[500] }]}
    hitSlop={4}
  >
    <Navigation size={14} color="#FFFFFF" strokeWidth={2.2} />
    <Text style={styles.startCtaText}>이 경로로 길안내 시작</Text>
  </Pressable>
)}
```
  `Navigation` 아이콘 lucide import 추가. `styles.startCta`(flexDirection row, gap, minHeight 44, borderRadius, justify center, marginTop) + `styles.startCtaText`(흰색, `weightToFontFamily('600')` 동반) 추가.
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 타입+린트** — `npx tsc --noEmit`; `npx eslint src/components/design/CommuteRouteCard.tsx --max-warnings 0` (typography 규칙 통과 확인).
- [ ] **Step 6: 커밋** — `feat(home): CommuteRouteCard에 길안내 시작 CTA`

---

### Task 8: `HomeScreen` 배선 — CTA + 배너

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx` (imports, CommuteRouteCard에 onStartGuidance, 상단 배너)
- Test: `src/screens/home/__tests__/HomeScreen.test.tsx` (해당 케이스 추가)

**Interfaces:**
- Consumes: `useStartCommuteGuidance` (Task 5), `GuidanceActiveBanner` (Task 6), `useCommuteHeroEstimate`의 `morningCommute`/`commuteStationNames`.

- [ ] **Step 1: 실패 테스트** — (a) 출근 등록 + selectCommuteRoute 해결(통합: 실제 OD or mock) 시 `commute-route-card-start` 노출 → 탭 시 `navigate('RouteGuidance')`; (b) 세션 활성(useGuidanceSession mock) 시 `guidance-active-banner` 노출 → 탭 시 navigate. 기존 HomeScreen mock 패턴 준수.
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현** — import 추가(`@hooks/useStartCommuteGuidance`, `@components/guidance/GuidanceActiveBanner`). `const startCommuteGuidance = useStartCommuteGuidance({ fromStationId: morningCommute?.stationId, toStationId: morningCommute?.destinationStationId, viaTransferId: morningCommute?.transferStationId, fromStationName: commuteStationNames.origin, toStationName: commuteStationNames.destination });` → `<CommuteRouteCard ... onStartGuidance={startCommuteGuidance ?? undefined} />`. 스크롤 상단(또는 CommuteRouteCard 위)에 `<GuidanceActiveBanner onPress={handleResumeGuidance} />`, `handleResumeGuidance=useCallback(()=>navigation.navigate('RouteGuidance'),[navigation])`.
- [ ] **Step 4: 통과 확인** — `npx jest --runInBand --watchman=false src/screens/home/__tests__/HomeScreen.test.tsx` → PASS.
- [ ] **Step 5: 커밋** — `feat(home): 출퇴근 카드 길안내 CTA + 안내 중 배너 배선`

---

### Task 9: `App.tsx` — 부팅 시 세션 hydrate

**Files:**
- Modify: `App.tsx` (effect 추가)
- Test: 기존 App 렌더 테스트 있으면 회귀; 없으면 store hydrate 단위는 Task 3에서 커버됨(추가 테스트 생략 가능).

**Interfaces:**
- Consumes: `hydrateGuidanceSession` (Task 3).

- [ ] **Step 1: 구현** — import `{ hydrateGuidanceSession } from './src/services/guidance/guidanceSessionStore'`. App 본문에 `useEffect(() => { void hydrateGuidanceSession(); }, []);` (usePushRegistration 인근).
- [ ] **Step 2: 타입 체크** — `npx tsc --noEmit` 에러 0.
- [ ] **Step 3: 커밋** — `feat(app): 부팅 시 길안내 세션 hydrate`

---

### Task 10: 최종 검증 (verification-loop)

- [ ] **Step 1: 타입** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 2: 린트** — `npx eslint src --max-warnings 0` (변경 파일 범위).
- [ ] **Step 3: 전체 관련 테스트** — `npx jest --runInBand --watchman=false src/services/route src/services/guidance src/hooks src/components/guidance src/components/design/__tests__/CommuteRouteCard src/screens/guidance src/screens/home` → 0 failures.
- [ ] **Step 4: 커버리지 게이트** — `npx jest --runInBand --watchman=false --coverage` → `jest.config.js` 임계값 통과.
- [ ] **Step 5: Red-Green 회귀 확인** — Task 3 TTL 만료 테스트로 좀비 세션 방지 검증(수정 되돌리면 FAIL).

## Self-Review
- **Spec coverage**: G1=Task 5,7,8 / G2=Task 3,4,6,8 / G3=Task 3,9 / DRY selector=Task 1,2. 모든 spec §4 단위에 대응 task 존재. ✓
- **Placeholder scan**: 모든 코드 step에 실제 코드/명령 포함. ✓
- **Type consistency**: `selectCommuteRoute`(T1)→소비 T2/T5 시그니처 일치; store API(T3)→T4/T5/T9 일치; `onStartGuidance`(T7)→T8 일치; `GuidanceSession` 필드 일관. ✓
