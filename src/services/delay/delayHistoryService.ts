/**
 * Delay History Service
 * Manages delay history and certificate storage with Firestore sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  DelayCertificate,
  DelayHistoryEntry,
  DelayReason,
  generateCertificateNumber,
} from '@/models/delayCertificate';

const STORAGE_KEYS = {
  DELAY_HISTORY: '@livemetro:delay_history',
  DELAY_CERTIFICATES: '@livemetro:delay_certificates',
  SYNC_TIMESTAMP: '@livemetro:delay_sync_timestamp',
};

const FIRESTORE_COLLECTIONS = {
  CERTIFICATES: 'delayCertificates',
  HISTORY: 'delayHistory',
};

const MAX_HISTORY_ENTRIES = 100;
const MAX_HISTORY_DAYS = 30;

/**
 * Delay History Service
 */
class DelayHistoryService {
  /**
   * Add a new delay history entry
   */
  async addHistoryEntry(
    entry: Omit<DelayHistoryEntry, 'id' | 'certificateGenerated'>
  ): Promise<DelayHistoryEntry> {
    const history = await this.getHistory();

    const newEntry: DelayHistoryEntry = {
      ...entry,
      id: `delay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      certificateGenerated: false,
    };

    // Add to beginning
    history.unshift(newEntry);

    // Keep only recent entries
    const trimmedHistory = this.trimHistory(history);

    await AsyncStorage.setItem(
      STORAGE_KEYS.DELAY_HISTORY,
      JSON.stringify(trimmedHistory)
    );

    return newEntry;
  }

  /**
   * Get all delay history entries
   */
  async getHistory(): Promise<DelayHistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DELAY_HISTORY);
      if (!data) return [];

      const history = JSON.parse(data) as DelayHistoryEntry[];

      // Convert date strings to Date objects
      return history.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get history for specific user
   */
  async getUserHistory(userId: string): Promise<DelayHistoryEntry[]> {
    const history = await this.getHistory();
    return history.filter(entry => entry.userId === userId);
  }

  /**
   * Get history for specific line
   */
  async getLineHistory(lineId: string): Promise<DelayHistoryEntry[]> {
    const history = await this.getHistory();
    return history.filter(entry => entry.lineId === lineId);
  }

  /**
   * Generate a certificate from a history entry
   */
  async generateCertificate(
    historyId: string,
    scheduledTime: string,
    actualTime: string
  ): Promise<DelayCertificate | null> {
    const history = await this.getHistory();
    const entryIndex = history.findIndex(e => e.id === historyId);

    if (entryIndex === -1) return null;

    const entry = history[entryIndex];
    if (!entry) return null;

    // Create certificate
    const certificate: DelayCertificate = {
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      certificateNumber: generateCertificateNumber(),
      userId: entry.userId,
      date: entry.timestamp,
      lineId: entry.lineId,
      stationId: entry.stationId,
      stationName: entry.stationName,
      scheduledTime,
      actualTime,
      delayMinutes: entry.delayMinutes,
      reason: entry.reason || DelayReason.OTHER,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save certificate
    await this.saveCertificate(certificate);

    // Update history entry
    history[entryIndex] = {
      ...entry,
      certificateGenerated: true,
      certificateId: certificate.id,
    } as DelayHistoryEntry;

    await AsyncStorage.setItem(
      STORAGE_KEYS.DELAY_HISTORY,
      JSON.stringify(history)
    );

    return certificate;
  }

  /**
   * Save a certificate
   */
  async saveCertificate(certificate: DelayCertificate): Promise<void> {
    const certificates = await this.getCertificates();
    certificates.unshift(certificate);

    await AsyncStorage.setItem(
      STORAGE_KEYS.DELAY_CERTIFICATES,
      JSON.stringify(certificates)
    );
  }

  /**
   * Get all certificates
   */
  async getCertificates(): Promise<DelayCertificate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DELAY_CERTIFICATES);
      if (!data) return [];

      const certificates = JSON.parse(data) as DelayCertificate[];

      // Convert date strings to Date objects
      return certificates.map(cert => ({
        ...cert,
        date: new Date(cert.date),
        createdAt: new Date(cert.createdAt),
        updatedAt: new Date(cert.updatedAt),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get certificates for specific user
   */
  async getUserCertificates(userId: string): Promise<DelayCertificate[]> {
    const certificates = await this.getCertificates();
    return certificates.filter(cert => cert.userId === userId);
  }

  /**
   * Get a specific certificate by ID
   */
  async getCertificateById(id: string): Promise<DelayCertificate | null> {
    const certificates = await this.getCertificates();
    return certificates.find(cert => cert.id === id) || null;
  }

  /**
   * Get a certificate by certificate number
   */
  async getCertificateByNumber(
    certificateNumber: string
  ): Promise<DelayCertificate | null> {
    const certificates = await this.getCertificates();
    return certificates.find(cert => cert.certificateNumber === certificateNumber) || null;
  }

  /**
   * Delete a certificate
   */
  async deleteCertificate(id: string): Promise<boolean> {
    const certificates = await this.getCertificates();
    const index = certificates.findIndex(cert => cert.id === id);

    if (index === -1) return false;

    certificates.splice(index, 1);

    await AsyncStorage.setItem(
      STORAGE_KEYS.DELAY_CERTIFICATES,
      JSON.stringify(certificates)
    );

    return true;
  }

  /**
   * Clear all history (for debugging/testing)
   */
  async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.DELAY_HISTORY);
  }

  /**
   * Clear all certificates (for debugging/testing)
   */
  async clearCertificates(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.DELAY_CERTIFICATES);
  }

  /**
   * Add sample data for testing (개발/테스트용)
   */
  async addSampleData(userId: string): Promise<void> {
    const now = new Date();

    // 샘플 지연 이력 추가
    const sampleEntries = [
      {
        userId,
        lineId: '2',
        stationId: '0222',
        stationName: '강남',
        delayMinutes: 15,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2시간 전
        reason: DelayReason.SIGNAL_FAILURE,
        rawMessage: '신호 장애로 인한 지연',
      },
      {
        userId,
        lineId: '3',
        stationId: '0309',
        stationName: '교대',
        delayMinutes: 8,
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1일 전
        reason: DelayReason.CONGESTION,
        rawMessage: '혼잡으로 인한 지연',
      },
      {
        userId,
        lineId: '7',
        stationId: '0729',
        stationName: '고속터미널',
        delayMinutes: 12,
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3일 전
        reason: DelayReason.MECHANICAL_FAILURE,
        rawMessage: '차량 고장으로 인한 지연',
      },
    ];

    for (const entry of sampleEntries) {
      await this.addHistoryEntry(entry);
    }

    // 샘플 증명서 1개 발급
    const history = await this.getHistory();
    if (history.length > 0 && history[0]) {
      const firstEntry = history[0];
      const scheduledTime = new Date(firstEntry.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const actualTime = new Date(
        firstEntry.timestamp.getTime() + firstEntry.delayMinutes * 60000
      ).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.generateCertificate(firstEntry.id, scheduledTime, actualTime);
    }
  }

  /**
   * Trim history to keep only recent entries within limits
   */
  private trimHistory(history: DelayHistoryEntry[]): DelayHistoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);

    return history
      .filter(entry => new Date(entry.timestamp) >= cutoffDate)
      .slice(0, MAX_HISTORY_ENTRIES);
  }

  /**
   * Format certificate for display/sharing
   */
  formatCertificateText(certificate: DelayCertificate): string {
    const dateStr = certificate.date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        지하철 지연 증명서
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

증명서 번호: ${certificate.certificateNumber}

◎ 지연 정보
• 일자: ${dateStr}
• 노선: ${certificate.lineId}호선
• 역명: ${certificate.stationName}역
• 예정 시간: ${certificate.scheduledTime}
• 실제 시간: ${certificate.actualTime}
• 지연 시간: ${certificate.delayMinutes}분

◎ 발급 정보
• 발급일: ${certificate.createdAt.toLocaleDateString('ko-KR')}
• 발급자: LiveMetro

※ 본 증명서는 참고용이며,
   공식 지연증명서는 또타지하철 앱에서
   발급받으실 수 있습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  // ============================================================================
  // Firestore Sync Methods
  // ============================================================================

  /**
   * Sync certificate to Firestore
   */
  async syncCertificateToFirestore(certificate: DelayCertificate): Promise<boolean> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.CERTIFICATES, certificate.id);

      await setDoc(docRef, {
        certificateNumber: certificate.certificateNumber,
        userId: certificate.userId,
        date: Timestamp.fromDate(certificate.date),
        lineId: certificate.lineId,
        stationId: certificate.stationId,
        stationName: certificate.stationName,
        scheduledTime: certificate.scheduledTime,
        actualTime: certificate.actualTime,
        delayMinutes: certificate.delayMinutes,
        reason: certificate.reason,
        verified: certificate.verified,
        createdAt: Timestamp.fromDate(certificate.createdAt),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      return true;
    } catch (error) {
      console.error('Failed to sync certificate to Firestore:', error);
      return false;
    }
  }

  /**
   * Fetch certificate from Firestore
   */
  async fetchCertificateFromFirestore(certificateId: string): Promise<DelayCertificate | null> {
    try {
      const docRef = doc(db, FIRESTORE_COLLECTIONS.CERTIFICATES, certificateId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        certificateNumber: data.certificateNumber,
        userId: data.userId,
        date: data.date.toDate(),
        lineId: data.lineId,
        stationId: data.stationId,
        stationName: data.stationName,
        scheduledTime: data.scheduledTime,
        actualTime: data.actualTime,
        delayMinutes: data.delayMinutes,
        reason: data.reason,
        verified: data.verified,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      };
    } catch (error) {
      console.error('Failed to fetch certificate from Firestore:', error);
      return null;
    }
  }

  /**
   * Sync all certificates for a user
   */
  async syncUserCertificates(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.CERTIFICATES),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const certificates: DelayCertificate[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        certificates.push({
          id: docSnap.id,
          certificateNumber: data.certificateNumber,
          userId: data.userId,
          date: data.date.toDate(),
          lineId: data.lineId,
          stationId: data.stationId,
          stationName: data.stationName,
          scheduledTime: data.scheduledTime,
          actualTime: data.actualTime,
          delayMinutes: data.delayMinutes,
          reason: data.reason,
          verified: data.verified,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        });
      }

      // Merge with local certificates
      const localCerts = await this.getCertificates();
      const mergedCerts = this.mergeCertificates(localCerts, certificates);

      await AsyncStorage.setItem(
        STORAGE_KEYS.DELAY_CERTIFICATES,
        JSON.stringify(mergedCerts)
      );

      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNC_TIMESTAMP,
        Date.now().toString()
      );

      return certificates.length;
    } catch (error) {
      console.error('Failed to sync user certificates:', error);
      return 0;
    }
  }

  /**
   * Verify certificate exists in Firestore
   */
  async verifyCertificateExists(certificateNumber: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.CERTIFICATES),
        where('certificateNumber', '==', certificateNumber),
        limit(1)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch {
      return false;
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_TIMESTAMP);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Merge local and remote certificates
   */
  private mergeCertificates(
    local: DelayCertificate[],
    remote: DelayCertificate[]
  ): DelayCertificate[] {
    const merged = new Map<string, DelayCertificate>();

    // Add local certificates
    for (const cert of local) {
      merged.set(cert.id, cert);
    }

    // Merge remote certificates (prefer newer)
    for (const cert of remote) {
      const existing = merged.get(cert.id);
      if (!existing || cert.updatedAt > existing.updatedAt) {
        merged.set(cert.id, cert);
      }
    }

    // Sort by date descending
    return Array.from(merged.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}

export const delayHistoryService = new DelayHistoryService();
export default delayHistoryService;
