/**
 * Fraud Detection Service for Delay Reports
 * Detects and flags potentially fraudulent delay reports
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

/**
 * Report for fraud analysis
 */
export interface ReportForAnalysis {
  readonly id: string;
  readonly userId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly delayMinutes: number;
  readonly timestamp: Date;
  readonly reason?: string;
}

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  readonly isSuspicious: boolean;
  readonly fraudScore: number; // 0-100, higher = more suspicious
  readonly flags: readonly FraudFlag[];
  readonly recommendation: 'accept' | 'review' | 'reject';
}

/**
 * Fraud flag
 */
export interface FraudFlag {
  readonly type: FraudFlagType;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly evidence?: string;
}

/**
 * Fraud flag types
 */
export type FraudFlagType =
  | 'rapid_reporting'      // Too many reports in short time
  | 'inconsistent_delay'   // Delay doesn't match other reports
  | 'unusual_location'     // Report from unusual location
  | 'pattern_anomaly'      // Deviates from user's typical pattern
  | 'no_official_delay'    // No official delay reported
  | 'extreme_delay'        // Unusually high delay claimed
  | 'repeat_offender'      // User has history of flagged reports
  | 'time_anomaly';        // Report timing is suspicious

/**
 * User fraud profile
 */
export interface UserFraudProfile {
  readonly userId: string;
  readonly totalReports: number;
  readonly flaggedReports: number;
  readonly trustScore: number; // 0-100
  readonly lastFlaggedAt?: Date;
  readonly flags: readonly string[];
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:fraud_profiles';

// Thresholds
const RAPID_REPORT_THRESHOLD = 3; // max reports per 10 minutes
const RAPID_REPORT_WINDOW_MS = 10 * 60 * 1000;
const EXTREME_DELAY_THRESHOLD = 60; // minutes
const MIN_TRUST_SCORE = 20;

// ============================================================================
// Service
// ============================================================================

class FraudDetectionService {
  private userProfiles: Map<string, UserFraudProfile> = new Map();
  private recentReports: Map<string, Date[]> = new Map();
  private initialized = false;

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        for (const [key, value] of Object.entries(parsed)) {
          this.userProfiles.set(key, value as UserFraudProfile);
        }
      }
    } catch {
      // Ignore
    }

    this.initialized = true;
  }

  /**
   * Analyze a report for fraud
   */
  async analyzeReport(
    report: ReportForAnalysis,
    otherReports: readonly ReportForAnalysis[]
  ): Promise<FraudDetectionResult> {
    await this.initialize();

    const flags: FraudFlag[] = [];
    let fraudScore = 0;

    // Check 1: Rapid reporting
    const rapidReportFlag = this.checkRapidReporting(report.userId);
    if (rapidReportFlag) {
      flags.push(rapidReportFlag);
      fraudScore += 20;
    }

    // Check 2: Inconsistent delay
    const inconsistentFlag = this.checkInconsistentDelay(report, otherReports);
    if (inconsistentFlag) {
      flags.push(inconsistentFlag);
      fraudScore += 25;
    }

    // Check 3: Extreme delay
    const extremeFlag = this.checkExtremeDelay(report.delayMinutes);
    if (extremeFlag) {
      flags.push(extremeFlag);
      fraudScore += 15;
    }

    // Check 4: User history
    const historyFlag = this.checkUserHistory(report.userId);
    if (historyFlag) {
      flags.push(historyFlag);
      fraudScore += 20;
    }

    // Check 5: Time anomaly
    const timeFlag = this.checkTimeAnomaly(report.timestamp);
    if (timeFlag) {
      flags.push(timeFlag);
      fraudScore += 10;
    }

    // Determine recommendation
    let recommendation: 'accept' | 'review' | 'reject';
    if (fraudScore >= 50) {
      recommendation = 'reject';
    } else if (fraudScore >= 25) {
      recommendation = 'review';
    } else {
      recommendation = 'accept';
    }

    // Record this report for future analysis
    this.recordReport(report.userId);

    return {
      isSuspicious: fraudScore >= 25,
      fraudScore,
      flags,
      recommendation,
    };
  }

  /**
   * Get user fraud profile
   */
  async getUserProfile(userId: string): Promise<UserFraudProfile> {
    await this.initialize();

    return this.userProfiles.get(userId) ?? {
      userId,
      totalReports: 0,
      flaggedReports: 0,
      trustScore: 100,
      flags: [],
    };
  }

  /**
   * Update user profile after review
   */
  async updateUserProfile(
    userId: string,
    wasFraudulent: boolean
  ): Promise<void> {
    await this.initialize();

    const profile = await this.getUserProfile(userId);

    const newProfile: UserFraudProfile = {
      userId,
      totalReports: profile.totalReports + 1,
      flaggedReports: wasFraudulent ? profile.flaggedReports + 1 : profile.flaggedReports,
      trustScore: this.calculateTrustScore(
        profile.totalReports + 1,
        wasFraudulent ? profile.flaggedReports + 1 : profile.flaggedReports
      ),
      lastFlaggedAt: wasFraudulent ? new Date() : profile.lastFlaggedAt,
      flags: wasFraudulent
        ? [...profile.flags, new Date().toISOString()]
        : profile.flags,
    };

    this.userProfiles.set(userId, newProfile);
    await this.saveProfiles();
  }

  /**
   * Check if user is trusted
   */
  async isUserTrusted(userId: string): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    return profile.trustScore >= MIN_TRUST_SCORE;
  }

  /**
   * Get trust level label
   */
  getTrustLevelLabel(trustScore: number): string {
    if (trustScore >= 90) return '매우 높음';
    if (trustScore >= 70) return '높음';
    if (trustScore >= 50) return '보통';
    if (trustScore >= 30) return '낮음';
    return '매우 낮음';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check for rapid reporting
   */
  private checkRapidReporting(userId: string): FraudFlag | null {
    const now = Date.now();
    const userReports = this.recentReports.get(userId) ?? [];

    // Clean old reports
    const recentReports = userReports.filter(
      date => now - date.getTime() < RAPID_REPORT_WINDOW_MS
    );

    if (recentReports.length >= RAPID_REPORT_THRESHOLD) {
      return {
        type: 'rapid_reporting',
        severity: 'medium',
        description: '짧은 시간 내 다수 제보',
        evidence: `${recentReports.length}개의 제보가 10분 내 발생`,
      };
    }

    return null;
  }

  /**
   * Check for inconsistent delay
   */
  private checkInconsistentDelay(
    report: ReportForAnalysis,
    otherReports: readonly ReportForAnalysis[]
  ): FraudFlag | null {
    // Get reports from same line/time window
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const similarReports = otherReports.filter(r =>
      r.lineId === report.lineId &&
      r.id !== report.id &&
      Math.abs(r.timestamp.getTime() - report.timestamp.getTime()) < timeWindow
    );

    if (similarReports.length < 2) return null;

    // Calculate average delay from other reports
    const otherDelays = similarReports.map(r => r.delayMinutes);
    const avgDelay = otherDelays.reduce((a, b) => a + b, 0) / otherDelays.length;

    // Check if this report differs significantly
    const diff = Math.abs(report.delayMinutes - avgDelay);
    if (diff > 15) {
      return {
        type: 'inconsistent_delay',
        severity: 'high',
        description: '다른 사용자 제보와 불일치',
        evidence: `제보: ${report.delayMinutes}분, 평균: ${Math.round(avgDelay)}분`,
      };
    }

    return null;
  }

  /**
   * Check for extreme delay
   */
  private checkExtremeDelay(delayMinutes: number): FraudFlag | null {
    if (delayMinutes > EXTREME_DELAY_THRESHOLD) {
      return {
        type: 'extreme_delay',
        severity: 'medium',
        description: '비정상적으로 긴 지연 시간',
        evidence: `${delayMinutes}분 지연 제보`,
      };
    }

    return null;
  }

  /**
   * Check user history
   */
  private checkUserHistory(userId: string): FraudFlag | null {
    const profile = this.userProfiles.get(userId);

    if (!profile) return null;

    if (profile.flaggedReports >= 3 && profile.trustScore < 50) {
      return {
        type: 'repeat_offender',
        severity: 'high',
        description: '과거 허위 제보 이력',
        evidence: `${profile.flaggedReports}건의 허위 제보 이력`,
      };
    }

    return null;
  }

  /**
   * Check time anomaly
   */
  private checkTimeAnomaly(timestamp: Date): FraudFlag | null {
    const hour = timestamp.getHours();

    // Reports during non-operating hours (1am - 5am)
    if (hour >= 1 && hour < 5) {
      return {
        type: 'time_anomaly',
        severity: 'low',
        description: '심야 시간대 제보',
        evidence: `${hour}시에 제보됨 (운행 시간 외)`,
      };
    }

    return null;
  }

  /**
   * Record a report for future analysis
   */
  private recordReport(userId: string): void {
    const reports = this.recentReports.get(userId) ?? [];
    reports.push(new Date());

    // Keep only last hour of reports
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = reports.filter(d => d.getTime() > oneHourAgo);

    this.recentReports.set(userId, filtered);
  }

  /**
   * Calculate trust score
   */
  private calculateTrustScore(totalReports: number, flaggedReports: number): number {
    if (totalReports === 0) return 100;

    const fraudRate = flaggedReports / totalReports;
    const baseScore = 100 - fraudRate * 100;

    // Bonus for volume (trusted users have more reports)
    const volumeBonus = Math.min(10, totalReports);

    return Math.max(0, Math.min(100, baseScore + volumeBonus));
  }

  /**
   * Save profiles to storage
   */
  private async saveProfiles(): Promise<void> {
    try {
      const data = Object.fromEntries(this.userProfiles);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const fraudDetectionService = new FraudDetectionService();
export default fraudDetectionService;
