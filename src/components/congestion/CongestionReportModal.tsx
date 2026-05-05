/**
 * CongestionReportModal Component
 * Modal for submitting congestion reports.
 *
 * Phase 51 — migrated to Wanted Design System tokens.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import {
  CongestionLevel,
  CongestionReportInput,
  getCongestionLevelName,
  getCongestionLevelColor,
  TRAIN_CAR_COUNT,
} from '@/models/congestion';

interface CongestionReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CongestionReportInput) => Promise<void>;
  initialCarNumber?: number;
  trainInfo: {
    trainId: string;
    lineId: string;
    stationId: string;
    stationName: string;
    direction: 'up' | 'down';
  };
  submitting?: boolean;
}

export const CongestionReportModal: React.FC<CongestionReportModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialCarNumber,
  trainInfo,
  submitting = false,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [selectedCar, setSelectedCar] = useState<number | null>(initialCarNumber || null);
  const [selectedLevel, setSelectedLevel] = useState<CongestionLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setSelectedCar(initialCarNumber || null);
      setSelectedLevel(null);
      setError(null);
    }
  }, [visible, initialCarNumber]);

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

  const levelOptions = [
    { level: CongestionLevel.LOW, description: '좌석 여유, 서있는 승객 적음' },
    { level: CongestionLevel.MODERATE, description: '좌석 없음, 서있는 승객 있음' },
    { level: CongestionLevel.HIGH, description: '빈 공간 적음, 이동 불편' },
    { level: CongestionLevel.CROWDED, description: '매우 붐빔, 이동 어려움' },
  ];

  const carNumbers = Array.from({ length: TRAIN_CAR_COUNT }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Users size={20} color={WANTED_TOKENS.blue[500]} />
              <Text style={styles.headerTitle}>혼잡도 제보</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={semantic.labelNeutral} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.trainInfo}>
              <Text style={styles.stationName}>{trainInfo.stationName}역</Text>
              <Text style={styles.directionLabel}>
                {trainInfo.direction === 'up' ? '상행' : '하행'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>탑승 객차 선택</Text>
              <View style={styles.carGrid}>
                {carNumbers.map(num => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.carButton,
                      {
                        backgroundColor: selectedCar === num ? WANTED_TOKENS.blue[500] : semantic.bgBase,
                        borderColor: selectedCar === num ? WANTED_TOKENS.blue[500] : semantic.lineNormal,
                      },
                    ]}
                    onPress={() => setSelectedCar(num)}
                  >
                    <Text
                      style={[
                        styles.carButtonText,
                        { color: selectedCar === num ? '#FFFFFF' : semantic.labelStrong },
                      ]}
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.carHint}>← 1호차(앞) ... 10호차(뒤) →</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>혼잡도 선택</Text>
              <View style={styles.levelList}>
                {levelOptions.map(({ level, description }) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelButton,
                      {
                        backgroundColor:
                          selectedLevel === level ? getCongestionLevelColor(level) : semantic.bgBase,
                        borderColor:
                          selectedLevel === level ? getCongestionLevelColor(level) : semantic.lineNormal,
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
                            { color: selectedLevel === level ? '#FFFFFF' : semantic.labelStrong },
                          ]}
                        >
                          {getCongestionLevelName(level)}
                        </Text>
                      </View>
                      {selectedLevel === level && <Check size={18} color="#FFFFFF" />}
                    </View>
                    <Text
                      style={[
                        styles.levelDescription,
                        {
                          color:
                            selectedLevel === level
                              ? 'rgba(255, 255, 255, 0.9)'
                              : semantic.labelNeutral,
                        },
                      ]}
                    >
                      {description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color={WANTED_TOKENS.status.red500} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    selectedCar && selectedLevel ? WANTED_TOKENS.blue[500] : semantic.lineNormal,
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

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: semantic.bgBase,
      borderTopLeftRadius: WANTED_TOKENS.radius.r10,
      borderTopRightRadius: WANTED_TOKENS.radius.r10,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s4,
    },
    trainInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    directionLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    section: {
      gap: WANTED_TOKENS.spacing.s2,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    carGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s1,
    },
    carButton: {
      width: '18%',
      aspectRatio: 1,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    carButtonText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
    },
    carHint: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
    levelList: {
      gap: WANTED_TOKENS.spacing.s2,
    },
    levelButton: {
      padding: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r6,
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
      gap: WANTED_TOKENS.spacing.s2,
    },
    levelIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    levelName: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
    },
    levelDescription: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    errorText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.status.red500,
    },
    footer: {
      padding: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    submitButton: {
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r6,
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
    },
  });

export default CongestionReportModal;
