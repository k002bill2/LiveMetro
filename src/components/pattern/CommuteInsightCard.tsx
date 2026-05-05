/**
 * CommuteInsightCard Component
 * Displays commute pattern insights and predictions.
 *
 * Phase 50 — migrated to Wanted Design System tokens. Confidence/delay
 * status colors resolve through WANTED_TOKENS.status palette + translucent
 * tints (Phase 45.1 dark-mode pattern).
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
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Bell,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
  prediction?: PredictedCommute | null;
  pattern?: CommutePattern | null;
  hasDelays?: boolean;
  affectedLines?: string[];
  onPress?: () => void;
  onNotificationPress?: () => void;
  style?: ViewStyle;
}

interface PatternSummaryCardProps {
  patterns: CommutePattern[];
  onPress?: () => void;
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  if (!prediction && !pattern) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyContainer}>
          <Calendar size={32} color={semantic.labelNeutral} />
          <Text style={styles.emptyText}>
            출퇴근 패턴을 분석하려면{'\n'}더 많은 기록이 필요합니다
          </Text>
        </View>
      </View>
    );
  }

  const displayPrediction = prediction;
  const route = displayPrediction?.route || pattern?.frequentRoute;
  const confidence = displayPrediction?.confidence || pattern?.confidence || 0;

  // Confidence tier mapping
  const confidenceColor =
    confidence >= 0.7
      ? WANTED_TOKENS.status.green500
      : confidence >= 0.5
        ? WANTED_TOKENS.status.yellow500
        : semantic.labelNeutral;
  const confidenceBg =
    confidence >= 0.7
      ? 'rgba(0,191,64,0.10)'
      : confidence >= 0.5
        ? 'rgba(255,180,0,0.10)'
        : semantic.bgSubtle;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          borderColor: hasDelays ? WANTED_TOKENS.status.red500 : semantic.lineNormal,
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
          <TrendingUp size={18} color={WANTED_TOKENS.blue[500]} />
          <Text style={styles.headerTitle}>
            오늘의 출근 예측
          </Text>
        </View>
        {onNotificationPress && (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationPress}
          >
            <Bell size={16} color={WANTED_TOKENS.blue[500]} />
          </TouchableOpacity>
        )}
      </View>

      {/* Delay Alert */}
      {hasDelays && affectedLines.length > 0 && (
        <View style={styles.delayAlert}>
          <AlertTriangle size={14} color={WANTED_TOKENS.status.red500} />
          <Text style={styles.delayText}>
            {affectedLines.map(l => `${l}호선`).join(', ')} 지연 발생
          </Text>
        </View>
      )}

      {/* Route */}
      {route && (
        <View style={styles.routeContainer}>
          <View style={styles.stationContainer}>
            <Text style={styles.stationName}>
              {route.departureStationName}
            </Text>
          </View>
          <ArrowRight size={16} color={semantic.labelNeutral} />
          <View style={styles.stationContainer}>
            <Text style={styles.stationName}>
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
                <ArrowRight size={12} color={semantic.labelNeutral} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Time prediction */}
      {displayPrediction && (
        <View style={styles.timeContainer}>
          <Clock size={16} color={semantic.labelNeutral} />
          <Text style={styles.timeText}>
            예상 출발: {displayPrediction.predictedDepartureTime}
          </Text>
          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: confidenceBg },
            ]}
          >
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {Math.round(confidence * 100)}% 신뢰도
            </Text>
          </View>
        </View>
      )}

      {/* Alert suggestion */}
      {displayPrediction?.suggestedAlertTime && (
        <View style={styles.alertSuggestion}>
          <Bell size={14} color={WANTED_TOKENS.blue[500]} />
          <Text style={styles.alertSuggestionText}>
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  if (patterns.length === 0) {
    return null;
  }

  // Get weekday patterns
  const weekdayPatterns = patterns.filter(p => p.dayOfWeek >= 1 && p.dayOfWeek <= 5);
  const avgConfidence =
    weekdayPatterns.reduce((sum, p) => sum + p.confidence, 0) / weekdayPatterns.length;

  return (
    <TouchableOpacity
      style={[styles.summaryContainer, style]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.summaryHeader}>
        <Calendar size={18} color={WANTED_TOKENS.blue[500]} />
        <Text style={styles.summaryTitle}>
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
                  backgroundColor: hasPattern ? 'rgba(0,102,255,0.10)' : semantic.bgSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: hasPattern ? WANTED_TOKENS.blue[500] : semantic.labelNeutral },
                ]}
              >
                {DAY_NAMES_SHORT_KO[day as keyof typeof DAY_NAMES_SHORT_KO]}
              </Text>
              {pattern && (
                <Text
                  style={[
                    styles.dayTime,
                    { color: hasPattern ? WANTED_TOKENS.blue[500] : semantic.labelNeutral },
                  ]}
                >
                  {pattern.avgDepartureTime}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.summaryFooter}>
        평균 신뢰도: {Math.round(avgConfidence * 100)}% • {weekdayPatterns.length}일 패턴
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      padding: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
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
      gap: WANTED_TOKENS.spacing.s1,
    },
    headerTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    notificationButton: {
      padding: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: 'rgba(0,102,255,0.10)',
    },
    delayAlert: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
      padding: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: 'rgba(255,66,66,0.10)',
    },
    delayText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.status.red500,
    },
    routeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    stationContainer: {
      flex: 1,
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    linesContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
      flexWrap: 'wrap',
    },
    lineChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 4,
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    lineChipText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: weightToFontFamily('600'),
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    timeText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    confidenceBadge: {
      marginLeft: 'auto',
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    confidenceText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
    },
    alertSuggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
      padding: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: 'rgba(0,102,255,0.10)',
    },
    alertSuggestionText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.blue[500],
    },
    summaryContainer: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      padding: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    summaryTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    weekGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: WANTED_TOKENS.spacing.s1,
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      gap: 2,
    },
    dayLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
    },
    dayTime: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
    },
    summaryFooter: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
  });

export default CommuteInsightCard;
