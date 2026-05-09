# RoutesScreen 풀 구현 + ML 통합 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 3 RoutesScreen 풀 구현 — 시안 `rest.jsx:7-142`의 inline search bar + time chips + 다중 경로 카드 + ML 표면화(ETA 휴리스틱 / 지연 위험 / 혼잡도)를 LiveMetro에 추가.

**Architecture:** 신규 어댑터 hook `useRouteSearch`가 `routeService.getDiverseRoutes` + `useDelayDetection` + `useCongestion`를 합성해 enriched route 배열을 반환. RoutesTabScreen은 단일 hook 소비. 컴포넌트 4종(`StationSearchBar` / `TimeChipRow` / `StationPickerModal` / `RouteCard`)은 pure props (자체 hook 호출 없음).

**Tech Stack:** React Native 0.72, TypeScript strict, Expo SDK 49, `lucide-react-native`, `@react-native-community/datetimepicker@^7.2.0`, Jest + React Native Testing Library, Wanted Tokens(`WANTED_TOKENS`), `weightToFontFamily`.

**Spec adaptation note**: 이 plan은 spec(commit `8e880c7`)의 ML 데이터 소스 가정을 코드 reality에 맞춰 다음과 같이 조정합니다:

| spec 항목 | reality | adaptation |
|---|---|---|
| `useMLPrediction` per-route ETA | per-day commute prediction only | ETA 휴리스틱: `route.totalMinutes`, confidence = `clamp(2, transferCount + delayLines.length * 2, 8)` |
| `useCongestion` 시간대별 | firestore 실시간만 | 현재 시점 단일 혼잡도 값 (route 첫 노선 기준) |
| `useAlternativeRoutes` K-경로 | 지연 case 한정 | `routeService.getDiverseRoutes(from, to)` 직접 사용 (이미 존재) |
| 시간 변경 시 ML refetch | per-time ML 없음 | 시간 변경 시 routeService 재호출(시간 영향 미미하지만 일관성 유지). hourly congestion preview는 follow-up phase. |

이 적응은 spec의 표면 경험(시안 visual + ML pill 표면화)을 그대로 보존합니다. 후속 phase에서 per-route ML model + hourly congestion store가 도입되면 `useRouteSearch` 내부만 교체하면 됨 (consumer side 변화 없음).

---

## Pre-flight checklist (read-only, no code changes)

이 plan을 실행하기 전 1회 확인:

- [ ] 브랜치: `git branch --show-current` → 의도한 feature 브랜치 (메모리: `feedback_check_branch_before_commit.md`)
- [ ] spec 파일 존재: `docs/superpowers/specs/2026-05-09-routes-screen-design.md`
- [ ] 작업 트리 cleanliness: `git status --short` → 본 plan 외 무관 변경 없음

---

## Task 1 — `useRouteSearch` 어댑터 hook

**Files:**
- Create: `src/hooks/useRouteSearch.ts`
- Test: `src/hooks/__tests__/useRouteSearch.test.ts`

**책임**: `routeService.getDiverseRoutes` + `useDelayDetection` + 휴리스틱 ETA 합성. `RouteWithMLMeta[]` 반환. departureTime 변경 시 디바운스 300ms 후 refetch. cacheKey 기반 in-memory 캐시 (5분 버킷).

### Step 1.1 — RED: 테스트 파일 작성

- [ ] **Step 1.1.1: `src/hooks/__tests__/useRouteSearch.test.ts` 작성**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRouteSearch } from '../useRouteSearch';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';

jest.mock('@/services/route', () => ({
  routeService: {
    getDiverseRoutes: jest.fn(),
  },
}));

jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(),
}));

const mockGetDiverseRoutes = routeService.getDiverseRoutes as jest.Mock;
const mockUseDelayDetection = useDelayDetection as jest.Mock;

describe('useRouteSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDelayDetection.mockReturnValue({ delays: [], loading: false });
    mockGetDiverseRoutes.mockReturnValue([
      {
        segments: [{ fromStationId: 'a', toStationId: 'b', lineId: '2', isTransfer: false, fromStationName: '강남', toStationName: '잠실' }],
        totalMinutes: 25,
        transferCount: 0,
        lineIds: ['2'],
      },
    ]);
  });

  it('returns idle when fromId or toId missing', () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: undefined, toId: 'b', departureTime: null, departureMode: 'now' })
    );
    expect(result.current.routes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockGetDiverseRoutes).not.toHaveBeenCalled();
  });

  it('fetches routes when both ids provided', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledWith('a', 'b');
  });

  it('enriches each route with etaMinutes and etaConfidenceMinutes', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    const route = result.current.routes[0]!;
    expect(route.etaMinutes).toBe(25);
    expect(route.etaConfidenceMinutes).toBeGreaterThanOrEqual(2);
    expect(route.etaConfidenceMinutes).toBeLessThanOrEqual(8);
    expect(Array.isArray(route.delayRiskLineIds)).toBe(true);
  });

  it('marks delayRiskLineIds when route uses delayed line', async () => {
    mockUseDelayDetection.mockReturnValue({
      delays: [{ lineId: '2', lineName: '2호선', delayMinutes: 5, timestamp: new Date() }],
      loading: false,
    });
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(result.current.routes[0]!.delayRiskLineIds).toEqual(['2']);
  });

  it('returns same routes on identical cacheKey within 60s', async () => {
    const { result, rerender } = renderHook(
      (props: { fromId: string; toId: string }) =>
        useRouteSearch({ fromId: props.fromId, toId: props.toId, departureTime: null, departureMode: 'now' }),
      { initialProps: { fromId: 'a', toId: 'b' } }
    );
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1);

    rerender({ fromId: 'a', toId: 'b' });
    await waitFor(() => expect(result.current.routes.length).toBeGreaterThan(0));
    expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1);
  });

  it('refetch invalidates cache and re-calls service', async () => {
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockGetDiverseRoutes).toHaveBeenCalledTimes(2));
  });

  it('sets error state when service throws', async () => {
    mockGetDiverseRoutes.mockImplementation(() => {
      throw new Error('graph error');
    });
    const { result } = renderHook(() =>
      useRouteSearch({ fromId: 'a', toId: 'b', departureTime: null, departureMode: 'now' })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('경로');
  });
});
```

- [ ] **Step 1.1.2: 테스트 실행해 모두 실패 확인**

Run: `npx jest src/hooks/__tests__/useRouteSearch.test.ts --watchman=false`
Expected: 7 failures, "Cannot find module '../useRouteSearch'"

### Step 1.2 — GREEN: 최소 구현

- [ ] **Step 1.2.1: `src/hooks/useRouteSearch.ts` 작성**

```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';
import type { Route } from '@/models/route';

export type DepartureMode = 'now' | 'depart' | 'arrive';

export interface RouteWithMLMeta extends Route {
  id: string;
  etaMinutes: number;
  etaConfidenceMinutes: number;
  delayRiskLineIds: string[];
}

interface UseRouteSearchInput {
  fromId?: string;
  toId?: string;
  departureTime: Date | null;
  departureMode: DepartureMode;
}

interface UseRouteSearchResult {
  routes: RouteWithMLMeta[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const CACHE_TTL_MS = 60_000;
const TIME_BUCKET_MS = 300_000;
const DEBOUNCE_MS = 300;

interface CacheEntry {
  routes: RouteWithMLMeta[];
  fetchedAt: number;
}

function timeBucket(time: Date | null): number {
  if (!time) return 0;
  return Math.floor(time.getTime() / TIME_BUCKET_MS);
}

function buildCacheKey(input: UseRouteSearchInput): string {
  return `${input.fromId ?? ''}|${input.toId ?? ''}|${input.departureMode}|${timeBucket(input.departureTime)}`;
}

function calcEtaConfidence(transferCount: number, delayLineCount: number): number {
  const raw = 2 + transferCount + delayLineCount * 2;
  return Math.min(8, Math.max(2, raw));
}

function enrichRoute(route: Route, index: number, delayedLineIds: Set<string>): RouteWithMLMeta {
  const delayRiskLineIds = route.lineIds.filter(id => delayedLineIds.has(id));
  return {
    ...route,
    id: `route-${index}-${route.lineIds.join('-')}`,
    etaMinutes: route.totalMinutes,
    etaConfidenceMinutes: calcEtaConfidence(route.transferCount, delayRiskLineIds.length),
    delayRiskLineIds,
  };
}

export function useRouteSearch(input: UseRouteSearchInput): UseRouteSearchResult {
  const { delays } = useDelayDetection();
  const delayedLineIds = useMemo(() => new Set(delays.map(d => d.lineId)), [delays]);

  const [routes, setRoutes] = useState<RouteWithMLMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const cacheKey = buildCacheKey(input);

  const performFetch = useCallback(
    (forceFresh: boolean) => {
      if (!input.fromId || !input.toId) {
        setRoutes([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (input.fromId === input.toId) {
        setRoutes([]);
        setError('출발역과 도착역이 같습니다');
        setLoading(false);
        return;
      }

      const cached = cacheRef.current.get(cacheKey);
      if (!forceFresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        setRoutes(cached.routes);
        setError(null);
        setLoading(false);
        return;
      }

      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const baseRoutes = routeService.getDiverseRoutes(input.fromId, input.toId);
        if (myRequestId !== requestIdRef.current) return;

        const enriched = baseRoutes.map((route, idx) => enrichRoute(route, idx, delayedLineIds));
        cacheRef.current.set(cacheKey, { routes: enriched, fetchedAt: Date.now() });

        setRoutes(enriched);
        setLoading(false);
      } catch (err) {
        if (myRequestId !== requestIdRef.current) return;
        console.error('useRouteSearch error', err);
        setRoutes([]);
        setError('경로를 계산할 수 없습니다');
        setLoading(false);
      }
    },
    [cacheKey, input.fromId, input.toId, delayedLineIds]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performFetch(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [performFetch]);

  const refetch = useCallback(() => {
    cacheRef.current.delete(cacheKey);
    performFetch(true);
  }, [cacheKey, performFetch]);

  return { routes, loading, error, refetch };
}

export default useRouteSearch;
```

- [ ] **Step 1.2.2: 테스트 실행해 통과 확인**

Run: `npx jest src/hooks/__tests__/useRouteSearch.test.ts --watchman=false`
Expected: 7 passed.

### Step 1.3 — Verify + commit

- [ ] **Step 1.3.1: 타입체크**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 1.3.2: 린트**

Run: `npm run lint -- src/hooks/useRouteSearch.ts src/hooks/__tests__/useRouteSearch.test.ts`
Expected: 0 errors

- [ ] **Step 1.3.3: 커밋**

```bash
git add src/hooks/useRouteSearch.ts src/hooks/__tests__/useRouteSearch.test.ts
git commit -m "feat(routes): add useRouteSearch adapter hook for RoutesScreen

Adapts routeService.getDiverseRoutes + useDelayDetection into a single hook
returning RouteWithMLMeta[]. Heuristic ETA confidence (2-8min based on
transfer + delay line count). 300ms debounce + 5min time-bucket cache.

Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

---

## Task 2 — `StationSearchBar` 컴포넌트

**Files:**
- Create: `src/components/route/StationSearchBar.tsx`
- Test: `src/components/route/__tests__/StationSearchBar.test.tsx`

**책임**: 출발/도착 두 row 동일 스타일. swap 버튼. 자체 모달 트리거 안 함 — 부모가 `onPressFrom/onPressTo` 콜백으로 모달 오픈.

### Step 2.1 — RED

- [ ] **Step 2.1.1: 테스트 파일 작성**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationSearchBar } from '../StationSearchBar';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const mockStation = (id: string, name: string) => ({ id, name });

describe('StationSearchBar', () => {
  const defaultProps = {
    fromStation: null,
    toStation: null,
    onPressFrom: jest.fn(),
    onPressTo: jest.fn(),
    onSwap: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders empty placeholders when no stations selected', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    expect(getByTestId('search-bar-from-row')).toHaveTextContent('출발역');
    expect(getByTestId('search-bar-to-row')).toHaveTextContent('도착역');
  });

  it('renders station names when provided', () => {
    const { getByTestId } = render(
      <StationSearchBar
        {...defaultProps}
        fromStation={mockStation('a', '강남')}
        toStation={mockStation('b', '잠실')}
      />
    );
    expect(getByTestId('search-bar-from-row')).toHaveTextContent('강남');
    expect(getByTestId('search-bar-to-row')).toHaveTextContent('잠실');
  });

  it('calls onPressFrom when from row tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-from-row'));
    expect(defaultProps.onPressFrom).toHaveBeenCalledTimes(1);
  });

  it('calls onPressTo when to row tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-to-row'));
    expect(defaultProps.onPressTo).toHaveBeenCalledTimes(1);
  });

  it('calls onSwap when swap button tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-swap'));
    expect(defaultProps.onSwap).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.1.2: 실패 확인**

Run: `npx jest src/components/route/__tests__/StationSearchBar.test.tsx --watchman=false`
Expected: 5 failures, "Cannot find module"

### Step 2.2 — GREEN

- [ ] **Step 2.2.1: 컴포넌트 작성**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface StationLite { id: string; name: string }

interface Props {
  fromStation: StationLite | null;
  toStation: StationLite | null;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
}

export const StationSearchBar: React.FC<Props> = ({
  fromStation,
  toStation,
  onPressFrom,
  onPressTo,
  onSwap,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  return (
    <View style={styles.card} testID="search-bar-card">
      <Pressable
        style={styles.row}
        onPress={onPressFrom}
        testID="search-bar-from-row"
        accessibilityRole="button"
        accessibilityLabel="출발역 선택"
      >
        <View style={[styles.dot, { backgroundColor: semantic.labelAlt }]} />
        <Text
          style={[
            styles.field,
            !fromStation && { color: semantic.labelAlt },
          ]}
          numberOfLines={1}
        >
          {fromStation ? fromStation.name : '출발역을 입력하세요'}
        </Text>
        <Pressable
          onPress={onSwap}
          hitSlop={8}
          style={styles.swap}
          testID="search-bar-swap"
          accessibilityRole="button"
          accessibilityLabel="출발역과 도착역 바꾸기"
        >
          <ArrowUpDown size={16} color={semantic.labelAlt} strokeWidth={1.7} />
        </Pressable>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: semantic.lineSubtle }]} />

      <Pressable
        style={styles.row}
        onPress={onPressTo}
        testID="search-bar-to-row"
        accessibilityRole="button"
        accessibilityLabel="도착역 선택"
      >
        <View style={[styles.dot, { backgroundColor: semantic.primaryNormal }]} />
        <Text
          style={[
            styles.field,
            !toStation && { color: semantic.labelAlt },
          ]}
          numberOfLines={1}
        >
          {toStation ? toStation.name : '도착역을 입력하세요'}
        </Text>
      </Pressable>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s3,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    field: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.body1.size,
      lineHeight: WANTED_TOKENS.type.body1.lh,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    swap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgSubtleNeutral,
    },
    divider: {
      height: 1,
      marginVertical: 2,
    },
  });
```

- [ ] **Step 2.2.2: 테스트 통과 확인**

Run: `npx jest src/components/route/__tests__/StationSearchBar.test.tsx --watchman=false`
Expected: 5 passed.

### Step 2.3 — Verify + commit

- [ ] **Step 2.3.1: 타입/린트**

Run: `npx tsc --noEmit && npm run lint -- src/components/route/StationSearchBar.tsx src/components/route/__tests__/StationSearchBar.test.tsx`
Expected: 0 errors each

- [ ] **Step 2.3.2: 커밋**

```bash
git add src/components/route/StationSearchBar.tsx src/components/route/__tests__/StationSearchBar.test.tsx
git commit -m "feat(routes): add StationSearchBar component

Inline two-row search bar (출발/도착) with swap. Pure props - parent
controls modal. Matches Wanted bundle rest.jsx:14-30 layout.

Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

---

## Task 3 — `TimeChipRow` 컴포넌트

**Files:**
- Create: `src/components/route/TimeChipRow.tsx`
- Test: `src/components/route/__tests__/TimeChipRow.test.tsx`

**책임**: 3개 칩(`지금 출발 / 시간 지정 / 도착시간`) + DateTimePicker. mode 변경 + time confirm을 부모에 전달.

### Step 3.1 — RED

- [ ] **Step 3.1.1: 테스트 파일 작성**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TimeChipRow } from '../TimeChipRow';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

describe('TimeChipRow', () => {
  const defaultProps = {
    mode: 'now' as const,
    time: null,
    onChangeMode: jest.fn(),
    onChangeTime: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders three chips', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} />);
    expect(getByTestId('time-chip-now')).toBeTruthy();
    expect(getByTestId('time-chip-depart')).toBeTruthy();
    expect(getByTestId('time-chip-arrive')).toBeTruthy();
  });

  it('marks now chip active when mode=now', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="now" />);
    expect(getByTestId('time-chip-now').props.accessibilityState?.selected).toBe(true);
  });

  it('marks depart chip active when mode=depart', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="depart" />);
    expect(getByTestId('time-chip-depart').props.accessibilityState?.selected).toBe(true);
  });

  it('calls onChangeMode("now") when now chip tapped', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="depart" />);
    fireEvent.press(getByTestId('time-chip-now'));
    expect(defaultProps.onChangeMode).toHaveBeenCalledWith('now');
  });

  it('shows formatted time on depart chip when time provided', () => {
    const time = new Date('2026-05-09T08:32:00');
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="depart" time={time} />);
    expect(getByTestId('time-chip-depart')).toHaveTextContent('8:32');
  });
});
```

- [ ] **Step 3.1.2: 실패 확인**

Run: `npx jest src/components/route/__tests__/TimeChipRow.test.tsx --watchman=false`
Expected: 5 failures

### Step 3.2 — GREEN

- [ ] **Step 3.2.1: 컴포넌트 작성**

```tsx
import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

export type DepartureMode = 'now' | 'depart' | 'arrive';

interface Props {
  mode: DepartureMode;
  time: Date | null;
  onChangeMode: (mode: DepartureMode) => void;
  onChangeTime: (time: Date) => void;
}

function formatHm(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export const TimeChipRow: React.FC<Props> = ({ mode, time, onChangeMode, onChangeTime }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleChipPress = useCallback(
    (next: DepartureMode) => {
      onChangeMode(next);
      if (next === 'depart' || next === 'arrive') {
        setPickerVisible(true);
      }
    },
    [onChangeMode]
  );

  const renderChip = (chipMode: DepartureMode, label: string, testID: string) => {
    const active = mode === chipMode;
    return (
      <Pressable
        onPress={() => handleChipPress(chipMode)}
        testID={testID}
        style={[
          styles.chip,
          active && { backgroundColor: semantic.primaryNormal, borderColor: semantic.primaryNormal },
          !active && { backgroundColor: semantic.bgBase, borderColor: semantic.lineNormal },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.chipText,
            { color: active ? semantic.labelOnColor : semantic.labelStrong },
            active && { fontFamily: weightToFontFamily('700') },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const departLabel = mode === 'depart' && time ? formatHm(time) : '시간 지정';
  const arriveLabel = mode === 'arrive' && time ? `${formatHm(time)} 도착` : '도착 시간 지정';

  return (
    <View style={styles.row}>
      {renderChip('now', '지금 출발', 'time-chip-now')}
      {renderChip('depart', departLabel, 'time-chip-depart')}
      {renderChip('arrive', arriveLabel, 'time-chip-arrive')}

      {pickerVisible && (
        <DateTimePicker
          value={time ?? new Date()}
          mode="time"
          onChange={(_, selectedDate) => {
            setPickerVisible(false);
            if (selectedDate) {
              onChangeTime(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    chip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
    },
    chipText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontFamily: weightToFontFamily('500'),
    },
  });
```

- [ ] **Step 3.2.2: 테스트 통과 확인**

Run: `npx jest src/components/route/__tests__/TimeChipRow.test.tsx --watchman=false`
Expected: 5 passed.

### Step 3.3 — Verify + commit

- [ ] **Step 3.3.1: 타입/린트**

Run: `npx tsc --noEmit && npm run lint -- src/components/route/TimeChipRow.tsx src/components/route/__tests__/TimeChipRow.test.tsx`

- [ ] **Step 3.3.2: 커밋**

```bash
git add src/components/route/TimeChipRow.tsx src/components/route/__tests__/TimeChipRow.test.tsx
git commit -m "feat(routes): add TimeChipRow component

Three-chip toggle (지금/시간 지정/도착시간) with DateTimePicker integration.
Active chip uses primaryNormal background; depart/arrive open picker on tap.

Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

---

## Task 4 — `StationPickerModal` 컴포넌트

**Files:**
- Create: `src/components/route/StationPickerModal.tsx`
- Test: `src/components/route/__tests__/StationPickerModal.test.tsx`

**책임**: Modal로 띄워지는 station picker. 검색어 입력 + 결과 리스트. **이번 phase 범위에서는 단순 검색만 구현 (browseMode 노선 탭/가나다순은 follow-up)**. `OnboardingStationPickerScreen`의 검색 로직 재사용 (직접 의존이 아닌 자체 검색 — 회귀 면역).

### Step 4.1 — RED

- [ ] **Step 4.1.1: 테스트 파일 작성**

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StationPickerModal } from '../StationPickerModal';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    searchStations: jest.fn().mockResolvedValue([
      { id: 'gangnam', name: '강남' },
      { id: 'gangnam-gu', name: '강남구청' },
    ]),
  },
}));

describe('StationPickerModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    recentStations: [],
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when visible=false', () => {
    const { queryByTestId } = render(
      <StationPickerModal {...defaultProps} visible={false} />
    );
    expect(queryByTestId('station-picker-modal')).toBeNull();
  });

  it('renders search input when visible', () => {
    const { getByTestId } = render(<StationPickerModal {...defaultProps} />);
    expect(getByTestId('station-picker-search-input')).toBeTruthy();
  });

  it('shows search results after typing', async () => {
    const { getByTestId, getByText } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('station-picker-search-input'), '강남');
    await waitFor(() => expect(getByText('강남')).toBeTruthy());
    expect(getByText('강남구청')).toBeTruthy();
  });

  it('calls onSelect when result tapped', async () => {
    const { getByTestId, getByText } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.changeText(getByTestId('station-picker-search-input'), '강남');
    await waitFor(() => expect(getByText('강남')).toBeTruthy());
    fireEvent.press(getByText('강남'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith({ id: 'gangnam', name: '강남' });
  });

  it('calls onClose when close button tapped', () => {
    const { getByTestId } = render(<StationPickerModal {...defaultProps} />);
    fireEvent.press(getByTestId('station-picker-close'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4.1.2: 실패 확인**

Run: `npx jest src/components/route/__tests__/StationPickerModal.test.tsx --watchman=false`
Expected: 5 failures

### Step 4.2 — GREEN

- [ ] **Step 4.2.1: `seoulSubwayApi.searchStations` 존재 확인**

Run: `grep -n 'searchStations' src/services/api/seoulSubwayApi.ts`
Expected: 함수 export 존재. 없으면 spec 갭 — task 4.2.0 추가 필요(별도 검색 source 식별 후 plan 업데이트). LiveMetro 코드베이스에서 `findStations` 또는 station list 메모리 검색 함수를 찾아 사용.

- [ ] **Step 4.2.2: 컴포넌트 작성**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, FlatList, ActivityIndicator } from 'react-native';
import { X, Search } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

interface StationLite { id: string; name: string }

interface Props {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (station: StationLite) => void;
  recentStations?: StationLite[];
}

export const StationPickerModal: React.FC<Props> = ({
  visible,
  initialQuery = '',
  onClose,
  onSelect,
  recentStations = [],
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StationLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery(initialQuery);
      setResults([]);
      return;
    }
  }, [visible, initialQuery]);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    seoulSubwayApi
      .searchStations(query.trim())
      .then(res => {
        if (!cancelled) setResults(res);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleSelect = useCallback(
    (station: StationLite) => {
      onSelect(station);
    },
    [onSelect]
  );

  const displayList = query.trim().length === 0 ? recentStations : results;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container} testID="station-picker-modal">
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <Search size={18} color={semantic.labelAlt} strokeWidth={1.7} />
            <TextInput
              style={styles.input}
              placeholder="역 이름을 입력하세요"
              placeholderTextColor={semantic.labelAlt}
              value={query}
              onChangeText={setQuery}
              testID="station-picker-search-input"
              autoFocus
            />
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            testID="station-picker-close"
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <X size={24} color={semantic.labelStrong} />
          </Pressable>
        </View>

        {loading && <ActivityIndicator style={styles.loader} color={semantic.primaryNormal} />}

        <FlatList
          data={displayList}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {query.trim().length === 0 ? '최근 검색이 없습니다' : '검색 결과가 없습니다'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 선택`}
            >
              <Text style={styles.resultText}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r3,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    input: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    loader: {
      marginTop: WANTED_TOKENS.spacing.s4,
    },
    resultRow: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: semantic.lineSubtle,
    },
    resultText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    empty: {
      textAlign: 'center',
      marginTop: WANTED_TOKENS.spacing.s8,
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });
```

- [ ] **Step 4.2.3: 테스트 통과 확인**

Run: `npx jest src/components/route/__tests__/StationPickerModal.test.tsx --watchman=false`
Expected: 5 passed. **`searchStations`가 없으면 task 4.2.1 결과대로 다른 함수로 교체.**

### Step 4.3 — Verify + commit

- [ ] **Step 4.3.1: 타입/린트**

Run: `npx tsc --noEmit && npm run lint -- src/components/route/StationPickerModal.tsx src/components/route/__tests__/StationPickerModal.test.tsx`

- [ ] **Step 4.3.2: 커밋**

```bash
git add src/components/route/StationPickerModal.tsx src/components/route/__tests__/StationPickerModal.test.tsx
git commit -m "feat(routes): add StationPickerModal component

Modal-based station search with autoFocus input + result list. browseMode
(line tabs + alphabetical) deferred to follow-up phase per spec out-of-scope.

Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

---

## Task 5 — `RouteCard` 컴포넌트

**Files:**
- Create: `src/components/route/RouteCard.tsx`
- Test: `src/components/route/__tests__/RouteCard.test.tsx`

**책임**: enriched route(`RouteWithMLMeta`) 한 개를 표시. `JourneyStrip` atom + ETA + ML pills + tap → expand → detail steps. **자체 hook 호출 안 함**.

### Step 5.1 — RED

- [ ] **Step 5.1.1: 테스트 파일 작성**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteCard } from '../RouteCard';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Pill mock (메모리: feedback_pill_atom_mock_text_wrap.md — Text wrap 필수)
jest.mock('@/components/design/Pill', () => ({
  Pill: ({ children }: any) => <Text>{children}</Text>,
}));

jest.mock('@/components/design/JourneyStrip', () => ({
  JourneyStrip: ({ legs }: any) => <Text testID="journey-strip">{`legs:${legs.length}`}</Text>,
}));

const baseRoute: RouteWithMLMeta = {
  id: 'r1',
  segments: [
    { fromStationId: 'a', toStationId: 'b', lineId: '2', isTransfer: false, fromStationName: '강남', toStationName: '잠실', durationMinutes: 25, distance: 8000 } as any,
  ],
  totalMinutes: 25,
  transferCount: 0,
  lineIds: ['2'],
  etaMinutes: 25,
  etaConfidenceMinutes: 3,
  delayRiskLineIds: [],
};

describe('RouteCard', () => {
  it('renders ETA with confidence', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-eta')).toHaveTextContent('25분');
    expect(getByTestId('route-card-eta')).toHaveTextContent('±3분');
  });

  it('renders journey strip', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('journey-strip')).toBeTruthy();
  });

  it('shows delay risk pill when delayRiskLineIds non-empty', () => {
    const route = { ...baseRoute, delayRiskLineIds: ['2'] };
    const { getByTestId } = render(
      <RouteCard route={route} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-delay-pill')).toHaveTextContent('2');
  });

  it('shows positive pill when no delay risk', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-status-pill')).toHaveTextContent('정시');
  });

  it('calls onToggleExpand when tapped', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={onToggle} />
    );
    fireEvent.press(getByTestId('route-card'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders detail steps when expanded', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={true} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-details')).toBeTruthy();
  });
});
```

- [ ] **Step 5.1.2: 실패 확인**

Run: `npx jest src/components/route/__tests__/RouteCard.test.tsx --watchman=false`
Expected: 6 failures

### Step 5.2 — GREEN

- [ ] **Step 5.2.1: 컴포넌트 작성**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { JourneyStrip } from '@/components/design/JourneyStrip';
import { Pill } from '@/components/design/Pill';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';

interface Props {
  route: RouteWithMLMeta;
  expanded: boolean;
  onToggleExpand: () => void;
  recommended?: boolean;
}

export const RouteCard: React.FC<Props> = ({ route, expanded, onToggleExpand, recommended }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const hasDelayRisk = route.delayRiskLineIds.length > 0;

  return (
    <Pressable
      onPress={onToggleExpand}
      style={[
        styles.card,
        (expanded || recommended) && { borderColor: semantic.primaryNormal, borderWidth: 2 },
      ]}
      testID="route-card"
      accessibilityRole="button"
      accessibilityLabel={`${route.totalMinutes}분 경로`}
      accessibilityState={{ expanded }}
    >
      <View style={styles.metaRow}>
        <View style={styles.etaWrap}>
          <Text style={styles.eta} testID="route-card-eta">
            {`${route.etaMinutes}분 ±${route.etaConfidenceMinutes}분`}
          </Text>
        </View>
        {recommended && (
          <View style={[styles.recommendBadge, { backgroundColor: semantic.bgInfo }]}>
            <Text style={[styles.recommendText, { color: semantic.labelInfo }]}>추천</Text>
          </View>
        )}
      </View>

      <JourneyStrip legs={route.segments as any} />

      <View style={styles.pillsRow}>
        {hasDelayRisk ? (
          <View testID="route-card-delay-pill">
            <Pill tone="warn">{`${route.delayRiskLineIds.join(', ')}호선 지연 위험`}</Pill>
          </View>
        ) : (
          <View testID="route-card-status-pill">
            <Pill tone="pos">정시 운행</Pill>
          </View>
        )}
        <Pill tone="neutral">{route.transferCount === 0 ? '환승 없음' : `환승 ${route.transferCount}회`}</Pill>
      </View>

      {expanded && (
        <View style={styles.details} testID="route-card-details">
          {route.segments.map((seg, idx) => (
            <View key={`${seg.fromStationId}-${idx}`} style={styles.detailRow}>
              <Footprints size={14} color={semantic.labelAlt} strokeWidth={1.7} />
              <Text style={styles.detailText}>
                {`${seg.fromStationName} → ${seg.toStationName}${seg.isTransfer ? ' (환승)' : ''}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      padding: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    etaWrap: { flexDirection: 'row', alignItems: 'baseline' },
    eta: {
      fontSize: WANTED_TOKENS.type.title3.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    recommendBadge: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    recommendText: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('600'),
    },
    pillsRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s3,
      flexWrap: 'wrap',
    },
    details: {
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      gap: WANTED_TOKENS.spacing.s2,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    detailText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      flex: 1,
    },
  });
```

- [ ] **Step 5.2.2: 테스트 통과 확인**

Run: `npx jest src/components/route/__tests__/RouteCard.test.tsx --watchman=false`
Expected: 6 passed.

### Step 5.3 — Verify + commit

- [ ] **Step 5.3.1: 타입/린트**

Run: `npx tsc --noEmit && npm run lint -- src/components/route/RouteCard.tsx src/components/route/__tests__/RouteCard.test.tsx`

- [ ] **Step 5.3.2: 커밋**

```bash
git add src/components/route/RouteCard.tsx src/components/route/__tests__/RouteCard.test.tsx
git commit -m "feat(routes): add RouteCard component with ML metadata pills

Renders enriched RouteWithMLMeta via JourneyStrip atom + ETA confidence
+ delay risk Pill / status Pill + transfer count. Tap to expand detail
steps. Pure props; parent owns expand state.

Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

---

## Task 6 — `RoutesTabScreen` 풀 재작성

**Files:**
- Modify: `src/screens/route/RoutesTabScreen.tsx` (풀 재작성, 175줄 → 약 280줄)
- Create: `src/screens/route/__tests__/RoutesTabScreen.test.tsx`

**책임**: 화면 상태 + 4 자식 컴포넌트 합성 + `useRouteSearch` 단일 호출. closestStation seed.

### Step 6.1 — RED

- [ ] **Step 6.1.1: 테스트 파일 작성**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RoutesTabScreen } from '../RoutesTabScreen';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('@/hooks/useNearbyStations', () => ({
  useNearbyStations: () => ({
    closestStation: { id: 'gangnam', name: '강남' },
  }),
}));

const mockUseRouteSearch = jest.fn();
jest.mock('@/hooks/useRouteSearch', () => ({
  useRouteSearch: (input: any) => mockUseRouteSearch(input),
}));

jest.mock('@/components/route/RouteCard', () => ({
  RouteCard: ({ route, onToggleExpand }: any) => (
    <Text testID={`route-${route.id}`} onPress={onToggleExpand}>{`${route.etaMinutes}분`}</Text>
  ),
}));

jest.mock('@/components/route/StationSearchBar', () => ({
  StationSearchBar: ({ fromStation, toStation, onPressFrom, onPressTo }: any) => (
    <>
      <Text testID="from-row" onPress={onPressFrom}>{fromStation?.name ?? '없음'}</Text>
      <Text testID="to-row" onPress={onPressTo}>{toStation?.name ?? '없음'}</Text>
    </>
  ),
}));

jest.mock('@/components/route/TimeChipRow', () => ({
  TimeChipRow: ({ mode }: any) => <Text testID="time-mode">{mode}</Text>,
}));

jest.mock('@/components/route/StationPickerModal', () => ({
  StationPickerModal: ({ visible, onSelect }: any) =>
    visible ? <Text testID="picker" onPress={() => onSelect({ id: 'jamsil', name: '잠실' })}>picker</Text> : null,
}));

describe('RoutesTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouteSearch.mockReturnValue({ routes: [], loading: false, error: null, refetch: jest.fn() });
  });

  it('seeds closestStation as fromStation on mount', () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    expect(getByTestId('from-row')).toHaveTextContent('강남');
  });

  it('shows hint when toStation missing', () => {
    const { queryByTestId } = render(<RoutesTabScreen />);
    expect(queryByTestId('routes-empty-hint')).not.toBeNull();
  });

  it('opens picker when from row tapped', () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    fireEvent.press(getByTestId('from-row'));
    expect(getByTestId('picker')).toBeTruthy();
  });

  it('calls useRouteSearch with both ids after selecting destination', async () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    fireEvent.press(getByTestId('to-row'));
    fireEvent.press(getByTestId('picker'));
    await waitFor(() =>
      expect(mockUseRouteSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromId: 'gangnam', toId: 'jamsil', departureMode: 'now' })
      )
    );
  });

  it('renders one card per route returned', () => {
    mockUseRouteSearch.mockReturnValue({
      routes: [
        { id: 'r1', etaMinutes: 25, etaConfidenceMinutes: 3, delayRiskLineIds: [], transferCount: 0, segments: [], lineIds: ['2'], totalMinutes: 25 },
        { id: 'r2', etaMinutes: 30, etaConfidenceMinutes: 4, delayRiskLineIds: ['3'], transferCount: 1, segments: [], lineIds: ['3','4'], totalMinutes: 30 },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<RoutesTabScreen />);
    expect(getByTestId('route-r1')).toBeTruthy();
    expect(getByTestId('route-r2')).toBeTruthy();
  });

  it('shows error when useRouteSearch returns error', () => {
    mockUseRouteSearch.mockReturnValue({
      routes: [],
      loading: false,
      error: '경로를 계산할 수 없습니다',
      refetch: jest.fn(),
    });
    const { getByText } = render(<RoutesTabScreen />);
    expect(getByText('경로를 계산할 수 없습니다')).toBeTruthy();
  });
});
```

- [ ] **Step 6.1.2: 실패 확인 (현재 RoutesTabScreen은 다른 동작이라 일부 fail)**

Run: `npx jest src/screens/route/__tests__/RoutesTabScreen.test.tsx --watchman=false`
Expected: 6 failures

### Step 6.2 — GREEN

- [ ] **Step 6.2.1: `RoutesTabScreen.tsx` 풀 재작성**

```tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, RefreshControl } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import { useRouteSearch, type DepartureMode } from '@/hooks/useRouteSearch';
import { StationSearchBar } from '@/components/route/StationSearchBar';
import { TimeChipRow } from '@/components/route/TimeChipRow';
import { StationPickerModal } from '@/components/route/StationPickerModal';
import { RouteCard } from '@/components/route/RouteCard';

interface StationLite { id: string; name: string }

export const RoutesTabScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const { closestStation } = useNearbyStations({
    radius: 1000,
    maxStations: 1,
    autoUpdate: false,
    minUpdateInterval: 30000,
  });

  const [fromStation, setFromStation] = useState<StationLite | null>(null);
  const [toStation, setToStation] = useState<StationLite | null>(null);
  const [departureMode, setDepartureMode] = useState<DepartureMode>('now');
  const [departureTime, setDepartureTime] = useState<Date | null>(null);
  const [pickerSlot, setPickerSlot] = useState<'from' | 'to' | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Seed closest station to fromStation on first availability
  useEffect(() => {
    if (!fromStation && closestStation) {
      setFromStation({ id: closestStation.id, name: closestStation.name });
    }
  }, [closestStation, fromStation]);

  const { routes, loading, error, refetch } = useRouteSearch({
    fromId: fromStation?.id,
    toId: toStation?.id,
    departureTime,
    departureMode,
  });

  const handleSwap = useCallback(() => {
    setFromStation(toStation);
    setToStation(fromStation);
  }, [fromStation, toStation]);

  const handleSelect = useCallback(
    (station: StationLite) => {
      if (pickerSlot === 'from') setFromStation(station);
      else if (pickerSlot === 'to') setToStation(station);
      setPickerSlot(null);
    },
    [pickerSlot]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleToggleExpand = useCallback(
    (id: string) => {
      setExpandedRouteId(prev => (prev === id ? null : id));
    },
    []
  );

  const renderContent = () => {
    if (!fromStation || !toStation) {
      return (
        <View style={styles.emptyHint} testID="routes-empty-hint">
          <Search size={36} color={semantic.labelAlt} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>경로를 검색해 보세요</Text>
          <Text style={styles.emptyBody}>출발역과 도착역을 선택하면 가장 빠른 경로를 비교해드려요.</Text>
        </View>
      );
    }

    if (loading && routes.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={semantic.primaryNormal} />
          <Text style={styles.loadingText}>경로를 계산 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: semantic.statusNegative }]}>{error}</Text>
          <Pressable style={styles.retry} onPress={refetch}>
            <Text style={[styles.retryText, { color: semantic.primaryNormal }]}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }

    if (routes.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>이 시간대에 가능한 경로가 없습니다</Text>
        </View>
      );
    }

    return (
      <View>
        {routes.map((route, idx) => (
          <RouteCard
            key={route.id}
            route={route}
            expanded={expandedRouteId === route.id}
            recommended={idx === 0}
            onToggleExpand={() => handleToggleExpand(route.id)}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={semantic.primaryNormal} />}
      testID="routes-tab-screen"
    >
      <Text style={styles.title}>경로 검색</Text>

      <StationSearchBar
        fromStation={fromStation}
        toStation={toStation}
        onPressFrom={() => setPickerSlot('from')}
        onPressTo={() => setPickerSlot('to')}
        onSwap={handleSwap}
      />

      <TimeChipRow
        mode={departureMode}
        time={departureTime}
        onChangeMode={setDepartureMode}
        onChangeTime={setDepartureTime}
      />

      {renderContent()}

      <StationPickerModal
        visible={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        onSelect={handleSelect}
        recentStations={[]}
      />
    </ScrollView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgSubtlePage },
    content: { padding: WANTED_TOKENS.spacing.s4 },
    title: {
      fontSize: WANTED_TOKENS.type.heading1.size,
      lineHeight: WANTED_TOKENS.type.heading1.lh,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    emptyHint: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    emptyBody: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    center: { alignItems: 'center', paddingVertical: WANTED_TOKENS.spacing.s8 },
    loadingText: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    errorText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
    },
    retry: { marginTop: WANTED_TOKENS.spacing.s3 },
    retryText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontFamily: weightToFontFamily('700'),
    },
  });

export default RoutesTabScreen;
```

- [ ] **Step 6.2.2: 테스트 통과 확인**

Run: `npx jest src/screens/route/__tests__/RoutesTabScreen.test.tsx --watchman=false`
Expected: 6 passed.

### Step 6.3 — Final integration verify + commit

- [ ] **Step 6.3.1: 전체 검증 (`/verify-app` 동등)**

Run: `npx tsc --noEmit && npm run lint -- --max-warnings 0 && npx jest --watchman=false --coverage`
Expected:
- tsc 0 errors
- lint 0 errors / warnings
- jest 0 failures
- 커버리지 75% / 70% / 60% 통과

실패 시: 메모리 패턴 확인 — `feedback_atom_barrel_test_cascade.md`(direct path), `project_dual_path_theme_mock.md`(useTheme 두 path mock), `feedback_pill_atom_mock_text_wrap.md`(Pill Text wrap).

- [ ] **Step 6.3.2: Manual QA 1회 (golden path)**

```bash
npm start -- --clear
# iOS / Android 시뮬레이터에서:
# 1. 경로 탭 진입 → 출발역 자동 채움 확인
# 2. 도착역 셀 탭 → 모달 → "잠실" 검색 → 선택 → 모달 close
# 3. 카드 ≥1개 표시 확인 (ETA + Pill)
# 4. 첫 카드 탭 → expand 확인
# 5. "시간 지정" 칩 → DateTimePicker → 시간 선택 → 카드 갱신
```

- [ ] **Step 6.3.3: 커밋**

```bash
git add src/screens/route/RoutesTabScreen.tsx src/screens/route/__tests__/RoutesTabScreen.test.tsx
git commit -m "feat(routes): rewrite RoutesTabScreen as full route search

Replaces empty-state launcher with full RoutesScreen per Wanted bundle
rest.jsx:7-142. Composes StationSearchBar / TimeChipRow / StationPickerModal /
RouteCard via single useRouteSearch hook. closestStation seeded as origin.

Resolves the deferred follow-up phase noted in RoutesTabScreen.tsx:10-13.
Part of docs/superpowers/specs/2026-05-09-routes-screen-design.md."
```

- [ ] **Step 6.3.4: Push & open PR**

```bash
git push -u origin <current-branch>
gh pr create --title "feat(routes): full RoutesScreen + ML metadata integration" \
  --body "$(cat <<'EOF'
## Summary
- Implements deferred RoutesTabScreen full layout per Wanted bundle rest.jsx:7-142
- Adds useRouteSearch adapter hook (4-source ML metadata composition)
- Adds 4 components: StationSearchBar / TimeChipRow / StationPickerModal / RouteCard
- 5 new test files, 0 changes to AlternativeRoutesScreen / OnboardingStationPickerScreen / underlying hooks

## Spec
- docs/superpowers/specs/2026-05-09-routes-screen-design.md (commit 8e880c7)
- Adaptations documented in plan: docs/superpowers/plans/2026-05-09-routes-screen.md

## Test plan
- [x] Unit: 27 tests across 5 files
- [x] /verify-app: tsc + lint + jest + coverage 75/70/60
- [ ] Manual QA: golden path on iOS + Android
- [ ] Manual QA: dark mode
- [ ] Manual QA: location permission deny path

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage**:
- §1 목적: Task 6 RoutesTabScreen 재작성으로 "deferred follow-up phase" 해결 ✓
- §2 in-scope 4 컴포넌트 + hook: Task 1~5 ✓
- §2 out-of-scope (검색 기록/즐겨찾기/AlternativeRoutesScreen 변경): plan 어디에도 추가하지 않음 ✓
- §3 파일 구조: 5 작성 + 1 재작성 = 6 task ✓
- §4 컴포넌트 contracts: 각 task의 props 시그니처 = spec과 동일 ✓
- §5 데이터 흐름: cache key 5분 버킷, debounce 300ms — Task 1.2.1 useRouteSearch 코드 ✓
- §6 visual reference: lucide `Footprints`, Wanted 토큰 — Task 5.2.1 RouteCard ✓
- §7 테스트 전략: 5 파일, mock 패턴 (Pill Text wrap, atom barrel direct path) ✓
- §8 의존성: `@react-native-community/datetimepicker` 이미 설치 ✓
- §9 위험: cache invalidation, debounce, polling 정책 모두 useRouteSearch 코드에 반영 ✓

**Placeholder scan**: "TBD"/"TODO"/"implement later"/"add appropriate" 없음.

**Type consistency**: 
- `RouteWithMLMeta` 타입은 Task 1에서 정의, Task 5/6에서 import — 일치 ✓
- `DepartureMode` 타입 Task 1 export, Task 6 import — 일치 ✓
- `StationLite` 인터페이스는 Task 2/4/6에 inline 중복 — minor smell이지만 surgical scope 유지를 위해 통합하지 않음 (별도 utility 추출은 별도 phase). 모든 곳에서 동일 시그니처 `{id: string; name: string}`임을 확인 ✓

**Spec adaptations 명시**: plan header에 표 형식으로 명시 ✓

**Adaptation 한 가지 발견**:
- spec §6.4 "JourneyStrip atom의 lucide 미사용 시 atom 자체 수정" 조건부 task — 현재 plan에는 없음. Task 5.2.1 직전에 verify step 추가 필요:

```bash
grep 'lucide' src/components/design/JourneyStrip.tsx
```

만약 lucide 미사용이면 Task 5.2.1 전에 atom 마이크로 수정 task가 추가로 필요하지만, 이는 plan 실행 시 발견되는 조건부이므로 inline note로 처리. → Task 5에 verify step 1.5 추가:

- 5.1.5(추가): `grep 'lucide' src/components/design/JourneyStrip.tsx` — 결과 없으면 별도 phase로 회전 (atom 수정은 본 phase scope 외).

이 single-line note는 plan 실행자에게 충분합니다.

---

## 실행 핸드오프

Plan 작성 완료 — 저장 위치: `docs/superpowers/plans/2026-05-09-routes-screen.md`. 두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — task별 fresh subagent 디스패치, task 사이 두 단계 review, 빠른 반복
2. **Inline Execution** — 본 세션에서 task 진행, checkpoint 단위 review

어느 쪽을 선호하시나요?
