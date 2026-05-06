/**
 * Commute Prediction Card Component
 * Displays ML-based commute predictions on the home screen.
 *
 * Phase 50 — migrated to Wanted Design System tokens. Delay/confidence
 * tier colors resolve through WANTED_TOKENS.status palette.
 */

import React, { useEffect, useMemo } from 'react';
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
import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic, compact), [semantic, compact]);

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
          <ActivityIndicator size="small" color={semantic.labelStrong} />
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
          <Brain size={20} color={semantic.labelNeutral} />
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
          <AlertTriangle size={20} color={WANTED_TOKENS.status.red500} />
          <Text style={styles.title}>예측 오류</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refreshPrediction()}
        >
          <RefreshCw size={16} color={semantic.labelStrong} />
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
          <Brain size={20} color={semantic.labelStrong} />
          <Text style={styles.title}>모델 학습 중</Text>
        </View>
        <View style={styles.trainingContent}>
          <ActivityIndicator size="small" color={semantic.labelStrong} />
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
        <Brain size={20} color={semantic.labelStrong} />
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
          <Clock size={18} color={semantic.labelNeutral} />
          <Text style={styles.label}>예상 출발</Text>
          <Text style={styles.timeValue}>{prediction.predictedDepartureTime}</Text>
        </View>

        {/* Arrival Time */}
        <View style={styles.predictionRow}>
          <TrendingUp size={18} color={semantic.labelNeutral} />
          <Text style={styles.label}>예상 도착</Text>
          <Text style={styles.timeValue}>{prediction.predictedArrivalTime}</Text>
        </View>

        {/* Delay Probability */}
        {prediction.delayProbability > 0.1 && (
          <View style={[styles.predictionRow, styles.delayRow]}>
            <AlertTriangle
              size={18}
              color={getDelayColor(prediction.delayProbability, semantic)}
            />
            <Text style={styles.label}>지연 가능성</Text>
            <Text
              style={[
                styles.delayValue,
                { color: getDelayColor(prediction.delayProbability, semantic) }
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
                  backgroundColor: getConfidenceColor(prediction.confidence),
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
              <Bell size={16} color={semantic.labelStrong} />
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
              <Brain size={16} color={semantic.labelStrong} />
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
              <ChevronRight size={16} color={semantic.labelNeutral} />
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

function getDelayColor(probability: number, semantic: WantedSemanticTheme): string {
  if (probability >= 0.7) return WANTED_TOKENS.status.red500;
  if (probability >= 0.4) return WANTED_TOKENS.status.yellow500;
  return semantic.labelNeutral;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return WANTED_TOKENS.status.green500;
  if (confidence >= 0.4) return WANTED_TOKENS.status.yellow500;
  return WANTED_TOKENS.status.red500;
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme, compact: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: compact ? WANTED_TOKENS.spacing.s3 : WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    title: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginLeft: WANTED_TOKENS.spacing.s2,
      flex: 1,
    },
    badge: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    content: {
      gap: WANTED_TOKENS.spacing.s2,
    },
    predictionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s1,
    },
    delayRow: {
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    label: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginLeft: WANTED_TOKENS.spacing.s2,
      flex: 1,
    },
    timeValue: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    delayValue: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
    },
    confidenceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: WANTED_TOKENS.spacing.s2,
      paddingTop: WANTED_TOKENS.spacing.s2,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    confidenceLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    confidenceBar: {
      flex: 1,
      height: 4,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      overflow: 'hidden',
    },
    confidenceFill: {
      height: '100%',
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    confidenceValue: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginLeft: WANTED_TOKENS.spacing.s2,
      minWidth: 30,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      marginTop: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      gap: WANTED_TOKENS.spacing.s2,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      gap: WANTED_TOKENS.spacing.s1,
    },
    actionText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: WANTED_TOKENS.spacing.s4,
    },
    loadingText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    emptyContent: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
      marginBottom: WANTED_TOKENS.spacing.s1,
    },
    emptySubtext: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    progressBar: {
      width: '100%',
      height: 6,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: WANTED_TOKENS.blue[500],
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    errorText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.status.red500,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      gap: WANTED_TOKENS.spacing.s1,
    },
    retryText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    trainingContent: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    trainingText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
  });

export default CommutePredictionCard;
