# 출퇴근 동선 ↔ 라이브 길안내 연결 (Commute Guidance Link) — Design Spec

- **Date**: 2026-06-25
- **Branch**: `worktree-commute-guidance-link` (base: `origin/main` @ dac4b71)
- **Scope**: v1 — 출근(morning) 경로 + 홈 배너 한정

## 1. 문제 (Problem)

사용자 체감: "출퇴근 시 경로안내·현재위치를 시각적으로 보여주거나 알림 주는 기능이 없다."

15-에이전트 코드 감사 결과, 체감과 달리 **핵심 기능은 이미 존재·머지·배선돼 있다**:

- 라이브 턴바이턴 길안내 화면 `RouteGuidanceScreen` (ETA·진행바·NOW 카드·전체 타임라인·탑승 soft-confirm·실시간 다음열차 ETA) — main 존재, 테스트 12개 통과. (PR #251/#256)
- 출발 주간 리마인더·탑승/도착 알림 — OS 로컬 예약 알림이라 앱 종료 상태에서도 발사.
- 홈 "오늘의 출근 경로" 카드 — 출발/도착 시각·환승·역수·요금 표시.

**진짜 공백은 "출퇴근 동선과의 연결 단절"이다** (모두 fresh 코드로 확증):

1. **원탭 진입 부재**: 길안내 진입은 경로탭 수동검색 1곳뿐(`RoutesTabScreen.tsx:137`, 전체 `navigate('RouteGuidance')` 단 1건). 홈 출퇴근 카드·ML·CommuteRouteCard 어디에도 "내 출근 경로로 길안내 시작"이 없어, 매번 출발/도착역을 다시 입력해야 한다.
2. **"안내 중" 복귀 진입점 부재**: 길안내 시작 후 홈으로 나가면 같은 세션으로 돌아갈 UI가 없다. `guidanceSessionStore.ts:7-8` 주석이 이 배너를 "future work"로 이미 명시.
3. **세션 비영속**: `guidanceSessionStore`는 in-memory 싱글톤(`store.ts:16`). 앱 강제종료 시 세션 소실 → 재진입 시 `RouteGuidanceScreen.tsx:75-79`가 즉시 `goBack()`으로 튕김.

## 2. 목표 / 비목표 (Goals / Non-Goals)

### Goals (v1)
- G1. 홈 "오늘의 출근 경로" 카드에서 **원탭으로 라이브 길안내 시작**.
- G2. 길안내 진행 중 홈에 **"안내 중" 복귀 배너** 표시 → 탭하면 길안내로 복귀.
- G3. 길안내 세션을 **AsyncStorage에 영속** + **TTL 만료 가드** → 앱 재시작 후에도 진행 중 여정 유지, 단 오래된(좀비) 세션은 자동 폐기.

### Non-Goals (후속)
- 퇴근(evening) 경로 원탭 진입 — 시간대 전환 로직 필요.
- 전역(모든 탭 위) 배너 — 탭 내비 래핑 필요. v1은 홈 한정.
- 백그라운드/잠금화면 실시간 진행 알림 (공백 #4).
- 서버 푸시·지연 알림 복구 (공백 #5).
- 지도 SDK·현재위치 파란 점 (공백 #6).

## 3. 핵심 통찰 (Design Rationale)

**중추는 `guidanceSessionStore`를 "단순 싱글톤 → 관찰가능(observable) + 영속(persistent) 스토어"로 승격하는 것.** 배너(G2)는 "세션 시작/종료"를 관찰해야 하고, 영속(G3)은 "앱 재시작 후 세션 존재"를 알아야 한다 — 둘 다 *세션 상태 변화 관찰*이라는 동일 능력을 요구한다. 스토어 한 곳에 그 능력을 심으면 두 기능이 따라온다.

CTA(G1)는 순수 배선이다: `GuidanceSession` 모델(`guidance.ts:80-86`)은 `route` + `fromStationName` + `toStationName` + `startedAt`만 요구하고, 출퇴근 카드는 이 4개를 모두 만들 수 있다.

`Route` 객체는 이미 계산되고 있으나 버려진다: `useCommuteRouteSummary.ts:92-97`과 `useCommuteRouteSteps.ts:56-61`이 **글자 그대로 동일한** `viaSlug ? routeVia(...) : getDiverseRoutes(...)[0]` 선택을 복붙하고 있다(둘 다 주석엔 "single SSOT"). 세 번째 사본을 만들지 않고 이를 **하나의 순수 선택기로 추출**한다.

## 4. 아키텍처 (Units & Interfaces)

각 단위는 단일 책임 + 명확한 인터페이스 + 독립 테스트 가능.

### 4.1 `selectCommuteRoute` (신규 · 순수 함수)
- **위치**: `src/services/route/selectCommuteRoute.ts`
- **시그니처**: `selectCommuteRoute(fromStationId?: string, toStationId?: string, viaTransferId?: string): Route | null`
- **책임**: OD(+via) → 정규화(`resolveInternalStationId`) → `routeVia`/`getDiverseRoutes[0]` 선택 → `Route | null`. 에러/미해결 시 `null` (throw 금지, 프로젝트 정책).
- **소비자**: `useCommuteRouteSummary`, `useCommuteRouteSteps` (둘을 이 함수 사용으로 리팩터 — DRY/SSOT 실현), 신규 `useStartCommuteGuidance`.

### 4.2 `guidanceSessionStore` v2 (재작성 · observable + persistent)
- **위치**: `src/services/guidance/guidanceSessionStore.ts` (기존 API 확장, 동기 read 유지)
- **API**:
  - `getGuidanceSession(): GuidanceSession | null` (기존, 동기 — hydrate 후 유효)
  - `subscribe(listener: () => void): () => void` (신규 — `useSyncExternalStore`용)
  - `setGuidanceSession(session)` → in-memory 갱신 + AsyncStorage write(fire-and-forget) + emit
  - `clearGuidanceSession()` → null + AsyncStorage remove + emit
  - `hydrateGuidanceSession(): Promise<void>` (신규 — 부팅 시 1회, TTL 검사 후 유효하면 in-memory 복원 + emit)
- **TTL**: `isSessionExpired(session, nowMs)` = `nowMs - startedAt > TTL_MS`. `TTL_MS = 3 * 60 * 60 * 1000`(3시간 — 출퇴근 1회 여정 상한). hydrate 시 만료면 복원하지 않고 storage도 청소.
- **저장 키**: `@livemetro/guidance_session`.

### 4.3 `useGuidanceSession` (신규 · 반응형 훅)
- **위치**: `src/hooks/useGuidanceSession.ts`
- **시그니처**: `useGuidanceSession(): GuidanceSession | null`
- **구현**: `useSyncExternalStore(subscribe, getGuidanceSession)`. 구독 cleanup은 `useSyncExternalStore`가 자동 처리.

### 4.4 `useStartCommuteGuidance` (신규 · 시작 핸들러 훅)
- **위치**: `src/hooks/useStartCommuteGuidance.ts`
- **시그니처**: `useStartCommuteGuidance(args: { fromStationId?; toStationId?; viaTransferId?; fromStationName?; toStationName? }): (() => void) | null`
- **책임**: `selectCommuteRoute`로 Route 계산. Route 또는 endpoint 이름이 없으면 `null` 반환(→ 카드가 CTA 숨김). 있으면 `() => { setGuidanceSession({route, fromStationName, toStationName, startedAt: Date.now()}); navigation.navigate('RouteGuidance'); }` 반환.

### 4.5 `GuidanceActiveBanner` (신규 · presentational + tap-to-resume)
- **위치**: `src/components/guidance/GuidanceActiveBanner.tsx`
- **Props**: `{ onPress: () => void; hidden?: boolean }`. 내부에서 `useGuidanceSession()` 읽어 세션 없으면 `null` 렌더. `hidden`(길안내 화면 위 등)일 때도 `null`.
- **표시**: "안내 중 · {from} → {to}" + chevron. `accessibilityLabel`, 터치 영역 ≥44pt, `StyleSheet.create`, `React.memo`.

### 4.6 `CommuteRouteCard` (수정 · CTA 추가)
- **추가 prop**: `onStartGuidance?: () => void`.
- `onStartGuidance` 있을 때만 카드 하단에 **"이 경로로 길안내 시작"** 버튼 렌더(경로탭 카피 일치). 없으면(Route 미해결) 미렌더 — 정직성.

### 4.7 `HomeScreen` (수정 · 배선)
- `useStartCommuteGuidance({...morningCommute, ...commuteStationNames})` → `CommuteRouteCard onStartGuidance`로 전달.
- 화면 상단(또는 카드 위)에 `GuidanceActiveBanner` 추가, `onPress` = `navigation.navigate('RouteGuidance')`.

### 4.8 `App.tsx` (수정 · 부팅 hydrate)
- 마운트 시 `hydrateGuidanceSession()` 1회 호출(기존 `usePushRegistration`/`useCommuteReminderSync` 옆).

### 4.9 `RouteGuidanceScreen` (최소 수정)
- `handleExit`의 `clearGuidanceSession()`은 v2에서 storage까지 비우므로 동작 자연 확장 — 코드 변경 없음(또는 import 확인만). 기존 12개 테스트 보존.

## 5. 데이터 흐름 (Data Flow)

```
[홈] morningCommute(OD) + commuteStationNames
   → useStartCommuteGuidance → selectCommuteRoute → Route
   → (tap CTA) setGuidanceSession(persist+emit) → navigate(RouteGuidance)
        │
        ├─ emit → useGuidanceSession → GuidanceActiveBanner(홈 복귀 시 표시)
        └─ AsyncStorage write
[앱 재시작] App.tsx hydrateGuidanceSession → (TTL 유효) in-memory 복원 + emit
[종료] RouteGuidanceScreen handleExit → clearGuidanceSession(remove+emit)
```

## 6. 에러 처리 (Error Handling)
- `selectCommuteRoute`: 모든 실패 → `null` (throw 금지). `__DEV__` 경고만.
- `useStartCommuteGuidance`: Route/이름 부재 → 핸들러 `null` → CTA 미렌더.
- 스토어 AsyncStorage I/O: try/catch, 실패해도 in-memory 동작 유지(영속은 best-effort), `console.error`(개발 중).
- hydrate 실패: 조용히 무세션으로 출발(빈 배너).

## 7. 테스트 전략 (TDD — RED→GREEN)
- `selectCommuteRoute`: OD 정상/ via 제약 / 미해결 id / 동일역 / 경로없음 → unit.
- `guidanceSessionStore` v2: set→get, subscribe emit, clear, persist write/remove(AsyncStorage mock), hydrate 복원, **TTL 만료 폐기**(Red-Green), `isSessionExpired` 경계.
- `useGuidanceSession`: 초기 null, set 후 반응형 갱신, clear 후 null (RNTL `renderHook`).
- `useStartCommuteGuidance`: Route 있으면 핸들러 반환·호출 시 set+navigate, 없으면 null.
- `GuidanceActiveBanner`: 세션 없음→null, 있음→텍스트 표시·onPress, hidden→null (`getByTestId`).
- `CommuteRouteCard`: `onStartGuidance` 있을 때 버튼 렌더+onPress, 없으면 미렌더.
- `HomeScreen` 통합: 출근 등록+경로 해결 시 CTA 노출→탭→navigate; 세션 활성 시 배너 노출.
- 커버리지: `jest.config.js` 게이트 통과(SSOT). `--runInBand --watchman=false`.

## 8. 영향 파일 요약
- **신규(5+테스트)**: `selectCommuteRoute.ts`, `useGuidanceSession.ts`, `useStartCommuteGuidance.ts`, `GuidanceActiveBanner.tsx`, (스토어 v2 테스트).
- **수정(5)**: `guidanceSessionStore.ts`(재작성), `useCommuteRouteSummary.ts`/`useCommuteRouteSteps.ts`(selector 사용), `CommuteRouteCard.tsx`(CTA), `HomeScreen.tsx`(배선), `App.tsx`(hydrate).
- **보존**: `RouteGuidanceScreen.tsx` 및 기존 길안내 테스트 12개.

## 9. 위험 & 완화
- **좀비 세션**: TTL 가드(§4.2)로 어제 출근 세션 부활 방지 — 정직성.
- **이중 경로계산**: selector 추출로 SSOT 단일화, 드리프트 제거.
- **동기 read 의존(`RouteGuidanceScreen` mount-time getGuidanceSession)**: hydrate를 부팅 시 완료하므로 화면 진입 시점엔 in-memory가 채워져 있음. CTA 경로는 set이 동기 in-memory 갱신이라 즉시 유효.
