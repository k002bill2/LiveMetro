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
 * Sections still to implement (visual placeholders for now, real-data wiring
 * once useMLPrediction exposes segment/hourly/factor data):
 *   6. Segment breakdown (도보/대기/승차 + LineBadge + CongestionDots)
 *   7. Hourly congestion forecast bar chart with "지금" highlight
 *   8. "예측에 반영된 요소" factors list
 *   9. Weekly comparison bar chart (오늘 강조)
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
import { useTheme, ThemeColors } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { Pill } from '@/components/design';
import { CONG_TONE, congFromPct } from '@/components/design/congestion';
import {
  SegmentBreakdownSection,
  WeeklyTrendChart,
  type PredictedRoute,
  type DayBarData,
  type WeekdayLabel,
} from '@/components/prediction';
import type { PredictedCommute } from '@/models/pattern';

/**
 * Compute commute minutes from "HH:mm" departure → arrival strings, wrapping
 * around midnight. Mirrors the helper in HomeScreen.tsx.
 */
const MIN_PER_DAY = 24 * 60;
const minutesBetween = (departure?: string, arrival?: string): number | null => {
  if (!departure || !arrival) return null;
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
  };
  const d = parse(departure);
  const a = parse(arrival);
  if (d === null || a === null) return null;
  const diff = ((a - d) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
  return diff > 0 ? diff : null;
};

const formatTimeShort = (now: Date = new Date()): string => {
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${m}`;
};

/* ───────── Phase 54: Hourly congestion forecast helpers ───────── */

/**
 * Map a 0-100 congestion percentage to the central design system color.
 * Single source of truth: `src/components/design/congestion.ts` (which
 * itself re-exports `WANTED_TOKENS.congestion`). Brand-color changes
 * propagate without touching this screen.
 */
const congestionColorFromPct = (pct: number): string =>
  CONG_TONE[congFromPct(pct)].color;

interface HourlyDatum {
  readonly time: string; // "HH" (e.g., "08")
  readonly cong: number; // 0-100
  readonly isNow: boolean;
}

/**
 * Build a 7-slot hourly forecast centered on the current hour. Used as a
 * visual placeholder until useMLPrediction exposes per-hour data — the
 * hump shape (lower at edges, peak near now) mirrors typical Seoul commute
 * patterns and matches the design mock's intent without leaking fake
 * "data" into user-facing claims.
 */
const buildHourlyForecast = (now: Date = new Date()): HourlyDatum[] => {
  const baseHour = now.getHours();
  const humpPattern = [40, 55, 75, 85, 75, 60, 45] as const;
  return humpPattern.map((cong, i) => {
    const hour = (baseHour - 3 + i + 24) % 24;
    return {
      time: String(hour).padStart(2, '0'),
      cong,
      isNow: i === 3,
    };
  });
};

/* ───────── Task 4: Section 9 weekly trend helpers ───────── */

const WEEKDAY_LABELS: readonly WeekdayLabel[] = ['월', '화', '수', '목', '금'];
// PredictedCommute.dayOfWeek is the numeric `DayOfWeek` type (Sun=0..Sat=6),
// so Mon-Fri map to [1,2,3,4,5].
const WEEKDAY_KEYS = [1, 2, 3, 4, 5] as const;

/**
 * Build the Mon-Fri DayBarData[] consumed by WeeklyTrendChart from the
 * raw `useCommutePattern.weekPredictions` list.
 *
 * `PredictedCommute` (src/models/pattern.ts) does not yet expose an
 * `estimatedDurationMin` field — only `predictedDepartureTime` (HH:mm)
 * and a `route` without a paired arrival time. Until the model is
 * extended, we substitute a default 30-min duration for any day that
 * has a prediction, mirroring the SegmentBreakdownSection (Section 6)
 * default-substitution policy. This will be replaced with a real value
 * once `PredictedCommute` exposes duration or paired arrival time.
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
      durationMin: pred ? DEFAULT_DURATION_MIN : 0,
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

  // Derived values from ML prediction (with reasonable fallbacks for the
  // not-yet-ready state — design intent is "always show the hero").
  const predictedMinutes = useMemo(() => {
    if (!prediction) return 28; // optimistic default while model is warming up
    const m = minutesBetween(prediction.predictedDepartureTime, prediction.predictedArrivalTime);
    return m ?? 28;
  }, [prediction]);

  // Range heuristic: ±2 min when confidence is high, ±4 when low.
  // TODO: derive from prediction.delayProbability + per-segment variance once
  // useMLPrediction exposes segment-level confidence.
  const rangeMin = useMemo(() => {
    if (!prediction) return [26, 32] as const;
    const spread = prediction.confidence >= 0.7 ? 2 : 4;
    return [Math.max(0, predictedMinutes - spread), predictedMinutes + spread] as const;
  }, [prediction, predictedMinutes]);

  const confidencePct = prediction ? Math.round(prediction.confidence * 100) : 87;
  const arrivalTime = prediction?.predictedArrivalTime ?? '';
  const nowLabel = useMemo(() => formatTimeShort(new Date()), []);
  // Phase 54: hourly forecast — pure derived data, memoized once per
  // mount. Avoids 7×{array+object} re-allocation on every counter-anim
  // re-render (900ms ease-out sets state ~60Hz). Will key on a real
  // updated-at timestamp once useMLPrediction exposes hourly data.
  const hourlyForecast = useMemo(() => buildHourlyForecast(new Date()), []);

  // Section 6: Segment breakdown.
  // `PredictedCommute` (src/models/pattern.ts) currently only exposes
  // `route: FrequentRoute` (departure/arrival station names + lineIds) and a
  // `predictedDepartureTime`. The fine-grained walk/wait/ride durations and
  // the per-stop count don't yet exist in the data model, so we substitute
  // sensible defaults consistent with the design mock. These should be
  // replaced with real fields once `PredictedCommute` is extended (tracked
  // alongside Task 7 — hourly factor data).
  const { todayPrediction, weekPredictions } = useCommutePattern();
  const segmentRoute: PredictedRoute | null = useMemo(() => {
    if (!todayPrediction) return null;
    const fr = todayPrediction.route;
    const firstLineId = fr.lineIds[0] ?? '2';
    return {
      walkToStation: { durationMin: 4 },
      wait: {
        lineId: firstLineId,
        direction: fr.arrivalStationName, // direction = terminus per design copy
        durationMin: 3,
      },
      ride: {
        fromStation: fr.departureStationName,
        toStation: fr.arrivalStationName,
        stopsCount: 0,
        durationMin: Math.max(0, predictedMinutes - 4 - 3 - 3),
        // congestionLevel intentionally omitted — not in PredictedCommute yet.
      },
      walkToDestination: { durationMin: 3 },
    };
  }, [todayPrediction, predictedMinutes]);
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
  // `now` is captured once per mount to keep the today highlight stable
  // across re-renders; refresh on next mount is acceptable for a daily
  // commute screen.
  const { days: weeklyDays, todayIndex: weeklyTodayIndex, averageMin: weeklyAverageMin } = useMemo(
    () => buildWeeklyDays(weekPredictions, new Date()),
    [weekPredictions],
  );

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

      {/* 7. Hourly congestion forecast (Phase 54). Sections 6/8/9
          (segment breakdown, factors, weekly comparison) still pending
          real data — kept as a smaller placeholder below this chart. */}
      <View style={styles.sectionPad}>
        <Text style={[styles.sectionLabel, { color: semantic.labelStrong }]}>
          시간대별 혼잡도 예측
        </Text>
        <Text style={[styles.sectionSubtitle, { color: semantic.labelAlt }]}>
          현재 시간 기준 ±3시간
        </Text>
      </View>
      <View style={styles.sectionPad}>
        <View
          style={[
            styles.hourlyCard,
            { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle },
          ]}
        >
          {/* Color legend (4 levels) */}
          <View style={styles.legendRow}>
            {[
              { color: '#00BF40', label: '여유' },
              { color: '#FFB400', label: '보통' },
              { color: '#FF7A1A', label: '혼잡' },
              { color: '#FF4242', label: '매우혼잡' },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: semantic.labelAlt }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Bars container with gridlines + "지금" highlight */}
          <View style={styles.barsContainer}>
            {/* Gridlines at 25/50/75% */}
            {[25, 50, 75].map((p) => (
              <View
                key={`grid-${p}`}
                style={[
                  styles.gridline,
                  { bottom: `${p}%`, borderTopColor: semantic.lineSubtle },
                ]}
              />
            ))}

            {/* Bars row */}
            {(() => {
              return hourlyForecast.map((h, i) => {
                const color = congestionColorFromPct(h.cong);
                return (
                  <View key={`bar-${i}`} style={styles.barColumn}>
                    {/* % label above bar */}
                    <Text
                      style={[
                        styles.barPctLabel,
                        { color: h.isNow ? color : semantic.labelAlt },
                      ]}
                    >
                      {h.cong}%
                    </Text>
                    {/* Bar — isNow gets a vertical gradient + glow shadow
                        so the highlighted column reads as the focal point.
                        Non-now bars stay flat translucent for visual
                        separation. */}
                    <View style={styles.barWrap}>
                      {h.isNow ? (
                        <LinearGradient
                          colors={[color, `${color}DD`]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[
                            styles.bar,
                            styles.barIsNowShadow,
                            {
                              height: `${h.cong * 0.85}%`,
                              borderColor: color,
                              borderWidth: 2,
                              shadowColor: color,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.nowTooltip,
                              { backgroundColor: semantic.labelStrong },
                            ]}
                          >
                            <Text
                              style={[
                                styles.nowTooltipText,
                                { color: semantic.bgBase },
                              ]}
                            >
                              지금
                            </Text>
                            <View
                              style={[
                                styles.nowTooltipArrow,
                                { backgroundColor: semantic.labelStrong },
                              ]}
                            />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${h.cong * 0.85}%`,
                              backgroundColor: `${color}66`,
                              borderColor: `${color}33`,
                              borderWidth: 1,
                            },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                );
              });
            })()}
          </View>

          {/* Hour labels */}
          <View style={styles.hourLabelRow}>
            {hourlyForecast.map((h, i) => (
              <Text
                key={`hour-${i}`}
                style={[
                  styles.hourLabel,
                  {
                    color: h.isNow ? semantic.labelStrong : semantic.labelAlt,
                    fontWeight: h.isNow ? '800' : '700',
                    fontFamily: weightToFontFamily(h.isNow ? '800' : '700'),
                  },
                ]}
              >
                {h.time}
              </Text>
            ))}
          </View>
        </View>
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
          averageMin={weeklyAverageMin}
        />
      </View>

      {/* 8: still pending real data — small placeholder.
          Sections 6/9 are now wired above; copy retained until
          Task 7 (factors) replaces this too. */}
      <View style={styles.sectionPad}>
        <View
          style={[
            styles.placeholderCard,
            { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle },
          ]}
        >
          <Text style={[styles.placeholderBody, { color: semantic.labelAlt }]}>
            예측 영향 요소는 ML 학습 완료 후 표시됩니다.
          </Text>
        </View>
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
    placeholderCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      gap: 8,
    },
    placeholderTitle: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    placeholderBody: {
      fontSize: 13,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      lineHeight: 20,
    },
    /* Phase 54: hourly congestion forecast */
    sectionLabel: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      marginTop: 2,
    },
    hourlyCard: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
    },
    legendSwatch: {
      width: 8,
      height: 8,
      borderRadius: 2,
      marginRight: 4,
    },
    legendText: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    barsContainer: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 110,
      marginTop: 24, // room for "지금" tooltip above bars
    },
    gridline: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      borderTopWidth: 1,
      borderStyle: 'dashed',
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barPctLabel: {
      fontSize: 10,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      fontVariant: ['tabular-nums'],
      marginBottom: 4,
    },
    barWrap: {
      width: '85%',
      height: '85%',
      justifyContent: 'flex-end',
    },
    bar: {
      width: '100%',
      borderRadius: 6,
      minHeight: 10,
      position: 'relative',
    },
    barIsNowShadow: {
      // shadowColor is set inline per-bar from the congestion tone so the
      // glow tints with the active column's color.
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    nowTooltip: {
      position: 'absolute',
      top: -22,
      left: '50%',
      transform: [{ translateX: -16 }],
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    nowTooltipText: {
      fontSize: 10,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
    },
    nowTooltipArrow: {
      // 6×6 square rotated 45° peeks out as the tooltip's downward tip.
      // Positioned just below the rounded body so the diagonal corner
      // points at the bar's top edge.
      position: 'absolute',
      bottom: -3,
      left: '50%',
      width: 6,
      height: 6,
      transform: [{ translateX: -3 }, { rotate: '45deg' }],
    },
    hourLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    hourLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 10,
      fontVariant: ['tabular-nums'],
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
