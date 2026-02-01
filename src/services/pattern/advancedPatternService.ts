/**
 * Advanced Pattern Analysis Service
 * Deep learning-like pattern recognition for commute optimization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommuteLog, DayOfWeek, parseTimeToMinutes, formatMinutesToTime } from '@/models/pattern';
import { WeatherCondition } from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

/**
 * Advanced pattern result
 */
export interface AdvancedPattern {
  readonly userId: string;
  readonly patternType: PatternType;
  readonly confidence: number;
  readonly description: string;
  readonly recommendations: readonly string[];
  readonly metadata: PatternMetadata;
}

/**
 * Pattern types
 */
export type PatternType =
  | 'consistent'      // Very regular schedule
  | 'variable'        // Changes by day
  | 'weather_sensitive' // Affected by weather
  | 'delay_prone'     // Frequently delayed
  | 'early_bird'      // Consistently early
  | 'flexible'        // No strong pattern
  | 'weekend_warrior'; // Different weekend behavior

/**
 * Pattern metadata
 */
export interface PatternMetadata {
  readonly sampleSize: number;
  readonly dateRange: { start: Date; end: Date };
  readonly avgDepartureTime: string;
  readonly stdDevMinutes: number;
  readonly delayRate: number;
  readonly peakDays: readonly DayOfWeek[];
}

/**
 * Time cluster
 */
interface TimeCluster {
  centerMinutes: number;
  count: number;
  logs: CommuteLog[];
}

/**
 * Day pattern
 */
interface DayPattern {
  dayOfWeek: DayOfWeek;
  avgDeparture: number;
  variance: number;
  sampleCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:advanced_patterns';
const MIN_SAMPLES = 5;
const CLUSTER_THRESHOLD_MINUTES = 15;

// ============================================================================
// Service
// ============================================================================

class AdvancedPatternService {
  private cachedPatterns: Map<string, AdvancedPattern> = new Map();

  /**
   * Analyze patterns for a user
   */
  async analyzePatterns(
    userId: string,
    logs: readonly CommuteLog[]
  ): Promise<AdvancedPattern | null> {
    if (logs.length < MIN_SAMPLES) {
      return null;
    }

    // Analyze various pattern aspects
    const timeAnalysis = this.analyzeTimePatterns(logs);
    const dayAnalysis = this.analyzeDayPatterns(logs);
    const delayAnalysis = this.analyzeDelayPatterns(logs);
    const variabilityAnalysis = this.analyzeVariability(logs);

    // Determine primary pattern type
    const patternType = this.determinePatternType(
      timeAnalysis,
      dayAnalysis,
      delayAnalysis,
      variabilityAnalysis
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      patternType,
      timeAnalysis,
      delayAnalysis
    );

    // Create metadata
    const metadata: PatternMetadata = {
      sampleSize: logs.length,
      dateRange: this.getDateRange(logs),
      avgDepartureTime: formatMinutesToTime(timeAnalysis.avgMinutes),
      stdDevMinutes: timeAnalysis.stdDev,
      delayRate: delayAnalysis.rate,
      peakDays: dayAnalysis.peakDays,
    };

    const pattern: AdvancedPattern = {
      userId,
      patternType,
      confidence: this.calculateConfidence(logs.length, timeAnalysis.stdDev),
      description: this.getPatternDescription(patternType),
      recommendations,
      metadata,
    };

    // Cache pattern
    this.cachedPatterns.set(userId, pattern);
    await this.savePatterns();

    return pattern;
  }

  /**
   * Get cached pattern
   */
  getCachedPattern(userId: string): AdvancedPattern | null {
    return this.cachedPatterns.get(userId) ?? null;
  }

  /**
   * Get optimal departure time
   */
  async getOptimalDepartureTime(
    logs: readonly CommuteLog[],
    targetDay: DayOfWeek,
    weather?: WeatherCondition
  ): Promise<{
    optimalTime: string;
    confidence: number;
    adjustmentMinutes: number;
    reason: string;
  }> {
    const dayLogs = logs.filter(l => l.dayOfWeek === targetDay);

    if (dayLogs.length < 2) {
      // Use overall average
      const allMinutes = logs.map(l => parseTimeToMinutes(l.departureTime));
      const avg = allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length;

      return {
        optimalTime: formatMinutesToTime(avg),
        confidence: 0.3,
        adjustmentMinutes: 0,
        reason: '데이터가 부족하여 전체 평균 시간을 사용합니다',
      };
    }

    // Calculate base optimal time
    const minutes = dayLogs.map(l => parseTimeToMinutes(l.departureTime));
    const baseOptimal = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);

    // Adjust for delays
    const delayedLogs = dayLogs.filter(l => l.wasDelayed);
    const delayRate = delayedLogs.length / dayLogs.length;

    let adjustment = 0;
    let reason = '';

    if (delayRate > 0.3) {
      adjustment = -10; // Leave 10 minutes earlier
      reason = '이 요일에 지연이 자주 발생합니다';
    }

    // Weather adjustment
    if (weather === 'rain' || weather === 'snow') {
      adjustment -= 5;
      reason = reason || '날씨로 인한 지연이 예상됩니다';
    }

    const optimalMinutes = baseOptimal + adjustment;

    return {
      optimalTime: formatMinutesToTime(optimalMinutes),
      confidence: Math.min(0.9, dayLogs.length / 10),
      adjustmentMinutes: adjustment,
      reason: reason || '평균 출발 시간 기반',
    };
  }

  /**
   * Detect anomalies in commute patterns
   */
  detectAnomalies(logs: readonly CommuteLog[]): readonly {
    log: CommuteLog;
    anomalyType: string;
    severity: number;
  }[] {
    if (logs.length < MIN_SAMPLES) return [];

    const anomalies: { log: CommuteLog; anomalyType: string; severity: number }[] = [];

    // Calculate baseline statistics
    const times = logs.map(l => parseTimeToMinutes(l.departureTime));
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!log) continue;

      const time = times[i] ?? 0;
      const zscore = stdDev > 0 ? Math.abs(time - mean) / stdDev : 0;

      // Time anomaly
      if (zscore > 2) {
        anomalies.push({
          log,
          anomalyType: time > mean ? 'unusually_late' : 'unusually_early',
          severity: zscore,
        });
      }

      // Delay anomaly
      if (log.wasDelayed && log.delayMinutes && log.delayMinutes > 20) {
        anomalies.push({
          log,
          anomalyType: 'significant_delay',
          severity: log.delayMinutes / 10,
        });
      }
    }

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Predict delay probability
   */
  predictDelayProbability(
    logs: readonly CommuteLog[],
    targetDay: DayOfWeek,
    targetTime: string,
    weather?: WeatherCondition
  ): number {
    // Base probability from historical data
    const dayLogs = logs.filter(l => l.dayOfWeek === targetDay);
    if (dayLogs.length === 0) return 0.1; // Default low probability

    const delayedCount = dayLogs.filter(l => l.wasDelayed).length;
    let probability = delayedCount / dayLogs.length;

    // Time-based adjustment
    const targetMinutes = parseTimeToMinutes(targetTime);
    const peakHours = [
      { start: 7 * 60, end: 9 * 60 },   // Morning peak
      { start: 18 * 60, end: 20 * 60 }, // Evening peak
    ];

    for (const peak of peakHours) {
      if (targetMinutes >= peak.start && targetMinutes <= peak.end) {
        probability *= 1.3; // 30% increase during peak
        break;
      }
    }

    // Weather adjustment
    if (weather === 'rain') probability *= 1.2;
    if (weather === 'snow') probability *= 1.5;
    if (weather === 'fog') probability *= 1.1;

    return Math.min(1, probability);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Analyze time patterns
   */
  private analyzeTimePatterns(logs: readonly CommuteLog[]): {
    avgMinutes: number;
    stdDev: number;
    clusters: TimeCluster[];
  } {
    const times = logs.map(l => parseTimeToMinutes(l.departureTime));
    const avgMinutes = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - avgMinutes, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Simple clustering
    const clusters: TimeCluster[] = [];
    const sorted = [...logs].sort((a, b) =>
      parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime)
    );

    for (const log of sorted) {
      const time = parseTimeToMinutes(log.departureTime);
      let addedToCluster = false;

      for (const cluster of clusters) {
        if (Math.abs(time - cluster.centerMinutes) <= CLUSTER_THRESHOLD_MINUTES) {
          cluster.logs.push(log);
          cluster.count++;
          cluster.centerMinutes = cluster.logs.reduce(
            (sum, l) => sum + parseTimeToMinutes(l.departureTime), 0
          ) / cluster.logs.length;
          addedToCluster = true;
          break;
        }
      }

      if (!addedToCluster) {
        clusters.push({ centerMinutes: time, count: 1, logs: [log] });
      }
    }

    return { avgMinutes, stdDev, clusters };
  }

  /**
   * Analyze day patterns
   */
  private analyzeDayPatterns(logs: readonly CommuteLog[]): {
    patterns: DayPattern[];
    peakDays: DayOfWeek[];
  } {
    const byDay = new Map<DayOfWeek, CommuteLog[]>();

    for (const log of logs) {
      const existing = byDay.get(log.dayOfWeek) ?? [];
      existing.push(log);
      byDay.set(log.dayOfWeek, existing);
    }

    const patterns: DayPattern[] = [];

    for (const [day, dayLogs] of byDay) {
      const times = dayLogs.map(l => parseTimeToMinutes(l.departureTime));
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / times.length;

      patterns.push({
        dayOfWeek: day,
        avgDeparture: avg,
        variance,
        sampleCount: dayLogs.length,
      });
    }

    // Find peak days (earliest departure)
    const sorted = [...patterns].sort((a, b) => a.avgDeparture - b.avgDeparture);
    const peakDays = sorted.slice(0, 2).map(p => p.dayOfWeek);

    return { patterns, peakDays };
  }

  /**
   * Analyze delay patterns
   */
  private analyzeDelayPatterns(logs: readonly CommuteLog[]): {
    rate: number;
    avgDelayMinutes: number;
    mostDelayedDay: DayOfWeek | null;
  } {
    const delayed = logs.filter(l => l.wasDelayed);
    const rate = delayed.length / logs.length;

    const avgDelayMinutes = delayed.length > 0
      ? delayed.reduce((sum, l) => sum + (l.delayMinutes ?? 0), 0) / delayed.length
      : 0;

    // Find most delayed day
    const delayByDay = new Map<DayOfWeek, number>();
    for (const log of delayed) {
      delayByDay.set(log.dayOfWeek, (delayByDay.get(log.dayOfWeek) ?? 0) + 1);
    }

    let mostDelayedDay: DayOfWeek | null = null;
    let maxDelays = 0;
    for (const [day, count] of delayByDay) {
      if (count > maxDelays) {
        maxDelays = count;
        mostDelayedDay = day;
      }
    }

    return { rate, avgDelayMinutes, mostDelayedDay };
  }

  /**
   * Analyze variability
   */
  private analyzeVariability(logs: readonly CommuteLog[]): {
    coefficient: number;
    isConsistent: boolean;
  } {
    const times = logs.map(l => parseTimeToMinutes(l.departureTime));
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(
      times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length
    );

    const coefficient = mean > 0 ? stdDev / mean : 0;
    const isConsistent = coefficient < 0.1;

    return { coefficient, isConsistent };
  }

  /**
   * Determine pattern type
   */
  private determinePatternType(
    timeAnalysis: { stdDev: number },
    dayAnalysis: { patterns: DayPattern[] },
    delayAnalysis: { rate: number },
    variabilityAnalysis: { isConsistent: boolean }
  ): PatternType {
    if (variabilityAnalysis.isConsistent) return 'consistent';
    if (delayAnalysis.rate > 0.3) return 'delay_prone';

    const dayVariances = dayAnalysis.patterns.map(p => p.variance);
    const avgDayVariance = dayVariances.reduce((a, b) => a + b, 0) / dayVariances.length;

    if (avgDayVariance < 100) return 'variable';
    if (timeAnalysis.stdDev > 30) return 'flexible';

    return 'variable';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    patternType: PatternType,
    timeAnalysis: { avgMinutes: number },
    delayAnalysis: { rate: number; avgDelayMinutes: number }
  ): string[] {
    const recommendations: string[] = [];

    switch (patternType) {
      case 'consistent':
        recommendations.push('출퇴근 패턴이 일정합니다. 현재 스케줄을 유지하세요.');
        break;
      case 'delay_prone':
        recommendations.push(`평균 ${Math.round(delayAnalysis.avgDelayMinutes)}분 지연이 발생합니다.`);
        recommendations.push('여유 시간을 두고 출발하세요.');
        break;
      case 'flexible':
        recommendations.push('출발 시간이 다양합니다.');
        recommendations.push('알림 시간을 조정해보세요.');
        break;
    }

    // Peak hour recommendation
    const avgHour = Math.floor(timeAnalysis.avgMinutes / 60);
    if (avgHour >= 8 && avgHour <= 9) {
      recommendations.push('출근 피크 시간입니다. 혼잡에 대비하세요.');
    }

    return recommendations;
  }

  /**
   * Get pattern description
   */
  private getPatternDescription(type: PatternType): string {
    const descriptions: Record<PatternType, string> = {
      consistent: '일관된 출퇴근 패턴',
      variable: '요일별 다른 패턴',
      weather_sensitive: '날씨에 민감한 패턴',
      delay_prone: '지연 빈발 패턴',
      early_bird: '이른 출근 패턴',
      flexible: '유동적 패턴',
      weekend_warrior: '주말 다른 패턴',
    };
    return descriptions[type];
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(sampleSize: number, stdDev: number): number {
    const sizeFactor = Math.min(sampleSize / 20, 1);
    const consistencyFactor = Math.max(0, 1 - stdDev / 60);
    return (sizeFactor * 0.6 + consistencyFactor * 0.4);
  }

  /**
   * Get date range
   */
  private getDateRange(logs: readonly CommuteLog[]): { start: Date; end: Date } {
    const dates = logs.map(l => new Date(l.date));
    return {
      start: new Date(Math.min(...dates.map(d => d.getTime()))),
      end: new Date(Math.max(...dates.map(d => d.getTime()))),
    };
  }

  /**
   * Save patterns to storage
   */
  private async savePatterns(): Promise<void> {
    try {
      const data = Object.fromEntries(this.cachedPatterns);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const advancedPatternService = new AdvancedPatternService();
export default advancedPatternService;
