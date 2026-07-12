/**
 * Commute Settings Screen
 * Allows users to view and configure commute routes.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens. RouteWithTransfer atom (chunk 6/6
 * commit 1dd3af1) and ChevronRight icon already follow Wanted tokens.
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { ArrowRight, BellRing, Clock, MapPin, PlusCircle, Route as RouteIcon, Sparkles, TrainFront } from 'lucide-react-native';
import { Pill } from '@/components/design/Pill';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

import { SettingsStackParamList, OnboardingRouteData } from '@/navigation/types';
import { useAuth } from '@/services/auth/AuthContext';
import { loadCommuteRoutes, saveCommuteRoutes, updateEveningEnabled } from '@/services/commute/commuteService';
import { commuteReminderService, notificationService } from '@/services/notification';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { useCommuteRouteSteps } from '@/hooks/useCommuteRouteSteps';
import type { TransferStep } from '@/models/guidance';
import { truncateMinutes } from '@/utils/dateUtils';
import {
  CommuteRoute,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MORNING_DEPARTURE_TIME,
  DEFAULT_EVENING_DEPARTURE_TIME,
  reverseCommuteRoute,
} from '@/models/commute';
import type { SmartFeatures } from '@/models/user';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import { SettingPicker, type PickerOption } from '@/components/settings/SettingPicker';
import { TimePickerCard } from '@/components/settings/TimePickerCard';
import { useToast } from '@/components/common/Toast';

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
  // Preserve customized commute settings so editing a route in the
  // settings screen doesn't reset them to defaults on save. Undefined
  // when the loaded route predates these fields — handle with ?? at use.
  notifications?: CommuteRoute['notifications'];
  bufferMinutes?: number;
}

const DAY_LABELS: readonly string[] = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_ACTIVE_DAYS: readonly boolean[] = [true, true, true, true, true, false, false];

// Wanted handoff (image 17): 30-minute increments around the typical
// commute window. Mornings cluster around 7–9시, evenings around 17–21시.
const MORNING_TIME_OPTIONS: readonly string[] = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
];
const EVENING_TIME_OPTIONS: readonly string[] = [
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
];
const DEFAULT_SMART_FEATURES: SmartFeatures = {
  mlPredictionEnabled: true,
  autoAlternativeRoutes: true,
  autoDepartureDetection: 'sometimes',
};
// Auto departure detection options — 3-state enum picker. Replaces the
// previous boolean toggle that conflated 'sometimes' with 'always'. Each
// label maps to a SmartFeatures.autoDepartureDetection enum value.
const AUTO_DEPARTURE_OPTIONS: PickerOption[] = [
  { label: '항상',     value: 'always',    description: '집/회사 근처 진입 시 매번 알림' },
  { label: '일부 시간', value: 'sometimes', description: '출퇴근 시간대(07~10시, 17~21시)에만' },
  { label: '꺼짐',     value: 'never',     description: '자동 감지 사용 안 함' },
];

// Hero ETA last-resort fallbacks. The number now falls back to the shared
// graph-search ride estimate for the configured route first (parity with
// HomeScreen / WeeklyPredictionScreen — same useCommuteRouteSummary), so this
// route-agnostic constant only shows when no route is resolvable yet. ±2
// matches the band the other screens render.
const HERO_ETA_PLACEHOLDER_MIN = 32;
const HERO_ETA_CONFIDENCE_MIN = 2;

// Map ML confidence (0-1) to a ±N-minute interval. Higher confidence ↔
// tighter interval. Tuned on the assumption that a confidence of 1.0
// yields ±1 minute and 0.0 yields ±10 minutes.
const confidenceToMinutes = (confidence: number): number => {
  const clamped = Math.max(0, Math.min(1, confidence));
  return Math.max(1, Math.round((1 - clamped) * 9 + 1));
};

// "08:30" + 32 → "09:02". Returns null on parse failure so callers can
// fall back to hiding the arrival hint.
const addMinutesToTime = (hhmm: string, minutes: number): string | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const total = parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/**
 * Choose the transfer station names to display for a leg: the SSOT-derived
 * names (selectCommuteRoute → routeToGuidanceSteps) when derivation succeeds,
 * otherwise the stored transferStations field. Shared by RouteCard and the
 * Hero summary so the two summaries on one screen never disagree (a legacy doc
 * with an empty stored field must not show "직행" in one and "환승 1회" in the
 * other). Pure — count is `.length` of the returned list.
 */
const resolveTransferNames = (
  derived: readonly string[] | undefined,
  stored: readonly { readonly stationName: string }[] | undefined,
): readonly string[] => {
  const derivedNames = derived ?? [];
  if (derivedNames.length > 0) return derivedNames;
  return (stored ?? []).map((t) => t.stationName);
};

interface RouteCardProps {
  kind: 'morning' | 'evening';
  route: CommuteRouteData | null;
  onEdit: () => void;
  enabled?: boolean;
  onToggleEnabled?: (v: boolean) => void;
  arrivalEtaMinutes?: number | null;
  // SSOT-derived transfer station names (selectCommuteRoute →
  // routeToGuidanceSteps). Preferred over the stored transferStations field so
  // legacy / auto-saved docs (which often persist an empty field) still show
  // the real transfer. Computed in the screen body (hook call) — see notes on
  // RouteCard living at module scope. Empty ⇒ fall back to the stored field.
  transferStationNames?: readonly string[];
  // styles/semantic are passed IN (not closed over) so RouteCard can live at
  // module scope. Defining it inside CommuteSettingsScreen made it a NEW
  // component type on every render → React remounted the whole subtree each
  // parent re-render (e.g. the nav-prop identity churn of a cross-stack
  // "경로 변경" entry), destroying the touch responders of the controls inside
  // it (출근/퇴근 편집 링크 + 퇴근 토글) mid-gesture so their onPress never fired.
  styles: ReturnType<typeof createStyles>;
  semantic: WantedSemanticTheme;
}

const RouteCard: React.FC<RouteCardProps> = ({
  kind,
  route,
  onEdit,
  enabled,
  onToggleEnabled,
  arrivalEtaMinutes,
  transferStationNames,
  styles,
  semantic,
}) => {
  const isMorning = kind === 'morning';
  const arrivalTime = isMorning && route && arrivalEtaMinutes != null
    ? addMinutesToTime(route.departureTime, arrivalEtaMinutes)
    : null;
  // Prefer the SSOT-derived transfer names; fall back to the stored field only
  // when derivation yields nothing (graph failed / ids unresolved). Count and
  // names must come from the SAME source so they never disagree — shared with
  // the Hero summary via resolveTransferNames.
  const transferNames = resolveTransferNames(transferStationNames, route?.transferStations);
  const transferCount = transferNames.length;
  const dimmed = !isMorning && enabled === false;

  return (
    <View style={styles.routeCard}>
      {/* Header — Pill + "평일 매일" + 편집 link / Toggle */}
      <View style={styles.routeHeaderRow}>
        <Pill tone={isMorning ? 'primary' : 'neutral'} size="sm">
          {isMorning ? '출근' : '퇴근'}
        </Pill>
        <Text style={styles.routeWeekdayText}>평일 매일</Text>
        <View style={{ flex: 1 }} />
        {isMorning ? (
          <TouchableOpacity
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="경로 편집"
            // The 12px text alone is a ~24×16pt target — below the 44pt
            // minimum. hitSlop can't help here: the parent SettingSection
            // has overflow:hidden, which clips any hit area extending past
            // the card edge (both iOS clipsToBounds and Android clipChildren).
            // So we grow the REAL touch area via padding (stays inside the
            // parent) and cancel the visual shift with negative margins that
            // are absorbed by routeHeaderRow's own padding (14/10/16).
            hitSlop={8}
            style={styles.routeEditTouch}
          >
            <Text style={styles.routeEditLink}>편집</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Evening: edit link only when a route exists (empty
                state's emptyCta handles initial setup). Toggle stays
                next to it so on/off + edit are both reachable from
                the header — matches morning's edit affordance for
                consistency. */}
            {route ? (
              <TouchableOpacity
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel="퇴근 경로 편집"
                // Same touch-area fix as morning, but the right side neighbors
                // the Switch — so no negative right margin (would overlap the
                // toggle's hit area). padding(8) + marginRight(4) preserves the
                // original 12px gap to the Switch.
                style={styles.routeEditTouchEvening}
              >
                <Text style={styles.routeEditLink}>편집</Text>
              </TouchableOpacity>
            ) : null}
            <Switch
              value={enabled ?? false}
              onValueChange={onToggleEnabled}
              // No evening route → nothing to enable; the toggle is inert.
              disabled={!route}
              accessibilityRole="switch"
              accessibilityLabel="퇴근 경로 사용"
              trackColor={{ false: semantic.lineNormal, true: WANTED_TOKENS.blue[500] }}
              thumbColor="#fff"
              ios_backgroundColor={semantic.lineNormal}
              // Match SettingToggle's scale 0.85 for visual parity.
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </>
        )}
      </View>

      {route ? (
        <>
          <View style={[styles.routeBody, dimmed && { opacity: 0.45 }]}>
            {/* 출발 row */}
            <View style={styles.routeBodyRow}>
              <View style={[styles.routeDot, { backgroundColor: semantic.labelStrong }]} />
              <Text style={styles.routeStationText}>{route.departureStation.stationName}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.routeRoleText}>출발</Text>
            </View>
            <View style={styles.routeConnector}>
              <View style={styles.routeConnectorDot} />
              <View style={styles.routeConnectorDot} />
              <View style={styles.routeConnectorDot} />
            </View>
            {/* 환승 row — read-only summary. Transfer changes are made
                in the EditCommuteRoute editor (header "편집" link), so
                the prior "환승 추가" CTA + StationSearchModal flow was
                removed as a redundant entry point. */}
            <View style={styles.routeBodyRow}>
              <View style={[styles.routeDot, { backgroundColor: WANTED_TOKENS.status.green500 }]} />
              <Text style={styles.routeMidText} numberOfLines={1}>
                {transferCount === 0
                  ? '직행 · 환승 없음'
                  : `환승 ${transferCount}회 · ${transferNames.join(', ')}`}
              </Text>
              <View style={{ flex: 1 }} />
            </View>
            <View style={styles.routeConnector}>
              <View style={styles.routeConnectorDot} />
              <View style={styles.routeConnectorDot} />
              <View style={styles.routeConnectorDot} />
            </View>
            {/* 도착 row */}
            <View style={styles.routeBodyRow}>
              <View style={[styles.routeDot, { backgroundColor: WANTED_TOKENS.blue[500] }]} />
              <Text style={styles.routeStationText}>{route.arrivalStation.stationName}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.routeRoleText}>도착</Text>
            </View>
          </View>

          {/* Footer — clock + departure (+ arrival ETA for morning) */}
          <View style={[styles.routeFooterRow, dimmed && { opacity: 0.45 }]}>
            <Clock size={13} color={semantic.labelAlt} strokeWidth={2} />
            <Text style={styles.routeFooterText}>{route.departureTime} 출발</Text>
            {arrivalTime ? (
              <Text style={styles.routeFooterTextSubtle}> · 도착 ~{arrivalTime}</Text>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.emptyContent}>
          <PlusCircle size={48} color={semantic.lineNormal} strokeWidth={1.5} />
          <Text style={styles.emptyText}>설정된 경로가 없습니다</Text>
          <TouchableOpacity onPress={onEdit} style={styles.emptyCta} accessibilityRole="button">
            <Text style={styles.emptyCtaText}>경로 설정하기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
RouteCard.displayName = 'RouteCard';

export const CommuteSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUserPreferences } = useAuth();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // ML prediction wiring for the Hero ETA card. baselineMinutes is the average
  // of the user's actual past commute durations; prediction.confidence (when
  // available) tightens the ±N-minute interval. The hero ETA derivation lives
  // below (after `morningRoute` is declared) so it can fall back to the shared
  // graph-search estimate for the configured route.
  const { baselineMinutes, prediction } = useMLPrediction();

  // Toast feedback for the "저장" header action. Settings already persist
  // optimistically on each change, so the toast is an explicit confirmation
  // that the (already-saved) state is committed before navigating back —
  // it removes the "did my change actually save?" ambiguity of a silent
  // auto-save.
  const { showSuccess, ToastComponent } = useToast();

  // Holds the deferred goBack() timer so the success toast stays visible
  // briefly before the screen pops. Cleared on unmount so a native back
  // press during the delay can't trigger a double-pop.
  const saveNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (saveNavTimer.current) clearTimeout(saveNavTimer.current);
    },
    [],
  );

  const handleSavePress = useCallback((): void => {
    showSuccess('출퇴근 설정이 저장되었습니다');
    if (saveNavTimer.current) clearTimeout(saveNavTimer.current);
    saveNavTimer.current = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, 900);
  }, [navigation, showSuccess]);

  // Latest save handler + navigation in refs so the focus effect below has a
  // STABLE callback (never re-subscribes on the unstable cross-stack nav prop).
  const handleSavePressRef = useRef(handleSavePress);
  handleSavePressRef.current = handleSavePress;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  // "저장" header button (Wanted handoff). Settings persist optimistically on
  // each change, so this is a confirmation: success toast + back to Settings.
  //
  // Registered via setOptions ON FOCUS — NOT on mount. Entering this screen
  // cross-stack from Home/예측 "경로 변경" — navigate('Profile', { screen:
  // 'CommuteSettings', initial: false }) — mounts it in a transient state where
  // calling setOptions synchronously REMOUNTS it → setOptions → remount →
  // "Maximum update depth exceeded" (verified: removing setOptions stops the
  // loop). useFocusEffect runs setOptions only after the transition settles
  // (screen stable + focused), where it is benign — same as the normal "나" tab
  // entry. Stable callback (refs for latest nav/handler) so focus never
  // re-subscribes on the churning navigation prop.
  useFocusEffect(
    useCallback(() => {
      navigationRef.current.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => handleSavePressRef.current()}
            accessibilityRole="button"
            accessibilityLabel="저장하고 돌아가기"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{
              color: WANTED_TOKENS.blue[500],
              fontSize: 17,
              fontFamily: weightToFontFamily('700'),
              paddingRight: 4,
            }}>저장</Text>
          </TouchableOpacity>
        ),
      });
    }, []),
  );

  const [morningRoute, setMorningRoute] = useState<CommuteRouteData | null>(null);
  const [eveningRoute, setEveningRoute] = useState<CommuteRouteData | null>(null);
  // Evening leg active flag — separate from `eveningRoute` existence so the
  // toggle can disable the leg without discarding its saved route data.
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Hero ETA — shared estimate parity with HomeScreen / WeeklyPredictionScreen.
  // Prefer the user's learned baseline; otherwise use the SAME graph-search ride
  // minutes those screens show (useCommuteRouteSummary on the configured route)
  // so the route-agnostic "32분" constant no longer diverges from the 25분 shown
  // elsewhere. The placeholder constant remains only when no route resolves yet.
  const heroRouteSummary = useCommuteRouteSummary(
    morningRoute?.departureStation.stationId,
    morningRoute?.arrivalStation.stationId,
  );
  // truncateMinutes (not raw): graph rideMinutes can carry a float tail (e.g.
  // 25.7) and every displayed minute in the app must be truncated — same SoT as
  // Home / WeeklyPrediction (memory project_truncate_minutes_display_sot).
  const heroEtaMinutes = truncateMinutes(
    baselineMinutes !== null
      ? baselineMinutes
      : heroRouteSummary.rideMinutes ?? HERO_ETA_PLACEHOLDER_MIN,
  );
  const heroConfidenceMinutes = prediction
    ? confidenceToMinutes(prediction.confidence)
    : HERO_ETA_CONFIDENCE_MIN;
  // "예측 준비 중" reflects ML readiness (no learned baseline yet), independent
  // of whether the graph estimate is available — same honesty as HomeScreen's
  // "데이터 수집중" shown alongside a real route number.
  const heroIsPlaceholder = baselineMinutes === null;

  // SSOT-derived transfer stations for each leg. selectCommuteRoute (path SSOT,
  // same seam Home/ML use) → routeToGuidanceSteps yields the transfer steps;
  // their station names drive the RouteCard summary. This fixes legacy /
  // auto-saved docs whose stored transferStations field is empty from rendering
  // "직행 · 환승 없음". Hooks run in the screen body (RouteCard is module-scope
  // memo). Empty result ⇒ RouteCard falls back to the stored field.
  const morningSteps = useCommuteRouteSteps(
    morningRoute?.departureStation.stationId,
    morningRoute?.arrivalStation.stationId,
    morningRoute?.transferStations[0]?.stationId,
  );
  const eveningSteps = useCommuteRouteSteps(
    eveningRoute?.departureStation.stationId,
    eveningRoute?.arrivalStation.stationId,
    eveningRoute?.transferStations[0]?.stationId,
  );
  const morningTransferNames = useMemo<readonly string[]>(
    () =>
      morningSteps
        .filter((s): s is TransferStep => s.kind === 'transfer')
        .map((s) => s.stationName),
    [morningSteps],
  );
  const eveningTransferNames = useMemo<readonly string[]>(
    () =>
      eveningSteps
        .filter((s): s is TransferStep => s.kind === 'transfer')
        .map((s) => s.stationName),
    [eveningSteps],
  );
  // Hero summary transfer count — same derived-preferred + stored-fallback
  // source as the morning RouteCard so the two morning summaries never diverge.
  const heroTransferCount = resolveTransferNames(
    morningTransferNames,
    morningRoute?.transferStations,
  ).length;

  // Convert local CommuteRouteData (UI shape) into CommuteRoute (Firestore
  // shape). Adds default notifications + bufferMinutes; transferStations
  // get a synthesized lineName + order.
  const routeDataToCommuteRoute = useCallback(
    (data: CommuteRouteData): CommuteRoute => ({
      departureTime: data.departureTime,
      departureStationId: data.departureStation.stationId,
      departureStationName: data.departureStation.stationName,
      departureLineId: data.departureStation.lineId,
      arrivalStationId: data.arrivalStation.stationId,
      arrivalStationName: data.arrivalStation.stationName,
      arrivalLineId: data.arrivalStation.lineId,
      transferStations: data.transferStations.map((t, i) => ({
        stationId: t.stationId,
        stationName: t.stationName,
        lineId: t.lineId,
        lineName: '',
        order: i + 1,
      })),
      notifications: DEFAULT_COMMUTE_NOTIFICATIONS,
      bufferMinutes: DEFAULT_BUFFER_MINUTES,
    }),
    [],
  );

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
        await updateUserPreferences({
          commuteSchedule: {
            ...user.preferences.commuteSchedule,
            ...patch,
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
    async (value: boolean): Promise<void> => {
      if (!user) return;
      if (value) {
        // 권한 게이트: 거부 시 예약하지 않고 토글 OFF 유지(alertEnabled 미변경).
        const permission = await notificationService.requestPermissions();
        if (!permission.granted) {
          Alert.alert('알림 권한 필요', '설정에서 알림을 허용해 주세요.');
          return;
        }
        await updateCommuteSchedule({ alertEnabled: true });
        const departureTime = morningRoute?.departureTime;
        if (departureTime) {
          await commuteReminderService.scheduleCommuteReminders(user.id, { departureTime, activeDays });
        }
      } else {
        await updateCommuteSchedule({ alertEnabled: false });
        await commuteReminderService.cancelCommuteReminders(user.id);
      }
    },
    [user, updateCommuteSchedule, morningRoute, activeDays],
  );

  const handleToggleDay = useCallback(
    async (index: number): Promise<void> => {
      const next = [...activeDays];
      next[index] = !next[index];
      await updateCommuteSchedule({ activeDays: next });
      // 알림이 켜져 있으면 새 요일 집합으로 재예약.
      if (alertEnabled && user && morningRoute?.departureTime) {
        await commuteReminderService.scheduleCommuteReminders(user.id, {
          departureTime: morningRoute.departureTime,
          activeDays: next,
        });
      }
    },
    [activeDays, updateCommuteSchedule, alertEnabled, user, morningRoute],
  );

  const handleToggleSmartFeature = useCallback(
    (key: 'mlPredictionEnabled' | 'autoAlternativeRoutes', value: boolean): Promise<void> => {
      return updateCommuteSchedule({
        smartFeatures: { ...smartFeatures, [key]: value },
      });
    },
    [smartFeatures, updateCommuteSchedule],
  );

  /**
   * Persist a new departureTime for the morning or evening leg.
   *
   * `saveCommuteRoutes` requires both legs. When the relative leg already
   * exists we persist it unchanged; when it's missing we materialise it by
   * REVERSING the updated leg (reverseCommuteRoute) with the opposite
   * direction's default departure time — the same reversal the onboarding
   * finaliser and the EditCommuteRoute editor use — so the two legs are
   * genuine return trips rather than identical copies. The local state
   * updates optimistically; on Firestore failure we revert and surface the
   * error.
   */
  const handleChangeDepartureTime = useCallback(
    async (kind: 'morning' | 'evening', newTime: string): Promise<void> => {
      if (!user) return;
      const target = kind === 'morning' ? morningRoute : eveningRoute;
      if (!target) return;
      const next: CommuteRouteData = { ...target, departureTime: newTime };

      // Optimistic update
      const prevMorning = morningRoute;
      const prevEvening = eveningRoute;
      if (kind === 'morning') setMorningRoute(next);
      else setEveningRoute(next);

      try {
        setSaving(true);
        // The relative leg is preserved when it exists; when absent it is
        // reversed from the edited leg so morning/evening stay genuine return
        // trips (opposite direction's default departure time).
        const targetForSave = routeDataToCommuteRoute(next);
        const morningForSave = kind === 'morning'
          ? targetForSave
          : morningRoute
            ? routeDataToCommuteRoute(morningRoute)
            : reverseCommuteRoute(targetForSave, DEFAULT_MORNING_DEPARTURE_TIME);
        const eveningForSave = kind === 'evening'
          ? targetForSave
          : eveningRoute
            ? routeDataToCommuteRoute(eveningRoute)
            : reverseCommuteRoute(targetForSave, DEFAULT_EVENING_DEPARTURE_TIME);
        const result = await saveCommuteRoutes(user.id, morningForSave, eveningForSave);
        if (!result.success) {
          // Revert
          setMorningRoute(prevMorning);
          setEveningRoute(prevEvening);
          Alert.alert('저장 실패', result.error ?? '시간 저장에 실패했습니다.');
        } else if (kind === 'morning' && alertEnabled) {
          // 출발시각이 바뀌면 알림이 켜져 있는 동안 새 시각으로 재예약.
          await commuteReminderService.scheduleCommuteReminders(user.id, {
            departureTime: newTime,
            activeDays,
          });
        }
      } catch (error) {
        setMorningRoute(prevMorning);
        setEveningRoute(prevEvening);
        console.error('Error saving departure time:', error);
        Alert.alert('오류', '시간 저장 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, morningRoute, eveningRoute, routeDataToCommuteRoute, alertEnabled, activeDays],
  );

  /**
   * Enable/disable the evening commute leg. Optimistic — the toggle flips
   * immediately and reverts if the Firestore write fails. Only operable when
   * an evening route exists (a non-existent leg has nothing to enable).
   */
  const handleToggleEveningEnabled = useCallback(
    async (value: boolean): Promise<void> => {
      if (!user || !eveningRoute) return;
      const prev = eveningEnabled;
      setEveningEnabled(value); // optimistic
      try {
        setSaving(true);
        const result = await updateEveningEnabled(user.id, value);
        if (!result.success) {
          setEveningEnabled(prev);
          Alert.alert('저장 실패', result.error ?? '퇴근 경로 설정 저장에 실패했습니다.');
        }
      } catch (error) {
        setEveningEnabled(prev);
        console.error('Error toggling evening enabled:', error);
        Alert.alert('오류', '퇴근 경로 설정 저장 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, eveningRoute, eveningEnabled],
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
      // Carry user-customized notifications/bufferMinutes so the editor
      // round-trip preserves them (Gemini regression fix).
      notifications: route.notifications,
      bufferMinutes: route.bufferMinutes,
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
        setEveningEnabled(settings.eveningEnabled ?? true);
        console.log('Commute settings loaded from Firebase');
      } else {
        console.log('No commute settings found in Firebase');
        setMorningRoute(null);
        setEveningRoute(null);
        setEveningEnabled(true);
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

  // Open the in-settings route editor (EditCommuteRoute). Push the chosen
  // leg as `initial` for hydration and the other leg as `otherLeg` so the
  // editor's save call can persist both with saveCommuteRoutes' two-leg
  // signature. Replaces the prior `resetOnboarding()` pattern, which
  // restarted the entire 5-step onboarding flow just to edit one route.
  const handleEditRoute = useCallback(
    (kind: 'morning' | 'evening'): void => {
      const routeDataToOnboarding = (
        data: CommuteRouteData | null,
      ): OnboardingRouteData | undefined =>
        data
          ? {
              departureTime: data.departureTime,
              // CommuteRouteData uses an inline shape without `lineName`;
              // StationSelection (OnboardingRouteData) requires it. Fill
              // with '' since the editor doesn't surface line names yet.
              departureStation: { ...data.departureStation, lineName: '' },
              arrivalStation: { ...data.arrivalStation, lineName: '' },
              // 1-based `order` matches routeDataToCommuteRoute helper
              // and the Firestore `CommuteRoute` convention. Drifting to
              // 0-based here would cause off-by-one on the editor save.
              transferStations: (data.transferStations || []).map((t, i) => ({
                stationId: t.stationId,
                stationName: t.stationName,
                lineId: t.lineId,
                lineName: '',
                order: i + 1,
              })),
              // Preserve user-customized values across the editor
              // round-trip (Gemini regression fix).
              notifications: data.notifications,
              bufferMinutes: data.bufferMinutes,
            }
          : undefined;
      const initial = routeDataToOnboarding(
        kind === 'morning' ? morningRoute : eveningRoute,
      );
      const otherLeg = routeDataToOnboarding(
        kind === 'morning' ? eveningRoute : morningRoute,
      );
      navigation.navigate('EditCommuteRoute', { kind, initial, otherLeg });
    },
    [navigation, morningRoute, eveningRoute],
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
        {/* Hero ETA gradient card — ETA = ML baseline ?? shared graph-search ride
            (useCommuteRouteSummary, parity with Home/WeeklyPrediction) ?? placeholder */}
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
            <Text style={styles.heroEtaValue} testID="commute-hero-eta-minutes">{heroEtaMinutes}</Text>
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
                {heroTransferCount === 0
                  ? '직행 · 환승 0회'
                  : `환승 ${heroTransferCount}회`}
              </Text>
            </>
          ) : null}
        </LinearGradient>

        {/* 1. Master switch */}
        <SettingSection title="출퇴근 알림">
          <SettingToggle
            testID="commute-alert-toggle"
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
            kind="morning"
            styles={styles}
            semantic={semantic}
            route={morningRoute}
            onEdit={() => handleEditRoute('morning')}
            arrivalEtaMinutes={baselineMinutes !== null ? Math.round(baselineMinutes) : null}
            transferStationNames={morningTransferNames}
          />
          <View style={styles.routeDivider} />
          <RouteCard
            kind="evening"
            styles={styles}
            semantic={semantic}
            route={eveningRoute}
            onEdit={() => handleEditRoute('evening')}
            enabled={eveningRoute !== null && eveningEnabled}
            onToggleEnabled={handleToggleEveningEnabled}
            transferStationNames={eveningTransferNames}
          />
        </SettingSection>

        {/* 3. Departure time — 출근 시간 (image 17) */}
        {morningRoute ? (
          <TimePickerCard
            testID="morning-time-picker"
            title="출근 시간"
            subtitle="평일 기준"
            value={morningRoute.departureTime}
            options={MORNING_TIME_OPTIONS}
            onChange={(t) => handleChangeDepartureTime('morning', t)}
            disabled={saving}
          />
        ) : null}

        {/* 4. Departure time — 퇴근 시간. Only when evening route is configured. */}
        {eveningRoute ? (
          <TimePickerCard
            testID="evening-time-picker"
            title="퇴근 시간"
            subtitle="평일 기준"
            value={eveningRoute.departureTime}
            options={EVENING_TIME_OPTIONS}
            onChange={(t) => handleChangeDepartureTime('evening', t)}
            disabled={saving}
          />
        ) : null}

        {/* 5. Day picker — 출근하는 요일 */}
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
          <SettingPicker
            icon={MapPin}
            label="자동 출발 감지"
            options={AUTO_DEPARTURE_OPTIONS}
            value={smartFeatures.autoDepartureDetection}
            onValueChange={(v) =>
              updateCommuteSchedule({
                smartFeatures: {
                  ...smartFeatures,
                  autoDepartureDetection: v as 'always' | 'sometimes' | 'never',
                },
              })
            }
          />
          <Text style={styles.smartFooter}>
            머신러닝이 평소 이용 패턴을 학습해 더 정확한 예측을 제공해요. 데이터는 기기에만 저장됩니다.
          </Text>
        </SettingSection>
      </ScrollView>

      <ToastComponent />
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // Page background uses bgSubtlePage so the white SettingSection
      // cards and Hero card stand out (Wanted handoff body backdrop).
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
      // Vertical padding only — horizontal inset is delegated to each
      // child (heroCard.marginHorizontal + SettingSection.sectionContent.
      // marginHorizontal) so all sections sit at the same 16px inset.
      paddingVertical: WANTED_TOKENS.spacing.s4,
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
      // Outer card chrome lives on the parent SettingSection's
      // sectionContent (border + radius + overflow:hidden). RouteCard
      // is now an in-card row that pairs with a sibling routeDivider so
      // morning + evening share one card divided by a single hairline,
      // matching Image #9.
      backgroundColor: semantic.bgBase,
    },
    routeDivider: {
      height: 1,
      backgroundColor: semantic.lineSubtle,
      marginHorizontal: 16,
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
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s4,
      // iOS shadow fast-path: shadow가 LinearGradient에 직접 걸리면 투명 알파에서
      // 매 프레임 경로를 역산해 "cannot calculate shadow efficiently" advice를 띄운다.
      // 불투명 배경색을 주면 그 직사각형에서 그림자를 캐싱한다. 위 gradient(#0066FF→#2C7BFF,
      // 완전 불투명)가 이 색을 가려 시각적 변화는 없다 — gradient의 시작 stop과 일치.
      backgroundColor: '#0066FF',
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
      fontSize: 12,
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
      fontSize: 12,
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
    routeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    routeWeekdayText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    routeEditLink: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: WANTED_TOKENS.blue[500],
    },
    // Morning "편집": padding grows the real touch target to ~40×36pt
    // (+8 hitSlop) while negative margins (absorbed by routeHeaderRow's
    // 14/10/16 padding) keep the text visually in place. No clipping
    // because the touch area stays within the overflow:hidden parent.
    routeEditTouch: {
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginVertical: -10,
      marginHorizontal: -8,
    },
    // Evening "편집" sits to the left of the Switch — same vertical/left
    // growth, but the right edge keeps a positive margin (padding 8 +
    // marginRight 4 = the original 12px gap) so the touch area never
    // overlaps the toggle.
    routeEditTouchEvening: {
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginVertical: -10,
      marginLeft: -8,
      marginRight: 4,
    },
    routeBody: {
      backgroundColor: semantic.bgSubtlePage,
      borderRadius: 12,
      marginHorizontal: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    routeBodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 24,
    },
    routeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    routeStationText: {
      fontSize: 15,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      letterSpacing: -0.15,
    },
    routeMidText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelNeutral,
    },
    routeRoleText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    routeConnector: {
      // Replaces RN's flaky `borderStyle: 'dashed'` (iOS often renders
      // it as solid). Stack three small dots vertically next to the
      // station bullet (left edge, ~3px in to align under dot center).
      marginLeft: 3,
      paddingVertical: 2,
      gap: 2,
      alignItems: 'flex-start',
    },
    routeConnectorDot: {
      width: 2,
      height: 2,
      borderRadius: 1,
      backgroundColor: 'rgba(112,115,124,0.40)',
    },
    routeFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
    },
    routeFooterText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
    routeFooterTextSubtle: {
      fontSize: 12,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    emptyCta: {
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 9999,
      backgroundColor: WANTED_TOKENS.blue[500],
    },
    emptyCtaText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: '#fff',
    },
  });

export default CommuteSettingsScreen;
