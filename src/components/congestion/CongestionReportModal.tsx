/**
 * CongestionReportModal Component
 * Modal for submitting congestion reports
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Users,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import {
  CongestionLevel,
  CongestionReportInput,
  getCongestionLevelName,
  getCongestionLevelColor,
  TRAIN_CAR_COUNT,
} from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

interface CongestionReportModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** Called when report is submitted */
  onSubmit: (input: CongestionReportInput) => Promise<void>;
  /** Pre-selected car number */
  initialCarNumber?: number;
  /** Train information */
  trainInfo: {
    trainId: string;
    lineId: string;
    stationId: string;
    stationName: string;
    direction: 'up' | 'down';
  };
  /** Whether submission is in progress */
  submitting?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const CongestionReportModal: React.FC<CongestionReportModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialCarNumber,
  trainInfo,
  submitting = false,
}) => {
  const { colors, isDark } = useTheme();

  // State
  const [selectedCar, setSelectedCar] = useState<number | null>(initialCarNumber || null);
  const [selectedLevel, setSelectedLevel] = useState<CongestionLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedCar(initialCarNumber || null);
      setSelectedLevel(null);
      setError(null);
    }
  }, [visible, initialCarNumber]);

  // Handlers
  const handleSubmit = useCallback(async () => {
    if (!selectedCar || !selectedLevel) {
      setError('객차 번호와 혼잡도를 선택해주세요');
      return;
    }

    try {
      setError(null);
      await onSubmit({
        trainId: trainInfo.trainId,
        lineId: trainInfo.lineId,
        stationId: trainInfo.stationId,
        direction: trainInfo.direction,
        carNumber: selectedCar,
        congestionLevel: selectedLevel,
      });
      onClose();
    } catch (err) {
      setError('제보 중 오류가 발생했습니다');
    }
  }, [selectedCar, selectedLevel, trainInfo, onSubmit, onClose]);

  // Congestion level options
  const levelOptions = [
    {
      level: CongestionLevel.LOW,
      description: '좌석 여유, 서있는 승객 적음',
    },
    {
      level: CongestionLevel.MODERATE,
      description: '좌석 없음, 서있는 승객 있음',
    },
    {
      level: CongestionLevel.HIGH,
      description: '빈 공간 적음, 이동 불편',
    },
    {
      level: CongestionLevel.CROWDED,
      description: '매우 붐빔, 이동 어려움',
    },
  ];

  // Car numbers (1-10)
  const carNumbers = Array.from({ length: TRAIN_CAR_COUNT }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? colors.surface : colors.background },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderMedium }]}>
            <View style={styles.headerLeft}>
              <Users size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                혼잡도 제보
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Train Info */}
            <View style={styles.trainInfo}>
              <Text style={[styles.stationName, { color: colors.textPrimary }]}>
                {trainInfo.stationName}역
              </Text>
              <Text style={[styles.directionLabel, { color: colors.textSecondary }]}>
                {trainInfo.direction === 'up' ? '상행' : '하행'}
              </Text>
            </View>

            {/* Car Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                탑승 객차 선택
              </Text>
              <View style={styles.carGrid}>
                {carNumbers.map(num => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.carButton,
                      {
                        backgroundColor:
                          selectedCar === num
                            ? colors.primary
                            : isDark
                            ? colors.surface
                            : colors.background,
                        borderColor:
                          selectedCar === num
                            ? colors.primary
                            : colors.borderMedium,
                      },
                    ]}
                    onPress={() => setSelectedCar(num)}
                  >
                    <Text
                      style={[
                        styles.carButtonText,
                        {
                          color: selectedCar === num ? '#FFFFFF' : colors.textPrimary,
                        },
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.carHint, { color: colors.textSecondary }]}>
                ← 1호차(앞) ... 10호차(뒤) →
              </Text>
            </View>

            {/* Congestion Level Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                혼잡도 선택
              </Text>
              <View style={styles.levelList}>
                {levelOptions.map(({ level, description }) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelButton,
                      {
                        backgroundColor:
                          selectedLevel === level
                            ? getCongestionLevelColor(level)
                            : isDark
                            ? colors.surface
                            : colors.background,
                        borderColor:
                          selectedLevel === level
                            ? getCongestionLevelColor(level)
                            : colors.borderMedium,
                      },
                    ]}
                    onPress={() => setSelectedLevel(level)}
                  >
                    <View style={styles.levelButtonContent}>
                      <View style={styles.levelButtonLeft}>
                        {selectedLevel !== level && (
                          <View
                            style={[
                              styles.levelIndicator,
                              { backgroundColor: getCongestionLevelColor(level) },
                            ]}
                          />
                        )}
                        <Text
                          style={[
                            styles.levelName,
                            {
                              color:
                                selectedLevel === level ? '#FFFFFF' : colors.textPrimary,
                            },
                          ]}
                        >
                          {getCongestionLevelName(level)}
                        </Text>
                      </View>
                      {selectedLevel === level && (
                        <Check size={18} color="#FFFFFF" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.levelDescription,
                        {
                          color:
                            selectedLevel === level
                              ? 'rgba(255, 255, 255, 0.9)'
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          <View style={[styles.footer, { borderTopColor: colors.borderMedium }]}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    selectedCar && selectedLevel
                      ? colors.primary
                      : colors.borderMedium,
                },
              ]}
              onPress={handleSubmit}
              disabled={!selectedCar || !selectedLevel || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>제보하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
    gap: SPACING.lg,
  },
  trainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  directionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  carButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  carHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  levelList: {
    gap: SPACING.sm,
  },
  levelButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  levelButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  levelIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  levelName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  levelDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
});

export default CongestionReportModal;
