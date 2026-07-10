/**
 * Commute Log Service
 * Manages commute log entries in Firestore
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  CommuteLog,
  CommuteLogDoc,
  DayOfWeek,
  getDayOfWeek,
  formatDateString,
  getCurrentTimeString,
  MAX_LOG_AGE_DAYS,
  fromCommuteLogDoc,
} from '@/models/pattern';
import type { CommuteRoute } from '@/models/commute';

const COLLECTION_NAME = 'commuteLogs';

// ============================================================================
// Types
// ============================================================================

export interface CreateCommuteLogInput {
  departureStationId: string;
  departureStationName: string;
  arrivalStationId: string;
  arrivalStationName: string;
  lineIds: string[];
  departureTime?: string; // Defaults to current time
  arrivalTime?: string;
  loggedAt?: Date; // Defaults to now; used for date/day/createdAt.
  wasDelayed?: boolean;
  delayMinutes?: number;
  isManual?: boolean;
}

// ============================================================================
// Leg matching
// ============================================================================

/**
 * True when `log` belongs to the same commute leg as a route arriving at
 * `arrivalStationName`. A destination-less stub (arrivalStationName === '',
 * created by autoLogIfAppropriate) counts as a match because it can still be
 * repaired to this destination. A log heading somewhere *else* is a different
 * leg and must never be adopted — filling it would corrupt route statistics.
 */
export const matchesLeg = (
  log: Pick<CommuteLog, 'arrivalStationName'>,
  arrivalStationName: string
): boolean =>
  log.arrivalStationName === arrivalStationName || log.arrivalStationName === '';

export interface AdoptableOpenLog {
  readonly log: CommuteLog;
  /** true when the adopted log is a destination-less stub needing repair. */
  readonly needsRepair: boolean;
}

/**
 * From same-departure logs, pick the open (no arrivalTime) one that belongs to
 * this leg. An exact-destination match wins over a stub; a stub is adoptable
 * but flagged for repair. Returns null when no open log matches this leg.
 */
export const findAdoptableOpenLog = (
  logs: readonly CommuteLog[],
  arrivalStationName: string
): AdoptableOpenLog | null => {
  const openLogs = logs.filter((log) => !log.arrivalTime);
  const exact = openLogs.find((log) => log.arrivalStationName === arrivalStationName);
  if (exact) return { log: exact, needsRepair: false };
  const stub = openLogs.find((log) => log.arrivalStationName === '');
  if (stub) return { log: stub, needsRepair: true };
  return null;
};

// ============================================================================
// Service
// ============================================================================

class CommuteLogService {
  /**
   * Log a commute
   */
  async logCommute(
    userId: string,
    input: CreateCommuteLogInput
  ): Promise<CommuteLog> {
    const now = input.loggedAt ?? new Date();
    const date = formatDateString(now);
    const dayOfWeek = getDayOfWeek(now);
    const departureTime = input.departureTime || getCurrentTimeString();

    const logData: CommuteLogDoc = {
      date,
      dayOfWeek,
      departureTime,
      ...(input.arrivalTime !== undefined && { arrivalTime: input.arrivalTime }),
      departureStationId: input.departureStationId,
      departureStationName: input.departureStationName,
      arrivalStationId: input.arrivalStationId,
      arrivalStationName: input.arrivalStationName,
      lineIds: input.lineIds,
      wasDelayed: input.wasDelayed || false,
      ...(input.delayMinutes !== undefined && { delayMinutes: input.delayMinutes }),
      isManual: input.isManual ?? true,
      createdAt: Timestamp.fromDate(now),
    };

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    const docRef = await addDoc(userLogsRef, logData);

    return fromCommuteLogDoc(docRef.id, userId, {
      ...logData,
      createdAt: { toDate: () => now, seconds: 0, nanoseconds: 0 },
    });
  }

  /**
   * Get commute logs for a user
   */
  async getCommuteLogs(
    userId: string,
    options: {
      maxResults?: number;
      dayOfWeek?: DayOfWeek;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<CommuteLog[]> {
    const { maxResults = 50, dayOfWeek, fromDate, toDate } = options;

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    const q = query(userLogsRef, orderBy('createdAt', 'desc'), limit(maxResults));

    // Note: Firestore composite queries require indexes
    // For simplicity, we filter in memory for additional criteria
    const snapshot = await getDocs(q);

    let logs = snapshot.docs.map((docSnap) =>
      fromCommuteLogDoc(docSnap.id, userId, docSnap.data() as CommuteLogDoc)
    );

    // Apply additional filters
    if (dayOfWeek !== undefined) {
      logs = logs.filter((log) => log.dayOfWeek === dayOfWeek);
    }

    if (fromDate) {
      const fromDateStr = formatDateString(fromDate);
      logs = logs.filter((log) => log.date >= fromDateStr);
    }

    if (toDate) {
      const toDateStr = formatDateString(toDate);
      logs = logs.filter((log) => log.date <= toDateStr);
    }

    return logs;
  }

  /**
   * Get recent logs for pattern analysis
   */
  async getRecentLogsForAnalysis(userId: string): Promise<CommuteLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_LOG_AGE_DAYS);

    return this.getCommuteLogs(userId, {
      maxResults: 100,
      fromDate: cutoffDate,
    });
  }

  /**
   * Get logs for a specific day of week
   */
  async getLogsForDayOfWeek(
    userId: string,
    dayOfWeek: DayOfWeek
  ): Promise<CommuteLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_LOG_AGE_DAYS);

    return this.getCommuteLogs(userId, {
      dayOfWeek,
      fromDate: cutoffDate,
    });
  }

  /**
   * Update a commute log
   */
  async updateLog(
    userId: string,
    logId: string,
    updates: Partial<CreateCommuteLogInput>
  ): Promise<void> {
    const logRef = doc(db, COLLECTION_NAME, userId, 'logs', logId);

    const updateData: Partial<CommuteLogDoc> = {};

    if (updates.departureTime !== undefined) {
      updateData.departureTime = updates.departureTime;
    }
    if (updates.arrivalTime !== undefined) {
      updateData.arrivalTime = updates.arrivalTime;
    }
    if (updates.arrivalStationId !== undefined) {
      updateData.arrivalStationId = updates.arrivalStationId;
    }
    if (updates.arrivalStationName !== undefined) {
      updateData.arrivalStationName = updates.arrivalStationName;
    }
    if (updates.lineIds !== undefined) {
      updateData.lineIds = updates.lineIds;
    }
    if (updates.wasDelayed !== undefined) {
      updateData.wasDelayed = updates.wasDelayed;
    }
    if (updates.delayMinutes !== undefined) {
      updateData.delayMinutes = updates.delayMinutes;
    }

    await updateDoc(logRef, updateData);
  }

  /**
   * Delete a commute log
   */
  async deleteLog(userId: string, logId: string): Promise<void> {
    const logRef = doc(db, COLLECTION_NAME, userId, 'logs', logId);
    await deleteDoc(logRef);
  }

  /**
   * Check if user has logged a commute today
   */
  async hasLoggedToday(userId: string): Promise<boolean> {
    const today = formatDateString(new Date());

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    const q = query(
      userLogsRef,
      where('date', '==', today),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get today's log if exists
   */
  async getTodayLog(userId: string): Promise<CommuteLog | null> {
    const today = formatDateString(new Date());

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    const q = query(
      userLogsRef,
      where('date', '==', today),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty || !snapshot.docs[0]) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return fromCommuteLogDoc(docSnap.id, userId, docSnap.data() as CommuteLogDoc);
  }

  /**
   * Get today's logs filtered to a specific departure station (leg-aware).
   *
   * A single date-equality query (no orderBy → no composite index required,
   * mirroring getCommuteLogs' "filter in memory" pattern) fetches the day's
   * logs, then departureStationName is matched in memory. This lets callers
   * distinguish the morning leg from the evening leg — they share the same date
   * but differ by departure station, so a limit(1) date query cannot tell them
   * apart.
   */
  async getTodayLogsByDeparture(
    userId: string,
    departureStationName: string
  ): Promise<CommuteLog[]> {
    const today = formatDateString(new Date());

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    // limit(50) matches getCommuteLogs' default cap: high enough that a
    // same-leg open log is never paged out of view (which would let a duplicate
    // slip through), while still bounded — unbounded fetches are banned.
    const q = query(userLogsRef, where('date', '==', today), limit(50));

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) =>
        fromCommuteLogDoc(docSnap.id, userId, docSnap.data() as CommuteLogDoc)
      )
      .filter((log) => log.departureStationName === departureStationName);
  }

  /**
   * Auto-log commute based on favorite stations and current time
   * Called when user views a favorite station during commute hours
   */
  async autoLogIfAppropriate(
    userId: string,
    stationId: string,
    stationName: string,
    lineId: string,
    commuteType: 'departure' | 'arrival'
  ): Promise<CommuteLog | null> {
    // Check if already logged today
    const todayLog = await this.getTodayLog(userId);

    if (commuteType === 'departure') {
      // If we have no log today, create a new one
      if (!todayLog) {
        return this.logCommute(userId, {
          departureStationId: stationId,
          departureStationName: stationName,
          arrivalStationId: '', // To be filled later
          arrivalStationName: '',
          lineIds: [lineId],
          isManual: false,
        });
      }
    } else if (commuteType === 'arrival' && todayLog && !todayLog.arrivalTime) {
      // Update existing log with arrival info
      await this.updateLog(userId, todayLog.id, {
        arrivalTime: getCurrentTimeString(),
      });
      return {
        ...todayLog,
        arrivalTime: getCurrentTimeString(),
      };
    }

    return null;
  }

  /**
   * Auto-log a commute from the user's configured commuteSettings route.
   * Fired on app open/foreground during commute windows, so home-screen-only
   * users (who never open a station detail or start guidance) still
   * accumulate logs. Unlike autoLogIfAppropriate, the full route is known,
   * so both departure and arrival stations are recorded.
   */
  async autoLogCommuteRoute(
    userId: string,
    route: CommuteRoute,
    commuteType: 'departure' | 'arrival'
  ): Promise<CommuteLog | null> {
    // Leg-aware: only this departure station's logs. A different leg (e.g. the
    // morning commute) must never be read or mutated by the evening leg.
    const legLogs = await this.getTodayLogsByDeparture(userId, route.departureStationName);
    const routeInput: CreateCommuteLogInput = {
      departureStationId: route.departureStationId,
      departureStationName: route.departureStationName,
      arrivalStationId: route.arrivalStationId,
      arrivalStationName: route.arrivalStationName,
      lineIds: [...new Set([route.departureLineId, route.arrivalLineId])].filter(Boolean),
      isManual: false,
    };

    if (commuteType === 'departure') {
      // One auto log per leg per day. A same-leg log (this destination, or a
      // repairable stub) — open or completed — means this leg is already
      // recorded; a log to a different destination is a separate leg.
      if (legLogs.some((log) => matchesLeg(log, routeInput.arrivalStationName))) {
        return null;
      }
      return this.logCommute(userId, routeInput);
    }

    // arrival (퇴근): fill this leg's open log, or start an evening-only log.
    const adoptable = findAdoptableOpenLog(legLogs, routeInput.arrivalStationName);
    if (adoptable) {
      const arrivalTime = getCurrentTimeString();
      const repair: Partial<CreateCommuteLogInput> = adoptable.needsRepair
        ? {
            arrivalStationId: routeInput.arrivalStationId,
            arrivalStationName: routeInput.arrivalStationName,
            lineIds: routeInput.lineIds,
          }
        : {};
      await this.updateLog(userId, adoptable.log.id, { arrivalTime, ...repair });
      return { ...adoptable.log, arrivalTime, ...repair };
    }
    // No open log to adopt. If this leg is already completed — same destination
    // OR a filled stub — do nothing; otherwise (no match, or only
    // different-destination logs) start a standalone evening log. Uses the same
    // matchesLeg predicate as adoption/departure so all three stay consistent.
    const legAlreadyCompleted = legLogs.some(
      (log) => log.arrivalTime && matchesLeg(log, routeInput.arrivalStationName)
    );
    if (legAlreadyCompleted) return null;
    return this.logCommute(userId, routeInput);
  }

  /**
   * Clean up old logs (older than MAX_LOG_AGE_DAYS * 2)
   */
  async cleanupOldLogs(userId: string): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_LOG_AGE_DAYS * 2);
    const cutoffDateStr = formatDateString(cutoffDate);

    const userLogsRef = collection(db, COLLECTION_NAME, userId, 'logs');
    const q = query(
      userLogsRef,
      where('date', '<', cutoffDateStr),
      limit(100)
    );

    const snapshot = await getDocs(q);
    let deletedCount = 0;

    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
      deletedCount++;
    }

    return deletedCount;
  }
}

export const commuteLogService = new CommuteLogService();
export default commuteLogService;
