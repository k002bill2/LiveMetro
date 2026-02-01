/**
 * Feedback Learning Service
 * Learns from user feedback to improve predictions and recommendations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

/**
 * User feedback types
 */
export type FeedbackType =
  | 'prediction_accurate'
  | 'prediction_inaccurate'
  | 'timing_too_early'
  | 'timing_too_late'
  | 'timing_good'
  | 'route_helpful'
  | 'route_not_helpful'
  | 'delay_info_accurate'
  | 'delay_info_inaccurate'
  | 'general_positive'
  | 'general_negative';

/**
 * Feedback entry
 */
export interface FeedbackEntry {
  readonly id: string;
  readonly userId: string;
  readonly type: FeedbackType;
  readonly context: FeedbackContext;
  readonly rating?: number; // 1-5
  readonly comment?: string;
  readonly timestamp: Date;
}

/**
 * Feedback context
 */
export interface FeedbackContext {
  readonly feature: string;
  readonly predictedValue?: string;
  readonly actualValue?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Learning insights from feedback
 */
export interface LearningInsights {
  readonly userId: string;
  readonly overallSatisfaction: number; // 0-100
  readonly featureScores: Record<string, number>;
  readonly commonIssues: readonly string[];
  readonly suggestedImprovements: readonly string[];
  readonly lastUpdated: Date;
}

/**
 * Feedback statistics
 */
export interface FeedbackStats {
  readonly totalFeedback: number;
  readonly positiveRate: number;
  readonly negativeRate: number;
  readonly averageRating: number;
  readonly feedbackByType: Record<FeedbackType, number>;
  readonly recentTrend: 'improving' | 'declining' | 'stable';
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:feedback_data';
const MAX_FEEDBACK_ENTRIES = 500;
const MIN_FEEDBACK_FOR_INSIGHTS = 5;

// ============================================================================
// Service
// ============================================================================

class FeedbackLearningService {
  private feedbackData: FeedbackEntry[] = [];
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
        this.feedbackData = parsed.map((entry: FeedbackEntry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }
    } catch {
      this.feedbackData = [];
    }

    this.initialized = true;
  }

  /**
   * Submit feedback
   */
  async submitFeedback(
    userId: string,
    type: FeedbackType,
    context: FeedbackContext,
    rating?: number,
    comment?: string
  ): Promise<FeedbackEntry> {
    await this.initialize();

    const entry: FeedbackEntry = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      context,
      rating,
      comment,
      timestamp: new Date(),
    };

    this.feedbackData.push(entry);

    // Keep only recent entries
    if (this.feedbackData.length > MAX_FEEDBACK_ENTRIES) {
      this.feedbackData = this.feedbackData.slice(-MAX_FEEDBACK_ENTRIES);
    }

    await this.saveData();

    return entry;
  }

  /**
   * Get learning insights for a user
   */
  async getInsights(userId: string): Promise<LearningInsights | null> {
    await this.initialize();

    const userFeedback = this.feedbackData.filter(f => f.userId === userId);

    if (userFeedback.length < MIN_FEEDBACK_FOR_INSIGHTS) {
      return null;
    }

    // Calculate overall satisfaction
    const positiveTypes: FeedbackType[] = [
      'prediction_accurate',
      'timing_good',
      'route_helpful',
      'delay_info_accurate',
      'general_positive',
    ];

    const positiveCount = userFeedback.filter(f => positiveTypes.includes(f.type)).length;
    const overallSatisfaction = Math.round((positiveCount / userFeedback.length) * 100);

    // Calculate feature scores
    const featureScores = this.calculateFeatureScores(userFeedback);

    // Identify common issues
    const commonIssues = this.identifyCommonIssues(userFeedback);

    // Generate improvement suggestions
    const suggestedImprovements = this.generateImprovements(userFeedback, featureScores);

    return {
      userId,
      overallSatisfaction,
      featureScores,
      commonIssues,
      suggestedImprovements,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get feedback statistics
   */
  async getStatistics(userId?: string): Promise<FeedbackStats> {
    await this.initialize();

    const feedback = userId
      ? this.feedbackData.filter(f => f.userId === userId)
      : this.feedbackData;

    if (feedback.length === 0) {
      return {
        totalFeedback: 0,
        positiveRate: 0,
        negativeRate: 0,
        averageRating: 0,
        feedbackByType: {} as Record<FeedbackType, number>,
        recentTrend: 'stable',
      };
    }

    // Calculate rates
    const positiveTypes: FeedbackType[] = [
      'prediction_accurate', 'timing_good', 'route_helpful',
      'delay_info_accurate', 'general_positive',
    ];
    const negativeTypes: FeedbackType[] = [
      'prediction_inaccurate', 'timing_too_early', 'timing_too_late',
      'route_not_helpful', 'delay_info_inaccurate', 'general_negative',
    ];

    const positiveCount = feedback.filter(f => positiveTypes.includes(f.type)).length;
    const negativeCount = feedback.filter(f => negativeTypes.includes(f.type)).length;

    // Calculate average rating
    const rated = feedback.filter(f => f.rating !== undefined);
    const averageRating = rated.length > 0
      ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length
      : 0;

    // Count by type
    const feedbackByType: Record<string, number> = {};
    for (const entry of feedback) {
      feedbackByType[entry.type] = (feedbackByType[entry.type] ?? 0) + 1;
    }

    // Calculate trend
    const recentTrend = this.calculateTrend(feedback);

    return {
      totalFeedback: feedback.length,
      positiveRate: positiveCount / feedback.length,
      negativeRate: negativeCount / feedback.length,
      averageRating,
      feedbackByType: feedbackByType as Record<FeedbackType, number>,
      recentTrend,
    };
  }

  /**
   * Get prediction accuracy based on feedback
   */
  async getPredictionAccuracy(userId: string): Promise<number> {
    await this.initialize();

    const predictionFeedback = this.feedbackData.filter(
      f => f.userId === userId &&
        (f.type === 'prediction_accurate' || f.type === 'prediction_inaccurate')
    );

    if (predictionFeedback.length === 0) return 0.5; // Default

    const accurate = predictionFeedback.filter(f => f.type === 'prediction_accurate').length;
    return accurate / predictionFeedback.length;
  }

  /**
   * Get timing accuracy based on feedback
   */
  async getTimingAccuracy(userId: string): Promise<{
    accuracy: number;
    tendEarly: boolean;
    tendLate: boolean;
  }> {
    await this.initialize();

    const timingFeedback = this.feedbackData.filter(
      f => f.userId === userId &&
        ['timing_too_early', 'timing_too_late', 'timing_good'].includes(f.type)
    );

    if (timingFeedback.length === 0) {
      return { accuracy: 0.5, tendEarly: false, tendLate: false };
    }

    const good = timingFeedback.filter(f => f.type === 'timing_good').length;
    const early = timingFeedback.filter(f => f.type === 'timing_too_early').length;
    const late = timingFeedback.filter(f => f.type === 'timing_too_late').length;

    return {
      accuracy: good / timingFeedback.length,
      tendEarly: early > late && early > good,
      tendLate: late > early && late > good,
    };
  }

  /**
   * Apply learning to adjust predictions
   */
  async getAdjustmentFactor(userId: string): Promise<{
    timeAdjustment: number; // minutes
    confidenceMultiplier: number;
  }> {
    const timing = await this.getTimingAccuracy(userId);

    let timeAdjustment = 0;
    if (timing.tendEarly) {
      timeAdjustment = 5; // Send notifications later
    } else if (timing.tendLate) {
      timeAdjustment = -5; // Send notifications earlier
    }

    const accuracy = await this.getPredictionAccuracy(userId);
    const confidenceMultiplier = 0.5 + accuracy * 0.5;

    return { timeAdjustment, confidenceMultiplier };
  }

  /**
   * Clear user feedback
   */
  async clearUserFeedback(userId: string): Promise<void> {
    await this.initialize();
    this.feedbackData = this.feedbackData.filter(f => f.userId !== userId);
    await this.saveData();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate feature scores
   */
  private calculateFeatureScores(
    feedback: readonly FeedbackEntry[]
  ): Record<string, number> {
    const featureMap = new Map<string, { positive: number; total: number }>();

    for (const entry of feedback) {
      const feature = entry.context.feature;
      const current = featureMap.get(feature) ?? { positive: 0, total: 0 };

      current.total++;
      if (this.isPositiveFeedback(entry.type)) {
        current.positive++;
      }

      featureMap.set(feature, current);
    }

    const scores: Record<string, number> = {};
    for (const [feature, data] of featureMap) {
      scores[feature] = Math.round((data.positive / data.total) * 100);
    }

    return scores;
  }

  /**
   * Identify common issues
   */
  private identifyCommonIssues(feedback: readonly FeedbackEntry[]): string[] {
    const issues: string[] = [];
    const issueCounts = new Map<string, number>();

    const negativeTypes: Record<FeedbackType, string> = {
      prediction_inaccurate: '예측이 정확하지 않음',
      timing_too_early: '알림이 너무 이름',
      timing_too_late: '알림이 너무 늦음',
      route_not_helpful: '경로 추천이 도움되지 않음',
      delay_info_inaccurate: '지연 정보가 정확하지 않음',
      general_negative: '전반적 불만족',
      prediction_accurate: '',
      timing_good: '',
      route_helpful: '',
      delay_info_accurate: '',
      general_positive: '',
    };

    for (const entry of feedback) {
      const issue = negativeTypes[entry.type];
      if (issue) {
        issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      }
    }

    // Get top issues
    const sorted = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [issue, count] of sorted) {
      if (count >= 2) { // At least 2 occurrences
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(
    feedback: readonly FeedbackEntry[],
    featureScores: Record<string, number>
  ): string[] {
    const improvements: string[] = [];

    // Low scoring features
    for (const [feature, score] of Object.entries(featureScores)) {
      if (score < 50) {
        improvements.push(`${feature} 기능 개선 필요`);
      }
    }

    // Timing issues
    const timingFeedback = feedback.filter(f =>
      ['timing_too_early', 'timing_too_late'].includes(f.type)
    );
    if (timingFeedback.length >= 3) {
      const early = timingFeedback.filter(f => f.type === 'timing_too_early').length;
      const late = timingFeedback.filter(f => f.type === 'timing_too_late').length;

      if (early > late) {
        improvements.push('알림 시간을 조금 늦춰보세요');
      } else {
        improvements.push('알림 시간을 조금 앞당겨보세요');
      }
    }

    if (improvements.length === 0) {
      improvements.push('현재 설정이 잘 맞는 것 같습니다');
    }

    return improvements;
  }

  /**
   * Calculate trend
   */
  private calculateTrend(
    feedback: readonly FeedbackEntry[]
  ): 'improving' | 'declining' | 'stable' {
    if (feedback.length < 6) return 'stable';

    const sorted = [...feedback].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstPositiveRate = this.calculatePositiveRate(firstHalf);
    const secondPositiveRate = this.calculatePositiveRate(secondHalf);

    const diff = secondPositiveRate - firstPositiveRate;

    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate positive feedback rate
   */
  private calculatePositiveRate(feedback: readonly FeedbackEntry[]): number {
    if (feedback.length === 0) return 0.5;
    const positive = feedback.filter(f => this.isPositiveFeedback(f.type)).length;
    return positive / feedback.length;
  }

  /**
   * Check if feedback type is positive
   */
  private isPositiveFeedback(type: FeedbackType): boolean {
    return [
      'prediction_accurate',
      'timing_good',
      'route_helpful',
      'delay_info_accurate',
      'general_positive',
    ].includes(type);
  }

  /**
   * Save data to storage
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.feedbackData));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const feedbackLearningService = new FeedbackLearningService();
export default feedbackLearningService;
