/**
 * Congestion domain models and types
 * Represents crowdsourced congestion data for Seoul subway trains
 */

import { CongestionLevel } from './train';

// Re-export CongestionLevel for convenience
export { CongestionLevel };

// ============================================================================
// Core Types
// ============================================================================

/**
 * Individual congestion report from a user
 */
export interface CongestionReport {
  readonly id: string;
  readonly trainId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly carNumber: number; // 1-10 (most Seoul trains have 10 cars)
  readonly congestionLevel: CongestionLevel;
  readonly reporterId: string;
  readonly timestamp: Date;
  readonly expiresAt: Date; // 10 minutes after timestamp
}

/**
 * Congestion data for a single train car
 */
export interface CarCongestion {
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}

/**
 * Aggregated congestion summary for a train
 */
export interface TrainCongestionSummary {
  readonly id: string;
  readonly trainId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly cars: readonly CarCongestion[];
  readonly overallLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}

/**
 * Input for submitting a congestion report
 */
export interface CongestionReportInput {
  readonly trainId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
}

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Firestore document for congestion report
 * Path: congestionReports/{reportId}
 */
export interface CongestionReportDoc {
  trainId: string;
  lineId: string;
  stationId: string;
  direction: 'up' | 'down';
  carNumber: number;
  congestionLevel: CongestionLevel;
  reporterId: string;
  timestamp: FirebaseTimestamp;
  expiresAt: FirebaseTimestamp;
}

/**
 * Firestore document for congestion summary
 * Path: congestionSummary/{lineId}_{direction}_{trainId}
 */
export interface CongestionSummaryDoc {
  trainId: string;
  lineId: string;
  direction: 'up' | 'down';
  cars: CarCongestionDoc[];
  overallLevel: CongestionLevel;
  reportCount: number;
  lastUpdated: FirebaseTimestamp;
}

interface CarCongestionDoc {
  carNumber: number;
  congestionLevel: CongestionLevel;
  reportCount: number;
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

/** Number of cars in a typical Seoul subway train */
export const TRAIN_CAR_COUNT = 10;

/** Congestion report expiration time in minutes */
export const REPORT_EXPIRATION_MINUTES = 10;

/** Minimum reports needed for reliable congestion data */
export const MIN_REPORTS_FOR_RELIABILITY = 3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display name for congestion level (Korean)
 */
export function getCongestionLevelName(level: CongestionLevel): string {
  switch (level) {
    case CongestionLevel.LOW:
      return '여유';
    case CongestionLevel.MODERATE:
      return '보통';
    case CongestionLevel.HIGH:
      return '혼잡';
    case CongestionLevel.CROWDED:
      return '매우 혼잡';
  }
}

/**
 * Get display color for congestion level
 */
export function getCongestionLevelColor(level: CongestionLevel): string {
  switch (level) {
    case CongestionLevel.LOW:
      return '#22C55E'; // Green
    case CongestionLevel.MODERATE:
      return '#F59E0B'; // Amber
    case CongestionLevel.HIGH:
      return '#F97316'; // Orange
    case CongestionLevel.CROWDED:
      return '#EF4444'; // Red
  }
}

/**
 * Get congestion level icon name
 */
export function getCongestionLevelIcon(level: CongestionLevel): string {
  switch (level) {
    case CongestionLevel.LOW:
      return 'users';
    case CongestionLevel.MODERATE:
      return 'users';
    case CongestionLevel.HIGH:
      return 'users';
    case CongestionLevel.CROWDED:
      return 'alert-triangle';
  }
}

/**
 * Calculate overall congestion from car reports
 */
export function calculateOverallCongestion(
  cars: readonly CarCongestion[]
): CongestionLevel {
  if (cars.length === 0) {
    return CongestionLevel.LOW;
  }

  // Weight each level (LOW=1, MODERATE=2, HIGH=3, CROWDED=4)
  const levelWeights: Record<CongestionLevel, number> = {
    [CongestionLevel.LOW]: 1,
    [CongestionLevel.MODERATE]: 2,
    [CongestionLevel.HIGH]: 3,
    [CongestionLevel.CROWDED]: 4,
  };

  // Calculate weighted average based on report count
  let totalWeight = 0;
  let totalReports = 0;

  for (const car of cars) {
    const weight = levelWeights[car.congestionLevel];
    totalWeight += weight * car.reportCount;
    totalReports += car.reportCount;
  }

  if (totalReports === 0) {
    return CongestionLevel.LOW;
  }

  const avgWeight = totalWeight / totalReports;

  // Map average back to level
  if (avgWeight <= 1.5) {
    return CongestionLevel.LOW;
  } else if (avgWeight <= 2.5) {
    return CongestionLevel.MODERATE;
  } else if (avgWeight <= 3.5) {
    return CongestionLevel.HIGH;
  } else {
    return CongestionLevel.CROWDED;
  }
}

/**
 * Check if a report is expired
 */
export function isReportExpired(report: CongestionReport): boolean {
  return new Date() > report.expiresAt;
}

/**
 * Create expiration date from timestamp
 */
export function createExpirationDate(timestamp: Date): Date {
  const expiresAt = new Date(timestamp);
  expiresAt.setMinutes(expiresAt.getMinutes() + REPORT_EXPIRATION_MINUTES);
  return expiresAt;
}

/**
 * Generate summary document ID
 */
export function generateSummaryId(
  lineId: string,
  direction: 'up' | 'down',
  trainId: string
): string {
  return `${lineId}_${direction}_${trainId}`;
}

/**
 * Create empty car congestion array
 */
export function createEmptyCarCongestions(): CarCongestion[] {
  return Array.from({ length: TRAIN_CAR_COUNT }, (_, index) => ({
    carNumber: index + 1,
    congestionLevel: CongestionLevel.LOW,
    reportCount: 0,
    lastUpdated: new Date(),
  }));
}

/**
 * Convert Firestore document to CongestionReport
 */
export function fromCongestionReportDoc(
  id: string,
  doc: CongestionReportDoc
): CongestionReport {
  return {
    id,
    trainId: doc.trainId,
    lineId: doc.lineId,
    stationId: doc.stationId,
    direction: doc.direction,
    carNumber: doc.carNumber,
    congestionLevel: doc.congestionLevel,
    reporterId: doc.reporterId,
    timestamp: doc.timestamp.toDate(),
    expiresAt: doc.expiresAt.toDate(),
  };
}

/**
 * Convert Firestore document to TrainCongestionSummary
 */
export function fromCongestionSummaryDoc(
  id: string,
  doc: CongestionSummaryDoc
): TrainCongestionSummary {
  return {
    id,
    trainId: doc.trainId,
    lineId: doc.lineId,
    direction: doc.direction,
    cars: doc.cars.map(car => ({
      carNumber: car.carNumber,
      congestionLevel: car.congestionLevel,
      reportCount: car.reportCount,
      lastUpdated: car.lastUpdated.toDate(),
    })),
    overallLevel: doc.overallLevel,
    reportCount: doc.reportCount,
    lastUpdated: doc.lastUpdated.toDate(),
  };
}
