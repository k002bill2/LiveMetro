/**
 * User Trust Service Tests
 */

import { userTrustService, TRUST_THRESHOLDS } from '../userTrustService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('UserTrustService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getProfile', () => {
    it('should create new profile for unknown user', async () => {
      const profile = await userTrustService.getProfile('user123');

      expect(profile.userId).toBe('user123');
      expect(profile.trustScore).toBe(10);
      expect(profile.trustLevel).toBe('new');
      expect(profile.totalReports).toBe(0);
      expect(profile.verifiedReports).toBe(0);
      expect(profile.rejectedReports).toBe(0);
      expect(profile.badges).toEqual([]);
    });

    it('should return existing profile', async () => {
      // First call creates profile
      await userTrustService.getProfile('user456');

      // Second call should return same profile
      const profile = await userTrustService.getProfile('user456');
      expect(profile.userId).toBe('user456');
    });
  });

  describe('processVerification', () => {
    it('should increase score for verified report', async () => {
      // Get initial profile
      await userTrustService.getProfile('verifyUser1');

      const change = await userTrustService.processVerification({
        reportId: 'report1',
        userId: 'verifyUser1',
        verified: true,
        verifiedBy: 'system',
        confidence: 0.9,
        reason: 'Matches official data',
        timestamp: new Date(),
      });

      expect(change.change).toBeGreaterThan(0);
      expect(change.newScore).toBeGreaterThan(change.previousScore);
    });

    it('should decrease score for rejected report', async () => {
      await userTrustService.getProfile('verifyUser2');

      const change = await userTrustService.processVerification({
        reportId: 'report2',
        userId: 'verifyUser2',
        verified: false,
        verifiedBy: 'admin',
        confidence: 0.8,
        reason: 'Inconsistent data',
        timestamp: new Date(),
      });

      expect(change.change).toBeLessThan(0);
      expect(change.newScore).toBeLessThan(change.previousScore);
    });
  });

  describe('recordReportSubmission', () => {
    it('should increment pending reports', async () => {
      const initialProfile = await userTrustService.getProfile('submitUser');
      const initialPending = initialProfile.pendingReports;

      await userTrustService.recordReportSubmission('submitUser');

      const updatedProfile = await userTrustService.getProfile('submitUser');
      expect(updatedProfile.pendingReports).toBe(initialPending + 1);
    });

    it('should award first report badge', async () => {
      const userId = 'firstReportUser';
      await userTrustService.getProfile(userId);
      await userTrustService.recordReportSubmission(userId);

      const profile = await userTrustService.getProfile(userId);
      expect(profile.badges.some(b => b.id === 'first_report')).toBe(true);
    });
  });

  describe('applyPenalty', () => {
    it('should apply spam penalty', async () => {
      await userTrustService.getProfile('spamUser');

      const change = await userTrustService.applyPenalty(
        'spamUser',
        'spam',
        'Excessive reporting'
      );

      expect(change.change).toBeLessThan(0);
      expect(change.reason).toContain('스팸');
    });

    it('should apply fraud penalty and potentially suspend', async () => {
      await userTrustService.getProfile('fraudUser');

      const change = await userTrustService.applyPenalty(
        'fraudUser',
        'fraud',
        'False report'
      );

      expect(change.change).toBeLessThan(0);
      expect(change.reason).toContain('허위 제보');
    });
  });

  describe('canSubmitReport', () => {
    it('should allow new user to submit', async () => {
      const result = await userTrustService.canSubmitReport('newAllowedUser');
      expect(result.allowed).toBe(true);
    });

    it('should block suspended user', async () => {
      const userId = 'suspendedUser';
      await userTrustService.getProfile(userId);

      // Apply severe penalties to suspend
      for (let i = 0; i < 5; i++) {
        await userTrustService.applyPenalty(userId, 'fraud', 'Multiple violations');
      }

      const result = await userTrustService.canSubmitReport(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('일시 정지');
    });
  });

  describe('getTrustLevelLabel', () => {
    it('should return correct labels', () => {
      expect(userTrustService.getTrustLevelLabel('new')).toBe('신규 사용자');
      expect(userTrustService.getTrustLevelLabel('basic')).toBe('일반 사용자');
      expect(userTrustService.getTrustLevelLabel('trusted')).toBe('신뢰할 수 있는 사용자');
      expect(userTrustService.getTrustLevelLabel('verified')).toBe('검증된 사용자');
      expect(userTrustService.getTrustLevelLabel('expert')).toBe('전문가');
      expect(userTrustService.getTrustLevelLabel('suspended')).toBe('이용 정지');
    });
  });

  describe('getTrustLevelColor', () => {
    it('should return correct colors', () => {
      expect(userTrustService.getTrustLevelColor('new')).toBe('#9E9E9E');
      expect(userTrustService.getTrustLevelColor('suspended')).toBe('#F44336');
      expect(userTrustService.getTrustLevelColor('expert')).toBe('#9C27B0');
    });
  });

  describe('getScoreHistory', () => {
    it('should return empty array for new user', async () => {
      const history = await userTrustService.getScoreHistory('historyUser');
      expect(history).toEqual([]);
    });

    it('should return history after verification', async () => {
      const userId = 'historyUser2';
      await userTrustService.getProfile(userId);
      await userTrustService.processVerification({
        reportId: 'histReport',
        userId,
        verified: true,
        verifiedBy: 'system',
        confidence: 0.9,
        reason: 'Test',
        timestamp: new Date(),
      });

      const history = await userTrustService.getScoreHistory(userId);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('getLeaderboard', () => {
    it('should return sorted profiles by score', async () => {
      const leaderboard = await userTrustService.getLeaderboard(5);
      expect(Array.isArray(leaderboard)).toBe(true);

      // Verify sorted by score descending
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1]!.trustScore).toBeGreaterThanOrEqual(
          leaderboard[i]!.trustScore
        );
      }
    });
  });

  describe('TRUST_THRESHOLDS', () => {
    it('should have correct threshold ranges', () => {
      expect(TRUST_THRESHOLDS.new).toEqual({ min: 0, max: 20 });
      expect(TRUST_THRESHOLDS.basic).toEqual({ min: 20, max: 40 });
      expect(TRUST_THRESHOLDS.trusted).toEqual({ min: 40, max: 60 });
      expect(TRUST_THRESHOLDS.verified).toEqual({ min: 60, max: 80 });
      expect(TRUST_THRESHOLDS.expert).toEqual({ min: 80, max: 100 });
      expect(TRUST_THRESHOLDS.suspended).toEqual({ min: -100, max: 0 });
    });
  });
});
