/**
 * Subway Map View
 * Interactive Seoul subway map viewer with pan and zoom
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
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
// Constants
// ============================================================================

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const RECENTER_ANIMATION_MS = 420;
const OFFSET_EPSILON = 0.5;
const SHOULD_ANIMATE_RECENTER = process.env.NODE_ENV !== 'test';

const getMapBounds = (): MapBounds => {
  return {
    minX: 0,
    minY: 0,
    width: Math.max(SVG_MAP_WIDTH, FALLBACK_MAP_WIDTH),
    height: Math.max(SVG_MAP_HEIGHT, FALLBACK_MAP_HEIGHT),
  };
};

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

const areOffsetsEqual = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean =>
  Math.abs(a.x - b.x) < OFFSET_EPSILON && Math.abs(a.y - b.y) < OFFSET_EPSILON;

const subwayLineSvgUri = Asset.fromModule(subwayLineSvgAsset).uri;

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
  const baseSvgXml = useSubwayLineSvgXml(subwayLineSvgAsset);
  const initialViewport = useRef(Dimensions.get('window')).current;
  const resolvedStationAnchorsById = React.useMemo(
    () => stationAnchorsById ?? createSubwayLineSvgAnchorMap(stations),
    [stationAnchorsById, stations],
  );
  const [scale, setScale] = useState(initialScale);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: initialViewport.width,
    height: initialViewport.height,
  });
  const initialOffset = React.useMemo(
    () => getCenteredOffset(
      stations,
      selectedStation,
      resolvedStationAnchorsById,
      mapBounds,
      initialViewport,
      initialScale,
    ),
    [
      initialScale,
      initialViewport,
      mapBounds,
      resolvedStationAnchorsById,
      selectedStation,
      stations,
    ],
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
      resolvedStationAnchorsById,
      mapBounds,
      viewport,
      lastScaleRef.current
    );
    animateToOffset(centered);
  }, [
    animateToOffset,
    mapBounds,
    resolvedStationAnchorsById,
    selectedStation,
    stations,
    viewport,
  ]);

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
    const centered = getCenteredOffset(
      stations,
      selectedStation,
      resolvedStationAnchorsById,
      mapBounds,
      viewport,
      resetScale,
    );
    setScale(resetScale);
    animateToOffset(centered);
  }, [
    animateToOffset,
    mapBounds,
    resolvedStationAnchorsById,
    selectedStation,
    stations,
    viewport,
  ]);

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
          {Platform.OS === 'web' ? (
            <Image
              source={{ uri: subwayLineSvgUri }}
              style={[
                styles.mapImage,
                {
                  width: SVG_MAP_WIDTH * scale,
                  height: SVG_MAP_HEIGHT * scale,
                },
              ]}
              resizeMode="contain"
            />
          ) : baseSvgXml ? (
            <SvgXml
              xml={baseSvgXml}
              width={SVG_MAP_WIDTH * scale}
              height={SVG_MAP_HEIGHT * scale}
            />
          ) : null}
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
                  {...selectedStationPressProps}
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
  mapImage: {
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
