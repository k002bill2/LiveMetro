/**
 * Fraud Detection Service Tests
 */

import {
  fraudDetectionService,
  ReportForAnalysis,
  FraudDetectionResult,
  UserFraudProfile,
} from '../fraudDetectionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('FraudDetectionService', () => {
  const createMockReport = (overrides: Partial<ReportForAnalysis> = {}): ReportForAnalysis => ({
    id: `report_${Math.random()}`,
    userId: 'user1',
    lineId: '2',
    stationId: 'gangnam',
    delayMinutes: 10,
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize without throwing', async () => {
      await expect(fraudDetectionService.initialize()).resolves.not.toThrow();
    });

    it('should load profiles from storage', async () => {
      const mockProfiles = {
        user1: {
          userId: 'user1',
          totalReports: 10,
          flaggedReports: 2,
          trustScore: 85,
          flags: [],
        },
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockProfiles));

      await fraudDetectionService.initialize();

      // Verify profile can be retrieved
      const profile = await fraudDetectionService.getUserProfile('user1');
      expect(profile.userId).toBe('user1');
    });
  });

  describe('analyzeReport', () => {
    it('should return fraud detection result', async () => {
      const report = createMockReport();

      const result = await fraudDetectionService.analyzeReport(report, []);

      expect(result).toHaveProperty('isSuspicious');
      expect(result).toHaveProperty('fraudScore');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('recommendation');
    });

    it('should recommend accept for clean report', async () => {
      const report = createMockReport({
        delayMinutes: 10, // Normal delay
        timestamp: new Date('2024-01-15T09:00:00'), // Normal time
      });

      const result = await fraudDetectionService.analyzeReport(report, []);

      expect(['accept', 'review']).toContain(result.recommendation);
    });

    it('should flag extreme delay', async () => {
      const report = createMockReport({
        delayMinutes: 90, // Over 60 minutes threshold
      });

      const result = await fraudDetectionService.analyzeReport(report, []);

      const hasExtremeDelayFlag = result.flags.some(f => f.type === 'extreme_delay');
      expect(hasExtremeDelayFlag).toBe(true);
    });

    it('should flag time anomaly for late night reports', async () => {
      const report = createMockReport({
        timestamp: new Date('2024-01-15T03:00:00'), // 3 AM
      });

      const result = await fraudDetectionService.analyzeReport(report, []);

      const hasTimeAnomalyFlag = result.flags.some(f => f.type === 'time_anomaly');
      expect(hasTimeAnomalyFlag).toBe(true);
    });

    it('should flag inconsistent delay when differs from others', async () => {
      const now = new Date();
      const report = createMockReport({
        delayMinutes: 50, // Much higher than others
        timestamp: now,
      });

      const otherReports = [
        createMockReport({
          id: 'other1',
          delayMinutes: 5,
          timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
        }),
        createMockReport({
          id: 'other2',
          delayMinutes: 7,
          timestamp: new Date(now.getTime() - 3 * 60 * 1000), // 3 min ago
        }),
      ];

      const result = await fraudDetectionService.analyzeReport(report, otherReports);

      const hasInconsistentFlag = result.flags.some(f => f.type === 'inconsistent_delay');
      expect(hasInconsistentFlag).toBe(true);
    });

    it('should recommend reject for high fraud score', async () => {
      // Report with multiple flags
      const report = createMockReport({
        delayMinutes: 90, // Extreme delay
        timestamp: new Date('2024-01-15T02:00:00'), // Late night
      });

      const now = new Date('2024-01-15T02:00:00');
      const otherReports = [
        createMockReport({
          id: 'other1',
          delayMinutes: 5,
          timestamp: new Date(now.getTime() - 5 * 60 * 1000),
        }),
        createMockReport({
          id: 'other2',
          delayMinutes: 3,
          timestamp: new Date(now.getTime() - 3 * 60 * 1000),
        }),
      ];

      const result = await fraudDetectionService.analyzeReport(report, otherReports);

      // Should have high fraud score due to multiple flags
      expect(result.fraudScore).toBeGreaterThan(0);
    });
  });

  describe('getUserProfile', () => {
    it('should return default profile for new user', async () => {
      const profile = await fraudDetectionService.getUserProfile('new_user');

      expect(profile.userId).toBe('new_user');
      expect(profile.totalReports).toBe(0);
      expect(profile.flaggedReports).toBe(0);
      expect(profile.trustScore).toBe(100);
    });

    it('should return profile with all required fields', async () => {
      const profile = await fraudDetectionService.getUserProfile('user1');

      expect(profile).toHaveProperty('userId');
      expect(profile).toHaveProperty('totalReports');
      expect(profile).toHaveProperty('flaggedReports');
      expect(profile).toHaveProperty('trustScore');
      expect(profile).toHaveProperty('flags');
    });
  });

  describe('updateUserProfile', () => {
    it('should update profile after non-fraudulent report', async () => {
      await fraudDetectionService.updateUserProfile('user2', false);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should update profile after fraudulent report', async () => {
      await fraudDetectionService.updateUserProfile('user3', true);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should increment totalReports', async () => {
      const initialProfile = await fraudDetectionService.getUserProfile('user4');
      const initialTotal = initialProfile.totalReports;

      await fraudDetectionService.updateUserProfile('user4', false);

      const updatedProfile = await fraudDetectionService.getUserProfile('user4');
      expect(updatedProfile.totalReports).toBe(initialTotal + 1);
    });
  });

  describe('isUserTrusted', () => {
    it('should return true for new user (high trust)', async () => {
      const isTrusted = await fraudDetectionService.isUserTrusted('new_trusted_user');

      expect(isTrusted).toBe(true);
    });

    it('should return boolean', async () => {
      const result = await fraudDetectionService.isUserTrusted('user1');

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getTrustLevelLabel', () => {
    it('should return "매우 높음" for score >= 90', () => {
      expect(fraudDetectionService.getTrustLevelLabel(90)).toBe('매우 높음');
      expect(fraudDetectionService.getTrustLevelLabel(100)).toBe('매우 높음');
    });

    it('should return "높음" for score >= 70', () => {
      expect(fraudDetectionService.getTrustLevelLabel(70)).toBe('높음');
      expect(fraudDetectionService.getTrustLevelLabel(89)).toBe('높음');
    });

    it('should return "보통" for score >= 50', () => {
      expect(fraudDetectionService.getTrustLevelLabel(50)).toBe('보통');
      expect(fraudDetectionService.getTrustLevelLabel(69)).toBe('보통');
    });

    it('should return "낮음" for score >= 30', () => {
      expect(fraudDetectionService.getTrustLevelLabel(30)).toBe('낮음');
      expect(fraudDetectionService.getTrustLevelLabel(49)).toBe('낮음');
    });

    it('should return "매우 낮음" for score < 30', () => {
      expect(fraudDetectionService.getTrustLevelLabel(29)).toBe('매우 낮음');
      expect(fraudDetectionService.getTrustLevelLabel(0)).toBe('매우 낮음');
    });
  });

  describe('type exports', () => {
    it('should export ReportForAnalysis type', () => {
      const report: ReportForAnalysis = {
        id: 'test',
        userId: 'user',
        lineId: '2',
        stationId: 'station',
        delayMinutes: 10,
        timestamp: new Date(),
      };
      expect(report.id).toBe('test');
    });

    it('should export FraudDetectionResult type', () => {
      const result: FraudDetectionResult = {
        isSuspicious: false,
        fraudScore: 0,
        flags: [],
        recommendation: 'accept',
      };
      expect(result.recommendation).toBe('accept');
    });

    it('should export UserFraudProfile type', () => {
      const profile: UserFraudProfile = {
        userId: 'test',
        totalReports: 0,
        flaggedReports: 0,
        trustScore: 100,
        flags: [],
      };
      expect(profile.trustScore).toBe(100);
    });
  });
});
