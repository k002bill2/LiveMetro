/**
 * Data Quality Service for Congestion
 * Handles outlier detection, data validation, and quality metrics
 */

import { CongestionLevel, CongestionReport } from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

/**
 * Data quality report
 */
export interface DataQualityReport {
  readonly totalReports: number;
  readonly validReports: number;
  readonly invalidReports: number;
  readonly outlierReports: number;
  readonly qualityScore: number; // 0-100
  readonly issues: readonly DataQualityIssue[];
  readonly recommendations: readonly string[];
}

/**
 * Data quality issue
 */
export interface DataQualityIssue {
  readonly type: IssueType;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly affectedReports: number;
}

/**
 * Issue types
 */
export type IssueType =
  | 'outlier'
  | 'missing_data'
  | 'duplicate'
  | 'inconsistent'
  | 'stale'
  | 'spam';

/**
 * Outlier detection result
 */
export interface OutlierResult {
  readonly isOutlier: boolean;
  readonly zscore: number;
  readonly reason?: string;
}

/**
 * Reporter reliability
 */
export interface ReporterReliability {
  readonly reporterId: string;
  readonly totalReports: number;
  readonly consistentReports: number;
  readonly reliabilityScore: number; // 0-100
  readonly flagCount: number;
}

/**
 * Report with context for validation
 */
interface ReportWithContext {
  report: CongestionReport;
  nearbyReports: CongestionReport[];
  recentReports: CongestionReport[];
}

// ============================================================================
// Constants
// ============================================================================

const OUTLIER_ZSCORE_THRESHOLD = 2.5;
const STALE_THRESHOLD_MINUTES = 30;
const DUPLICATE_THRESHOLD_MINUTES = 2;
const SPAM_THRESHOLD_REPORTS_PER_MINUTE = 3;

// ============================================================================
// Service
// ============================================================================

class DataQualityService {
  /**
   * Assess overall data quality
   */
  assessQuality(reports: readonly CongestionReport[]): DataQualityReport {
    if (reports.length === 0) {
      return {
        totalReports: 0,
        validReports: 0,
        invalidReports: 0,
        outlierReports: 0,
        qualityScore: 100,
        issues: [],
        recommendations: ['데이터가 없습니다. 혼잡도 제보를 시작해주세요.'],
      };
    }

    const issues: DataQualityIssue[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let outlierCount = 0;

    // Check each report
    for (const report of reports) {
      const validation = this.validateReport(report, reports);

      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
        if (validation.isOutlier) {
          outlierCount++;
        }
      }
    }

    // Detect issues
    const outlierIssue = this.detectOutlierIssue(reports);
    if (outlierIssue) issues.push(outlierIssue);

    const duplicateIssue = this.detectDuplicateIssue(reports);
    if (duplicateIssue) issues.push(duplicateIssue);

    const staleIssue = this.detectStaleIssue(reports);
    if (staleIssue) issues.push(staleIssue);

    const spamIssue = this.detectSpamIssue(reports);
    if (spamIssue) issues.push(spamIssue);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(reports, issues);

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, qualityScore);

    return {
      totalReports: reports.length,
      validReports: validCount,
      invalidReports: invalidCount,
      outlierReports: outlierCount,
      qualityScore,
      issues,
      recommendations,
    };
  }

  /**
   * Validate a single report
   */
  validateReport(
    report: CongestionReport,
    allReports: readonly CongestionReport[]
  ): { isValid: boolean; isOutlier: boolean; reason?: string } {
    // Basic validation
    if (!report.trainId || !report.lineId || !report.stationId) {
      return { isValid: false, isOutlier: false, reason: 'Missing required fields' };
    }

    if (report.carNumber < 1 || report.carNumber > 10) {
      return { isValid: false, isOutlier: false, reason: 'Invalid car number' };
    }

    // Check if stale
    const now = Date.now();
    const reportAge = (now - report.timestamp.getTime()) / 60000; // minutes
    if (reportAge > STALE_THRESHOLD_MINUTES) {
      return { isValid: false, isOutlier: false, reason: 'Stale data' };
    }

    // Check for outliers
    const outlierResult = this.detectOutlier(report, allReports);
    if (outlierResult.isOutlier) {
      return { isValid: false, isOutlier: true, reason: outlierResult.reason };
    }

    return { isValid: true, isOutlier: false };
  }

  /**
   * Detect if a report is an outlier
   */
  detectOutlier(
    report: CongestionReport,
    allReports: readonly CongestionReport[]
  ): OutlierResult {
    // Get reports for the same train/car
    const relatedReports = allReports.filter(
      r =>
        r.id !== report.id &&
        r.trainId === report.trainId &&
        r.carNumber === report.carNumber &&
        Math.abs(r.timestamp.getTime() - report.timestamp.getTime()) < 10 * 60 * 1000
    );

    if (relatedReports.length < 3) {
      return { isOutlier: false, zscore: 0 };
    }

    const levels = relatedReports.map(r => this.levelToNumber(r.congestionLevel));
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const variance =
      levels.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / levels.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { isOutlier: false, zscore: 0 };
    }

    const reportLevel = this.levelToNumber(report.congestionLevel);
    const zscore = Math.abs(reportLevel - mean) / stdDev;

    if (zscore > OUTLIER_ZSCORE_THRESHOLD) {
      return {
        isOutlier: true,
        zscore,
        reason: `Z-score ${zscore.toFixed(2)} exceeds threshold`,
      };
    }

    return { isOutlier: false, zscore };
  }

  /**
   * Calculate reporter reliability
   */
  calculateReporterReliability(
    reporterId: string,
    reports: readonly CongestionReport[]
  ): ReporterReliability {
    const userReports = reports.filter(r => r.reporterId === reporterId);

    if (userReports.length === 0) {
      return {
        reporterId,
        totalReports: 0,
        consistentReports: 0,
        reliabilityScore: 50, // Default score for new users
        flagCount: 0,
      };
    }

    let consistentCount = 0;
    let flagCount = 0;

    for (const report of userReports) {
      const validation = this.validateReport(report, reports);
      if (validation.isValid) {
        consistentCount++;
      } else if (validation.isOutlier) {
        flagCount++;
      }
    }

    // Calculate reliability score
    const consistencyRate = consistentCount / userReports.length;
    const flagPenalty = Math.min(flagCount * 10, 30);
    const volumeBonus = Math.min(userReports.length, 10);

    const reliabilityScore = Math.max(
      0,
      Math.min(100, consistencyRate * 80 + volumeBonus - flagPenalty)
    );

    return {
      reporterId,
      totalReports: userReports.length,
      consistentReports: consistentCount,
      reliabilityScore,
      flagCount,
    };
  }

  /**
   * Filter out low quality reports
   */
  filterHighQualityReports(
    reports: readonly CongestionReport[]
  ): CongestionReport[] {
    return reports.filter(report => {
      const validation = this.validateReport(report, reports);
      return validation.isValid;
    });
  }

  /**
   * Get weighted congestion level accounting for quality
   */
  getWeightedCongestion(
    reports: readonly CongestionReport[]
  ): CongestionLevel {
    if (reports.length === 0) {
      return CongestionLevel.MODERATE;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const report of reports) {
      const validation = this.validateReport(report, reports);
      if (!validation.isValid) continue;

      // Weight based on recency
      const age = (Date.now() - report.timestamp.getTime()) / 60000;
      const recencyWeight = Math.max(0, 1 - age / STALE_THRESHOLD_MINUTES);

      const level = this.levelToNumber(report.congestionLevel);
      weightedSum += level * recencyWeight;
      totalWeight += recencyWeight;
    }

    if (totalWeight === 0) {
      return CongestionLevel.MODERATE;
    }

    const weightedAvg = weightedSum / totalWeight;
    return this.numberToLevel(Math.round(weightedAvg));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private levelToNumber(level: CongestionLevel): number {
    const mapping: Record<CongestionLevel, number> = {
      [CongestionLevel.LOW]: 1,
      [CongestionLevel.MODERATE]: 2,
      [CongestionLevel.HIGH]: 3,
      [CongestionLevel.CROWDED]: 4,
    };
    return mapping[level];
  }

  private numberToLevel(num: number): CongestionLevel {
    if (num <= 1.5) return CongestionLevel.LOW;
    if (num <= 2.5) return CongestionLevel.MODERATE;
    if (num <= 3.5) return CongestionLevel.HIGH;
    return CongestionLevel.CROWDED;
  }

  private detectOutlierIssue(
    reports: readonly CongestionReport[]
  ): DataQualityIssue | null {
    let outlierCount = 0;

    for (const report of reports) {
      const result = this.detectOutlier(report, reports);
      if (result.isOutlier) outlierCount++;
    }

    if (outlierCount === 0) return null;

    const percentage = (outlierCount / reports.length) * 100;
    let severity: 'low' | 'medium' | 'high';

    if (percentage > 20) severity = 'high';
    else if (percentage > 10) severity = 'medium';
    else severity = 'low';

    return {
      type: 'outlier',
      severity,
      description: `${outlierCount}개의 이상치 데이터가 발견되었습니다 (${percentage.toFixed(1)}%)`,
      affectedReports: outlierCount,
    };
  }

  private detectDuplicateIssue(
    reports: readonly CongestionReport[]
  ): DataQualityIssue | null {
    const duplicates = new Set<string>();

    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const r1 = reports[i];
        const r2 = reports[j];

        if (!r1 || !r2) continue;

        if (
          r1.reporterId === r2.reporterId &&
          r1.trainId === r2.trainId &&
          r1.carNumber === r2.carNumber &&
          Math.abs(r1.timestamp.getTime() - r2.timestamp.getTime()) <
            DUPLICATE_THRESHOLD_MINUTES * 60 * 1000
        ) {
          duplicates.add(r1.id);
          duplicates.add(r2.id);
        }
      }
    }

    if (duplicates.size === 0) return null;

    return {
      type: 'duplicate',
      severity: duplicates.size > 10 ? 'medium' : 'low',
      description: `${duplicates.size}개의 중복 제보가 발견되었습니다`,
      affectedReports: duplicates.size,
    };
  }

  private detectStaleIssue(
    reports: readonly CongestionReport[]
  ): DataQualityIssue | null {
    const now = Date.now();
    const staleReports = reports.filter(
      r => (now - r.timestamp.getTime()) / 60000 > STALE_THRESHOLD_MINUTES
    );

    if (staleReports.length === 0) return null;

    const percentage = (staleReports.length / reports.length) * 100;

    return {
      type: 'stale',
      severity: percentage > 50 ? 'high' : percentage > 25 ? 'medium' : 'low',
      description: `${staleReports.length}개의 오래된 데이터가 포함되어 있습니다`,
      affectedReports: staleReports.length,
    };
  }

  private detectSpamIssue(
    reports: readonly CongestionReport[]
  ): DataQualityIssue | null {
    const reporterCounts = new Map<string, number>();

    // Count reports per minute per reporter
    const oneMinuteAgo = Date.now() - 60000;
    const recentReports = reports.filter(r => r.timestamp.getTime() > oneMinuteAgo);

    for (const report of recentReports) {
      const count = (reporterCounts.get(report.reporterId) ?? 0) + 1;
      reporterCounts.set(report.reporterId, count);
    }

    const spammers = Array.from(reporterCounts.entries()).filter(
      ([_, count]) => count >= SPAM_THRESHOLD_REPORTS_PER_MINUTE
    );

    if (spammers.length === 0) return null;

    const affectedCount = spammers.reduce((sum, [_, count]) => sum + count, 0);

    return {
      type: 'spam',
      severity: 'high',
      description: `${spammers.length}명의 사용자가 과도한 제보를 하고 있습니다`,
      affectedReports: affectedCount,
    };
  }

  private calculateQualityScore(
    reports: readonly CongestionReport[],
    issues: readonly DataQualityIssue[]
  ): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    issues: readonly DataQualityIssue[],
    qualityScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (qualityScore >= 90) {
      recommendations.push('데이터 품질이 우수합니다');
      return recommendations;
    }

    for (const issue of issues) {
      switch (issue.type) {
        case 'outlier':
          recommendations.push('이상치 데이터를 제외하고 분석하는 것을 권장합니다');
          break;
        case 'duplicate':
          recommendations.push('중복 제보를 방지하기 위한 쿨다운 시간이 적용됩니다');
          break;
        case 'stale':
          recommendations.push('더 최근 데이터를 수집하면 정확도가 향상됩니다');
          break;
        case 'spam':
          recommendations.push('비정상적인 제보 패턴이 감지되어 필터링됩니다');
          break;
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('더 많은 사용자 제보가 필요합니다');
    }

    return recommendations;
  }
}

// ============================================================================
// Export
// ============================================================================

export const dataQualityService = new DataQualityService();
export default dataQualityService;
