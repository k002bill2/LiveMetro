/**
 * Congestion Report Service
 * Firebase-based real-time congestion reporting system with crowdsourcing
 */

import {
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  CongestionLevel,
  CongestionReport,
  CongestionReportInput,
  TrainCongestionSummary,
  CarCongestion,
  TRAIN_CAR_COUNT,
  REPORT_EXPIRATION_MINUTES,
  calculateOverallCongestion,
  generateSummaryId,
  createEmptyCarCongestions,
  fromCongestionReportDoc,
  fromCongestionSummaryDoc,
  CongestionReportDoc,
  CongestionSummaryDoc,
} from '@/models/congestion';
import type { Direction } from '@/models/route';

const REPORTS_COLLECTION = 'congestionReports';
const SUMMARY_COLLECTION = 'congestionSummary';
const HISTORY_COLLECTION = 'congestionData';

// ---------------------------------------------------------------------------
// Hourly forecast (Phase 2 of ML prediction Sections 6-9, spec 2026-05-12)
// ---------------------------------------------------------------------------

/** Minutes per forecast slot (15-min granularity matches Seoul Metro reporting) */
const SLOT_MINUTES = 15;
/** Total slots returned (covers ±~1h around currentTime) */
const SLOT_COUNT = 7;
/** Slots before currentTime (rest are at/after) */
const SLOTS_BEFORE_NOW = 2;
/** Max history docs aggregated per slot to bound query cost */
const SLOT_QUERY_LIMIT = 50;
/** Percent thresholds mapped onto CongestionLevel buckets */
const PERCENT_THRESHOLD_LOW = 50;
const PERCENT_THRESHOLD_MODERATE = 70;
const PERCENT_THRESHOLD_HIGH = 85;

/**
 * Single hourly forecast slot returned by {@link CongestionService.getHourlyForecast}.
 * `level: 'unknown'` when no historical data exists for that slot.
 */
export interface HourlySlot {
  readonly slotTime: string; // 'HH:mm' in caller's local time
  readonly congestionPercent: number; // 0-100, rounded
  readonly level: CongestionLevel | 'unknown';
}

/** Map a 0-100 congestion percent to a {@link CongestionLevel} bucket. */
function mapPercentToLevel(percent: number): CongestionLevel {
  if (percent < PERCENT_THRESHOLD_LOW) return CongestionLevel.LOW;
  if (percent < PERCENT_THRESHOLD_MODERATE) return CongestionLevel.MODERATE;
  if (percent < PERCENT_THRESHOLD_HIGH) return CongestionLevel.HIGH;
  return CongestionLevel.CROWDED;
}

// LiveMetro = Seoul-only domain. Pin formatter to KST so output is identical
// across runtime TZs (dev = KST, CI = UTC). en-GB locale guarantees 'HH:mm'.
const HHMM_FORMATTER_KST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Format a Date as 'HH:mm' in Asia/Seoul time, independent of host TZ. */
function formatHHMM(d: Date): string {
  return HHMM_FORMATTER_KST.format(d);
}

/** Return new Date with `minutes` added (immutable; original not mutated). */
function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/**
 * Snap a Date down to the nearest `slotMinutes` boundary, zeroing seconds/ms.
 * Returns a NEW Date — input is not mutated.
 */
function snapToSlotBoundary(d: Date, slotMinutes: number): Date {
  const snapped = new Date(d);
  snapped.setMinutes(Math.floor(d.getMinutes() / slotMinutes) * slotMinutes, 0, 0);
  return snapped;
}

/**
 * Congestion Service
 * Handles crowdsourced congestion data for subway trains
 */
class CongestionService {
  /**
   * Submit a congestion report
   */
  async submitReport(
    input: CongestionReportInput,
    userId: string
  ): Promise<CongestionReport> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMinutes(expiresAt.getMinutes() + REPORT_EXPIRATION_MINUTES);

    const reportData: Omit<CongestionReportDoc, 'timestamp' | 'expiresAt'> & {
      timestamp: Timestamp;
      expiresAt: Timestamp;
    } = {
      trainId: input.trainId,
      lineId: input.lineId,
      stationId: input.stationId,
      direction: input.direction,
      carNumber: input.carNumber,
      congestionLevel: input.congestionLevel,
      reporterId: userId,
      timestamp: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
    };

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData);

    // Update the summary in background
    this.updateSummaryFromReport(input, now).catch(console.error);

    return {
      id: docRef.id,
      trainId: input.trainId,
      lineId: input.lineId,
      stationId: input.stationId,
      direction: input.direction,
      carNumber: input.carNumber,
      congestionLevel: input.congestionLevel,
      reporterId: userId,
      timestamp: now,
      expiresAt,
    };
  }

  /**
   * Get congestion summary for a specific train
   */
  async getTrainCongestion(
    lineId: string,
    direction: 'up' | 'down',
    trainId: string
  ): Promise<TrainCongestionSummary | null> {
    const summaryId = generateSummaryId(lineId, direction, trainId);

    const q = query(collection(db, SUMMARY_COLLECTION), where('__name__', '==', summaryId));
    const snapshot = await getDocs(q);

    if (snapshot.empty || !snapshot.docs[0]) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc);
  }

  /**
   * Get congestion summaries for a line
   */
  async getLineCongestion(
    lineId: string
  ): Promise<TrainCongestionSummary[]> {
    const q = query(
      collection(db, SUMMARY_COLLECTION),
      where('lineId', '==', lineId),
      orderBy('lastUpdated', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap =>
      fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc)
    );
  }

  /**
   * Subscribe to real-time congestion updates for a train
   */
  subscribeToTrainCongestion(
    lineId: string,
    direction: 'up' | 'down',
    trainId: string,
    callback: (summary: TrainCongestionSummary | null) => void
  ): () => void {
    const summaryId = generateSummaryId(lineId, direction, trainId);
    const summaryRef = doc(db, SUMMARY_COLLECTION, summaryId);

    return onSnapshot(
      summaryRef,
      docSnap => {
        if (!docSnap.exists()) {
          callback(null);
          return;
        }

        callback(fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc));
      },
      error => {
        // DIAGNOSTIC: identify which collection/doc was denied so missing
        // firestore.rules entries can be pinpointed instead of guessed.
        console.error(
          `[CongestionService] subscribeToTrainCongestion failed for ` +
          `${SUMMARY_COLLECTION}/${summaryId}:`,
          error
        );
        callback(null);
      }
    );
  }

  /**
   * Subscribe to real-time congestion updates for a line
   */
  subscribeToLineCongestion(
    lineId: string,
    callback: (summaries: TrainCongestionSummary[]) => void
  ): () => void {
    const q = query(
      collection(db, SUMMARY_COLLECTION),
      where('lineId', '==', lineId),
      orderBy('lastUpdated', 'desc'),
      limit(50)
    );

    return onSnapshot(
      q,
      snapshot => {
        const summaries = snapshot.docs.map(docSnap =>
          fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc)
        );
        callback(summaries);
      },
      error => {
        // DIAGNOSTIC: identify which collection was denied.
        console.error(
          `[CongestionService] subscribeToLineCongestion failed for ` +
          `${SUMMARY_COLLECTION} (lineId=${lineId}):`,
          error
        );
        callback([]);
      }
    );
  }

  /**
   * Get recent reports for a station
   */
  async getStationReports(
    stationId: string,
    maxResults = 20
  ): Promise<CongestionReport[]> {
    const now = new Date();

    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('stationId', '==', stationId),
      where('expiresAt', '>=', Timestamp.fromDate(now)),
      orderBy('expiresAt', 'desc'),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap =>
      fromCongestionReportDoc(docSnap.id, docSnap.data() as CongestionReportDoc)
    );
  }

  /**
   * Check if user has recently reported for this train car
   */
  async hasRecentReport(
    userId: string,
    trainId: string,
    carNumber: number
  ): Promise<boolean> {
    const now = new Date();
    const cooldownTime = new Date(now);
    cooldownTime.setMinutes(cooldownTime.getMinutes() - 3); // 3 minute cooldown

    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('reporterId', '==', userId),
      where('trainId', '==', trainId),
      where('carNumber', '==', carNumber),
      where('timestamp', '>=', Timestamp.fromDate(cooldownTime)),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get aggregated car congestion for a train from recent reports
   */
  async getCarCongestionFromReports(
    lineId: string,
    direction: 'up' | 'down',
    trainId: string
  ): Promise<CarCongestion[]> {
    const now = new Date();

    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('trainId', '==', trainId),
      where('lineId', '==', lineId),
      where('direction', '==', direction),
      where('expiresAt', '>=', Timestamp.fromDate(now)),
      orderBy('expiresAt', 'desc'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const reports = snapshot.docs.map(docSnap =>
      fromCongestionReportDoc(docSnap.id, docSnap.data() as CongestionReportDoc)
    );

    return this.aggregateCarCongestion(reports);
  }

  /**
   * Clean up expired reports (should be called periodically via Cloud Functions)
   */
  async cleanupExpiredReports(): Promise<number> {
    const now = new Date();

    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('expiresAt', '<', Timestamp.fromDate(now)),
      limit(500)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    const batch = writeBatch(db);
    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
    }

    await batch.commit();
    return snapshot.size;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Update the congestion summary when a new report is submitted
   */
  private async updateSummaryFromReport(
    input: CongestionReportInput,
    timestamp: Date
  ): Promise<void> {
    const summaryId = generateSummaryId(input.lineId, input.direction, input.trainId);

    // Get all valid reports for this train
    const cars = await this.getCarCongestionFromReports(
      input.lineId,
      input.direction,
      input.trainId
    );

    const totalReports = cars.reduce((sum, car) => sum + car.reportCount, 0);
    const overallLevel = calculateOverallCongestion(cars);

    const summaryData: Omit<CongestionSummaryDoc, 'lastUpdated' | 'cars'> & {
      lastUpdated: Timestamp;
      cars: {
        carNumber: number;
        congestionLevel: CongestionLevel;
        reportCount: number;
        lastUpdated: Timestamp;
      }[];
    } = {
      trainId: input.trainId,
      lineId: input.lineId,
      direction: input.direction,
      cars: cars.map(car => ({
        carNumber: car.carNumber,
        congestionLevel: car.congestionLevel,
        reportCount: car.reportCount,
        lastUpdated: Timestamp.fromDate(car.lastUpdated),
      })),
      overallLevel,
      reportCount: totalReports,
      lastUpdated: Timestamp.fromDate(timestamp),
    };

    await setDoc(doc(db, SUMMARY_COLLECTION, summaryId), summaryData);
  }

  /**
   * Aggregate reports into car-level congestion data
   */
  private aggregateCarCongestion(reports: CongestionReport[]): CarCongestion[] {
    // Initialize all cars
    const carData = createEmptyCarCongestions();
    const carReports = new Map<number, CongestionReport[]>();

    // Group reports by car number
    for (const report of reports) {
      const existing = carReports.get(report.carNumber) || [];
      existing.push(report);
      carReports.set(report.carNumber, existing);
    }

    // Calculate congestion for each car
    for (const [carNumber, carReportList] of carReports) {
      if (carNumber < 1 || carNumber > TRAIN_CAR_COUNT) continue;

      // Weight recent reports more heavily
      const now = new Date();
      let weightedSum = 0;
      let totalWeight = 0;

      const levelWeights: Record<CongestionLevel, number> = {
        [CongestionLevel.LOW]: 1,
        [CongestionLevel.MODERATE]: 2,
        [CongestionLevel.HIGH]: 3,
        [CongestionLevel.CROWDED]: 4,
      };

      for (const report of carReportList) {
        // Reports decay over time (newer = more weight)
        const ageMinutes = (now.getTime() - report.timestamp.getTime()) / 60000;
        const timeWeight = Math.max(0.1, 1 - ageMinutes / REPORT_EXPIRATION_MINUTES);
        const levelWeight = levelWeights[report.congestionLevel];

        weightedSum += levelWeight * timeWeight;
        totalWeight += timeWeight;
      }

      const avgLevel = totalWeight > 0 ? weightedSum / totalWeight : 1;

      // Map to congestion level
      let congestionLevel: CongestionLevel;
      if (avgLevel <= 1.5) {
        congestionLevel = CongestionLevel.LOW;
      } else if (avgLevel <= 2.5) {
        congestionLevel = CongestionLevel.MODERATE;
      } else if (avgLevel <= 3.5) {
        congestionLevel = CongestionLevel.HIGH;
      } else {
        congestionLevel = CongestionLevel.CROWDED;
      }

      // Find most recent report timestamp
      const mostRecent = carReportList.reduce((latest, r) =>
        r.timestamp > latest.timestamp ? r : latest
      );

      carData[carNumber - 1] = {
        carNumber,
        congestionLevel,
        reportCount: carReportList.length,
        lastUpdated: mostRecent.timestamp,
      };
    }

    return carData;
  }

  // -------------------------------------------------------------------------
  // Hourly forecast (Phase 2 of ML prediction Sections 6-9, spec 2026-05-12)
  // -------------------------------------------------------------------------

  /**
   * Return a 7-slot hourly congestion forecast surrounding `currentTime`.
   *
   * Each slot is `SLOT_MINUTES` (15 min) wide. The window starts
   * `SLOTS_BEFORE_NOW` slots before the snapped boundary of `currentTime` and
   * extends forward, yielding `SLOT_COUNT` slots total. Per-slot averages are
   * sourced from historical congestion data matching the same dayOfWeek and
   * time window. Slots without history return `level: 'unknown'`.
   *
   * Notes:
   * - Date arithmetic uses immutable helpers — `currentTime` is never mutated.
   * - Slot averages are fetched in parallel with `Promise.all`. Each request
   *   targets a distinct (dayOfWeek, hour, minute) tuple so there is no
   *   inter-dependency. Slots may cross midnight; `dayOfWeek` is computed per
   *   slot inside {@link fetchSlotAverage}, so the day boundary (and DST
   *   transitions) are handled correctly without special casing.
   *
   * @param lineId    Subway line id (e.g. '2')
   * @param direction 'up' | 'down'
   * @param currentTime Reference time (typically `new Date()` from the caller)
   * @returns Readonly array of {@link HourlySlot}, length = `SLOT_COUNT`
   */
  async getHourlyForecast(
    lineId: string,
    direction: Direction,
    currentTime: Date
  ): Promise<readonly HourlySlot[]> {
    const snapped = snapToSlotBoundary(currentTime, SLOT_MINUTES);
    const startSlot = addMinutes(snapped, -SLOTS_BEFORE_NOW * SLOT_MINUTES);

    const slotStarts: Date[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      slotStarts.push(addMinutes(startSlot, i * SLOT_MINUTES));
    }
    const averages = await Promise.all(
      slotStarts.map((s) => this.fetchSlotAverage(s, lineId, direction))
    );
    return slotStarts.map((slotStart, i) => {
      const average = averages[i];
      if (average === null || average === undefined) {
        return {
          slotTime: formatHHMM(slotStart),
          congestionPercent: 0,
          level: 'unknown' as const,
        };
      }
      return {
        slotTime: formatHHMM(slotStart),
        congestionPercent: Math.round(average),
        level: mapPercentToLevel(average),
      };
    });
  }

  /**
   * Fetch the average congestion percent for a single slot window from
   * historical Firestore data. Returns `null` when no documents match.
   *
   * Marked `private` to discourage external callers, but jest.spyOn can still
   * stub it in unit tests of {@link getHourlyForecast}.
   */
  private async fetchSlotAverage(
    slotStart: Date,
    lineId: string,
    direction: Direction
  ): Promise<number | null> {
    const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
    const dayOfWeek = slotStart.getDay();
    // When slotEnd lands exactly on the next hour, its minute is 0 — but the
    // exclusive upper bound for the *current* hour query must be 60 so the
    // last minute in the slot is included. Anywhere else, slotEnd.getMinutes()
    // is the correct exclusive upper bound.
    const endMinuteExclusive =
      slotEnd.getMinutes() === 0 ? 60 : slotEnd.getMinutes();
    try {
      const q = query(
        collection(db, HISTORY_COLLECTION),
        where('lineId', '==', lineId),
        where('direction', '==', direction),
        where('dayOfWeek', '==', dayOfWeek),
        where('reportedHour', '==', slotStart.getHours()),
        where('reportedMinute', '>=', slotStart.getMinutes()),
        where('reportedMinute', '<', endMinuteExclusive),
        limit(SLOT_QUERY_LIMIT)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      let sum = 0;
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as { congestionPercent?: number };
        if (typeof data.congestionPercent === 'number') {
          sum += data.congestionPercent;
          count++;
        }
      });
      return count === 0 ? null : sum / count;
    } catch (error) {
      console.error('fetchSlotAverage failed:', error);
      return null;
    }
  }
}

export const congestionService = new CongestionService();
export default congestionService;
