/**
 * RouteComparisonView Component
 * Shows side-by-side comparison of original and alternative routes.
 *
 * Phase 49 — migrated to Wanted Design System tokens. Status colors
 * (success/warning/error) resolve through WANTED_TOKENS.status palette.
 */

import React, { useMemo } from 'react';
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
  semantic: WantedSemanticTheme;
}

const RouteSegmentItem: React.FC<RouteSegmentItemProps> = ({
  segment,
  isFirst,
  isLast,
  isAffected = false,
  semantic,
}) => {
  const lineColor = getSubwayLineColor(segment.lineId);

  return (
    <View style={sharedStyles.segmentContainer}>
      {/* Line indicator */}
      <View style={sharedStyles.segmentLeft}>
        <View
          style={[
            sharedStyles.lineIndicator,
            { backgroundColor: lineColor },
          ]}
        >
          <Text style={sharedStyles.lineIndicatorText}>{segment.lineId}</Text>
        </View>
        {!isLast && (
          <View style={[sharedStyles.linePath, { backgroundColor: lineColor }]} />
        )}
      </View>

      {/* Segment content */}
      <View style={sharedStyles.segmentContent}>
        {isFirst && (
          <View style={sharedStyles.stationRow}>
            <View
              style={[sharedStyles.stationDot, { backgroundColor: lineColor }]}
            />
            <Text style={[sharedStyles.stationName, { color: semantic.labelStrong }]}>
              {segment.fromStationName}
            </Text>
            {isAffected && (
              <AlertTriangle size={14} color={WANTED_TOKENS.status.red500} />
            )}
          </View>
        )}

        {segment.isTransfer ? (
          <View style={sharedStyles.transferRow}>
            <ArrowRightLeft size={14} color={semantic.labelNeutral} />
            <Text style={[sharedStyles.transferText, { color: semantic.labelNeutral }]}>
              {segment.lineName}으로 환승 ({segment.estimatedMinutes}분)
            </Text>
          </View>
        ) : (
          <View style={sharedStyles.travelRow}>
            <ArrowDown size={14} color={semantic.labelNeutral} />
            <Text style={[sharedStyles.travelText, { color: semantic.labelNeutral }]}>
              {segment.estimatedMinutes}분
            </Text>
          </View>
        )}

        <View style={sharedStyles.stationRow}>
          <View
            style={[sharedStyles.stationDot, { backgroundColor: lineColor }]}
          />
          <Text style={[sharedStyles.stationName, { color: semantic.labelStrong }]}>
            {segment.toStationName}
          </Text>
          {isAffected && !segment.isTransfer && (
            <AlertTriangle size={14} color={WANTED_TOKENS.status.red500} />
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
  semantic: WantedSemanticTheme;
}

const RouteSummary: React.FC<RouteSummaryProps> = ({
  route,
  label,
  variant,
  isAffected = false,
  semantic,
}) => {
  const getBorderColor = (): string => {
    if (variant === 'original' && isAffected) {
      return WANTED_TOKENS.status.red500;
    }
    if (variant === 'alternative') {
      return WANTED_TOKENS.status.green500;
    }
    return semantic.lineNormal;
  };

  return (
    <View
      style={[
        sharedStyles.summaryContainer,
        { borderColor: getBorderColor() },
      ]}
    >
      <View style={sharedStyles.summaryHeader}>
        <Text style={[sharedStyles.summaryLabel, { color: semantic.labelNeutral }]}>
          {label}
        </Text>
        {variant === 'alternative' && (
          <CheckCircle size={16} color={WANTED_TOKENS.status.green500} />
        )}
        {variant === 'original' && isAffected && (
          <AlertTriangle size={16} color={WANTED_TOKENS.status.red500} />
        )}
      </View>

      <View style={sharedStyles.summaryStats}>
        <View style={sharedStyles.summaryStatItem}>
          <Clock size={16} color={semantic.labelNeutral} />
          <Text style={[sharedStyles.summaryStatValue, { color: semantic.labelStrong }]}>
            {route.totalMinutes}분
          </Text>
        </View>
        <View style={sharedStyles.summaryStatItem}>
          <ArrowRightLeft size={16} color={semantic.labelNeutral} />
          <Text style={[sharedStyles.summaryStatValue, { color: semantic.labelStrong }]}>
            환승 {route.transferCount}회
          </Text>
        </View>
      </View>

      <View style={sharedStyles.summaryLines}>
        {route.lineIds.map((lineId, index) => (
          <View
            key={`${lineId}-${index}`}
            style={[
              sharedStyles.summaryLineChip,
              { backgroundColor: getSubwayLineColor(lineId) },
            ]}
          >
            <Text style={sharedStyles.summaryLineText}>{getLineName(lineId)}</Text>
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

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
            semantic={semantic}
          />
        </View>
        <View style={styles.summaryCard}>
          <RouteSummary
            route={alternativeRoute}
            label="대체 경로"
            variant="alternative"
            semantic={semantic}
          />
        </View>
      </View>

      {/* Time Difference */}
      <View style={styles.timeDiffContainer}>
        <Text
          style={[
            styles.timeDiffText,
            {
              color:
                timeDiff <= 0
                  ? WANTED_TOKENS.status.green500
                  : WANTED_TOKENS.status.yellow500,
            },
          ]}
        >
          {timeDiffText}
        </Text>
      </View>

      {/* Alternative Route Details */}
      <View style={styles.routeDetailContainer}>
        <Text style={styles.routeDetailTitle}>
          대체 경로 상세
        </Text>
        <ScrollView style={styles.segmentsList}>
          {alternativeRoute.segments.map((segment, index) => (
            <RouteSegmentItem
              key={`${segment.fromStationId}-${segment.toStationId}-${index}`}
              segment={segment}
              isFirst={index === 0}
              isLast={index === alternativeRoute.segments.length - 1}
              semantic={semantic}
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

const sharedStyles = StyleSheet.create({
  summaryContainer: {
    borderWidth: 2,
    borderRadius: WANTED_TOKENS.radius.r6,
    padding: WANTED_TOKENS.spacing.s2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s1,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
  },
  summaryStats: {
    flexDirection: 'row',
    gap: WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s1,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryStatValue: {
    fontSize: 13,
    fontFamily: weightToFontFamily('600'),
  },
  summaryLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  summaryLineChip: {
    paddingHorizontal: WANTED_TOKENS.spacing.s1,
    paddingVertical: 2,
    borderRadius: WANTED_TOKENS.radius.r2,
  },
  summaryLineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
  },
  segmentContainer: {
    flexDirection: 'row',
    marginBottom: WANTED_TOKENS.spacing.s2,
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
    fontSize: 12,
    fontFamily: weightToFontFamily('700'),
  },
  linePath: {
    width: 3,
    flex: 1,
    marginVertical: 2,
  },
  segmentContent: {
    flex: 1,
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s1,
    paddingVertical: 4,
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stationName: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  transferText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
  },
  travelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  travelText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
  },
});

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    summaryCard: {
      flex: 1,
    },
    timeDiffContainer: {
      backgroundColor: semantic.bgBase,
      padding: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r6,
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    timeDiffText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
    },
    routeDetailContainer: {
      flex: 1,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      padding: WANTED_TOKENS.spacing.s3,
    },
    routeDetailTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    segmentsList: {
      flex: 1,
    },
  });

export default RouteComparisonView;
