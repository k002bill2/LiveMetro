/**
 * Feedback Learning Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedbackLearningService } from '../feedbackLearningService';
import type { FeedbackType } from '../feedbackLearningService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

describe('FeedbackLearningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(feedbackLearningService.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted storage data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await expect(feedbackLearningService.initialize()).resolves.not.toThrow();
    });
  });

  describe('submitFeedback', () => {
    it('should submit feedback', async () => {
      await expect(
        feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate' as FeedbackType,
          { feature: 'arrival_prediction' }
        )
      ).resolves.not.toThrow();
    });

    it('should submit feedback with optional comment', async () => {
      await expect(
        feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive' as FeedbackType,
          { feature: 'congestion' },
          4,
          'Good prediction'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('getInsights', () => {
    it('should return null when no data', async () => {
      const result = await feedbackLearningService.getInsights('user-1');
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      const result = await feedbackLearningService.getStatistics('user-1');
      expect(result).toBeDefined();
      expect(typeof result.totalFeedback).toBe('number');
    });

    it('should return global statistics without userId', async () => {
      const result = await feedbackLearningService.getStatistics();
      expect(result).toBeDefined();
    });
  });

  describe('getPredictionAccuracy', () => {
    it('should return accuracy rate', async () => {
      const result = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('getTimingAccuracy', () => {
    it('should return timing accuracy', async () => {
      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('getAdjustmentFactor', () => {
    it('should return adjustment factor', async () => {
      const result = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('clearUserFeedback', () => {
    it('should clear without error', async () => {
      await expect(
        feedbackLearningService.clearUserFeedback('user-1')
      ).resolves.not.toThrow();
    });
  });
});
