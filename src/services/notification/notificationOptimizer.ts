/**
 * Notification Optimizer Service
 * Optimizes notification timing and content based on user behavior
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayOfWeek, parseTimeToMinutes, formatMinutesToTime } from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification timing optimization
 */
export interface NotificationTiming {
  readonly suggestedTime: string;
  readonly adjustmentMinutes: number;
  readonly reason: string;
  readonly confidence: number;
}

/**
 * User notification preferences learned from behavior
 */
export interface LearnedPreferences {
  readonly userId: string;
  readonly preferredLeadTime: number; // minutes before departure
  readonly responsiveHours: readonly number[];
  readonly ignoredHours: readonly number[];
  readonly averageResponseTime: number; // seconds
  readonly dismissRate: number; // 0-1
  readonly snoozeRate: number; // 0-1
  readonly lastUpdated: Date;
}

/**
 * Notification interaction event
 */
export interface NotificationInteraction {
  readonly notificationId: string;
  readonly userId: string;
  readonly sentAt: Date;
  readonly interactedAt?: Date;
  readonly interactionType: 'opened' | 'dismissed' | 'snoozed' | 'action' | 'ignored';
  readonly scheduledDeparture: string;
  readonly actualDeparture?: string;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  readonly type: 'timing' | 'frequency' | 'content';
  readonly currentValue: string;
  readonly suggestedValue: string;
  readonly reason: string;
  readonly expectedImprovement: number; // 0-100
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  PREFERENCES: '@livemetro:notification_preferences',
  INTERACTIONS: '@livemetro:notification_interactions',
};

const DEFAULT_LEAD_TIME = 15; // minutes
const MIN_INTERACTIONS_FOR_LEARNING = 10;

// ============================================================================
// Service
// ============================================================================

class NotificationOptimizerService {
  private preferences: Map<string, LearnedPreferences> = new Map();
  private interactions: NotificationInteraction[] = [];

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      const prefData = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (prefData) {
        const parsed = JSON.parse(prefData);
        for (const [key, value] of Object.entries(parsed)) {
          this.preferences.set(key, value as LearnedPreferences);
        }
      }

      const interData = await AsyncStorage.getItem(STORAGE_KEYS.INTERACTIONS);
      if (interData) {
        this.interactions = JSON.parse(interData);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get optimal notification time
   */
  async getOptimalNotificationTime(
    userId: string,
    scheduledDeparture: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dayOfWeek: DayOfWeek
  ): Promise<NotificationTiming> {
    const prefs = this.preferences.get(userId);

    if (!prefs || prefs.dismissRate > 0.5) {
      // No learned preferences or high dismiss rate
      return {
        suggestedTime: this.subtractMinutes(scheduledDeparture, DEFAULT_LEAD_TIME),
        adjustmentMinutes: 0,
        reason: '기본 알림 시간',
        confidence: 0.5,
      };
    }

    // Use learned lead time
    const leadTime = prefs.preferredLeadTime;
    const baseTime = this.subtractMinutes(scheduledDeparture, leadTime);
    const baseHour = parseTimeToMinutes(baseTime) / 60;

    // Check if hour is typically ignored
    if (prefs.ignoredHours.includes(Math.floor(baseHour))) {
      // Suggest earlier time
      return {
        suggestedTime: this.subtractMinutes(scheduledDeparture, leadTime + 10),
        adjustmentMinutes: -10,
        reason: '이 시간대 알림 응답률이 낮습니다',
        confidence: 0.6,
      };
    }

    // High response time, suggest earlier
    if (prefs.averageResponseTime > 60) {
      const adjustment = Math.min(Math.ceil(prefs.averageResponseTime / 60), 10);
      return {
        suggestedTime: this.subtractMinutes(scheduledDeparture, leadTime + adjustment),
        adjustmentMinutes: -adjustment,
        reason: '응답 시간을 고려하여 조정됨',
        confidence: 0.7,
      };
    }

    return {
      suggestedTime: baseTime,
      adjustmentMinutes: 0,
      reason: '학습된 선호 시간',
      confidence: Math.min(0.9, prefs.dismissRate < 0.2 ? 0.9 : 0.7),
    };
  }

  /**
   * Record notification interaction
   */
  async recordInteraction(interaction: NotificationInteraction): Promise<void> {
    this.interactions.push(interaction);

    // Keep last 100 interactions
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100);
    }

    await this.saveInteractions();

    // Update preferences if enough data
    const userInteractions = this.interactions.filter(i => i.userId === interaction.userId);
    if (userInteractions.length >= MIN_INTERACTIONS_FOR_LEARNING) {
      await this.updatePreferences(interaction.userId, userInteractions);
    }
  }

  /**
   * Get optimization recommendations
   */
  async getRecommendations(userId: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const prefs = this.preferences.get(userId);
    const userInteractions = this.interactions.filter(i => i.userId === userId);

    if (userInteractions.length < MIN_INTERACTIONS_FOR_LEARNING) {
      return recommendations;
    }

    // Dismiss rate analysis
    if (prefs && prefs.dismissRate > 0.4) {
      recommendations.push({
        type: 'timing',
        currentValue: `${prefs.preferredLeadTime}분 전`,
        suggestedValue: `${prefs.preferredLeadTime + 5}분 전`,
        reason: '알림 무시율이 높습니다. 조금 더 일찍 알림을 보내보세요.',
        expectedImprovement: 20,
      });
    }

    // Snooze rate analysis
    if (prefs && prefs.snoozeRate > 0.3) {
      recommendations.push({
        type: 'timing',
        currentValue: `${prefs.preferredLeadTime}분 전`,
        suggestedValue: `${prefs.preferredLeadTime - 5}분 전`,
        reason: '알림 다시알림율이 높습니다. 조금 더 늦게 알림을 보내보세요.',
        expectedImprovement: 15,
      });
    }

    // Response time analysis
    if (prefs && prefs.averageResponseTime > 120) {
      recommendations.push({
        type: 'content',
        currentValue: '표준 알림',
        suggestedValue: '간략 알림',
        reason: '응답 시간이 깁니다. 더 간단한 알림을 시도해보세요.',
        expectedImprovement: 10,
      });
    }

    return recommendations;
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(userId: string): number {
    const userInteractions = this.interactions.filter(i => i.userId === userId);

    if (userInteractions.length === 0) return 50;

    const opened = userInteractions.filter(i => i.interactionType === 'opened').length;
    const actioned = userInteractions.filter(i => i.interactionType === 'action').length;
    const dismissed = userInteractions.filter(i => i.interactionType === 'dismissed').length;
    const ignored = userInteractions.filter(i => i.interactionType === 'ignored').length;

    const positiveScore = (opened * 2 + actioned * 3) / userInteractions.length;
    const negativeScore = (dismissed + ignored * 2) / userInteractions.length;

    return Math.round(Math.max(0, Math.min(100, 50 + (positiveScore - negativeScore) * 50)));
  }

  /**
   * Get user preferences
   */
  getPreferences(userId: string): LearnedPreferences | null {
    return this.preferences.get(userId) ?? null;
  }

  /**
   * Reset user preferences
   */
  async resetPreferences(userId: string): Promise<void> {
    this.preferences.delete(userId);
    this.interactions = this.interactions.filter(i => i.userId !== userId);
    await this.savePreferences();
    await this.saveInteractions();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Update preferences based on interactions
   */
  private async updatePreferences(
    userId: string,
    interactions: NotificationInteraction[]
  ): Promise<void> {
    // Calculate dismiss rate
    const dismissed = interactions.filter(i => i.interactionType === 'dismissed').length;
    const dismissRate = dismissed / interactions.length;

    // Calculate snooze rate
    const snoozed = interactions.filter(i => i.interactionType === 'snoozed').length;
    const snoozeRate = snoozed / interactions.length;

    // Calculate average response time
    const responded = interactions.filter(i => i.interactedAt);
    const avgResponseTime = responded.length > 0
      ? responded.reduce((sum, i) => {
          const sent = new Date(i.sentAt).getTime();
          const interacted = new Date(i.interactedAt!).getTime();
          return sum + (interacted - sent) / 1000;
        }, 0) / responded.length
      : 60;

    // Analyze responsive and ignored hours
    const hourCounts = new Map<number, { responded: number; ignored: number }>();

    for (const interaction of interactions) {
      const hour = new Date(interaction.sentAt).getHours();
      const current = hourCounts.get(hour) ?? { responded: 0, ignored: 0 };

      if (interaction.interactionType === 'ignored') {
        current.ignored++;
      } else {
        current.responded++;
      }

      hourCounts.set(hour, current);
    }

    const responsiveHours: number[] = [];
    const ignoredHours: number[] = [];

    for (const [hour, counts] of hourCounts) {
      const responseRate = counts.responded / (counts.responded + counts.ignored);
      if (responseRate > 0.7) responsiveHours.push(hour);
      if (responseRate < 0.3) ignoredHours.push(hour);
    }

    // Calculate preferred lead time
    const leadTimes = interactions
      .filter(i => i.scheduledDeparture && i.interactionType !== 'ignored')
      .map(i => {
        const sent = parseTimeToMinutes(
          new Date(i.sentAt).toTimeString().slice(0, 5)
        );
        const scheduled = parseTimeToMinutes(i.scheduledDeparture);
        return scheduled - sent;
      })
      .filter(t => t > 0 && t < 60);

    const preferredLeadTime = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : DEFAULT_LEAD_TIME;

    const prefs: LearnedPreferences = {
      userId,
      preferredLeadTime,
      responsiveHours,
      ignoredHours,
      averageResponseTime: avgResponseTime,
      dismissRate,
      snoozeRate,
      lastUpdated: new Date(),
    };

    this.preferences.set(userId, prefs);
    await this.savePreferences();
  }

  /**
   * Subtract minutes from time
   */
  private subtractMinutes(time: string, minutes: number): string {
    const totalMinutes = parseTimeToMinutes(time) - minutes;
    const adjusted = totalMinutes < 0 ? totalMinutes + 24 * 60 : totalMinutes;
    return formatMinutesToTime(adjusted);
  }

  /**
   * Save preferences
   */
  private async savePreferences(): Promise<void> {
    try {
      const data = Object.fromEntries(this.preferences);
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save interactions
   */
  private async saveInteractions(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.INTERACTIONS,
        JSON.stringify(this.interactions)
      );
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const notificationOptimizer = new NotificationOptimizerService();
export default notificationOptimizer;
