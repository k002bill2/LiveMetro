/**
 * Commute Settings Screen
 * Allows users to view and configure commute routes.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens. RouteWithTransfer atom (chunk 6/6
 * commit 1dd3af1) and ChevronRight icon already follow Wanted tokens.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowRight,
  BellRing,
  ChevronRight,
  MapPin,
  Moon,
  PlusCircle,
  Route as RouteIcon,
  Sparkles,
  Sun,
  TrainFront,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { SettingsStackParamList } from '@/navigation/types';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import { CommuteRoute, TransferStation } from '@/models/commute';
import type { SmartFeatures } from '@/models/user';
import {
  RouteWithTransfer,
  TransferOption,
} from '@/components/commute/RouteWithTransfer';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';

type Props = NativeStackScreenProps<SettingsStackParamList, 'CommuteSettings'>;

interface CommuteRouteData {
  departureTime: string;
  departureStation: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  arrivalStation: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  transferStations: {
    stationId: string;
    stationName: string;
    lineId: string;
  }[];
}

// Static recommended transfer alternatives for the 출근 / 퇴근 cards.
// chat3 design hand-off referenced 합정(직행, 추천) / 신도림 / 사당 / 교대.
// Replacing this with `useAlternativeRoutes` lookup is a follow-up phase.
const STATIC_TRANSFER_ALTERNATIVES: readonly TransferOption[] = [
  {
    id: 'direct',
    transfer: null,
    etaMinutes: 28,
    reason: '환승 없음, 가장 빠름',
    recommended: true,
  },
  {
    id: 'sindorim',
    transfer: { stationId: 'stn-sindorim', stationName: '신도림', lineId: '2', lineName: '2호선', order: 0 },
    etaMinutes: 33,
    reason: '1·2호선 환승',
  },
  {
    id: 'sadang',
    transfer: { stationId: 'stn-sadang', stationName: '사당', lineId: '4', lineName: '4호선', order: 0 },
    etaMinutes: 35,
    reason: '2·4호선 환승',
  },
  {
    id: 'gyodae',
    transfer: { stationId: 'stn-gyodae', stationName: '교대', lineId: '3', lineName: '3호선', order: 0 },
    etaMinutes: 32,
    reason: '2·3호선 환승',
  },
];

const DAY_LABELS: readonly string[] = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_ACTIVE_DAYS: readonly boolean[] = [true, true, true, true, true, false, false];
const DEFAULT_SMART_FEATURES: SmartFeatures = {
  mlPredictionEnabled: true,
  autoAlternativeRoutes: true,
  autoDepartureDetection: 'sometimes',
};
// Hero ETA fallbacks. When useMLPrediction has no baseline data yet
// (new user, no commute logs), the card surfaces these placeholder values
// instead of hiding the section — matches the Wanted handoff "예측 준비 중"
// intent without leaving an empty hero.
const HERO_ETA_PLACEHOLDER_MIN = 32;
const HERO_ETA_CONFIDENCE_MIN = 3;

// Map ML confidence (0-1) to a ±N-minute interval. Higher confidence ↔
// tighter interval. Tuned on the assumption that a confidence of 1.0
// yields ±1 minute and 0.0 yields ±10 minutes.
const confidenceToMinutes = (confidence: number): number => {
  const clamped = Math.max(0, Math.min(1, confidence));
  return Math.max(1, Math.round((1 - clamped) * 9 + 1));
};

export const CommuteSettingsScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const { user, updateUserProfile } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // ML prediction wiring for the Hero ETA card. baselineMinutes is the
  // average of the user's actual past commute durations; prediction.confidence
  // (when available) tightens the ±N-minute interval. Both fall back to the
  // hardcoded placeholders when there is no data yet.
  const { baselineMinutes, prediction } = useMLPrediction();
  const heroEtaMinutes = baselineMinutes !== null
    ? Math.round(baselineMinutes)
    : HERO_ETA_PLACEHOLDER_MIN;
  const heroConfidenceMinutes = prediction
    ? confidenceToMinutes(prediction.confidence)
    : HERO_ETA_CONFIDENCE_MIN;
  const heroIsPlaceholder = baselineMinutes === null;

  const [morningRoute, setMorningRoute] = useState<CommuteRouteData | null>(null);
  const [eveningRoute, setEveningRoute] = useState<CommuteRouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Per-route transfer editing state. The "out" suffix maps to the 출근 card,
  // "in" to the 퇴근 card, mirroring chat3 nomenclature.
  const [outTransfer, setOutTransfer] = useState<TransferStation | null>(null);
  const [inTransfer, setInTransfer] = useState<TransferStation | null>(null);
  const [outExpanded, setOutExpanded] = useState(false);
  const [inExpanded, setInExpanded] = useState(false);

  // Derived prefs from user.preferences.commuteSchedule (with fallbacks for
  // existing user data that pre-dates these fields).
  const commuteSchedule = user?.preferences?.commuteSchedule;
  const alertEnabled = commuteSchedule?.alertEnabled ?? true;
  const activeDays = commuteSchedule?.activeDays ?? DEFAULT_ACTIVE_DAYS;
  const smartFeatures = commuteSchedule?.smartFeatures ?? DEFAULT_SMART_FEATURES;

  const updateCommuteSchedule = useCallback(
    async (patch: { alertEnabled?: boolean; activeDays?: readonly boolean[]; smartFeatures?: SmartFeatures }): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserProfile({
          preferences: {
            ...user.preferences,
            commuteSchedule: {
              ...user.preferences.commuteSchedule,
              ...patch,
            },
          },
        });
      } catch (error) {
        console.error('Error updating commute schedule:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  const handleToggleAlertEnabled = useCallback(
    (value: boolean): Promise<void> => updateCommuteSchedule({ alertEnabled: value }),
    [updateCommuteSchedule],
  );

  const handleToggleDay = useCallback(
    (index: number): Promise<void> => {
      const next = [...activeDays];
      next[index] = !next[index];
      return updateCommuteSchedule({ activeDays: next });
    },
    [activeDays, updateCommuteSchedule],
  );

  const handleToggleSmartFeature = useCallback(
    (key: 'mlPredictionEnabled' | 'autoAlternativeRoutes', value: boolean): Promise<void> => {
      return updateCommuteSchedule({
        smartFeatures: { ...smartFeatures, [key]: value },
      });
    },
    [smartFeatures, updateCommuteSchedule],
  );

  // Convert Firebase CommuteRoute to local CommuteRouteData format
  const convertToRouteData = (route: CommuteRoute | null): CommuteRouteData | null => {
    if (!route) return null;
    return {
      departureTime: route.departureTime,
      departureStation: {
        stationId: route.departureStationId,
        stationName: route.departureStationName,
        lineId: route.departureLineId,
      },
      arrivalStation: {
        stationId: route.arrivalStationId,
        stationName: route.arrivalStationName,
        lineId: route.arrivalLineId,
      },
      transferStations: (route.transferStations || []).map(t => ({
        stationId: t.stationId,
        stationName: t.stationName,
        lineId: t.lineId,
      })),
    };
  };

  // Load commute settings from Firebase
  const loadSettings = useCallback(async (): Promise<void> => {
    const uid = user?.id;
    if (!uid) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const settings = await loadCommuteRoutes(uid);

      if (settings) {
        setMorningRoute(convertToRouteData(settings.morningRoute));
        setEveningRoute(convertToRouteData(settings.eveningRoute));
        // Initialize the transfer-edit state from the first transfer station
        // of the loaded route. Multi-transfer routes show only the first
        // transfer in this UI; full multi-transfer editing is out of scope
        // for the Topic 2 surgical addition.
        const morningFirst = settings.morningRoute?.transferStations?.[0];
        const eveningFirst = settings.eveningRoute?.transferStations?.[0];
        setOutTransfer(morningFirst ? { ...morningFirst } : null);
        setInTransfer(eveningFirst ? { ...eveningFirst } : null);
        console.log('Commute settings loaded from Firebase');
      } else {
        console.log('No commute settings found in Firebase');
        setMorningRoute(null);
        setEveningRoute(null);
        setOutTransfer(null);
        setInTransfer(null);
      }
    } catch (error) {
      console.error('Error loading commute settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSetupCommute = (): void => {
    Alert.alert(
      '출퇴근 설정',
      '출퇴근 경로를 설정하시겠습니까?\n온보딩 화면으로 이동합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '설정하기',
          onPress: async () => {
            // Reset onboarding status to trigger onboarding flow
            await resetOnboarding();
          },
        },
      ],
    );
  };

  const RouteCard: React.FC<{
    title: string;
    icon: LucideIcon;
    route: CommuteRouteData | null;
    onEdit: () => void;
    transfer: TransferStation | null;
    onTransferChange: (next: TransferStation | null) => void;
    expanded: boolean;
    onToggleExpanded: () => void;
  }> = ({ title, icon: IconComponent, route, onEdit, transfer, onTransferChange, expanded, onToggleExpanded }) => (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <View style={styles.routeIconContainer}>
          <IconComponent size={24} color={semantic.labelStrong} strokeWidth={2} />
        </View>
        <Text style={styles.routeTitle}>{title}</Text>
      </View>

      {route ? (
        <View style={styles.routeContent}>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>출발 시간</Text>
            <Text style={styles.routeValue}>{route.departureTime}</Text>
          </View>
          {/* Editable origin → transfer → destination diagram (Topic 2). */}
          <RouteWithTransfer
            origin={route.departureStation}
            destination={route.arrivalStation}
            transfer={transfer}
            alternatives={STATIC_TRANSFER_ALTERNATIVES}
            onTransferChange={(next) => {
              onTransferChange(next);
              onToggleExpanded();
            }}
            expanded={expanded}
            onToggleExpanded={onToggleExpanded}
          />
        </View>
      ) : (
        <View style={styles.emptyContent}>
          <PlusCircle size={48} color={semantic.lineNormal} strokeWidth={1.5} />
          <Text style={styles.emptyText}>설정된 경로가 없습니다</Text>
        </View>
      )}

      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>
          {route ? '수정하기' : '설정하기'}
        </Text>
        <ChevronRight size={16} color={WANTED_TOKENS.blue[500]} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={WANTED_TOKENS.blue[500]} />
          <Text style={styles.loadingText}>출퇴근 설정을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero ETA gradient card — placeholder ETA, real wiring via useMLPrediction is follow-up */}
        <LinearGradient
          colors={['#0066FF', '#2C7BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroEyebrow}>
            <TrainFront size={14} color="#fff" strokeWidth={2.4} />
            <Text style={styles.heroEyebrowText}>
              {heroIsPlaceholder ? '예측 준비 중' : '오늘 출근 예측'}
            </Text>
          </View>
          <View style={styles.heroEtaRow}>
            <Text style={styles.heroEtaValue}>{heroEtaMinutes}</Text>
            <Text style={styles.heroEtaUnit}>분</Text>
            <View style={styles.heroEtaPill}>
              <Text style={styles.heroEtaPillText}>±{heroConfidenceMinutes}분</Text>
            </View>
          </View>
          {morningRoute ? (
            <>
              <View style={styles.heroRouteRow}>
                <Text style={styles.heroRouteText}>{morningRoute.departureStation.stationName}</Text>
                <ArrowRight size={14} color="#fff" strokeWidth={2} />
                <Text style={styles.heroRouteText}>{morningRoute.arrivalStation.stationName}</Text>
              </View>
              <Text style={styles.heroDetailText}>
                평일 {morningRoute.departureTime} 출발 ·{' '}
                {morningRoute.transferStations.length === 0
                  ? '직행 · 환승 0회'
                  : `환승 ${morningRoute.transferStations.length}회`}
              </Text>
            </>
          ) : null}
        </LinearGradient>

        {/* 1. Master switch */}
        <SettingSection title="출퇴근 알림">
          <SettingToggle
            icon={BellRing}
            label="출퇴근 알림 사용"
            subtitle="설정한 시간에 출발 정보를 알려드려요"
            value={alertEnabled}
            onValueChange={handleToggleAlertEnabled}
            disabled={saving}
          />
        </SettingSection>

        {/* 2. Routes — preserved from prior phase, wrapped under "경로" SettingSection for visual consistency */}
        <SettingSection title="경로">
          <RouteCard
            title="출근"
            icon={Sun}
            route={morningRoute}
            onEdit={handleSetupCommute}
            transfer={outTransfer}
            onTransferChange={setOutTransfer}
            expanded={outExpanded}
            onToggleExpanded={() => setOutExpanded((v) => !v)}
          />
          <RouteCard
            title="퇴근"
            icon={Moon}
            route={eveningRoute}
            onEdit={handleSetupCommute}
            transfer={inTransfer}
            onTransferChange={setInTransfer}
            expanded={inExpanded}
            onToggleExpanded={() => setInExpanded((v) => !v)}
          />
        </SettingSection>

        {/* 3. Day picker — 출근하는 요일 */}
        <SettingSection title="출근하는 요일">
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => {
              const on = activeDays[i] ?? false;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => handleToggleDay(i)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}요일`}
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.dayPill,
                    on
                      ? { backgroundColor: WANTED_TOKENS.blue[500], borderColor: WANTED_TOKENS.blue[500] }
                      : { backgroundColor: semantic.bgBase, borderColor: semantic.lineNormal },
                  ]}
                >
                  <Text style={[styles.dayPillText, { color: on ? '#fff' : semantic.labelAlt }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingSection>

        {/* 4. Smart features */}
        <SettingSection title="스마트 기능">
          <SettingToggle
            icon={Sparkles}
            label="ML 출퇴근 시간 예측"
            subtitle="과거 이용 데이터 기반 정확도 ±3분"
            value={smartFeatures.mlPredictionEnabled}
            onValueChange={(v) => handleToggleSmartFeature('mlPredictionEnabled', v)}
            disabled={saving}
          />
          <SettingToggle
            icon={RouteIcon}
            label="대안 경로 자동 추천"
            subtitle="지연 발생 시 더 빠른 경로 알림"
            value={smartFeatures.autoAlternativeRoutes}
            onValueChange={(v) => handleToggleSmartFeature('autoAlternativeRoutes', v)}
            disabled={saving}
          />
          <SettingToggle
            icon={MapPin}
            label="자동 출발 감지"
            subtitle={
              smartFeatures.autoDepartureDetection === 'always'
                ? '항상'
                : smartFeatures.autoDepartureDetection === 'sometimes'
                ? '일부 시간'
                : '꺼짐'
            }
            value={smartFeatures.autoDepartureDetection !== 'never'}
            onValueChange={(v) =>
              updateCommuteSchedule({
                smartFeatures: {
                  ...smartFeatures,
                  autoDepartureDetection: v ? 'sometimes' : 'never',
                },
              })
            }
            disabled={saving}
          />
          <Text style={styles.smartFooter}>
            머신러닝이 평소 이용 패턴을 학습해 더 정확한 예측을 제공해요. 데이터는 기기에만 저장됩니다.
          </Text>
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    content: {
      flex: 1,
      padding: WANTED_TOKENS.spacing.s4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    header: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s1,
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    routeCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      marginBottom: WANTED_TOKENS.spacing.s4,
      overflow: 'hidden',
    },
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtle,
    },
    routeIconContainer: {
      width: 40,
      height: 40,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    routeTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    routeContent: {
      padding: WANTED_TOKENS.spacing.s4,
    },
    routeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    routeLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    routeValue: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    emptyContent: {
      padding: WANTED_TOKENS.spacing.s5,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtle,
    },
    editButtonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: WANTED_TOKENS.blue[500],
      marginRight: WANTED_TOKENS.spacing.s1,
    },
    infoSection: {
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    infoText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginLeft: WANTED_TOKENS.spacing.s2,
      flex: 1,
    },
    heroCard: {
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 20,
      marginBottom: WANTED_TOKENS.spacing.s4,
      shadowColor: WANTED_TOKENS.blue[500],
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 6,
    },
    heroEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      opacity: 0.85,
    },
    heroEyebrowText: {
      fontSize: 11,
      fontFamily: weightToFontFamily('800'),
      color: '#fff',
      letterSpacing: 0.44,
      textTransform: 'uppercase',
    },
    heroEtaRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 10,
    },
    heroEtaValue: {
      fontSize: 38,
      fontFamily: weightToFontFamily('800'),
      letterSpacing: -0.95,
      color: '#fff',
    },
    heroEtaUnit: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: '#fff',
    },
    heroEtaPill: {
      marginLeft: 'auto',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 9999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroEtaPillText: {
      fontSize: 11,
      fontFamily: weightToFontFamily('700'),
      color: '#fff',
    },
    heroRouteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
    },
    heroRouteText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: '#fff',
    },
    heroDetailText: {
      marginTop: 4,
      fontSize: 12,
      fontFamily: weightToFontFamily('600'),
      color: '#fff',
      opacity: 0.85,
    },
    daysRow: {
      flexDirection: 'row',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      gap: 6,
    },
    dayPill: {
      flex: 1,
      height: 44,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayPillText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
    },
    smartFooter: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s3,
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 18,
    },
  });

export default CommuteSettingsScreen;
