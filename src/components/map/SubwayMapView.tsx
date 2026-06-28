/**
 * Subway Map View
 * Interactive Seoul subway map viewer with pan and zoom
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Animated,
  Easing,
  Image,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SvgUri } from 'react-native-svg';
import { weightToFontFamily } from '@/styles/modernTheme';

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

interface SvgPoint {
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

const FALLBACK_MAP_WIDTH = 1200;
const FALLBACK_MAP_HEIGHT = 900;
const SVG_MAP_WIDTH = 1525;
const SVG_MAP_HEIGHT = 1000;
const SOURCE_MAP_WIDTH = 4900;
const SOURCE_MAP_HEIGHT = 4400;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const RECENTER_ANIMATION_MS = 420;
const OFFSET_EPSILON = 0.5;
const SHOULD_ANIMATE_RECENTER = process.env.NODE_ENV !== 'test';
const SVG_STATION_ANCHORS_BY_ID: Record<string, SvgPoint> = {
  // 7호선 서쪽 구간은 docs/subway_line.svg의 역점 좌표를 직접 사용한다.
  s_3763: { x: 40, y: 580 }, // 석남
  s_ec82b0ea: { x: 100, y: 605 }, // 산곡
  bupyeong_gu: { x: 140, y: 605 }, // 부평구청
  s_eab5b4ed: { x: 195, y: 550 }, // 굴포천
  s_3759: { x: 210, y: 535 }, // 삼산체육관
  s_ec8381eb: { x: 210, y: 515 }, // 상동
  s_ebb680ec: { x: 240, y: 495 }, // 부천시청
  s_3756: { x: 270, y: 500 }, // 신중동
  s_ecb698ec: { x: 285, y: 515 }, // 춘의
  s_3754: { x: 290, y: 542.5 }, // 부천종합운동장
  s_eab98cec: { x: 290, y: 565 }, // 까치울
  s_1821: { x: 325, y: 600 }, // 온수
  s_ecb29cec: { x: 340, y: 615 }, // 천왕
  gwangmyeong_sageo: { x: 355, y: 630 }, // 광명사거리
  cheolsan: { x: 390, y: 640 }, // 철산
  gasan_digital: { x: 415, y: 640 }, // 가산디지털단지
};

const getMapBounds = (): MapBounds => {
  return {
    minX: 0,
    minY: 0,
    width: Math.max(SVG_MAP_WIDTH, FALLBACK_MAP_WIDTH),
    height: Math.max(SVG_MAP_HEIGHT, FALLBACK_MAP_HEIGHT),
  };
};

const projectStationToSvg = (station: Station): SvgPoint =>
  SVG_STATION_ANCHORS_BY_ID[station.id] ?? {
    x: (station.x / SOURCE_MAP_WIDTH) * SVG_MAP_WIDTH,
    y: (station.y / SOURCE_MAP_HEIGHT) * SVG_MAP_HEIGHT,
  };

const getCenteredOffset = (
  stations: readonly Station[],
  selectedStation: string | undefined,
  bounds: MapBounds,
  viewport: ViewportSize,
  scale: number,
): { x: number; y: number } => {
  const station = selectedStation ? stations.find(s => s.id === selectedStation) : undefined;
  const projectedStation = station ? projectStationToSvg(station) : undefined;
  const focusX = projectedStation ? projectedStation.x - bounds.minX : bounds.width / 2;
  const focusY = projectedStation ? projectedStation.y - bounds.minY : bounds.height / 2;

  return {
    x: viewport.width / 2 - focusX * scale,
    y: viewport.height / 2 - focusY * scale,
  };
};

const areOffsetsEqual = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean =>
  Math.abs(a.x - b.x) < OFFSET_EPSILON && Math.abs(a.y - b.y) < OFFSET_EPSILON;

const subwayLineSvgUri = Image.resolveAssetSource(subwayLineSvgAsset)?.uri ?? null;

// ============================================================================
// Component
// ============================================================================

const SubwayMapView: React.FC<SubwayMapViewProps> = ({
  stations,
  selectedStation,
  onStationPress,
  initialScale = 1.0,
}) => {
  const mapBounds = React.useMemo(() => getMapBounds(), []);
  const initialViewport = useRef(Dimensions.get('window')).current;
  const [scale, setScale] = useState(initialScale);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: initialViewport.width,
    height: initialViewport.height,
  });
  const initialOffset = React.useMemo(
    () => getCenteredOffset(stations, selectedStation, mapBounds, initialViewport, initialScale),
    [initialScale, initialViewport, mapBounds, selectedStation, stations],
  );
  const animatedOffset = useRef(new Animated.ValueXY(initialOffset)).current;
  const lastScaleRef = useRef(scale);
  const lastOffset = useRef(initialOffset);

  const animateToOffset = useCallback((offset: { x: number; y: number }) => {
    if (areOffsetsEqual(lastOffset.current, offset)) {
      return;
    }
    lastOffset.current = offset;
    if (!SHOULD_ANIMATE_RECENTER) {
      animatedOffset.setValue(offset);
      return;
    }
    Animated.timing(animatedOffset, {
      toValue: offset,
      duration: RECENTER_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animatedOffset]);

  // Update lastScaleRef when scale changes
  React.useEffect(() => {
    lastScaleRef.current = scale;
  }, [scale]);

  React.useEffect(() => {
    const centered = getCenteredOffset(
      stations,
      selectedStation,
      mapBounds,
      viewport,
      lastScaleRef.current
    );
    animateToOffset(centered);
  }, [animateToOffset, mapBounds, selectedStation, stations, viewport]);

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.25, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.25, MIN_SCALE));
  }, []);

  const handleReset = useCallback(() => {
    const resetScale = 1.0;
    const centered = getCenteredOffset(stations, selectedStation, mapBounds, viewport, resetScale);
    setScale(resetScale);
    animateToOffset(centered);
  }, [animateToOffset, mapBounds, selectedStation, stations, viewport]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        animatedOffset.stopAnimation((value: { x: number; y: number }) => {
          lastOffset.current = value;
        });
      },
      onPanResponderMove: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const nextOffset = {
          x: lastOffset.current.x + gestureState.dx,
          y: lastOffset.current.y + gestureState.dy,
        };
        animatedOffset.setValue(nextOffset);
      },
      onPanResponderRelease: () => {
        animatedOffset.stopAnimation((value: { x: number; y: number }) => {
          lastOffset.current = value;
        });
      },
    })
  ).current;

  const getStationRadius = (station: Station): number => {
    if (station.isTransfer) return 8;
    if (station.id === selectedStation) return 7;
    return 5;
  };

  const selectedStationData = selectedStation
    ? stations.find(station => station.id === selectedStation)
    : undefined;
  const selectedStationPoint = selectedStationData
    ? projectStationToSvg(selectedStationData)
    : undefined;

  return (
    <View style={styles.container}>
      {/* Map Area */}
      <View
        style={styles.mapContainer}
        onLayout={handleMapLayout}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={[
            styles.mapCanvas,
            {
              transform: animatedOffset.getTranslateTransform(),
            },
          ]}
        >
          <SvgUri
            uri={subwayLineSvgUri}
            width={SVG_MAP_WIDTH * scale}
            height={SVG_MAP_HEIGHT * scale}
          />
          <Svg
            width={mapBounds.width * scale}
            height={mapBounds.height * scale}
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
                  onPress={() => onStationPress?.(selectedStationData.id)}
                />
              </>
            )}
          </Svg>
        </Animated.View>
      </View>

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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  mapCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  overlaySvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
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
    fontWeight: '300',
    fontFamily: weightToFontFamily('300'),
    color: '#333',
  },
  controlButtonTextSmall: {
    fontSize: 20,
    color: '#333',
  },
  scaleIndicator: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  scaleText: {
    fontSize: 12,
    color: '#666',
  },
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
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});

export default SubwayMapView;
