/**
 * Pattern Analysis Service
 * Analyzes commute logs to detect patterns and make predictions
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  CommuteLog,
  CommutePattern,
  CommutePatternDoc,
  PredictedCommute,
  FrequentRoute,
  DayOfWeek,
  MIN_LOGS_FOR_PATTERN,
  calculateAverageTime,
  calculateTimeStdDev,
  calculateConfidence,
  calculateAlertTime,
  getDayOfWeek,
  formatDateString,
  isWeekday,
  fromCommutePatternDoc,
} from '@/models/pattern';
import { commuteLogService } from './commuteLogService';

const COLLECTION_NAME = 'commutePatterns';

// ============================================================================
// Service
// ============================================================================

class PatternAnalysisService {
  /**
   * Analyze logs and generate patterns for a user
   */
  async analyzeAndUpdatePatterns(userId: string): Promise<CommutePattern[]> {
    // Get recent logs
    const logs = await commuteLogService.getRecentLogsForAnalysis(userId);

    if (logs.length === 0) {
      return [];
    }

    // Group logs by day of week
    const logsByDay = this.groupLogsByDayOfWeek(logs);

    // Analyze each day
    const patterns: CommutePattern[] = [];

    for (const [dayOfWeek, dayLogs] of logsByDay.entries()) {
      if (dayLogs.length >= MIN_LOGS_FOR_PATTERN) {
        const pattern = this.analyzeLogsForDay(userId, dayOfWeek, dayLogs);
        await this.savePattern(userId, pattern);
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Get all patterns for a user
   */
  async getPatterns(userId: string): Promise<CommutePattern[]> {
    const patternsRef = collection(db, COLLECTION_NAME, userId, 'patterns');
    const snapshot = await getDocs(patternsRef);

    return snapshot.docs.map((docSnap) =>
      fromCommutePatternDoc(userId, docSnap.data() as CommutePatternDoc)
    );
  }

  /**
   * Get pattern for a specific day
   */
  async getPatternForDay(
    userId: string,
    dayOfWeek: DayOfWeek
  ): Promise<CommutePattern | null> {
    const patternRef = doc(
      db,
      COLLECTION_NAME,
      userId,
      'patterns',
      dayOfWeek.toString()
    );
    const docSnap = await getDoc(patternRef);

    if (!docSnap.exists()) {
      return null;
    }

    return fromCommutePatternDoc(userId, docSnap.data() as CommutePatternDoc);
  }

  /**
   * Predict commute for a specific date
   */
  async predictCommute(
    userId: string,
    date: Date = new Date()
  ): Promise<PredictedCommute | null> {
    const dayOfWeek = getDayOfWeek(date);
    const pattern = await this.getPatternForDay(userId, dayOfWeek);

    if (!pattern) {
      return null;
    }

    return {
      date: formatDateString(date),
      dayOfWeek,
      predictedDepartureTime: pattern.avgDepartureTime,
      route: pattern.frequentRoute,
      confidence: pattern.confidence,
      suggestedAlertTime: calculateAlertTime(pattern.avgDepartureTime),
    };
  }

  /**
   * Get predictions for the week ahead
   */
  async getWeekPredictions(
    userId: string,
    includeWeekends: boolean = false
  ): Promise<PredictedCommute[]> {
    const predictions: PredictedCommute[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = getDayOfWeek(date);

      // Skip weekends if not included
      if (!includeWeekends && !isWeekday(dayOfWeek)) {
        continue;
      }

      const prediction = await this.predictCommute(userId, date);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  /**
   * Check if there's a pattern match for today
   */
  async hasTodayPattern(userId: string): Promise<boolean> {
    const dayOfWeek = getDayOfWeek(new Date());
    const pattern = await this.getPatternForDay(userId, dayOfWeek);
    return pattern !== null && pattern.confidence >= 0.5;
  }

  /**
   * Get suggested alert time for today
   */
  async getTodaySuggestedAlertTime(userId: string): Promise<string | null> {
    const prediction = await this.predictCommute(userId);
    return prediction?.suggestedAlertTime || null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Group logs by day of week
   */
  private groupLogsByDayOfWeek(logs: CommuteLog[]): Map<DayOfWeek, CommuteLog[]> {
    const groups = new Map<DayOfWeek, CommuteLog[]>();

    for (const log of logs) {
      const existing = groups.get(log.dayOfWeek) || [];
      existing.push(log);
      groups.set(log.dayOfWeek, existing);
    }

    return groups;
  }

  /**
   * Analyze logs for a specific day of week
   */
  private analyzeLogsForDay(
    userId: string,
    dayOfWeek: DayOfWeek,
    logs: CommuteLog[]
  ): CommutePattern {
    // Extract departure times
    const departureTimes = logs.map((log) => log.departureTime);

    // Calculate average and standard deviation
    const avgDepartureTime = calculateAverageTime(departureTimes);
    const stdDevMinutes = calculateTimeStdDev(departureTimes);

    // Find most frequent route
    const frequentRoute = this.findMostFrequentRoute(logs);

    // Calculate confidence
    const confidence = calculateConfidence(logs.length, stdDevMinutes);

    return {
      userId,
      dayOfWeek,
      avgDepartureTime,
      stdDevMinutes,
      frequentRoute,
      confidence,
      sampleCount: logs.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Find the most frequently used route
   */
  private findMostFrequentRoute(logs: CommuteLog[]): FrequentRoute {
    // Count route occurrences
    const routeCounts = new Map<string, { route: FrequentRoute; count: number }>();

    for (const log of logs) {
      const key = `${log.departureStationId}-${log.arrivalStationId}`;

      if (routeCounts.has(key)) {
        const entry = routeCounts.get(key)!;
        entry.count++;
      } else {
        routeCounts.set(key, {
          route: {
            departureStationId: log.departureStationId,
            departureStationName: log.departureStationName,
            arrivalStationId: log.arrivalStationId,
            arrivalStationName: log.arrivalStationName,
            lineIds: [...log.lineIds],
          },
          count: 1,
        });
      }
    }

    // Find most common route
    let maxCount = 0;
    let mostFrequent: FrequentRoute | null = null;

    for (const { route, count } of routeCounts.values()) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = route;
      }
    }

    // Fallback to first log if no clear winner
    const firstLog = logs[0];
    if (!mostFrequent && firstLog) {
      mostFrequent = {
        departureStationId: firstLog.departureStationId,
        departureStationName: firstLog.departureStationName,
        arrivalStationId: firstLog.arrivalStationId,
        arrivalStationName: firstLog.arrivalStationName,
        lineIds: [...firstLog.lineIds],
      };
    }

    // This should never happen since we check logs.length >= MIN_LOGS_FOR_PATTERN
    if (!mostFrequent) {
      throw new Error('No route data available');
    }

    return mostFrequent;
  }

  /**
   * Save pattern to Firestore
   */
  private async savePattern(
    userId: string,
    pattern: CommutePattern
  ): Promise<void> {
    const patternRef = doc(
      db,
      COLLECTION_NAME,
      userId,
      'patterns',
      pattern.dayOfWeek.toString()
    );

    const patternData: CommutePatternDoc = {
      dayOfWeek: pattern.dayOfWeek,
      avgDepartureTime: pattern.avgDepartureTime,
      stdDevMinutes: pattern.stdDevMinutes,
      frequentRoute: {
        departureStationId: pattern.frequentRoute.departureStationId,
        departureStationName: pattern.frequentRoute.departureStationName,
        arrivalStationId: pattern.frequentRoute.arrivalStationId,
        arrivalStationName: pattern.frequentRoute.arrivalStationName,
        lineIds: [...pattern.frequentRoute.lineIds],
      },
      confidence: pattern.confidence,
      sampleCount: pattern.sampleCount,
      lastUpdated: Timestamp.fromDate(pattern.lastUpdated),
    };

    await setDoc(patternRef, patternData);
  }
}

export const patternAnalysisService = new PatternAnalysisService();
export default patternAnalysisService;
