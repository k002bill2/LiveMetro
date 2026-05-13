/**
 * Commute Pattern Models
 * Represents user commute patterns and ML-based predictions
 */

import { CongestionLevel } from './train';
import { RouteSegment } from './route';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Individual commute log entry
 */
export interface CommuteLog {
  readonly id: string;
  readonly userId: string;
  readonly date: string; // YYYY-MM-DD
  readonly dayOfWeek: DayOfWeek;
  readonly departureTime: string; // HH:mm
  readonly arrivalTime?: string; // HH:mm
  readonly departureStationId: string;
  readonly departureStationName: string;
  readonly arrivalStationId: string;
  readonly arrivalStationName: string;
  readonly lineIds: readonly string[]; // Lines used
  readonly wasDelayed: boolean;
  readonly delayMinutes?: number;
  readonly isManual: boolean; // User manually logged vs auto-detected
  readonly createdAt: Date;
}

/**
 * Day of week
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

/**
 * Analyzed commute pattern for a specific day of week
 */
export interface CommutePattern {
  readonly userId: string;
  readonly dayOfWeek: DayOfWeek;
  readonly avgDepartureTime: string; // HH:mm
  readonly stdDevMinutes: number;
  readonly frequentRoute: FrequentRoute;
  readonly confidence: number; // 0-1
  readonly sampleCount: number;
  readonly lastUpdated: Date;
}

/**
 * Frequent route information
 */
export interface FrequentRoute {
  readonly departureStationId: string;
  readonly departureStationName: string;
  readonly arrivalStationId: string;
  readonly arrivalStationName: string;
  readonly lineIds: readonly string[];
}

/**
 * Predicted commute for a specific date.
 *
 * The first block of fields is the base prediction (computed from pattern alone).
 * The remaining optional fields are derived values populated by
 * `patternAnalysisService.predictCommute` when source data is available;
 * consumers MUST handle each as potentially undefined.
 */
export interface PredictedCommute {
  // existing — unchanged
  readonly date: string;                       // YYYY-MM-DD
  readonly dayOfWeek: DayOfWeek;
  readonly predictedDepartureTime: string;     // HH:mm
  readonly route: FrequentRoute;
  readonly confidence: number;                 // 0-1
  readonly suggestedAlertTime: string;         // HH:mm
  readonly basedOnPatternId?: string;

  // Coupled: predictedMinutes and predictedArrivalTime are set together or both undefined.
  readonly predictedMinutes?: number;
  readonly predictedArrivalTime?: string;      // HH:mm
  /** [lower, upper] minutes — replaces ±2/±4 heuristic in consumers. */
  readonly predictedMinutesRange?: readonly [number, number];

  /** Minutes vs typical (signed; + = slower). 1st cut: always undefined (no baseline yet). */
  readonly deltaMinutes?: number;

  /** Travel direction on the predicted line(s). */
  readonly direction?: 'up' | 'down';

  /** Walk from origin to boarding station. */
  readonly walkToStationMinutes?: number;
  /** Wait at platform. */
  readonly waitMinutes?: number;
  /** Walk from alighting station to destination. */
  readonly walkToDestinationMinutes?: number;

  /** Transit (ride + transfer) segments. Reuses RouteSegment, adds congestion slot. */
  readonly transitSegments?: readonly PredictedTransitSegment[];
}

/**
 * RouteSegment + optional congestion forecast slot.
 * `congestionForecast` is populated by the congestion ingestion pipeline
 * (Phase d); always undefined until that phase ships.
 */
export interface PredictedTransitSegment extends RouteSegment {
  readonly congestionForecast?: CongestionLevel;
}

/**
 * Smart notification settings
 */
export interface SmartNotificationSettings {
  readonly enabled: boolean;
  readonly alertMinutesBefore: number; // Default: 15
  readonly checkDelaysFor: readonly string[]; // Line IDs to check
  readonly includeWeekends: boolean;
  readonly customAlertTimes: readonly CustomAlertTime[];
}

/**
 * Custom alert time for specific days
 */
export interface CustomAlertTime {
  readonly dayOfWeek: DayOfWeek;
  readonly alertTime: string; // HH:mm
  readonly enabled: boolean;
}

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Firestore document for commute log
 * Path: commuteLogs/{userId}/logs/{logId}
 */
export interface CommuteLogDoc {
  date: string;
  dayOfWeek: DayOfWeek;
  departureTime: string;
  arrivalTime?: string;
  departureStationId: string;
  departureStationName: string;
  arrivalStationId: string;
  arrivalStationName: string;
  lineIds: string[];
  wasDelayed: boolean;
  delayMinutes?: number;
  isManual: boolean;
  createdAt: FirebaseTimestamp;
}

/**
 * Firestore document for commute pattern
 * Path: commutePatterns/{userId}/patterns/{dayOfWeek}
 */
export interface CommutePatternDoc {
  dayOfWeek: DayOfWeek;
  avgDepartureTime: string;
  stdDevMinutes: number;
  frequentRoute: {
    departureStationId: string;
    departureStationName: string;
    arrivalStationId: string;
    arrivalStationName: string;
    lineIds: string[];
  };
  confidence: number;
  sampleCount: number;
  lastUpdated: FirebaseTimestamp;
}

// Firebase Timestamp type placeholder
type FirebaseTimestamp = {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
};

// ============================================================================
// Constants
// ============================================================================

/** Minimum logs needed to establish a pattern */
export const MIN_LOGS_FOR_PATTERN = 3;

/** Maximum age of logs to consider (days) */
export const MAX_LOG_AGE_DAYS = 30;

/** Default alert time before departure (minutes) */
export const DEFAULT_ALERT_MINUTES_BEFORE = 15;

/** Default walk minutes from origin to boarding station. */
export const DEFAULT_WALK_TO_STATION_MIN = 4;
/** Default wait minutes at platform. */
export const DEFAULT_WAIT_MIN = 3;
/** Default walk minutes from alighting station to destination. */
export const DEFAULT_WALK_TO_DEST_MIN = 3;

/** Minimum half-width (minutes) when computing predictedMinutesRange from stdDev. */
export const RANGE_HALF_MIN_FLOOR = 1;
/** Maximum half-width (minutes) when computing predictedMinutesRange from stdDev. */
export const RANGE_HALF_MIN_CAP = 10;

/** Day names in Korean */
export const DAY_NAMES_KO: Record<DayOfWeek, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

/** Day names short in Korean */
export const DAY_NAMES_SHORT_KO: Record<DayOfWeek, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get day of week from date
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  return date.getDay() as DayOfWeek;
}

/**
 * Check if day is a weekday
 */
export function isWeekday(day: DayOfWeek): boolean {
  return day >= 1 && day <= 5;
}

/**
 * Check if day is a weekend
 */
export function isWeekend(day: DayOfWeek): boolean {
  return day === 0 || day === 6;
}

/**
 * Parse time string to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Format minutes from midnight to time string
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate average time from array of time strings
 */
export function calculateAverageTime(times: readonly string[]): string {
  if (times.length === 0) return '00:00';

  const totalMinutes = times.reduce((sum, time) => sum + parseTimeToMinutes(time), 0);
  const avgMinutes = Math.round(totalMinutes / times.length);
  return formatMinutesToTime(avgMinutes);
}

/**
 * Calculate standard deviation of times in minutes
 */
export function calculateTimeStdDev(times: readonly string[]): number {
  if (times.length < 2) return 0;

  const minutes = times.map(parseTimeToMinutes);
  const avg = minutes.reduce((sum, m) => sum + m, 0) / minutes.length;
  const squaredDiffs = minutes.map(m => Math.pow(m - avg, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / minutes.length;
  return Math.sqrt(variance);
}

/**
 * Calculate confidence based on sample count and consistency
 */
export function calculateConfidence(sampleCount: number, stdDevMinutes: number): number {
  // Higher sample count = higher confidence
  const sampleFactor = Math.min(1, sampleCount / 10); // Max at 10 samples

  // Lower standard deviation = higher confidence
  const consistencyFactor = Math.max(0, 1 - stdDevMinutes / 60); // Max 60 min deviation

  // Combine factors
  return Math.round((sampleFactor * 0.6 + consistencyFactor * 0.4) * 100) / 100;
}

/**
 * Calculate suggested alert time
 */
export function calculateAlertTime(
  departureTime: string,
  minutesBefore: number = DEFAULT_ALERT_MINUTES_BEFORE
): string {
  const departureMinutes = parseTimeToMinutes(departureTime);
  const alertMinutes = departureMinutes - minutesBefore;
  return formatMinutesToTime(alertMinutes < 0 ? alertMinutes + 24 * 60 : alertMinutes);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time as HH:mm
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Convert Firestore document to CommuteLog
 */
export function fromCommuteLogDoc(
  id: string,
  userId: string,
  doc: CommuteLogDoc
): CommuteLog {
  return {
    id,
    userId,
    date: doc.date,
    dayOfWeek: doc.dayOfWeek,
    departureTime: doc.departureTime,
    arrivalTime: doc.arrivalTime,
    departureStationId: doc.departureStationId,
    departureStationName: doc.departureStationName,
    arrivalStationId: doc.arrivalStationId,
    arrivalStationName: doc.arrivalStationName,
    lineIds: doc.lineIds,
    wasDelayed: doc.wasDelayed,
    delayMinutes: doc.delayMinutes,
    isManual: doc.isManual,
    createdAt: doc.createdAt.toDate(),
  };
}

/**
 * Convert Firestore document to CommutePattern
 */
export function fromCommutePatternDoc(
  userId: string,
  doc: CommutePatternDoc
): CommutePattern {
  return {
    userId,
    dayOfWeek: doc.dayOfWeek,
    avgDepartureTime: doc.avgDepartureTime,
    stdDevMinutes: doc.stdDevMinutes,
    frequentRoute: {
      departureStationId: doc.frequentRoute.departureStationId,
      departureStationName: doc.frequentRoute.departureStationName,
      arrivalStationId: doc.frequentRoute.arrivalStationId,
      arrivalStationName: doc.frequentRoute.arrivalStationName,
      lineIds: doc.frequentRoute.lineIds,
    },
    confidence: doc.confidence,
    sampleCount: doc.sampleCount,
    lastUpdated: doc.lastUpdated.toDate(),
  };
}

/**
 * Create default smart notification settings
 */
export function createDefaultSmartNotificationSettings(): SmartNotificationSettings {
  return {
    enabled: false,
    alertMinutesBefore: DEFAULT_ALERT_MINUTES_BEFORE,
    checkDelaysFor: [],
    includeWeekends: false,
    customAlertTimes: [],
  };
}

// ============================================================================
// Derived-prediction helpers (implemented in A.2 / A.3 / A.4)
// ============================================================================

/**
 * Compute arrival time from departure (HH:mm) + total minutes.
 * Handles 24h wrap: ('23:50', 30) → '00:20'.
 */
export function computeArrivalTime(
  departureHHmm: string,
  totalMinutes: number,
): string {
  const departureMinutes = parseTimeToMinutes(departureHHmm);
  const arrivalMinutes = (departureMinutes + totalMinutes) % (24 * 60);
  return formatMinutesToTime(arrivalMinutes);
}

/**
 * Sum walk + wait + walk + transit segments. Returns 0 if all undefined.
 */
export function sumPredictedMinutes(p: PredictedCommute): number {
  const walk1 = p.walkToStationMinutes ?? 0;
  const wait = p.waitMinutes ?? 0;
  const walk2 = p.walkToDestinationMinutes ?? 0;
  const transit = (p.transitSegments ?? []).reduce(
    (sum, seg) => sum + seg.estimatedMinutes,
    0,
  );
  return walk1 + wait + walk2 + transit;
}

const LINEAR_LINE_IDS: ReadonlySet<string> = new Set([
  '1', '3', '4', '5', '6', '7', '8', '9',
]);

/**
 * Derive travel direction from the first transit segment.
 * Returns undefined when input is missing or line direction model is unknown.
 */
export function deriveDirection(
  firstSegment: RouteSegment | undefined,
): 'up' | 'down' | undefined {
  if (!firstSegment) return undefined;
  if (!LINEAR_LINE_IDS.has(firstSegment.lineId)) return undefined;
  return firstSegment.fromStationId < firstSegment.toStationId ? 'up' : 'down';
}
