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
  Switch,
  SafeAreaView,
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
  Bookmark,
  Image as ImageIcon,
  Camera,
  Mic,
  Info,
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
import { SPACING, RADIUS, TYPOGRAPHY, weightToFontFamily } from '@/styles/modernTheme';
import { DelayDurationStepper } from './DelayDurationStepper';
import { LineStationBanner } from './LineStationBanner';

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
const RECOMMENDED_STATIONS = ['강남', '홍대입구', '잠실', '서울역', '사당', '신도림', '여의도', '왕십리'];

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
  const [estimatedDelay, setEstimatedDelay] = useState<number>(5);
  const [anonymous, setAnonymous] = useState<boolean>(true);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDraftSave = useCallback(() => {
    // Stub: AsyncStorage draft persistence is wired in Phase B.
    Alert.alert('임시저장', '곧 지원될 기능이에요.');
  }, []);

  const handleAttachment = useCallback((kind: 'image' | 'camera' | 'voice') => {
    const label = { image: '사진', camera: '카메라', voice: '음성' }[kind];
    Alert.alert(label, '곧 지원될 기능이에요.');
  }, []);

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
        estimatedDelayMinutes:
          reportType === ReportType.DELAY || reportType === ReportType.STOPPED
            ? estimatedDelay
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
    <SafeAreaView style={styles.container}>
      {/* Header — design handoff: X · 지연 제보 · 임시저장 */}
      <View style={styles.header}>
        <View style={styles.headerLeading}>
          {onCancel ? (
            <TouchableOpacity
              testID="close-button"
              onPress={onCancel}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.closeButton} />
          )}
        </View>
        <Text style={styles.title}>지연 제보</Text>
        <TouchableOpacity
          testID="draft-save-button"
          onPress={handleDraftSave}
          style={styles.draftButton}
          accessibilityRole="button"
          accessibilityLabel="임시저장"
        >
          <Text style={styles.draftButtonText}>임시저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

      {/* Context banner — visible once both line and station are picked */}
      {selectedLine && stationName ? (
        <View style={styles.bannerWrap}>
          <LineStationBanner lineId={selectedLine} stationName={stationName} />
        </View>
      ) : null}

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

      {/* Station Name + recommended chip row */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>역 / 구간</Text>
        <TextInput
          style={styles.textInput}
          placeholder="예: 강남, 홍대입구"
          placeholderTextColor={colors.textTertiary}
          value={stationName}
          onChangeText={setStationName}
          maxLength={20}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendedRow}>
          {RECOMMENDED_STATIONS.map(name => {
            const isSelected = stationName === name;
            return (
              <TouchableOpacity
                key={name}
                testID={`station-recommend-${name}`}
                onPress={() => setStationName(name)}
                style={[styles.recommendChip, isSelected && styles.recommendChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`추천 역 ${name}`}
              >
                <Text style={[styles.recommendChipText, isSelected && styles.recommendChipTextSelected]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          <Text style={styles.sectionTitle}>지연 시간</Text>
          <DelayDurationStepper value={estimatedDelay} onChange={setEstimatedDelay} />
        </View>
      )}

      {/* Description + attachment row */}
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
        <View style={styles.attachmentRow}>
          <View style={styles.attachmentIcons}>
            <TouchableOpacity
              testID="attach-image"
              onPress={() => handleAttachment('image')}
              accessibilityRole="button"
              accessibilityLabel="사진 첨부"
            >
              <ImageIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="attach-camera"
              onPress={() => handleAttachment('camera')}
              accessibilityRole="button"
              accessibilityLabel="카메라 첨부"
            >
              <Camera size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="attach-voice"
              onPress={() => handleAttachment('voice')}
              accessibilityRole="button"
              accessibilityLabel="음성 첨부"
            >
              <Mic size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.charCount}>{description.length}/200</Text>
        </View>
      </View>

      {/* Anonymous toggle */}
      <View style={styles.section}>
        <View style={styles.anonymousRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.anonymousTitle}>익명으로 제보</Text>
            <Text style={styles.anonymousHint}>닉네임은 김** 형태로 표시돼요</Text>
          </View>
          <Switch
            testID="anonymous-toggle"
            value={anonymous}
            onValueChange={setAnonymous}
            accessibilityLabel="익명으로 제보"
          />
        </View>
      </View>

      {/* GPS info card — stub: distance calculation wired in Phase B */}
      {stationName ? (
        <View style={styles.gpsCardWrap}>
          <View style={styles.gpsCard} testID="gps-info-card">
            <Info size={16} color={colors.primary} />
            <Text style={styles.gpsCardText}>
              현재 위치가 <Text style={styles.gpsCardTextStrong}>{stationName} 반경 200m</Text> 안이에요. GPS 기반 자동
              검증돼서 가중치가 올라가요.
            </Text>
          </View>
        </View>
      ) : null}
      </ScrollView>

      {/* Sticky footer — bookmark + 제보 등록 CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          testID="bookmark-toggle"
          onPress={() => setBookmarked(prev => !prev)}
          style={styles.bookmarkButton}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? '북마크 해제' : '북마크'}
          accessibilityState={{ selected: bookmarked }}
        >
          <Bookmark
            size={22}
            color={bookmarked ? colors.primary : colors.textSecondary}
            fill={bookmarked ? colors.primary : 'transparent'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedLine || !reportType || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedLine || !reportType || submitting}
          accessibilityRole="button"
          accessibilityLabel="제보 등록"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>제보 등록</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerLeading: {
      width: 44,
    },
    title: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: colors.textPrimary,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    draftButton: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      minWidth: 60,
      alignItems: 'flex-end',
    },
    draftButtonText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    scrollBody: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 96,
    },
    bannerWrap: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
    },
    section: {
      padding: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
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
      fontFamily: weightToFontFamily('600'),
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
    },
    recommendedRow: {
      marginTop: SPACING.sm,
      flexDirection: 'row',
    },
    recommendChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginRight: SPACING.sm,
      backgroundColor: colors.surface,
    },
    recommendChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    recommendChipText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textPrimary,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    recommendChipTextSelected: {
      color: '#FFFFFF',
    },
    attachmentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    attachmentIcons: {
      flexDirection: 'row',
      gap: SPACING.md,
      alignItems: 'center',
    },
    anonymousRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    anonymousTitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: colors.textPrimary,
    },
    anonymousHint: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    gpsCardWrap: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
    },
    gpsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      padding: SPACING.md,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.md,
    },
    gpsCardText: {
      flex: 1,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    gpsCardTextStrong: {
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: colors.textPrimary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    bookmarkButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
      fontFamily: weightToFontFamily('500'),
    },
    typeLabelSelected: {
      color: colors.primary,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    submitButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
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
      fontFamily: weightToFontFamily('600'),
      color: '#FFFFFF',
    },
  });

export default DelayReportForm;
