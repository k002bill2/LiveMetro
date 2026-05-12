# PredictedCommute Model Extension — Design Spec

| 항목 | 값 |
|---|---|
| 날짜 | 2026-05-12 |
| 작성자 | brainstorming session (Claude + user) |
| 상태 | Approved (pending user spec review) |
| 대상 모델 | `src/models/pattern.ts` — `PredictedCommute` interface |
| 핵심 producer | `src/services/pattern/patternAnalysisService.ts` |
| 핵심 consumer | `src/screens/prediction/WeeklyPredictionScreen.tsx`, `src/screens/home/HomeScreen.tsx`, `src/components/design/MLHeroCard.tsx`, `src/components/pattern/CommuteInsightCard.tsx` |
| 의존 phase | 후속 `(d) congestionData ingestion + index`가 이 spec의 `congestionForecast` slot 위에서 동작 |

## 1. Overview

`PredictedCommute` 모델은 사용자의 commute pattern에서 derive된 prediction을 표현한다. 현재 인터페이스는 출발 시각·경로·신뢰도만 노출하므로, 화면(`WeeklyPredictionScreen`, `MLHeroCard`)이 ride duration·도착 시간·delta·방향·세그먼트·범위·혼잡도 등 7가지 derived 값을 각자 합성하거나 하드코딩한다. 이 spec은 그 7가지를 모델 표면으로 끌어올려 single source of truth를 만들고, (d) phase의 congestion ingestion이 채울 슬롯을 미리 정의한다.

### 1.1 Objectives

1. `PredictedCommute`에 7개 optional 필드 추가 — duration / arrival / range / delta / direction / walk·wait scalars / transit segments
2. `PredictedTransitSegment` 신규 인터페이스 — 기존 `RouteSegment` 확장 + `congestionForecast?: CongestionLevel` slot
3. `patternAnalysisService.generatePrediction`이 신규 필드를 채우는 producer 단일화
4. `WeeklyPredictionScreen.tsx`의 7개 TODO 주석·하드코딩·휴리스틱 제거 → 모델 필드 직접 사용
5. `HomeScreen` / `MLHeroCard` consumer가 derive 책임을 producer로 위임
6. (d) phase가 모델/consumer touch 없이 congestion forecast를 채울 수 있도록 contract 확정

### 1.2 Out of Scope

- Firestore 컬렉션 스키마 변경 (PredictedCommute는 derived interface, persist 안 됨)
- `congestion.ts`의 crowdsourced data 모델 변경 — (d)가 ingestion source로 쓸지는 (d)에서 결정
- `train.CongestionLevel` enum과 `publicData.ts` `CongestionLevel` type alias의 통일 — 별도 tech-debt phase
- 새 ML 모델 학습 / TensorFlow 활성화 (현재 disabled 유지)
- `deltaMinutes`의 실제 historical baseline 구현 — 1st cut은 항상 `undefined`. 별도 phase에서 typical lookup 도입
- Walk/wait의 per-user 학습 — 1st cut은 deterministic 기본값 (4·3·3분)

## 2. Context

### 2.1 기존 인프라

| 파일 | 역할 |
|---|---|
| `src/models/pattern.ts` (355줄) | `PredictedCommute`·`CommutePattern`·`FrequentRoute` 정의 + helpers |
| `src/models/route.ts` | `RouteSegment` 인터페이스 (`from/toStation`, `lineId`, `estimatedMinutes`, `isTransfer`) — 재사용 |
| `src/models/train.ts` | `enum CongestionLevel { LOW, MODERATE, HIGH, CROWDED }` — `congestion.ts`도 import |
| `src/services/pattern/patternAnalysisService.ts` (320줄) | prediction producer |
| `src/services/route/routeService.ts` | `calculateRoute(from, to) → Route { segments: RouteSegment[] }` |
| `src/hooks/useCommutePattern.ts` (429줄) | `todayPrediction`, `weekPredictions` state |
| `src/screens/prediction/WeeklyPredictionScreen.tsx` | 7개 TODO 주석 + PR #62 routeService 호출 wiring |
| `src/components/design/MLHeroCard.tsx` | `predictedMinutes`·`deltaMinutes`·`arrivalTime`·`confidence` 4개 prop |
| `src/components/pattern/CommuteInsightCard.tsx` (469줄) | prediction 표시의 또 다른 consumer |

### 2.2 핵심 결정 (brainstorming 세션 결과)

| 결정 | 선택 | 근거 |
|------|------|------|
| 확장 범위 | 7 TODO 필드 + per-segment congestion (한 spec/PR) | (d) 시작 전에 keystone 확정 |
| Congestion granularity | per-segment | segment 단위 시각화에 충분, (d) ingestion 가벼움 |
| Congestion enum | `train.CongestionLevel` 재사용 | `congestion.ts`와 정합 |
| Direction enum | `'up' \| 'down'` | publicData.ts 정합 |
| Segment 표현 | `PredictedTransitSegment extends RouteSegment` | DRY, `isTransfer`로 ride/transfer 식별 |
| Walk/Wait 표현 | 스칼라 3개 (walkToStation·wait·walkToDest) | 시안 layout 직접 매핑, transit이 아닌 데서 congestion 의미 없음 |
| Range 표현 | `readonly [number, number]` tuple | P10/P90 대비 단순, UI 직접 매핑 |
| Delta 부호 | `+` = slower | "오늘 +3분" 한국어 직관성 |
| 신규 필드 nullable | 모두 optional | service 부분 fill 가능, breaking change 0 |
| Schema versioning | 없음 | derived interface, persist 안 됨, YAGNI |
| Delta 1st cut | 항상 `undefined` | typical baseline 미구현 — 정직한 unknown |
| Walk/Wait 기본값 | 4·3·3분 상수 export | producer 결정성, 후속 phase가 per-user 학습으로 대체 가능 |

## 3. Type Design

```typescript
import { CongestionLevel } from './train';
import { RouteSegment } from './route';

// === Existing interface, extended ===
export interface PredictedCommute {
  // existing — unchanged
  readonly date: string;                       // YYYY-MM-DD
  readonly dayOfWeek: DayOfWeek;
  readonly predictedDepartureTime: string;     // HH:mm
  readonly route: FrequentRoute;
  readonly confidence: number;                 // 0-1
  readonly suggestedAlertTime: string;         // HH:mm
  readonly basedOnPatternId?: string;

  // NEW: total duration & arrival (coupled — set together or both undefined)
  /** Total trip minutes (walk + wait + transit + walk) when all parts resolved. */
  readonly predictedMinutes?: number;
  /** Paired arrival time. Derivable but stored so consumers don't recompute. */
  readonly predictedArrivalTime?: string;      // HH:mm
  /** [lower, upper] minutes — replaces ±2/±4 heuristic in WeeklyPredictionScreen. */
  readonly predictedMinutesRange?: readonly [number, number];

  // NEW: delta vs typical (signed; + = slower than typical)
  readonly deltaMinutes?: number;

  // NEW: travel direction on the predicted line(s)
  readonly direction?: 'up' | 'down';

  // NEW: trip parts
  /** Walk from origin to boarding station (minutes). */
  readonly walkToStationMinutes?: number;
  /** Wait at platform (minutes). */
  readonly waitMinutes?: number;
  /** Walk from alighting station to destination (minutes). */
  readonly walkToDestinationMinutes?: number;
  /** Transit (ride + transfer) segments. Reuses RouteSegment, adds congestion slot. */
  readonly transitSegments?: readonly PredictedTransitSegment[];
}

/**
 * RouteSegment + optional congestion forecast slot.
 * `congestionForecast` is populated by the congestion ingestion pipeline
 * (Phase d); always undefined until then.
 */
export interface PredictedTransitSegment extends RouteSegment {
  readonly congestionForecast?: CongestionLevel;
}
```

### 3.1 Constants exported from `pattern.ts`

```typescript
/** Default walk minutes from origin to boarding station. */
export const DEFAULT_WALK_TO_STATION_MIN = 4;
/** Default wait minutes at platform. */
export const DEFAULT_WAIT_MIN = 3;
/** Default walk minutes from alighting station to destination. */
export const DEFAULT_WALK_TO_DEST_MIN = 3;
```

### 3.2 Helper exports

```typescript
/**
 * Compute arrival time from departure (HH:mm) + total minutes.
 * Handles 24h wrap: ('23:50', 30) → '00:20'.
 */
export function computeArrivalTime(
  departureHHmm: string,
  totalMinutes: number,
): string;

/**
 * Sum walk + wait + walk + transit segments. Returns 0 if all undefined.
 * Used by producer to compute `predictedMinutes` and by tests.
 */
export function sumPredictedMinutes(p: PredictedCommute): number;

/**
 * Derive travel direction from the first transit segment of a resolved route.
 * Returns 'up' / 'down' based on lineId-aware station ordering rules
 * (lookup table in helper). Returns undefined when input is missing or
 * the line's direction model is unknown.
 *
 * Implementation detail (algorithm choice) is deferred to the
 * implementation plan; only the signature is part of the model contract.
 */
export function deriveDirection(
  firstSegment: RouteSegment | undefined,
): 'up' | 'down' | undefined;
```

## 4. Data Flow

### 4.1 Producer — `patternAnalysisService.generatePrediction`

```text
generatePrediction(userId, targetDate):
  1. Load pattern for targetDate.dayOfWeek → CommutePattern
     if pattern.sampleCount < MIN_LOGS_FOR_PATTERN → return null  (unchanged)

  2. Build BASE prediction (existing fields):
     date, dayOfWeek, predictedDepartureTime, route, confidence,
     suggestedAlertTime, basedOnPatternId

  3. Resolve transit segments (NEW, soft-fail):
     try:
       route = await routeService.calculateRoute(
                  pattern.frequentRoute.departureStationId,
                  pattern.frequentRoute.arrivalStationId)
       if route.segments.length === 0:
         transitSegments = undefined; transitMinutes = undefined
       else:
         transitSegments = route.segments.map(seg => ({
           ...seg,
           congestionForecast: undefined,   // (d) phase fills
         }))
         transitMinutes = sum(seg.estimatedMinutes for seg in route.segments)
     catch:
       transitSegments = undefined; transitMinutes = undefined

  4. Walk/wait estimates (NEW, deterministic defaults):
     walkToStationMinutes     = DEFAULT_WALK_TO_STATION_MIN
     waitMinutes              = DEFAULT_WAIT_MIN
     walkToDestinationMinutes = DEFAULT_WALK_TO_DEST_MIN

  5. Total + arrival (NEW, coupled):
     if transitMinutes != undefined:
       predictedMinutes = walkToStation + wait + transit + walkToDest
       predictedArrivalTime = computeArrivalTime(predictedDepartureTime, predictedMinutes)
     else:
       predictedMinutes = undefined; predictedArrivalTime = undefined

  6. Range (NEW):
     if predictedMinutes != undefined && pattern.stdDevMinutes > 0:
       half = clamp(round(pattern.stdDevMinutes), 1, 10)
       predictedMinutesRange = [predictedMinutes - half, predictedMinutes + half]
     else:
       predictedMinutesRange = undefined

  7. Delta vs typical (NEW, 1st cut):
     deltaMinutes = undefined
     // Real "vs typical" requires historical predictions we don't store.
     // Ship as optional; future phase introduces baseline lookup.

  8. Direction (NEW):
     direction = deriveDirection(route?.segments[0])
     // helper returns 'up' | 'down' | undefined based on line + station order

  9. Return { ...base, ...new-fields }
```

### 4.2 Data flow contracts

| Contract | 보장 메커니즘 |
|----------|--------------|
| Soft-fail on routeService | step 3 try/catch — base 필드만 반환 |
| Deterministic walk/wait | step 4 — 항상 채워짐 |
| Coupled `predictedMinutes ↔ predictedArrivalTime` | step 5 — 둘 다 set 또는 둘 다 undefined |
| Coupled `predictedMinutes ↔ predictedMinutesRange` | step 6 — range 존재 시 predictedMinutes 보장 |
| Delta 1st cut | step 7 — 항상 undefined (정직한 unknown) |
| Empty segments → undefined | step 3 — `length === 0`이면 강등 |

### 4.3 Consumer 정리

**`WeeklyPredictionScreen.tsx`** — 제거 대상:

| 제거 대상 (현재 라인) | 대체 |
|----------------------|------|
| `predictedMinutes` useMemo (193) | `prediction.predictedMinutes ?? fallbackHeuristic` |
| Range 휴리스틱 `±2/±4` (199-206) | `prediction.predictedMinutesRange ?? [predictedMinutes-2, predictedMinutes+2]` |
| `routeService.calculateRoute` 호출 (222-237) | 제거 — 모델 `transitSegments` 사용 |
| 하드코딩 `4/3/3` walk/wait/walk (251) | `prediction.walkToStationMinutes` etc. |
| `direction: 'up'` 하드코딩 (303) | `prediction.direction ?? 'up'` |
| `congestionLevel intentionally omitted` (265) | `transitSegments[i].congestionForecast` |
| 7개 TODO 주석 블록 | 모두 삭제 |

**`HomeScreen.tsx` / `MLHeroCard.tsx` / `CommutePredictionCard.tsx`** — 제거 대상:

| 제거 대상 | 대체 |
|-----------|------|
| HomeScreen이 `deltaMinutes`·`arrivalTime` 합성 | `prediction.deltaMinutes`·`prediction.predictedArrivalTime` forward |
| MLHeroCard props 의미 | shape 변화 0 (call site 단순화만) |

## 5. Error Handling

### 5.1 Producer 책임

| 시나리오 | producer 동작 | 결과 |
|---------|--------------|------|
| `routeService.calculateRoute` throws | catch + transitSegments=undefined | base 필드만, 신규 chained 필드 모두 undefined |
| `routeService` returns empty `segments` | `transitSegments=undefined`로 강등 | predictedMinutes=undefined (walk+wait만으로 fake total 만들지 않음) |
| `pattern.stdDevMinutes` 누락 또는 0 | range 생략 | consumer fallback |
| `pattern.frequentRoute.lineIds` 비어있음 | `direction=undefined` | consumer 'up' default |
| pattern 자체 없음 | 기존 동작대로 `null` 반환 | 기존 consumer null 처리 그대로 |

### 5.2 Consumer 책임

| Consumer | undefined 시 표시 |
|----------|------------------|
| MLHeroCard `deltaMinutes` | trend pill 숨김 (현재 동작) |
| MLHeroCard `arrivalTime` | accessibility 라벨에서 생략 (현재 동작) |
| WeeklyPrediction `predictedMinutes` | 기존 fallback 휴리스틱 1줄 |
| WeeklyPrediction `direction` | `'up'` default |
| CommuteRouteCard congestion dot | neutral 색 (Phase d 전 항상 이 경로) |

## 6. Testing

### 6.1 Pattern A — `pattern.ts` helper unit tests

```text
describe('computeArrivalTime'):
  - ('08:30', 45) → '09:15'
  - ('23:50', 30) → '00:20'    // 24h wrap
  - ('00:00', 0)  → '00:00'

describe('sumPredictedMinutes'):
  - complete prediction → walk + wait + walk + sum(transitSegments)
  - all-undefined prediction → 0
  - partial (no transitSegments) → walk + wait + walk
```

### 6.2 Pattern B — `patternAnalysisService.test.ts` 확장

기존 `generatePrediction` 테스트에 cases 추가:
- Happy path: routeService 성공 mock → 모든 신규 필드 set 검증
- routeService throw: catch 후 base 필드만, 신규 모두 undefined
- Empty segments: `transitSegments=undefined`로 강등
- No stdDev: `predictedMinutesRange=undefined`
- Coupled invariant: `predictedMinutes` set이면 `predictedArrivalTime`도 set
- Delta 1st cut: 항상 `deltaMinutes === undefined`
- Direction derivation: helper 단위 (좁은 unit test)

### 6.3 Pattern C — Consumer regression

기존 `WeeklyPredictionScreen.test.tsx`, `HomeScreen.test.tsx`, `CommutePredictionCard.test.tsx`에:
- 신규 필드를 채운 prediction prop → 화면이 fallback 휴리스틱 안 타고 모델 값 사용 검증
- 신규 필드 undefined prediction → 기존 fallback 경로 동작 검증 (회귀 방지)

### 6.4 커버리지 목표

`.claude/rules/coverage-thresholds.md` 임계 유지:
- pattern.ts 신규 helpers: 100%
- patternAnalysisService 신규 분기: stmt 90%+, branch 80%+
- 전체 프로젝트: stmt 75% / fn 70% / branch 60% (기존 임계)

## 7. Acceptance Criteria

| # | Criterion | 검증 방법 |
|---|-----------|-----------|
| 1 | `PredictedCommute` 7 optional 필드 + `PredictedTransitSegment` export | `npx tsc --noEmit` 통과 + grep으로 export 확인 |
| 2 | `patternAnalysisService.generatePrediction`이 happy path에서 신규 필드 모두 set | 단위 테스트 (6.2) |
| 3 | routeService throw 시 base 필드만 반환 | 단위 테스트 (6.2) |
| 4 | `WeeklyPredictionScreen`의 7개 TODO 주석 + 휴리스틱 제거 | grep `(intentionally omitted\|TODO\|temporary default)` → 0 |
| 5 | `HomeScreen`의 `deltaMinutes`·`arrivalTime` 합성 코드 제거 | grep + diff |
| 6 | 기존 테스트 회귀 0 | `npm test` 통과 |
| 7 | 커버리지 임계 유지 | `npm test -- --coverage` |
| 8 | (d) phase가 모델·consumer touch 없이 congestion 채울 수 있음 | spec 검토 — `transitSegments[i].congestionForecast` 슬롯 존재 확인 |

## 7.1. Addendum (2026-05-12): C.2 closeout — HomeScreen MLHero unchanged

**Finding during execution:** This spec assumed `HomeScreen.tsx` consumes `PredictedCommute` via `useCommutePattern` and synthesizes `deltaMinutes` + `predictedArrivalTime`. Execution revealed `HomeScreen` actually uses `useMLPrediction` → `MLPrediction` (a separate prediction pipeline). The MLHero card on HomeScreen is fed from `MLPrediction` (`src/models/ml.ts`), not `PredictedCommute` (`src/models/pattern.ts`).

**Consequence for §4.3 "HomeScreen / MLHeroCard / CommutePredictionCard" cleanup:**
- Task C.2 as-written is a **no-op** for this phase. There are no `PredictedCommute` fields to forward on a screen that doesn't consume `PredictedCommute`.
- `HomeScreen`'s current synthesis (`predictedMinutes = minutesBetween(dep, arr)`, `deltaMinutes = minutes - baselineMinutes`) derives from `MLPrediction`'s shape, not from any model gap this spec addresses.
- `mlPrediction.predictedArrivalTime` is already used directly in HomeScreen (no synthesis on that path).

**Acceptance Criterion #5 amended:** Instead of "HomeScreen synthesis removal," the criterion is now "HomeScreen MLHero pipeline confirmed independent of `PredictedCommute` — no change required in this phase." The grep that would have proved synthesis removal is replaced by a grep that proves HomeScreen doesn't import `useCommutePattern` or `PredictedCommute`.

**Follow-up phase candidate (out of scope):**
Switching `HomeScreen` from `useMLPrediction` to `useCommutePattern` is a larger refactor (cascading effects on `baselineMinutes`, `refreshPrediction`, gating, `effectiveDepartureTime`). If the team decides that all prediction surfaces should converge on `PredictedCommute`, that work belongs in a separate phase with its own spec — not in this model-extension phase.

**True consumer cleanup achieved in this phase:** `WeeklyPredictionScreen` (Task C.1, commit `44132e7`) — the only screen that genuinely consumes `PredictedCommute`. File shrunk 879 → 729 lines; 7 TODO blocks removed; 2 regression tests added.

## 8. Next-Phase Hooks

`(d) congestionData ingestion + index`가 이 spec 위에서 할 일:

1. `congestionForecastService.fillForSegment(segment, atDate) → CongestionLevel | undefined` 도입
2. `patternAnalysisService.generatePrediction`의 step 3 직후, 각 transit segment에 대해:
   ```typescript
   transitSegments = await Promise.all(
     route.segments.map(async (seg) => ({
       ...seg,
       congestionForecast: await congestionForecastService.fillForSegment(seg, targetDate),
     }))
   );
   ```
3. 모델 / consumer touch 0
4. Firestore 인덱스·컬렉션 설계는 (d)의 별도 spec에서

이 hook이 (b)를 (d)의 keystone으로 만든다.
