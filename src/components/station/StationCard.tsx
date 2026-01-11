/**
 * StationCard Component
 * Simple, accessible card for displaying station information
 * Used for station search results and selection UI
 */

import React, { memo, useCallback, useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import type { Station } from '@/models/train';

/**
 * Props for StationCard component
 */
export interface StationCardProps {
  /** Station data to display */
  station: Station;
  /** Callback when card is pressed - typically navigates to station detail */
  onPress: (station: Station) => void;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
  /** Optional additional container styles */
  style?: ViewStyle;
}

/**
 * StationCard - A simple card component for displaying station information
 *
 * Features:
 * - Displays station name and line color indicator
 * - Shows transfer lines if available
 * - Full accessibility support with labels and hints
 * - Optimized with React.memo for performance
 */
export const StationCard: React.FC<StationCardProps> = memo(
  ({ station, onPress, isSelected = false, testID, style }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Get line color from utility
    const lineColor = useMemo(
      () => getSubwayLineColor(station.lineId),
      [station.lineId]
    );

    // Memoized press handler
    const handlePress = useCallback(() => {
      onPress(station);
    }, [onPress, station]);

    // Build accessibility label with full station info
    const accessibilityLabel = useMemo(() => {
      const parts = [`${station.name} 역`, `${station.lineId}호선`];
      if (station.transfers && station.transfers.length > 0) {
        parts.push(`환승: ${station.transfers.join(', ')}호선`);
      }
      return parts.join(', ');
    }, [station.name, station.lineId, station.transfers]);

    // Format transfer display text
    const transferText = useMemo(() => {
      if (!station.transfers || station.transfers.length === 0) {
        return null;
      }
      return `환승: ${station.transfers.map((id) => `${id}호선`).join(', ')}`;
    }, [station.transfers]);

    return (
      <TouchableOpacity
        style={[styles.container, isSelected && styles.selected, style]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="탭하여 역 상세 정보를 확인하세요"
        accessibilityState={{ selected: isSelected }}
        testID={testID ?? `station-card-${station.id}`}
      >
        {/* Line color indicator */}
        <View
          style={[styles.lineIndicator, { backgroundColor: lineColor }]}
          accessible={false}
        />

        {/* Station information */}
        <View style={styles.content}>
          <Text style={styles.stationName} numberOfLines={1}>
            {station.name}
          </Text>

          {station.nameEn && (
            <Text style={styles.stationNameEn} numberOfLines={1}>
              {station.nameEn}
            </Text>
          )}

          <Text style={styles.lineInfo}>{station.lineId}호선</Text>

          {transferText && (
            <Text style={styles.transfers} numberOfLines={1}>
              {transferText}
            </Text>
          )}
        </View>

        {/* Selection indicator */}
        {isSelected && <View style={styles.selectionDot} />}
      </TouchableOpacity>
    );
  }
);

StationCard.displayName = 'StationCard';

// Type for theme colors (subset of ThemeColors)
type ThemeColors = {
  surface: string;
  borderLight: string;
  borderMedium: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

/**
 * Create styles with theme colors
 */
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minHeight: 72,
    },
    selected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    lineIndicator: {
      width: 4,
      height: 48,
      borderRadius: RADIUS.sm,
      marginRight: SPACING.md,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    stationName: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
      marginBottom: SPACING.xs,
    },
    stationNameEn: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    lineInfo: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    transfers: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginTop: SPACING.xs,
    },
    selectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: SPACING.sm,
    },
  });

export default StationCard;
