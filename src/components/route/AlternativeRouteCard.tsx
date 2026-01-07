/**
 * AlternativeRouteCard Component
 * Displays an alternative route with comparison to original route
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {
  ArrowRight,
  Clock,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import {
  AlternativeRoute,
  Route,
  formatTimeDifference,
  getTimeDifferenceSeverity,
} from '@/models/route';

// ============================================================================
// Types
// ============================================================================

interface AlternativeRouteCardProps {
  /** Alternative route data */
  alternative: AlternativeRoute;
  /** Called when card is pressed */
  onPress?: () => void;
  /** Show original route comparison */
  showComparison?: boolean;
  /** Card style */
  style?: ViewStyle;
  /** Whether this is the recommended route */
  isRecommended?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

interface LineIndicatorProps {
  lineId: string;
  size?: 'small' | 'medium';
}

const LineIndicator: React.FC<LineIndicatorProps> = ({ lineId, size = 'medium' }) => {
  const lineColor = getSubwayLineColor(lineId);
  const dimensions = size === 'small' ? 20 : 28;

  return (
    <View
      style={[
        styles.lineIndicator,
        {
          backgroundColor: lineColor,
          width: dimensions,
          height: dimensions,
          borderRadius: dimensions / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.lineIndicatorText,
          { fontSize: size === 'small' ? 10 : 12 },
        ]}
      >
        {lineId}
      </Text>
    </View>
  );
};

interface RouteLinePathProps {
  route: Route;
}

const RouteLinePath: React.FC<RouteLinePathProps> = ({ route }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.routePath}>
      {route.lineIds.map((lineId, index) => (
        <React.Fragment key={`${lineId}-${index}`}>
          <LineIndicator lineId={lineId} size="small" />
          {index < route.lineIds.length - 1 && (
            <ArrowRight
              size={12}
              color={colors.textSecondary}
              style={styles.routeArrow}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

interface TimeDifferenceIndicatorProps {
  minutes: number;
}

const TimeDifferenceIndicator: React.FC<TimeDifferenceIndicatorProps> = ({
  minutes,
}) => {
  const { colors } = useTheme();
  const severity = getTimeDifferenceSeverity(minutes);

  const getIndicatorColor = (): string => {
    switch (severity) {
      case 'faster':
        return colors.success;
      case 'same':
        return colors.textSecondary;
      case 'slower':
        return colors.warning;
      case 'much_slower':
        return colors.error;
    }
  };

  const getIcon = (): React.ReactNode => {
    if (minutes < 0) {
      return <TrendingDown size={14} color={getIndicatorColor()} />;
    }
    if (minutes > 0) {
      return <TrendingUp size={14} color={getIndicatorColor()} />;
    }
    return <Minus size={14} color={getIndicatorColor()} />;
  };

  return (
    <View style={styles.timeDifferenceContainer}>
      {getIcon()}
      <Text style={[styles.timeDifferenceText, { color: getIndicatorColor() }]}>
        {formatTimeDifference(minutes)}
      </Text>
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AlternativeRouteCard: React.FC<AlternativeRouteCardProps> = ({
  alternative,
  onPress,
  showComparison = true,
  style,
  isRecommended = false,
}) => {
  const { colors, isDark } = useTheme();
  const { alternativeRoute, originalRoute, timeDifference, reason } = alternative;

  // Get first and last station names
  const firstSegment = alternativeRoute.segments[0];
  const lastSegment = alternativeRoute.segments[alternativeRoute.segments.length - 1];
  const fromStation = firstSegment?.fromStationName || '';
  const toStation = lastSegment?.toStationName || '';

  // Get reason text
  const getReasonText = (): string => {
    switch (reason) {
      case 'DELAY':
        return '지연 우회';
      case 'SUSPENSION':
        return '운행 중단 우회';
      case 'CONGESTION':
        return '혼잡 우회';
      default:
        return '대체 경로';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: isRecommended ? colors.primary : colors.borderMedium,
          borderWidth: isRecommended ? 2 : 1,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isRecommended && (
            <View
              style={[
                styles.recommendedBadge,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.recommendedText}>추천</Text>
            </View>
          )}
          <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
            {getReasonText()}
          </Text>
        </View>
        <TimeDifferenceIndicator minutes={timeDifference} />
      </View>

      {/* Route Line Path */}
      <View style={styles.routePathContainer}>
        <RouteLinePath route={alternativeRoute} />
      </View>

      {/* Route Details */}
      <View style={styles.detailsContainer}>
        {/* Stations */}
        <View style={styles.stationsContainer}>
          <Text style={[styles.stationText, { color: colors.textPrimary }]}>
            {fromStation}
          </Text>
          <ArrowRight size={16} color={colors.textSecondary} />
          <Text style={[styles.stationText, { color: colors.textPrimary }]}>
            {toStation}
          </Text>
        </View>

        {/* Time & Transfers */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textPrimary }]}>
              {alternativeRoute.totalMinutes}분
            </Text>
          </View>
          <View style={styles.statItem}>
            <ArrowRightLeft size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textPrimary }]}>
              환승 {alternativeRoute.transferCount}회
            </Text>
          </View>
        </View>
      </View>

      {/* Comparison (Optional) */}
      {showComparison && (
        <View
          style={[
            styles.comparisonContainer,
            { borderTopColor: colors.borderMedium },
          ]}
        >
          <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>
            기존 경로:
          </Text>
          <View style={styles.comparisonContent}>
            <RouteLinePath route={originalRoute} />
            <Text style={[styles.comparisonTime, { color: colors.textSecondary }]}>
              {originalRoute.totalMinutes}분
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  recommendedBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  reasonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  timeDifferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDifferenceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  routePathContainer: {
    marginBottom: SPACING.sm,
  },
  routePath: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  routeArrow: {
    marginHorizontal: 2,
  },
  lineIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineIndicatorText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  detailsContainer: {
    gap: SPACING.xs,
  },
  stationsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stationText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  comparisonContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  comparisonLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },
  comparisonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default AlternativeRouteCard;
