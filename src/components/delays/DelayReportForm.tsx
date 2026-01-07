/**
 * Delay Report Form Component
 * 실시간 지연 제보 입력 폼
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  AlertTriangle,
  Users,
  Radio,
  OctagonX,
  HelpCircle,
  Send,
  X,
} from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme, ThemeColors } from '@/services/theme';
import { delayReportService } from '@/services/delay/delayReportService';
import {
  ReportType,
  ReportTypeLabels,
  ReportSeverity,
  getReportTypeEmoji,
} from '@/models/delayReport';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';

interface DelayReportFormProps {
  /** Pre-selected line ID */
  lineId?: string;
  /** Pre-selected station */
  stationId?: string;
  stationName?: string;
  /** Called when report is submitted successfully */
  onSubmitSuccess?: () => void;
  /** Called when form is cancelled */
  onCancel?: () => void;
}

const LINES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const REPORT_TYPES: { type: ReportType; icon: any }[] = [
  { type: ReportType.DELAY, icon: Clock },
  { type: ReportType.ACCIDENT, icon: AlertTriangle },
  { type: ReportType.CROWDED, icon: Users },
  { type: ReportType.SIGNAL_ISSUE, icon: Radio },
  { type: ReportType.STOPPED, icon: OctagonX },
  { type: ReportType.OTHER, icon: HelpCircle },
];

export const DelayReportForm: React.FC<DelayReportFormProps> = ({
  lineId: initialLineId,
  stationId: initialStationId,
  stationName: initialStationName,
  onSubmitSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [selectedLine, setSelectedLine] = useState<string>(initialLineId || '');
  const [stationName, setStationName] = useState(initialStationName || '');
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [estimatedDelay, setEstimatedDelay] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    if (!selectedLine) {
      Alert.alert('오류', '노선을 선택해주세요.');
      return;
    }

    if (!reportType) {
      Alert.alert('오류', '제보 유형을 선택해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      // Check for recent report
      const hasRecent = await delayReportService.hasRecentReport(
        user.id,
        selectedLine
      );

      if (hasRecent) {
        Alert.alert(
          '잠시만요',
          '같은 노선에 최근 5분 이내에 제보하셨습니다. 잠시 후 다시 시도해주세요.'
        );
        setSubmitting(false);
        return;
      }

      await delayReportService.submitReport({
        userId: user.id,
        userDisplayName: user.displayName || '익명',
        lineId: selectedLine,
        stationId: initialStationId || `station_${selectedLine}_unknown`,
        stationName: stationName || '알 수 없음',
        reportType,
        severity: getSeverityFromType(reportType),
        description: description.trim() || undefined,
        estimatedDelayMinutes: estimatedDelay
          ? parseInt(estimatedDelay, 10)
          : undefined,
      });

      Alert.alert('제보 완료', '소중한 제보 감사합니다!');
      onSubmitSuccess?.();
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert('오류', '제보 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [
    user,
    selectedLine,
    reportType,
    stationName,
    description,
    estimatedDelay,
    initialStationId,
    onSubmitSuccess,
  ]);

  const getSeverityFromType = (type: ReportType): ReportSeverity => {
    switch (type) {
      case ReportType.STOPPED:
      case ReportType.ACCIDENT:
        return ReportSeverity.CRITICAL;
      case ReportType.SIGNAL_ISSUE:
        return ReportSeverity.HIGH;
      case ReportType.DELAY:
      case ReportType.DOOR_ISSUE:
        return ReportSeverity.MEDIUM;
      default:
        return ReportSeverity.LOW;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>지연 제보하기</Text>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Line Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>노선 선택</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.lineSelector}
        >
          {LINES.map(line => {
            const lineColor = getSubwayLineColor(line);
            const isSelected = selectedLine === line;

            return (
              <TouchableOpacity
                key={line}
                style={[
                  styles.lineButton,
                  {
                    backgroundColor: isSelected ? lineColor : colors.surface,
                    borderColor: lineColor,
                  },
                ]}
                onPress={() => setSelectedLine(line)}
              >
                <Text
                  style={[
                    styles.lineButtonText,
                    { color: isSelected ? '#FFFFFF' : lineColor },
                  ]}
                >
                  {line}호선
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Station Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>역명 (선택)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 강남, 홍대입구"
          placeholderTextColor={colors.textTertiary}
          value={stationName}
          onChangeText={setStationName}
          maxLength={20}
        />
      </View>

      {/* Report Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>제보 유형</Text>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map(({ type, icon: Icon }) => {
            const isSelected = reportType === type;

            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  isSelected && styles.typeButtonSelected,
                ]}
                onPress={() => setReportType(type)}
              >
                <Text style={styles.typeEmoji}>{getReportTypeEmoji(type)}</Text>
                <Icon
                  size={20}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    isSelected && styles.typeLabelSelected,
                  ]}
                >
                  {ReportTypeLabels[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Estimated Delay */}
      {(reportType === ReportType.DELAY ||
        reportType === ReportType.STOPPED) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>예상 지연 시간 (분)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 10"
            placeholderTextColor={colors.textTertiary}
            value={estimatedDelay}
            onChangeText={text => setEstimatedDelay(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      )}

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>상세 내용 (선택)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="예: 2호선 강남역에서 열차가 10분째 멈춰있습니다"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        <Text style={styles.charCount}>{description.length}/200</Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedLine || !reportType || submitting) &&
            styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedLine || !reportType || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Send size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>제보하기</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info */}
      <Text style={styles.infoText}>
        제보는 다른 승객들의 판단에 도움이 됩니다.
        {'\n'}허위 제보는 삼가해주세요.
      </Text>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    title: {
      fontSize: TYPOGRAPHY.fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: SPACING.xs,
    },
    section: {
      padding: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: SPACING.sm,
    },
    lineSelector: {
      flexDirection: 'row',
    },
    lineButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 2,
      marginRight: SPACING.sm,
    },
    lineButtonText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '600',
    },
    textInput: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      textAlign: 'right',
      marginTop: SPACING.xs,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    typeButton: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: SPACING.xs,
    },
    typeButtonSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: colors.backgroundSecondary,
    },
    typeEmoji: {
      fontSize: 24,
    },
    typeLabel: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    typeLabelSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginHorizontal: SPACING.lg,
      marginVertical: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      gap: SPACING.sm,
    },
    submitButtonDisabled: {
      backgroundColor: colors.textTertiary,
    },
    submitButtonText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    infoText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xl,
      lineHeight: 18,
    },
  });

export default DelayReportForm;
