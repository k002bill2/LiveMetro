/**
 * Historical Congestion Analysis Service
 * Analyzes past congestion patterns and provides insights
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CongestionLevel } from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

/**
 * Congestion trend analysis
 */
export interface CongestionTrendAnalysis {
  readonly stationId: string;
  readonly lineId: string;
  readonly period: 'daily' | 'weekly' | 'monthly';
  readonly startDate: Date;
  readonly endDate: Date;
  readonly averageLevel: number;
  readonly peakLevel: CongestionLevel;
  readonly peakTime: string;
  readonly trend: 'improving' | 'worsening' | 'stable';
  readonly changePercent: number;
}

/**
 * Station comparison
 */
export interface StationComparison {
  readonly stationId: string;
  readonly stationName: string;
  readonly averageLevel: number;
  readonly peakLevel: number;
  readonly rank: number;
}

/**
 * Time-based pattern
 */
export interface TimePattern {
  readonly hour: number;
  readonly weekdayAvg: number;
  readonly weekendAvg: number;
  readonly peakDays: number[]; // Days with highest congestion at this hour
}

/**
 * Anomaly detection result
 */
export interface CongestionAnomaly {
  readonly timestamp: Date;
  readonly stationId: string;
  readonly lineId: string;
  readonly expectedLevel: number;
  readonly actualLevel: number;
  readonly deviation: number; // Standard deviations from mean
  readonly severity: 'minor' | 'moderate' | 'severe';
}

/**
 * Historical data record
 */
interface HistoricalRecord {
  timestamp: number;
  stationId: string;
  lineId: string;
  direction: 'up' | 'down';
  level: CongestionLevel;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:congestion_analysis_history';
const ANOMALY_THRESHOLD = 2; // Standard deviations

// ============================================================================
// Service
// ============================================================================

class HistoricalAnalysisService {
  private records: HistoricalRecord[] = [];
  private initialized = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.records = JSON.parse(data);
      }
    } catch {
      this.records = [];
    }

    this.initialized = true;
  }

  /**
   * Add historical record
   */
  async addRecord(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    level: CongestionLevel
  ): Promise<void> {
    await this.initialize();

    this.records.push({
      timestamp: Date.now(),
      stationId,
      lineId,
      direction,
      level,
    });

    // Keep last 10000 records
    if (this.records.length > 10000) {
      this.records = this.records.slice(-10000);
    }

    await this.saveRecords();
  }

  /**
   * Analyze congestion trend
   */
  async analyzeTrend(
    stationId: string,
    lineId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<CongestionTrendAnalysis> {
    await this.initialize();

    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'daily':
        periodMs = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        periodMs = 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const startTime = now - periodMs;
    const midTime = now - periodMs / 2;

    const relevantRecords = this.records.filter(
      r =>
        r.stationId === stationId &&
        r.lineId === lineId &&
        r.timestamp >= startTime
    );

    // Split into first half and second half
    const firstHalf = relevantRecords.filter(r => r.timestamp < midTime);
    const secondHalf = relevantRecords.filter(r => r.timestamp >= midTime);

    const levelToNum = this.levelToNumber.bind(this);

    const firstAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, r) => sum + levelToNum(r.level), 0) / firstHalf.length
        : 2;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, r) => sum + levelToNum(r.level), 0) / secondHalf.length
        : 2;

    const overallAvg =
      relevantRecords.length > 0
        ? relevantRecords.reduce((sum, r) => sum + levelToNum(r.level), 0) / relevantRecords.length
        : 2;

    // Find peak
    const levelCounts = new Map<CongestionLevel, number>();
    let peakTime = '08:00';
    let maxLevel = CongestionLevel.LOW;

    for (const record of relevantRecords) {
      const count = (levelCounts.get(record.level) ?? 0) + 1;
      levelCounts.set(record.level, count);

      if (this.levelToNumber(record.level) > this.levelToNumber(maxLevel)) {
        maxLevel = record.level;
        peakTime = new Date(record.timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    // Calculate trend
    const change = secondAvg - firstAvg;
    const changePercent = firstAvg > 0 ? (change / firstAvg) * 100 : 0;

    let trend: 'improving' | 'worsening' | 'stable';
    if (change > 0.2) trend = 'worsening';
    else if (change < -0.2) trend = 'improving';
    else trend = 'stable';

    return {
      stationId,
      lineId,
      period,
      startDate: new Date(startTime),
      endDate: new Date(now),
      averageLevel: overallAvg,
      peakLevel: maxLevel,
      peakTime,
      trend,
      changePercent,
    };
  }

  /**
   * Compare stations on a line
   */
  async compareStations(
    lineId: string,
    stationIds: readonly string[],
    stationNames: readonly string[]
  ): Promise<StationComparison[]> {
    await this.initialize();

    const comparisons: StationComparison[] = [];

    for (let i = 0; i < stationIds.length; i++) {
      const stationId = stationIds[i];
      const stationName = stationNames[i];

      if (!stationId || !stationName) continue;

      const stationRecords = this.records.filter(
        r => r.stationId === stationId && r.lineId === lineId
      );

      if (stationRecords.length === 0) {
        comparisons.push({
          stationId,
          stationName,
          averageLevel: 2,
          peakLevel: 2,
          rank: 0,
        });
        continue;
      }

      const levels = stationRecords.map(r => this.levelToNumber(r.level));
      const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
      const peak = Math.max(...levels);

      comparisons.push({
        stationId,
        stationName,
        averageLevel: avg,
        peakLevel: peak,
        rank: 0,
      });
    }

    // Sort by average level (descending) and assign ranks
    comparisons.sort((a, b) => b.averageLevel - a.averageLevel);
    comparisons.forEach((c, i) => {
      (c as { rank: number }).rank = i + 1;
    });

    return comparisons;
  }

  /**
   * Get time-based patterns
   */
  async getTimePatterns(
    stationId: string,
    lineId: string
  ): Promise<TimePattern[]> {
    await this.initialize();

    const patterns: TimePattern[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourRecords = this.records.filter(
        r =>
          r.stationId === stationId &&
          r.lineId === lineId &&
          new Date(r.timestamp).getHours() === hour
      );

      const weekdayRecords = hourRecords.filter(r => {
        const day = new Date(r.timestamp).getDay();
        return day >= 1 && day <= 5;
      });

      const weekendRecords = hourRecords.filter(r => {
        const day = new Date(r.timestamp).getDay();
        return day === 0 || day === 6;
      });

      const weekdayAvg =
        weekdayRecords.length > 0
          ? weekdayRecords.reduce((sum, r) => sum + this.levelToNumber(r.level), 0) /
            weekdayRecords.length
          : 2;

      const weekendAvg =
        weekendRecords.length > 0
          ? weekendRecords.reduce((sum, r) => sum + this.levelToNumber(r.level), 0) /
            weekendRecords.length
          : 1.5;

      // Find peak days for this hour
      const dayLevels = new Map<number, number[]>();
      for (const record of hourRecords) {
        const day = new Date(record.timestamp).getDay();
        const levels = dayLevels.get(day) ?? [];
        levels.push(this.levelToNumber(record.level));
        dayLevels.set(day, levels);
      }

      const dayAverages = Array.from(dayLevels.entries()).map(([day, levels]) => ({
        day,
        avg: levels.reduce((a, b) => a + b, 0) / levels.length,
      }));

      dayAverages.sort((a, b) => b.avg - a.avg);
      const peakDays = dayAverages.slice(0, 2).map(d => d.day);

      patterns.push({
        hour,
        weekdayAvg,
        weekendAvg,
        peakDays,
      });
    }

    return patterns;
  }

  /**
   * Detect anomalies in congestion data
   */
  async detectAnomalies(
    stationId: string,
    lineId: string,
    hours: number = 24
  ): Promise<CongestionAnomaly[]> {
    await this.initialize();

    const anomalies: CongestionAnomaly[] = [];
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    const recentRecords = this.records.filter(
      r =>
        r.stationId === stationId &&
        r.lineId === lineId &&
        r.timestamp >= cutoff
    );

    if (recentRecords.length < 5) return anomalies;

    // Calculate expected values by hour
    const hourlyExpected = new Map<number, { mean: number; stdDev: number }>();

    for (let hour = 0; hour < 24; hour++) {
      const hourRecords = this.records.filter(
        r =>
          r.stationId === stationId &&
          r.lineId === lineId &&
          new Date(r.timestamp).getHours() === hour
      );

      if (hourRecords.length < 3) continue;

      const levels = hourRecords.map(r => this.levelToNumber(r.level));
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      const variance =
        levels.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / levels.length;
      const stdDev = Math.sqrt(variance);

      hourlyExpected.set(hour, { mean, stdDev: stdDev || 0.5 });
    }

    // Check for anomalies
    for (const record of recentRecords) {
      const hour = new Date(record.timestamp).getHours();
      const expected = hourlyExpected.get(hour);

      if (!expected) continue;

      const actualLevel = this.levelToNumber(record.level);
      const deviation = Math.abs(actualLevel - expected.mean) / expected.stdDev;

      if (deviation >= ANOMALY_THRESHOLD) {
        let severity: 'minor' | 'moderate' | 'severe';
        if (deviation >= 3) severity = 'severe';
        else if (deviation >= 2.5) severity = 'moderate';
        else severity = 'minor';

        anomalies.push({
          timestamp: new Date(record.timestamp),
          stationId,
          lineId,
          expectedLevel: expected.mean,
          actualLevel,
          deviation,
          severity,
        });
      }
    }

    return anomalies;
  }

  /**
   * Get summary statistics
   */
  async getSummaryStats(
    stationId: string,
    lineId: string
  ): Promise<{
    totalRecords: number;
    avgLevel: number;
    mostCommonLevel: CongestionLevel;
    peakHours: number[];
    lowHours: number[];
  }> {
    await this.initialize();

    const stationRecords = this.records.filter(
      r => r.stationId === stationId && r.lineId === lineId
    );

    if (stationRecords.length === 0) {
      return {
        totalRecords: 0,
        avgLevel: 2,
        mostCommonLevel: CongestionLevel.MODERATE,
        peakHours: [8, 18],
        lowHours: [3, 4, 5],
      };
    }

    // Calculate average
    const levels = stationRecords.map(r => this.levelToNumber(r.level));
    const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;

    // Find most common level
    const levelCounts = new Map<CongestionLevel, number>();
    for (const record of stationRecords) {
      levelCounts.set(record.level, (levelCounts.get(record.level) ?? 0) + 1);
    }
    let mostCommonLevel = CongestionLevel.MODERATE;
    let maxCount = 0;
    for (const [level, count] of levelCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLevel = level;
      }
    }

    // Find peak and low hours
    const hourlyAvg = new Map<number, number>();
    for (let hour = 0; hour < 24; hour++) {
      const hourRecords = stationRecords.filter(
        r => new Date(r.timestamp).getHours() === hour
      );
      if (hourRecords.length > 0) {
        const avg =
          hourRecords.reduce((sum, r) => sum + this.levelToNumber(r.level), 0) /
          hourRecords.length;
        hourlyAvg.set(hour, avg);
      }
    }

    const sortedHours = Array.from(hourlyAvg.entries()).sort((a, b) => b[1] - a[1]);
    const peakHours = sortedHours.slice(0, 3).map(([hour]) => hour);
    const lowHours = sortedHours.slice(-3).map(([hour]) => hour);

    return {
      totalRecords: stationRecords.length,
      avgLevel,
      mostCommonLevel,
      peakHours,
      lowHours,
    };
  }

  /**
   * Clear all records
   */
  async clearRecords(): Promise<void> {
    this.records = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private levelToNumber(level: CongestionLevel): number {
    const mapping: Record<CongestionLevel, number> = {
      [CongestionLevel.LOW]: 1,
      [CongestionLevel.MODERATE]: 2,
      [CongestionLevel.HIGH]: 3,
      [CongestionLevel.CROWDED]: 4,
    };
    return mapping[level];
  }

  private async saveRecords(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const historicalAnalysisService = new HistoricalAnalysisService();
export default historicalAnalysisService;
