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

const REPORTS_COLLECTION = 'congestionReports';
const SUMMARY_COLLECTION = 'congestionSummary';

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

    return onSnapshot(summaryRef, docSnap => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }

      callback(fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc));
    });
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

    return onSnapshot(q, snapshot => {
      const summaries = snapshot.docs.map(docSnap =>
        fromCongestionSummaryDoc(docSnap.id, docSnap.data() as CongestionSummaryDoc)
      );
      callback(summaries);
    });
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
      cars: Array<{
        carNumber: number;
        congestionLevel: CongestionLevel;
        reportCount: number;
        lastUpdated: Timestamp;
      }>;
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
}

export const congestionService = new CongestionService();
export default congestionService;
