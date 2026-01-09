/**
 * Weekly Prediction Screen
 * Shows ML-based commute predictions for each day of the week
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  ChevronLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Brain,
} from 'lucide-react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useTheme, ThemeColors } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { MLPrediction } from '@/models/ml';
import { DayOfWeek } from '@/models/pattern';
import { AppStackParamList } from '@/navigation/types';

// ============================================================================
// Types
// ============================================================================

interface DayPrediction {
  date: Date;
  dayOfWeek: DayOfWeek;
  dayName: string;
  prediction: MLPrediction | null;
}

// ============================================================================
// Constants
// ============================================================================

// DayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const DAY_NAMES: Record<DayOfWeek, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

// ============================================================================
// Component
// ============================================================================

export const WeeklyPredictionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { getWeekPredictions, isModelReady, modelMetadata, trainModel, isTraining, hasEnoughData } =
    useMLPrediction();

  const [weekPredictions, setWeekPredictions] = useState<DayPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get day of week from date (0 = Sunday, 6 = Saturday)
  const getDayOfWeekFromDate = (date: Date): DayOfWeek => {
    return date.getDay() as DayOfWeek;
  };

  // Load predictions
  const loadPredictions = useCallback(async (): Promise<void> => {
    try {
      const predictions = await getWeekPredictions();
      const today = new Date();

      const dayPredictions: DayPrediction[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayOfWeek = getDayOfWeekFromDate(date);

        dayPredictions.push({
          date,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          prediction: predictions[i] || null,
        });
      }

      setWeekPredictions(dayPredictions);
    } finally {
      setLoading(false);
    }
  }, [getWeekPredictions]);

  // Initial load
  useEffect(() => {
    if (isModelReady) {
      loadPredictions();
    }
  }, [isModelReady, loadPredictions]);

  // Refresh handler
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadPredictions();
    setRefreshing(false);
  };

  // Handle train model
  const handleTrainModel = async (): Promise<void> => {
    await trainModel();
    await loadPredictions();
  };

  // Format date
  const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Check if date is weekend (0 = Sunday, 6 = Saturday)
  const isWeekend = (dayOfWeek: DayOfWeek): boolean => {
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // Render prediction card
  const renderPredictionCard = (item: DayPrediction): React.ReactNode => {
    const { date, dayName, prediction } = item;
    const today = isToday(date);
    const weekend = isWeekend(item.dayOfWeek);

    return (
      <View
        key={item.date.toISOString()}
        style={[
          styles.card,
          today && styles.todayCard,
          weekend && styles.weekendCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Text style={[styles.dayName, today && styles.todayText]}>
              {dayName}
            </Text>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </View>
          {today && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>오늘</Text>
            </View>
          )}
        </View>

        {prediction ? (
          <View style={styles.predictionContent}>
            <View style={styles.timeRow}>
              <Clock size={16} color={colors.textSecondary} />
              <Text style={styles.timeLabel}>출발</Text>
              <Text style={styles.timeValue}>
                {prediction.predictedDepartureTime}
              </Text>
            </View>
            <View style={styles.timeRow}>
              <Clock size={16} color={colors.textSecondary} />
              <Text style={styles.timeLabel}>도착</Text>
              <Text style={styles.timeValue}>
                {prediction.predictedArrivalTime}
              </Text>
            </View>

            {prediction.delayProbability > 0.1 && (
              <View style={styles.delayRow}>
                <AlertTriangle
                  size={14}
                  color={
                    prediction.delayProbability >= 0.5
                      ? colors.error
                      : colors.warning
                  }
                />
                <Text
                  style={[
                    styles.delayText,
                    {
                      color:
                        prediction.delayProbability >= 0.5
                          ? colors.error
                          : colors.warning,
                    },
                  ]}
                >
                  지연 가능성 {Math.round(prediction.delayProbability * 100)}%
                </Text>
              </View>
            )}

            <View style={styles.confidenceRow}>
              {prediction.confidence >= 0.5 ? (
                <CheckCircle size={12} color={colors.success} />
              ) : (
                <XCircle size={12} color={colors.warning} />
              )}
              <Text style={styles.confidenceText}>
                신뢰도 {Math.round(prediction.confidence * 100)}%
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noPrediction}>
            <Text style={styles.noPredictionText}>
              {weekend ? '주말 예측 데이터 없음' : '예측 데이터 없음'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>주간 출퇴근 예측</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Model Info */}
      <View style={styles.modelInfo}>
        <Brain size={16} color={colors.textSecondary} />
        <Text style={styles.modelInfoText}>
          {modelMetadata?.isFineTuned
            ? `맞춤 학습 완료 (정확도: ${Math.round((modelMetadata.accuracy || 0) * 100)}%)`
            : '기본 모델 사용 중'}
        </Text>
        {hasEnoughData && !modelMetadata?.isFineTuned && !isTraining && (
          <TouchableOpacity
            style={styles.trainButton}
            onPress={handleTrainModel}
          >
            <Text style={styles.trainButtonText}>학습하기</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Predictions List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textPrimary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>예측 정보 불러오는 중...</Text>
          </View>
        ) : (
          weekPredictions.map(renderPredictionCard)
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>범례</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>높은 신뢰도 (50% 이상)</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>낮은 신뢰도 / 지연 가능성</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>높은 지연 가능성 (50% 이상)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    backButton: {
      padding: SPACING.xs,
    },
    headerTitle: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 32,
    },
    modelInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      backgroundColor: colors.backgroundSecondary,
      gap: SPACING.sm,
    },
    modelInfoText: {
      flex: 1,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    trainButton: {
      backgroundColor: colors.textPrimary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
    },
    trainButtonText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: colors.surface,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: SPACING['2xl'],
    },
    loadingText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    todayCard: {
      borderColor: colors.textPrimary,
      borderWidth: 2,
    },
    weekendCard: {
      opacity: 0.7,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: SPACING.sm,
    },
    dayName: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textPrimary,
    },
    todayText: {
      fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
    dateText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    todayBadge: {
      backgroundColor: colors.textPrimary,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    todayBadgeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: colors.surface,
    },
    predictionContent: {
      gap: SPACING.xs,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    timeLabel: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      flex: 1,
    },
    timeValue: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
    },
    delayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.md,
    },
    delayText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    },
    confidenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    confidenceText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
    noPrediction: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    noPredictionText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
    },
    legend: {
      marginTop: SPACING.lg,
      padding: SPACING.md,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.md,
      gap: SPACING.sm,
    },
    legendTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
  });

export default WeeklyPredictionScreen;
