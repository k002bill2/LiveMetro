/**
 * Statistics Service
 * Aggregates and analyzes user commute data for dashboard display
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayOfWeek, CommuteLog } from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

/**
 * Daily statistics
 */
export interface DailyStats {
  readonly date: string;
  readonly totalTrips: number;
  readonly delayedTrips: number;
  readonly totalDelayMinutes: number;
  readonly avgDelayMinutes: number;
  readonly onTimeRate: number;
  readonly mostUsedLine?: string;
  readonly mostUsedStation?: string;
}

/**
 * Weekly statistics
 */
export interface WeeklyStats {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly totalTrips: number;
  readonly delayedTrips: number;
  readonly avgDelayMinutes: number;
  readonly onTimeRate: number;
  readonly dailyBreakdown: readonly DailyStats[];
  readonly byDayOfWeek: Record<DayOfWeek, number>;
  readonly mostDelayedDay: DayOfWeek | null;
}

/**
 * Monthly statistics
 */
export interface MonthlyStats {
  readonly month: string;
  readonly year: number;
  readonly totalTrips: number;
  readonly delayedTrips: number;
  readonly avgDelayMinutes: number;
  readonly onTimeRate: number;
  readonly weeklyBreakdown: readonly WeeklyStats[];
  readonly byLine: Record<string, number>;
  readonly trend: 'improving' | 'declining' | 'stable';
}

/**
 * Overall statistics summary
 */
export interface StatsSummary {
  readonly totalTrips: number;
  readonly totalDelayMinutes: number;
  readonly avgDelayMinutes: number;
  readonly onTimeRate: number;
  readonly mostUsedLine: string | null;
  readonly mostUsedStation: string | null;
  readonly mostDelayedLine: string | null;
  readonly streakDays: number;
  readonly lastTripDate: string | null;
  readonly memberSince: string;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  readonly x: string | number;
  readonly y: number;
  readonly label?: string;
}

/**
 * Line usage data
 */
export interface LineUsageData {
  readonly lineId: string;
  readonly lineName: string;
  readonly tripCount: number;
  readonly percentage: number;
  readonly color: string;
}

/**
 * Delay distribution
 */
export interface DelayDistribution {
  readonly range: string;
  readonly count: number;
  readonly percentage: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:statistics_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Cache duration check utility
export function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION_MS;
}

const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};

const LINE_NAMES: Record<string, string> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
};

// ============================================================================
// Service
// ============================================================================

class StatisticsService {
  private cache: {
    data: StatsSummary | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  /**
   * Calculate summary statistics
   */
  async calculateSummary(logs: readonly CommuteLog[]): Promise<StatsSummary> {
    if (logs.length === 0) {
      return this.getEmptySummary();
    }

    const totalTrips = logs.length;
    const delayedLogs = logs.filter(l => l.wasDelayed);
    const totalDelayMinutes = logs.reduce((sum, l) => sum + (l.delayMinutes ?? 0), 0);
    const avgDelayMinutes = totalDelayMinutes / totalTrips;
    const onTimeRate = (totalTrips - delayedLogs.length) / totalTrips;

    // Most used line (use first lineId from lineIds array)
    const lineCounts = this.countLineIds(logs);
    const mostUsedLine = this.getMaxKey(lineCounts);

    // Most used station
    const stationCounts = this.countByField(logs, 'departureStationId');
    const mostUsedStation = this.getMaxKey(stationCounts);

    // Most delayed line
    const delayByLine = new Map<string, number>();
    for (const log of delayedLogs) {
      const lineId = log.lineIds[0] ?? 'unknown';
      const current = delayByLine.get(lineId) ?? 0;
      delayByLine.set(lineId, current + (log.delayMinutes ?? 0));
    }
    const mostDelayedLine = this.getMaxKey(Object.fromEntries(delayByLine));

    // Streak calculation
    const streakDays = this.calculateStreak(logs);

    // Sort by date
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const summary: StatsSummary = {
      totalTrips,
      totalDelayMinutes,
      avgDelayMinutes: Math.round(avgDelayMinutes * 10) / 10,
      onTimeRate: Math.round(onTimeRate * 1000) / 10,
      mostUsedLine: mostUsedLine ? LINE_NAMES[mostUsedLine] ?? mostUsedLine : null,
      mostUsedStation,
      mostDelayedLine: mostDelayedLine ? LINE_NAMES[mostDelayedLine] ?? mostDelayedLine : null,
      streakDays,
      lastTripDate: sortedLogs[0]?.date ?? null,
      memberSince: sortedLogs[sortedLogs.length - 1]?.date ?? new Date().toISOString().split('T')[0]!,
    };

    this.cache = { data: summary, timestamp: Date.now() };
    await this.saveCache();

    return summary;
  }

  /**
   * Get daily statistics
   */
  getDailyStats(logs: readonly CommuteLog[], date: string): DailyStats {
    const dayLogs = logs.filter(l => l.date === date);

    if (dayLogs.length === 0) {
      return {
        date,
        totalTrips: 0,
        delayedTrips: 0,
        totalDelayMinutes: 0,
        avgDelayMinutes: 0,
        onTimeRate: 100,
      };
    }

    const delayedLogs = dayLogs.filter(l => l.wasDelayed);
    const totalDelayMinutes = dayLogs.reduce((sum, l) => sum + (l.delayMinutes ?? 0), 0);

    const lineCounts = this.countLineIds(dayLogs);
    const stationCounts = this.countByField(dayLogs, 'departureStationId');

    return {
      date,
      totalTrips: dayLogs.length,
      delayedTrips: delayedLogs.length,
      totalDelayMinutes,
      avgDelayMinutes: dayLogs.length > 0 ? totalDelayMinutes / dayLogs.length : 0,
      onTimeRate: ((dayLogs.length - delayedLogs.length) / dayLogs.length) * 100,
      mostUsedLine: LINE_NAMES[this.getMaxKey(lineCounts) ?? ''],
      mostUsedStation: this.getMaxKey(stationCounts) ?? undefined,
    };
  }

  /**
   * Get weekly statistics
   */
  getWeeklyStats(logs: readonly CommuteLog[], weekStart: Date): WeeklyStats {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekLogs = logs.filter(l => {
      const logDate = new Date(l.date);
      return logDate >= weekStart && logDate <= weekEnd;
    });

    const dailyBreakdown: DailyStats[] = [];
    const byDayOfWeek: Record<DayOfWeek, number> = {
      0: 0, // Sunday
      1: 0, // Monday
      2: 0, // Tuesday
      3: 0, // Wednesday
      4: 0, // Thursday
      5: 0, // Friday
      6: 0, // Saturday
    };

    // Generate daily stats for the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]!;
      dailyBreakdown.push(this.getDailyStats(logs, dateStr));
    }

    // Count by day of week
    for (const log of weekLogs) {
      byDayOfWeek[log.dayOfWeek]++;
    }

    // Find most delayed day
    const delayByDay = new Map<DayOfWeek, number>();
    for (const log of weekLogs.filter(l => l.wasDelayed)) {
      const current = delayByDay.get(log.dayOfWeek) ?? 0;
      delayByDay.set(log.dayOfWeek, current + (log.delayMinutes ?? 0));
    }

    let mostDelayedDay: DayOfWeek | null = null;
    let maxDelay = 0;
    for (const [day, delay] of delayByDay) {
      if (delay > maxDelay) {
        maxDelay = delay;
        mostDelayedDay = day;
      }
    }

    const delayedLogs = weekLogs.filter(l => l.wasDelayed);
    const totalDelayMinutes = weekLogs.reduce((sum, l) => sum + (l.delayMinutes ?? 0), 0);

    return {
      weekStart: weekStart.toISOString().split('T')[0]!,
      weekEnd: weekEnd.toISOString().split('T')[0]!,
      totalTrips: weekLogs.length,
      delayedTrips: delayedLogs.length,
      avgDelayMinutes: weekLogs.length > 0 ? totalDelayMinutes / weekLogs.length : 0,
      onTimeRate: weekLogs.length > 0
        ? ((weekLogs.length - delayedLogs.length) / weekLogs.length) * 100
        : 100,
      dailyBreakdown,
      byDayOfWeek,
      mostDelayedDay,
    };
  }

  /**
   * Get line usage data for pie chart
   */
  getLineUsageData(logs: readonly CommuteLog[]): readonly LineUsageData[] {
    const lineCounts = this.countLineIds(logs);
    const total = Object.values(lineCounts).reduce((sum, c) => sum + c, 0);

    return Object.entries(lineCounts)
      .map(([lineId, count]) => ({
        lineId,
        lineName: LINE_NAMES[lineId] ?? `${lineId}호선`,
        tripCount: count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        color: LINE_COLORS[lineId] ?? '#888888',
      }))
      .sort((a, b) => b.tripCount - a.tripCount);
  }

  /**
   * Get delay distribution
   */
  getDelayDistribution(logs: readonly CommuteLog[]): readonly DelayDistribution[] {
    const ranges = [
      { label: '정시', min: 0, max: 0 },
      { label: '1-5분', min: 1, max: 5 },
      { label: '6-10분', min: 6, max: 10 },
      { label: '11-20분', min: 11, max: 20 },
      { label: '20분+', min: 21, max: Infinity },
    ];

    const total = logs.length;
    const counts: number[] = new Array(ranges.length).fill(0);

    for (const log of logs) {
      const delay = log.delayMinutes ?? 0;
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (range && delay >= range.min && delay <= range.max) {
          counts[i]!++;
          break;
        }
      }
    }

    return ranges.map((range, i) => ({
      range: range.label,
      count: counts[i] ?? 0,
      percentage: total > 0 ? Math.round(((counts[i] ?? 0) / total) * 1000) / 10 : 0,
    }));
  }

  /**
   * Get weekly trend chart data
   */
  getWeeklyTrendData(
    logs: readonly CommuteLog[],
    weeks = 8
  ): readonly ChartDataPoint[] {
    const data: ChartDataPoint[] = [];
    const today = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const stats = this.getWeeklyStats(logs, weekStart);

      data.push({
        x: `W${weeks - i}`,
        y: stats.onTimeRate,
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      });
    }

    return data;
  }

  /**
   * Get hourly distribution chart data
   */
  getHourlyDistributionData(logs: readonly CommuteLog[]): readonly ChartDataPoint[] {
    const hourCounts: number[] = new Array(24).fill(0);

    for (const log of logs) {
      const hour = parseInt(log.departureTime.split(':')[0] ?? '0', 10);
      if (hour >= 0 && hour < 24) {
        hourCounts[hour]!++;
      }
    }

    return hourCounts.map((count, hour) => ({
      x: hour,
      y: count,
      label: `${hour}:00`,
    }));
  }

  /**
   * Get delay minutes by day chart data
   */
  getDelayByDayData(logs: readonly CommuteLog[]): readonly ChartDataPoint[] {
    const dayOrder: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
    const dayLabels: Record<DayOfWeek, string> = {
      0: '일',
      1: '월',
      2: '화',
      3: '수',
      4: '목',
      5: '금',
      6: '토',
    };

    const delayByDay: Record<DayOfWeek, { total: number; count: number }> = {
      0: { total: 0, count: 0 },
      1: { total: 0, count: 0 },
      2: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      4: { total: 0, count: 0 },
      5: { total: 0, count: 0 },
      6: { total: 0, count: 0 },
    };

    for (const log of logs) {
      delayByDay[log.dayOfWeek].total += log.delayMinutes ?? 0;
      delayByDay[log.dayOfWeek].count++;
    }

    return dayOrder.map(day => ({
      x: dayLabels[day],
      y: delayByDay[day].count > 0
        ? Math.round((delayByDay[day].total / delayByDay[day].count) * 10) / 10
        : 0,
    }));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Count occurrences by field
   */
  private countByField(
    logs: readonly CommuteLog[],
    field: keyof CommuteLog
  ): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const log of logs) {
      const value = String(log[field]);
      counts[value] = (counts[value] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Count line IDs from lineIds arrays
   */
  private countLineIds(logs: readonly CommuteLog[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const log of logs) {
      for (const lineId of log.lineIds) {
        counts[lineId] = (counts[lineId] ?? 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get key with maximum value
   */
  private getMaxKey(obj: Record<string, number>): string | null {
    let maxKey: string | null = null;
    let maxValue = -Infinity;

    for (const [key, value] of Object.entries(obj)) {
      if (value > maxValue) {
        maxValue = value;
        maxKey = key;
      }
    }

    return maxKey;
  }

  /**
   * Calculate consecutive day streak
   */
  private calculateStreak(logs: readonly CommuteLog[]): number {
    if (logs.length === 0) return 0;

    const uniqueDates = new Set(logs.map(l => l.date));
    const sortedDates = Array.from(uniqueDates).sort().reverse();

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (uniqueDates.has(dateStr!)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get empty summary
   */
  private getEmptySummary(): StatsSummary {
    return {
      totalTrips: 0,
      totalDelayMinutes: 0,
      avgDelayMinutes: 0,
      onTimeRate: 100,
      mostUsedLine: null,
      mostUsedStation: null,
      mostDelayedLine: null,
      streakDays: 0,
      lastTripDate: null,
      memberSince: new Date().toISOString().split('T')[0]!,
    };
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const statisticsService = new StatisticsService();
export default statisticsService;
