# 퇴근경로 시간 자동 전환 길안내 — Design

- **Date**: 2026-06-26
- **Status**: 설계 승인 (spec 리뷰 대기)
- **Scope tag**: 출퇴근 동선 연결 v1(PR #266)의 후속 — 길안내 진입을 출근→퇴근으로 대칭 확장
- **선행**: PR #266 (`feat/commute-guidance-link`, `01517d7` 머지) — 홈 CommuteRouteCard 원탭 "길안내 시작" CTA가 출근(morning) OD에만 배선됨

## 1. Problem / Goal

홈 CommuteRouteCard의 "길안내 시작" CTA는 현재 **출근(morningCommute) OD에만** 연결돼 있다
(`HomeScreen` → `useStartCommuteGuidance({ fromStationId: morningCommute?.stationId, … })`).
그러나 데이터 모델은 이미 출근·퇴근 양쪽을 보유한다:

- `CommuteScheduleExtended.eveningCommute` / `DailySchedule.eveningCommute` (profile, store #1)
- 온보딩 `commuteService.saveCommuteRoutes(uid, morningRoute, eveningRoute)` → Firestore `settings.eveningRoute` (store #2)

즉 **퇴근 OD는 이미 저장돼 있는데 길안내 진입점이 출근만 노출**한다. 사용자는 저녁 귀가 시
저장된 퇴근 경로로 길안내를 시작할 수 없다.

**Goal**: 홈 통근 카드를 **시간대에 따라 출근/퇴근으로 자동 전환**시켜, 오후엔 저장된 퇴근 OD로
카드 전체(제목·경로 facts·추정치·길안내 CTA)가 바뀌게 한다. 새 데이터 발명 없이 기존 evening 저장을
읽는 훅 + 진입 배선만 추가한다.

## 2. Non-Goals (YAGNI)

- **ML 퇴근 예측 안 만듦** — `useMLPrediction`은 OD 무파라미터이고 `commuteLogService`는 로그를
  방향(출근/퇴근)별로 분리하지 않는다(단일 통근 trip 모델). 퇴근 카드에 morning ML 숫자를 재사용하면
  방향 오인(정직성 위반). 퇴근 카드의 헤드라인 분은 **그래프 ride 추정치**(`registeredCommuteHero`
  경로)로만 산출한다. ML 방향 인식은 별도 대형 작업.
- **퇴근 경로 역방향 자동 파생 안 함** — eveningCommute null이면 morning을 swap해 work→home을
  날조하지 않는다(사용자가 확인 안 한 경로). 미설정 시 설정 CTA placeholder를 노출한다.
- **WeeklyPredictionScreen 동작 변경 없음** — `useCommuteHeroEstimate`의 두 번째 소비처는 주간
  예측(출근/주간 기준)이다. `direction` 파라미터 기본값 `'morning'`으로 이 화면은 **무변경**.
- **새 시간대 UI 토글/세그먼트 없음** — 전환은 시계 기반 자동(추가 탭 0).
- **퇴근 알림/푸시 없음** — 본 작업은 진입 UX. 알림은 [[project_notification_firing_architecture_gaps]] 소관.

## 3. Key Decisions (확정)

| 결정 | 값 | 근거 |
|------|-----|------|
| 진입 모델 | 시간대 자동 전환 | 추가 탭 0, "지금 시점의 경로"에 가장 자연스러움 |
| 전환 범위 | 카드 전체(제목·경로·facts·ML·CTA) | 카드는 출근인데 버튼만 퇴근=incoherent 회피 |
| 경계 규칙 | 출근 23:00–11:00, 퇴근 11:00–23:00 (다음 이동 기준) | active 구간이면 그것, 아니면 다음 이동. 점심/심야 공백 제거 |
| 퇴근 ML | 없음 — 그래프 추정치만 | ML=단일(출근) 모델, 재사용 시 방향 오인 |
| 퇴근 미설정 | 설정 CTA placeholder | 날조 금지(역방향 파생 안 함), 기존 placeholder/`useStartCommuteGuidance` null 철학과 일치 |
| direction 파라미터 | 기본 `'morning'`, Home만 `'auto'` | WeeklyPrediction 회귀 0 (opt-in) |

## 4. Architecture

```
now ─ resolveActiveCommuteType(now) ─→ activeLeg ('morning'|'evening')
                                          │
   profile[leg] (isUsableCommuteTime) ?? useFirestoreCommuteLeg(uid, leg, nonce) ─→ activeCommute
                                          │
   ┌──────────────────────┬──────────────┴───────────────┬─────────────────────┐
 names(trainService)  useCommuteRouteSummary(active OD)   ML (morning leg에서만)
   │                   (transfer/station/fare/ride)         │
   └──── effectiveHero = (activeLeg==='morning' ? heroProps : null) ?? registeredCommuteHero ──┘
                                          │
   HomeScreen: 제목(activeCommuteType) + facts + 길안내 CTA(active OD)  │  active null → 설정 placeholder
```

### 4.1 신규 순수 헬퍼 — `src/utils/commuteSchedule.ts`

```ts
export type CommuteLeg = 'morning' | 'evening';
// 다음 이동 기준: active 구간이면 그것, 아니면 다가올 이동.
// morning  = 23:00–11:00 (출근 active 6–11 + 심야/새벽 다음=출근)
// evening  = 11:00–23:00 (퇴근 active 17–23 + 오후 다음=퇴근)
export function resolveActiveCommuteType(now: Date): CommuteLeg;
```

- `now`를 주입받아 결정론 확보(테스트 TZ flake 회피 — [[feedback_tz_naive_date_format_ci_regression]]).
- `useAutoCommuteLog.detectCommuteType`(로깅용, 공백 구간 null 반환)과 **다른 함수** — 주석으로 차이 명시.
  경계 시각 상수(11/23)는 본 헬퍼 내부에 SSOT.

### 4.2 퇴근 데이터원 — `useFirestoreMorningCommute` 일반화

- `useFirestoreCommuteLeg(uid, leg: CommuteLeg, refreshNonce = 0, enabled = true): CommuteTime | null`
  - `settings.morningRoute | settings.eveningRoute`를 leg로 선택해 `CommuteTime` shape로 adapt.
  - `enabled=false`면 구독 미수립(no-op) — `'auto'` 외 호출에서 불필요 evening 구독 회피.
- 기존 `useFirestoreMorningCommute(uid, nonce)`는 `= useFirestoreCommuteLeg(uid, 'morning', nonce)`
  thin wrapper로 보존 → 기존 호출처/테스트 무변경.

### 4.3 hero 훅 방향 인식 — `useCommuteHeroEstimate(refreshNonce = 0, direction: 'morning' | 'auto' = 'morning')`

- `activeLeg = direction === 'auto' ? resolveActiveCommuteType(new Date()) : 'morning'`.
- **`morningCommute` 필드는 항상 morning leg을 의미**(필드명 진실 + ML이 morning 기반 + WeeklyPrediction 보호).
  morning 해석은 오늘과 동일: `morningCommute = (isUsableCommuteTime(profile.morningCommute) ? … ) ?? useFirestoreCommuteLeg(uid, 'morning', nonce)`.
- **`activeCommute`는 시간 해석된 leg**: `activeLeg==='morning'`이면 `morningCommute`와 동일,
  `'evening'`이면 evening 해석(`(isUsableCommuteTime(profile.eveningCommute) ? … ) ?? useFirestoreCommuteLeg(uid, 'evening', nonce, enabled=direction==='auto')`).
  - 훅 규칙상 evening 구독은 unconditional 호출하되 `enabled=direction==='auto'`로 `'morning'` 모드에선 no-op.
- `routeSummary` / 역이름 effect를 **`activeCommute` 기준**으로 계산(현재 morningCommute 자리 대체).
- **ML 게이팅**: `heroProps`(ML)는 morning 기반이라 `activeLeg === 'morning'`일 때만 기여.
  `effectiveHero = (activeLeg === 'morning' ? heroProps : null) ?? registeredCommuteHero`(graph, `activeCommute` 기준).
  `hasRealPrediction = activeLeg === 'morning' && mlPrediction !== null`.
- **반환 추가**: `activeCommute: CommuteTime | null`, `activeCommuteType: CommuteLeg`. 기존 필드는 보존.
  `direction='morning'`(기본)에서 `activeCommute===morningCommute`·`activeCommuteType==='morning'`이라
  **WeeklyPrediction은 오늘과 완전 동일**(회귀 0). Home은 `'auto'` + `activeCommute`/`activeCommuteType` 소비.

### 4.4 HomeScreen 배선 — `src/screens/home/HomeScreen.tsx`

- `useCommuteHeroEstimate(commuteRefreshNonce, 'auto')`.
- `useStartCommuteGuidance({ fromStationId: activeCommute?.stationId, toStationId: activeCommute?.destinationStationId, viaTransferId: activeCommute?.transferStationId, fromStationName: names.origin, toStationName: names.destination })`.
- `CommuteRouteCard title = activeCommuteType === 'evening' ? '오늘의 퇴근 경로' : '오늘의 출근 경로'`.
- `activeCommute == null` → `CommuteRouteCardPlaceholder`(active-type 카피: '퇴근 경로 설정하기' / '출근 경로 설정하기') → CommuteSettings 네비.

### 4.5 CommuteRouteCard — `src/components/design/CommuteRouteCard.tsx`

- 메인 카드의 하드코딩 `'오늘의 출근 경로'`(현 line ~147)를 `title` 프롭으로 치환(기본 '오늘의 출근 경로').
  placeholder는 이미 `title` 프롭 보유.

## 5. Error Handling

- `activeCommute` null(leg 미설정) → 설정 placeholder. 길안내 CTA는 `useStartCommuteGuidance`가 이미
  null 반환으로 자동 숨김(dead-end 회피).
- 역이름 미해석 → 기존 관용(카드는 이름 없이 렌더, hero gating 유지).
- 퇴근 ML 부재 → 설계상 정상(그래프 추정치). 신규 에러 경로 불필요.
- Firestore/서비스 에러 → 기존 null 반환 정책(throw 금지) 유지.

## 6. Testing (TDD)

신규 순수 헬퍼 (RED→GREEN):
- `resolveActiveCommuteType`: 경계 전수 — 5:59→morning, 6:00→morning, 10:59→morning,
  **11:00→evening**, 16:59→evening, 17:00→evening, 22:59→evening, **23:00→morning**,
  0:00→morning, 3:00→morning (주입 Date, TZ flake 없음).

데이터원:
- `useFirestoreCommuteLeg`: morning→morningRoute, evening→eveningRoute, 불완전 필드→null,
  `enabled=false`→구독 미수립. `useFirestoreMorningCommute` wrapper 회귀.

hero 훅 (jest.mock `resolveActiveCommuteType` 또는 fake clock):
- `'auto'` + PM + 퇴근 설정 → `activeCommuteType==='evening'`, `activeCommute`=evening OD,
  `effectiveHero`=그래프(ML 존재해도 무시), `hasRealPrediction===false`.
- `'auto'` + AM + 출근 설정 → `activeCommuteType==='morning'`, ML 적용(오늘과 동일).
- `'auto'` + PM + 퇴근 null → `activeCommute===null`.
- `direction` 기본('morning') → 오늘과 동일(회귀 — WeeklyPrediction 보호).

HomeScreen (RNTL, testID):
- PM → 카드 제목 '오늘의 퇴근 경로', 길안내 CTA가 evening OD로 `setGuidanceSession`.
- PM + 퇴근 미설정 → placeholder '퇴근 경로 설정하기'.
- AM → 출근 카드/CTA 불변.

## 7. Files

- **신규**: `src/utils/commuteSchedule.ts` (+ `__tests__/commuteSchedule.test.ts`)
- **변경**: `src/hooks/useFirestoreMorningCommute.ts` → `useFirestoreCommuteLeg` 일반화 + wrapper (+ 테스트)
- **변경**: `src/hooks/useCommuteHeroEstimate.ts` (direction 파라미터·evening 해석·ML 게이팅·신규 반환 필드) (+ 테스트)
- **변경**: `src/screens/home/HomeScreen.tsx` (`'auto'` 전달·active OD 배선·제목/placeholder 분기) (+ 테스트)
- **변경**: `src/components/design/CommuteRouteCard.tsx` (메인 카드 `title` 프롭화) (+ 테스트)
- **무변경**: `useStartCommuteGuidance.ts`(인자만 active OD로 공급)·`selectCommuteRoute.ts`·`useMLPrediction.ts`·모델
