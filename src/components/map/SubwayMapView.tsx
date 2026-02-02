/**
 * Subway Map View
 * Interactive Seoul subway map viewer with pan and zoom
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, { G, Line, Circle, Text as SvgText } from 'react-native-svg';

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

// ============================================================================
// Constants
// ============================================================================

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};

// ============================================================================
// Component
// ============================================================================

const SubwayMapView: React.FC<SubwayMapViewProps> = ({
  stations,
  lines,
  selectedStation,
  highlightedLine,
  onStationPress,
  showLabels = true,
  initialScale = 1.0,
}) => {
  const [scale, setScale] = useState(initialScale);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const lastScaleRef = useRef(scale);
  const lastOffset = useRef({ x: offsetX, y: offsetY });

  // Update lastScaleRef when scale changes
  React.useEffect(() => {
    lastScaleRef.current = scale;
  }, [scale]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.25, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.25, MIN_SCALE));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1.0);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastOffset.current = { x: offsetX, y: offsetY };
      },
      onPanResponderMove: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        setOffsetX(lastOffset.current.x + gestureState.dx);
        setOffsetY(lastOffset.current.y + gestureState.dy);
      },
      onPanResponderRelease: () => {
        lastOffset.current = { x: offsetX, y: offsetY };
      },
    })
  ).current;

  const getStationRadius = (station: Station): number => {
    if (station.isTransfer) return 8;
    if (station.id === selectedStation) return 7;
    return 5;
  };

  const getStationColor = (station: Station): string => {
    if (station.id === selectedStation) return '#FF5722';
    if (station.isTransfer) return '#FFFFFF';
    const primaryLine = station.lineIds[0];
    return primaryLine ? LINE_COLORS[primaryLine] ?? '#888888' : '#888888';
  };

  const getLineOpacity = (lineId: string): number => {
    if (!highlightedLine) return 1;
    return lineId === highlightedLine ? 1 : 0.3;
  };

  return (
    <View style={styles.container}>
      {/* Map Area */}
      <View
        style={styles.mapContainer}
        {...panResponder.panHandlers}
      >
        <Svg
          width={MAP_WIDTH * scale}
          height={MAP_HEIGHT * scale}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          style={{
            transform: [
              { translateX: offsetX },
              { translateY: offsetY },
            ],
          }}
        >
          <G>
            {/* Draw line segments */}
            {lines.map((segment, index) => {
              const fromStation = stations.find(s => s.id === segment.fromStation);
              const toStation = stations.find(s => s.id === segment.toStation);

              if (!fromStation || !toStation) return null;

              return (
                <Line
                  key={`line-${index}`}
                  x1={fromStation.x}
                  y1={fromStation.y}
                  x2={toStation.x}
                  y2={toStation.y}
                  stroke={segment.color || LINE_COLORS[segment.lineId] || '#888'}
                  strokeWidth={4}
                  opacity={getLineOpacity(segment.lineId)}
                />
              );
            })}

            {/* Draw stations */}
            {stations.map(station => (
              <G key={station.id}>
                {/* Station circle */}
                <Circle
                  cx={station.x}
                  cy={station.y}
                  r={getStationRadius(station)}
                  fill={getStationColor(station)}
                  stroke={station.isTransfer ? '#333' : '#FFF'}
                  strokeWidth={station.isTransfer ? 2 : 1}
                  onPress={() => onStationPress?.(station.id)}
                />

                {/* Station label */}
                {showLabels && (
                  <SvgText
                    x={station.x}
                    y={station.y + 18}
                    fontSize={10}
                    fill="#333"
                    textAnchor="middle"
                    fontWeight={station.id === selectedStation ? 'bold' : 'normal'}
                  >
                    {station.name}
                  </SvgText>
                )}
              </G>
            ))}
          </G>
        </Svg>
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
    fontSize: 11,
    color: '#666',
  },
});

export default SubwayMapView;
