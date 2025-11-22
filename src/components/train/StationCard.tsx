/**
 * Station Card Component
 * Displays individual station information with selection state
 */

import React, { memo, useMemo, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Haptics will be optional to avoid dependency issues

import { Station } from '../../models/train';
import { SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, TOUCH_TARGET } from '../../utils/themeUtils';

interface StationCardProps {
  station: Station;
  isSelected?: boolean;
  onPress?: () => void;
  showDistance?: boolean;
  distance?: number;
}

export const StationCard: React.FC<StationCardProps> = memo(({
  station,
  isSelected = false,
  onPress,
  showDistance = false,
  distance,
}) => {
  // Memoize press handler
  const handlePress = useCallback((): void => {
    if (onPress) {
      // Future: Add haptic feedback for better UX when available
      onPress();
    }
  }, [onPress]);

  // Memoize line color calculation
  const lineColor = useMemo(() => {
    const lineColors: Record<string, string> = {
      '1': '#0d3692',  // Line 1 - Blue
      '2': '#00a84d',  // Line 2 - Green  
      '3': '#ef7c1c',  // Line 3 - Orange
      '4': '#00a4e3',  // Line 4 - Light Blue
      '5': '#996cac',  // Line 5 - Purple
      '6': '#cd7c2f',  // Line 6 - Brown
      '7': '#747f00',  // Line 7 - Olive
      '8': '#e6186c',  // Line 8 - Pink
      '9': '#bb8336',  // Line 9 - Gold
      'airport': '#0090d2', // Airport Express
      'bundang': '#fabe00',  // Bundang Line
      'sinbundang': '#d4003b', // Sinbundang Line
    };
    
    return lineColors[station.lineId] || '#6b7280';
  }, [station.lineId]);

  // Memoize distance formatting
  const formattedDistance = useMemo(() => {
    if (!showDistance || distance === undefined) return null;
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, [distance, showDistance]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${station.name} 역, ${station.lineId}호선${station.transfers && station.transfers.length > 0 ? `, 환승역: ${station.transfers.join(', ')}호선` : ''}${formattedDistance ? `, 거리: ${formattedDistance}` : ''}`}
      accessibilityHint={isSelected ? "현재 선택된 역입니다" : "탭하여 이 역의 실시간 정보를 확인하세요"}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.header}>
        <View style={styles.stationInfo}>
          <Text style={[styles.stationName, isSelected && styles.selectedText]}>
            {station.name}
          </Text>
          <Text style={styles.stationNameEn}>
            {station.nameEn}
          </Text>
        </View>
        {formattedDistance && (
          <Text style={styles.distance}>
            {formattedDistance}
          </Text>
        )}
      </View>

      <View style={styles.lineInfo}>
        <View 
          style={[
            styles.lineIndicator,
            { backgroundColor: lineColor }
          ]}
        />
        <Text style={styles.lineText}>
          {station.lineId}호선
        </Text>
      </View>

      {station.transfers && station.transfers.length > 0 && (
        <View style={styles.transfersContainer}>
          <Ionicons name="shuffle-outline" size={14} color="#6b7280" />
          <Text style={styles.transfersText}>
            환승: {station.transfers.map(lineId => `${lineId}호선`).join(', ')}
          </Text>
        </View>
      )}

      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
        </View>
      )}
    </TouchableOpacity>
  );
});

// Set display name for debugging
StationCard.displayName = 'StationCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginRight: SPACING.md,
    minWidth: 200,
    minHeight: TOUCH_TARGET.comfortable,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...SHADOWS.md,
  },
  selectedContainer: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: '#111827',
    marginBottom: SPACING.xs,
  },
  selectedText: {
    color: '#2563eb',
  },
  stationNameEn: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  lineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  lineText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  transfersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transfersText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
