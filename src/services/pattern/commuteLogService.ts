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
  wasDelayed?: boolean;
  delayMinutes?: number;
  isManual?: boolean;
}

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
    const now = new Date();
    const date = formatDateString(now);
    const dayOfWeek = getDayOfWeek(now);
    const departureTime = input.departureTime || getCurrentTimeString();

    const logData: CommuteLogDoc = {
      date,
      dayOfWeek,
      departureTime,
      arrivalTime: input.arrivalTime,
      departureStationId: input.departureStationId,
      departureStationName: input.departureStationName,
      arrivalStationId: input.arrivalStationId,
      arrivalStationName: input.arrivalStationName,
      lineIds: input.lineIds,
      wasDelayed: input.wasDelayed || false,
      delayMinutes: input.delayMinutes,
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
    let q = query(userLogsRef, orderBy('createdAt', 'desc'), limit(maxResults));

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
