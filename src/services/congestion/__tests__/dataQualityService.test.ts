/**
 * Data Quality Service Tests
 */

import {
  dataQualityService,
  ReportWithContext,
} from '../dataQualityService';
import { CongestionLevel, CongestionReport } from '@/models/congestion';

describe('DataQualityService', () => {
  const createMockReport = (overrides: Partial<CongestionReport> = {}): CongestionReport => ({
    id: `report_${Math.random()}`,
    trainId: 'train123',
    lineId: '2',
    stationId: 'station1',
    carNumber: 3,
    congestionLevel: CongestionLevel.MODERATE,
    reporterId: 'user1',
    timestamp: new Date(),
    ...overrides,
  });

  describe('assessQuality', () => {
    it('should handle empty reports', () => {
      const report = dataQualityService.assessQuality([]);

      expect(report.totalReports).toBe(0);
      expect(report.validReports).toBe(0);
      expect(report.qualityScore).toBe(100);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate quality metrics', () => {
      const reports = [
        createMockReport(),
        createMockReport(),
        createMockReport(),
      ];

      const report = dataQualityService.assessQuality(reports);

      expect(report.totalReports).toBe(3);
      expect(report.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should detect stale reports', () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const reports = [
        createMockReport({ timestamp: oldTimestamp }),
        createMockReport({ timestamp: oldTimestamp }),
        createMockReport(),
      ];

      const report = dataQualityService.assessQuality(reports);

      const staleIssue = report.issues.find(i => i.type === 'stale');
      expect(staleIssue).toBeDefined();
    });
  });

  describe('validateReport', () => {
    it('should validate correct report', () => {
      const report = createMockReport();
      const result = dataQualityService.validateReport(report, [report]);

      expect(result.isValid).toBe(true);
      expect(result.isOutlier).toBe(false);
    });

    it('should invalidate report with missing fields', () => {
      const report = createMockReport({ trainId: '' });
      const result = dataQualityService.validateReport(report, [report]);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Missing');
    });

    it('should invalidate report with invalid car number', () => {
      const report = createMockReport({ carNumber: 15 });
      const result = dataQualityService.validateReport(report, [report]);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('car number');
    });

    it('should invalidate stale report', () => {
      const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000);
      const report = createMockReport({ timestamp: oldTimestamp });
      const result = dataQualityService.validateReport(report, [report]);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Stale');
    });
  });

  describe('detectOutlier', () => {
    it('should not detect outlier with few reports', () => {
      const report = createMockReport({ congestionLevel: CongestionLevel.CROWDED });
      const reports = [report, createMockReport()];

      const result = dataQualityService.detectOutlier(report, reports);

      expect(result.isOutlier).toBe(false);
    });

    it('should calculate zscore for reports with enough related data', () => {
      const trainId = 'testTrain';
      const carNumber = 3;
      const baseTimestamp = new Date();

      // Create consistent reports (need 3+ related reports for zscore calculation)
      const consistentReports = Array.from({ length: 4 }, (_, i) =>
        createMockReport({
          id: `consistent_${i}`,
          trainId,
          carNumber,
          congestionLevel: CongestionLevel.LOW,
          timestamp: new Date(baseTimestamp.getTime() + i * 1000),
        })
      );

      // Test report within same train/car
      const testReport = createMockReport({
        id: 'test',
        trainId,
        carNumber,
        congestionLevel: CongestionLevel.LOW,
        timestamp: new Date(baseTimestamp.getTime() + 5000),
      });

      const allReports = [...consistentReports, testReport];
      const result = dataQualityService.detectOutlier(testReport, allReports);

      // With all same levels, zscore should be 0 (not an outlier)
      expect(result.isOutlier).toBe(false);
      expect(result.zscore).toBe(0);
    });

    it('should return zscore 0 when not enough related reports', () => {
      const report = createMockReport();
      const unrelatedReports = [
        createMockReport({ trainId: 'other1' }),
        createMockReport({ trainId: 'other2' }),
      ];

      const result = dataQualityService.detectOutlier(report, [...unrelatedReports, report]);

      expect(result.isOutlier).toBe(false);
      expect(result.zscore).toBe(0);
    });
  });

  describe('calculateReporterReliability', () => {
    it('should return default score for new user', () => {
      const reliability = dataQualityService.calculateReporterReliability(
        'newUser',
        []
      );

      expect(reliability.reporterId).toBe('newUser');
      expect(reliability.totalReports).toBe(0);
      expect(reliability.reliabilityScore).toBe(50);
    });

    it('should calculate reliability based on reports', () => {
      const reports = [
        createMockReport({ reporterId: 'user1' }),
        createMockReport({ reporterId: 'user1' }),
        createMockReport({ reporterId: 'user1' }),
      ];

      const reliability = dataQualityService.calculateReporterReliability(
        'user1',
        reports
      );

      expect(reliability.totalReports).toBe(3);
      expect(reliability.reliabilityScore).toBeGreaterThan(0);
    });
  });

  describe('filterHighQualityReports', () => {
    it('should filter out invalid reports', () => {
      const validReport = createMockReport();
      const invalidReport = createMockReport({ trainId: '' });
      const staleReport = createMockReport({
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
      });

      const filtered = dataQualityService.filterHighQualityReports([
        validReport,
        invalidReport,
        staleReport,
      ]);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe(validReport.id);
    });
  });

  describe('getWeightedCongestion', () => {
    it('should return MODERATE for empty reports', () => {
      const level = dataQualityService.getWeightedCongestion([]);

      expect(level).toBe(CongestionLevel.MODERATE);
    });

    it('should weight recent reports higher', () => {
      const now = Date.now();
      const recentReport = createMockReport({
        congestionLevel: CongestionLevel.CROWDED,
        timestamp: new Date(now),
      });
      const olderReport = createMockReport({
        congestionLevel: CongestionLevel.LOW,
        timestamp: new Date(now - 20 * 60 * 1000), // 20 minutes ago
      });

      const level = dataQualityService.getWeightedCongestion([
        recentReport,
        olderReport,
      ]);

      // Recent report (CROWDED=4) should have more weight than older (LOW=1)
      // Result should be closer to CROWDED than LOW
      expect([CongestionLevel.HIGH, CongestionLevel.CROWDED]).toContain(level);
    });

    it('should return correct level for consistent reports', () => {
      const reports = [
        createMockReport({ congestionLevel: CongestionLevel.HIGH }),
        createMockReport({ congestionLevel: CongestionLevel.HIGH }),
        createMockReport({ congestionLevel: CongestionLevel.HIGH }),
      ];

      const level = dataQualityService.getWeightedCongestion(reports);

      expect(level).toBe(CongestionLevel.HIGH);
    });
  });

  describe('ReportWithContext type', () => {
    it('should be exported', () => {
      const context: ReportWithContext = {
        report: createMockReport(),
        nearbyReports: [],
        recentReports: [],
      };

      expect(context.report).toBeDefined();
      expect(Array.isArray(context.nearbyReports)).toBe(true);
      expect(Array.isArray(context.recentReports)).toBe(true);
    });
  });
});
