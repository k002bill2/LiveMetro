# PredictedCommute Model Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `PredictedCommute` with 7 optional derived fields (duration, arrival, range, delta, direction, walk/wait scalars, transit segments) + 1 new sub-interface (`PredictedTransitSegment`), centralize derivation in `patternAnalysisService.predictCommute`, remove duplicate derivation from screens, and reserve a `congestionForecast` slot for the next (d) phase.

**Architecture:** Single producer (`patternAnalysisService.predictCommute`) computes all derived fields by calling existing `routeService.calculateRoute` for transit segments and applying deterministic walk/wait defaults. Consumers (`WeeklyPredictionScreen`, `HomeScreen`, `MLHeroCard`) become dumb forwarders of model fields with optional fallback for `undefined`. No Firestore schema change — `PredictedCommute` is a derived interface, not persisted.

**Tech Stack:** TypeScript 5.1 strict, React Native 0.72, Jest + React Native Testing Library, Firebase Firestore (read-only for patterns; no schema change).

**Spec:** [`docs/superpowers/specs/2026-05-12-predicted-commute-model-extension-design.md`](../specs/2026-05-12-predicted-commute-model-extension-design.md)

**Branch:** `feat/predicted-commute-model-extension` (already created off `origin/main`, spec committed as `0a41522`)

---

## File Structure

| Layer | File | Action | Responsibility |
|-------|------|--------|---------------|
| Types | `src/models/pattern.ts` | Modify | Extend `PredictedCommute`, add `PredictedTransitSegment`, export `DEFAULT_WALK_TO_STATION_MIN`/`DEFAULT_WAIT_MIN`/`DEFAULT_WALK_TO_DEST_MIN` constants, add `computeArrivalTime` / `sumPredictedMinutes` / `deriveDirection` helpers |
| Types tests | `src/models/__tests__/pattern.test.ts` | **Create** | Unit tests for the three new helpers |
| Producer | `src/services/pattern/patternAnalysisService.ts` | Modify lines 107-126 (`predictCommute`) | Populate new fields from `routeService.calculateRoute` + walk/wait defaults; soft-fail when route resolution returns `null` |
| Producer tests | `src/services/pattern/__tests__/patternAnalysisService.test.ts` | Modify | Add cases for new field population, route soft-fail, coupled invariants, delta = undefined |
| Consumer | `src/screens/prediction/WeeklyPredictionScreen.tsx` | Modify lines 100, 120-126, 193-206, 212-265, 303-310 | Remove TODO blocks, hardcoded `4/3/3`, `±2/±4` heuristic, `direction: 'up'` default, inline `routeService.calculateRoute` call. Use new model fields with minimal fallback |
| Consumer tests | `src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx` | Modify | Regression: rich prediction prop → uses model values; undefined fields → uses fallback path |
| Consumer | `src/screens/home/HomeScreen.tsx` | Modify lines around `effectiveHero` | Forward `prediction.predictedMinutes` / `predictedArrivalTime` / `deltaMinutes` / `confidence` directly to `MLHeroCard` instead of synthesizing |
| Consumer tests | `src/screens/home/__tests__/HomeScreen.test.tsx` | Modify | Regression: MLHero receives forwarded model fields, no synthesis |

---

## Task Decomposition Summary

| Phase | Task | Scope |
|-------|------|-------|
| A — Types & helpers | A.1 | Type-only extension (no behavior change) |
| | A.2 | TDD `computeArrivalTime` |
| | A.3 | TDD `sumPredictedMinutes` |
| | A.4 | TDD `deriveDirection` |
| B — Producer | B.1 | TDD: `predictCommute` resolves transit segments + walk/wait/range/predictedMinutes/arrivalTime on route success |
| | B.2 | TDD: `predictCommute` soft-fails when route is null (no transit fields, walk/wait still set) |
| | B.3 | TDD: `predictCommute` wires `direction` from helper + `deltaMinutes` always `undefined` (1st cut) |
| C — Consumers | C.1 | `WeeklyPredictionScreen` cleanup with regression test |
| | C.2 | `HomeScreen` cleanup with regression test |
| D — Verify | D.1 | Full type-check + lint + jest --coverage + acceptance criteria walkthrough |

---

# Phase A — Types & Helpers

## Task A.1: Add types, constants, and helper stubs to `pattern.ts`

This task is type-only — no behavior, no tests yet (TS compiler verifies the shape). Helper implementations are stubs that throw, replaced in A.2/A.3/A.4 via TDD.

**Files:**
- Modify: `src/models/pattern.ts`

- [ ] **Step 1: Add imports for `CongestionLevel` and `RouteSegment`**

At the top of `src/models/pattern.ts` (after the existing module-level comment block, before the existing `export interface CommuteLog`):

```typescript
import { CongestionLevel } from './train';
import { RouteSegment } from './route';
```

- [ ] **Step 2: Extend `PredictedCommute` interface**

Replace the existing `PredictedCommute` definition (currently lines 61-72) with:

```typescript
/**
 * Predicted commute for a specific date.
 *
 * The first block of fields is the base prediction (computed from pattern alone).
 * The remaining optional fields are derived values populated by
 * `patternAnalysisService.predictCommute` when source data is available;
 * consumers MUST handle each as potentially undefined.
 */
export interface PredictedCommute {
  // existing — unchanged
  readonly date: string;                       // YYYY-MM-DD
  readonly dayOfWeek: DayOfWeek;
  readonly predictedDepartureTime: string;     // HH:mm
  readonly route: FrequentRoute;
  readonly confidence: number;                 // 0-1
  readonly suggestedAlertTime: string;         // HH:mm
  readonly basedOnPatternId?: string;

  // Coupled: predictedMinutes and predictedArrivalTime are set together or both undefined.
  readonly predictedMinutes?: number;
  readonly predictedArrivalTime?: string;      // HH:mm
  /** [lower, upper] minutes — replaces ±2/±4 heuristic in consumers. */
  readonly predictedMinutesRange?: readonly [number, number];

  /** Minutes vs typical (signed; + = slower). 1st cut: always undefined (no baseline yet). */
  readonly deltaMinutes?: number;

  /** Travel direction on the predicted line(s). */
  readonly direction?: 'up' | 'down';

  /** Walk from origin to boarding station. */
  readonly walkToStationMinutes?: number;
  /** Wait at platform. */
  readonly waitMinutes?: number;
  /** Walk from alighting station to destination. */
  readonly walkToDestinationMinutes?: number;

  /** Transit (ride + transfer) segments. Reuses RouteSegment, adds congestion slot. */
  readonly transitSegments?: readonly PredictedTransitSegment[];
}

/**
 * RouteSegment + optional congestion forecast slot.
 * `congestionForecast` is populated by the congestion ingestion pipeline
 * (Phase d); always undefined until that phase ships.
 */
export interface PredictedTransitSegment extends RouteSegment {
  readonly congestionForecast?: CongestionLevel;
}
```

- [ ] **Step 3: Add walk/wait default constants**

Below the existing `DEFAULT_ALERT_MINUTES_BEFORE` (around line 156), add:

```typescript
/** Default walk minutes from origin to boarding station. */
export const DEFAULT_WALK_TO_STATION_MIN = 4;
/** Default wait minutes at platform. */
export const DEFAULT_WAIT_MIN = 3;
/** Default walk minutes from alighting station to destination. */
export const DEFAULT_WALK_TO_DEST_MIN = 3;
```

- [ ] **Step 4: Add helper stubs at the end of the file**

Append to `src/models/pattern.ts`:

```typescript
// ============================================================================
// Derived-prediction helpers (implemented in A.2 / A.3 / A.4)
// ============================================================================

/**
 * Compute arrival time from departure (HH:mm) + total minutes.
 * Handles 24h wrap: ('23:50', 30) → '00:20'.
 */
export function computeArrivalTime(
  departureHHmm: string,
  totalMinutes: number,
): string {
  throw new Error('not implemented');
}

/**
 * Sum walk + wait + walk + transit segments. Returns 0 if all undefined.
 */
export function sumPredictedMinutes(p: PredictedCommute): number {
  throw new Error('not implemented');
}

/**
 * Derive travel direction from the first transit segment.
 * Returns undefined when input is missing or line direction model is unknown.
 */
export function deriveDirection(
  firstSegment: RouteSegment | undefined,
): 'up' | 'down' | undefined {
  throw new Error('not implemented');
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: exit code 0, no output

- [ ] **Step 6: Commit**

```bash
git add src/models/pattern.ts
git commit -m "$(cat <<'EOF'
feat(pattern): extend PredictedCommute with derived-field slots

Add 7 optional fields (predictedMinutes, predictedArrivalTime,
predictedMinutesRange, deltaMinutes, direction, walk/wait scalars,
transitSegments) and PredictedTransitSegment interface that extends
RouteSegment with a congestionForecast slot for Phase d.

Constants DEFAULT_WALK_TO_STATION_MIN / DEFAULT_WAIT_MIN /
DEFAULT_WALK_TO_DEST_MIN exported for producer use.

Helper signatures (computeArrivalTime, sumPredictedMinutes,
deriveDirection) added as stubs; implemented via TDD in subsequent tasks.

Type-only change — no behavior, all new fields optional, zero breaking
changes for existing consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task A.2: TDD `computeArrivalTime`

**Files:**
- Create: `src/models/__tests__/pattern.test.ts`
- Modify: `src/models/pattern.ts` (replace stub body)

- [ ] **Step 1: Write the failing test file**

Create `src/models/__tests__/pattern.test.ts`:

```typescript
import { computeArrivalTime } from '@/models/pattern';

describe('computeArrivalTime', () => {
  it('adds minutes within the same day', () => {
    expect(computeArrivalTime('08:30', 45)).toBe('09:15');
  });

  it('handles 24h wrap-around past midnight', () => {
    expect(computeArrivalTime('23:50', 30)).toBe('00:20');
  });

  it('returns the same time when minutes is 0', () => {
    expect(computeArrivalTime('07:00', 0)).toBe('07:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(computeArrivalTime('00:05', 4)).toBe('00:09');
  });

  it('handles full-day wrap (24h * 60 = 1440)', () => {
    expect(computeArrivalTime('09:30', 1440)).toBe('09:30');
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "computeArrivalTime"`
Expected: 5 failing tests, all with `Error: not implemented`

- [ ] **Step 3: Implement `computeArrivalTime` in `pattern.ts`**

Replace the stub body in `src/models/pattern.ts`:

```typescript
export function computeArrivalTime(
  departureHHmm: string,
  totalMinutes: number,
): string {
  const departureMinutes = parseTimeToMinutes(departureHHmm);
  const arrivalMinutes = (departureMinutes + totalMinutes) % (24 * 60);
  return formatMinutesToTime(arrivalMinutes);
}
```

(`parseTimeToMinutes` and `formatMinutesToTime` already exist in the same file — reuse them.)

- [ ] **Step 4: Run the test — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "computeArrivalTime"`
Expected: 5 passing tests

- [ ] **Step 5: Commit**

```bash
git add src/models/__tests__/pattern.test.ts src/models/pattern.ts
git commit -m "$(cat <<'EOF'
feat(pattern): implement computeArrivalTime helper

Adds departure HH:mm + minutes → arrival HH:mm with 24h wrap.
Reuses existing parseTimeToMinutes/formatMinutesToTime helpers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task A.3: TDD `sumPredictedMinutes`

**Files:**
- Modify: `src/models/__tests__/pattern.test.ts`
- Modify: `src/models/pattern.ts` (replace stub body)

- [ ] **Step 1: Add failing tests to existing test file**

Append to `src/models/__tests__/pattern.test.ts`:

```typescript
import { sumPredictedMinutes, type PredictedCommute } from '@/models/pattern';

const baseP: PredictedCommute = {
  date: '2026-05-12',
  dayOfWeek: 2,
  predictedDepartureTime: '08:00',
  route: {
    departureStationId: 'a',
    departureStationName: 'A',
    arrivalStationId: 'b',
    arrivalStationName: 'B',
    lineIds: ['1'],
  },
  confidence: 0.8,
  suggestedAlertTime: '07:45',
};

describe('sumPredictedMinutes', () => {
  it('returns 0 when all derived fields are undefined', () => {
    expect(sumPredictedMinutes(baseP)).toBe(0);
  });

  it('sums walk + wait + walk when transitSegments is undefined', () => {
    const p: PredictedCommute = {
      ...baseP,
      walkToStationMinutes: 4,
      waitMinutes: 3,
      walkToDestinationMinutes: 3,
    };
    expect(sumPredictedMinutes(p)).toBe(10);
  });

  it('sums walk + wait + walk + transitSegments.estimatedMinutes', () => {
    const p: PredictedCommute = {
      ...baseP,
      walkToStationMinutes: 4,
      waitMinutes: 3,
      walkToDestinationMinutes: 3,
      transitSegments: [
        {
          fromStationId: 'a', fromStationName: 'A',
          toStationId: 'b', toStationName: 'B',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 20, isTransfer: false,
        },
        {
          fromStationId: 'b', fromStationName: 'B',
          toStationId: 'c', toStationName: 'C',
          lineId: '2', lineName: '2호선',
          estimatedMinutes: 15, isTransfer: true,
        },
      ],
    };
    expect(sumPredictedMinutes(p)).toBe(4 + 3 + 3 + 20 + 15);
  });

  it('ignores undefined walk fields and only sums what is present', () => {
    const p: PredictedCommute = {
      ...baseP,
      waitMinutes: 3,
    };
    expect(sumPredictedMinutes(p)).toBe(3);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "sumPredictedMinutes"`
Expected: 4 failing tests with `Error: not implemented`

- [ ] **Step 3: Implement `sumPredictedMinutes`**

Replace the stub body in `src/models/pattern.ts`:

```typescript
export function sumPredictedMinutes(p: PredictedCommute): number {
  const walk1 = p.walkToStationMinutes ?? 0;
  const wait = p.waitMinutes ?? 0;
  const walk2 = p.walkToDestinationMinutes ?? 0;
  const transit = (p.transitSegments ?? []).reduce(
    (sum, seg) => sum + seg.estimatedMinutes,
    0,
  );
  return walk1 + wait + walk2 + transit;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "sumPredictedMinutes"`
Expected: 4 passing tests

- [ ] **Step 5: Commit**

```bash
git add src/models/__tests__/pattern.test.ts src/models/pattern.ts
git commit -m "$(cat <<'EOF'
feat(pattern): implement sumPredictedMinutes helper

Sums walk/wait/walk scalars + transitSegments[].estimatedMinutes.
Treats every undefined contributor as 0 — returns 0 when prediction has
no derived fields.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task A.4: TDD `deriveDirection`

The mapping rule: for the first transit segment, compare `fromStationId` and `toStationId` ordering on the segment's line. Without a static line-station ordering lookup (which is a larger asset), the 1st cut uses a small whitelist: lines 1, 3, 4, 5, 6, 7, 8 → ascending station ID = 'up'; line 2 (loop) → 'up' for outer/내선 mapping deferred (return undefined). All other lines → undefined.

This intentionally narrow rule is acceptable because consumers fall back to `'up'` when undefined; correctness can be improved in a follow-up phase without a model change.

**Files:**
- Modify: `src/models/__tests__/pattern.test.ts`
- Modify: `src/models/pattern.ts` (replace stub body)

- [ ] **Step 1: Add failing tests**

Append to `src/models/__tests__/pattern.test.ts`:

```typescript
import { deriveDirection } from '@/models/pattern';
import type { RouteSegment } from '@/models/route';

const makeSeg = (overrides: Partial<RouteSegment>): RouteSegment => ({
  fromStationId: '0150',
  fromStationName: '서울역',
  toStationId: '0151',
  toStationName: '시청',
  lineId: '1',
  lineName: '1호선',
  estimatedMinutes: 2,
  isTransfer: false,
  ...overrides,
});

describe('deriveDirection', () => {
  it('returns undefined for undefined input', () => {
    expect(deriveDirection(undefined)).toBeUndefined();
  });

  it('returns "up" when fromStationId < toStationId on a linear line', () => {
    expect(deriveDirection(makeSeg({ lineId: '1' }))).toBe('up');
  });

  it('returns "down" when fromStationId > toStationId on a linear line', () => {
    expect(deriveDirection(makeSeg({
      lineId: '1',
      fromStationId: '0151',
      toStationId: '0150',
    }))).toBe('down');
  });

  it('returns undefined for line 2 (loop line, direction model deferred)', () => {
    expect(deriveDirection(makeSeg({ lineId: '2' }))).toBeUndefined();
  });

  it('returns undefined for unknown line ids', () => {
    expect(deriveDirection(makeSeg({ lineId: 'KK' }))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "deriveDirection"`
Expected: 5 failing tests

- [ ] **Step 3: Implement `deriveDirection`**

Replace the stub body in `src/models/pattern.ts`:

```typescript
const LINEAR_LINE_IDS: ReadonlySet<string> = new Set([
  '1', '3', '4', '5', '6', '7', '8', '9',
]);

export function deriveDirection(
  firstSegment: RouteSegment | undefined,
): 'up' | 'down' | undefined {
  if (!firstSegment) return undefined;
  if (!LINEAR_LINE_IDS.has(firstSegment.lineId)) return undefined;
  return firstSegment.fromStationId < firstSegment.toStationId ? 'up' : 'down';
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts -t "deriveDirection"`
Expected: 5 passing tests

- [ ] **Step 5: Run the full new test file to confirm all helpers green**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/models/__tests__/pattern.test.ts`
Expected: All 14 tests pass (5 + 4 + 5)

- [ ] **Step 6: Commit**

```bash
git add src/models/__tests__/pattern.test.ts src/models/pattern.ts
git commit -m "$(cat <<'EOF'
feat(pattern): implement deriveDirection helper

Maps a RouteSegment's first leg to 'up'/'down' using lineId-aware
station-ID ordering. Linear Seoul Metro lines (1, 3-9) use ascending
station-ID as 'up'. Line 2 (loop) and unknown lines return undefined;
consumers fall back to 'up' as before.

Direction model can be refined in a follow-up phase without changing
the helper signature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase B — Producer Service

The existing producer is `PatternAnalysisService.predictCommute` at `src/services/pattern/patternAnalysisService.ts:107-126`. Phase B extends it to populate new fields.

## Task B.1: TDD — `predictCommute` populates derived fields on route success

**Files:**
- Modify: `src/services/pattern/__tests__/patternAnalysisService.test.ts`
- Modify: `src/services/pattern/patternAnalysisService.ts`

- [ ] **Step 1: Find the existing `predictCommute` test block**

Run: `grep -n "predictCommute\|describe(" src/services/pattern/__tests__/patternAnalysisService.test.ts | head -20`

Use the output to locate the existing `describe('predictCommute', ...)` block (or the closest existing block). All new tests in B.1/B.2/B.3 will be added inside that block, after any existing cases.

If no existing `describe('predictCommute', ...)` block exists, create one at the bottom of the file.

- [ ] **Step 2: Add the happy-path test**

Add inside the `predictCommute` describe block:

```typescript
import * as routeService from '@/services/route/routeService';
import {
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
} from '@/models/pattern';

// (Existing test file likely already mocks firebase. Add this mock if not
// already present; otherwise reuse the existing pattern mock helper.)
jest.mock('@/services/route/routeService');
const mockedCalculateRoute = routeService.calculateRoute as jest.MockedFunction<
  typeof routeService.calculateRoute
>;

describe('predictCommute — derived fields on route success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('populates transitSegments, walk/wait scalars, predictedMinutes, predictedArrivalTime, range, direction', async () => {
    // Arrange: stub getPatternForDay to return a stable pattern
    const stubPattern = {
      userId: 'u1',
      dayOfWeek: 2 as const,
      avgDepartureTime: '08:00',
      stdDevMinutes: 3,
      frequentRoute: {
        departureStationId: '0150',
        departureStationName: '서울역',
        arrivalStationId: '0220',
        arrivalStationName: '강남역',
        lineIds: ['1'],
      },
      confidence: 0.8,
      sampleCount: 10,
      lastUpdated: new Date('2026-05-12'),
    };
    jest
      .spyOn(patternAnalysisService, 'getPatternForDay')
      .mockResolvedValueOnce(stubPattern);

    mockedCalculateRoute.mockReturnValueOnce({
      segments: [
        {
          fromStationId: '0150', fromStationName: '서울역',
          toStationId: '0151', toStationName: '시청',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 20, isTransfer: false,
        },
      ],
      totalMinutes: 20,
      transferCount: 0,
      lineIds: ['1'],
    });

    // Act
    const result = await patternAnalysisService.predictCommute(
      'u1',
      new Date('2026-05-12'),
    );

    // Assert
    expect(result).not.toBeNull();
    expect(result?.transitSegments).toHaveLength(1);
    expect(result?.transitSegments?.[0].congestionForecast).toBeUndefined();
    expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
    expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
    expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
    expect(result?.predictedMinutes).toBe(4 + 3 + 3 + 20); // 30
    expect(result?.predictedArrivalTime).toBe('08:30');
    expect(result?.predictedMinutesRange).toEqual([27, 33]); // ±3 from stdDevMinutes
    expect(result?.direction).toBe('up'); // 0150 < 0151 on line 1
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/services/pattern/__tests__/patternAnalysisService.test.ts -t "derived fields on route success"`
Expected: 1 failing test (assertions fail — fields are undefined because producer doesn't populate them yet)

- [ ] **Step 4: Extend `predictCommute` in `patternAnalysisService.ts`**

Add imports at the top of the file (merge with existing pattern imports):

```typescript
import {
  // ...existing imports...
  PredictedTransitSegment,
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
  computeArrivalTime,
  deriveDirection,
} from '@/models/pattern';
import { calculateRoute } from '@/services/route/routeService';
```

Replace the body of `predictCommute` (currently lines 107-126):

```typescript
async predictCommute(
  userId: string,
  date: Date = new Date()
): Promise<PredictedCommute | null> {
  const dayOfWeek = getDayOfWeek(date);
  const pattern = await this.getPatternForDay(userId, dayOfWeek);

  if (!pattern) {
    return null;
  }

  // Resolve transit segments — soft-fail to null route on any failure.
  let route: ReturnType<typeof calculateRoute> = null;
  try {
    route = calculateRoute(
      pattern.frequentRoute.departureStationId,
      pattern.frequentRoute.arrivalStationId,
    );
  } catch {
    route = null;
  }

  const transitSegments: readonly PredictedTransitSegment[] | undefined =
    route && route.segments.length > 0
      ? route.segments.map((seg) => ({
          ...seg,
          congestionForecast: undefined,
        }))
      : undefined;

  const transitMinutes = transitSegments
    ? transitSegments.reduce((sum, seg) => sum + seg.estimatedMinutes, 0)
    : undefined;

  // Walk/wait defaults — always populated (deterministic).
  const walkToStationMinutes = DEFAULT_WALK_TO_STATION_MIN;
  const waitMinutes = DEFAULT_WAIT_MIN;
  const walkToDestinationMinutes = DEFAULT_WALK_TO_DEST_MIN;

  // Coupled: total + arrival only when transit is known.
  const predictedMinutes =
    transitMinutes !== undefined
      ? walkToStationMinutes + waitMinutes + walkToDestinationMinutes + transitMinutes
      : undefined;

  const predictedArrivalTime =
    predictedMinutes !== undefined
      ? computeArrivalTime(pattern.avgDepartureTime, predictedMinutes)
      : undefined;

  // Range from stdDev (clamped to [1, 10] minutes half-width).
  let predictedMinutesRange: readonly [number, number] | undefined;
  if (predictedMinutes !== undefined && pattern.stdDevMinutes > 0) {
    const half = Math.min(10, Math.max(1, Math.round(pattern.stdDevMinutes)));
    predictedMinutesRange = [predictedMinutes - half, predictedMinutes + half];
  }

  const direction = deriveDirection(route?.segments[0]);

  return {
    date: formatDateString(date),
    dayOfWeek,
    predictedDepartureTime: pattern.avgDepartureTime,
    route: pattern.frequentRoute,
    confidence: pattern.confidence,
    suggestedAlertTime: calculateAlertTime(pattern.avgDepartureTime),
    predictedMinutes,
    predictedArrivalTime,
    predictedMinutesRange,
    deltaMinutes: undefined, // 1st cut — no historical baseline
    direction,
    walkToStationMinutes,
    waitMinutes,
    walkToDestinationMinutes,
    transitSegments,
  };
},
```

- [ ] **Step 5: Run — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/services/pattern/__tests__/patternAnalysisService.test.ts -t "derived fields on route success"`
Expected: 1 passing test

- [ ] **Step 6: Commit**

```bash
git add src/services/pattern/patternAnalysisService.ts src/services/pattern/__tests__/patternAnalysisService.test.ts
git commit -m "$(cat <<'EOF'
feat(prediction): producer populates derived fields on route success

Extends patternAnalysisService.predictCommute to populate
transitSegments / walk-wait scalars / predictedMinutes /
predictedArrivalTime / predictedMinutesRange / direction from
routeService.calculateRoute + walk-wait defaults + pattern stdDev.

deltaMinutes intentionally left undefined — no historical baseline yet
(spec 4.1 step 7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task B.2: TDD — `predictCommute` soft-fails when route is null

**Files:**
- Modify: `src/services/pattern/__tests__/patternAnalysisService.test.ts`

(No production change expected — the soft-fail logic is already in B.1's implementation. This task is a contract test that locks the behavior in place.)

- [ ] **Step 1: Add three failing/passing-contract tests**

Inside the same `describe('predictCommute — derived fields on route success', ...)` block (or a sibling describe), add:

```typescript
it('returns base fields with transit/total/range undefined when calculateRoute returns null', async () => {
  jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
    userId: 'u1',
    dayOfWeek: 2 as const,
    avgDepartureTime: '08:00',
    stdDevMinutes: 3,
    frequentRoute: {
      departureStationId: 'unknown-from',
      departureStationName: 'X',
      arrivalStationId: 'unknown-to',
      arrivalStationName: 'Y',
      lineIds: [],
    },
    confidence: 0.8,
    sampleCount: 10,
    lastUpdated: new Date(),
  });
  mockedCalculateRoute.mockReturnValueOnce(null);

  const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

  expect(result).not.toBeNull();
  expect(result?.transitSegments).toBeUndefined();
  expect(result?.predictedMinutes).toBeUndefined();
  expect(result?.predictedArrivalTime).toBeUndefined();
  expect(result?.predictedMinutesRange).toBeUndefined();
  expect(result?.direction).toBeUndefined();
  // Walk/wait defaults still set
  expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
  expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
  expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
  // Base fields still set
  expect(result?.predictedDepartureTime).toBe('08:00');
  expect(result?.confidence).toBe(0.8);
});

it('soft-fails to base when calculateRoute throws', async () => {
  jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
    userId: 'u1',
    dayOfWeek: 2 as const,
    avgDepartureTime: '08:00',
    stdDevMinutes: 3,
    frequentRoute: {
      departureStationId: 'a', departureStationName: 'A',
      arrivalStationId: 'b', arrivalStationName: 'B',
      lineIds: ['1'],
    },
    confidence: 0.8,
    sampleCount: 10,
    lastUpdated: new Date(),
  });
  mockedCalculateRoute.mockImplementationOnce(() => {
    throw new Error('boom');
  });

  const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

  expect(result).not.toBeNull();
  expect(result?.transitSegments).toBeUndefined();
  expect(result?.predictedMinutes).toBeUndefined();
});

it('returns predictedMinutesRange undefined when stdDevMinutes is 0', async () => {
  jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
    userId: 'u1',
    dayOfWeek: 2 as const,
    avgDepartureTime: '08:00',
    stdDevMinutes: 0, // zero stddev
    frequentRoute: {
      departureStationId: '0150', departureStationName: '서울역',
      arrivalStationId: '0151', arrivalStationName: '시청',
      lineIds: ['1'],
    },
    confidence: 0.8,
    sampleCount: 10,
    lastUpdated: new Date(),
  });
  mockedCalculateRoute.mockReturnValueOnce({
    segments: [{
      fromStationId: '0150', fromStationName: '서울역',
      toStationId: '0151', toStationName: '시청',
      lineId: '1', lineName: '1호선',
      estimatedMinutes: 10, isTransfer: false,
    }],
    totalMinutes: 10,
    transferCount: 0,
    lineIds: ['1'],
  });

  const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

  expect(result?.predictedMinutes).toBe(20); // 4+3+3+10
  expect(result?.predictedMinutesRange).toBeUndefined();
});
```

- [ ] **Step 2: Run — expect PASS (3 contract tests already satisfied by B.1's impl)**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/services/pattern/__tests__/patternAnalysisService.test.ts -t "predictCommute"`
Expected: All cases in the block pass. If any fail, the B.1 implementation is incomplete — fix the producer (not the test) until green.

- [ ] **Step 3: Commit**

```bash
git add src/services/pattern/__tests__/patternAnalysisService.test.ts
git commit -m "$(cat <<'EOF'
test(prediction): lock in predictCommute soft-fail contract

Contract tests for three failure modes that producer must handle without
throwing: calculateRoute returns null, calculateRoute throws, and
stdDevMinutes is 0. Each verifies base fields + walk/wait defaults stay
set while transit/total/range degrade to undefined.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task B.3: TDD — `predictCommute` always returns `deltaMinutes: undefined` and `transitSegments[i].congestionForecast: undefined`

**Files:**
- Modify: `src/services/pattern/__tests__/patternAnalysisService.test.ts`

(Locks the 1st-cut contracts so future contributors don't accidentally start populating these without explicit design intent.)

- [ ] **Step 1: Add the two contract tests**

```typescript
it('always sets deltaMinutes to undefined in 1st cut (no historical baseline)', async () => {
  jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
    userId: 'u1', dayOfWeek: 2 as const,
    avgDepartureTime: '08:00', stdDevMinutes: 3,
    frequentRoute: {
      departureStationId: '0150', departureStationName: '서울역',
      arrivalStationId: '0151', arrivalStationName: '시청',
      lineIds: ['1'],
    },
    confidence: 0.8, sampleCount: 10, lastUpdated: new Date(),
  });
  mockedCalculateRoute.mockReturnValueOnce({
    segments: [{
      fromStationId: '0150', fromStationName: '서울역',
      toStationId: '0151', toStationName: '시청',
      lineId: '1', lineName: '1호선',
      estimatedMinutes: 10, isTransfer: false,
    }],
    totalMinutes: 10, transferCount: 0, lineIds: ['1'],
  });

  const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));
  expect(result?.deltaMinutes).toBeUndefined();
});

it('always sets transitSegments[*].congestionForecast to undefined (filled by Phase d)', async () => {
  jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
    userId: 'u1', dayOfWeek: 2 as const,
    avgDepartureTime: '08:00', stdDevMinutes: 3,
    frequentRoute: {
      departureStationId: '0150', departureStationName: '서울역',
      arrivalStationId: '0152', arrivalStationName: '종각',
      lineIds: ['1'],
    },
    confidence: 0.8, sampleCount: 10, lastUpdated: new Date(),
  });
  mockedCalculateRoute.mockReturnValueOnce({
    segments: [
      {
        fromStationId: '0150', fromStationName: '서울역',
        toStationId: '0151', toStationName: '시청',
        lineId: '1', lineName: '1호선',
        estimatedMinutes: 2, isTransfer: false,
      },
      {
        fromStationId: '0151', fromStationName: '시청',
        toStationId: '0152', toStationName: '종각',
        lineId: '1', lineName: '1호선',
        estimatedMinutes: 2, isTransfer: false,
      },
    ],
    totalMinutes: 4, transferCount: 0, lineIds: ['1'],
  });

  const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));
  expect(result?.transitSegments).toHaveLength(2);
  expect(result?.transitSegments?.every((s) => s.congestionForecast === undefined)).toBe(true);
});
```

- [ ] **Step 2: Run — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/services/pattern/__tests__/patternAnalysisService.test.ts -t "predictCommute"`
Expected: All passes.

- [ ] **Step 3: Commit**

```bash
git add src/services/pattern/__tests__/patternAnalysisService.test.ts
git commit -m "$(cat <<'EOF'
test(prediction): lock 1st-cut undefined-by-design contracts

deltaMinutes and transitSegments[*].congestionForecast are both
intentionally undefined in this phase — deltaMinutes will be added when
a historical baseline lookup ships, congestionForecast in Phase d
ingestion. These tests prevent silent drift.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase C — Consumer Cleanup

## Task C.1: `WeeklyPredictionScreen` cleanup with regression test

**Files:**
- Modify: `src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx`
- Modify: `src/screens/prediction/WeeklyPredictionScreen.tsx`

- [ ] **Step 1: Add a regression test that asserts model fields are used (not heuristics)**

The existing test file already mocks `@/hooks/useCommutePattern` (see `src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx:87-98`). Override the mock per-test via `mockReturnValueOnce` to inject a rich prediction.

Add at the top of the test file (after existing imports):

```typescript
import type { PredictedCommute } from '@/models/pattern';
import { useCommutePattern } from '@/hooks/useCommutePattern';
```

Add inside the existing `describe('WeeklyPredictionScreen', ...)` block (or as a sibling describe at the end of the file):

```typescript
describe('WeeklyPredictionScreen — model field consumption', () => {
  const richPrediction: PredictedCommute = {
    date: '2026-05-12',
    dayOfWeek: 2,
    predictedDepartureTime: '08:00',
    predictedArrivalTime: '08:30',
    predictedMinutes: 30,
    predictedMinutesRange: [27, 33],
    direction: 'up',
    walkToStationMinutes: 4,
    waitMinutes: 3,
    walkToDestinationMinutes: 3,
    transitSegments: [{
      fromStationId: '0150', fromStationName: '서울역',
      toStationId: '0220', toStationName: '강남역',
      lineId: '1', lineName: '1호선',
      estimatedMinutes: 20, isTransfer: false,
    }],
    route: {
      departureStationId: '0150', departureStationName: '서울역',
      arrivalStationId: '0220', arrivalStationName: '강남역',
      lineIds: ['1'],
    },
    confidence: 0.8,
    suggestedAlertTime: '07:45',
  };

  const mockHookWithPrediction = (): void => {
    (useCommutePattern as jest.Mock).mockReturnValueOnce({
      todayPrediction: richPrediction,
      patterns: [],
      weekPredictions: [richPrediction],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });
  };

  it('renders predictedMinutes from model, not heuristic', () => {
    mockHookWithPrediction();
    const { getByText } = render(<WeeklyPredictionScreen />);
    // The screen renders "예상 N분" in the big-number card.
    // With model.predictedMinutes = 30, the text must reflect 30.
    expect(getByText(/예상 30분/)).toBeTruthy();
  });

  it('renders predictedMinutesRange from model, not ±2/±4 heuristic', () => {
    mockHookWithPrediction();
    const { getByText } = render(<WeeklyPredictionScreen />);
    // Range UI text should mention 27 or 33 (model range), not 28/32 (±2 heuristic).
    expect(getByText(/27|33/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (consumer still uses heuristics)**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx -t "model field consumption"`
Expected: FAIL — either the assertion fails or the screen still calls `routeService.calculateRoute` synthesis.

- [ ] **Step 3: Rewrite WeeklyPredictionScreen — remove TODO blocks and heuristics**

In `src/screens/prediction/WeeklyPredictionScreen.tsx`, apply the following surgical edits. Each is keyed to a specific block; the spec ([§4.3](../specs/2026-05-12-predicted-commute-model-extension-design.md#43-consumer-정리)) lists them.

3a. Remove `routeService.calculateRoute` import and inline call. Replace the `routeRideDurationMin` useMemo (currently around lines 222-237) with:

```typescript
// Sum of transit segments straight from the model. Falls back to a
// rough estimate (10 min) if no segments are present.
const routeRideDurationMin = useMemo(() => {
  if (!todayPrediction?.transitSegments?.length) {
    return 10;
  }
  return todayPrediction.transitSegments.reduce(
    (sum, seg) => sum + seg.estimatedMinutes,
    0,
  );
}, [todayPrediction]);
```

3b. Replace the `predictedMinutes` useMemo (around line 193) with:

```typescript
const predictedMinutes = useMemo(() => {
  if (todayPrediction?.predictedMinutes !== undefined) {
    return todayPrediction.predictedMinutes;
  }
  // Fallback for old predictions without derived fields.
  return DEFAULT_WALK_TO_STATION_MIN
       + DEFAULT_WAIT_MIN
       + routeRideDurationMin
       + DEFAULT_WALK_TO_DEST_MIN;
}, [todayPrediction, routeRideDurationMin]);
```

(Import the three `DEFAULT_*_MIN` constants from `@/models/pattern` at the top of the file.)

3c. Replace the `range` useMemo (around lines 199-206) with:

```typescript
const range = useMemo(() => {
  if (todayPrediction?.predictedMinutesRange) {
    return todayPrediction.predictedMinutesRange;
  }
  return [Math.max(0, predictedMinutes - 2), predictedMinutes + 2] as const;
}, [todayPrediction, predictedMinutes]);
```

3d. Replace `direction: 'up'` default (around line 303) with:

```typescript
const direction: 'up' | 'down' = todayPrediction?.direction ?? 'up';
```

3e. Replace any hardcoded `4/3/3` walk/wait/walk values (around line 251) with reads from `todayPrediction`:

```typescript
const walkToStationMin = todayPrediction?.walkToStationMinutes ?? DEFAULT_WALK_TO_STATION_MIN;
const waitMin          = todayPrediction?.waitMinutes          ?? DEFAULT_WAIT_MIN;
const walkToDestMin    = todayPrediction?.walkToDestinationMinutes ?? DEFAULT_WALK_TO_DEST_MIN;
```

3f. Delete the 7 TODO comment blocks. Search for each of these and remove the entire surrounding comment:
- `does not yet expose real per-segment durations`
- `until \`PredictedCommute\` exposes duration or paired arrival time`
- `useMLPrediction exposes segment-level confidence`
- `temporary default until PredictedCommute exposes travel direction`
- `congestionLevel intentionally omitted — not in PredictedCommute yet`
- `Task #11 (P1.3): Replace the residual`
- Any remaining `tracked` / `TODO` markers in the file that reference these gaps

Verify removal with: `grep -nE "(intentionally omitted|temporary default|until \`PredictedCommute\`|exposes segment-level)" src/screens/prediction/WeeklyPredictionScreen.tsx`
Expected: zero matches.

- [ ] **Step 4: Run the regression test — expect PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx`
Expected: All tests pass (including the two new regression tests).

- [ ] **Step 5: Run TypeScript and confirm no errors**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/screens/prediction/WeeklyPredictionScreen.tsx src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx
git commit -m "$(cat <<'EOF'
refactor(prediction): consume PredictedCommute derived fields directly

Removes seven TODO blocks, the ±2/±4 range heuristic, the hardcoded
4/3/3 walk/wait/walk values, the 'up' direction default, and the
inline routeService.calculateRoute call from WeeklyPredictionScreen.
The screen now reads transitSegments / predictedMinutes /
predictedMinutesRange / direction / walk-wait scalars straight from
the model, with minimal fallbacks for cases when the producer hasn't
populated them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task C.2: `HomeScreen` cleanup with regression test

**Files:**
- Modify: `src/screens/home/__tests__/HomeScreen.test.tsx`
- Modify: `src/screens/home/HomeScreen.tsx`

- [ ] **Step 1: Locate the `effectiveHero` synthesis**

Run: `grep -n "effectiveHero\|deltaMinutes\|arrivalTime" src/screens/home/HomeScreen.tsx | head -20`

Use the output to identify where HomeScreen currently synthesizes `effectiveHero.deltaMinutes` and `effectiveHero.arrivalTime` from a prediction.

- [ ] **Step 2: Add a regression test**

`src/screens/home/__tests__/HomeScreen.test.tsx` should already mock `@/hooks/useCommutePattern` (verify with `grep -n "useCommutePattern" src/screens/home/__tests__/HomeScreen.test.tsx`). If yes, use the same `mockReturnValueOnce` override pattern as C.1; if not, add the same `jest.mock` block at the top of the file.

Add the regression test inside an existing describe block (e.g. `describe('Rendering', ...)`):

```typescript
import type { PredictedCommute } from '@/models/pattern';
import { useCommutePattern } from '@/hooks/useCommutePattern';

const richPrediction: PredictedCommute = {
  date: '2026-05-12', dayOfWeek: 2,
  predictedDepartureTime: '08:00',
  predictedArrivalTime: '08:30',
  predictedMinutes: 30,
  deltaMinutes: 2,
  direction: 'up',
  route: {
    departureStationId: '0150', departureStationName: '서울역',
    arrivalStationId: '0220', arrivalStationName: '강남역',
    lineIds: ['1'],
  },
  confidence: 0.8,
  suggestedAlertTime: '07:45',
};

it('forwards predictedArrivalTime and deltaMinutes from prediction (no synthesis)', () => {
  (useCommutePattern as jest.Mock).mockReturnValueOnce({
    todayPrediction: richPrediction,
    patterns: [], weekPredictions: [richPrediction],
    recentLogs: [], notificationSettings: null, todayNotification: null,
    loading: false, error: null,
  });
  const { getByText } = render(<HomeScreen />);
  // With model.predictedArrivalTime = '08:30' the MLHero accessibility
  // label or visible text shows the value. Adjust selector to match
  // the actual MLHeroCard rendered text in this codebase.
  expect(getByText(/08:30/)).toBeTruthy();
});
```

- [ ] **Step 3: Run — expect FAIL or PASS**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/screens/home/__tests__/HomeScreen.test.tsx -t "forwards model fields"`

If HomeScreen currently synthesizes (and the synthesis happens to produce the same value), test may already pass. Either way, proceed to Step 4 to remove the synthesis.

- [ ] **Step 4: Remove HomeScreen synthesis**

Edit `src/screens/home/HomeScreen.tsx` so that the `effectiveHero` (or equivalent) reads `deltaMinutes`, `arrivalTime`, and `confidence` directly from `todayPrediction`:

```typescript
// Before (synthesized):
//   deltaMinutes: someComputation(...)
//   arrivalTime: timeAdd(predictedDepartureTime, predictedMinutes)
//
// After (forwarded):
const effectiveHero = todayPrediction
  ? {
      predictedMinutes: todayPrediction.predictedMinutes,
      deltaMinutes: todayPrediction.deltaMinutes,
      arrivalTime: todayPrediction.predictedArrivalTime,
      confidence: todayPrediction.confidence,
    }
  : null;
```

(Adjust to match the existing variable/struct names. Keep null-handling for `predictedMinutes === undefined` — pass `undefined` straight through; MLHeroCard handles it.)

- [ ] **Step 5: Run all HomeScreen tests**

Run: `TZ=Asia/Seoul npx jest --watchman=false src/screens/home/__tests__/HomeScreen.test.tsx`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/home/HomeScreen.tsx src/screens/home/__tests__/HomeScreen.test.tsx
git commit -m "$(cat <<'EOF'
refactor(home): forward PredictedCommute fields to MLHero without synthesis

HomeScreen previously synthesized deltaMinutes and arrivalTime from
predictedDepartureTime + predictedMinutes. With the model now exposing
both as first-class derived fields, HomeScreen just forwards them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase D — Verification

## Task D.1: Full verification + acceptance criteria walkthrough

**Files:** none (verification only)

- [ ] **Step 1: TypeScript**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 2: Lint**

Run: `npx eslint --max-warnings 0 src/models/pattern.ts src/services/pattern/patternAnalysisService.ts src/screens/prediction/WeeklyPredictionScreen.tsx src/screens/home/HomeScreen.tsx src/models/__tests__/pattern.test.ts src/services/pattern/__tests__/patternAnalysisService.test.ts src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx src/screens/home/__tests__/HomeScreen.test.tsx`
Expected: exit 0, no warnings.

- [ ] **Step 3: Affected-module tests with coverage**

Run: `TZ=Asia/Seoul npx jest --watchman=false --coverage --collectCoverageFrom='src/models/pattern.ts' --collectCoverageFrom='src/services/pattern/patternAnalysisService.ts' src/models/__tests__/pattern.test.ts src/services/pattern/__tests__/patternAnalysisService.test.ts src/screens/prediction/__tests__/WeeklyPredictionScreen.test.tsx src/screens/home/__tests__/HomeScreen.test.tsx`
Expected: All suites pass. Coverage for `pattern.ts` and `patternAnalysisService.ts` reported.

- [ ] **Step 4: Full test suite (regression check)**

Run: `TZ=Asia/Seoul npx jest --watchman=false`
Expected: All suites pass, zero new failures vs baseline on `origin/main`.

- [ ] **Step 5: Walk through the spec acceptance criteria**

Open `docs/superpowers/specs/2026-05-12-predicted-commute-model-extension-design.md` §7 and verify each row:

| # | Verification |
|---|--------------|
| 1 | `grep -n "PredictedTransitSegment\|predictedMinutes\?:\|deltaMinutes\?:\|walkToStationMinutes\?:\|transitSegments\?:" src/models/pattern.ts` → expect non-empty matches |
| 2 | B.1 test passes |
| 3 | B.2 test passes (route throw + null) |
| 4 | `grep -nE "(intentionally omitted\|TODO\|temporary default)" src/screens/prediction/WeeklyPredictionScreen.tsx` → expect 0 matches |
| 5 | `git diff origin/main..HEAD -- src/screens/home/HomeScreen.tsx` shows synthesis removal |
| 6 | Step 4 above passes |
| 7 | Step 3 above shows no coverage drop |
| 8 | `grep -n "congestionForecast" src/models/pattern.ts src/services/pattern/patternAnalysisService.ts` shows slot exists + producer sets to `undefined` |

- [ ] **Step 6: Final commit (only if any verification step modified files)**

Most likely no changes. If verification surfaces a small lint/type issue, fix surgically and commit:

```bash
git add <changed files>
git commit -m "chore(prediction): fix lint/type issue surfaced by verification"
```

- [ ] **Step 7: Push branch and open PR**

```bash
git push -u origin feat/predicted-commute-model-extension
# Then: gh pr create ... (sandbox bypass may be needed for TLS; see project memory feedback_gh_cli_sandbox_tls.md)
```

PR body skeleton:

```markdown
## Summary
Extend `PredictedCommute` with seven optional derived fields and a
`PredictedTransitSegment` sub-interface that reserves a
`congestionForecast` slot for Phase d. Centralize derivation in
`patternAnalysisService.predictCommute` and remove duplicated synthesis
from `WeeklyPredictionScreen` and `HomeScreen`.

Spec: `docs/superpowers/specs/2026-05-12-predicted-commute-model-extension-design.md`

## Verification
- `npx tsc --noEmit` — 0 errors
- `npx eslint --max-warnings 0 <affected files>` — 0 warnings
- `TZ=Asia/Seoul npx jest --watchman=false` — all suites pass

## Test plan
- [ ] iOS device: open WeeklyPrediction — predictedMinutes / range / direction render
- [ ] iOS device: open HomeScreen MLHero — deltaMinutes / arrivalTime / confidence render
- [ ] iOS device: tap MLHero → WeeklyPrediction navigation works
- [ ] Android: same flows
```

---

## Notes for the Executing Worker

- **Branch:** Stay on `feat/predicted-commute-model-extension`. Do not rebase / squash mid-plan; each task's commit is intended to be visible in history for review.
- **Memory references that apply to this work:**
  - `feedback_check_branch_before_commit.md` — run `git branch --show-current` immediately before each commit
  - `feedback_commit_message_quoting.md` — every commit in this plan uses HEREDOC-quoted `git commit -m "$(cat <<'EOF' ... EOF)"` form
  - `feedback_husky_lint_staged_autostage.md` — stage only the files listed in each commit; don't `git add .`
  - `feedback_tz_naive_date_format_ci_regression.md` — every jest invocation uses `TZ=Asia/Seoul` prefix
- **If a test does not match the existing render helper pattern in the file:** read 30-50 lines of the file first to learn the local convention, then adapt the test to use the same helper instead of inventing a new one.
- **If the producer test cannot easily mock `getPatternForDay`:** check the existing patternAnalysisService.test.ts for the firebase mocking pattern used elsewhere in the file and follow that pattern. Do not rebuild from scratch.
- **Coverage thresholds:** project policy is stmt 75% / fn 70% / branch 60% (`.claude/rules/coverage-thresholds.md`). The new helpers are tiny and fully tested → they raise coverage; no risk of dropping below threshold.
