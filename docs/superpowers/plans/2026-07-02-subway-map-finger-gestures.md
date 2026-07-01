# 노선도 핑거 제스처 (핀치 줌 + 드래그 + 클램핑) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SubwayMapView`의 제스처+변환 메커니즘을 `PanResponder`+SVG-치수-스케일에서 `react-native-gesture-handler`(핀치+팬) + `react-native-reanimated`(shared value → 단일 GPU transform)로 교체해 부드러운 핀치 줌·드래그·경계 클램핑을 구현한다.

**Architecture:** 진실 원천은 reanimated `useSharedValue`(`scale`, `translateX/Y`). `Gesture.Pinch`+`Gesture.Pan`을 `Gesture.Simultaneous`로 합쳐 캔버스를 감싸고, SVG는 base 치수로 단 한 번만 렌더한 뒤 `Animated.View`의 `transform:[{translateX},{translateY},{scale}]`로 확대/이동한다. 클램프·초점·변환 계산은 worklet 지시자를 단 순수 함수로 분리해 UI 스레드에서 실행하면서 jest 단위 테스트도 가능하게 한다.

**Tech Stack:** React Native 0.72, `react-native-gesture-handler ~2.12`, `react-native-reanimated ~3.3`, `react-native-svg 13.9`, TypeScript strict, Jest + RNTL.

## Global Constraints

- 신규 의존성 추가 금지 (gesture-handler·reanimated·svg 모두 설치됨).
- `any` 금지, exported 함수에 명시적 반환 타입 (typescript-strict).
- 상대경로 import 금지 → `@/`, `@components`, `@hooks` alias 사용 (path-aliases). **단 같은 디렉토리(`./subwayMapGestureMath`) 상대 import는 형제 모듈 관례상 허용** — 기존 `SubwayMapView.tsx`가 이미 `./subwayLineSvgAnchors`를 상대 import함(패턴 준수).
- `StyleSheet.create` 사용, 인라인 스타일 금지 (react-native-patterns).
- 기존 `SubwayMapView.test.tsx`의 모든 assertion은 그대로 통과해야 한다 (확대/축소/초기화 버튼, `%` 표시기 100/125/80/150/200, base `SvgXml` width=1525 height=1000, 오버레이 Circle 좌표, viewBox width=1525).
- `MIN_SCALE = 0.5`, `MAX_SCALE = 3.0` (기존 상수 값 유지).
- 콘텐츠 좌표공간 = `mapBounds` = `1525 × 1000` (base map = 오버레이 viewBox = 동일).
- Evidence-Based: jest 통과 ≠ 완료. 제스처는 시뮬레이터/실기기 확인 필수 (Task 3).

---

## File Structure

- **Create** `src/components/map/subwayMapGestureMath.ts` — 순수/worklet 계산: `clampScale`, `clampTranslate`, `focalZoom`, `toTransform` + 상수/타입.
- **Create** `src/components/map/__tests__/subwayMapGestureMath.test.ts` — 위 순수 함수 단위 테스트.
- **Modify** `src/components/map/SubwayMapView.tsx` — 제스처+변환 메커니즘 교체 (PanResponder/RN Animated 제거, gesture-handler+reanimated 도입).
- **Touch (검증만, 변경 최소)** `src/components/map/__tests__/SubwayMapView.test.tsx` — transform 전환으로 렌더 props가 바뀌지 않으므로 원칙적으로 무변경. 실행해서 GREEN 확인, 실패 시 해당 assertion만 조정.

---

## Task 1: 순수 제스처 수학 모듈 (`subwayMapGestureMath.ts`)

**Files:**
- Create: `src/components/map/subwayMapGestureMath.ts`
- Test: `src/components/map/__tests__/subwayMapGestureMath.test.ts`

**Interfaces:**
- Produces:
  - `MIN_SCALE: number` (0.5), `MAX_SCALE: number` (3.0)
  - `interface Vec2 { x: number; y: number }`
  - `interface Size { width: number; height: number }`
  - `clampScale(value: number): number`
  - `clampTranslate(translate: Vec2, scale: number, content: Size, viewport: Size): Vec2`
  - `focalZoom(focal: Vec2, prevScale: number, nextScale: number, prevTranslate: Vec2): Vec2`
  - `toTransform(scale: number, translate: Vec2, content: Size): ReadonlyArray<{ translateX: number } | { translateY: number } | { scale: number }>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/map/__tests__/subwayMapGestureMath.test.ts`:

```typescript
import {
  clampScale,
  clampTranslate,
  focalZoom,
  toTransform,
  MIN_SCALE,
  MAX_SCALE,
} from '@components/map/subwayMapGestureMath';

describe('clampScale', () => {
  it('상한 초과를 MAX_SCALE로 자른다', () => {
    expect(clampScale(10)).toBe(MAX_SCALE);
  });
  it('하한 미만을 MIN_SCALE로 자른다', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
  });
  it('범위 내 값은 그대로 둔다', () => {
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('clampTranslate', () => {
  const content = { width: 1000, height: 800 };

  it('스케일된 콘텐츠가 뷰포트보다 크면 가장자리를 넘지 못한다', () => {
    // scaledW = 2000 > viewport 400. 유효 x 범위 = [400-2000, 0] = [-1600, 0]
    const viewport = { width: 400, height: 400 };
    const tooFarLeft = clampTranslate({ x: 500, y: 0 }, 2, content, viewport);
    expect(tooFarLeft.x).toBe(0); // max 0을 넘지 못함
    const tooFarRight = clampTranslate({ x: -9999, y: 0 }, 2, content, viewport);
    expect(tooFarRight.x).toBe(400 - 2000); // min = -1600
  });

  it('스케일된 콘텐츠가 뷰포트보다 작으면 가운데 정렬한다', () => {
    // scaledW = 500 < viewport 1000 → x = (1000-500)/2 = 250
    const viewport = { width: 1000, height: 2000 };
    const centered = clampTranslate({ x: -777, y: 12 }, 0.5, content, viewport);
    expect(centered.x).toBe(250); // (1000 - 500)/2
    expect(centered.y).toBe((2000 - 400) / 2); // scaledH = 400 < 2000 → 800
  });

  it('범위 내 translate는 그대로 둔다', () => {
    const viewport = { width: 400, height: 400 };
    const inRange = clampTranslate({ x: -100, y: -50 }, 2, content, viewport);
    expect(inRange).toEqual({ x: -100, y: -50 });
  });
});

describe('focalZoom', () => {
  it('초점 아래 콘텐츠 지점을 고정한다 (좌상단 원점 모델)', () => {
    // 모델: screen = content*scale + translate → content = (focal - translate)/scale
    const focal = { x: 200, y: 100 };
    const prevScale = 1;
    const nextScale = 2;
    const prevTranslate = { x: -50, y: -30 };
    const contentAtFocalBefore = {
      x: (focal.x - prevTranslate.x) / prevScale,
      y: (focal.y - prevTranslate.y) / prevScale,
    };
    const next = focalZoom(focal, prevScale, nextScale, prevTranslate);
    const contentAtFocalAfter = {
      x: (focal.x - next.x) / nextScale,
      y: (focal.y - next.y) / nextScale,
    };
    expect(contentAtFocalAfter.x).toBeCloseTo(contentAtFocalBefore.x, 6);
    expect(contentAtFocalAfter.y).toBeCloseTo(contentAtFocalBefore.y, 6);
  });

  it('scale 변화가 없으면 translate를 바꾸지 않는다', () => {
    const t = { x: 5, y: 9 };
    expect(focalZoom({ x: 1, y: 1 }, 1.5, 1.5, t)).toEqual(t);
  });
});

describe('toTransform', () => {
  const content = { width: 1000, height: 800 };

  it('scale=1이면 중심 보정항이 0이라 translate가 그대로 반영된다', () => {
    const arr = toTransform(1, { x: 12, y: 34 }, content);
    expect(arr).toEqual([
      { translateX: 12 },
      { translateY: 34 },
      { scale: 1 },
    ]);
  });

  it('scale!=1이면 중심 원점 보정 (W/2)(1-scale)를 뺀다', () => {
    // translateX = t.x - (content.width/2)*(1-scale) = 0 - 500*(1-2) = 500
    const arr = toTransform(2, { x: 0, y: 0 }, content);
    expect(arr[0]).toEqual({ translateX: 0 - 500 * (1 - 2) }); // 500
    expect(arr[1]).toEqual({ translateY: 0 - 400 * (1 - 2) }); // 400
    expect(arr[2]).toEqual({ scale: 2 });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm test -- --watchman=false subwayMapGestureMath`
Expected: FAIL — "Cannot find module '@components/map/subwayMapGestureMath'".

- [ ] **Step 3: 최소 구현 작성**

`src/components/map/subwayMapGestureMath.ts`:

```typescript
/**
 * Pure geometry helpers for the interactive subway map.
 *
 * Every exported function is tagged `'worklet'` so it can run on the
 * reanimated UI thread (called from Gesture callbacks and useAnimatedStyle).
 * In jest the directive is inert, so these run as plain JS and are unit-tested.
 *
 * Coordinate model (top-left origin): screen = content * scale + translate.
 * RN 0.72 has no `transformOrigin`, so `toTransform` re-adds the center-origin
 * compensation term the native transform introduces.
 */

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const clampScale = (value: number): number => {
  'worklet';
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
};

const clampAxis = (
  translate: number,
  scaledLength: number,
  viewportLength: number,
): number => {
  'worklet';
  if (scaledLength <= viewportLength) {
    // Content narrower than the viewport → center it.
    return (viewportLength - scaledLength) / 2;
  }
  // Content wider → keep it covering the viewport (no empty gutters).
  const min = viewportLength - scaledLength;
  const max = 0;
  return Math.min(Math.max(translate, min), max);
};

export const clampTranslate = (
  translate: Vec2,
  scale: number,
  content: Size,
  viewport: Size,
): Vec2 => {
  'worklet';
  return {
    x: clampAxis(translate.x, content.width * scale, viewport.width),
    y: clampAxis(translate.y, content.height * scale, viewport.height),
  };
};

export const focalZoom = (
  focal: Vec2,
  prevScale: number,
  nextScale: number,
  prevTranslate: Vec2,
): Vec2 => {
  'worklet';
  const ratio = nextScale / prevScale;
  return {
    x: focal.x - (focal.x - prevTranslate.x) * ratio,
    y: focal.y - (focal.y - prevTranslate.y) * ratio,
  };
};

export const toTransform = (
  scale: number,
  translate: Vec2,
  content: Size,
): ReadonlyArray<{ translateX: number } | { translateY: number } | { scale: number }> => {
  'worklet';
  // RN scales about the view center; convert the top-left-origin translate
  // into the array RN needs by subtracting (size/2)*(1-scale).
  return [
    { translateX: translate.x - (content.width / 2) * (1 - scale) },
    { translateY: translate.y - (content.height / 2) * (1 - scale) },
    { scale },
  ];
};
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm test -- --watchman=false subwayMapGestureMath`
Expected: PASS — 4 describe 블록, 모든 it 통과.

- [ ] **Step 5: 타입체크**

Run: `npm run type-check`
Expected: exit 0 (에러 없음).

- [ ] **Step 6: 커밋**

```bash
git add src/components/map/subwayMapGestureMath.ts src/components/map/__tests__/subwayMapGestureMath.test.ts
git commit -m "feat(map): 노선도 제스처 순수 계산 모듈(클램프/초점/변환) 추가"
```

---

## Task 2: `SubwayMapView` 제스처+변환 메커니즘 교체

**Files:**
- Modify: `src/components/map/SubwayMapView.tsx`
- Test: `src/components/map/__tests__/SubwayMapView.test.tsx` (실행 검증, 필요 시 최소 조정)

**Interfaces:**
- Consumes (Task 1): `clampScale`, `clampTranslate`, `focalZoom`, `toTransform`, `MIN_SCALE`, `MAX_SCALE`, `Vec2`, `Size`.
- Produces: 동일한 `SubwayMapViewProps` (외부 계약 불변). 소비처 `CurrentLocationMapScreen`은 변경 불필요.

- [ ] **Step 1: 기존 테스트 baseline GREEN 확인 (교체 전)**

Run: `npm test -- --watchman=false SubwayMapView`
Expected: PASS (교체 전 현재 상태 GREEN 기록 — 회귀 판단 기준).

- [ ] **Step 2: `SubwayMapView.tsx` 전체 교체**

파일 전체를 아래로 교체한다 (`PanResponder`·RN `Animated`·`Easing`·`useSubwayLineSvgXml` 스케일-치수 방식 제거, gesture-handler+reanimated 도입):

```tsx
/**
 * Subway Map View
 * Interactive Seoul subway map viewer with pinch-zoom and pan.
 *
 * Rendering: the base SVG + overlay are drawn ONCE at their base size; all
 * zoom/pan happens on the GPU via a single reanimated transform on the wrapping
 * Animated.View. Pinch (Gesture.Pinch) and drag (Gesture.Pan) run simultaneously.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Image,
  Platform,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Asset } from 'expo-asset';
import { Circle, Svg, SvgXml } from 'react-native-svg';
import { useSubwayLineSvgXml } from '@hooks/useSubwayLineSvgXml';
import { weightToFontFamily } from '@/styles/modernTheme';
import {
  FALLBACK_MAP_HEIGHT,
  FALLBACK_MAP_WIDTH,
  SVG_MAP_HEIGHT,
  SVG_MAP_WIDTH,
  createSubwayLineSvgAnchorMap,
  resolveSubwayLineSvgAnchor,
  type SvgPoint,
} from '@components/map/subwayLineSvgAnchors';
import {
  clampScale,
  clampTranslate,
  focalZoom,
  toTransform,
  MAX_SCALE,
  type Size,
} from './subwayMapGestureMath';

const subwayLineSvgAsset = require('../../../docs/subway_line.svg');

// ============================================================================
// Types
// ============================================================================

interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  lineIds: string[];
  isTransfer: boolean;
}

interface LineSegment {
  lineId: string;
  fromStation: string;
  toStation: string;
  color: string;
}

interface SubwayMapViewProps {
  stations: readonly Station[];
  lines: readonly LineSegment[];
  stationAnchorsById?: Readonly<Record<string, SvgPoint>>;
  selectedStation?: string;
  highlightedLine?: string;
  onStationPress?: (stationId: string) => void;
  showLabels?: boolean;
  initialScale?: number;
}

interface MapBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

// ============================================================================
// Constants / helpers
// ============================================================================

const getMapBounds = (): MapBounds => ({
  minX: 0,
  minY: 0,
  width: Math.max(SVG_MAP_WIDTH, FALLBACK_MAP_WIDTH),
  height: Math.max(SVG_MAP_HEIGHT, FALLBACK_MAP_HEIGHT),
});

const getStationSvgAnchor = (
  station: Station,
  stationAnchorsById: Readonly<Record<string, SvgPoint>>,
): SvgPoint => stationAnchorsById[station.id] ?? resolveSubwayLineSvgAnchor(station);

const getCenteredOffset = (
  stations: readonly Station[],
  selectedStation: string | undefined,
  stationAnchorsById: Readonly<Record<string, SvgPoint>>,
  bounds: MapBounds,
  viewport: ViewportSize,
  scale: number,
): { x: number; y: number } => {
  const station = selectedStation ? stations.find(s => s.id === selectedStation) : undefined;
  const projectedStation = station ? getStationSvgAnchor(station, stationAnchorsById) : undefined;
  const focusX = projectedStation ? projectedStation.x - bounds.minX : bounds.width / 2;
  const focusY = projectedStation ? projectedStation.y - bounds.minY : bounds.height / 2;
  return {
    x: viewport.width / 2 - focusX * scale,
    y: viewport.height / 2 - focusY * scale,
  };
};

const subwayLineSvgUri = Asset.fromModule(subwayLineSvgAsset).uri;
const SHOULD_ANIMATE = process.env.NODE_ENV !== 'test';

// ============================================================================
// Component
// ============================================================================

const SubwayMapView: React.FC<SubwayMapViewProps> = ({
  stations,
  stationAnchorsById,
  selectedStation,
  onStationPress,
  initialScale = 1.0,
}) => {
  const mapBounds = React.useMemo(() => getMapBounds(), []);
  const content: Size = React.useMemo(
    () => ({ width: mapBounds.width, height: mapBounds.height }),
    [mapBounds],
  );
  const baseSvgXml = useSubwayLineSvgXml(subwayLineSvgAsset);
  const initialViewport = useRef(Dimensions.get('window')).current;
  const resolvedStationAnchorsById = React.useMemo(
    () => stationAnchorsById ?? createSubwayLineSvgAnchorMap(stations),
    [stationAnchorsById, stations],
  );

  const initialOffset = React.useMemo(
    () => getCenteredOffset(
      stations, selectedStation, resolvedStationAnchorsById, mapBounds, initialViewport, initialScale,
    ),
    [initialScale, initialViewport, mapBounds, resolvedStationAnchorsById, selectedStation, stations],
  );

  // React state drives the "%" label + buttons (synchronous → tests stable).
  const [scale, setScale] = useState(initialScale);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: initialViewport.width,
    height: initialViewport.height,
  });

  // Shared values drive the GPU transform.
  const scaleSV = useSharedValue(initialScale);
  const translateX = useSharedValue(initialOffset.x);
  const translateY = useSharedValue(initialOffset.y);
  const savedScale = useSharedValue(initialScale);
  const savedTranslateX = useSharedValue(initialOffset.x);
  const savedTranslateY = useSharedValue(initialOffset.y);
  const viewportSV = useSharedValue<Size>({
    width: initialViewport.width,
    height: initialViewport.height,
  });

  // Skip the recenter effect on first mount (initial values already set).
  const didMount = useRef(false);
  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const centered = getCenteredOffset(
      stations, selectedStation, resolvedStationAnchorsById, mapBounds, viewport, scale,
    );
    if (SHOULD_ANIMATE) {
      translateX.value = withTiming(centered.x);
      translateY.value = withTiming(centered.y);
    } else {
      translateX.value = centered.x;
      translateY.value = centered.y;
    }
    // Recenter only when the selected station changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation]);

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
      viewportSV.value = { width, height };
    }
  }, [viewportSV]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate(event => {
      const next = clampTranslate(
        { x: savedTranslateX.value + event.translationX, y: savedTranslateY.value + event.translationY },
        scaleSV.value,
        content,
        viewportSV.value,
      );
      translateX.value = next.x;
      translateY.value = next.y;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scaleSV.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate(event => {
      const nextScale = clampScale(savedScale.value * event.scale);
      const zoomed = focalZoom(
        { x: event.focalX, y: event.focalY },
        savedScale.value,
        nextScale,
        { x: savedTranslateX.value, y: savedTranslateY.value },
      );
      const clamped = clampTranslate(zoomed, nextScale, content, viewportSV.value);
      scaleSV.value = nextScale;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      runOnJS(setScale)(scaleSV.value);
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: toTransform(scaleSV.value, { x: translateX.value, y: translateY.value }, content),
  }));

  const applyScale = useCallback((nextRaw: number) => {
    const next = clampScale(nextRaw);
    setScale(next);
    scaleSV.value = SHOULD_ANIMATE ? withTiming(next) : next;
  }, [scaleSV]);

  const handleZoomIn = useCallback(() => applyScale(scale * 1.25), [applyScale, scale]);
  const handleZoomOut = useCallback(() => applyScale(scale / 1.25), [applyScale, scale]);

  const handleReset = useCallback(() => {
    const resetScale = 1.0;
    const centered = getCenteredOffset(
      stations, selectedStation, resolvedStationAnchorsById, mapBounds, viewport, resetScale,
    );
    setScale(resetScale);
    if (SHOULD_ANIMATE) {
      scaleSV.value = withTiming(resetScale);
      translateX.value = withTiming(centered.x);
      translateY.value = withTiming(centered.y);
    } else {
      scaleSV.value = resetScale;
      translateX.value = centered.x;
      translateY.value = centered.y;
    }
  }, [mapBounds, resolvedStationAnchorsById, scaleSV, selectedStation, stations, translateX, translateY, viewport]);

  const getStationRadius = (station: Station): number => {
    if (station.isTransfer) return 8;
    if (station.id === selectedStation) return 7;
    return 5;
  };

  const selectedStationData = selectedStation
    ? stations.find(station => station.id === selectedStation)
    : undefined;
  const selectedStationPoint = selectedStationData
    ? getStationSvgAnchor(selectedStationData, resolvedStationAnchorsById)
    : undefined;
  const handleSelectedStationPress = selectedStationData && onStationPress
    ? (): void => onStationPress(selectedStationData.id)
    : undefined;
  const selectedStationPressProps = handleSelectedStationPress
    ? { onPress: handleSelectedStationPress }
    : {};

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.mapContainer} onLayout={handleMapLayout}>
          <Animated.View style={[styles.mapCanvas, animatedStyle]}>
            {Platform.OS === 'web' ? (
              <Image
                source={{ uri: subwayLineSvgUri }}
                style={[styles.mapImage, { width: SVG_MAP_WIDTH, height: SVG_MAP_HEIGHT }]}
                resizeMode="contain"
              />
            ) : baseSvgXml ? (
              <SvgXml xml={baseSvgXml} width={SVG_MAP_WIDTH} height={SVG_MAP_HEIGHT} />
            ) : null}
            <Svg
              width={mapBounds.width}
              height={mapBounds.height}
              viewBox={`${mapBounds.minX} ${mapBounds.minY} ${mapBounds.width} ${mapBounds.height}`}
              style={styles.overlaySvg}
            >
              {selectedStationPoint && selectedStationData && (
                <>
                  <Circle
                    cx={selectedStationPoint.x}
                    cy={selectedStationPoint.y}
                    r={20}
                    fill="#FF5722"
                    opacity={0.18}
                  />
                  <Circle
                    cx={selectedStationPoint.x}
                    cy={selectedStationPoint.y}
                    r={getStationRadius(selectedStationData) + 7}
                    fill="none"
                    stroke="#FF5722"
                    strokeWidth={3}
                    opacity={0.75}
                  />
                  <Circle
                    cx={selectedStationPoint.x}
                    cy={selectedStationPoint.y}
                    r={getStationRadius(selectedStationData)}
                    fill="#FF5722"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    {...selectedStationPressProps}
                  />
                </>
              )}
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Zoom Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleZoomIn}
          accessibilityLabel="확대"
          accessibilityHint="지도를 확대합니다"
        >
          <Text style={styles.controlButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleZoomOut}
          accessibilityLabel="축소"
          accessibilityHint="지도를 축소합니다"
        >
          <Text style={styles.controlButtonText}>−</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleReset}
          accessibilityLabel="초기화"
          accessibilityHint="지도를 초기 상태로 되돌립니다"
        >
          <Text style={styles.controlButtonTextSmall}>⟲</Text>
        </TouchableOpacity>
      </View>

      {/* Scale Indicator */}
      <View style={styles.scaleIndicator}>
        <Text style={styles.scaleText}>{Math.round(scale * 100)}%</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#333' }]} />
          <Text style={styles.legendText}>환승역</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: '#FF5722' }]} />
          <Text style={styles.legendText}>선택됨</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  mapContainer: { flex: 1, overflow: 'hidden' },
  mapCanvas: { position: 'absolute', left: 0, top: 0 },
  mapImage: { position: 'absolute', left: 0, top: 0 },
  overlaySvg: { position: 'absolute', left: 0, top: 0 },
  controls: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  controlButtonText: {
    fontSize: 24,
    fontFamily: weightToFontFamily('300'),
    color: '#333',
  },
  controlButtonTextSmall: { fontSize: 20, color: '#333' },
  scaleIndicator: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  scaleText: { fontSize: 12, color: '#666' },
  legend: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendCircle: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  legendText: { fontSize: 12, color: '#666' },
});

export default SubwayMapView;
```

주의사항 (구현 시 확인):
- `MAX_SCALE`는 import하지만 컴포넌트에서 직접 안 쓰면 미사용 경고 → 실제로 안 쓰면 import에서 제거 (lint `no-unused-vars`). (버튼 상한은 `clampScale` 내부가 처리하므로 `MAX_SCALE` 직접 참조 불필요할 수 있음 → 미사용이면 삭제.)
- `controlButtonText`에서 기존 `fontWeight: '300'`는 제거하고 `fontFamily: weightToFontFamily('300')`만 유지 (typography 규칙: `fontWeight` 단독 금지, `weightToFontFamily` 동반이면 OK — 여기선 fontFamily만 두어 안전).

- [ ] **Step 3: 기존 SubwayMapView 테스트 실행 → GREEN 확인**

Run: `npm test -- --watchman=false SubwayMapView`
Expected: PASS. 근거:
- 버튼(확대/축소/초기화)·`%` 표시기·범례: 그대로 존재.
- 확대 125% / 축소 80% / 초기화 100%: `applyScale`가 `setScale`를 동기 호출 → 표시기 갱신.
- base `SvgXml` width=1525 height=1000: 이제 `SVG_MAP_WIDTH`/`SVG_MAP_HEIGHT` 상수(=1525/1000) 그대로.
- 오버레이 Circle 좌표·viewBox: 변경 없음 (오버레이 `width={mapBounds.width}`, viewBox 동일).
- `GestureDetector`는 RNGH jestSetup에서 children pass-through, `Animated.View`는 reanimated mock에서 View pass-through → 자식 요소 모두 렌더.

실패 시: 렌더 구조 변화로 깨진 assertion만 최소 수정. **버튼/표시기/좌표 계약은 바꾸지 말 것** — 깨지면 구현 쪽을 고친다.

- [ ] **Step 4: 전체 타입체크 + 린트**

Run: `npm run type-check && npx eslint src/components/map/SubwayMapView.tsx src/components/map/subwayMapGestureMath.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 5: 커밋**

```bash
git add src/components/map/SubwayMapView.tsx src/components/map/__tests__/SubwayMapView.test.tsx
git commit -m "feat(map): 노선도 핀치 줌+드래그 제스처 (gesture-handler+reanimated)"
```

---

## Task 3: 실기기/시뮬레이터 검증 (Evidence-Based Gate)

**Files:** 없음 (검증만). 필요 시 `subwayMapGestureMath.toTransform` 튜닝.

이 Task는 코드가 아니라 **관찰 증거**가 산출물이다. jest는 실제 제스처를 못 쏘므로 여기서만 "부드러움"을 확인한다.

- [ ] **Step 1: 앱 실행**

worktree에서 dev 서버 실행 (Metro blockList가 `.claude/`만 막으므로 scratchpad worktree는 정상 번들됨):
Run: `npm start` → iOS 시뮬레이터/실기기에서 "내 위치 노선도" 화면 진입.
(SvgXml 렌더는 dev에서 정상. standalone 검증은 PR #282 범위이므로 여기선 dev면 충분.)

- [ ] **Step 2: 제스처 체크리스트 (직접 손으로)**

- [ ] 두 손가락 핀치 → 부드럽게 확대/축소, **손가락 중점 아래 지점이 고정**(초점 줌). 중심/좌상단으로 쏠리면 `toTransform` 보정 부호/순서 문제 → Step 3.
- [ ] 한 손가락 드래그 → 부드럽게 이동.
- [ ] 지도를 세게 밀어도 **화면 밖으로 사라지지 않음**(클램핑). 축소 시 콘텐츠가 뷰포트보다 작아지면 가운데 정렬.
- [ ] 핀치+드래그 동시 → 충돌·튐 없음.
- [ ] `+`/`−`/초기화 버튼 + `%` 표시기 정상. 핀치 후 표시기가 최종 배율로 갱신됨.

- [ ] **Step 3: (초점 어긋날 때만) `toTransform` 튜닝**

RN transform array 순서/원점 실측이 논리 모델과 다르면 `subwayMapGestureMath.toTransform`의 보정만 조정:
- 확대 시 콘텐츠가 반대로 튀면 보정항 부호 반전: `translate.x + (content.width/2)*(1 - scale)`.
- transform 순서 영향이면 `{ scale }`을 배열 **앞**으로 이동해 재확인.
조정 후 `subwayMapGestureMath.test.ts`의 `toTransform` 테스트를 실제 동작에 맞게 갱신하고 재실행.

- [ ] **Step 4: 검증 결과 기록 + 커밋 (튜닝 발생 시)**

튜닝이 있었다면:
```bash
git add src/components/map/subwayMapGestureMath.ts src/components/map/__tests__/subwayMapGestureMath.test.ts
git commit -m "fix(map): 실기기 초점 줌 보정 튜닝"
```
검증 완료 후 최종 상태를 사용자에게 스크린샷/GIF 또는 관찰 요약으로 보고.

---

## Self-Review (spec 대비)

- **핀치 줌**: Task 2 `pinchGesture` + `focalZoom`. ✅
- **드래그(팬)**: Task 2 `panGesture`. ✅
- **동시 동작**: `Gesture.Simultaneous`. ✅
- **부드러움(GPU transform, SVG 1회 렌더)**: `animatedStyle`+`toTransform`, SvgXml width 상수화. ✅
- **경계 클램핑**: `clampTranslate` (Task 1) + pan/pinch onUpdate 적용 (Task 2). ✅
- **버튼/표시기 유지 + 테스트 정합**: `applyScale`가 state 동기 갱신, pinch onEnd `runOnJS(setScale)`. ✅
- **자동 센터링 충돌 제거**: recenter effect를 `[selectedStation]`로 좁히고 첫 마운트 skip. ✅
- **초점 줌 원점 nuance + on-device 검증**: Task 3. ✅
- **범위 밖(관성/더블탭)**: 미포함 (spec 준수). ✅
- Placeholder scan: 없음. Type 일관성: `Vec2`/`Size`/함수 시그니처가 Task1↔Task2 일치. ✅
```
