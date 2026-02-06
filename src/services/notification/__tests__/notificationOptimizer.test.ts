/**
 * Notification Optimizer Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationOptimizer } from '../notificationOptimizer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/models/pattern', () => ({
  DayOfWeek: { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 },
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }),
  formatMinutesToTime: jest.fn((mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }),
}));

describe('NotificationOptimizerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(notificationOptimizer.initialize()).resolves.not.toThrow();
    });

    it('should load data from storage', async () => {
      await notificationOptimizer.initialize();
      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('getOptimalNotificationTime', () => {
    it('should return timing suggestion', async () => {
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'user-1', '08:00', 1
      );
      expect(result).toBeDefined();
      expect(result.suggestedTime).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown user', async () => {
      const result = await notificationOptimizer.getOptimalNotificationTime(
        'unknown-user', '18:30', 5
      );
      expect(result).toBeDefined();
    });
  });

  describe('recordInteraction', () => {
    it('should record notification interaction', async () => {
      await expect(
        notificationOptimizer.recordInteraction({
          notificationId: 'notif-1',
          userId: 'user-1',
          sentAt: new Date(),
          interactedAt: new Date(),
          interactionType: 'opened',
          scheduledDeparture: '08:30',
        })
      ).resolves.not.toThrow();
    });

    it('should handle dismissed interaction', async () => {
      await expect(
        notificationOptimizer.recordInteraction({
          notificationId: 'notif-2',
          userId: 'user-1',
          sentAt: new Date(),
          interactionType: 'dismissed',
          scheduledDeparture: '18:00',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations', async () => {
      const result = await notificationOptimizer.getRecommendations('user-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('calculateEngagementScore', () => {
    it('should return engagement score', () => {
      const score = notificationOptimizer.calculateEngagementScore('user-1');
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPreferences', () => {
    it('should return null for unknown user', () => {
      const prefs = notificationOptimizer.getPreferences('unknown');
      expect(prefs).toBeNull();
    });
  });

  describe('resetPreferences', () => {
    it('should reset without error', async () => {
      await expect(notificationOptimizer.resetPreferences('user-1')).resolves.not.toThrow();
    });
  });
});
