/**
 * Delay Report Form Component
 * 실시간 지연 제보 입력 폼 — 시안 #2 풀매칭
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Switch, SafeAreaView } from 'react-native';
import { Clock, AlertTriangle, Users, Radio, Ban, MoreHorizontal, Send, X, Bookmark, Image as ImageIcon, Camera, Mic, Info, Search, MapPin, ShieldCheck } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';

import { delayReportService } from '@/services/delay/delayReportService';
import {
  findStationCdByNameAndLine,
  getAvailableLocalLineIds,
  getLocalStationsByLine,
} from '@/services/data/stationsDataService';
import { ReportType, ReportTypeLabels, ReportSeverity } from '@/models/delayReport';
import { getLineShortLabel } from '@/components/design/LineBadge';
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

const FALLBACK_LINE_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DEFAULT_RECOMMENDED_STATIONS = ['강남', '홍대입구', '잠실', '서울역', '사당', '신도림', '여의도', '왕십리'];
const MAX_STATION_SUGGESTIONS = 12;

const LINE_LABEL_OVERRIDES: Record<string, string> = {
  'GTX-A': 'GTX-A',
  '인천선': '인천1',
  '인천2': '인천2',
  '용인경전철': '용인',
  '의정부경전철': '의정부',
};

const PRIORITY_STATIONS_BY_LINE: Record<string, readonly string[]> = {
  '1': ['서울역', '시청', '종로3가', '신도림', '구로', '용산', '노량진', '금정', '청량리', '회기'],
  '2': ['강남', '잠실', '홍대입구', '신도림', '사당', '왕십리', '건대입구', '교대', '선릉', '종합운동장'],
  '3': ['고속터미널', '교대', '종로3가', '을지로3가', '충무로', '양재', '수서', '연신내', '불광', '압구정'],
  '4': ['서울역', '사당', '동대문', '동대문역사문화공원', '충무로', '명동', '혜화', '노원', '창동', '이촌'],
  '5': ['여의도', '광화문', '공덕', '왕십리', '군자', '종로3가', '신길', '김포공항', '오목교', '올림픽공원'],
  '6': ['공덕', '합정', '삼각지', '약수', '태릉입구', '불광', '연신내', '석계', '응암', '디지털미디어시티'],
  '7': ['고속터미널', '건대입구', '강남구청', '대림', '가산디지털단지', '이수', '상봉', '노원', '온수', '군자'],
  '8': ['잠실', '가락시장', '석촌', '천호', '몽촌토성', '복정', '남위례', '장지', '문정', '모란'],
  '9': ['여의도', '김포공항', '고속터미널', '노량진', '당산', '종합운동장', '봉은사', '선정릉', '신논현', '중앙보훈병원'],
};

interface StationSuggestion {
  readonly name: string;
  readonly nameEn: string;
}

const normalizeStationText = (value: string): string => value.trim().toLowerCase();

const getLineStationSuggestions = (lineId: string): StationSuggestion[] => {
  const seenNames = new Set<string>();

  return getLocalStationsByLine(lineId).reduce<StationSuggestion[]>((acc, station) => {
    if (!station.name || seenNames.has(station.name)) {
      return acc;
    }

    seenNames.add(station.name);
    acc.push({ name: station.name, nameEn: station.nameEn });
    return acc;
  }, []);
};

const getRecommendedStations = (
  lineId: string,
  stationOptions: readonly StationSuggestion[],
): string[] => {
  if (!lineId) {
    return DEFAULT_RECOMMENDED_STATIONS;
  }

  const stationNames = new Set(stationOptions.map(station => station.name));
  const priorityStations = (PRIORITY_STATIONS_BY_LINE[lineId] ?? [])
    .filter(name => stationNames.has(name));
  const fallbackStations = stationOptions
    .map(station => station.name)
    .filter(name => !priorityStations.includes(name));

  return [...priorityStations, ...fallbackStations].slice(0, MAX_STATION_SUGGESTIONS);
};

const getFirstRecommendedStationForLine = (lineId: string): string => {
  const stationOptions = getLineStationSuggestions(lineId);
  return getRecommendedStations(lineId, stationOptions)[0] ?? '';
};

const isStationOnLine = (lineId: string, name: string): boolean => (
  getLineStationSuggestions(lineId).some(station => station.name === name)
);

const getLineChipLabel = (lineId: string): string => {
  if (/^\d+$/.test(lineId)) {
    return lineId;
  }

  const knownLabel = getLineShortLabel(lineId) ?? LINE_LABEL_OVERRIDES[lineId];
  if (knownLabel) {
    return knownLabel;
  }

  return lineId.replace(/도시철도|경전철|철도|선$/g, '') || lineId;
};

const getLineSelectAccessibilityLabel = (lineId: string): string => (
  /^\d+$/.test(lineId) ? `${lineId}호선 선택` : `${lineId} 선택`
);

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
  const [stationSearchQuery, setStationSearchQuery] = useState(initialStationName || '');
  const [direction, setDirection] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [estimatedDelay, setEstimatedDelay] = useState<number>(5);
  const [anonymous, setAnonymous] = useState<boolean>(true);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const previousLineRef = useRef<string | null>(null);

  const lineOptions = useMemo(() => {
    const availableLineIds = getAvailableLocalLineIds();
    const baseLineIds = availableLineIds.length > 0 ? availableLineIds : FALLBACK_LINE_IDS;

    return initialLineId && !baseLineIds.includes(initialLineId)
      ? [initialLineId, ...baseLineIds]
      : baseLineIds;
  }, [initialLineId]);

  const stationOptions = useMemo(
    () => (selectedLine ? getLineStationSuggestions(selectedLine) : []),
    [selectedLine],
  );
  const recommendedStations = useMemo(
    () => getRecommendedStations(selectedLine, stationOptions),
    [selectedLine, stationOptions],
  );
  const displayedStations = useMemo(() => {
    const query = normalizeStationText(stationSearchQuery);

    if (!selectedLine || !query) {
      return recommendedStations;
    }

    return stationOptions
      .filter(station => (
        station.name.toLowerCase().includes(query) ||
        station.nameEn.toLowerCase().includes(query)
      ))
      .map(station => station.name)
      .slice(0, MAX_STATION_SUGGESTIONS);
  }, [recommendedStations, selectedLine, stationOptions, stationSearchQuery]);

  const selectStation = useCallback((name: string) => {
    setStationName(name);
    setStationSearchQuery(name);
  }, []);

  const handleStationSearchChange = useCallback((value: string) => {
    setStationSearchQuery(value);
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setStationName('');
      return;
    }

    if (!selectedLine) {
      setStationName(trimmedValue);
      return;
    }

    const normalizedQuery = normalizeStationText(trimmedValue);
    const exactMatch = stationOptions.find(station => (
      normalizeStationText(station.name) === normalizedQuery ||
      normalizeStationText(station.nameEn) === normalizedQuery
    ));

    setStationName(exactMatch?.name ?? '');
  }, [selectedLine, stationOptions]);

  const handleLineSelect = useCallback((line: string) => {
    setSelectedLine(line);
    setDirection(null);

    if (stationName && !isStationOnLine(line, stationName)) {
      const nextStation = getFirstRecommendedStationForLine(line);
      if (nextStation) {
        selectStation(nextStation);
      }
    }
  }, [selectStation, stationName]);

  useEffect(() => {
    const lineChanged = previousLineRef.current !== selectedLine;
    previousLineRef.current = selectedLine;

    if (!lineChanged || !selectedLine || !stationName || isStationOnLine(selectedLine, stationName)) {
      return;
    }

    const nextStation = recommendedStations[0] ?? '';
    if (nextStation) {
      selectStation(nextStation);
    }
  }, [recommendedStations, selectStation, selectedLine, stationName]);

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
        stationId: findStationCdByNameAndLine(stationName, selectedLine)
          ?? (initialLineId === selectedLine && initialStationName === stationName ? initialStationId : undefined)
          ?? `station_${selectedLine}_unknown`,
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
    } catch {
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
    initialLineId,
    initialStationName,
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
          {lineOptions.map(line => {
            const lineColor = getSubwayLineColor(line);
            const isSelected = selectedLine === line;
            const lineLabel = getLineChipLabel(line);
            const isLongLabel = lineLabel.length > 1;

            return (
              <TouchableOpacity
                key={line}
                testID={`line-select-${line}`}
                accessibilityRole="button"
                accessibilityLabel={getLineSelectAccessibilityLabel(line)}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.lineCircle,
                  isLongLabel && styles.linePill,
                  isSelected
                    ? { backgroundColor: lineColor, borderColor: lineColor }
                    : null,
                ]}
                onPress={() => handleLineSelect(line)}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={[
                    styles.lineCircleText,
                    isLongLabel && styles.linePillText,
                    { color: isSelected ? WANTED_TOKENS.light.labelOnColor : lineColor },
                  ]}
                >
                  {lineLabel}
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
            value={stationSearchQuery}
            onChangeText={handleStationSearchChange}
            maxLength={20}
            accessibilityLabel="역 검색"
          />
          <MapPin size={20} color={semantic.primaryNormal} />
        </View>
        <View style={styles.recommendedRow}>
          {displayedStations.map(name => {
            const isSelected = stationName === name;
            return (
              <TouchableOpacity
                key={name}
                testID={`station-recommend-${name}`}
                onPress={() => selectStation(name)}
                style={[styles.recommendChip, isSelected && styles.recommendChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`${selectedLine ? `${selectedLine}호선 ` : ''}역 ${name} 선택`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.recommendChipText, isSelected && styles.recommendChipTextSelected]}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedLine && stationSearchQuery.trim() && displayedStations.length === 0 ? (
          <Text style={styles.stationEmptyText}>선택한 노선에서 일치하는 역이 없습니다</Text>
        ) : null}

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
      minWidth: 52,
      height: 52,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      borderWidth: 1.5,
      borderColor: semantic.lineSubtle,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    linePill: {
      minWidth: 68,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
    },
    lineCircleText: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    linePillText: {
      fontSize: 14,
      lineHeight: 18,
      maxWidth: 86,
      textAlign: 'center',
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
    stationEmptyText: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
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
