/**
 * HourlyCongestionChart — 7-bar 15-minute congestion forecast for ML prediction screen.
 *
 * Renders 7 vertical bars (typically a ±45-minute window around `currentTime`)
 * with the current slot highlighted, plus a 4-level legend matching the
 * WANTED_TOKENS.congestion palette (Section 7 of the weekly prediction
 * design, spec 2026-05-12).
 *
 * Theming uses the WANTED_TOKENS semantic palette via useTheme().isDark,
 * matching SegmentBreakdownSection (Task 1) and WeeklyTrendChart (Task 5)
 * for consistency.
 *
 * NOTE on enum values: CongestionLevel is `'low' | 'moderate' | 'high' | 'crowded'`
 * (per src/models/train.ts). The plan draft used `'very-high'`; we use the
 * actual enum string `'crowded'` everywhere.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import type { HourlySlot } from '@/services/congestion/congestionService';
import { CongestionLevel } from '@/models/train';

// ============================================================================
// Types
// ============================================================================

export interface HourlyCongestionChartProps {
  readonly lineId: string;
  readonly direction: string;
  readonly currentTime: Date;
  readonly slots: readonly HourlySlot[];
}

interface LegendEntry {
  readonly key: CongestionLevel;
  readonly label: string;
}

// ============================================================================
// Constants
// ============================================================================

const BAR_HEIGHT = 100;
const SLOT_WINDOW_MINUTES = 15;
const MINUTES_PER_HOUR = 60;
const PERCENT_DENOMINATOR = 100;
const MIN_BAR_RATIO = 0.01; // ensure 0% slots still render a 1-pixel sliver

const LEVELS_LEGEND: readonly LegendEntry[] = [
  { key: CongestionLevel.LOW, label: '여유' },
  { key: CongestionLevel.MODERATE, label: '보통' },
  { key: CongestionLevel.HIGH, label: '혼잡' },
  { key: CongestionLevel.CROWDED, label: '매우혼잡' },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a 4-level congestion bucket (or `'unknown'`) to a Wanted token color.
 * Uses WANTED_TOKENS.congestion which is the canonical 4-tone palette
 * shared across congestion UI on this branch.
 */
function levelToColor(
  semantic: WantedSemanticTheme,
  level: HourlySlot['level']
): string {
  switch (level) {
    case CongestionLevel.LOW:
      return WANTED_TOKENS.congestion.low.color;
    case CongestionLevel.MODERATE:
      return WANTED_TOKENS.congestion.mid.color;
    case CongestionLevel.HIGH:
      return WANTED_TOKENS.congestion.high.color;
    case CongestionLevel.CROWDED:
      return WANTED_TOKENS.congestion.vhigh.color;
    case 'unknown':
    default:
      return semantic.bgSubtle;
  }
}

/**
 * Parse 'HH:mm' into total minutes since midnight.
 * Returns -1 if the format is invalid (slot is then ignored for matching).
 */
function slotTimeToMinutes(slotTime: string): number {
  const parts = slotTime.split(':');
  if (parts.length !== 2) return -1;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * MINUTES_PER_HOUR + m;
}

/**
 * Find the slot whose time is within ±SLOT_WINDOW_MINUTES of `currentTime`.
 * Returns -1 when no slot is within range (e.g., currentTime is far outside).
 */
function findCurrentSlotIndex(
  slots: readonly HourlySlot[],
  currentTime: Date
): number {
  if (slots.length === 0) return -1;
  const currentMin = currentTime.getHours() * MINUTES_PER_HOUR + currentTime.getMinutes();
  let bestIndex = -1;
  let bestDelta = Infinity;
  slots.forEach((s, i) => {
    const slotMin = slotTimeToMinutes(s.slotTime);
    if (slotMin < 0) return;
    const delta = Math.abs(currentMin - slotMin);
    if (delta < SLOT_WINDOW_MINUTES && delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  });
  return bestIndex;
}

// ============================================================================
// Component
// ============================================================================

const HourlyCongestionChartComponent: React.FC<HourlyCongestionChartProps> = ({
  lineId,
  direction,
  currentTime,
  slots,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const currentIdx = useMemo(
    () => findCurrentSlotIndex(slots, currentTime),
    [slots, currentTime]
  );

  if (slots.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>시간대별 혼잡도 예측</Text>
        <Text style={styles.subtitle}>
          {lineId}호선 {direction} 방면
        </Text>
        <Text style={styles.emptyText}>예측 데이터 없음</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>시간대별 혼잡도 예측</Text>
      <Text style={styles.subtitle}>
        {lineId}호선 {direction} 방면
      </Text>

      <View style={styles.legend} testID="hourly-legend">
        {LEVELS_LEGEND.map((l) => (
          <View key={l.key} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: levelToColor(semantic, l.key) }]}
            />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.barsRow}>
        {slots.map((s, i) => {
          const ratio = Math.max(MIN_BAR_RATIO, s.congestionPercent / PERCENT_DENOMINATOR);
          const isCurrent = i === currentIdx;
          return (
            <View key={`${s.slotTime}-${i}`} style={styles.barColumn}>
              {isCurrent && (
                <Text testID="hourly-current-marker" style={styles.currentMarker}>
                  지금
                </Text>
              )}
              <Text style={[styles.percentLabel, isCurrent && styles.percentLabelCurrent]}>
                {s.congestionPercent}%
              </Text>
              <View
                testID={`hourly-bar-${i}`}
                style={[
                  styles.bar,
                  { height: BAR_HEIGHT * ratio, backgroundColor: levelToColor(semantic, s.level) },
                  isCurrent && styles.barCurrent,
                ]}
              />
              <Text style={[styles.timeLabel, isCurrent && styles.timeLabelCurrent]}>
                {s.slotTime}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (
  semantic: WantedSemanticTheme
): {
  container: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  legend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendText: TextStyle;
  barsRow: ViewStyle;
  barColumn: ViewStyle;
  bar: ViewStyle;
  barCurrent: ViewStyle;
  currentMarker: TextStyle;
  percentLabel: TextStyle;
  percentLabelCurrent: TextStyle;
  timeLabel: TextStyle;
  timeLabelCurrent: TextStyle;
  emptyText: TextStyle;
} =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgElevated,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
    },
    title: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNormal,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 4,
      marginBottom: 16,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      minHeight: BAR_HEIGHT + 60,
    },
    barColumn: {
      alignItems: 'center',
      flex: 1,
    },
    bar: {
      width: '70%',
      borderRadius: 6,
      minHeight: 6,
    },
    barCurrent: {
      borderWidth: 2,
      borderColor: semantic.labelNormal,
    },
    currentMarker: {
      fontSize: 11,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelOnColor,
      backgroundColor: semantic.labelNormal,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginBottom: 4,
    },
    percentLabel: {
      fontSize: 11,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginBottom: 4,
    },
    percentLabelCurrent: {
      color: semantic.labelNormal,
      fontFamily: weightToFontFamily('700'),
    },
    timeLabel: {
      fontSize: 11,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 6,
    },
    timeLabelCurrent: {
      color: semantic.labelNormal,
      fontFamily: weightToFontFamily('700'),
    },
    emptyText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s8,
    },
  });

export const HourlyCongestionChart = memo(HourlyCongestionChartComponent);
HourlyCongestionChart.displayName = 'HourlyCongestionChart';
