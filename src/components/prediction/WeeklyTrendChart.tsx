/**
 * WeeklyTrendChart — 5-bar weekday commute trend for ML prediction screen.
 *
 * Renders Mon-Fri predicted commute durations as vertical bars with the
 * "today" column highlighted in primary tone. Computes a subtitle that
 * compares today's prediction against the 4-day average of the other
 * weekdays (Section 9 of the weekly prediction design, spec 2026-05-12).
 *
 * Theming uses the WANTED_TOKENS semantic palette via useTheme().isDark,
 * matching SegmentBreakdownSection (Task 1) for consistency.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { useSemanticTokens } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { truncateMinutes } from '@/utils/dateUtils';

// ============================================================================
// Types
// ============================================================================

export type WeekdayLabel = '월' | '화' | '수' | '목' | '금';

export interface DayBarData {
  readonly dayLabel: WeekdayLabel;
  readonly durationMin: number;
  readonly isToday: boolean;
  /**
   * Whether this weekday has a real prediction. `false` renders an honest
   * ghost placeholder (em-dash label, low-saturation minimal bar) instead of
   * dropping the column, so all Mon–Fri days stay visible.
   */
  readonly hasData: boolean;
}

export interface WeeklyTrendChartProps {
  readonly days: readonly DayBarData[];
  /** Index of "today" within `days`, or -1 when today is not a weekday. */
  readonly todayIndex: number;
}

// ============================================================================
// Constants
// ============================================================================

const BAR_HEIGHT = 80;
/** Minimal height for a no-data ghost placeholder bar. */
const GHOST_BAR_HEIGHT = 8;

// ============================================================================
// Component
// ============================================================================

const WeeklyTrendChartComponent: React.FC<WeeklyTrendChartProps> = ({
  days,
  todayIndex,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // Every weekday lacks a prediction → treat like the empty state below.
  const hasAnyData = days.some((d) => d.hasData);

  const subtitle = useMemo(() => {
    if (days.length === 0) return '';
    if (todayIndex === -1) return '이번 주 평일 예측';
    const today = days[todayIndex];
    if (!today) return '';
    // Today has no prediction yet — invite the user to keep logging instead of
    // comparing against a fabricated 0.
    if (!today.hasData) return '기록이 쌓이면 요일별 예측이 채워져요';
    // Average over data-only days so ghost placeholders (durationMin 0) never
    // drag the baseline down.
    const others = days.filter((d, i) => i !== todayIndex && d.hasData);
    const avgExcludingToday =
      others.length > 0
        ? others.reduce((sum, d) => sum + d.durationMin, 0) / others.length
        : 0;
    const diff = truncateMinutes(today.durationMin - avgExcludingToday);
    if (diff < 0) return `평균 대비 오늘 ${diff}분`;
    if (diff > 0) return `평균 대비 오늘 +${diff}분`;
    return '평소와 같음';
  }, [days, todayIndex]);

  if (days.length === 0 || !hasAnyData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이번 주 추이</Text>
        <Text style={styles.emptyText}>이번 주 데이터 부족</Text>
      </View>
    );
  }

  // Bar heights normalize against the busiest data-only day (floor 1 avoids
  // divide-by-zero when the only data day is 0 minutes).
  const maxDuration = Math.max(
    ...days.filter((d) => d.hasData).map((d) => d.durationMin),
    1,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이번 주 추이</Text>
      <Text style={styles.subtitle} testID="weekly-trend-subtitle">
        {subtitle}
      </Text>

      <View style={styles.barsRow}>
        {days.map((day, i) => {
          const heightRatio = day.durationMin / maxDuration;
          // Trust todayIndex as the single source of truth. The caller derives
          // `day.isToday` from the same index, so checking both was redundant.
          // A no-data day never gets the primary "today" treatment — it renders
          // as a neutral ghost placeholder instead.
          const showToday = i === todayIndex && day.hasData;
          return (
            <View
              key={day.dayLabel}
              style={styles.barColumn}
              testID={showToday ? 'weekly-today-bar' : undefined}
            >
              <Text style={[styles.minuteLabel, showToday && styles.minuteLabelToday]}>
                {day.hasData ? `${truncateMinutes(day.durationMin)}분` : '—'}
              </Text>
              <View
                testID={day.hasData ? `weekly-bar-${i}` : `weekly-bar-placeholder-${i}`}
                style={[
                  styles.bar,
                  { height: day.hasData ? BAR_HEIGHT * heightRatio : GHOST_BAR_HEIGHT },
                  day.hasData ? (showToday ? styles.barToday : styles.barRest) : styles.barGhost,
                ]}
              />
              <Text style={[styles.dayLabel, showToday && styles.dayLabelToday]}>
                {day.dayLabel}
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
  barsRow: ViewStyle;
  barColumn: ViewStyle;
  minuteLabel: TextStyle;
  minuteLabelToday: TextStyle;
  bar: ViewStyle;
  barRest: ViewStyle;
  barToday: ViewStyle;
  barGhost: ViewStyle;
  dayLabel: TextStyle;
  dayLabelToday: TextStyle;
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
    barsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      minHeight: BAR_HEIGHT + 50,
    },
    barColumn: {
      alignItems: 'center',
      flex: 1,
    },
    minuteLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginBottom: 6,
    },
    minuteLabelToday: {
      color: semantic.primaryNormal,
      fontFamily: weightToFontFamily('700'),
    },
    bar: {
      width: '70%',
      borderRadius: 8,
      minHeight: 8,
    },
    barRest: { backgroundColor: semantic.bgSubtle },
    barToday: { backgroundColor: semantic.primaryNormal },
    // No-data ghost: same neutral fill as barRest but de-emphasized so an empty
    // weekday reads as "awaiting data", not a real (very short) commute.
    barGhost: { backgroundColor: semantic.bgSubtle, opacity: 0.4 },
    dayLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 8,
    },
    dayLabelToday: {
      color: semantic.primaryNormal,
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

export const WeeklyTrendChart = memo(WeeklyTrendChartComponent);
WeeklyTrendChart.displayName = 'WeeklyTrendChart';
