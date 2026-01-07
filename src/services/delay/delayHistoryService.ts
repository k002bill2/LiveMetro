/**
 * Delay History Service
 * Manages delay history and certificate storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DelayCertificate,
  DelayHistoryEntry,
  DelayReason,
  generateCertificateNumber,
} from '@/models/delayCertificate';

const STORAGE_KEYS = {
  DELAY_HISTORY: '@livemetro:delay_history',
  DELAY_CERTIFICATES: '@livemetro:delay_certificates',
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
    };

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
}

export const delayHistoryService = new DelayHistoryService();
export default delayHistoryService;
