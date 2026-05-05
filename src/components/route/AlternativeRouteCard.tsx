/**
 * AlternativeRouteCard Component
 * Displays an alternative route with comparison to original route.
 *
 * Phase 49 — migrated to Wanted Design System tokens.
 */

import React, { useMemo } from 'react';
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { JourneyStrip, type JourneyStripLeg } from '@/components/design';
import {
  AlternativeRoute,
  Route,
  formatTimeDifference,
  getTimeDifferenceSeverity,
} from '@/models/route';

/**
 * Map a domain Route into the JourneyStrip leg sequence.
 */
const routeToLegs = (route: Route): JourneyStripLeg[] => {
  const legs: JourneyStripLeg[] = [];
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i]!;
    const prev = i > 0 ? route.segments[i - 1] : null;
    if (prev && prev.lineId !== seg.lineId) {
      legs.push({ type: 'transfer' });
    }
    legs.push({
      type: 'train',
      lineId: seg.lineId,
      minutes: seg.estimatedMinutes,
    });
  }
  return legs;
};

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
        sharedStyles.lineIndicator,
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
          sharedStyles.lineIndicatorText,
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
  semantic: WantedSemanticTheme;
}

const RouteLinePath: React.FC<RouteLinePathProps> = ({ route, semantic }) => {
  return (
    <View style={sharedStyles.routePath}>
      {route.lineIds.map((lineId, index) => (
        <React.Fragment key={`${lineId}-${index}`}>
          <LineIndicator lineId={lineId} size="small" />
          {index < route.lineIds.length - 1 && (
            <ArrowRight
              size={12}
              color={semantic.labelNeutral}
              style={sharedStyles.routeArrow}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

interface TimeDifferenceIndicatorProps {
  minutes: number;
  semantic: WantedSemanticTheme;
}

const TimeDifferenceIndicator: React.FC<TimeDifferenceIndicatorProps> = ({
  minutes,
  semantic,
}) => {
  const severity = getTimeDifferenceSeverity(minutes);

  const getIndicatorColor = (): string => {
    switch (severity) {
      case 'faster':
        return WANTED_TOKENS.status.green500;
      case 'same':
        return semantic.labelNeutral;
      case 'slower':
        return WANTED_TOKENS.status.yellow500;
      case 'much_slower':
        return WANTED_TOKENS.status.red500;
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
    <View style={sharedStyles.timeDifferenceContainer}>
      {getIcon()}
      <Text style={[sharedStyles.timeDifferenceText, { color: getIndicatorColor() }]}>
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
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
          borderColor: isRecommended ? WANTED_TOKENS.blue[500] : semantic.lineNormal,
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
                { backgroundColor: WANTED_TOKENS.blue[500] },
              ]}
            >
              <Text style={styles.recommendedText}>추천</Text>
            </View>
          )}
          <Text style={styles.reasonText}>
            {getReasonText()}
          </Text>
        </View>
        <TimeDifferenceIndicator minutes={timeDifference} semantic={semantic} />
      </View>

      {/* Visual journey strip */}
      <View style={styles.routePathContainer}>
        {alternativeRoute.segments.length > 0 ? (
          <JourneyStrip legs={routeToLegs(alternativeRoute)} />
        ) : (
          <RouteLinePath route={alternativeRoute} semantic={semantic} />
        )}
      </View>

      {/* Route Details */}
      <View style={styles.detailsContainer}>
        {/* Stations */}
        <View style={styles.stationsContainer}>
          <Text style={styles.stationText}>
            {fromStation}
          </Text>
          <ArrowRight size={16} color={semantic.labelNeutral} />
          <Text style={styles.stationText}>
            {toStation}
          </Text>
        </View>

        {/* Time & Transfers */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Clock size={14} color={semantic.labelNeutral} />
            <Text style={styles.statText}>
              {alternativeRoute.totalMinutes}분
            </Text>
          </View>
          <View style={styles.statItem}>
            <ArrowRightLeft size={14} color={semantic.labelNeutral} />
            <Text style={styles.statText}>
              환승 {alternativeRoute.transferCount}회
            </Text>
          </View>
        </View>
      </View>

      {/* Comparison (Optional) */}
      {showComparison && (
        <View style={styles.comparisonContainer}>
          <Text style={styles.comparisonLabel}>
            기존 경로:
          </Text>
          <View style={styles.comparisonContent}>
            {originalRoute.segments.length > 0 ? (
              <JourneyStrip legs={routeToLegs(originalRoute)} />
            ) : (
              <RouteLinePath route={originalRoute} semantic={semantic} />
            )}
            <Text style={styles.comparisonTime}>
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

// Static (non-theme) styles for sub-components — kept outside createStyles
// because LineIndicator/RouteLinePath are defined at module scope.
const sharedStyles = StyleSheet.create({
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
    fontFamily: weightToFontFamily('700'),
  },
  timeDifferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDifferenceText: {
    fontSize: 13,
    fontFamily: weightToFontFamily('700'),
  },
});

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s3,
      marginVertical: WANTED_TOKENS.spacing.s1,
      ...WANTED_TOKENS.shadow.flat,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    recommendedBadge: {
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    recommendedText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
    },
    reasonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    routePathContainer: {
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    detailsContainer: {
      gap: WANTED_TOKENS.spacing.s1,
    },
    stationsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    stationText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s3,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    comparisonContainer: {
      marginTop: WANTED_TOKENS.spacing.s2,
      paddingTop: WANTED_TOKENS.spacing.s2,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    comparisonLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginBottom: 4,
    },
    comparisonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    comparisonTime: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });

export default AlternativeRouteCard;
