/**
 * Feedback Learning Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedbackLearningService } from '../feedbackLearningService';
import type { FeedbackType, FeedbackEntry, FeedbackContext } from '../feedbackLearningService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

describe('FeedbackLearningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    // Reset service state by forcing re-initialization
    (feedbackLearningService as any).initialized = false;
    (feedbackLearningService as any).feedbackData = [];
  });

  // ============================================================================
  // Initialize Tests
  // ============================================================================

  describe('initialize', () => {
    it('should initialize service successfully', async () => {
      await feedbackLearningService.initialize();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@livemetro:feedback_data');
    });

    it('should skip initialization if already initialized', async () => {
      (feedbackLearningService as any).initialized = true;
      (AsyncStorage.getItem as jest.Mock).mockClear();

      await feedbackLearningService.initialize();

      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('should load feedback data from storage', async () => {
      const mockData: FeedbackEntry[] = [
        {
          id: 'feedback_1',
          userId: 'user-1',
          type: 'prediction_accurate',
          context: { feature: 'arrival' },
          timestamp: new Date(),
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      await feedbackLearningService.initialize();

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(1);
    });

    it('should handle corrupted JSON data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json{');

      await expect(feedbackLearningService.initialize()).resolves.not.toThrow();

      const stats = await feedbackLearningService.getStatistics();
      expect(stats.totalFeedback).toBe(0);
    });

    it('should handle null storage data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await feedbackLearningService.initialize();

      const stats = await feedbackLearningService.getStatistics();
      expect(stats.totalFeedback).toBe(0);
    });

    it('should convert timestamp strings to Date objects', async () => {
      const mockData = [
        {
          id: 'feedback_1',
          userId: 'user-1',
          type: 'prediction_accurate',
          context: { feature: 'arrival' },
          timestamp: '2024-01-01T12:00:00Z',
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      await feedbackLearningService.initialize();

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(1);
    });
  });

  // ============================================================================
  // submitFeedback Tests
  // ============================================================================

  describe('submitFeedback', () => {
    it('should submit positive feedback with all properties', async () => {
      const result = await feedbackLearningService.submitFeedback(
        'user-1',
        'prediction_accurate',
        { feature: 'arrival_prediction' },
        5,
        'Perfect!'
      );

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^feedback_/);
      expect(result.userId).toBe('user-1');
      expect(result.type).toBe('prediction_accurate');
      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Perfect!');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should submit feedback without optional rating and comment', async () => {
      const result = await feedbackLearningService.submitFeedback(
        'user-2',
        'route_helpful',
        { feature: 'route_planning' }
      );

      expect(result.userId).toBe('user-2');
      expect(result.type).toBe('route_helpful');
      expect(result.rating).toBeUndefined();
      expect(result.comment).toBeUndefined();
    });

    it('should generate unique IDs for each feedback entry', async () => {
      const result1 = await feedbackLearningService.submitFeedback(
        'user-1',
        'prediction_accurate',
        { feature: 'arrival' }
      );

      const result2 = await feedbackLearningService.submitFeedback(
        'user-1',
        'prediction_accurate',
        { feature: 'arrival' }
      );

      expect(result1.id).not.toBe(result2.id);
    });

    it('should persist feedback to storage', async () => {
      await feedbackLearningService.submitFeedback(
        'user-1',
        'general_positive',
        { feature: 'ui' },
        4
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro:feedback_data',
        expect.stringContaining('general_positive')
      );
    });

    it('should maintain MAX_FEEDBACK_ENTRIES limit (500)', async () => {
      // Submit 510 feedback entries
      for (let i = 0; i < 510; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: `feature_${i}` }
        );
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBeLessThanOrEqual(500);
      expect(stats.totalFeedback).toBe(500);
    });

    it('should submit different feedback types', async () => {
      const types: FeedbackType[] = [
        'prediction_accurate',
        'prediction_inaccurate',
        'timing_too_early',
        'timing_too_late',
        'timing_good',
        'route_helpful',
        'route_not_helpful',
        'delay_info_accurate',
        'delay_info_inaccurate',
        'general_positive',
        'general_negative',
      ];

      for (const type of types) {
        const result = await feedbackLearningService.submitFeedback(
          'user-1',
          type,
          { feature: 'test' }
        );
        expect(result.type).toBe(type);
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(types.length);
    });

    it('should handle context with metadata', async () => {
      const context: FeedbackContext = {
        feature: 'prediction',
        predictedValue: '3분',
        actualValue: '5분',
        metadata: { lineId: '2호선', stationId: 'station_123' },
      };

      const result = await feedbackLearningService.submitFeedback(
        'user-1',
        'prediction_inaccurate',
        context
      );

      expect(result.context.metadata).toEqual({
        lineId: '2호선',
        stationId: 'station_123',
      });
    });

    it('should handle AsyncStorage write errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await feedbackLearningService.submitFeedback(
        'user-1',
        'general_positive',
        { feature: 'ui' }
      );

      expect(result.userId).toBe('user-1');
      // Should still return entry even if storage fails
    });
  });

  // ============================================================================
  // getInsights Tests
  // ============================================================================

  describe('getInsights', () => {
    it('should return null when user has fewer than 5 feedback entries', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: `feature_${i}` }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights).toBeNull();
    });

    it('should return insights when user has at least 5 feedback entries', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'feature_a' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights).not.toBeNull();
      expect(insights?.userId).toBe('user-1');
      expect(insights?.overallSatisfaction).toBeDefined();
      expect(insights?.featureScores).toBeDefined();
      expect(insights?.commonIssues).toBeDefined();
      expect(insights?.suggestedImprovements).toBeDefined();
      expect(insights?.lastUpdated).toBeInstanceOf(Date);
    });

    it('should calculate 100% satisfaction with all positive feedback', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'feature_a' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.overallSatisfaction).toBe(100);
    });

    it('should calculate 0% satisfaction with all negative feedback', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_negative',
          { feature: 'feature_a' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.overallSatisfaction).toBe(0);
    });

    it('should calculate mixed satisfaction correctly', async () => {
      // 3 positive, 2 negative = 60%
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'prediction' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_inaccurate',
          { feature: 'prediction' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.overallSatisfaction).toBe(60);
    });

    it('should calculate feature scores correctly', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'prediction_inaccurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'route_helpful', { feature: 'routing' });
      await feedbackLearningService.submitFeedback('user-1', 'route_not_helpful', { feature: 'routing' });

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.featureScores['arrival']).toBe(67); // 2/3 positive
      expect(insights?.featureScores['routing']).toBe(50); // 1/2 positive
    });

    it('should identify common issues', async () => {
      // Add multiple timing issues to trigger identification
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'delay_info_inaccurate',
          { feature: 'delay' }
        );
      }
      await feedbackLearningService.submitFeedback(
        'user-1',
        'general_positive',
        { feature: 'ui' }
      );

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.commonIssues).toContain('알림이 너무 이름');
      expect(insights?.commonIssues).toContain('지연 정보가 정확하지 않음');
    });

    it('should generate improvement suggestions for low-scoring features', async () => {
      // Feature with low score
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_inaccurate',
          { feature: 'arrival_prediction' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.suggestedImprovements).toContain('arrival_prediction 기능 개선 필요');
    });

    it('should suggest timing adjustments when multiple timing issues exist', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.suggestedImprovements).toContain('알림 시간을 조금 늦춰보세요');
    });

    it('should include default suggestion when no improvements needed', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }

      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.suggestedImprovements).toContain(
        '현재 설정이 잘 맞는 것 같습니다'
      );
    });

    it('should not return insights for non-existent user', async () => {
      const insights = await feedbackLearningService.getInsights('non-existent-user');
      expect(insights).toBeNull();
    });
  });

  // ============================================================================
  // getStatistics Tests
  // ============================================================================

  describe('getStatistics', () => {
    it('should return empty statistics for no feedback', async () => {
      const stats = await feedbackLearningService.getStatistics();
      expect(stats.totalFeedback).toBe(0);
      expect(stats.positiveRate).toBe(0);
      expect(stats.negativeRate).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.recentTrend).toBe('stable');
    });

    it('should return statistics for specific user', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-2', 'general_negative', { feature: 'ui' });

      const userStats = await feedbackLearningService.getStatistics('user-1');
      expect(userStats.totalFeedback).toBe(1);
      expect(userStats.positiveRate).toBe(1);
      expect(userStats.negativeRate).toBe(0);
    });

    it('should return global statistics without userId', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-2', 'general_negative', { feature: 'ui' });

      const stats = await feedbackLearningService.getStatistics();
      expect(stats.totalFeedback).toBe(2);
      expect(stats.positiveRate).toBe(0.5);
      expect(stats.negativeRate).toBe(0.5);
    });

    it('should calculate positive rate correctly', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback('user-1', 'prediction_inaccurate', { feature: 'arrival' });
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.positiveRate).toBeCloseTo(0.6);
      expect(stats.negativeRate).toBeCloseTo(0.4);
    });

    it('should calculate negative rate correctly', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback('user-1', 'general_negative', { feature: 'ui' });
      }
      for (let i = 0; i < 1; i++) {
        await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.negativeRate).toBe(0.8);
      expect(stats.positiveRate).toBe(0.2);
    });

    it('should calculate average rating from rated feedback', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' }, 5);
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' }, 4);
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' }, 3);
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' }); // No rating

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.averageRating).toBeCloseTo((5 + 4 + 3) / 3); // Only 3 rated
    });

    it('should return 0 average rating when no ratings exist', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-1', 'general_negative', { feature: 'ui' });

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.averageRating).toBe(0);
    });

    it('should count feedback by type', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'prediction_inaccurate', { feature: 'arrival' });

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.feedbackByType['prediction_accurate']).toBe(2);
      expect(stats.feedbackByType['prediction_inaccurate']).toBe(1);
    });

    it('should handle all positive feedback types in rate calculation', async () => {
      const positiveTypes: FeedbackType[] = [
        'prediction_accurate',
        'timing_good',
        'route_helpful',
        'delay_info_accurate',
        'general_positive',
      ];

      for (const type of positiveTypes) {
        await feedbackLearningService.submitFeedback('user-1', type, { feature: 'test' });
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.positiveRate).toBe(1);
    });

    it('should handle all negative feedback types in rate calculation', async () => {
      const negativeTypes: FeedbackType[] = [
        'prediction_inaccurate',
        'timing_too_early',
        'timing_too_late',
        'route_not_helpful',
        'delay_info_inaccurate',
        'general_negative',
      ];

      for (const type of negativeTypes) {
        await feedbackLearningService.submitFeedback('user-1', type, { feature: 'test' });
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.negativeRate).toBe(1);
    });
  });

  // ============================================================================
  // getPredictionAccuracy Tests
  // ============================================================================

  describe('getPredictionAccuracy', () => {
    it('should return 0.5 default when no prediction feedback exists', async () => {
      const accuracy = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(accuracy).toBe(0.5);
    });

    it('should return 1.0 when all predictions are accurate', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival' }
        );
      }

      const accuracy = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(accuracy).toBe(1);
    });

    it('should return 0 when all predictions are inaccurate', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_inaccurate',
          { feature: 'arrival' }
        );
      }

      const accuracy = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(accuracy).toBe(0);
    });

    it('should calculate accuracy as ratio of accurate to total', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_inaccurate',
          { feature: 'arrival' }
        );
      }

      const accuracy = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(accuracy).toBeCloseTo(0.6);
    });

    it('should ignore non-prediction feedback types', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-1', 'timing_good', { feature: 'notifications' });

      const accuracy = await feedbackLearningService.getPredictionAccuracy('user-1');
      expect(accuracy).toBe(1); // Only considers prediction_accurate
    });
  });

  // ============================================================================
  // getTimingAccuracy Tests
  // ============================================================================

  describe('getTimingAccuracy', () => {
    it('should return default values when no timing feedback exists', async () => {
      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.accuracy).toBe(0.5);
      expect(result.tendEarly).toBe(false);
      expect(result.tendLate).toBe(false);
    });

    it('should return 1.0 accuracy when all timing is good', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.accuracy).toBe(1);
      expect(result.tendEarly).toBe(false);
      expect(result.tendLate).toBe(false);
    });

    it('should calculate accuracy as ratio of good timing', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.accuracy).toBeCloseTo(0.6);
    });

    it('should detect tend early when early > late AND early > good', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_late',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 1; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.tendEarly).toBe(true);
      expect(result.tendLate).toBe(false);
    });

    it('should detect tend late when late > early AND late > good', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_late',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 1; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.tendLate).toBe(true);
      expect(result.tendEarly).toBe(false);
    });

    it('should not detect early tendency when early = late', async () => {
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_late',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.tendEarly).toBe(false);
      expect(result.tendLate).toBe(false);
    });

    it('should not detect tendency when all good', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.tendEarly).toBe(false);
      expect(result.tendLate).toBe(false);
    });

    it('should ignore non-timing feedback types', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'timing_good', { feature: 'notifications' });
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-1', 'prediction_accurate', { feature: 'arrival' });

      const result = await feedbackLearningService.getTimingAccuracy('user-1');
      expect(result.accuracy).toBe(1);
    });
  });

  // ============================================================================
  // getAdjustmentFactor Tests
  // ============================================================================

  describe('getAdjustmentFactor', () => {
    it('should return no adjustment when timing is accurate', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factor.timeAdjustment).toBe(0);
    });

    it('should return positive adjustment when timing tends early', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 1; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factor.timeAdjustment).toBe(5);
    });

    it('should return negative adjustment when timing tends late', async () => {
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_late',
          { feature: 'notifications' }
        );
      }
      for (let i = 0; i < 1; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_good',
          { feature: 'notifications' }
        );
      }

      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factor.timeAdjustment).toBe(-5);
    });

    it('should calculate confidence multiplier from prediction accuracy', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival' }
        );
      }

      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factor.confidenceMultiplier).toBe(1); // 0.5 + 1.0 * 0.5
    });

    it('should calculate confidence multiplier as 0.5 with 0 prediction accuracy', async () => {
      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factor.confidenceMultiplier).toBeCloseTo(0.75); // 0.5 + 0.5 * 0.5
    });

    it('should calculate confidence multiplier between 0.5 and 1.0', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_inaccurate',
          { feature: 'arrival' }
        );
      }

      const factor = await feedbackLearningService.getAdjustmentFactor('user-1');
      // Accuracy = 0.6, Multiplier = 0.5 + 0.6 * 0.5 = 0.8
      expect(factor.confidenceMultiplier).toBeCloseTo(0.8);
    });
  });

  // ============================================================================
  // clearUserFeedback Tests
  // ============================================================================

  describe('clearUserFeedback', () => {
    it('should clear all feedback for a specific user', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-2', 'general_positive', { feature: 'ui' });

      await feedbackLearningService.clearUserFeedback('user-1');

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(0);
    });

    it('should not affect other users feedback', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-2', 'general_positive', { feature: 'ui' });
      await feedbackLearningService.submitFeedback('user-2', 'general_negative', { feature: 'ui' });

      await feedbackLearningService.clearUserFeedback('user-1');

      const stats2 = await feedbackLearningService.getStatistics('user-2');
      expect(stats2.totalFeedback).toBe(2);
    });

    it('should persist cleared state to storage', async () => {
      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });

      await feedbackLearningService.clearUserFeedback('user-1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro:feedback_data',
        expect.stringMatching(/^\[/) // Empty array
      );
    });

    it('should handle clearing non-existent user gracefully', async () => {
      await expect(
        feedbackLearningService.clearUserFeedback('non-existent-user')
      ).resolves.not.toThrow();
    });

    it('should handle storage errors during clear gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await feedbackLearningService.submitFeedback('user-1', 'general_positive', { feature: 'ui' });

      // Should not throw even though storage fails
      await expect(
        feedbackLearningService.clearUserFeedback('user-1')
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Trend Calculation Tests
  // ============================================================================

  describe('Trend calculation', () => {
    it('should return stable trend when less than 6 entries', async () => {
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.recentTrend).toBe('stable');
    });

    it('should return improving trend when second half has higher positive rate', async () => {
      // First half: all negative
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_negative',
          { feature: 'ui' }
        );
      }

      // Add small delay to ensure timestamp ordering
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second half: all positive (> 10% improvement)
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.recentTrend).toBe('improving');
    });

    it('should return declining trend when second half has lower positive rate', async () => {
      // First half: all positive
      for (let i = 0; i < 4; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }

      // Add small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second half: all negative (> 10% decline)
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_negative',
          { feature: 'ui' }
        );
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.recentTrend).toBe('declining');
    });

    it('should return stable trend when difference is less than 10%', async () => {
      // First half: 3 positive, 3 negative (50%)
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_negative',
          { feature: 'ui' }
        );
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Second half: 3 positive, 3 negative (50%) - only 0% change
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_negative',
          { feature: 'ui' }
        );
      }

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.recentTrend).toBe('stable');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle complete workflow: submit, analyze, adjust', async () => {
      // User submits feedback over time
      for (let i = 0; i < 3; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'prediction_accurate',
          { feature: 'arrival_prediction' }
        );
      }
      for (let i = 0; i < 2; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'timing_too_early',
          { feature: 'notifications' }
        );
      }

      // Get insights
      const insights = await feedbackLearningService.getInsights('user-1');
      expect(insights?.overallSatisfaction).toBe(60);

      // Get statistics
      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(5);

      // Get adjustment factors
      const factors = await feedbackLearningService.getAdjustmentFactor('user-1');
      expect(factors.timeAdjustment).toBe(5); // Tend early
      expect(factors.confidenceMultiplier).toBeCloseTo(1); // High prediction accuracy
    });

    it('should handle multiple users independently', async () => {
      // User 1: All positive
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-1',
          'general_positive',
          { feature: 'ui' }
        );
      }

      // User 2: All negative
      for (let i = 0; i < 5; i++) {
        await feedbackLearningService.submitFeedback(
          'user-2',
          'general_negative',
          { feature: 'ui' }
        );
      }

      const insights1 = await feedbackLearningService.getInsights('user-1');
      const insights2 = await feedbackLearningService.getInsights('user-2');

      expect(insights1?.overallSatisfaction).toBe(100);
      expect(insights2?.overallSatisfaction).toBe(0);
    });

    it('should maintain data consistency across operations', async () => {
      await feedbackLearningService.submitFeedback(
        'user-1',
        'general_positive',
        { feature: 'ui' },
        5,
        'Great!'
      );

      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(1);
      expect(stats.averageRating).toBe(5);

      await feedbackLearningService.clearUserFeedback('user-1');

      const statsAfterClear = await feedbackLearningService.getStatistics('user-1');
      expect(statsAfterClear.totalFeedback).toBe(0);
    });

    it('should survive persist/restore cycle', async () => {
      // Submit feedback
      await feedbackLearningService.submitFeedback(
        'user-1',
        'prediction_accurate',
        { feature: 'arrival' },
        5
      );

      // Simulate restart by resetting state
      (feedbackLearningService as any).initialized = false;
      (feedbackLearningService as any).feedbackData = [];

      // Restore from mock storage
      const mockData = [
        {
          id: 'feedback_1',
          userId: 'user-1',
          type: 'prediction_accurate',
          context: { feature: 'arrival' },
          rating: 5,
          timestamp: new Date().toISOString(),
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      await feedbackLearningService.initialize();
      const stats = await feedbackLearningService.getStatistics('user-1');
      expect(stats.totalFeedback).toBe(1);
    });
  });
});
