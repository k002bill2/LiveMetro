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

import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

// ============================================================================
// Types
// ============================================================================

export type WeekdayLabel = '월' | '화' | '수' | '목' | '금';

export interface DayBarData {
  readonly dayLabel: WeekdayLabel;
  readonly durationMin: number;
  readonly isToday: boolean;
}

export interface WeeklyTrendChartProps {
  readonly days: readonly DayBarData[];
  /** Index of "today" within `days`, or -1 when today is not a weekday. */
  readonly todayIndex: number;
  /** Average across all visible days; reserved for future use. */
  readonly averageMin: number;
}

// ============================================================================
// Constants
// ============================================================================

const BAR_HEIGHT = 80;

// ============================================================================
// Component
// ============================================================================

const WeeklyTrendChartComponent: React.FC<WeeklyTrendChartProps> = ({
  days,
  todayIndex,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const subtitle = useMemo(() => {
    if (days.length === 0) return '';
    if (todayIndex === -1) return '이번 주 평일 예측';
    const today = days[todayIndex];
    if (!today) return '';
    const others = days.filter((_, i) => i !== todayIndex);
    const avgExcludingToday =
      others.length > 0
        ? others.reduce((sum, d) => sum + d.durationMin, 0) / others.length
        : 0;
    const diff = Math.round(today.durationMin - avgExcludingToday);
    if (diff < 0) return `평균 대비 오늘 ${diff}분`;
    if (diff > 0) return `평균 대비 오늘 +${diff}분`;
    return '평소와 같음';
  }, [days, todayIndex]);

  if (days.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이번 주 추이</Text>
        <Text style={styles.emptyText}>이번 주 데이터 부족</Text>
      </View>
    );
  }

  const maxDuration = Math.max(...days.map((d) => d.durationMin), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이번 주 추이</Text>
      <Text style={styles.subtitle} testID="weekly-trend-subtitle">
        {subtitle}
      </Text>

      <View style={styles.barsRow}>
        {days.map((day, i) => {
          const heightRatio = day.durationMin / maxDuration;
          const isToday = day.isToday && i === todayIndex;
          return (
            <View
              key={day.dayLabel}
              style={styles.barColumn}
              testID={isToday ? 'weekly-today-bar' : undefined}
            >
              <Text style={[styles.minuteLabel, isToday && styles.minuteLabelToday]}>
                {day.durationMin}분
              </Text>
              <View
                testID={`weekly-bar-${i}`}
                style={[
                  styles.bar,
                  { height: BAR_HEIGHT * heightRatio },
                  isToday ? styles.barToday : styles.barRest,
                ]}
              />
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
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
