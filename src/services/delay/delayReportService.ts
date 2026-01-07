/**
 * Delay Report Service
 * Firebase-based real-time delay reporting system
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
  onSnapshot,
  getDocs,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import {
  DelayReport,
  CreateReportInput,
  ReportSummary,
  ReportType,
  ReportSeverity,
} from '@/models/delayReport';

const COLLECTION_NAME = 'delayReports';
const MAX_REPORT_AGE_HOURS = 4; // Reports older than this are considered inactive

/**
 * Delay Report Service
 */
class DelayReportService {
  /**
   * Submit a new delay report
   */
  async submitReport(input: CreateReportInput): Promise<DelayReport> {
    const now = new Date();

    const reportData = {
      userId: input.userId,
      userDisplayName: input.userDisplayName || '익명',
      lineId: input.lineId,
      stationId: input.stationId,
      stationName: input.stationName,
      reportType: input.reportType,
      severity: input.severity || ReportSeverity.MEDIUM,
      description: input.description || '',
      estimatedDelayMinutes: input.estimatedDelayMinutes || null,
      timestamp: Timestamp.fromDate(now),
      upvotes: 0,
      upvotedBy: [],
      verified: false,
      active: true,
      updatedAt: Timestamp.fromDate(now),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), reportData);

    return {
      id: docRef.id,
      ...reportData,
      timestamp: now,
      updatedAt: now,
    } as DelayReport;
  }

  /**
   * Get recent reports for a specific line
   */
  async getLineReports(lineId: string, maxResults = 20): Promise<DelayReport[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_REPORT_AGE_HOURS);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('lineId', '==', lineId),
      where('active', '==', true),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => this.docToReport(doc));
  }

  /**
   * Get all recent active reports
   */
  async getActiveReports(maxResults = 50): Promise<DelayReport[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_REPORT_AGE_HOURS);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('active', '==', true),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => this.docToReport(doc));
  }

  /**
   * Subscribe to real-time updates for a line
   */
  subscribeToLineReports(
    lineId: string,
    callback: (reports: DelayReport[]) => void
  ): () => void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_REPORT_AGE_HOURS);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('lineId', '==', lineId),
      where('active', '==', true),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    return onSnapshot(q, snapshot => {
      const reports = snapshot.docs.map(doc => this.docToReport(doc));
      callback(reports);
    });
  }

  /**
   * Subscribe to all active reports
   */
  subscribeToActiveReports(
    callback: (reports: DelayReport[]) => void
  ): () => void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_REPORT_AGE_HOURS);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('active', '==', true),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, snapshot => {
      const reports = snapshot.docs.map(doc => this.docToReport(doc));
      callback(reports);
    });
  }

  /**
   * Upvote a report
   */
  async upvoteReport(reportId: string, userId: string): Promise<void> {
    const reportRef = doc(db, COLLECTION_NAME, reportId);

    await updateDoc(reportRef, {
      upvotes: increment(1),
      upvotedBy: arrayUnion(userId),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Remove upvote from a report
   */
  async removeUpvote(reportId: string, userId: string): Promise<void> {
    const reportRef = doc(db, COLLECTION_NAME, reportId);

    await updateDoc(reportRef, {
      upvotes: increment(-1),
      upvotedBy: arrayRemove(userId),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Mark a report as resolved
   */
  async resolveReport(reportId: string): Promise<void> {
    const reportRef = doc(db, COLLECTION_NAME, reportId);

    await updateDoc(reportRef, {
      active: false,
      resolvedAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Delete a report (only by owner)
   */
  async deleteReport(reportId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, reportId));
  }

  /**
   * Get report summary by line
   */
  async getLineSummaries(): Promise<ReportSummary[]> {
    const reports = await this.getActiveReports(100);

    // Group by line
    const lineReports = new Map<string, DelayReport[]>();

    for (const report of reports) {
      const existing = lineReports.get(report.lineId) || [];
      existing.push(report);
      lineReports.set(report.lineId, existing);
    }

    // Create summaries
    const summaries: ReportSummary[] = [];

    for (const [lineId, lineReportList] of lineReports) {
      const totalUpvotes = lineReportList.reduce((sum, r) => sum + r.upvotes, 0);

      // Find dominant type
      const typeCounts = new Map<ReportType, number>();
      for (const r of lineReportList) {
        typeCounts.set(r.reportType, (typeCounts.get(r.reportType) || 0) + 1);
      }

      let dominantType: ReportType | null = null;
      let maxCount = 0;
      for (const [type, count] of typeCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantType = type;
        }
      }

      // Calculate average severity
      const severityOrder = [
        ReportSeverity.LOW,
        ReportSeverity.MEDIUM,
        ReportSeverity.HIGH,
        ReportSeverity.CRITICAL,
      ];
      const avgSeverityIndex = Math.round(
        lineReportList.reduce(
          (sum, r) => sum + severityOrder.indexOf(r.severity),
          0
        ) / lineReportList.length
      );

      summaries.push({
        lineId,
        reportCount: lineReportList.length,
        totalUpvotes,
        mostRecentReport: lineReportList[0] || null,
        dominantType,
        averageSeverity: severityOrder[avgSeverityIndex] || ReportSeverity.MEDIUM,
      });
    }

    return summaries.sort((a, b) => b.reportCount - a.reportCount);
  }

  /**
   * Check if user has already reported for this line recently
   */
  async hasRecentReport(userId: string, lineId: string): Promise<boolean> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 5); // 5 minute cooldown

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('lineId', '==', lineId),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Convert Firestore document to DelayReport
   */
  private docToReport(doc: any): DelayReport {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userDisplayName: data.userDisplayName,
      lineId: data.lineId,
      stationId: data.stationId,
      stationName: data.stationName,
      reportType: data.reportType,
      severity: data.severity,
      description: data.description,
      estimatedDelayMinutes: data.estimatedDelayMinutes,
      timestamp: data.timestamp?.toDate() || new Date(),
      upvotes: data.upvotes || 0,
      upvotedBy: data.upvotedBy || [],
      verified: data.verified || false,
      active: data.active ?? true,
      resolvedAt: data.resolvedAt?.toDate(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

export const delayReportService = new DelayReportService();
export default delayReportService;
