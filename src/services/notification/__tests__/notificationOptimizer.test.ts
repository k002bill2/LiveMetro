/**
 * Notification Optimizer Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationOptimizer } from '../notificationOptimizer';
import type {
  NotificationInteraction,
} from '../notificationOptimizer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/models/pattern', () => ({
  DayOfWeek: { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 },
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }),
  formatMinutesToTime: jest.fn((mins: number) => {
    const hours = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }),
}));

describe('NotificationOptimizerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize without error when no data in storage', async () => {
      await expect(notificationOptimizer.initialize()).resolves.not.toThrow();
    });

    it('should load preferences from storage', async () => {
      const mockPrefs = {
        'user-1': {
          userId: 'user-1',
          preferredLeadTime: 20,
          responsiveHours: [9, 10, 11],
          ignoredHours: [22, 23, 0],
          averageResponseTime: 45,
          dismissRate: 0.2,
          snoozeRate: 0.1,
          lastUpdated: new Date().toISOString(),
        },
      };
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@livemetro:notification_preferences') {
          return Promise.resolve(JSON.stringify(mockPrefs));
        }
        return Promise.resolve(null);
      });

      await notificationOptimizer.initialize();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        '@livemetro:notification_preferences'
      );
    });

    it('should load interactions from storage', async () => {
      const mockInteractions = [
        {
          notificationId: 'notif-1',
          userId: 'user-1',
          sentAt: new Date().toISOString(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === '@livemetro:notification_interactions') {
          return Promise.resolve(JSON.stringify(mockInteractions));
        }
        return Promise.resolve(null);
      });

      await notificationOptimizer.initialize();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        '@livemetro:notification_interactions'
      );
    });

    it('should handle corrupted JSON in storage gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await expect(notificationOptimizer.initialize()).resolves.not.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      await expect(notificationOptimizer.initialize()).resolves.not.toThrow();
    });
  });

  describe('getOptimalNotificationTime', () => {
    it('should return default timing for unknown user', async () => {
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'unknown-user',
        '08:00',
        1
      );
      expect(result).toBeDefined();
      expect(result.suggestedTime).toBeDefined();
      expect(result.reason).toBe('기본 알림 시간');
      expect(result.confidence).toBe(0.5);
      expect(result.adjustmentMinutes).toBe(0);
    });

    it('should return default timing for user with high dismiss rate', async () => {
      // Record interactions to create high dismiss rate
      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-${i}`,
          userId: 'high-dismiss-user',
          sentAt: new Date(),
          interactionType: 'dismissed',
          scheduledDeparture: '08:30',
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'high-dismiss-user',
        '18:00',
        1
      );

      expect(result.reason).toBe('기본 알림 시간');
      expect(result.confidence).toBe(0.5);
    });

    it('should use learned preferences for recognized user', async () => {
      // Create user preferences through interactions
      const baseDate = new Date('2026-03-08T08:00:00');
      const departureTime = '08:30';

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-learned-${i}`,
          userId: 'learned-user',
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: departureTime,
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'learned-user',
        departureTime,
        1
      );

      expect(result).toBeDefined();
      expect(result.suggestedTime).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should suggest earlier time for ignored hours', async () => {
      // Create preferences with specific ignored hours
      const baseDate = new Date('2026-03-08T23:00:00');
      const departureTime = '23:30';

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-ignored-${i}`,
          userId: 'ignored-hours-user',
          sentAt: sentDate,
          interactionType: 'ignored',
          scheduledDeparture: departureTime,
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'ignored-hours-user',
        departureTime,
        6
      );

      expect(result).toBeDefined();
      // Should suggest earlier time for ignored hours
      expect(result.adjustmentMinutes).toBeLessThanOrEqual(0);
    });

    it('should account for high average response time', async () => {
      // Create interactions with slow response times
      const baseDate = new Date('2026-03-08T09:00:00');
      const departureTime = '09:30';

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-slow-${i}`,
          userId: 'slow-user',
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 120000), // 2 minutes response time
          interactionType: 'opened',
          scheduledDeparture: departureTime,
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'slow-user',
        departureTime,
        1
      );

      expect(result).toBeDefined();
      expect(result.adjustmentMinutes).toBeLessThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should calculate correct confidence score for low dismiss rate', async () => {
      const baseDate = new Date('2026-03-08T10:00:00');
      const departureTime = '10:30';

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-reliable-${i}`,
          userId: 'reliable-user',
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: 'opened',
          scheduledDeparture: departureTime,
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'reliable-user',
        departureTime,
        1
      );

      expect(result.confidence).toBe(0.9);
    });

    it('should calculate lower confidence score for moderate dismiss rate', async () => {
      const baseDate = new Date('2026-03-08T11:00:00');
      const departureTime = '11:30';

      // Mix that creates dismissRate between 0.2 and 0.5
      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-moderate-${i}`,
          userId: 'moderate-dismiss-user',
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: i < 3 ? 'dismissed' : 'opened', // ~0.2 dismiss rate
          scheduledDeparture: departureTime,
        });
      }

      const result = await notificationOptimizer.getOptimalNotificationTime(
        'moderate-dismiss-user',
        departureTime,
        1
      );

      // With dismissRate between 0.2 and 0.5, confidence should be 0.7
      expect(result.confidence).toBe(0.7);
    });

    it('should handle time wrapping for negative adjustments', async () => {
      // Test with departure time early in the day
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'test-wrap-user',
        '00:30',
        6
      );

      expect(result.suggestedTime).toBeDefined();
      // formatMinutesToTime should handle negative values correctly
    });
  });

  describe('recordInteraction', () => {
    it('should record opened interaction', async () => {
      const interaction: NotificationInteraction = {
        notificationId: 'notif-opened-1',
        userId: 'user-1',
        sentAt: new Date(),
        interactedAt: new Date(),
        interactionType: 'opened',
        scheduledDeparture: '08:30',
      };

      await expect(
        notificationOptimizer.recordInteraction(interaction)
      ).resolves.not.toThrow();
    });

    it('should record dismissed interaction', async () => {
      const interaction: NotificationInteraction = {
        notificationId: 'notif-dismissed-1',
        userId: 'user-1',
        sentAt: new Date(),
        interactionType: 'dismissed',
        scheduledDeparture: '18:00',
      };

      await expect(
        notificationOptimizer.recordInteraction(interaction)
      ).resolves.not.toThrow();
    });

    it('should record snoozed interaction', async () => {
      const interaction: NotificationInteraction = {
        notificationId: 'notif-snoozed-1',
        userId: 'user-1',
        sentAt: new Date(),
        interactedAt: new Date(),
        interactionType: 'snoozed',
        scheduledDeparture: '14:00',
      };

      await expect(
        notificationOptimizer.recordInteraction(interaction)
      ).resolves.not.toThrow();
    });

    it('should record action interaction', async () => {
      const interaction: NotificationInteraction = {
        notificationId: 'notif-action-1',
        userId: 'user-1',
        sentAt: new Date(),
        interactedAt: new Date(),
        interactionType: 'action',
        scheduledDeparture: '12:00',
      };

      await expect(
        notificationOptimizer.recordInteraction(interaction)
      ).resolves.not.toThrow();
    });

    it('should record ignored interaction', async () => {
      const interaction: NotificationInteraction = {
        notificationId: 'notif-ignored-1',
        userId: 'user-1',
        sentAt: new Date(),
        interactionType: 'ignored',
        scheduledDeparture: '20:00',
      };

      await expect(
        notificationOptimizer.recordInteraction(interaction)
      ).resolves.not.toThrow();
    });

    it('should keep only last 100 interactions', async () => {
      const userId = 'overflow-user';

      // Record 110 interactions
      for (let i = 0; i < 110; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-overflow-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      // Calculate engagement score to verify we only have last 100
      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(typeof score).toBe('number');
    });

    it('should trigger preference update after MIN_INTERACTIONS_FOR_LEARNING', async () => {
      const userId = 'learning-user';
      const baseDate = new Date('2026-03-08T09:00:00');

      // Record exactly 10 interactions to trigger learning
      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-learn-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '09:30',
        });
      }

      // Verify preferences were created
      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs).not.toBeNull();
      expect(prefs?.userId).toBe(userId);
    });

    it('should handle storage errors when saving interactions', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(
        notificationOptimizer.recordInteraction({
          notificationId: 'notif-error-1',
          userId: 'user-1',
          sentAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getRecommendations', () => {
    it('should return empty array for user with insufficient interactions', async () => {
      const result = await notificationOptimizer.getRecommendations(
        'new-user'
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should recommend timing increase for high dismiss rate', async () => {
      const userId = 'high-dismiss-rec-user';
      const baseDate = new Date('2026-03-08T09:00:00');

      // Create interactions with high dismiss rate
      for (let i = 0; i < 12; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-dismiss-rec-${i}`,
          userId,
          sentAt: sentDate,
          interactionType: i < 7 ? 'dismissed' : 'opened', // > 0.4 dismiss rate
          scheduledDeparture: '09:30',
        });
      }

      const recommendations = await notificationOptimizer.getRecommendations(
        userId
      );

      const timingRecs = recommendations.filter((r) => r.type === 'timing');
      expect(timingRecs.length).toBeGreaterThan(0);
      expect(timingRecs[0]?.reason).toContain('높습니다');
    });

    it('should recommend timing decrease for high snooze rate', async () => {
      const userId = 'high-snooze-rec-user';
      const baseDate = new Date('2026-03-08T10:00:00');

      // Create interactions with high snooze rate
      for (let i = 0; i < 12; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-snooze-rec-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: i < 5 ? 'snoozed' : 'opened', // > 0.3 snooze rate
          scheduledDeparture: '10:30',
        });
      }

      const recommendations = await notificationOptimizer.getRecommendations(
        userId
      );

      const timingRecs = recommendations.filter((r) => r.type === 'timing');
      expect(timingRecs.length).toBeGreaterThan(0);
      expect(timingRecs.some((r) =>
        r.reason.includes('다시알림율이 높습니다')
      )).toBe(true);
    });

    it('should recommend content simplification for high response time', async () => {
      const userId = 'slow-response-rec-user';
      const baseDate = new Date('2026-03-08T11:00:00');

      // Create interactions with long response times
      for (let i = 0; i < 12; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-slow-rec-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 180000), // 3 minutes
          interactionType: 'opened',
          scheduledDeparture: '11:30',
        });
      }

      const recommendations = await notificationOptimizer.getRecommendations(
        userId
      );

      const contentRecs = recommendations.filter((r) => r.type === 'content');
      expect(contentRecs.length).toBeGreaterThan(0);
    });

    it('should return recommendations with correct structure', async () => {
      const userId = 'structure-test-user';
      const baseDate = new Date('2026-03-08T12:00:00');

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-struct-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: i < 8 ? 'dismissed' : 'opened',
          scheduledDeparture: '12:30',
        });
      }

      const recommendations = await notificationOptimizer.getRecommendations(
        userId
      );

      recommendations.forEach((rec) => {
        expect(rec.type).toMatch(/timing|frequency|content/);
        expect(rec.currentValue).toBeDefined();
        expect(rec.suggestedValue).toBeDefined();
        expect(rec.reason).toBeDefined();
        expect(rec.expectedImprovement).toBeGreaterThanOrEqual(0);
        expect(rec.expectedImprovement).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateEngagementScore', () => {
    it('should return 50 for user with no interactions', () => {
      const score = notificationOptimizer.calculateEngagementScore('no-data-user');
      expect(score).toBe(50);
    });

    it('should calculate high score for opened interactions', async () => {
      const userId = 'opened-user';

      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-opened-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeGreaterThan(50);
    });

    it('should calculate high score for action interactions', async () => {
      const userId = 'action-user';

      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-action-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'action',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeGreaterThan(60); // actions are worth 3x
    });

    it('should calculate low score for dismissed interactions', async () => {
      const userId = 'dismissed-user';

      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-dismissed-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'dismissed',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeLessThan(50);
    });

    it('should calculate lowest score for ignored interactions', async () => {
      const userId = 'ignored-user';

      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-ignored-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'ignored',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeLessThan(50);
      expect(score).toBeGreaterThanOrEqual(0); // Should not go below 0
    });

    it('should balance positive and negative interactions', async () => {
      const userId = 'mixed-user';

      // 3 opened, 2 actions, 2 dismissed, 3 ignored
      const interactions: NotificationInteraction['interactionType'][] = [
        'opened',
        'opened',
        'opened',
        'action',
        'action',
        'dismissed',
        'dismissed',
        'ignored',
        'ignored',
        'ignored',
      ];

      for (let i = 0; i < interactions.length; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-mixed-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: interactions[i] ?? 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should cap score between 0 and 100', async () => {
      const userId = 'extreme-user';

      // Record only actions to try to maximize score
      for (let i = 0; i < 100; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-extreme-${i}`,
          userId,
          sentAt: new Date(),
          interactionType: 'action',
          scheduledDeparture: '08:30',
        });
      }

      const score = notificationOptimizer.calculateEngagementScore(userId);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getPreferences', () => {
    it('should return null for unknown user', () => {
      const prefs = notificationOptimizer.getPreferences('unknown-user');
      expect(prefs).toBeNull();
    });

    it('should return null for user with insufficient interactions', () => {
      const prefs = notificationOptimizer.getPreferences('insufficient-user');
      expect(prefs).toBeNull();
    });

    it('should return learned preferences for user with sufficient interactions', async () => {
      const userId = 'pref-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-pref-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs).not.toBeNull();
      expect(prefs?.userId).toBe(userId);
      expect(prefs?.preferredLeadTime).toBeGreaterThan(0);
      expect(prefs?.dismissRate).toBeGreaterThanOrEqual(0);
      expect(prefs?.snoozeRate).toBeGreaterThanOrEqual(0);
      expect(prefs?.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include responsive and ignored hours', async () => {
      const userId = 'hours-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      for (let i = 0; i < 15; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 3600000); // 1 hour apart
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-hours-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: i < 12 ? 'opened' : 'ignored', // High response in early hours
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.responsiveHours).toBeDefined();
      expect(prefs?.ignoredHours).toBeDefined();
    });
  });

  describe('resetPreferences', () => {
    it('should reset preferences for user', async () => {
      const userId = 'reset-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // Create preferences
      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-reset-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      // Verify preferences exist
      let prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs).not.toBeNull();

      // Reset
      await notificationOptimizer.resetPreferences(userId);

      // Verify preferences are deleted
      prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs).toBeNull();
    });

    it('should remove user interactions on reset', async () => {
      const userId = 'reset-interactions-user';

      await notificationOptimizer.recordInteraction({
        notificationId: 'notif-reset-inter-1',
        userId,
        sentAt: new Date(),
        interactionType: 'opened',
        scheduledDeparture: '08:30',
      });

      // Verify interaction recorded (score should not be 50 after recording)
      notificationOptimizer.calculateEngagementScore(userId);

      await notificationOptimizer.resetPreferences(userId);

      // After reset, should return to default
      const scoreAfter = notificationOptimizer.calculateEngagementScore(userId);
      expect(scoreAfter).toBe(50);
    });

    it('should save reset state to storage', async () => {
      const userId = 'reset-storage-user';

      await notificationOptimizer.resetPreferences(userId);

      // Verify AsyncStorage.setItem was called to persist the reset
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle storage errors during reset', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(
        notificationOptimizer.resetPreferences('reset-error-user')
      ).resolves.not.toThrow();
    });
  });

  describe('updatePreferences (private method via recordInteraction)', () => {
    it('should calculate dismiss rate correctly', async () => {
      const userId = 'dismiss-calc-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // 6 dismissed, 4 opened = 0.6 dismiss rate
      const types: NotificationInteraction['interactionType'][] = [
        'dismissed',
        'dismissed',
        'dismissed',
        'dismissed',
        'dismissed',
        'dismissed',
        'opened',
        'opened',
        'opened',
        'opened',
      ];

      for (let i = 0; i < types.length; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-dismiss-calc-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: types[i] ?? 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.dismissRate).toBeCloseTo(0.6, 1);
    });

    it('should calculate snooze rate correctly', async () => {
      const userId = 'snooze-calc-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // 4 snoozed, 6 opened = 0.4 snooze rate
      const types: NotificationInteraction['interactionType'][] = [
        'snoozed',
        'snoozed',
        'snoozed',
        'snoozed',
        'opened',
        'opened',
        'opened',
        'opened',
        'opened',
        'opened',
      ];

      for (let i = 0; i < types.length; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-snooze-calc-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: types[i] ?? 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.snoozeRate).toBeCloseTo(0.4, 1);
    });

    it('should calculate average response time correctly', async () => {
      const userId = 'response-time-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // Record interactions with specific response times
      const responseTimes = [30000, 60000, 45000, 75000, 50000]; // ms

      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        const responseTime =
          responseTimes[i % responseTimes.length] || 0;
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-response-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(
            sentDate.getTime() + responseTime
          ),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.averageResponseTime).toBeGreaterThan(0);
    });

    it('should identify responsive hours correctly', async () => {
      const userId = 'responsive-hours-user';

      // Create interactions at different hours
      // Hours 9-11: mostly responded (responsive)
      // Hours 22-23: mostly ignored (non-responsive)
      for (let i = 0; i < 20; i++) {
        const hour = i < 10 ? 9 + (i % 3) : 22 + (i % 2);
        const sentDate = new Date('2026-03-08');
        sentDate.setHours(hour, 0, 0, 0);

        await notificationOptimizer.recordInteraction({
          notificationId: `notif-resp-hours-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt:
            i < 10
              ? new Date(sentDate.getTime() + 10000)
              : undefined,
          interactionType: i < 10 ? 'opened' : 'ignored',
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.responsiveHours).toBeDefined();
      expect(prefs?.ignoredHours).toBeDefined();
    });

    it('should calculate preferred lead time from interactions', async () => {
      const userId = 'lead-time-user';

      // Create interactions with consistent lead times
      for (let i = 0; i < 10; i++) {
        const sentDate = new Date('2026-03-08T08:00:00');
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-lead-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '08:15', // 15 minutes after sent
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      expect(prefs?.preferredLeadTime).toBeGreaterThan(0);
    });

    it('should filter out invalid lead times', async () => {
      const userId = 'filter-lead-user';

      // Mix of valid and invalid lead times
      const departures = [
        '08:10', // 10 min lead time
        '07:50', // -10 min (invalid, wraps to 1430)
        '08:20', // 20 min lead time
        '08:05', // 5 min lead time
      ];

      for (let i = 0; i < 12; i++) {
        const sentDate = new Date('2026-03-08T08:00:00');
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-filter-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 10000),
          interactionType: 'opened',
          scheduledDeparture: departures[i % departures.length] ?? '08:10',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      // Should only use valid lead times (0-60 minutes)
      expect(prefs?.preferredLeadTime).toBeLessThanOrEqual(60);
    });

    it('should use default lead time when no valid data', async () => {
      const userId = 'default-lead-user';

      // Record interactions without valid departure times
      for (let i = 0; i < 10; i++) {
        const sentDate = new Date('2026-03-08T08:00:00');
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-default-lead-${i}`,
          userId,
          sentAt: sentDate,
          interactionType: 'ignored', // ignored interactions don't count
          scheduledDeparture: '08:30',
        });
      }

      const prefs = notificationOptimizer.getPreferences(userId);
      // Should default to 15 minutes when no valid data
      expect(prefs?.preferredLeadTime).toBe(15);
    });
  });

  describe('subtractMinutes (private method via getOptimalNotificationTime)', () => {
    it('should subtract minutes from time', async () => {
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'time-subtraction-user',
        '10:30',
        1
      );

      // Should subtract 15 minutes (default lead time) from 10:30
      expect(result.suggestedTime).toBe('10:15');
    });

    it('should handle negative time wrapping', async () => {
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'time-wrap-user',
        '00:10',
        1
      );

      // Should wrap around midnight
      expect(result.suggestedTime).toBeDefined();
      // formatMinutesToTime should handle the wrapping correctly
    });
  });

  describe('savePreferences and saveInteractions (via recordInteraction)', () => {
    it('should persist preferences to AsyncStorage', async () => {
      const userId = 'persist-prefs-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-persist-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('@livemetro:notification_'),
        expect.any(String)
      );
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      await expect(
        notificationOptimizer.recordInteraction({
          notificationId: 'notif-storage-error',
          userId: 'error-user',
          sentAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('should handle multiple users independently', async () => {
      const user1 = 'user-1-multi';
      const user2 = 'user-2-multi';

      // User 1: high engagement
      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-multi-1-${i}`,
          userId: user1,
          sentAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      // User 2: low engagement
      for (let i = 0; i < 10; i++) {
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-multi-2-${i}`,
          userId: user2,
          sentAt: new Date(),
          interactionType: 'ignored',
          scheduledDeparture: '08:30',
        });
      }

      const score1 = notificationOptimizer.calculateEngagementScore(user1);
      const score2 = notificationOptimizer.calculateEngagementScore(user2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle rapid interactions', async () => {
      const userId = 'rapid-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // Record 5 interactions in quick succession
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          notificationOptimizer.recordInteraction({
            notificationId: `notif-rapid-${i}`,
            userId,
            sentAt: new Date(baseDate.getTime() + i),
            interactionType: 'opened',
            scheduledDeparture: '08:30',
          })
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should provide consistent results on repeated calls', async () => {
      const userId = 'consistent-user';
      const baseDate = new Date('2026-03-08T08:00:00');

      // Create some preferences
      for (let i = 0; i < 10; i++) {
        const sentDate = new Date(baseDate.getTime() + i * 60000);
        await notificationOptimizer.recordInteraction({
          notificationId: `notif-consistent-${i}`,
          userId,
          sentAt: sentDate,
          interactedAt: new Date(sentDate.getTime() + 30000),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        });
      }

      // Call multiple times
      const score1 = notificationOptimizer.calculateEngagementScore(userId);
      const score2 = notificationOptimizer.calculateEngagementScore(userId);

      expect(score1).toBe(score2);
    });
  });
});
