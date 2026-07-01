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
  type Size,
} from '@components/map/subwayMapGestureMath';

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
    // Recenter when the selected station changes, and once the real viewport
    // is measured on layout (fixes the initial header-height offset). Viewport
    // only changes on layout/rotation — never mid-gesture — so this never yanks
    // the user back after they pan or zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation, viewport]);

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
