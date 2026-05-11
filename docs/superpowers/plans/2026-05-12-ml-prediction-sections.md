# ML Prediction Page — Sections 6-9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WeeklyPredictionScreen.tsx의 미구현 4개 섹션(segment breakdown, hourly congestion, prediction factors, weekly trend)을 sub-component로 추출하고 실데이터로 wiring한다.

**Architecture:** 기존 화면 호스트는 유지하고 4개 sub-component를 `src/components/prediction/` 하위에 신규 생성. 기존 hook/service(`useCommutePattern`, `useCongestion`, `weatherService`, `routeService`)를 조합해 실데이터 wiring. 부족한 데이터(시간대별 혼잡도)만 `congestionService.getHourlyForecast()` 메서드를 추가한다. 4 phase 모두 독립 PR로 진행해 충돌·회귀 위험을 차단한다.

**Tech Stack:** React Native 0.72 / TypeScript strict / Jest + React Native Testing Library / Firebase Firestore / Wanted 디자인 토큰 (`src/styles/modernTheme.ts`) / lucide-react-native / Pretendard 폰트 헬퍼

**Reference Spec:** `docs/superpowers/specs/2026-05-12-ml-prediction-sections-design.md`

---

## Pre-Implementation Notes

**모든 task에 공통 적용**:
- Path alias 사용 (`@/` = `src/`), 상대 경로 금지
- `any` 타입 금지 (`unknown` + type guard)
- 컴포넌트는 `React.memo` + `displayName` 부착
- `useEffect` cleanup 필수
- 모든 터치 요소에 `accessibilityLabel`
- `StyleSheet.create()` 사용 (인라인 금지)
- 색상은 Wanted 토큰 사용 (다크모드 지원)
- 폰트는 `weightToFontFamily('700')` 또는 `typeStyle('label2')` 헬퍼 사용 (`fontWeight: '700'` 단독 금지 — pre-commit `lint:typography`가 차단)
- 테스트는 `__tests__/` 디렉토리, 파일명 `*.test.tsx`

**Phase 권장 순서** (독립이지만 안정성 위해): Phase 1 → Phase 4 → Phase 3 → Phase 2

## Phase 1 — Segment Breakdown (Section 6)

### Task 1: SegmentBreakdownSection 컴포넌트 (TDD)

**Files:**
- Test: `src/components/prediction/__tests__/SegmentBreakdownSection.test.tsx`
- Create: `src/components/prediction/SegmentBreakdownSection.tsx`
- Modify: `src/components/prediction/index.ts` (export 추가)

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/prediction/__tests__/SegmentBreakdownSection.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { SegmentBreakdownSection } from '@/components/prediction/SegmentBreakdownSection';
import { ThemeProvider } from '@/services/theme';

const mockRoute = {
  walkToStation: { durationMin: 4 },
  wait: { lineId: '2', direction: '잠실', durationMin: 3 },
  ride: {
    fromStation: '홍대입구',
    toStation: '강남',
    stopsCount: 8,
    durationMin: 18,
    congestionLevel: 'moderate' as const,
  },
  walkToDestination: { durationMin: 3 },
};

const mockOrigin = { name: '집', exit: '홍대입구역 9번출구' };
const mockDestination = { name: '강남역 11번출구', exit: '회사' };

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('SegmentBreakdownSection', () => {
  it('renders all 4 segment rows', () => {
    const { getByTestId } = renderWithTheme(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    expect(getByTestId('segment-row-walk-origin')).toBeTruthy();
    expect(getByTestId('segment-row-wait')).toBeTruthy();
    expect(getByTestId('segment-row-ride')).toBeTruthy();
    expect(getByTestId('segment-row-walk-destination')).toBeTruthy();
  });

  it('displays correct duration for each row', () => {
    const { getByTestId } = renderWithTheme(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    expect(getByTestId('segment-row-walk-origin')).toHaveTextContent('4');
    expect(getByTestId('segment-row-wait')).toHaveTextContent('3');
    expect(getByTestId('segment-row-ride')).toHaveTextContent('18');
    expect(getByTestId('segment-row-walk-destination')).toHaveTextContent('3');
  });

  it('shows line badge with lineId in wait row', () => {
    const { getByTestId } = renderWithTheme(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    const waitRow = getByTestId('segment-row-wait');
    expect(waitRow).toHaveTextContent('2호선');
    expect(waitRow).toHaveTextContent('잠실');
  });

  it('shows stops count in ride row', () => {
    const { getByTestId } = renderWithTheme(
      <SegmentBreakdownSection
        route={mockRoute}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    expect(getByTestId('segment-row-ride')).toHaveTextContent('8개역');
  });

  it('renders empty state when route is null', () => {
    const { getByText } = renderWithTheme(
      <SegmentBreakdownSection
        route={null}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    expect(getByText('경로 정보 없음')).toBeTruthy();
  });

  it('shows 0분 when walkToStation duration is 0', () => {
    const route = { ...mockRoute, walkToStation: { durationMin: 0 } };
    const { getByTestId } = renderWithTheme(
      <SegmentBreakdownSection
        route={route}
        origin={mockOrigin}
        destination={mockDestination}
      />
    );
    expect(getByTestId('segment-row-walk-origin')).toHaveTextContent('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/prediction/__tests__/SegmentBreakdownSection.test.tsx --watchman=false`
Expected: FAIL with "Cannot find module '@/components/prediction/SegmentBreakdownSection'"

- [ ] **Step 3: Create the component**

```typescript
// src/components/prediction/SegmentBreakdownSection.tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Footprints, Clock, Train } from 'lucide-react-native';
import { useTheme, ThemeColors } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';
import { LineBadge } from '@/components/atoms/LineBadge';
import { CongestionDots } from '@/components/atoms/CongestionDots';
import type { CongestionLevel } from '@/models/congestion';

export interface PredictedRoute {
  readonly walkToStation: { durationMin: number };
  readonly wait: { lineId: string; direction: string; durationMin: number };
  readonly ride: {
    readonly fromStation: string;
    readonly toStation: string;
    readonly stopsCount: number;
    readonly durationMin: number;
    readonly congestionLevel?: CongestionLevel;
  };
  readonly walkToDestination: { durationMin: number };
}

export interface SegmentBreakdownSectionProps {
  readonly route: PredictedRoute | null;
  readonly origin: { name: string; exit: string };
  readonly destination: { name: string; exit: string };
}

interface RowProps {
  readonly testID: string;
  readonly icon: React.ComponentType<{ size: number; color: string }>;
  readonly label: string;
  readonly sublabel: string;
  readonly durationMin: number;
  readonly badge?: React.ReactNode;
  readonly dots?: React.ReactNode;
}

const SegmentRow: React.FC<RowProps> = memo(({ testID, icon: Icon, label, sublabel, durationMin, badge, dots }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.iconCircle}>
        <Icon size={18} color={colors.text.secondary} />
      </View>
      <View style={styles.middle}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {badge}
          {dots}
        </View>
        <Text style={styles.sublabel}>{sublabel}</Text>
      </View>
      <Text style={styles.duration}>
        <Text style={styles.durationNumber}>{durationMin}</Text>
        <Text style={styles.durationUnit}>분</Text>
      </Text>
    </View>
  );
});
SegmentRow.displayName = 'SegmentRow';

const SegmentBreakdownSectionComponent: React.FC<SegmentBreakdownSectionProps> = ({ route, origin, destination }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (!route) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>경로 정보 없음</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SegmentRow
        testID="segment-row-walk-origin"
        icon={Footprints}
        label="도보"
        sublabel={`${origin.name} → ${origin.exit}`}
        durationMin={route.walkToStation.durationMin}
      />
      <SegmentRow
        testID="segment-row-wait"
        icon={Clock}
        label="대기"
        sublabel={`${route.wait.lineId}호선 ${route.wait.direction} 방면`}
        durationMin={route.wait.durationMin}
        badge={<LineBadge lineId={route.wait.lineId} size="sm" />}
      />
      <SegmentRow
        testID="segment-row-ride"
        icon={Train}
        label="승차"
        sublabel={`${route.ride.fromStation} → ${route.ride.toStation} (${route.ride.stopsCount}개역)`}
        durationMin={route.ride.durationMin}
        dots={route.ride.congestionLevel ? <CongestionDots level={route.ride.congestionLevel} /> : null}
      />
      <SegmentRow
        testID="segment-row-walk-destination"
        icon={Footprints}
        label="도보"
        sublabel={`${destination.name} → ${destination.exit}`}
        durationMin={route.walkToDestination.durationMin}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  middle: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 16,
    fontFamily: weightToFontFamily('700'),
    color: colors.text.primary,
  },
  sublabel: {
    fontSize: 13,
    fontFamily: weightToFontFamily('400'),
    color: colors.text.tertiary,
    marginTop: 2,
  },
  duration: {},
  durationNumber: {
    fontSize: 20,
    fontFamily: weightToFontFamily('700'),
    color: colors.text.primary,
  },
  durationUnit: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.secondary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

export const SegmentBreakdownSection = memo(SegmentBreakdownSectionComponent);
SegmentBreakdownSection.displayName = 'SegmentBreakdownSection';
```

Verify `LineBadge` and `CongestionDots` paths before saving:
```bash
ls src/components/atoms/LineBadge* src/components/atoms/CongestionDots* 2>&1
```
If different, adjust imports.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- src/components/prediction/__tests__/SegmentBreakdownSection.test.tsx --watchman=false`
Expected: PASS — 6 tests

- [ ] **Step 5: Export from prediction index**

Read `src/components/prediction/index.ts` first; if it doesn't exist, create with:
```typescript
export { SegmentBreakdownSection } from './SegmentBreakdownSection';
export type { SegmentBreakdownSectionProps, PredictedRoute } from './SegmentBreakdownSection';
```
If it exists, add only the two lines above.

- [ ] **Step 6: Commit**

```bash
git add src/components/prediction/SegmentBreakdownSection.tsx \
        src/components/prediction/__tests__/SegmentBreakdownSection.test.tsx \
        src/components/prediction/index.ts
git commit -m "feat(prediction): add SegmentBreakdownSection component

Phase 1 of ML prediction Sections 6-9 (spec: 2026-05-12).
4-row layout (도보/대기/승차/도보) with LineBadge and CongestionDots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: WeeklyPredictionScreen Section 6 통합

**Files:**
- Modify: `src/screens/prediction/WeeklyPredictionScreen.tsx`

- [ ] **Step 1: Locate the Section 6 placeholder**

Run: `grep -n "Section 6\|segment\|도보\|placeholder" src/screens/prediction/WeeklyPredictionScreen.tsx | head -20`

Identify the JSX placeholder block (likely a `<View>` with a comment like `{/* TODO Section 6 */}` or stub Text). Note the line range.

- [ ] **Step 2: Replace placeholder with SegmentBreakdownSection**

In `WeeklyPredictionScreen.tsx`:

Add import (near other prediction component imports):
```typescript
import { SegmentBreakdownSection, type PredictedRoute } from '@/components/prediction';
import { useCommutePattern } from '@/hooks/useCommutePattern';
```

Inside the component, build the route from existing hooks (use `useCommutePattern` if not already imported):
```typescript
const { todayPrediction } = useCommutePattern();

const route: PredictedRoute | null = todayPrediction
  ? {
      walkToStation: { durationMin: todayPrediction.walkOriginMin ?? 4 },
      wait: {
        lineId: todayPrediction.route?.firstLineId ?? '2',
        direction: todayPrediction.route?.firstDirection ?? '잠실',
        durationMin: todayPrediction.waitMin ?? 3,
      },
      ride: {
        fromStation: todayPrediction.route?.fromStation ?? '홍대입구',
        toStation: todayPrediction.route?.toStation ?? '강남',
        stopsCount: todayPrediction.route?.stopsCount ?? 0,
        durationMin: todayPrediction.rideMin ?? 0,
        congestionLevel: todayPrediction.congestionLevel,
      },
      walkToDestination: { durationMin: todayPrediction.walkDestinationMin ?? 3 },
    }
  : null;

const origin = { name: '집', exit: todayPrediction?.route?.fromExit ?? '' };
const destination = { name: todayPrediction?.route?.toStation ?? '', exit: '회사' };
```

Replace placeholder JSX with:
```tsx
<SegmentBreakdownSection route={route} origin={origin} destination={destination} />
```

If `PredictedCommute` type doesn't actually expose `walkOriginMin`/`route.firstLineId`/etc., add a small adapter function in `WeeklyPredictionScreen.tsx`:
```typescript
function adaptToRoute(pred: PredictedCommute | null): PredictedRoute | null {
  if (!pred) return null;
  // Best-effort mapping. Falls back to sensible defaults if fields missing.
  return { /* same as above but read from actual fields */ };
}
```

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: 0 new errors (pre-existing `StationDetailScreen.tsx` error is unrelated)

If new errors appear, fix the field mapping based on actual `PredictedCommute` type at `src/models/pattern.ts`.

- [ ] **Step 4: Verify component renders**

Run: `npm start` in one terminal, open the app, navigate to commute prediction screen.
Verify: 4 segment rows visible matching screenshot Section 6.
If you can't run the app, run: `npm test -- src/screens/prediction --watchman=false` and verify no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/screens/prediction/WeeklyPredictionScreen.tsx
git commit -m "feat(prediction): wire SegmentBreakdownSection into WeeklyPredictionScreen

Replaces Section 6 placeholder with real data from useCommutePattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

## Phase 4 — Weekly Trend (Section 9)

> Order rationale: Phase 4 is the simplest data wiring (`useCommutePattern.weekPredictions` already exists). Doing it second establishes chart patterns reused in Phase 2.

### Task 3: WeeklyTrendChart 컴포넌트 (TDD)

**Files:**
- Test: `src/components/prediction/__tests__/WeeklyTrendChart.test.tsx`
- Create: `src/components/prediction/WeeklyTrendChart.tsx`
- Modify: `src/components/prediction/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/prediction/__tests__/WeeklyTrendChart.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { WeeklyTrendChart } from '@/components/prediction/WeeklyTrendChart';
import { ThemeProvider } from '@/services/theme';

const mockDays = [
  { dayLabel: '월' as const, durationMin: 32, isToday: false },
  { dayLabel: '화' as const, durationMin: 30, isToday: false },
  { dayLabel: '수' as const, durationMin: 28, isToday: true },
  { dayLabel: '목' as const, durationMin: 31, isToday: false },
  { dayLabel: '금' as const, durationMin: 33, isToday: false },
];

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('WeeklyTrendChart', () => {
  it('renders 5 day bars', () => {
    const { getByTestId } = renderWithTheme(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    for (let i = 0; i < 5; i++) {
      expect(getByTestId(`weekly-bar-${i}`)).toBeTruthy();
    }
  });

  it('highlights today bar (Wed)', () => {
    const { getByTestId } = renderWithTheme(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    expect(getByTestId('weekly-today-bar')).toBeTruthy();
    expect(getByTestId('weekly-bar-2')).toBe(getByTestId('weekly-today-bar'));
  });

  it('shows subtitle "평균 대비 오늘 -3분" when today is below avg', () => {
    const { getByTestId } = renderWithTheme(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('-3분');
  });

  it('shows "+N분" when today is above avg', () => {
    const days = mockDays.map(d => ({ ...d, isToday: d.dayLabel === '월' }));
    const { getByTestId } = renderWithTheme(
      <WeeklyTrendChart days={days} todayIndex={0} averageMin={30.5} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('+');
  });

  it('shows "평소와 같음" when diff is 0', () => {
    const days = [
      { dayLabel: '월' as const, durationMin: 30, isToday: false },
      { dayLabel: '화' as const, durationMin: 30, isToday: false },
      { dayLabel: '수' as const, durationMin: 30, isToday: true },
      { dayLabel: '목' as const, durationMin: 30, isToday: false },
      { dayLabel: '금' as const, durationMin: 30, isToday: false },
    ];
    const { getByTestId } = renderWithTheme(
      <WeeklyTrendChart days={days} todayIndex={2} averageMin={30} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('평소와 같음');
  });

  it('renders without crashing when todayIndex is -1', () => {
    const days = mockDays.map(d => ({ ...d, isToday: false }));
    const { getByTestId, queryByTestId } = renderWithTheme(
      <WeeklyTrendChart days={days} todayIndex={-1} averageMin={30.8} />
    );
    expect(getByTestId('weekly-bar-0')).toBeTruthy();
    expect(queryByTestId('weekly-today-bar')).toBeNull();
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('이번 주 평일 예측');
  });

  it('renders empty state when days is empty', () => {
    const { getByText } = renderWithTheme(
      <WeeklyTrendChart days={[]} todayIndex={-1} averageMin={0} />
    );
    expect(getByText('이번 주 데이터 부족')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/prediction/__tests__/WeeklyTrendChart.test.tsx --watchman=false`
Expected: FAIL with "Cannot find module '@/components/prediction/WeeklyTrendChart'"

- [ ] **Step 3: Create the component**

```typescript
// src/components/prediction/WeeklyTrendChart.tsx
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';

export type WeekdayLabel = '월' | '화' | '수' | '목' | '금';

export interface DayBarData {
  readonly dayLabel: WeekdayLabel;
  readonly durationMin: number;
  readonly isToday: boolean;
}

export interface WeeklyTrendChartProps {
  readonly days: readonly DayBarData[];
  readonly todayIndex: number;
  readonly averageMin: number;
}

const BAR_HEIGHT = 80;

const WeeklyTrendChartComponent: React.FC<WeeklyTrendChartProps> = ({ days, todayIndex, averageMin }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const subtitle = useMemo(() => {
    if (days.length === 0) return '';
    if (todayIndex === -1) return '이번 주 평일 예측';
    const today = days[todayIndex];
    if (!today) return '';
    const others = days.filter((_, i) => i !== todayIndex);
    const avgExcludingToday = others.length > 0
      ? others.reduce((sum, d) => sum + d.durationMin, 0) / others.length
      : 0;
    const diff = Math.round(today.durationMin - avgExcludingToday);
    if (diff < 0) return `평균 대비 오늘 ${diff}분`;
    if (diff > 0) return `평균 대비 오늘 +${diff}분`;
    return '평소와 같음';
  }, [days, todayIndex]);

  if (days.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이번 주 추이</Text>
        <Text style={styles.emptyText}>이번 주 데이터 부족</Text>
      </View>
    );
  }

  const maxDuration = Math.max(...days.map(d => d.durationMin), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이번 주 추이</Text>
      <Text style={styles.subtitle} testID="weekly-trend-subtitle">{subtitle}</Text>

      <View style={styles.barsRow}>
        {days.map((day, i) => {
          const heightRatio = day.durationMin / maxDuration;
          const isToday = day.isToday && i === todayIndex;
          return (
            <View
              key={day.dayLabel}
              style={styles.barColumn}
              testID={isToday ? 'weekly-today-bar' : undefined}
            >
              <Text style={[styles.minuteLabel, isToday && styles.minuteLabelToday]}>
                {day.durationMin}분
              </Text>
              <View
                testID={`weekly-bar-${i}`}
                style={[
                  styles.bar,
                  { height: BAR_HEIGHT * heightRatio },
                  isToday ? styles.barToday : styles.barRest,
                ]}
              />
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {day.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: weightToFontFamily('700'),
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.tertiary,
    marginTop: 4,
    marginBottom: 16,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: BAR_HEIGHT + 50,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  minuteLabel: {
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.tertiary,
    marginBottom: 6,
  },
  minuteLabelToday: {
    color: colors.primary,
    fontFamily: weightToFontFamily('700'),
  },
  bar: {
    width: '70%',
    borderRadius: 8,
    minHeight: 8,
  },
  barRest: { backgroundColor: colors.bg.secondary },
  barToday: { backgroundColor: colors.primary },
  dayLabel: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.tertiary,
    marginTop: 8,
  },
  dayLabelToday: {
    color: colors.primary,
    fontFamily: weightToFontFamily('700'),
  },
  emptyText: {
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 32,
  },
});

export const WeeklyTrendChart = memo(WeeklyTrendChartComponent);
WeeklyTrendChart.displayName = 'WeeklyTrendChart';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/prediction/__tests__/WeeklyTrendChart.test.tsx --watchman=false`
Expected: PASS — 7 tests

- [ ] **Step 5: Export and commit**

Add to `src/components/prediction/index.ts`:
```typescript
export { WeeklyTrendChart } from './WeeklyTrendChart';
export type { WeeklyTrendChartProps, DayBarData, WeekdayLabel } from './WeeklyTrendChart';
```

```bash
git add src/components/prediction/WeeklyTrendChart.tsx \
        src/components/prediction/__tests__/WeeklyTrendChart.test.tsx \
        src/components/prediction/index.ts
git commit -m "feat(prediction): add WeeklyTrendChart component

Phase 4 of ML prediction Sections 6-9 (spec: 2026-05-12).
5-bar layout with today highlight, subtitle calculation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: WeeklyPredictionScreen Section 9 통합

**Files:**
- Modify: `src/screens/prediction/WeeklyPredictionScreen.tsx`

- [ ] **Step 1: Locate Section 9 placeholder**

Run: `grep -n "Section 9\|이번 주\|weekly trend" src/screens/prediction/WeeklyPredictionScreen.tsx | head -10`

- [ ] **Step 2: Build data from useCommutePattern**

Add helper near top of file (or in `src/utils/weekdayUtils.ts` if more than one consumer):
```typescript
import type { PredictedCommute } from '@/models/pattern';
import type { DayBarData, WeekdayLabel } from '@/components/prediction';

const WEEKDAY_LABELS: ReadonlyArray<WeekdayLabel> = ['월', '화', '수', '목', '금'];
const WEEKDAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const;

function buildWeeklyDays(weekPredictions: readonly PredictedCommute[], now: Date): {
  days: DayBarData[];
  todayIndex: number;
  averageMin: number;
} {
  const todayDayOfWeek = WEEKDAY_KEYS[((now.getDay() + 6) % 7)]; // Mon=0
  const days: DayBarData[] = WEEKDAY_KEYS.map((key, i) => {
    const pred = weekPredictions.find(p => p.dayOfWeek === key);
    return {
      dayLabel: WEEKDAY_LABELS[i],
      durationMin: pred?.estimatedDurationMin ?? 0,
      isToday: key === todayDayOfWeek,
    };
  }).filter(d => d.durationMin > 0);

  const todayIndex = days.findIndex(d => d.isToday);
  const averageMin = days.length > 0
    ? days.reduce((s, d) => s + d.durationMin, 0) / days.length
    : 0;
  return { days, todayIndex, averageMin };
}
```

> If `PredictedCommute.estimatedDurationMin` doesn't exist, check `src/models/pattern.ts` and use the actual duration field (likely `durationMin` or `predictedTime`).

In the component body:
```typescript
const { weekPredictions } = useCommutePattern();
const { days: weeklyDays, todayIndex, averageMin } = useMemo(
  () => buildWeeklyDays(weekPredictions, new Date()),
  [weekPredictions]
);
```

Add import:
```typescript
import { WeeklyTrendChart } from '@/components/prediction';
```

Replace Section 9 placeholder with:
```tsx
<WeeklyTrendChart days={weeklyDays} todayIndex={todayIndex} averageMin={averageMin} />
```

- [ ] **Step 3: Verify type-check + tests**

Run: `npx tsc --noEmit && npm test -- src/screens/prediction --watchman=false`
Expected: 0 new errors, screen tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/prediction/WeeklyPredictionScreen.tsx
git commit -m "feat(prediction): wire WeeklyTrendChart into WeeklyPredictionScreen

Replaces Section 9 placeholder with weekly trend from useCommutePattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

## Phase 3 — Prediction Factors (Section 8)

### Task 5: usePredictionFactors hook (TDD)

**Files:**
- Test: `src/hooks/__tests__/usePredictionFactors.test.ts`
- Create: `src/hooks/usePredictionFactors.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/hooks/__tests__/usePredictionFactors.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePredictionFactors } from '@/hooks/usePredictionFactors';

jest.mock('@/services/weather/weatherService', () => ({
  weatherService: {
    getCurrentForecast: jest.fn(),
  },
}));

jest.mock('@/services/congestion/congestionService', () => ({
  congestionService: {
    getDailyAverage: jest.fn(),
    getTodayAverage: jest.fn(),
  },
}));

jest.mock('@/services/trainDelay/trainDelayService', () => ({
  trainDelayService: {
    getActiveDelays: jest.fn(),
  },
}));

jest.mock('@/hooks/useCommutePattern', () => ({
  useCommutePattern: jest.fn(),
}));

import { weatherService } from '@/services/weather/weatherService';
import { congestionService } from '@/services/congestion/congestionService';
import { trainDelayService } from '@/services/trainDelay/trainDelayService';
import { useCommutePattern } from '@/hooks/useCommutePattern';

describe('usePredictionFactors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps weather=clear to neutral "맑음" factor', async () => {
    (weatherService.getCurrentForecast as jest.Mock).mockResolvedValue({
      condition: 'clear', precipitation: 0,
    });
    (congestionService.getDailyAverage as jest.Mock).mockResolvedValue(60);
    (congestionService.getTodayAverage as jest.Mock).mockResolvedValue(60);
    (trainDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
    (useCommutePattern as jest.Mock).mockReturnValue({
      patterns: [{ dayOfWeek: 'WED', averageMin: 28 }],
    });

    const { result } = renderHook(() => usePredictionFactors({
      lineId: '2', direction: 'up', dayOfWeek: 'WED',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather).toMatchObject({ label: '맑음', impact: 'neutral' });
  });

  it('maps weather=rain to negative factor with +N분', async () => {
    (weatherService.getCurrentForecast as jest.Mock).mockResolvedValue({
      condition: 'rain', precipitation: 5,
    });
    (congestionService.getDailyAverage as jest.Mock).mockResolvedValue(60);
    (congestionService.getTodayAverage as jest.Mock).mockResolvedValue(60);
    (trainDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
    (useCommutePattern as jest.Mock).mockReturnValue({ patterns: [] });

    const { result } = renderHook(() => usePredictionFactors({
      lineId: '2', direction: 'up', dayOfWeek: 'WED',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather?.label).toBe('비 예보');
    expect(weather?.impact).toBe('negative');
    expect(weather?.value).toMatch(/^\+\d+분$/);
  });

  it('reports congestion as negative when +8%p above average', async () => {
    (weatherService.getCurrentForecast as jest.Mock).mockResolvedValue({ condition: 'clear', precipitation: 0 });
    (congestionService.getDailyAverage as jest.Mock).mockResolvedValue(60);
    (congestionService.getTodayAverage as jest.Mock).mockResolvedValue(68);
    (trainDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
    (useCommutePattern as jest.Mock).mockReturnValue({ patterns: [] });

    const { result } = renderHook(() => usePredictionFactors({
      lineId: '2', direction: 'up', dayOfWeek: 'WED',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const congestion = result.current.factors.find(f => f.id === 'congestion');
    expect(congestion?.impact).toBe('negative');
    expect(congestion?.value).toContain('8');
    expect(congestion?.value).toMatch(/↑|증가|상승/);
  });

  it('reports delay as positive "정시 운행" when no active delays', async () => {
    (weatherService.getCurrentForecast as jest.Mock).mockResolvedValue({ condition: 'clear', precipitation: 0 });
    (congestionService.getDailyAverage as jest.Mock).mockResolvedValue(60);
    (congestionService.getTodayAverage as jest.Mock).mockResolvedValue(60);
    (trainDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
    (useCommutePattern as jest.Mock).mockReturnValue({ patterns: [] });

    const { result } = renderHook(() => usePredictionFactors({
      lineId: '2', direction: 'up', dayOfWeek: 'WED',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const delay = result.current.factors.find(f => f.id === 'delay');
    expect(delay).toMatchObject({ label: '지연 없음', value: '정시 운행', impact: 'positive' });
  });

  it('falls back to neutral weather when service throws', async () => {
    (weatherService.getCurrentForecast as jest.Mock).mockRejectedValue(new Error('network'));
    (congestionService.getDailyAverage as jest.Mock).mockResolvedValue(60);
    (congestionService.getTodayAverage as jest.Mock).mockResolvedValue(60);
    (trainDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
    (useCommutePattern as jest.Mock).mockReturnValue({ patterns: [] });

    const { result } = renderHook(() => usePredictionFactors({
      lineId: '2', direction: 'up', dayOfWeek: 'WED',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather?.label).toBe('날씨 정보 없음');
    expect(weather?.impact).toBe('neutral');
    // other factors still present
    expect(result.current.factors).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/__tests__/usePredictionFactors.test.ts --watchman=false`
Expected: FAIL with "Cannot find module '@/hooks/usePredictionFactors'"

If any of the mocked services don't exist at those paths, adjust `jest.mock` paths to match actual files (check with `ls src/services/weather src/services/trainDelay 2>&1`). If `trainDelayService` doesn't exist, replace with the actual delay-query API (e.g., reading `trainDelays/` Firestore collection directly).

- [ ] **Step 3: Create the hook**

```typescript
// src/hooks/usePredictionFactors.ts
import { useState, useEffect } from 'react';
import { CloudRain, Sun, CloudSnow, Cloud, Users, Check, AlertTriangle, Calendar } from 'lucide-react-native';
import { weatherService } from '@/services/weather/weatherService';
import { congestionService } from '@/services/congestion/congestionService';
import { trainDelayService } from '@/services/trainDelay/trainDelayService';
import { useCommutePattern } from '@/hooks/useCommutePattern';
import type { DayOfWeek } from '@/models/pattern';

export type FactorImpact = 'negative' | 'positive' | 'neutral';

export interface PredictionFactor {
  readonly id: 'weather' | 'congestion' | 'delay' | 'pattern';
  readonly icon: React.ComponentType<{ size: number; color: string }>;
  readonly label: string;
  readonly value: string;
  readonly impact: FactorImpact;
}

export interface UsePredictionFactorsParams {
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly dayOfWeek: DayOfWeek;
}

const DAY_LABEL: Record<DayOfWeek, string> = {
  MON: '월요일', TUE: '화요일', WED: '수요일', THU: '목요일',
  FRI: '금요일', SAT: '토요일', SUN: '일요일',
};

export function usePredictionFactors(params: UsePredictionFactorsParams): {
  factors: PredictionFactor[];
  loading: boolean;
} {
  const [factors, setFactors] = useState<PredictionFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const { patterns } = useCommutePattern();

  useEffect(() => {
    let cancelled = false;
    async function loadFactors(): Promise<void> {
      setLoading(true);
      const [weather, dailyAvg, todayAvg, delays] = await Promise.allSettled([
        weatherService.getCurrentForecast(),
        congestionService.getDailyAverage(params.lineId, params.dayOfWeek),
        congestionService.getTodayAverage(params.lineId, params.direction),
        trainDelayService.getActiveDelays(params.lineId),
      ]);

      const next: PredictionFactor[] = [];

      // 1. Weather
      if (weather.status === 'fulfilled' && weather.value) {
        const w = weather.value;
        if (w.condition === 'clear') {
          next.push({ id: 'weather', icon: Sun, label: '맑음', value: '맑음', impact: 'neutral' });
        } else if (w.condition === 'rain') {
          const delayMin = Math.max(1, Math.round(w.precipitation / 2));
          next.push({ id: 'weather', icon: CloudRain, label: '비 예보', value: `+${delayMin}분`, impact: 'negative' });
        } else if (w.condition === 'snow') {
          const delayMin = Math.max(2, Math.round(w.precipitation));
          next.push({ id: 'weather', icon: CloudSnow, label: '눈 예보', value: `+${delayMin}분`, impact: 'negative' });
        } else {
          next.push({ id: 'weather', icon: Cloud, label: '흐림', value: '흐림', impact: 'neutral' });
        }
      } else {
        next.push({ id: 'weather', icon: Cloud, label: '날씨 정보 없음', value: '-', impact: 'neutral' });
      }

      // 2. Congestion
      if (dailyAvg.status === 'fulfilled' && todayAvg.status === 'fulfilled') {
        const diff = (todayAvg.value ?? 0) - (dailyAvg.value ?? 0);
        const rounded = Math.round(diff);
        const impact: FactorImpact = rounded > 5 ? 'negative' : rounded < -5 ? 'positive' : 'neutral';
        const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : '';
        next.push({
          id: 'congestion',
          icon: Users,
          label: '평균 혼잡도',
          value: rounded === 0 ? '평소와 같음' : `평소보다 ${Math.abs(rounded)}% ${arrow}`,
          impact,
        });
      } else {
        next.push({ id: 'congestion', icon: Users, label: '평균 혼잡도', value: '-', impact: 'neutral' });
      }

      // 3. Delay
      if (delays.status === 'fulfilled' && delays.value.length === 0) {
        next.push({ id: 'delay', icon: Check, label: '지연 없음', value: '정시 운행', impact: 'positive' });
      } else if (delays.status === 'fulfilled') {
        const count = delays.value.length;
        next.push({ id: 'delay', icon: AlertTriangle, label: `${count}건 지연`, value: '확인 필요', impact: 'negative' });
      } else {
        next.push({ id: 'delay', icon: Check, label: '지연 정보 없음', value: '-', impact: 'neutral' });
      }

      // 4. Pattern
      const pattern = patterns?.find(p => p.dayOfWeek === params.dayOfWeek);
      const dayKor = DAY_LABEL[params.dayOfWeek] ?? '오늘';
      next.push({
        id: 'pattern',
        icon: Calendar,
        label: `${dayKor} 패턴`,
        value: pattern ? `평소 ${Math.round(pattern.averageMin)}분` : '데이터 부족',
        impact: 'neutral',
      });

      if (!cancelled) {
        setFactors(next);
        setLoading(false);
      }
    }
    void loadFactors();
    return () => { cancelled = true; };
  }, [params.lineId, params.direction, params.dayOfWeek, patterns]);

  return { factors, loading };
}
```

> If `congestionService.getTodayAverage` does not exist, replace with a thin helper in the same file that reads from `useCongestion` consumers. Confirm with: `grep -nE "getTodayAverage|getDailyAverage" src/services/congestion/congestionService.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/hooks/__tests__/usePredictionFactors.test.ts --watchman=false`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePredictionFactors.ts src/hooks/__tests__/usePredictionFactors.test.ts
git commit -m "feat(prediction): add usePredictionFactors hook

Phase 3 of ML prediction Sections 6-9 (spec: 2026-05-12).
Combines weather + congestion + delay + pattern into unified factors[].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: PredictionFactorsSection 컴포넌트 (TDD)

**Files:**
- Test: `src/components/prediction/__tests__/PredictionFactorsSection.test.tsx`
- Create: `src/components/prediction/PredictionFactorsSection.tsx`
- Modify: `src/components/prediction/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/prediction/__tests__/PredictionFactorsSection.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { CloudRain, Users, Check, Calendar } from 'lucide-react-native';
import { PredictionFactorsSection } from '@/components/prediction/PredictionFactorsSection';
import { ThemeProvider } from '@/services/theme';

const mockFactors = [
  { id: 'weather' as const, icon: CloudRain, label: '비 예보', value: '+2분', impact: 'negative' as const },
  { id: 'congestion' as const, icon: Users, label: '평균 혼잡도', value: '평소보다 8% ↑', impact: 'negative' as const },
  { id: 'delay' as const, icon: Check, label: '지연 없음', value: '정시 운행', impact: 'positive' as const },
  { id: 'pattern' as const, icon: Calendar, label: '수요일 패턴', value: '평소 28분', impact: 'neutral' as const },
];

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('PredictionFactorsSection', () => {
  it('renders all 4 factor rows', () => {
    const { getByTestId } = renderWithTheme(<PredictionFactorsSection factors={mockFactors} />);
    expect(getByTestId('factor-row-weather')).toBeTruthy();
    expect(getByTestId('factor-row-congestion')).toBeTruthy();
    expect(getByTestId('factor-row-delay')).toBeTruthy();
    expect(getByTestId('factor-row-pattern')).toBeTruthy();
  });

  it('displays label and value for each factor', () => {
    const { getByTestId } = renderWithTheme(<PredictionFactorsSection factors={mockFactors} />);
    expect(getByTestId('factor-row-weather')).toHaveTextContent('비 예보');
    expect(getByTestId('factor-row-weather')).toHaveTextContent('+2분');
    expect(getByTestId('factor-row-delay')).toHaveTextContent('정시 운행');
  });

  it('renders empty when factors is empty', () => {
    const { queryByTestId } = renderWithTheme(<PredictionFactorsSection factors={[]} />);
    expect(queryByTestId('factor-row-weather')).toBeNull();
    expect(queryByTestId('factor-row-pattern')).toBeNull();
  });

  it('renders without crashing with all-positive factors', () => {
    const positive = mockFactors.map(f => ({ ...f, impact: 'positive' as const }));
    const { getByTestId } = renderWithTheme(<PredictionFactorsSection factors={positive} />);
    expect(getByTestId('factor-row-weather')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/prediction/__tests__/PredictionFactorsSection.test.tsx --watchman=false`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create the component**

```typescript
// src/components/prediction/PredictionFactorsSection.tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';
import type { PredictionFactor, FactorImpact } from '@/hooks/usePredictionFactors';

export interface PredictionFactorsSectionProps {
  readonly factors: readonly PredictionFactor[];
}

const impactColor = (colors: ThemeColors, impact: FactorImpact): string => {
  if (impact === 'negative') return colors.danger.fg;
  if (impact === 'positive') return colors.success.fg;
  return colors.text.tertiary;
};

const PredictionFactorsSectionComponent: React.FC<PredictionFactorsSectionProps> = ({ factors }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>예측에 반영된 요소</Text>
      {factors.map(f => {
        const color = impactColor(colors, f.impact);
        const Icon = f.icon;
        return (
          <View key={f.id} style={styles.row} testID={`factor-row-${f.id}`}>
            <Icon size={20} color={color} />
            <Text style={styles.label}>{f.label}</Text>
            <Text style={[styles.value, { color }]}>{f.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: weightToFontFamily('700'),
    color: colors.text.primary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
    color: colors.text.primary,
  },
  value: {
    fontSize: 14,
    fontFamily: weightToFontFamily('700'),
  },
});

export const PredictionFactorsSection = memo(PredictionFactorsSectionComponent);
PredictionFactorsSection.displayName = 'PredictionFactorsSection';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/prediction/__tests__/PredictionFactorsSection.test.tsx --watchman=false`
Expected: PASS — 4 tests

- [ ] **Step 5: Export and commit**

Add to `src/components/prediction/index.ts`:
```typescript
export { PredictionFactorsSection } from './PredictionFactorsSection';
export type { PredictionFactorsSectionProps } from './PredictionFactorsSection';
```

```bash
git add src/components/prediction/PredictionFactorsSection.tsx \
        src/components/prediction/__tests__/PredictionFactorsSection.test.tsx \
        src/components/prediction/index.ts
git commit -m "feat(prediction): add PredictionFactorsSection component

Phase 3 of ML prediction Sections 6-9 (spec: 2026-05-12).
4-row factor list with impact-driven coloring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: WeeklyPredictionScreen Section 8 통합

**Files:**
- Modify: `src/screens/prediction/WeeklyPredictionScreen.tsx`

- [ ] **Step 1: Wire usePredictionFactors**

Add imports:
```typescript
import { usePredictionFactors } from '@/hooks/usePredictionFactors';
import { PredictionFactorsSection } from '@/components/prediction';
```

In the component body:
```typescript
const todayDow = useMemo((): DayOfWeek => {
  const days: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date().getDay()];
}, []);

const { factors } = usePredictionFactors({
  lineId: route?.wait.lineId ?? '2',
  direction: 'up',
  dayOfWeek: todayDow,
});
```

Replace Section 8 placeholder with:
```tsx
<PredictionFactorsSection factors={factors} />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm test -- src/screens/prediction --watchman=false`

- [ ] **Step 3: Commit**

```bash
git add src/screens/prediction/WeeklyPredictionScreen.tsx
git commit -m "feat(prediction): wire PredictionFactorsSection into WeeklyPredictionScreen

Replaces Section 8 placeholder with usePredictionFactors output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

## Phase 2 — Hourly Congestion Forecast (Section 7)

> Order rationale: Done last because it requires a new service method with Firestore querying. Chart patterns from Phase 4 reduce risk.

### Task 8: congestionService.getHourlyForecast (TDD)

**Files:**
- Test: `src/services/congestion/__tests__/congestionService.getHourlyForecast.test.ts`
- Modify: `src/services/congestion/congestionService.ts`
- Possibly modify: `firestore.indexes.json` (add composite index if Firestore complains)

- [ ] **Step 1: Write failing test**

```typescript
// src/services/congestion/__tests__/congestionService.getHourlyForecast.test.ts
import { congestionService } from '@/services/congestion/congestionService';

jest.mock('@/services/firebase', () => ({
  firestore: { collection: jest.fn() },
}));

describe('congestionService.getHourlyForecast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 7 slots in 15-min increments around currentTime', async () => {
    const spy = jest.spyOn(congestionService as unknown as { fetchSlotAverage(s: Date, l: string, d: string): Promise<number | null> }, 'fetchSlotAverage')
      .mockResolvedValue(60);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);

    expect(slots).toHaveLength(7);
    expect(slots[0].slotTime).toBe('08:00');
    expect(slots[2].slotTime).toBe('08:30');
    expect(slots[6].slotTime).toBe('09:30');
    spy.mockRestore();
  });

  it('maps congestion % to 4 levels', async () => {
    const spy = jest.spyOn(congestionService as unknown as { fetchSlotAverage(s: Date, l: string, d: string): Promise<number | null> }, 'fetchSlotAverage')
      .mockResolvedValueOnce(40)   // 여유
      .mockResolvedValueOnce(60)   // 보통
      .mockResolvedValueOnce(80)   // 혼잡
      .mockResolvedValueOnce(90)   // 매우혼잡
      .mockResolvedValue(60);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);
    expect(slots[0].level).toBe('low');
    expect(slots[1].level).toBe('moderate');
    expect(slots[2].level).toBe('high');
    expect(slots[3].level).toBe('very-high');
    spy.mockRestore();
  });

  it('returns unknown level for slots with no historical data', async () => {
    const spy = jest.spyOn(congestionService as unknown as { fetchSlotAverage(s: Date, l: string, d: string): Promise<number | null> }, 'fetchSlotAverage')
      .mockResolvedValue(null);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);
    slots.forEach(s => {
      expect(s.level).toBe('unknown');
      expect(s.congestionPercent).toBe(0);
    });
    spy.mockRestore();
  });
});
```

> The exact `CongestionLevel` enum values may be `low/moderate/high/very-high` or `여유/보통/혼잡/매우혼잡` — verify by reading `src/models/congestion.ts` and adjust both the test expectations AND the service mapping accordingly. The four-level structure is what matters.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/congestion/__tests__/congestionService.getHourlyForecast.test.ts --watchman=false`
Expected: FAIL — getHourlyForecast not a function

- [ ] **Step 3: Read existing congestionService**

Run: `head -80 src/services/congestion/congestionService.ts` to understand class structure.

- [ ] **Step 4: Add getHourlyForecast method**

Append to the `CongestionService` class:

```typescript
// At top of file, with other imports:
import { addMinutes, format as formatDate, startOfMinute, getDay } from 'date-fns';
// (If date-fns is not installed: run `npm ls date-fns`. If absent, implement helpers inline.)

// Within CongestionService class:

async getHourlyForecast(
  lineId: string,
  direction: 'up' | 'down',
  currentTime: Date,
  options?: { slotMinutes?: number; slotCount?: number; slotsBeforeNow?: number }
): Promise<readonly HourlySlot[]> {
  const slotMinutes = options?.slotMinutes ?? 15;
  const slotCount = options?.slotCount ?? 7;
  const slotsBeforeNow = options?.slotsBeforeNow ?? 2;

  // Snap currentTime down to the nearest 15-min boundary
  const minutes = currentTime.getMinutes();
  const snapped = new Date(currentTime);
  snapped.setMinutes(Math.floor(minutes / slotMinutes) * slotMinutes, 0, 0);

  const startSlot = addMinutes(snapped, -slotsBeforeNow * slotMinutes);

  const slots: HourlySlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    const slotStart = addMinutes(startSlot, i * slotMinutes);
    const average = await this.fetchSlotAverage(slotStart, lineId, direction);
    if (average === null) {
      slots.push({ slotTime: formatDate(slotStart, 'HH:mm'), congestionPercent: 0, level: 'unknown' });
    } else {
      slots.push({
        slotTime: formatDate(slotStart, 'HH:mm'),
        congestionPercent: Math.round(average),
        level: mapPercentToLevel(average),
      });
    }
  }
  return slots;
}

// Add private helper (or static module-level):
private async fetchSlotAverage(slotStart: Date, lineId: string, direction: 'up' | 'down'): Promise<number | null> {
  // Query Firestore congestionData/ for same dayOfWeek and matching slot window
  // Cache key: hourly:${lineId}:${direction}:${slotStart.toISOString()}
  // Returns null if no historical data for this slot.
  // Implementation: see existing query patterns in this file for getDailyAverage.
  const dayOfWeek = getDay(slotStart);
  const slotEnd = addMinutes(slotStart, 15);
  try {
    const snapshot = await this.firestoreCollection()
      .where('lineId', '==', lineId)
      .where('direction', '==', direction)
      .where('dayOfWeek', '==', dayOfWeek)
      .where('reportedHour', '==', slotStart.getHours())
      .where('reportedMinute', '>=', slotStart.getMinutes())
      .where('reportedMinute', '<', slotEnd.getMinutes() === 0 ? 60 : slotEnd.getMinutes())
      .limit(50)
      .get();
    if (snapshot.empty) return null;
    let sum = 0;
    snapshot.forEach(doc => { sum += (doc.data() as { congestionPercent: number }).congestionPercent ?? 0; });
    return sum / snapshot.size;
  } catch {
    return null;
  }
}
```

Add type export at top of file:
```typescript
export interface HourlySlot {
  readonly slotTime: string;        // "08:30"
  readonly congestionPercent: number;
  readonly level: CongestionLevel | 'unknown';
}

function mapPercentToLevel(p: number): CongestionLevel {
  // Adjust strings to match actual CongestionLevel enum (e.g., 'low'/'moderate'/'high'/'very-high')
  if (p < 50) return 'low';
  if (p < 70) return 'moderate';
  if (p < 85) return 'high';
  return 'very-high';
}
```

> Read `src/models/congestion.ts` first to confirm the actual `CongestionLevel` values, and update both `mapPercentToLevel` return strings and the test expectations to match. If the existing collection schema doesn't include `reportedHour`/`reportedMinute`, adapt the query to use the actual timestamp field with range filters.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/services/congestion/__tests__/congestionService.getHourlyForecast.test.ts --watchman=false`
Expected: PASS — 3 tests

If Firestore composite index is needed, add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "congestionData",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "lineId", "order": "ASCENDING" },
    { "fieldPath": "direction", "order": "ASCENDING" },
    { "fieldPath": "dayOfWeek", "order": "ASCENDING" },
    { "fieldPath": "reportedHour", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/services/congestion/congestionService.ts \
        src/services/congestion/__tests__/congestionService.getHourlyForecast.test.ts \
        firestore.indexes.json
git commit -m "feat(congestion): add getHourlyForecast for hourly slot prediction

Phase 2 of ML prediction Sections 6-9 (spec: 2026-05-12).
Returns 7×15min slots around currentTime with 4-level congestion mapping.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 9: HourlyCongestionChart 컴포넌트 (TDD)

**Files:**
- Test: `src/components/prediction/__tests__/HourlyCongestionChart.test.tsx`
- Create: `src/components/prediction/HourlyCongestionChart.tsx`
- Modify: `src/components/prediction/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/prediction/__tests__/HourlyCongestionChart.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HourlyCongestionChart } from '@/components/prediction/HourlyCongestionChart';
import { ThemeProvider } from '@/services/theme';

const mockSlots = [
  { slotTime: '08:00', congestionPercent: 75, level: 'high' as const },
  { slotTime: '08:15', congestionPercent: 88, level: 'very-high' as const },
  { slotTime: '08:30', congestionPercent: 100, level: 'very-high' as const },
  { slotTime: '08:45', congestionPercent: 84, level: 'high' as const },
  { slotTime: '09:00', congestionPercent: 70, level: 'high' as const },
  { slotTime: '09:15', congestionPercent: 55, level: 'moderate' as const },
  { slotTime: '09:30', congestionPercent: 42, level: 'low' as const },
];

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('HourlyCongestionChart', () => {
  it('renders 7 bars', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByTestId } = renderWithTheme(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`hourly-bar-${i}`)).toBeTruthy();
    }
  });

  it('marks the slot matching currentTime as current', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByTestId } = renderWithTheme(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    expect(getByTestId('hourly-current-marker')).toBeTruthy();
  });

  it('shows legend with 4 levels', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByText } = renderWithTheme(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    expect(getByText('여유')).toBeTruthy();
    expect(getByText('보통')).toBeTruthy();
    expect(getByText('혼잡')).toBeTruthy();
    expect(getByText('매우혼잡')).toBeTruthy();
  });

  it('renders empty state when slots is empty', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByText } = renderWithTheme(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={[]} />
    );
    expect(getByText('예측 데이터 없음')).toBeTruthy();
  });

  it('does not show current marker when currentTime is outside slot range', () => {
    const farFuture = new Date('2026-05-12T15:00:00+09:00');
    const { queryByTestId } = renderWithTheme(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={farFuture} slots={mockSlots} />
    );
    expect(queryByTestId('hourly-current-marker')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/prediction/__tests__/HourlyCongestionChart.test.tsx --watchman=false`
Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```typescript
// src/components/prediction/HourlyCongestionChart.tsx
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';
import type { HourlySlot } from '@/services/congestion/congestionService';

export interface HourlyCongestionChartProps {
  readonly lineId: string;
  readonly direction: string;
  readonly currentTime: Date;
  readonly slots: readonly HourlySlot[];
}

const BAR_HEIGHT = 100;
const LEVELS_LEGEND: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'low', label: '여유' },
  { key: 'moderate', label: '보통' },
  { key: 'high', label: '혼잡' },
  { key: 'very-high', label: '매우혼잡' },
];

const levelToColor = (colors: ThemeColors, level: HourlySlot['level']): string => {
  switch (level) {
    case 'low': return colors.success?.subtle ?? '#A0D8AB';
    case 'moderate': return colors.warning?.subtle ?? '#FFD18A';
    case 'high': return colors.danger?.subtle ?? '#F8A0A0';
    case 'very-high': return colors.danger?.strong ?? '#E04E4E';
    default: return colors.bg.tertiary;
  }
};

function findCurrentSlotIndex(slots: readonly HourlySlot[], currentTime: Date): number {
  if (slots.length === 0) return -1;
  const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  let bestIndex = -1;
  let bestDelta = Infinity;
  slots.forEach((s, i) => {
    const [h, m] = s.slotTime.split(':').map(Number);
    const slotMin = h * 60 + m;
    const delta = Math.abs(currentMin - slotMin);
    if (delta <= 15 && delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  });
  return bestIndex;
}

const HourlyCongestionChartComponent: React.FC<HourlyCongestionChartProps> = ({ lineId, direction, currentTime, slots }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentIdx = useMemo(() => findCurrentSlotIndex(slots, currentTime), [slots, currentTime]);

  if (slots.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>시간대별 혼잡도 예측</Text>
        <Text style={styles.subtitle}>{lineId}호선 {direction} 방면</Text>
        <Text style={styles.emptyText}>예측 데이터 없음</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>시간대별 혼잡도 예측</Text>
      <Text style={styles.subtitle}>{lineId}호선 {direction} 방면</Text>

      <View style={styles.legend} testID="hourly-legend">
        {LEVELS_LEGEND.map(l => (
          <View key={l.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: levelToColor(colors, l.key as HourlySlot['level']) }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.barsRow}>
        {slots.map((s, i) => {
          const ratio = (s.congestionPercent || 1) / 100;
          const isCurrent = i === currentIdx;
          return (
            <View key={`${s.slotTime}-${i}`} style={styles.barColumn}>
              {isCurrent && <Text testID="hourly-current-marker" style={styles.currentMarker}>지금</Text>}
              <Text style={[styles.percentLabel, isCurrent && styles.percentLabelCurrent]}>
                {s.congestionPercent}%
              </Text>
              <View
                testID={`hourly-bar-${i}`}
                style={[
                  styles.bar,
                  { height: BAR_HEIGHT * ratio, backgroundColor: levelToColor(colors, s.level) },
                  isCurrent && styles.barCurrent,
                ]}
              />
              <Text style={[styles.timeLabel, isCurrent && styles.timeLabelCurrent]}>{s.slotTime}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.bg.card, borderRadius: 16, padding: 16 },
  title: { fontSize: 16, fontFamily: weightToFontFamily('700'), color: colors.text.primary },
  subtitle: { fontSize: 13, fontFamily: weightToFontFamily('500'), color: colors.text.tertiary, marginTop: 4, marginBottom: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: weightToFontFamily('500'), color: colors.text.secondary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: BAR_HEIGHT + 60 },
  barColumn: { alignItems: 'center', flex: 1 },
  bar: { width: '70%', borderRadius: 6, minHeight: 6 },
  barCurrent: { borderWidth: 2, borderColor: colors.text.primary },
  currentMarker: {
    fontSize: 11,
    fontFamily: weightToFontFamily('700'),
    color: colors.bg.card,
    backgroundColor: colors.text.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  percentLabel: { fontSize: 11, fontFamily: weightToFontFamily('500'), color: colors.text.tertiary, marginBottom: 4 },
  percentLabelCurrent: { color: colors.text.primary, fontFamily: weightToFontFamily('700') },
  timeLabel: { fontSize: 11, fontFamily: weightToFontFamily('500'), color: colors.text.tertiary, marginTop: 6 },
  timeLabelCurrent: { color: colors.text.primary, fontFamily: weightToFontFamily('700') },
  emptyText: { fontSize: 14, fontFamily: weightToFontFamily('500'), color: colors.text.tertiary, textAlign: 'center', paddingVertical: 32 },
});

export const HourlyCongestionChart = memo(HourlyCongestionChartComponent);
HourlyCongestionChart.displayName = 'HourlyCongestionChart';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/prediction/__tests__/HourlyCongestionChart.test.tsx --watchman=false`
Expected: PASS — 5 tests

- [ ] **Step 5: Export and commit**

Add to `src/components/prediction/index.ts`:
```typescript
export { HourlyCongestionChart } from './HourlyCongestionChart';
export type { HourlyCongestionChartProps } from './HourlyCongestionChart';
```

```bash
git add src/components/prediction/HourlyCongestionChart.tsx \
        src/components/prediction/__tests__/HourlyCongestionChart.test.tsx \
        src/components/prediction/index.ts
git commit -m "feat(prediction): add HourlyCongestionChart component

Phase 2 of ML prediction Sections 6-9 (spec: 2026-05-12).
7×15min bar chart with legend and current-slot highlight.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: WeeklyPredictionScreen Section 7 통합 + 최종 검증

**Files:**
- Modify: `src/screens/prediction/WeeklyPredictionScreen.tsx`

- [ ] **Step 1: Wire HourlyCongestionChart**

Add imports:
```typescript
import { useState, useEffect } from 'react';
import { HourlyCongestionChart } from '@/components/prediction';
import { congestionService, type HourlySlot } from '@/services/congestion/congestionService';
```

In the component:
```typescript
const [hourlySlots, setHourlySlots] = useState<readonly HourlySlot[]>([]);
const lineIdForChart = route?.wait.lineId ?? '2';
const directionForChart = route?.wait.direction ?? '잠실';

useEffect(() => {
  let cancelled = false;
  congestionService.getHourlyForecast(lineIdForChart, 'up', new Date())
    .then(slots => { if (!cancelled) setHourlySlots(slots); })
    .catch(() => { if (!cancelled) setHourlySlots([]); });
  return () => { cancelled = true; };
}, [lineIdForChart]);
```

Replace Section 7 placeholder with:
```tsx
<HourlyCongestionChart
  lineId={lineIdForChart}
  direction={directionForChart}
  currentTime={new Date()}
  slots={hourlySlots}
/>
```

- [ ] **Step 2: Verify WeeklyPredictionScreen line count**

Run: `wc -l src/screens/prediction/WeeklyPredictionScreen.tsx`
Expected: under 800 lines (target ~500). If still over, identify extra inline JSX/styles that can be moved into sub-components from this plan.

- [ ] **Step 3: Run full verification**

Run in parallel:
```bash
npx tsc --noEmit
npm run lint
npm test -- --watchman=false --coverage --coveragePathIgnorePatterns='/node_modules/|/__mocks__/'
```

Expected:
- type-check: 0 new errors
- lint: 0 errors (warnings OK)
- tests: all pass; coverage on touched files ≥ 75% stmt / 70% fn / 60% branch

If coverage on any new component is below threshold, add the missing test scenarios listed in the spec.

- [ ] **Step 4: Manual screen verification**

Run: `npm start`, navigate to commute prediction screen. Compare against `screenshot 1.png`:
- All 4 sections (6/7/8/9) render with real data
- Today highlighted in weekly trend
- "지금" marker on correct hourly slot
- Dark mode toggle: all sections still readable

- [ ] **Step 5: Commit and prepare PR**

```bash
git add src/screens/prediction/WeeklyPredictionScreen.tsx
git commit -m "feat(prediction): wire HourlyCongestionChart into WeeklyPredictionScreen

Replaces Section 7 placeholder. Completes ML prediction Sections 6-9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push
```

Then create PR with BEFORE/AFTER screenshots:
```bash
gh pr create --base main --title "feat(prediction): ML prediction Sections 6-9 implementation" \
  --body "Implements WeeklyPredictionScreen Sections 6-9 per design spec 2026-05-12.

## Sections completed
- Section 6: SegmentBreakdownSection
- Section 7: HourlyCongestionChart + congestionService.getHourlyForecast
- Section 8: PredictionFactorsSection + usePredictionFactors
- Section 9: WeeklyTrendChart

## Verification
- [ ] type-check 0 errors
- [ ] lint 0 errors
- [ ] all tests pass, coverage threshold met
- [ ] manual visual check matches screenshot
- [ ] dark mode confirmed

Refs: docs/superpowers/specs/2026-05-12-ml-prediction-sections-design.md
Refs: docs/superpowers/plans/2026-05-12-ml-prediction-sections.md"
```

---

## Self-Review Summary

**Spec coverage:**
- Section 6 (Segment Breakdown) → Tasks 1, 2 ✓
- Section 7 (Hourly Congestion) → Tasks 8, 9, 10 ✓
- Section 8 (Prediction Factors) → Tasks 5, 6, 7 ✓
- Section 9 (Weekly Trend) → Tasks 3, 4 ✓
- `congestionService.getHourlyForecast` → Task 8 ✓
- `usePredictionFactors` → Task 5 ✓
- WeeklyPredictionScreen 879→<800줄 reduction → Task 10 Step 2 verification ✓
- Quality gates per phase → embedded in each Task ✓
- Risk: WeeklyPredictionScreen 회귀 → mitigated by phase-isolated placeholder replacement ✓
- Risk: useCommutePattern.weekPredictions 평일 미달 → adapter function in Task 4 handles ✓
- Risk: LineBadge short-code alias 부재 → Task 1 imports LineBadge and screen-level testing catches missing alias ✓

**Placeholder scan:** No "TBD"/"TODO"/"similar to" placeholders. Field names like `walkOriginMin`, `getTodayAverage` are flagged inline with verification instructions when their existence is uncertain.

**Type consistency:** `PredictedRoute` defined in Task 1, exported from prediction/index, imported in Task 2 — matches. `PredictionFactor` defined in Task 5, imported in Task 6 — matches. `HourlySlot` defined in Task 8, imported in Tasks 9 and 10 — matches. `DayBarData` defined in Task 3, used in Task 4 — matches.

---

## Execution Recommendation

This plan has 10 tasks across 4 phases. Each phase has its own commit boundary. Recommended subagent dispatch pattern: 1 subagent per task with main-agent review between phases (not between every task — phase boundary is the natural review gate).
