/**
 * Delay Report Form Component
 * 실시간 지연 제보 입력 폼 — 시안 #2 풀매칭
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Switch, SafeAreaView } from 'react-native';
import { Clock, AlertTriangle, Users, Radio, Ban, MoreHorizontal, Send, X, Bookmark, Image as ImageIcon, Camera, Mic, Info, Search, MapPin, ShieldCheck } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';

import { delayReportService } from '@/services/delay/delayReportService';
import { ReportType, ReportTypeLabels, ReportSeverity } from '@/models/delayReport';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { getDirectionOptions } from '@/utils/directionOptions';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { DelayDurationStepper } from './DelayDurationStepper';
import { LineStationBanner } from './LineStationBanner';
import { DirectionToggle } from './DirectionToggle';

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

/**
 * 유형 그리드 메타 — 시안 #2의 컬러 원형 아이콘. accent는 라이트/다크 공용
 * 브랜드성 상태색(기존 getSeverityColor 전례와 동일하게 컴포넌트 상수).
 */
const REPORT_TYPES: { type: ReportType; icon: LucideIcon; accent: string }[] = [
  { type: ReportType.DELAY, icon: Clock, accent: '#F97316' },
  { type: ReportType.SIGNAL_ISSUE, icon: Radio, accent: '#EF4444' },
  { type: ReportType.CROWDED, icon: Users, accent: '#F59E0B' },
  { type: ReportType.STOPPED, icon: Ban, accent: '#8B5CF6' },
  { type: ReportType.ACCIDENT, icon: AlertTriangle, accent: '#EF4444' },
  { type: ReportType.OTHER, icon: MoreHorizontal, accent: '#70737C' },
];

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

export const DelayReportForm: React.FC<DelayReportFormProps> = ({
  lineId: initialLineId,
  stationId: initialStationId,
  stationName: initialStationName,
  onSubmitSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [selectedLine, setSelectedLine] = useState<string>(initialLineId || '');
  const [stationName, setStationName] = useState(initialStationName || '');
  const [direction, setDirection] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [estimatedDelay, setEstimatedDelay] = useState<number>(5);
  const [anonymous, setAnonymous] = useState<boolean>(true);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  // 노선·역이 정해지면 lines.json 인접성으로 방면 옵션 도출 (시안 #2 세그먼트)
  const directionOptions = useMemo(
    () => (selectedLine && stationName ? getDirectionOptions(selectedLine, stationName) : []),
    [selectedLine, stationName],
  );

  // 옵션이 바뀌면 유효하지 않은 선택을 첫 옵션으로 리셋 (옵션 없으면 해제)
  useEffect(() => {
    setDirection(prev =>
      prev && directionOptions.includes(prev) ? prev : directionOptions[0] ?? null,
    );
  }, [directionOptions]);

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
        direction: direction ?? undefined,
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
    direction,
    initialStationId,
    onSubmitSuccess,
  ]);

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
              <X size={24} color={semantic.labelStrong} />
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

      {/* Line Selection — 시안 #2: 원형 숫자 칩 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>노선</Text>
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
                testID={`line-select-${line}`}
                accessibilityRole="button"
                accessibilityLabel={`${line}호선 선택`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.lineCircle,
                  isSelected
                    ? { backgroundColor: lineColor, borderColor: lineColor }
                    : null,
                ]}
                onPress={() => setSelectedLine(line)}
              >
                <Text
                  style={[
                    styles.lineCircleText,
                    { color: isSelected ? WANTED_TOKENS.light.labelOnColor : lineColor },
                  ]}
                >
                  {line}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Station Name — 검색 아이콘 + 위치 핀 내장 입력 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>역 / 구간</Text>
        <View style={styles.stationInputWrap}>
          <Search size={20} color={semantic.labelAlt} />
          <TextInput
            style={styles.stationInput}
            placeholder="예: 강남, 홍대입구"
            placeholderTextColor={semantic.labelAlt}
            value={stationName}
            onChangeText={setStationName}
            maxLength={20}
          />
          <MapPin size={20} color={semantic.primaryNormal} />
        </View>
        <View style={styles.recommendedRow}>
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
        </View>

        {/* 방면 세그먼트 — lines.json 인접역 기반 (시안의 더미 역명 대신 실데이터) */}
        {directionOptions.length > 0 && (
          <View style={styles.directionWrap}>
            <DirectionToggle
              options={directionOptions}
              value={direction}
              onChange={setDirection}
            />
          </View>
        )}
      </View>

      {/* Report Type — 컬러 원형 아이콘 그리드 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>제보 유형</Text>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map(({ type, icon: Icon, accent }) => {
            const isSelected = reportType === type;

            return (
              <TouchableOpacity
                key={type}
                testID={`report-type-${type}`}
                accessibilityRole="button"
                accessibilityLabel={`${ReportTypeLabels[type]} 유형 선택`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.typeButton,
                  isSelected && { borderColor: accent, borderWidth: 2 },
                ]}
                onPress={() => setReportType(type)}
              >
                <View style={[styles.typeIconCircle, { backgroundColor: `${accent}1A` }]}>
                  <Icon size={20} color={accent} />
                </View>
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

      {/* Description — 첨부 아이콘·카운터를 입력 박스 내부에 배치 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>상세 내용</Text>
          <Text style={styles.sectionTitleSuffix}>선택</Text>
        </View>
        <View style={styles.descriptionBox}>
          <TextInput
            style={styles.descriptionInput}
            placeholder="예) 교대역 사이 신호장애로 5분째 정차 중입니다."
            placeholderTextColor={semantic.labelAlt}
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
                <ImageIcon size={20} color={semantic.labelAlt} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="attach-camera"
                onPress={() => handleAttachment('camera')}
                accessibilityRole="button"
                accessibilityLabel="카메라 첨부"
              >
                <Camera size={20} color={semantic.labelAlt} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="attach-voice"
                onPress={() => handleAttachment('voice')}
                accessibilityRole="button"
                accessibilityLabel="음성 첨부"
              >
                <Mic size={20} color={semantic.labelAlt} />
              </TouchableOpacity>
            </View>
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>
        </View>
      </View>

      {/* Anonymous toggle — 방패 아이콘 카드 */}
      <View style={styles.section}>
        <View style={styles.anonymousCard}>
          <View style={styles.anonymousIconCircle}>
            <ShieldCheck size={18} color={semantic.primaryNormal} />
          </View>
          <View style={styles.anonymousTextWrap}>
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
            <Info size={16} color={semantic.primaryNormal} />
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
            color={bookmarked ? semantic.primaryNormal : semantic.labelAlt}
            fill={bookmarked ? semantic.primaryNormal : 'transparent'}
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
            <ActivityIndicator color={WANTED_TOKENS.light.labelOnColor} />
          ) : (
            <>
              <Send size={20} color={WANTED_TOKENS.light.labelOnColor} />
              <Text style={styles.submitButtonText}>제보 등록</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgSubtlePage,
    },
    headerLeading: {
      width: 44,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    draftButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      minWidth: 60,
      alignItems: 'flex-end',
    },
    draftButtonText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
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
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
    },
    section: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s5,
    },
    sectionTitle: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelNeutral,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: WANTED_TOKENS.spacing.s1,
    },
    sectionTitleSuffix: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    lineSelector: {
      flexDirection: 'row',
    },
    lineCircle: {
      width: 52,
      height: 52,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      borderWidth: 1.5,
      borderColor: semantic.lineSubtle,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    lineCircleText: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    stationInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
    },
    stationInput: {
      flex: 1,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      fontSize: WANTED_TOKENS.type.body1.size,
      color: semantic.labelStrong,
    },
    recommendedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    recommendChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    recommendChipSelected: {
      backgroundColor: semantic.primaryBg,
      borderColor: semantic.primaryNormal,
    },
    recommendChipText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelNormal,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    recommendChipTextSelected: {
      color: semantic.primaryNormal,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    directionWrap: {
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
    },
    typeButton: {
      width: '31%',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    typeIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeLabel: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelNeutral,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    typeLabelSelected: {
      color: semantic.labelStrong,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    descriptionBox: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s3,
    },
    descriptionInput: {
      minHeight: 96,
      textAlignVertical: 'top',
      fontSize: WANTED_TOKENS.type.body1.size,
      color: semantic.labelStrong,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    attachmentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    attachmentIcons: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s4,
      alignItems: 'center',
    },
    charCount: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    anonymousCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    anonymousIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.primaryBg,
    },
    anonymousTextWrap: {
      flex: 1,
    },
    anonymousTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    anonymousHint: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
      marginTop: 2,
    },
    gpsCardWrap: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s5,
    },
    gpsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: WANTED_TOKENS.spacing.s2,
      padding: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.primaryBg,
      borderRadius: WANTED_TOKENS.radius.r6,
    },
    gpsCardText: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.primaryNormal,
      lineHeight: 18,
    },
    gpsCardTextStrong: {
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    bookmarkButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    submitButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.primaryNormal,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r8,
      gap: WANTED_TOKENS.spacing.s2,
    },
    submitButtonDisabled: {
      backgroundColor: semantic.labelDisabled,
    },
    submitButtonText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: WANTED_TOKENS.light.labelOnColor,
    },
  });

export default DelayReportForm;
