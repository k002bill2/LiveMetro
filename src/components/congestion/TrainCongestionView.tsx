/**
 * TrainCongestionView Component
 * Shows a visual representation of congestion levels for each train car
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Users, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import {
  CongestionLevel,
  CarCongestion,
  TrainCongestionSummary,
  getCongestionLevelName,
  getCongestionLevelColor,
  MIN_REPORTS_FOR_RELIABILITY,
  createEmptyCarCongestions,
} from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

interface TrainCongestionViewProps {
  /** Congestion summary data */
  congestion: TrainCongestionSummary | null;
  /** Called when a car is pressed */
  onCarPress?: (carNumber: number) => void;
  /** Style overrides */
  style?: ViewStyle;
  /** Show legend */
  showLegend?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface CarIndicatorProps {
  car: CarCongestion;
  onPress?: () => void;
  compact?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

const CarIndicator: React.FC<CarIndicatorProps> = ({ car, onPress, compact = false }) => {
  const { colors } = useTheme();
  const congestionColor = getCongestionLevelColor(car.congestionLevel);
  const hasReports = car.reportCount > 0;
  const isReliable = car.reportCount >= MIN_REPORTS_FOR_RELIABILITY;

  const content = (
    <View
      style={[
        styles.carContainer,
        compact && styles.carContainerCompact,
        {
          backgroundColor: hasReports ? congestionColor : colors.surface,
          borderColor: hasReports ? congestionColor : colors.borderMedium,
          opacity: isReliable ? 1 : hasReports ? 0.7 : 0.4,
        },
      ]}
    >
      <Text
        style={[
          styles.carNumber,
          compact && styles.carNumberCompact,
          { color: hasReports ? '#FFFFFF' : colors.textSecondary },
        ]}
      >
        {car.carNumber}
      </Text>
      {!compact && hasReports && (
        <Text
          style={[
            styles.reportCount,
            { color: 'rgba(255, 255, 255, 0.8)' },
          ]}
        >
          {car.reportCount}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const CongestionLegend: React.FC = () => {
  const { colors } = useTheme();

  const levels = [
    { level: CongestionLevel.LOW, name: getCongestionLevelName(CongestionLevel.LOW) },
    { level: CongestionLevel.MODERATE, name: getCongestionLevelName(CongestionLevel.MODERATE) },
    { level: CongestionLevel.HIGH, name: getCongestionLevelName(CongestionLevel.HIGH) },
    { level: CongestionLevel.CROWDED, name: getCongestionLevelName(CongestionLevel.CROWDED) },
  ];

  return (
    <View style={styles.legendContainer}>
      {levels.map(({ level, name }) => (
        <View key={level} style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: getCongestionLevelColor(level) },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TrainCongestionView: React.FC<TrainCongestionViewProps> = ({
  congestion,
  onCarPress,
  style,
  showLegend = true,
  compact = false,
}) => {
  const { colors, isDark } = useTheme();

  // Use empty cars if no congestion data
  const cars = congestion?.cars || createEmptyCarCongestions();
  const overallLevel = congestion?.overallLevel || CongestionLevel.LOW;
  const totalReports = congestion?.reportCount || 0;
  const hasData = totalReports > 0;

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {congestion?.overallLevel === CongestionLevel.CROWDED ? (
            <AlertTriangle size={18} color={getCongestionLevelColor(overallLevel)} />
          ) : (
            <Users size={18} color={colors.textSecondary} />
          )}
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            객차별 혼잡도
          </Text>
        </View>
        {hasData && (
          <View
            style={[
              styles.overallBadge,
              { backgroundColor: getCongestionLevelColor(overallLevel) },
            ]}
          >
            <Text style={styles.overallText}>
              {getCongestionLevelName(overallLevel)}
            </Text>
          </View>
        )}
      </View>

      {/* Train Cars Visualization */}
      <View
        style={[
          styles.trainContainer,
          { backgroundColor: isDark ? colors.surface : colors.background },
        ]}
      >
        {/* Direction indicators */}
        <View style={styles.directionContainer}>
          <Text style={[styles.directionText, { color: colors.textSecondary }]}>
            ← 앞
          </Text>
          <View style={styles.carsWrapper}>
            {cars.map((car) => (
              <CarIndicator
                key={car.carNumber}
                car={car}
                onPress={onCarPress ? () => onCarPress(car.carNumber) : undefined}
                compact={compact}
              />
            ))}
          </View>
          <Text style={[styles.directionText, { color: colors.textSecondary }]}>
            뒤 →
          </Text>
        </View>

        {/* No data message */}
        {!hasData && (
          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
            아직 제보된 혼잡도 정보가 없습니다
          </Text>
        )}

        {/* Report count */}
        {hasData && (
          <Text style={[styles.reportCountText, { color: colors.textSecondary }]}>
            {totalReports}건의 제보 기반
          </Text>
        )}
      </View>

      {/* Legend */}
      {showLegend && <CongestionLegend />}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  overallBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  overallText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  trainContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  directionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  directionText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    minWidth: 24,
  },
  carsWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  carContainer: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
    maxHeight: 56,
  },
  carContainerCompact: {
    aspectRatio: 1,
    minHeight: 28,
    maxHeight: 36,
  },
  carNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  carNumberCompact: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  reportCount: {
    fontSize: 8,
    marginTop: 2,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  reportCountText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default TrainCongestionView;
