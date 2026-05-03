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

import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useTheme, ThemeColors } from '@/services/theme';
import { WANTED_TOKENS } from '@/styles/modernTheme';
import { Pill } from '@/components/design';

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

export const WeeklyPredictionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { prediction } = useMLPrediction();

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

  // Range bar geometry — predicted marker position within [min, max].
  const rangeWidthSpan = rangeMin[1] - rangeMin[0];
  const markerLeftPct = rangeWidthSpan > 0
    ? Math.max(0, Math.min(100, ((predictedMinutes - rangeMin[0]) / rangeWidthSpan) * 100))
    : 50;

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
              <View style={[styles.rangeFill, { backgroundColor: semantic.primaryNormal, opacity: 0.45 }]} />
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

      {/* 4. Route summary */}
      <View style={styles.sectionPad}>
        <View style={styles.routeRow}>
          <Text style={[styles.routeText, { color: semantic.labelStrong }]}>홍대입구</Text>
          <ArrowRight size={16} color={semantic.labelAlt} strokeWidth={2.4} />
          <Text style={[styles.routeText, { color: semantic.labelStrong }]}>강남</Text>
          <Text style={[styles.routeAction, { color: semantic.labelAlt }]}>경로 보기</Text>
        </View>
      </View>

      {/* 6–9. Sections still pending real data wiring — placeholder card. */}
      <View style={styles.sectionPad}>
        <View style={[styles.placeholderCard, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}>
          <Text style={[styles.placeholderTitle, { color: semantic.labelStrong }]}>
            상세 분석은 ML 학습이 완료된 후 표시됩니다
          </Text>
          <Text style={[styles.placeholderBody, { color: semantic.labelAlt }]}>
            구간별 시간, 시간대별 혼잡도, 예측 영향 요소, 주간 추이 정보를 곧 보여드릴게요.
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
    },
    heroLead: {
      fontSize: 22,
      fontWeight: '700',
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
      lineHeight: 88,
      letterSpacing: -4.8,
      fontVariant: ['tabular-nums'],
    },
    bigUnit: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.6,
    },
    deltaPillWrap: {
      marginLeft: 'auto',
    },
    deltaText: {
      fontSize: 12,
      fontWeight: '700',
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
    },
    rangeLabelCenter: {
      fontSize: 11,
      fontWeight: '700',
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
      left: 0,
      right: 0,
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
    },
    confidenceRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    confidenceValue: {
      fontSize: 14,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    confidenceMeta: {
      fontSize: 11,
      fontWeight: '600',
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeText: {
      fontSize: 15,
      fontWeight: '700',
    },
    routeAction: {
      marginLeft: 'auto',
      fontSize: 12,
      fontWeight: '600',
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
    },
    placeholderBody: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
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
      letterSpacing: -0.2,
    },
  });
};

export default WeeklyPredictionScreen;
