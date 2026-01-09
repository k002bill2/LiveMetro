/**
 * Commute Prediction Card Component
 * Displays ML-based commute predictions on the home screen
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  Bell,
  ChevronRight,
  Brain,
  RefreshCw,
} from 'lucide-react-native';

import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useTheme, ThemeColors } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { MIN_LOGS_FOR_ML_TRAINING } from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface CommutePredictionCardProps {
  /** Callback when schedule alert is pressed */
  onScheduleAlert?: () => void;
  /** Callback when view details is pressed */
  onViewDetails?: () => void;
  /** Callback when train model is pressed */
  onTrainModel?: () => void;
  /** Show compact version */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const CommutePredictionCard: React.FC<CommutePredictionCardProps> = ({
  onScheduleAlert,
  onViewDetails,
  onTrainModel,
  compact = false,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors, compact);

  const {
    prediction,
    loading,
    error,
    isModelReady,
    logCount,
    hasEnoughData,
    refreshPrediction,
    trainModel,
    isTraining,
    trainingProgress,
    modelMetadata,
  } = useMLPrediction();

  // Auto-refresh prediction when model is ready
  useEffect(() => {
    if (isModelReady && !prediction && !loading) {
      refreshPrediction();
    }
  }, [isModelReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle train model press
  const handleTrainModel = async (): Promise<void> => {
    if (onTrainModel) {
      onTrainModel();
    } else {
      await trainModel();
    }
  };

  // Render loading state
  if (loading && !prediction) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.textPrimary} />
          <Text style={styles.loadingText}>예측 정보 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  // Render not enough data state
  if (!hasEnoughData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Brain size={20} color={colors.textSecondary} />
          <Text style={styles.title}>출퇴근 패턴 학습</Text>
        </View>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyText}>
            출퇴근 패턴 학습을 위해 더 많은 데이터가 필요합니다
          </Text>
          <Text style={styles.emptySubtext}>
            현재 {logCount}개 / 최소 {MIN_LOGS_FOR_ML_TRAINING}개
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (logCount / MIN_LOGS_FOR_ML_TRAINING) * 100)}%` }
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  // Render error state
  if (error && !prediction) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <AlertTriangle size={20} color={colors.error} />
          <Text style={styles.title}>예측 오류</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refreshPrediction()}
        >
          <RefreshCw size={16} color={colors.textPrimary} />
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render training state
  if (isTraining) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Brain size={20} color={colors.textPrimary} />
          <Text style={styles.title}>모델 학습 중</Text>
        </View>
        <View style={styles.trainingContent}>
          <ActivityIndicator size="small" color={colors.textPrimary} />
          <Text style={styles.trainingText}>
            학습 진행률: {Math.round(trainingProgress * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${trainingProgress * 100}%` }]}
            />
          </View>
        </View>
      </View>
    );
  }

  // Render prediction
  if (!prediction) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Brain size={20} color={colors.textPrimary} />
        <Text style={styles.title}>오늘의 출퇴근 예측</Text>
        {modelMetadata?.isFineTuned && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>맞춤</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Departure Time */}
        <View style={styles.predictionRow}>
          <Clock size={18} color={colors.textSecondary} />
          <Text style={styles.label}>예상 출발</Text>
          <Text style={styles.timeValue}>{prediction.predictedDepartureTime}</Text>
        </View>

        {/* Arrival Time */}
        <View style={styles.predictionRow}>
          <TrendingUp size={18} color={colors.textSecondary} />
          <Text style={styles.label}>예상 도착</Text>
          <Text style={styles.timeValue}>{prediction.predictedArrivalTime}</Text>
        </View>

        {/* Delay Probability */}
        {prediction.delayProbability > 0.1 && (
          <View style={[styles.predictionRow, styles.delayRow]}>
            <AlertTriangle
              size={18}
              color={getDelayColor(prediction.delayProbability, colors)}
            />
            <Text style={styles.label}>지연 가능성</Text>
            <Text
              style={[
                styles.delayValue,
                { color: getDelayColor(prediction.delayProbability, colors) }
              ]}
            >
              {Math.round(prediction.delayProbability * 100)}%
            </Text>
          </View>
        )}

        {/* Confidence Indicator */}
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>신뢰도</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${prediction.confidence * 100}%`,
                  backgroundColor: getConfidenceColor(prediction.confidence, colors),
                }
              ]}
            />
          </View>
          <Text style={styles.confidenceValue}>
            {Math.round(prediction.confidence * 100)}%
          </Text>
        </View>
      </View>

      {/* Actions */}
      {!compact && (
        <View style={styles.actions}>
          {onScheduleAlert && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onScheduleAlert}
              accessibilityRole="button"
              accessibilityLabel="출발 알림 설정"
            >
              <Bell size={16} color={colors.textPrimary} />
              <Text style={styles.actionText}>알림 설정</Text>
            </TouchableOpacity>
          )}

          {hasEnoughData && !modelMetadata?.isFineTuned && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTrainModel}
              accessibilityRole="button"
              accessibilityLabel="모델 학습하기"
            >
              <Brain size={16} color={colors.textPrimary} />
              <Text style={styles.actionText}>학습하기</Text>
            </TouchableOpacity>
          )}

          {onViewDetails && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onViewDetails}
              accessibilityRole="button"
              accessibilityLabel="주간 예측 보기"
            >
              <Text style={styles.actionText}>주간 예측</Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function getDelayColor(probability: number, colors: ThemeColors): string {
  if (probability >= 0.7) return colors.error;
  if (probability >= 0.4) return colors.warning;
  return colors.textSecondary;
}

function getConfidenceColor(confidence: number, colors: ThemeColors): string {
  if (confidence >= 0.7) return colors.success;
  if (confidence >= 0.4) return colors.warning;
  return colors.error;
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors, compact: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: compact ? SPACING.md : SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textPrimary,
      marginLeft: SPACING.sm,
      flex: 1,
    },
    badge: {
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    badgeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: colors.textSecondary,
    },
    content: {
      gap: SPACING.sm,
    },
    predictionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.xs,
    },
    delayRow: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.sm,
      marginTop: SPACING.xs,
    },
    label: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginLeft: SPACING.sm,
      flex: 1,
    },
    timeValue: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
    },
    delayValue: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
    },
    confidenceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    confidenceLabel: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginRight: SPACING.sm,
    },
    confidenceBar: {
      flex: 1,
      height: 4,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    confidenceFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    confidenceValue: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginLeft: SPACING.sm,
      minWidth: 30,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      marginTop: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      gap: SPACING.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
    },
    actionText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: colors.textPrimary,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    loadingText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginLeft: SPACING.sm,
    },
    emptyContent: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    emptyText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    emptySubtext: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginBottom: SPACING.md,
    },
    progressBar: {
      width: '100%',
      height: 6,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.textPrimary,
      borderRadius: RADIUS.full,
    },
    errorText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.error,
      marginBottom: SPACING.md,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
    },
    retryText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textPrimary,
    },
    trainingContent: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
    },
    trainingText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
  });

export default CommutePredictionCard;
