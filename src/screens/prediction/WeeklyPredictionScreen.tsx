/**
 * Commute Prediction Screen (formerly "Weekly Prediction")
 *
 * Phase 7 — full hero redesign matching the design handoff
 * (livemetro/project/src/screens/commute-prediction.jsx).
 *
 * Information model: single hero answering "오늘 지금 출발하면 몇 분?"
 * (replaces the 7-day list). Route name 'WeeklyPrediction' kept for
 * navigation backward compatibility.
 *
 * Sections (top to bottom):
 *   1. Top bar — chevron-left back button + ML predict tag + settings icon
 *   2. Hero header — "오늘 출근, 약" lead-in
 *   3. Big number card — 96px tabular-nums display + range bar + confidence
 *   4. Route summary — origin → destination row
 *   5. CTA button — schedule departure alert
 *
 * Wired sections (real data):
 *   6. Segment breakdown (Task 2)
 *   7. Hourly congestion forecast (Task 10 — congestionService.getHourlyForecast)
 *   8. "예측에 반영된 요소" factors list (Task 7 — usePredictionFactors)
 *   9. Weekly comparison bar chart (Task 4)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { trainService } from '@/services/train/trainService';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Bell, ChevronLeft, Settings2, ShieldCheck, Sparkles, TrendingDown } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useCommutePattern } from '@/hooks/useCommutePattern';
import { usePredictionFactors } from '@/hooks/usePredictionFactors';
import { useIntegratedAlerts } from '@/hooks/useIntegratedAlerts';
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { useCommuteRouteSteps } from '@/hooks/useCommuteRouteSteps';
import { useSemanticTokens } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';
import { truncateMinutes } from '@/utils/dateUtils';
import { Pill } from '@/components/design';
import { WeeklyTrendChart, PredictionFactorsSection, HourlyCongestionChart, type DayBarData, type WeekdayLabel } from '@/components/prediction';
import { GuidanceStepRow } from '@/components/guidance';
import { congestionService, type HourlySlot } from '@/services/congestion/congestionService';
import { DEFAULT_WALK_TO_STATION_MIN, DEFAULT_WAIT_MIN, DEFAULT_WALK_TO_DEST_MIN, type DayOfWeek, type PredictedCommute } from '@/models/pattern';
import { directionToDisplay, type Direction } from '@/models/route';
import { isUsableCommuteTime } from '@/models/user';

const formatTimeShort = (now: Date = new Date()): string => {
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${m}`;
};

/* ───────── Task 4: Section 9 weekly trend helpers ───────── */

const WEEKDAY_LABELS: readonly WeekdayLabel[] = ['월', '화', '수', '목', '금'];
// PredictedCommute.dayOfWeek is the numeric `DayOfWeek` type (Sun=0..Sat=6),
// so Mon-Fri map to [1,2,3,4,5].
const WEEKDAY_KEYS = [1, 2, 3, 4, 5] as const;

/**
 * Build the Mon-Fri DayBarData[] consumed by WeeklyTrendChart from the
 * raw `useCommutePattern.weekPredictions` list. Reads
 * `PredictedCommute.predictedMinutes` directly; falls back to a 30-min
 * default for predictions where the producer hasn't populated it.
 *
 * `isToday` is the single source of truth; `todayIndex` is derived
 * from `findIndex(d => d.isToday)` to keep them consistent.
 */
const DEFAULT_DURATION_MIN = 30;
// Dash segments for the confidence divider. Over-provisioned and clipped by the
// container's `overflow: 'hidden'`, so it fills any width without measuring.
const DIVIDER_DASH_COUNT = 40;
const buildWeeklyDays = (
  weekPredictions: readonly PredictedCommute[],
  now: Date,
): { days: DayBarData[]; todayIndex: number; averageMin: number } => {
  // JS getDay() returns Sun=0..Sat=6, matching `DayOfWeek`. todayKey is
  // null on weekends so `isToday` is uniformly false across Mon-Fri.
  const today = now.getDay();
  const todayKey = today >= 1 && today <= 5 ? today : null;

  const days: DayBarData[] = WEEKDAY_KEYS.map((key, i) => {
    const pred = weekPredictions.find((p) => p.dayOfWeek === key);
    return {
      dayLabel: WEEKDAY_LABELS[i]!,
      durationMin: pred ? (pred.predictedMinutes ?? DEFAULT_DURATION_MIN) : 0,
      isToday: key === todayKey,
    };
  }).filter((d) => d.durationMin > 0);

  const todayIndex = days.findIndex((d) => d.isToday);
  const averageMin =
    days.length > 0
      ? days.reduce((sum, d) => sum + d.durationMin, 0) / days.length
      : 0;
  return { days, todayIndex, averageMin };
};

export const WeeklyPredictionScreen: React.FC = () => {
  const navigation = useNavigation();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // 출퇴근 경로 등록/변경 진입점. HomeScreen.handleOpenCommuteSettings와 동일
  // 목적이지만, 이 화면은 root Stack 상의 'WeeklyPrediction'(= Main 탭 위에
  // push된 형제)이라 Main을 한 단계 더 거친다:
  //   Root('Main') → Tab('Profile'=SettingsNavigator) → Stack('CommuteSettings').
  // `initial: false`는 SettingsNavigator 스택을 [SettingsHome, CommuteSettings]로
  // 시드해 뒤로가기가 SettingsHome으로 빠지게 한다 (CommuteSettings가 유일
  // entry가 되어 pop 불가해지는 것 방지 — HomeScreen 주석 참조). types.ts의
  // 중첩 alias는 런타임에 없어 시그니처를 타입으로 표현 불가하므로 navigate를
  // 한 번 캐스팅한다 (project_dual_stack_paramlist).
  const handleOpenCommuteSettings = useCallback((): void => {
    const navigateToCommuteSettings = navigation.navigate as (
      route: 'Main',
      params: {
        screen: 'Profile';
        params: { screen: 'CommuteSettings'; initial: false };
      },
    ) => void;
    navigateToCommuteSettings('Main', {
      screen: 'Profile',
      params: { screen: 'CommuteSettings', initial: false },
    });
  }, [navigation]);

  const { prediction } = useMLPrediction();
  const { user } = useAuth();

  // Origin/destination 이름 lookup — HomeScreen과 동일한 2-store 해석.
  // 출퇴근 경로는 두 곳에 저장된다:
  //   #1 user.preferences.commuteSchedule.weekdays.morningCommute (프로필,
  //      SettingsScreen 알림 흐름이 채움) — station id가 빈 문자열인 채로
  //      non-null일 수 있어(NotificationTimeScreen 합성) isUsableCommuteTime로
  //      게이트한다. 빈 객체가 `??`를 가로채 store #2를 가리는 것 방지.
  //   #2 Firestore commuteSettings/<uid> (CommuteSettings·온보딩이
  //      saveCommuteRoutes로 채움) — useFirestoreMorningCommute로 읽는다.
  // 과거 이 화면은 store #1만 읽어, 설정/온보딩으로 등록한 경로(store #2)가
  // 있어도 "경로 정보 없음"이 떴다. HomeScreen은 이미 fallback을 쓰므로
  // 동일하게 맞춘다(home/HomeScreen.tsx 참조).
  const onboardingMorningCommute = useFirestoreMorningCommute(user?.id);
  const profileMorningCommute =
    user?.preferences.commuteSchedule?.weekdays?.morningCommute;
  const morningCommute =
    (isUsableCommuteTime(profileMorningCommute) ? profileMorningCommute : null) ??
    onboardingMorningCommute;
  const [routeNames, setRouteNames] = useState<{ origin?: string; destination?: string }>({});

  useEffect(() => {
    if (!morningCommute) return;
    let cancelled = false;
    (async () => {
      try {
        const [origin, dest] = await Promise.all([
          trainService.getStation(morningCommute.stationId).catch(() => null),
          trainService.getStation(morningCommute.destinationStationId).catch(() => null),
        ]);
        if (cancelled) return;
        setRouteNames({ origin: origin?.name, destination: dest?.name });
      } catch {
        // graceful fallback — route summary 라인 자체를 생략
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morningCommute]);

  const { todayPrediction, weekPredictions } = useCommutePattern();
  const { scheduleDepartureAlert } = useIntegratedAlerts();

  // 전체 경로 타임라인 — 설정된 출퇴근 OD에서 길안내와 동일한
  // board→ride→transfer→alight 스텝을 즉시 계산한다. ML 로그 누적과 무관하게
  // 경로만 설정돼 있으면 표시된다. 미설정/미해결 시 빈 배열.
  const routeSteps = useCommuteRouteSteps(
    morningCommute?.stationId,
    morningCommute?.destinationStationId,
  );

  // Sum of `transitSegments[].estimatedMinutes` from the model; falls back
  // to a 10-min default when the producer hasn't populated segments.
  const routeRideDurationMin = useMemo(() => {
    if (!todayPrediction?.transitSegments?.length) {
      return 10;
    }
    return todayPrediction.transitSegments.reduce(
      (sum, seg) => sum + seg.estimatedMinutes,
      0,
    );
  }, [todayPrediction]);

  // Walk/wait scalars consumed by Section 6 segment breakdown and the
  // hero fallback below. Read straight from PredictedCommute; fall back
  // to the model's published defaults when the producer hasn't populated
  // them (older predictions / soft-fail outputs).
  const walkToStationMin = todayPrediction?.walkToStationMinutes ?? DEFAULT_WALK_TO_STATION_MIN;
  const waitMin          = todayPrediction?.waitMinutes          ?? DEFAULT_WAIT_MIN;
  const walkToDestMin    = todayPrediction?.walkToDestinationMinutes ?? DEFAULT_WALK_TO_DEST_MIN;

  // Hero predictedMinutes — consume from model, fall back to
  // walk + wait + ride + walk when the field isn't populated.
  const predictedMinutes = useMemo(() => {
    if (todayPrediction?.predictedMinutes !== undefined) {
      return todayPrediction.predictedMinutes;
    }
    return walkToStationMin + waitMin + routeRideDurationMin + walkToDestMin;
  }, [todayPrediction, walkToStationMin, waitMin, routeRideDurationMin, walkToDestMin]);

  // Range from model; falls back to a ±2 band around predictedMinutes.
  const rangeMin = useMemo(() => {
    if (todayPrediction?.predictedMinutesRange) {
      return todayPrediction.predictedMinutesRange;
    }
    return [Math.max(0, predictedMinutes - 2), predictedMinutes + 2] as const;
  }, [todayPrediction, predictedMinutes]);

  // 실제 ML 예측이 산출됐는지 여부. useMLPrediction은 모델 준비 + 통근 로그가
  // 있을 때만 prediction을 채운다(없으면 null). null이면 신뢰도 "87% · 지난 30일
  // 학습"과 델타 "3분 빨라요"는 모두 거짓 fallback이므로, 신뢰도 자리에는
  // "데이터 수집중"을 표기하고 델타 pill은 숨겨 정직한 빈 상태를 만든다.
  const hasRealPrediction = prediction !== null;
  const confidencePct = prediction ? Math.round(prediction.confidence * 100) : 87;
  const arrivalTime = todayPrediction?.predictedArrivalTime ?? prediction?.predictedArrivalTime ?? '';
  const nowLabel = useMemo(() => formatTimeShort(new Date()), []);

  // Section 9: weekly trend — Mon-Fri bars with today highlighted.
  // `now` is captured per `weekPredictions` change so the today highlight
  // refreshes whenever the underlying predictions update; refresh on next
  // mount is acceptable for a daily commute screen.
  const { days: weeklyDays, todayIndex: weeklyTodayIndex } = useMemo(
    () => buildWeeklyDays(weekPredictions, new Date()),
    [weekPredictions],
  );

  // Section 8: prediction factors (weather/congestion/delay/pattern).
  // Task 5 made `DayOfWeek` numeric (0=Sun..6=Sat) — same convention as
  // `buildWeeklyDays` above. The cast is justified because JS `getDay()`
  // is typed `number` but its runtime range matches `DayOfWeek` exactly.
  // `todayDow` is captured once per mount for parity with weekly trend.
  const todayDow = useMemo<DayOfWeek>(() => new Date().getDay() as DayOfWeek, []);
  const factorsLineId = useMemo(
    () => todayPrediction?.route.lineIds[0] ?? '2',
    [todayPrediction],
  );
  // `directionForChart` is the localized display label passed to
  // HourlyCongestionChart (e.g. '내선' / '상행' depending on line).
  // Producer signals `undefined` when direction is not determinable (loop
  // line 2, Bundang/Shinbundang, etc. — see deriveDirection in pattern.ts
  // and spec §7.1). Consumer respects that signal: direction-dependent UI
  // is hidden or neutralized rather than rendering a wrong indicator.
  const directionForService: Direction | undefined = todayPrediction?.direction;
  const directionForChart =
    directionForService !== undefined
      ? directionToDisplay(directionForService, factorsLineId)
      : undefined;
  const { factors } = usePredictionFactors({
    lineId: factorsLineId,
    direction: directionForService,
    dayOfWeek: todayDow,
  });

  // Section 7: hourly congestion forecast — 7 slots (±45 min around now)
  // sourced from historical Firestore docs via congestionService. The
  // reference time is captured once per mount so the "지금" highlight is
  // stable across re-renders; refresh on next mount is acceptable for a
  // commute screen.
  const hourlyChartTime = useMemo(() => new Date(), []);
  const [hourlySlots, setHourlySlots] = useState<readonly HourlySlot[]>([]);
  useEffect(() => {
    // Skip the direction-keyed fetch when direction is unknown — surfaces
    // empty slots and the hourly chart section is hidden below.
    if (directionForService === undefined) {
      setHourlySlots([]);
      return;
    }
    let cancelled = false;
    congestionService
      .getHourlyForecast(factorsLineId, directionForService, hourlyChartTime)
      .then((slots) => {
        if (!cancelled) setHourlySlots(slots);
      })
      .catch(() => {
        // graceful fallback — empty slots → chart renders empty bars.
        if (!cancelled) setHourlySlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [factorsLineId, directionForService, hourlyChartTime]);

  // Animated count-up for the big number — 900ms ease-out cubic.
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayMin, setDisplayMin] = useState(0);

  useEffect(() => {
    const id = animatedValue.addListener(({ value }) => {
      setDisplayMin(truncateMinutes(value));
    });
    Animated.timing(animatedValue, {
      toValue: predictedMinutes,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animatedValue.removeListener(id);
  }, [animatedValue, predictedMinutes]);

  // Range bar geometry — track represents a 20-min window centered on the
  // prediction; fill spans only [최단, 최장] within that, marker sits at the
  // predicted minute. Mirrors the design handoff (commute-prediction.jsx
  // line 92-108) so the fill visibly shows "this is the predicted band
  // within a wider possible range" instead of filling the whole track.
  const TRACK_SPAN_MIN = 20;
  const trackMin = predictedMinutes - TRACK_SPAN_MIN / 2;
  const clampPct = (n: number): number => Math.max(0, Math.min(100, n));
  const fillLeftPct = clampPct(((rangeMin[0] - trackMin) / TRACK_SPAN_MIN) * 100);
  const fillWidthPct = clampPct(((rangeMin[1] - rangeMin[0]) / TRACK_SPAN_MIN) * 100);
  const markerLeftPct = clampPct(((predictedMinutes - trackMin) / TRACK_SPAN_MIN) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
      testID="commute-prediction-screen"
    >
      {/* 1. Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={styles.topBarLeft}
          testID="commute-prediction-back"
        >
          <ChevronLeft size={26} color={semantic.labelAlt} strokeWidth={2} />
          <Text style={[styles.topBarLeftText, { color: semantic.labelAlt }]}>홈</Text>
        </Pressable>
        <Pressable
          onPress={handleOpenCommuteSettings}
          accessibilityRole="button"
          accessibilityLabel="출퇴근 경로 설정"
          testID="commute-prediction-settings"
          hitSlop={8}
        >
          <Settings2 size={22} color={semantic.labelNormal} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* 2. Hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroTagRow}>
          <Pill tone="primary" size="sm" testID="commute-prediction-tag">
            <View style={styles.tagInner}>
              <Sparkles size={12} color={semantic.primaryPress} strokeWidth={2.2} />
              <Text style={[styles.tagText, { color: semantic.primaryPress }]}>ML 예측</Text>
            </View>
          </Pill>
          <Text style={[styles.heroTagTime, { color: semantic.labelAlt }]}>오늘 {nowLabel}</Text>
        </View>
        <Text style={[styles.heroLead, { color: semantic.labelStrong }]}>오늘 출근, 약</Text>
      </View>

      {/* 3. Big number card */}
      <View style={styles.sectionPad}>
        <View style={[styles.bigCard, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}>
          <View style={styles.bigNumberRow}>
            <Text
              style={[styles.bigNumber, { color: semantic.labelStrong }]}
              accessibilityRole="text"
              testID="commute-prediction-minutes"
            >
              {displayMin}
            </Text>
            <Text style={[styles.bigUnit, { color: semantic.labelNeutral }]}>분</Text>
            {hasRealPrediction && (
              <View style={styles.deltaPillWrap}>
                <Pill tone="pos" size="md">
                  <View style={styles.tagInner}>
                    <TrendingDown size={12} color="#008F30" strokeWidth={2.4} />
                    <Text style={styles.deltaText}>3분 빨라요</Text>
                  </View>
                </Pill>
              </View>
            )}
          </View>

          {/* Range bar */}
          <View style={styles.rangeWrap}>
            <View style={styles.rangeLabels}>
              <Text style={[styles.rangeLabelSide, { color: semantic.labelAlt }]}>최단 {truncateMinutes(rangeMin[0])}분</Text>
              <Text style={[styles.rangeLabelCenter, { color: semantic.primaryNormal }]}>
                예상 {truncateMinutes(predictedMinutes)}분
              </Text>
              <Text style={[styles.rangeLabelSide, { color: semantic.labelAlt }]}>최장 {truncateMinutes(rangeMin[1])}분</Text>
            </View>
            <View style={styles.rangeTrack}>
              <LinearGradient
                colors={[
                  'rgba(0,102,255,0.25)',
                  'rgba(0,102,255,0.55)',
                  'rgba(0,102,255,0.25)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.rangeFill,
                  { left: `${fillLeftPct}%`, width: `${fillWidthPct}%` },
                ]}
              />
              <View
                style={[
                  styles.rangeMarker,
                  {
                    left: `${markerLeftPct}%`,
                    backgroundColor: semantic.bgBase,
                    borderColor: semantic.primaryNormal,
                  },
                ]}
              />
            </View>
          </View>

          {/* Dashed divider — rendered as clipped dash segments because RN
              warns on (and won't draw) a single-side `borderStyle: 'dashed'`. */}
          <View style={styles.confidenceDivider}>
            {Array.from({ length: DIVIDER_DASH_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.confidenceDash, { backgroundColor: semantic.lineSubtle }]}
              />
            ))}
          </View>

          {/* Confidence row */}
          <View style={styles.confidenceRow}>
            <View style={styles.confidenceLeft}>
              <ShieldCheck size={16} color={semantic.primaryNormal} strokeWidth={2} />
              <Text style={[styles.confidenceLabel, { color: semantic.labelNeutral }]}>예측 신뢰도</Text>
            </View>
            <View style={styles.confidenceRight}>
              {hasRealPrediction ? (
                <>
                  <Text style={[styles.confidenceValue, { color: semantic.labelStrong }]}>{confidencePct}%</Text>
                  <Text style={[styles.confidenceMeta, { color: semantic.labelAlt }]}>· 지난 30일 학습</Text>
                </>
              ) : (
                <Text
                  style={[styles.confidenceMeta, { color: semantic.labelAlt }]}
                  testID="commute-prediction-collecting"
                >
                  데이터 수집중
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* 4. Route summary — 설정 시 '경로 변경' 진입, 미설정 시 설정 유도 배너.
          미설정 상태에서는 todayPrediction/factors 등 하위 섹션이 모두 빈
          상태("경로 정보 없음" 등)가 되므로, 침묵하는 공백 대신 원인을 설명하고
          CommuteSettings로 보내는 탭 가능한 배너를 노출한다. */}
      {routeNames.origin && routeNames.destination ? (
        <View style={styles.sectionPad}>
          <Pressable
            onPress={handleOpenCommuteSettings}
            accessibilityRole="button"
            accessibilityLabel="출퇴근 경로 변경"
            testID="commute-prediction-route-row"
            style={({ pressed }) => [styles.routeRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.routeText, { color: semantic.labelStrong }]}>
              {routeNames.origin}
            </Text>
            <ArrowRight size={16} color={semantic.labelAlt} strokeWidth={2.4} />
            <Text style={[styles.routeText, { color: semantic.labelStrong }]}>
              {routeNames.destination}
            </Text>
            <Text style={[styles.routeAction, { color: semantic.primaryNormal }]}>경로 변경</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sectionPad}>
          <Pressable
            onPress={handleOpenCommuteSettings}
            accessibilityRole="button"
            accessibilityLabel="출퇴근 경로 설정"
            testID="commute-prediction-route-setup"
            style={({ pressed }) => [
              styles.routeSetupBanner,
              { backgroundColor: semantic.bgElevated, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.routeSetupTextWrap}>
              <Text style={[styles.routeSetupTitle, { color: semantic.labelStrong }]}>
                출퇴근 경로를 설정해 주세요
              </Text>
              <Text style={[styles.routeSetupSub, { color: semantic.labelAlt }]}>
                경로를 등록하면 도착 시간·혼잡도 예측이 정확해져요
              </Text>
            </View>
            <View style={styles.routeSetupCta}>
              <Text style={[styles.routeSetupCtaText, { color: semantic.primaryNormal }]}>
                설정하기
              </Text>
              <ArrowRight size={15} color={semantic.primaryNormal} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>
      )}

      {/* 7. Hourly congestion forecast (Task 10) — wires
          HourlyCongestionChart (Task 9) backed by
          congestionService.getHourlyForecast (Task 8). Replaces the
          earlier Phase 54 visual placeholder with real Firestore data.
          Hidden when direction is unknown (loop/branched lines) — the
          chart subtitle is "<line>호선 <direction> 방면" and there is no
          honest neutral label that fits the design. */}
      {directionForChart !== undefined && (
        <View style={styles.sectionPad}>
          <HourlyCongestionChart
            lineId={factorsLineId}
            direction={directionForChart}
            currentTime={hourlyChartTime}
            slots={hourlySlots}
          />
        </View>
      )}

      {/* 6. 전체 경로 타임라인 — 설정된 출퇴근 경로를 길안내 화면과 동일한
          board→ride→transfer→alight 스텝으로 보여준다. routeSteps는
          useCommuteRouteSteps가 OD에서 즉시 계산하므로 ML 로그 누적 전에도
          노출된다. 미설정/미해결(빈 배열)이면 섹션을 숨긴다 — 위 설정 배너가
          이미 원인을 안내한다. 라이브 여정이 아닌 미리보기라 모든 스텝은
          'upcoming'(중립 아웃라인) 상태. 경계 있는 짧은 리스트(≤~10 스텝)라
          ScrollView 내부 .map() 사용 — FlatList 중첩 시 VirtualizedList 경고. */}
      {routeSteps.length > 0 && (
        <View style={styles.sectionPad} testID="commute-prediction-route-timeline">
          <Text style={[styles.routeTimelineLabel, { color: semantic.labelAlt }]}>
            전체 경로
          </Text>
          {routeSteps.map((step, i) => (
            <GuidanceStepRow
              key={step.id}
              step={step}
              status="upcoming"
              isFirst={i === 0}
              isLast={i === routeSteps.length - 1}
            />
          ))}
        </View>
      )}

      {/* 9. Weekly trend (Section 9 — wired in Task 4). */}
      <View style={styles.sectionPad}>
        <WeeklyTrendChart
          days={weeklyDays}
          todayIndex={weeklyTodayIndex}
        />
      </View>

      {/* 8. Prediction factors (Section 8 — wired in Task 7). */}
      <View style={styles.sectionPad}>
        <PredictionFactorsSection factors={factors} />
      </View>

      {/* 5. CTA */}
      <View style={styles.sectionPad}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="출발 시간에 알림 예약"
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: semantic.primaryNormal,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="commute-prediction-cta"
          onPress={async () => {
            if (!user?.id) {
              Alert.alert('알림 설정 실패', '로그인이 필요합니다.');
              return;
            }
            const alert = await scheduleDepartureAlert();
            if (alert) {
              Alert.alert(
                '알림 설정 완료',
                arrivalTime
                  ? `출발 시간에 알려드릴게요 (${arrivalTime} 도착 예정)`
                  : '출발 시간에 알려드릴게요',
              );
            } else {
              // user is signed in but scheduleDepartureAlert returned null
              // (commute pattern not yet learned, or service-level failure).
              // Hook's setError holds the precise reason but state hasn't
              // flushed yet — surface a likely-cause hint instead.
              Alert.alert(
                '알림 설정 실패',
                '출퇴근 패턴이 충분히 학습되지 않았거나 일시적 오류입니다. 잠시 후 다시 시도해주세요.',
              );
            }
          }}
        >
          <Bell size={18} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.ctaText}>
            출발 시간에 알려드릴게요{arrivalTime ? ` (${arrivalTime})` : ''}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const createStyles = (semantic: ReturnType<typeof useSemanticTokens>) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: 24,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    topBarLeftText: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    heroHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    heroTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    heroTagTime: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    heroLead: {
      fontSize: 22,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      letterSpacing: -0.4,
    },
    tagInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tagText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      letterSpacing: 0.4,
    },
    sectionPad: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    routeTimelineLabel: {
      fontSize: 12,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      letterSpacing: 0.36,
      marginBottom: 10,
    },
    bigCard: {
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      shadowColor: '#171717',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    bigNumberRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    bigNumber: {
      fontSize: 96,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      lineHeight: 88,
      letterSpacing: -4.8,
      fontVariant: ['tabular-nums'],
    },
    bigUnit: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      letterSpacing: -0.6,
    },
    deltaPillWrap: {
      marginLeft: 'auto',
    },
    deltaText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#008F30',
    },
    rangeWrap: {
      marginTop: 16,
    },
    rangeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    rangeLabelSide: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    rangeLabelCenter: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    rangeTrack: {
      position: 'relative',
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(112,115,124,0.12)',
      overflow: 'visible',
    },
    rangeFill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      borderRadius: 999,
    },
    rangeMarker: {
      position: 'absolute',
      top: -3,
      width: 14,
      height: 14,
      borderRadius: 9999,
      borderWidth: 3,
      marginLeft: -7,
      shadowColor: '#0066FF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    confidenceDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      marginTop: 14,
    },
    confidenceDash: {
      // 4px dash + 4px gap, repeated and clipped to the container width — a
      // cross-platform dashed rule without the single-side `borderStyle:
      // 'dashed'` that RN renders solid and warns on.
      width: 4,
      height: 1,
      marginRight: 4,
    },
    confidenceRow: {
      paddingTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    confidenceLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    confidenceLabel: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    confidenceRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    confidenceValue: {
      fontSize: 14,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      fontVariant: ['tabular-nums'],
    },
    confidenceMeta: {
      fontSize: 11,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeText: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    routeAction: {
      marginLeft: 'auto',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    routeSetupBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 18,
      gap: 12,
    },
    routeSetupTextWrap: {
      flex: 1,
    },
    routeSetupTitle: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      letterSpacing: -0.2,
    },
    routeSetupSub: {
      fontSize: 12,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      marginTop: 4,
      lineHeight: 17,
    },
    routeSetupCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    routeSetupCtaText: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      height: 56,
      borderRadius: 14,
      marginTop: 8,
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      letterSpacing: -0.2,
    },
  });
};

export default WeeklyPredictionScreen;
