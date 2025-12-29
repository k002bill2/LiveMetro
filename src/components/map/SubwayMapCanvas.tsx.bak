import React from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { G, Path, Rect, Circle, Text } from 'react-native-svg';
import { MapData, createLinePaths, MAP_WIDTH, MAP_HEIGHT } from '../../utils/mapLayout';
import { LINE_COLORS } from '../../utils/subwayMapData';

interface SubwayMapCanvasProps {
  onStationPress?: (stationName: string) => void;
  selectedStationId?: string | null;
  selectedLineId?: string | null;
  initialStationName?: string;
  mapData: MapData;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 2024 Design System Constants
const LINE_WIDTH_MAIN = 13; // Main lines (1-9호선) - 4-6px scaled
const LINE_WIDTH_BRANCH = 10; // Branch lines - 3-4px scaled
const STATION_RADIUS_REGULAR = 6; // Regular stations
const STATION_RADIUS_TRANSFER = 9; // Transfer stations (enlarged for traffic light style)
const STATION_STROKE_WIDTH = 2.5; // 2024 standard
const STATION_STROKE_WIDTH_SELECTED = 4; // Selected emphasis

export const SubwayMapCanvas: React.FC<SubwayMapCanvasProps> = ({
  onStationPress,
  selectedLineId,
  selectedStationId,
  mapData,
}) => {
  // Calculate scale to fit SVG in screen with some padding
  const fitScale = Math.min(SCREEN_WIDTH / MAP_WIDTH, SCREEN_HEIGHT / MAP_HEIGHT) * 0.9;

  // Start with 150% zoom on center
  const initialScale = fitScale * 1.5;

  // Center the map - focus on the center of the map
  const focusX = MAP_WIDTH / 2;
  const focusY = MAP_HEIGHT / 2;
  const initialTranslateX = SCREEN_WIDTH / 2 - focusX * initialScale;
  const initialTranslateY = SCREEN_HEIGHT / 2 - focusY * initialScale;

  const scale = useSharedValue(initialScale);
  const savedScale = useSharedValue(initialScale);
  const translateX = useSharedValue(initialTranslateX);
  const translateY = useSharedValue(initialTranslateY);
  const savedTranslateX = useSharedValue(initialTranslateX);
  const savedTranslateY = useSharedValue(initialTranslateY);

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(newScale, fitScale * 0.5), fitScale * 5);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // Reset to initial view
      scale.value = withTiming(initialScale, { duration: 300 });
      savedScale.value = initialScale;
      translateX.value = withTiming(initialTranslateX, { duration: 300 });
      translateY.value = withTiming(initialTranslateY, { duration: 300 });
      savedTranslateX.value = initialTranslateX;
      savedTranslateY.value = initialTranslateY;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const linePaths = React.useMemo(() => {
    const paths = createLinePaths(mapData);
    console.log('SubwayMapCanvas: mapData nodes:', mapData.nodes.length);
    console.log('SubwayMapCanvas: linePaths keys:', Object.keys(paths));
    return paths;
  }, [mapData]);

  console.log('SubwayMapCanvas: Rendering with dimensions:', MAP_WIDTH, MAP_HEIGHT);

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={animatedStyle}>
          <Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            {/* Background */}
            <Rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#FAFAFA" />

            {/* Render all subway lines - 2024 Design System */}
            <G>
              {Object.entries(linePaths).map(([lineId, { path, color }]) => {
                // Determine line width based on line type
                const isMainLine = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(lineId);
                const lineWidth = isMainLine ? LINE_WIDTH_MAIN : LINE_WIDTH_BRANCH;

                return (
                  <Path
                    key={lineId}
                    d={path}
                    stroke={color}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={selectedLineId && selectedLineId !== lineId ? 0.2 : 1}
                  />
                );
              })}
            </G>

            {/* Render Stations - 2024 Design System with Traffic Light Transfer Style */}
            <G>
              {mapData.nodes.map(node => {
                const isSelected = selectedStationId === node.name || selectedStationId === node.id;
                const isDimmed = selectedLineId && selectedLineId !== node.lineId && !isSelected;

                // 2024 Design: Calculate radius based on station type
                const stationRadius = node.isTransfer ? STATION_RADIUS_TRANSFER : STATION_RADIUS_REGULAR;
                const strokeWidth = isSelected ? STATION_STROKE_WIDTH_SELECTED : STATION_STROKE_WIDTH;

                return (
                  <G key={node.id} onPress={() => onStationPress?.(node.name)}>
                    {/* Traffic Light Style for Transfer Stations */}
                    {node.isTransfer && node.lines.length > 1 ? (
                      <>
                        {/* Multi-line transfer indicator (신호등 방식) */}
                        {node.lines.map((lineId, index) => {
                          const lineColor = LINE_COLORS[lineId] || node.color;
                          const offsetX = (index - (node.lines.length - 1) / 2) * (stationRadius * 1.8);

                          return (
                            <Circle
                              key={`${node.id}-${lineId}`}
                              cx={node.x + offsetX}
                              cy={node.y}
                              r={stationRadius * 0.7}
                              fill="white"
                              stroke={lineColor}
                              strokeWidth={strokeWidth}
                              opacity={isDimmed ? 0.2 : 1}
                            />
                          );
                        })}
                        {/* Connection line between transfer dots */}
                        {node.lines.length > 1 && (
                          <G>
                            {node.lines.slice(0, -1).map((_, index) => {
                              const x1 =
                                node.x +
                                (index - (node.lines.length - 1) / 2) * (stationRadius * 1.8) +
                                stationRadius * 0.7;
                              const x2 =
                                node.x +
                                (index + 1 - (node.lines.length - 1) / 2) * (stationRadius * 1.8) -
                                stationRadius * 0.7;

                              return (
                                <G key={`connector-${index}`}>
                                  <Path
                                    d={`M ${x1} ${node.y} L ${x2} ${node.y}`}
                                    stroke="#DDD"
                                    strokeWidth={strokeWidth * 0.6}
                                    opacity={isDimmed ? 0.2 : 0.5}
                                  />
                                </G>
                              );
                            })}
                          </G>
                        )}
                      </>
                    ) : (
                      /* Regular station (single line) */
                      <Circle
                        cx={node.x}
                        cy={node.y}
                        r={stationRadius}
                        fill="white"
                        stroke={isSelected ? '#000' : node.color}
                        strokeWidth={strokeWidth}
                        opacity={isDimmed ? 0.2 : 1}
                      />
                    )}

                    {/* Station Name - 2024 Typography System */}
                    {!isDimmed && (
                      <Text
                        x={node.x}
                        y={node.y + (node.isTransfer ? 20 : 16)}
                        fontSize={node.isTransfer ? '14' : '12'}
                        fill="#000000"
                        textAnchor="middle"
                        alignmentBaseline="hanging"
                        fontWeight={node.isTransfer ? '700' : '400'}
                        fontFamily="system-ui, -apple-system"
                      >
                        {node.name}
                      </Text>
                    )}

                    {/* Enlarged hit area for better touch interaction */}
                    <Circle cx={node.x} cy={node.y} r={node.isTransfer ? 20 : 15} fill="transparent" />
                  </G>
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Line Legend */}
      <View style={styles.legend}>
        {Object.entries(linePaths).map(([id, { color }]) => (
          <View key={id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
          </View>
        ))}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  legend: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  legendItem: {
    marginHorizontal: 3,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
