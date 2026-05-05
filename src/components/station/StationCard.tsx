/**
 * StationCard Component
 * Simple, accessible card for displaying station information
 * Used for station search results and selection UI.
 *
 * Phase 48 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System (WANTED_TOKENS + weightToFontFamily +
 * isDark-driven semantic theme).
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
    const styles = useMemo(() => createStyles(semantic), [semantic]);

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

/**
 * Create styles with theme colors
 */
const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      minHeight: 72,
    },
    selected: {
      borderColor: WANTED_TOKENS.blue[500],
      borderWidth: 2,
    },
    lineIndicator: {
      width: 4,
      height: 48,
      borderRadius: WANTED_TOKENS.radius.r4,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s1,
    },
    stationNameEn: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginBottom: WANTED_TOKENS.spacing.s1,
    },
    lineInfo: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    transfers: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    selectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: WANTED_TOKENS.blue[500],
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
  });

export default StationCard;
