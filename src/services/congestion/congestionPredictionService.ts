/**
 * Congestion Prediction Service
 * Predicts future congestion levels based on historical data and patterns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CongestionLevel } from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

/**
 * Congestion prediction for a specific time slot
 */
export interface CongestionPrediction {
  readonly stationId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly timeSlot: string; // HH:mm
  readonly dayOfWeek: number; // 0-6
  readonly predictedLevel: CongestionLevel;
  readonly confidence: number; // 0-1
  readonly historicalAverage: number; // 1-4
  readonly trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Time slot statistics
 */
export interface TimeSlotStats {
  readonly timeSlot: string;
  readonly avgCongestion: number;
  readonly minCongestion: number;
  readonly maxCongestion: number;
  readonly sampleCount: number;
  readonly stdDev: number;
}

/**
 * Hourly congestion pattern
 */
export interface HourlyCongestionPattern {
  readonly stationId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly dayOfWeek: number;
  readonly hourlyStats: readonly TimeSlotStats[];
}

/**
 * Historical data point
 */
interface HistoricalDataPoint {
  timestamp: number;
  stationId: string;
  lineId: string;
  direction: 'up' | 'down';
  congestionLevel: CongestionLevel;
  dayOfWeek: number;
  hour: number;
  minute: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:congestion_history';
const MAX_HISTORY_DAYS = 30;
const TIME_SLOT_INTERVAL = 15; // minutes

// Peak hours configuration
const MORNING_PEAK = { start: 7, end: 9 };
const EVENING_PEAK = { start: 18, end: 20 };

// ============================================================================
// Service
// ============================================================================

class CongestionPredictionService {
  private historyCache: HistoricalDataPoint[] = [];
  private initialized = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.historyCache = JSON.parse(data);
        // Clean old data
        await this.cleanOldData();
      }
    } catch {
      this.historyCache = [];
    }

    this.initialized = true;
  }

  /**
   * Record a congestion observation
   */
  async recordObservation(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    congestionLevel: CongestionLevel
  ): Promise<void> {
    await this.initialize();

    const now = new Date();
    const dataPoint: HistoricalDataPoint = {
      timestamp: now.getTime(),
      stationId,
      lineId,
      direction,
      congestionLevel,
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };

    this.historyCache.push(dataPoint);
    await this.saveHistory();
  }

  /**
   * Predict congestion for a specific time
   */
  async predictCongestion(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    targetTime: Date
  ): Promise<CongestionPrediction> {
    await this.initialize();

    const dayOfWeek = targetTime.getDay();
    const hour = targetTime.getHours();
    const minute = targetTime.getMinutes();
    const timeSlot = this.getTimeSlot(hour, minute);

    // Get historical data for this time slot
    const relevantData = this.getRelevantData(
      stationId,
      lineId,
      direction,
      dayOfWeek,
      hour
    );

    if (relevantData.length === 0) {
      // Use default predictions based on time
      return this.getDefaultPrediction(stationId, lineId, direction, timeSlot, dayOfWeek, hour);
    }

    // Calculate statistics
    const levels = relevantData.map(d => this.levelToNumber(d.congestionLevel));
    const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
    const variance = levels.reduce((a, b) => a + Math.pow(b - avgLevel, 2), 0) / levels.length;
    const stdDev = Math.sqrt(variance);

    // Calculate trend
    const recentData = relevantData.slice(-5);
    const trend = this.calculateTrend(recentData);

    // Determine predicted level
    const predictedLevel = this.numberToLevel(Math.round(avgLevel));

    // Calculate confidence based on sample size and variance
    const sampleFactor = Math.min(relevantData.length / 10, 1);
    const varianceFactor = Math.max(0, 1 - stdDev / 2);
    const confidence = (sampleFactor * 0.6 + varianceFactor * 0.4);

    return {
      stationId,
      lineId,
      direction,
      timeSlot,
      dayOfWeek,
      predictedLevel,
      confidence,
      historicalAverage: avgLevel,
      trend,
    };
  }

  /**
   * Get hourly congestion pattern for a station
   */
  async getHourlyPattern(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    dayOfWeek: number
  ): Promise<HourlyCongestionPattern> {
    await this.initialize();

    const hourlyStats: TimeSlotStats[] = [];

    for (let hour = 5; hour <= 24; hour++) {
      const actualHour = hour === 24 ? 0 : hour;
      const timeSlot = `${actualHour.toString().padStart(2, '0')}:00`;

      const data = this.getRelevantData(
        stationId,
        lineId,
        direction,
        dayOfWeek,
        actualHour
      );

      if (data.length > 0) {
        const levels = data.map(d => this.levelToNumber(d.congestionLevel));
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        const min = Math.min(...levels);
        const max = Math.max(...levels);
        const variance = levels.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / levels.length;

        hourlyStats.push({
          timeSlot,
          avgCongestion: avg,
          minCongestion: min,
          maxCongestion: max,
          sampleCount: levels.length,
          stdDev: Math.sqrt(variance),
        });
      } else {
        // Use estimated values based on typical patterns
        const estimated = this.estimateTypicalCongestion(actualHour, dayOfWeek);
        hourlyStats.push({
          timeSlot,
          avgCongestion: estimated,
          minCongestion: Math.max(1, estimated - 1),
          maxCongestion: Math.min(4, estimated + 1),
          sampleCount: 0,
          stdDev: 0.5,
        });
      }
    }

    return {
      stationId,
      lineId,
      direction,
      dayOfWeek,
      hourlyStats,
    };
  }

  /**
   * Get predictions for the next few hours
   */
  async getUpcomingPredictions(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    hoursAhead: number = 3
  ): Promise<CongestionPrediction[]> {
    const predictions: CongestionPrediction[] = [];
    const now = new Date();

    for (let i = 0; i <= hoursAhead; i++) {
      const targetTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const prediction = await this.predictCongestion(
        stationId,
        lineId,
        direction,
        targetTime
      );
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Get peak hours congestion summary
   */
  async getPeakHoursSummary(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down'
  ): Promise<{
    morningPeak: { avgLevel: number; peakHour: number };
    eveningPeak: { avgLevel: number; peakHour: number };
  }> {
    await this.initialize();

    // Calculate morning peak
    let morningMax = 0;
    let morningPeakHour = MORNING_PEAK.start;
    for (let hour = MORNING_PEAK.start; hour <= MORNING_PEAK.end; hour++) {
      const data = this.historyCache.filter(
        d =>
          d.stationId === stationId &&
          d.lineId === lineId &&
          d.direction === direction &&
          d.hour === hour &&
          d.dayOfWeek >= 1 &&
          d.dayOfWeek <= 5 // Weekdays only
      );
      if (data.length > 0) {
        const avg = data.reduce((a, b) => a + this.levelToNumber(b.congestionLevel), 0) / data.length;
        if (avg > morningMax) {
          morningMax = avg;
          morningPeakHour = hour;
        }
      }
    }

    // Calculate evening peak
    let eveningMax = 0;
    let eveningPeakHour = EVENING_PEAK.start;
    for (let hour = EVENING_PEAK.start; hour <= EVENING_PEAK.end; hour++) {
      const data = this.historyCache.filter(
        d =>
          d.stationId === stationId &&
          d.lineId === lineId &&
          d.direction === direction &&
          d.hour === hour &&
          d.dayOfWeek >= 1 &&
          d.dayOfWeek <= 5
      );
      if (data.length > 0) {
        const avg = data.reduce((a, b) => a + this.levelToNumber(b.congestionLevel), 0) / data.length;
        if (avg > eveningMax) {
          eveningMax = avg;
          eveningPeakHour = hour;
        }
      }
    }

    return {
      morningPeak: {
        avgLevel: morningMax || this.estimateTypicalCongestion(8, 1),
        peakHour: morningPeakHour,
      },
      eveningPeak: {
        avgLevel: eveningMax || this.estimateTypicalCongestion(18, 1),
        peakHour: eveningPeakHour,
      },
    };
  }

  /**
   * Clear all history (for testing)
   */
  async clearHistory(): Promise<void> {
    this.historyCache = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get time slot string
   */
  private getTimeSlot(hour: number, minute: number): string {
    const slotMinute = Math.floor(minute / TIME_SLOT_INTERVAL) * TIME_SLOT_INTERVAL;
    return `${hour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
  }

  /**
   * Get relevant historical data
   */
  private getRelevantData(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    dayOfWeek: number,
    hour: number
  ): HistoricalDataPoint[] {
    return this.historyCache.filter(
      d =>
        d.stationId === stationId &&
        d.lineId === lineId &&
        d.direction === direction &&
        d.dayOfWeek === dayOfWeek &&
        Math.abs(d.hour - hour) <= 1 // Include adjacent hours
    );
  }

  /**
   * Convert congestion level to number
   */
  private levelToNumber(level: CongestionLevel): number {
    const mapping: Record<CongestionLevel, number> = {
      [CongestionLevel.LOW]: 1,
      [CongestionLevel.MODERATE]: 2,
      [CongestionLevel.HIGH]: 3,
      [CongestionLevel.CROWDED]: 4,
    };
    return mapping[level];
  }

  /**
   * Convert number to congestion level
   */
  private numberToLevel(num: number): CongestionLevel {
    if (num <= 1.5) return CongestionLevel.LOW;
    if (num <= 2.5) return CongestionLevel.MODERATE;
    if (num <= 3.5) return CongestionLevel.HIGH;
    return CongestionLevel.CROWDED;
  }

  /**
   * Calculate trend from recent data
   */
  private calculateTrend(
    data: HistoricalDataPoint[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (data.length < 2) return 'stable';

    const levels = data.map(d => this.levelToNumber(d.congestionLevel));
    const firstHalf = levels.slice(0, Math.floor(levels.length / 2));
    const secondHalf = levels.slice(Math.floor(levels.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    if (diff > 0.3) return 'increasing';
    if (diff < -0.3) return 'decreasing';
    return 'stable';
  }

  /**
   * Get default prediction when no historical data
   */
  private getDefaultPrediction(
    stationId: string,
    lineId: string,
    direction: 'up' | 'down',
    timeSlot: string,
    dayOfWeek: number,
    hour: number
  ): CongestionPrediction {
    const estimatedLevel = this.estimateTypicalCongestion(hour, dayOfWeek);

    return {
      stationId,
      lineId,
      direction,
      timeSlot,
      dayOfWeek,
      predictedLevel: this.numberToLevel(estimatedLevel),
      confidence: 0.3, // Low confidence for estimates
      historicalAverage: estimatedLevel,
      trend: 'stable',
    };
  }

  /**
   * Estimate typical congestion based on time patterns
   */
  private estimateTypicalCongestion(hour: number, dayOfWeek: number): number {
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (!isWeekday) {
      // Weekend: generally lower congestion
      if (hour >= 10 && hour <= 18) return 2;
      return 1;
    }

    // Weekday patterns
    if (hour >= MORNING_PEAK.start && hour <= MORNING_PEAK.end) {
      return 3.5; // Morning rush
    }
    if (hour >= EVENING_PEAK.start && hour <= EVENING_PEAK.end) {
      return 3.5; // Evening rush
    }
    if (hour >= 10 && hour <= 16) {
      return 2; // Midday
    }
    if (hour >= 6 && hour < MORNING_PEAK.start) {
      return 2.5; // Pre-morning rush
    }
    if (hour > EVENING_PEAK.end && hour <= 22) {
      return 2.5; // Post-evening rush
    }

    return 1; // Late night / early morning
  }

  /**
   * Save history to storage
   */
  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.historyCache));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clean old data
   */
  private async cleanOldData(): Promise<void> {
    const cutoff = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const originalLength = this.historyCache.length;

    this.historyCache = this.historyCache.filter(d => d.timestamp >= cutoff);

    if (this.historyCache.length !== originalLength) {
      await this.saveHistory();
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const congestionPredictionService = new CongestionPredictionService();
export default congestionPredictionService;
