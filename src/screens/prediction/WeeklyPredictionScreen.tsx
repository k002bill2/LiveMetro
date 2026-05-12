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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { trainService } from '@/services/train/trainService';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useCommutePattern } from '@/hooks/useCommutePattern';
import { usePredictionFactors } from '@/hooks/usePredictionFactors';
import { useTheme, ThemeColors } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { Pill } from '@/components/design';
import {
  SegmentBreakdownSection,
  WeeklyTrendChart,
  PredictionFactorsSection,
  HourlyCongestionChart,
  type PredictedRoute,
  type DayBarData,
  type WeekdayLabel,
} from '@/components/prediction';
import {
  congestionService,
  type HourlySlot,
} from '@/services/congestion/congestionService';
import {
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
  type DayOfWeek,
  type PredictedCommute,
} from '@/models/pattern';
import { directionToDisplay, type Direction } from '@/models/route';

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
  const { colors, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { prediction } = useMLPrediction();
  const { user } = useAuth();

  // Origin/destination 이름 lookup — HomeScreen과 동일 패턴.
  const morningCommute = user?.preferences.commuteSchedule?.weekdays?.morningCommute;
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

  const confidencePct = prediction ? Math.round(prediction.confidence * 100) : 87;
  const arrivalTime = todayPrediction?.predictedArrivalTime ?? prediction?.predictedArrivalTime ?? '';
  const nowLabel = useMemo(() => formatTimeShort(new Date()), []);

  // Section 6: Segment breakdown.
  const segmentRoute: PredictedRoute | null = useMemo(() => {
    if (!todayPrediction) return null;
    const fr = todayPrediction.route;
    const firstLineId = fr.lineIds[0] ?? '2';
    return {
      walkToStation: { durationMin: walkToStationMin },
      wait: {
        lineId: firstLineId,
        direction: fr.arrivalStationName, // direction = terminus per design copy
        durationMin: waitMin,
      },
      ride: {
        fromStation: fr.departureStationName,
        toStation: fr.arrivalStationName,
        stopsCount: 0,
        durationMin: routeRideDurationMin,
      },
      walkToDestination: { durationMin: walkToDestMin },
    };
  }, [todayPrediction, walkToStationMin, waitMin, walkToDestMin, routeRideDurationMin]);
  const segmentOrigin = useMemo(
    () => ({
      name: '집',
      exit: todayPrediction?.route.departureStationName ?? routeNames.origin ?? '출발역',
    }),
    [todayPrediction, routeNames.origin],
  );
  // Destination row reads as `${name} → ${exit}` (station → office), inverse
  // of the origin row (home → station). Naming reflects template position,
  // not literal "exit number" — see note above.
  const segmentDestination = useMemo(
    () => ({
      name: todayPrediction?.route.arrivalStationName ?? routeNames.destination ?? '도착역',
      exit: '회사',
    }),
    [todayPrediction, routeNames.destination],
  );

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
  const directionForService: Direction = todayPrediction?.direction ?? 'up';
  const directionForChart = directionToDisplay(directionForService, factorsLineId);
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
      setDisplayMin(Math.round(value));
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
        <Settings2 size={22} color={semantic.labelNormal} strokeWidth={1.8} />
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
            <View style={styles.deltaPillWrap}>
              <Pill tone="pos" size="md">
                <View style={styles.tagInner}>
                  <TrendingDown size={12} color="#008F30" strokeWidth={2.4} />
                  <Text style={styles.deltaText}>3분 빨라요</Text>
                </View>
              </Pill>
            </View>
          </View>

          {/* Range bar */}
          <View style={styles.rangeWrap}>
            <View style={styles.rangeLabels}>
              <Text style={[styles.rangeLabelSide, { color: semantic.labelAlt }]}>최단 {rangeMin[0]}분</Text>
              <Text style={[styles.rangeLabelCenter, { color: semantic.primaryNormal }]}>
                예상 {predictedMinutes}분
              </Text>
              <Text style={[styles.rangeLabelSide, { color: semantic.labelAlt }]}>최장 {rangeMin[1]}분</Text>
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

          {/* Confidence row */}
          <View style={[styles.confidenceRow, { borderTopColor: semantic.lineSubtle }]}>
            <View style={styles.confidenceLeft}>
              <ShieldCheck size={16} color={semantic.primaryNormal} strokeWidth={2} />
              <Text style={[styles.confidenceLabel, { color: semantic.labelNeutral }]}>예측 신뢰도</Text>
            </View>
            <View style={styles.confidenceRight}>
              <Text style={[styles.confidenceValue, { color: semantic.labelStrong }]}>{confidencePct}%</Text>
              <Text style={[styles.confidenceMeta, { color: semantic.labelAlt }]}>· 지난 30일 학습</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 4. Route summary — commuteSchedule 설정 시에만 표시 */}
      {routeNames.origin && routeNames.destination && (
        <View style={styles.sectionPad}>
          <View style={styles.routeRow}>
            <Text style={[styles.routeText, { color: semantic.labelStrong }]}>
              {routeNames.origin}
            </Text>
            <ArrowRight size={16} color={semantic.labelAlt} strokeWidth={2.4} />
            <Text style={[styles.routeText, { color: semantic.labelStrong }]}>
              {routeNames.destination}
            </Text>
            <Text style={[styles.routeAction, { color: semantic.labelAlt }]}>경로 보기</Text>
          </View>
        </View>
      )}

      {/* 7. Hourly congestion forecast (Task 10) — wires
          HourlyCongestionChart (Task 9) backed by
          congestionService.getHourlyForecast (Task 8). Replaces the
          earlier Phase 54 visual placeholder with real Firestore data. */}
      <View style={styles.sectionPad}>
        <HourlyCongestionChart
          lineId={factorsLineId}
          direction={directionForChart}
          currentTime={hourlyChartTime}
          slots={hourlySlots}
        />
      </View>

      {/* 6. Segment breakdown */}
      <View style={styles.sectionPad}>
        <SegmentBreakdownSection
          route={segmentRoute}
          origin={segmentOrigin}
          destination={segmentDestination}
        />
      </View>

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
          onPress={() => {
            // TODO: integrate with useIntegratedAlerts.scheduleDepartureAlert
            // when this screen is reachable from HomeScreen ML hero card.
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

const createStyles = (_colors: ThemeColors, isDark: boolean) => {
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
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
    confidenceRow: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderStyle: 'dashed',
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
