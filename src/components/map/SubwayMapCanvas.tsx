import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, G, Text as SvgText, Rect, Path } from 'react-native-svg';
import { MapData } from '../../utils/mapLayout';

interface SubwayMapCanvasProps {
  mapData: MapData;
  onStationPress: (stationId: string) => void;
  selectedStationId?: string | null;
  selectedLineId?: string | null;
  initialStationName?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SubwayMapCanvas: React.FC<SubwayMapCanvasProps> = ({ 
  mapData, 
  onStationPress,
  selectedStationId,
  selectedLineId,
  initialStationName
}) => {
  // Shared values for transformations
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Center the map initially
  React.useEffect(() => {
    let targetX = mapData.width / 2;
    let targetY = mapData.height / 2;
    let initialScale = Math.min(SCREEN_WIDTH / mapData.width, SCREEN_HEIGHT / mapData.height) * 0.8;

    // If initialStationName is provided, center on that station
    if (initialStationName) {
      const targetNode = mapData.nodes.find(n => n.name === initialStationName);
      if (targetNode) {
        targetX = targetNode.x;
        targetY = targetNode.y;
        initialScale = 1.5; // Zoom in more for specific station
      }
    }

    scale.value = initialScale;
    savedScale.value = initialScale;
    
    // Calculate translation to center targetX, targetY
    // Center of screen is (SCREEN_WIDTH/2, SCREEN_HEIGHT/2)
    // We want (targetX * scale + translateX) = SCREEN_WIDTH/2
    // translateX = SCREEN_WIDTH/2 - targetX * scale
    
    translateX.value = (SCREEN_WIDTH / 2) - (targetX * initialScale);
    translateY.value = (SCREEN_HEIGHT / 2) - (targetY * initialScale);
    
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  }, [mapData, initialStationName]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Group edges by line for continuous paths
  const linePaths = React.useMemo(() => {
    const paths: Record<string, { d: string; color: string; lineId: string }> = {};
    
    mapData.edges.forEach(edge => {
      if (!paths[edge.lineId]) {
        paths[edge.lineId] = { d: `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`, color: edge.color, lineId: edge.lineId };
      } else {
        paths[edge.lineId]!.d += ` L ${edge.x2} ${edge.y2}`;
      }
    });
    
    return Object.values(paths);
  }, [mapData]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.mapContainer, animatedStyle]}>
          <Svg width={mapData.width} height={mapData.height} viewBox={`0 0 ${mapData.width} ${mapData.height}`}>
            {/* Background for better touch handling */}
            <Rect x="0" y="0" width={mapData.width} height={mapData.height} fill="#f9fafb" />
            
            {/* Lines (Paths) */}
            <G>
              {linePaths.map((line, index) => {
                const isDimmed = selectedLineId && selectedLineId !== line.lineId;
                return (
                  <Path
                    key={`line-${index}`}
                    d={line.d}
                    stroke={line.color}
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={isDimmed ? 0.2 : 1}
                  />
                );
              })}
            </G>

            {/* Nodes (Stations) */}
            <G>
              {mapData.nodes.map((node) => {
                const isSelected = selectedStationId === node.stationId;
                const isDimmed = selectedLineId && selectedLineId !== node.lineId;
                
                const radius = node.isTransfer ? 16 : 10;
                const strokeWidth = node.isTransfer ? 5 : 3;
                
                // Heuristic: Place label above if in top half of map, below otherwise
                const isTopHalf = node.y < 1000;
                const labelY = isTopHalf ? node.y - radius - 12 : node.y + radius + 24;

                return (
                  <G 
                    key={node.id} 
                    onPress={() => onStationPress(node.stationId)}
                    opacity={isDimmed ? 0.2 : 1}
                  >
                    {/* Station Circle */}
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill="white"
                      stroke={node.color}
                      strokeWidth={isSelected ? strokeWidth + 3 : strokeWidth}
                    />
                    
                    {/* Station Name - Halo for readability */}
                    <SvgText
                      x={node.x}
                      y={labelY}
                      fontSize={node.isTransfer ? "16" : "13"}
                      fontWeight={node.isTransfer || isSelected ? "bold" : "500"}
                      fill="white"
                      stroke="white"
                      strokeWidth="4"
                      textAnchor="middle"
                    >
                      {node.name}
                    </SvgText>

                    {/* Station Name - Text */}
                    <SvgText
                      x={node.x}
                      y={labelY}
                      fontSize={node.isTransfer ? "16" : "13"}
                      fontWeight={node.isTransfer || isSelected ? "bold" : "500"}
                      fill="#333"
                      textAnchor="middle"
                    >
                      {node.name}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  mapContainer: {
    width: '100%',
    height: '100%',
  },
});
