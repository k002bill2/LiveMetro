# 현재 위치 노선도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** SVG 노선도에 사용자의 가장 가까운 역을 "현재 위치"로 강조하는 화면을 추가하고 홈에서 진입한다.

**Architecture:** 死 `SubwayMapView`(SVG, `selectedStation` 하이라이트 지원)를 부활. 정적 어댑터가 `subwayMapData`→SubwayMapView props로 변환, `useCurrentStationId`가 `useNearbyStations.closestStation`→내부 슬러그로 매핑, 화면이 둘을 합쳐 렌더. 클라이언트 전용, 네이티브 의존 0.

**Tech Stack:** React Native 0.72 / Expo Location / react-native-svg(기존) / TS strict / Jest + RNTL.

## Global Constraints
- Path alias 필수(신규): `@/`, `@components/`, `@hooks/`, `@services/`, `@utils/`. (HomeScreen은 기존 상대경로 컨벤션 유지.)
- 서비스/순수함수/훅 에러 시 `null`/`[]`/안전 status, throw 금지(`error-handling.md`).
- 컴포넌트: `StyleSheet.create`, `memo`+`displayName`, 터치 ≥44pt, `accessibilityLabel`, 토큰 색상, `weightToFontFamily`.
- useEffect cleanup 필수.
- 테스트: `npx jest --runInBand --watchman=false <path>`.
- 커밋: Conventional Commits, surgical, co-author 푸터.
- 위치 강제 획득: `useNearbyStations.refresh()`(글로벌 auto-search preference 비게이트)를 마운트 시 호출.
- 가짜 위치 금지: 위치 없음 → status 'unavailable', 강조 없음(헤더 정직).

---

### Task 1: `subwayMapViewData` 정적 어댑터

**Files:**
- Create: `src/components/map/subwayMapViewData.ts`
- Test: `src/components/map/__tests__/subwayMapViewData.test.ts`

**Interfaces:**
- Consumes: `@/utils/subwayMapData` → `STATIONS: Record<string,{id,name,x,y,lines:string[]}>`, `LINE_COLORS: Record<string,string>`, `LINE_STATIONS: Record<string, readonly string[][]>`.
- Produces: `SUBWAY_MAP_STATIONS: readonly { id:string; name:string; x:number; y:number; lineIds:string[]; isTransfer:boolean }[]`; `SUBWAY_MAP_LINES: readonly { lineId:string; fromStation:string; toStation:string; color:string }[]`.

- [ ] **Step 1: 실패 테스트**
```ts
import { SUBWAY_MAP_STATIONS, SUBWAY_MAP_LINES } from '../subwayMapViewData';

describe('subwayMapViewData', () => {
  it('maps STATIONS into SubwayMapView station shape with coords', () => {
    const s = SUBWAY_MAP_STATIONS.find((st) => st.id === 'seoul');
    expect(s).toBeDefined();
    expect(typeof s!.x).toBe('number');
    expect(typeof s!.y).toBe('number');
    expect(Array.isArray(s!.lineIds)).toBe(true);
  });
  it('flags multi-line stations as transfers', () => {
    const transfer = SUBWAY_MAP_STATIONS.find((st) => st.lineIds.length > 1);
    expect(transfer?.isTransfer).toBe(true);
    const single = SUBWAY_MAP_STATIONS.find((st) => st.lineIds.length === 1);
    expect(single?.isTransfer).toBe(false);
  });
  it('builds line segments from consecutive stations with the line color', () => {
    expect(SUBWAY_MAP_LINES.length).toBeGreaterThan(0);
    const seg = SUBWAY_MAP_LINES[0]!;
    expect(seg.fromStation).not.toBe(seg.toStation);
    expect(typeof seg.color).toBe('string');
    expect(seg.color.length).toBeGreaterThan(0);
  });
});
```
- [ ] **Step 2: 실패 확인** — `npx jest --runInBand --watchman=false src/components/map/__tests__/subwayMapViewData.test.ts` → FAIL (module not found).
- [ ] **Step 3: 구현**
```ts
import { STATIONS, LINE_COLORS, LINE_STATIONS } from '@/utils/subwayMapData';

export interface SubwayMapStation {
  id: string; name: string; x: number; y: number;
  lineIds: string[]; isTransfer: boolean;
}
export interface SubwayMapLineSegment {
  lineId: string; fromStation: string; toStation: string; color: string;
}

export const SUBWAY_MAP_STATIONS: readonly SubwayMapStation[] = Object.values(STATIONS).map(
  (s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    y: s.y,
    lineIds: s.lines,
    isTransfer: s.lines.length > 1,
  }),
);

export const SUBWAY_MAP_LINES: readonly SubwayMapLineSegment[] = (() => {
  const segments: SubwayMapLineSegment[] = [];
  for (const [lineId, branches] of Object.entries(LINE_STATIONS)) {
    const color = LINE_COLORS[lineId] ?? '#888888';
    for (const branch of branches) {
      for (let i = 0; i < branch.length - 1; i++) {
        const from = branch[i];
        const to = branch[i + 1];
        if (from && to) segments.push({ lineId, fromStation: from, toStation: to, color });
      }
    }
  }
  return segments;
})();
```
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 커밋** — `feat(map): subwayMapViewData — STATIONS/LINE_STATIONS→SubwayMapView props 어댑터`

---

### Task 2: `useCurrentStationId` 훅

**Files:**
- Create: `src/hooks/useCurrentStationId.ts`
- Test: `src/hooks/__tests__/useCurrentStationId.test.ts`

**Interfaces:**
- Consumes: `@hooks/useNearbyStations` → `{ closestStation: { id:string; name:string } | null; loading:boolean; error:unknown; hasLocation:boolean; refresh: () => void }`; `@utils/stationIdResolver` → `resolveInternalStationId(id?:string|null):string|null`.
- Produces: `useCurrentStationId(): { currentStationId: string | null; currentStationName: string | null; distanceM: number | null; status: 'locating' | 'located' | 'unavailable' }`.

- [ ] **Step 1: 실패 테스트**
```ts
import { renderHook } from '@testing-library/react-native';
import { useNearbyStations } from '@hooks/useNearbyStations';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { useCurrentStationId } from '../useCurrentStationId';

jest.mock('@hooks/useNearbyStations', () => ({ useNearbyStations: jest.fn() }));
jest.mock('@utils/stationIdResolver', () => ({
  resolveInternalStationId: jest.fn((id?: string | null) => id ?? null),
}));
const mockNearby = useNearbyStations as jest.Mock;
const mockResolve = resolveInternalStationId as jest.Mock;
const base = { loading: false, error: null, hasLocation: true, refresh: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockResolve.mockImplementation((id?: string | null) => id ?? null);
});

it('returns located + resolved slug when a closest station exists', () => {
  mockNearby.mockReturnValue({ ...base, closestStation: { id: 'gangnam', name: '강남', distance: 120 } });
  const { result } = renderHook(() => useCurrentStationId());
  expect(result.current.status).toBe('located');
  expect(result.current.currentStationId).toBe('gangnam');
  expect(result.current.currentStationName).toBe('강남');
  expect(result.current.distanceM).toBe(120);
});

it('is locating while nearby search is loading', () => {
  mockNearby.mockReturnValue({ ...base, loading: true, hasLocation: false, closestStation: null });
  const { result } = renderHook(() => useCurrentStationId());
  expect(result.current.status).toBe('locating');
});

it('is unavailable when there is no location and no closest station', () => {
  mockNearby.mockReturnValue({ ...base, hasLocation: false, closestStation: null });
  const { result } = renderHook(() => useCurrentStationId());
  expect(result.current.status).toBe('unavailable');
  expect(result.current.currentStationId).toBeNull();
});

it('returns null station id when the id cannot be resolved to a slug', () => {
  mockResolve.mockReturnValue(null);
  mockNearby.mockReturnValue({ ...base, closestStation: { id: '0222', name: '강남', distance: 50 } });
  const { result } = renderHook(() => useCurrentStationId());
  expect(result.current.currentStationId).toBeNull();
  expect(result.current.currentStationName).toBe('강남');
});

it('triggers a location refresh on mount (ungated)', () => {
  const refresh = jest.fn();
  mockNearby.mockReturnValue({ ...base, refresh, closestStation: null, hasLocation: false, loading: true });
  renderHook(() => useCurrentStationId());
  expect(refresh).toHaveBeenCalledTimes(1);
});
```
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현**
```ts
import { useEffect, useRef } from 'react';
import { useNearbyStations } from '@hooks/useNearbyStations';
import { resolveInternalStationId } from '@utils/stationIdResolver';

export interface CurrentStationIdResult {
  currentStationId: string | null;
  currentStationName: string | null;
  distanceM: number | null;
  status: 'locating' | 'located' | 'unavailable';
}

export function useCurrentStationId(): CurrentStationIdResult {
  const { closestStation, loading, hasLocation, refresh } = useNearbyStations();

  // Dedicated screen: force a location fetch on mount regardless of the global
  // auto-search preference (refresh is ungated).
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!refreshedRef.current) {
      refreshedRef.current = true;
      refresh();
    }
  }, [refresh]);

  if (closestStation) {
    return {
      currentStationId: resolveInternalStationId(closestStation.id),
      currentStationName: closestStation.name,
      distanceM: closestStation.distance ?? null,
      status: 'located',
    };
  }
  if (loading || (!hasLocation && loading)) {
    return { currentStationId: null, currentStationName: null, distanceM: null, status: 'locating' };
  }
  return {
    currentStationId: null,
    currentStationName: null,
    distanceM: null,
    status: loading ? 'locating' : 'unavailable',
  };
}

export default useCurrentStationId;
```
  (NOTE: `closestStation` 타입에 `distance`가 있으므로 구현에서 사용. 구현 중 `useNearbyStations` 반환에 `closestStation.distance` 확인.)
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 커밋** — `feat(map): useCurrentStationId — closestStation→슬러그 매핑 + status`

---

### Task 3: `CurrentLocationMapScreen` 화면

**Files:**
- Create: `src/screens/map/CurrentLocationMapScreen.tsx`
- Test: `src/screens/map/__tests__/CurrentLocationMapScreen.test.tsx`

**Interfaces:**
- Consumes: `SUBWAY_MAP_STATIONS`/`SUBWAY_MAP_LINES`(T1), `useCurrentStationId`(T2), `SubwayMapView`(`@components/map`), `useSemanticTokens`.
- Produces: `CurrentLocationMapScreen: React.FC` (default export ok).

- [ ] **Step 1: 실패 테스트** — `SubwayMapView`/`useCurrentStationId` mock으로 prop 검증.
```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useCurrentStationId } from '@hooks/useCurrentStationId';
import CurrentLocationMapScreen from '../CurrentLocationMapScreen';

jest.mock('@hooks/useCurrentStationId', () => ({ useCurrentStationId: jest.fn() }));
jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
}));
jest.mock('@components/map', () => {
  const React2 = require('react');
  const { View } = require('react-native');
  return { SubwayMapView: (props: { selectedStation?: string }) =>
    React2.createElement(View, { testID: 'subway-map-view', accessibilityLabel: props.selectedStation ?? 'none' }) };
});
const mockUseCurrent = useCurrentStationId as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('shows the current station header and passes selectedStation when located', () => {
  mockUseCurrent.mockReturnValue({ currentStationId: 'gangnam', currentStationName: '강남', distanceM: 120, status: 'located' });
  const { getByTestId, getByText } = render(<CurrentLocationMapScreen />);
  expect(getByTestId('subway-map-view').props.accessibilityLabel).toBe('gangnam');
  expect(getByText(/강남/)).toBeTruthy();
});

it('still renders the map (no highlight) with an honest message when unavailable', () => {
  mockUseCurrent.mockReturnValue({ currentStationId: null, currentStationName: null, distanceM: null, status: 'unavailable' });
  const { getByTestId, getByText } = render(<CurrentLocationMapScreen />);
  expect(getByTestId('subway-map-view').props.accessibilityLabel).toBe('none');
  expect(getByText('위치를 확인할 수 없어요')).toBeTruthy();
});

it('shows a locating state while resolving position', () => {
  mockUseCurrent.mockReturnValue({ currentStationId: null, currentStationName: null, distanceM: null, status: 'locating' });
  const { getByText } = render(<CurrentLocationMapScreen />);
  expect(getByText('위치 확인 중…')).toBeTruthy();
});
```
- [ ] **Step 2: 실패 확인** — jest → FAIL.
- [ ] **Step 3: 구현** — 헤더(status별 카피) + `<SubwayMapView stations={SUBWAY_MAP_STATIONS} lines={SUBWAY_MAP_LINES} selectedStation={currentStationId ?? undefined} showLabels />`. `formatDistance`는 `@utils/...`(있으면) 또는 `${distanceM}m`. `memo`+`displayName`, `StyleSheet.create`, 컨테이너 `accessibilityLabel`. 헤더 카피: located=`현재 위치: ${name} 근처 (${dist})`, locating=`위치 확인 중…`, unavailable=`위치를 확인할 수 없어요`.
- [ ] **Step 4: 통과 확인** — jest → PASS.
- [ ] **Step 5: 타입+린트** — `npx tsc --noEmit`; `npx eslint --no-ignore src/screens/map/CurrentLocationMapScreen.tsx`.
- [ ] **Step 6: 커밋** — `feat(map): CurrentLocationMapScreen — 노선도 현재역 하이라이트`

---

### Task 4: 네비 라우트 + 홈 진입점

**Files:**
- Modify: `src/navigation/RootNavigator.tsx` (라우트 등록 + 타입)
- Modify: `src/screens/home/HomeScreen.tsx` (진입 어포던스)
- Test: `src/screens/home/__tests__/HomeScreen.test.tsx` (진입 케이스)

**Interfaces:**
- Consumes: `CurrentLocationMapScreen`(T3).
- Produces: route name `CurrentLocationMap: undefined` in `AppStackParamList`.

- [ ] **Step 1: 라우트 등록** — RootNavigator.tsx: import `CurrentLocationMapScreen`, `AppStackParamList`에 `CurrentLocationMap: undefined;` 추가, `<Stack.Screen name="CurrentLocationMap" component={CurrentLocationMapScreen} options={{ headerShown: true, title: '내 위치 노선도' }} />` 추가(기존 SubwayMap 라우트 인근).
- [ ] **Step 2: 홈 진입 RED 테스트** — HomeScreen.test.tsx에 케이스 추가: 진입 어포던스(testID `home-current-location-map`) 탭 → `mockNavigate('CurrentLocationMap')`.
```tsx
it('navigates to the current-location map when the entry is tapped', async () => {
  const { getByTestId } = render(<HomeScreen />);
  await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
  fireEvent.press(getByTestId('home-current-location-map'));
  expect(mockNavigate).toHaveBeenCalledWith('CurrentLocationMap');
});
```
- [ ] **Step 3: 실패 확인** — `npx jest --runInBand --watchman=false src/screens/home/__tests__/HomeScreen.test.tsx -t "current-location map"` → FAIL.
- [ ] **Step 4: 홈 진입 구현** — HomeScreen에 진입 어포던스 추가: QuickActionsGrid 항목 또는 전용 `Pressable`(testID `home-current-location-map`, `accessibilityLabel="내 위치 노선도"`, ≥44pt) → `onPress={useCallback(() => navigation.navigate('CurrentLocationMap'), [navigation])}`. 적절한 위치(예: QuickActions 인근). 인라인 스타일 금지.
- [ ] **Step 5: 통과 확인** — 동일 jest → PASS. `npx tsc --noEmit` 0 errors.
- [ ] **Step 6: 커밋** — `feat(map): 현재 위치 노선도 라우트 + 홈 진입점`

---

### Task 5: 최종 검증

- [ ] **Step 1: 타입** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 2: 린트** — `npx eslint --no-ignore <변경 파일들>` → 0 errors.
- [ ] **Step 3: 관련 테스트** — `npx jest --runInBand --watchman=false src/components/map src/hooks/__tests__/useCurrentStationId src/screens/map src/screens/home/__tests__/HomeScreen` → 0 failures.
- [ ] **Step 4: 커버리지 게이트** — `npx jest --runInBand --watchman=false --coverage` → All files 임계값(75/60/70/75) 상회(전체 4865 기준, HomeScreen flaky 단독 재확인).
- [ ] **Step 5: 소비자 회귀** — `useNearbyStations`/`SubwayMapView`/`subwayMapData` 소비자 sweep green. **시각 검증(死 SVG 부활)은 Expo Go/실기기 후속 — 명시.**

## Self-Review
- **Spec coverage**: G1=T1(데이터)+T3(렌더) / G2=T2+T3(selectedStation+헤더) / G3=T2(status)+T3(unavailable 분기) / G4=T4. §4.1=T1, §4.2=T2, §4.3=T3, §4.4=T4. 전부 대응. ✓
- **Placeholder scan**: 코드 step에 실제 코드/명령. T3 헤더/거리포맷은 구현 시 확정(카피 명시). ✓
- **Type consistency**: `SUBWAY_MAP_STATIONS/LINES`(T1)→T3 props; `useCurrentStationId` 반환(T2)→T3 소비; `CurrentLocationMap` route(T4). `closestStation.{id,name,distance}` 일관. ✓
