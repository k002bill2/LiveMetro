/**
 * CommuteInsightCard Component
 * Displays commute pattern insights and predictions
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
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Bell,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import {
  CommutePattern,
  PredictedCommute,
  DAY_NAMES_SHORT_KO,
} from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

interface CommuteInsightCardProps {
  /** Today's prediction */
  prediction?: PredictedCommute | null;
  /** Pattern for context */
  pattern?: CommutePattern | null;
  /** Has delay alerts */
  hasDelays?: boolean;
  /** Affected lines if delayed */
  affectedLines?: string[];
  /** Called when card is pressed */
  onPress?: () => void;
  /** Called when notification button is pressed */
  onNotificationPress?: () => void;
  /** Style overrides */
  style?: ViewStyle;
}

interface PatternSummaryCardProps {
  /** All patterns */
  patterns: CommutePattern[];
  /** Called when card is pressed */
  onPress?: () => void;
  /** Style overrides */
  style?: ViewStyle;
}

// ============================================================================
// CommuteInsightCard Component
// ============================================================================

export const CommuteInsightCard: React.FC<CommuteInsightCardProps> = ({
  prediction,
  pattern,
  hasDelays = false,
  affectedLines = [],
  onPress,
  onNotificationPress,
  style,
}) => {
  const { colors, isDark } = useTheme();

  if (!prediction && !pattern) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? colors.surface : colors.background,
            borderColor: colors.borderMedium,
          },
          style,
        ]}
      >
        <View style={styles.emptyContainer}>
          <Calendar size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            출퇴근 패턴을 분석하려면{'\n'}더 많은 기록이 필요합니다
          </Text>
        </View>
      </View>
    );
  }

  const displayPrediction = prediction;
  const route = displayPrediction?.route || pattern?.frequentRoute;
  const confidence = displayPrediction?.confidence || pattern?.confidence || 0;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: hasDelays ? colors.error : colors.borderMedium,
          borderWidth: hasDelays ? 2 : 1,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TrendingUp size={18} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            오늘의 출근 예측
          </Text>
        </View>
        {onNotificationPress && (
          <TouchableOpacity
            style={[styles.notificationButton, { backgroundColor: colors.primaryLight }]}
            onPress={onNotificationPress}
          >
            <Bell size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Delay Alert */}
      {hasDelays && affectedLines.length > 0 && (
        <View style={[styles.delayAlert, { backgroundColor: colors.errorLight }]}>
          <AlertTriangle size={14} color={colors.error} />
          <Text style={[styles.delayText, { color: colors.error }]}>
            {affectedLines.map(l => `${l}호선`).join(', ')} 지연 발생
          </Text>
        </View>
      )}

      {/* Route */}
      {route && (
        <View style={styles.routeContainer}>
          <View style={styles.stationContainer}>
            <Text style={[styles.stationName, { color: colors.textPrimary }]}>
              {route.departureStationName}
            </Text>
          </View>
          <ArrowRight size={16} color={colors.textSecondary} />
          <View style={styles.stationContainer}>
            <Text style={[styles.stationName, { color: colors.textPrimary }]}>
              {route.arrivalStationName}
            </Text>
          </View>
        </View>
      )}

      {/* Line indicators */}
      {route && route.lineIds.length > 0 && (
        <View style={styles.linesContainer}>
          {route.lineIds.map((lineId, index) => (
            <React.Fragment key={lineId}>
              <View
                style={[
                  styles.lineChip,
                  { backgroundColor: getSubwayLineColor(lineId) },
                ]}
              >
                <Text style={styles.lineChipText}>{lineId}호선</Text>
              </View>
              {index < route.lineIds.length - 1 && (
                <ArrowRight size={12} color={colors.textSecondary} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Time prediction */}
      {displayPrediction && (
        <View style={styles.timeContainer}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={[styles.timeText, { color: colors.textPrimary }]}>
            예상 출발: {displayPrediction.predictedDepartureTime}
          </Text>
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  confidence >= 0.7
                    ? colors.successLight
                    : confidence >= 0.5
                    ? colors.warningLight
                    : colors.borderMedium,
              },
            ]}
          >
            <Text
              style={[
                styles.confidenceText,
                {
                  color:
                    confidence >= 0.7
                      ? colors.success
                      : confidence >= 0.5
                      ? colors.warning
                      : colors.textSecondary,
                },
              ]}
            >
              {Math.round(confidence * 100)}% 신뢰도
            </Text>
          </View>
        </View>
      )}

      {/* Alert suggestion */}
      {displayPrediction?.suggestedAlertTime && (
        <View style={[styles.alertSuggestion, { backgroundColor: colors.primaryLight }]}>
          <Bell size={14} color={colors.primary} />
          <Text style={[styles.alertSuggestionText, { color: colors.primary }]}>
            {displayPrediction.suggestedAlertTime}에 알림을 받으세요
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================================================
// PatternSummaryCard Component
// ============================================================================

export const PatternSummaryCard: React.FC<PatternSummaryCardProps> = ({
  patterns,
  onPress,
  style,
}) => {
  const { colors, isDark } = useTheme();

  if (patterns.length === 0) {
    return null;
  }

  // Get weekday patterns
  const weekdayPatterns = patterns.filter(p => p.dayOfWeek >= 1 && p.dayOfWeek <= 5);
  const avgConfidence =
    weekdayPatterns.reduce((sum, p) => sum + p.confidence, 0) / weekdayPatterns.length;

  return (
    <TouchableOpacity
      style={[
        styles.summaryContainer,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: colors.borderMedium,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.summaryHeader}>
        <Calendar size={18} color={colors.primary} />
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
          주간 출퇴근 패턴
        </Text>
      </View>

      <View style={styles.weekGrid}>
        {[1, 2, 3, 4, 5].map((day) => {
          const pattern = patterns.find(p => p.dayOfWeek === day);
          const hasPattern = !!pattern;

          return (
            <View
              key={day}
              style={[
                styles.dayCell,
                {
                  backgroundColor: hasPattern ? colors.primaryLight : colors.borderMedium,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: hasPattern ? colors.primary : colors.textSecondary },
                ]}
              >
                {DAY_NAMES_SHORT_KO[day as keyof typeof DAY_NAMES_SHORT_KO]}
              </Text>
              {pattern && (
                <Text
                  style={[
                    styles.dayTime,
                    { color: hasPattern ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {pattern.avgDepartureTime}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={[styles.summaryFooter, { color: colors.textSecondary }]}>
        평균 신뢰도: {Math.round(avgConfidence * 100)}% • {weekdayPatterns.length}일 패턴
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
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
  notificationButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  delayAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  delayText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stationContainer: {
    flex: 1,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  linesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  lineChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  lineChipText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  confidenceBadge: {
    marginLeft: 'auto',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  confidenceText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  alertSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  alertSuggestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  // Summary card styles
  summaryContainer: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  summaryTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  dayLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  dayTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  summaryFooter: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
});

export default CommuteInsightCard;
