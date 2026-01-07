/**
 * RouteComparisonView Component
 * Shows side-by-side comparison of original and alternative routes
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  ArrowDown,
  Clock,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { Route, RouteSegment, getLineName } from '@/models/route';

// ============================================================================
// Types
// ============================================================================

interface RouteComparisonViewProps {
  /** Original route */
  originalRoute: Route;
  /** Alternative route */
  alternativeRoute: Route;
  /** Affected line IDs (delayed) */
  affectedLineIds?: string[];
}

// ============================================================================
// Sub-components
// ============================================================================

interface RouteSegmentItemProps {
  segment: RouteSegment;
  isFirst: boolean;
  isLast: boolean;
  isAffected?: boolean;
}

const RouteSegmentItem: React.FC<RouteSegmentItemProps> = ({
  segment,
  isFirst,
  isLast,
  isAffected = false,
}) => {
  const { colors } = useTheme();
  const lineColor = getSubwayLineColor(segment.lineId);

  return (
    <View style={styles.segmentContainer}>
      {/* Line indicator */}
      <View style={styles.segmentLeft}>
        <View
          style={[
            styles.lineIndicator,
            { backgroundColor: lineColor },
          ]}
        >
          <Text style={styles.lineIndicatorText}>{segment.lineId}</Text>
        </View>
        {!isLast && (
          <View style={[styles.linePath, { backgroundColor: lineColor }]} />
        )}
      </View>

      {/* Segment content */}
      <View style={styles.segmentContent}>
        {isFirst && (
          <View style={styles.stationRow}>
            <View
              style={[styles.stationDot, { backgroundColor: lineColor }]}
            />
            <Text style={[styles.stationName, { color: colors.textPrimary }]}>
              {segment.fromStationName}
            </Text>
            {isAffected && (
              <AlertTriangle size={14} color={colors.error} />
            )}
          </View>
        )}

        {segment.isTransfer ? (
          <View style={styles.transferRow}>
            <ArrowRightLeft size={14} color={colors.textSecondary} />
            <Text style={[styles.transferText, { color: colors.textSecondary }]}>
              {segment.lineName}으로 환승 ({segment.estimatedMinutes}분)
            </Text>
          </View>
        ) : (
          <View style={styles.travelRow}>
            <ArrowDown size={14} color={colors.textSecondary} />
            <Text style={[styles.travelText, { color: colors.textSecondary }]}>
              {segment.estimatedMinutes}분
            </Text>
          </View>
        )}

        <View style={styles.stationRow}>
          <View
            style={[styles.stationDot, { backgroundColor: lineColor }]}
          />
          <Text style={[styles.stationName, { color: colors.textPrimary }]}>
            {segment.toStationName}
          </Text>
          {isAffected && !segment.isTransfer && (
            <AlertTriangle size={14} color={colors.error} />
          )}
        </View>
      </View>
    </View>
  );
};

interface RouteSummaryProps {
  route: Route;
  label: string;
  variant: 'original' | 'alternative';
  isAffected?: boolean;
}

const RouteSummary: React.FC<RouteSummaryProps> = ({
  route,
  label,
  variant,
  isAffected = false,
}) => {
  const { colors } = useTheme();

  const getBorderColor = (): string => {
    if (variant === 'original' && isAffected) {
      return colors.error;
    }
    if (variant === 'alternative') {
      return colors.success;
    }
    return colors.borderMedium;
  };

  return (
    <View
      style={[
        styles.summaryContainer,
        { borderColor: getBorderColor() },
      ]}
    >
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        {variant === 'alternative' && (
          <CheckCircle size={16} color={colors.success} />
        )}
        {variant === 'original' && isAffected && (
          <AlertTriangle size={16} color={colors.error} />
        )}
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStatItem}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>
            {route.totalMinutes}분
          </Text>
        </View>
        <View style={styles.summaryStatItem}>
          <ArrowRightLeft size={16} color={colors.textSecondary} />
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>
            환승 {route.transferCount}회
          </Text>
        </View>
      </View>

      <View style={styles.summaryLines}>
        {route.lineIds.map((lineId, index) => (
          <View
            key={`${lineId}-${index}`}
            style={[
              styles.summaryLineChip,
              { backgroundColor: getSubwayLineColor(lineId) },
            ]}
          >
            <Text style={styles.summaryLineText}>{getLineName(lineId)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const RouteComparisonView: React.FC<RouteComparisonViewProps> = ({
  originalRoute,
  alternativeRoute,
  affectedLineIds = [],
}) => {
  const { colors, isDark } = useTheme();

  // Check if original route is affected
  const originalAffected = originalRoute.lineIds.some(lineId =>
    affectedLineIds.includes(lineId)
  );

  // Time difference
  const timeDiff = alternativeRoute.totalMinutes - originalRoute.totalMinutes;
  const timeDiffText =
    timeDiff === 0
      ? '동일한 소요 시간'
      : timeDiff > 0
      ? `${timeDiff}분 더 소요`
      : `${Math.abs(timeDiff)}분 단축`;

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <RouteSummary
            route={originalRoute}
            label="기존 경로"
            variant="original"
            isAffected={originalAffected}
          />
        </View>
        <View style={styles.summaryCard}>
          <RouteSummary
            route={alternativeRoute}
            label="대체 경로"
            variant="alternative"
          />
        </View>
      </View>

      {/* Time Difference */}
      <View
        style={[
          styles.timeDiffContainer,
          { backgroundColor: isDark ? colors.surface : colors.background },
        ]}
      >
        <Text
          style={[
            styles.timeDiffText,
            {
              color:
                timeDiff <= 0 ? colors.success : colors.warning,
            },
          ]}
        >
          {timeDiffText}
        </Text>
      </View>

      {/* Alternative Route Details */}
      <View
        style={[
          styles.routeDetailContainer,
          { backgroundColor: isDark ? colors.surface : colors.background },
        ]}
      >
        <Text style={[styles.routeDetailTitle, { color: colors.textPrimary }]}>
          대체 경로 상세
        </Text>
        <ScrollView style={styles.segmentsList}>
          {alternativeRoute.segments.map((segment, index) => (
            <RouteSegmentItem
              key={`${segment.fromStationId}-${segment.toStationId}-${index}`}
              segment={segment}
              isFirst={index === 0}
              isLast={index === alternativeRoute.segments.length - 1}
            />
          ))}
        </ScrollView>
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
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
  },
  summaryContainer: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryStatValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  summaryLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  summaryLineChip: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  summaryLineText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  timeDiffContainer: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  timeDiffText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  routeDetailContainer: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  routeDetailTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
    marginBottom: SPACING.md,
  },
  segmentsList: {
    flex: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  segmentLeft: {
    alignItems: 'center',
    width: 36,
  },
  lineIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineIndicatorText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  linePath: {
    width: 3,
    flex: 1,
    marginVertical: 2,
  },
  segmentContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 4,
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  transferText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  travelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  travelText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default RouteComparisonView;
