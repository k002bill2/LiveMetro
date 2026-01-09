/**
 * Departure Alert Service (Scenario 1)
 * Sends notification N minutes before predicted departure time
 */

import { notificationService } from './notificationService';
import { modelService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { getDayOfWeek, parseTimeToMinutes, formatMinutesToTime } from '@/models/pattern';
import {
  MLPrediction,
  DepartureAlertConfig,
  isPredictionReliable,
  generateAlertId,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface DepartureAlert {
  readonly id: string;
  readonly userId: string;
  readonly predictedDepartureTime: string;
  readonly alertTime: string;
  readonly confidence: number;
  readonly scheduledNotificationId: string | null;
  readonly createdAt: Date;
}

export interface DepartureAlertResult {
  readonly success: boolean;
  readonly alert: DepartureAlert | null;
  readonly error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MINUTES_BEFORE = 15;
const MIN_CONFIDENCE = 0.3;

// ============================================================================
// Service
// ============================================================================

class DepartureAlertService {
  private scheduledAlerts: Map<string, DepartureAlert> = new Map();

  /**
   * Schedule a departure alert based on ML prediction
   */
  async scheduleDepartureAlert(
    userId: string,
    config: Partial<DepartureAlertConfig> = {}
  ): Promise<DepartureAlertResult> {
    const {
      minutesBefore = DEFAULT_MINUTES_BEFORE,
      includeDelayPrediction = true,
      minConfidence = MIN_CONFIDENCE,
    } = config;

    try {
      // Get user's commute logs
      const logs = await commuteLogService.getRecentLogsForAnalysis(userId);

      if (logs.length === 0) {
        return {
          success: false,
          alert: null,
          error: 'No commute history available',
        };
      }

      // Get prediction for today
      const today = new Date();
      const dayOfWeek = getDayOfWeek(today);

      const prediction = await modelService.predict(logs, dayOfWeek);

      // Check prediction confidence
      if (!isPredictionReliable(prediction, minConfidence)) {
        return {
          success: false,
          alert: null,
          error: `Prediction confidence (${prediction.confidence.toFixed(2)}) below threshold (${minConfidence})`,
        };
      }

      // Calculate alert time
      const alertTime = this.calculateAlertTime(
        prediction.predictedDepartureTime,
        minutesBefore
      );

      // Check if alert time is in the future
      if (!this.isTimeInFuture(alertTime)) {
        return {
          success: false,
          alert: null,
          error: 'Alert time has already passed',
        };
      }

      // Build notification message
      const { title, body } = this.buildNotificationMessage(
        prediction,
        minutesBefore,
        includeDelayPrediction
      );

      // Schedule the notification
      const scheduledDate = this.timeStringToDate(alertTime);
      const notificationId = await notificationService.scheduleCommuteReminder(
        title,
        body,
        scheduledDate
      );

      // Create alert record
      const alert: DepartureAlert = {
        id: generateAlertId(),
        userId,
        predictedDepartureTime: prediction.predictedDepartureTime,
        alertTime,
        confidence: prediction.confidence,
        scheduledNotificationId: notificationId,
        createdAt: new Date(),
      };

      // Store alert
      this.scheduledAlerts.set(alert.id, alert);

      return {
        success: true,
        alert,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        alert: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel a scheduled departure alert
   */
  async cancelAlert(alertId: string): Promise<boolean> {
    const alert = this.scheduledAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    // Cancel notification if scheduled
    if (alert.scheduledNotificationId) {
      await notificationService.cancelNotification(alert.scheduledNotificationId);
    }

    this.scheduledAlerts.delete(alertId);
    return true;
  }

  /**
   * Cancel all scheduled departure alerts for a user
   */
  async cancelAllAlerts(userId: string): Promise<number> {
    let cancelledCount = 0;

    for (const [alertId, alert] of this.scheduledAlerts) {
      if (alert.userId === userId) {
        await this.cancelAlert(alertId);
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Get all scheduled alerts for a user
   */
  getScheduledAlerts(userId: string): DepartureAlert[] {
    const alerts: DepartureAlert[] = [];

    for (const alert of this.scheduledAlerts.values()) {
      if (alert.userId === userId) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Get ML prediction for departure
   */
  async getPredictedDeparture(
    userId: string,
    date: Date = new Date()
  ): Promise<MLPrediction | null> {
    try {
      const logs = await commuteLogService.getRecentLogsForAnalysis(userId);
      if (logs.length === 0) {
        return null;
      }

      const dayOfWeek = getDayOfWeek(date);
      return modelService.predict(logs, dayOfWeek);
    } catch {
      return null;
    }
  }

  /**
   * Check if should send alert now based on user's pattern
   */
  async shouldAlertNow(
    userId: string,
    bufferMinutes: number = 5
  ): Promise<{ shouldAlert: boolean; prediction: MLPrediction | null; reason: string }> {
    const prediction = await this.getPredictedDeparture(userId);

    if (!prediction) {
      return {
        shouldAlert: false,
        prediction: null,
        reason: 'No prediction available',
      };
    }

    if (!isPredictionReliable(prediction)) {
      return {
        shouldAlert: false,
        prediction,
        reason: 'Prediction confidence too low',
      };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const departureMinutes = parseTimeToMinutes(prediction.predictedDepartureTime);

    const minutesUntilDeparture = departureMinutes - currentMinutes;

    if (minutesUntilDeparture <= 0) {
      return {
        shouldAlert: false,
        prediction,
        reason: 'Departure time has passed',
      };
    }

    if (minutesUntilDeparture <= bufferMinutes) {
      return {
        shouldAlert: true,
        prediction,
        reason: `${minutesUntilDeparture} minutes until departure`,
      };
    }

    return {
      shouldAlert: false,
      prediction,
      reason: `${minutesUntilDeparture} minutes until departure (not yet time)`,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate alert time based on departure time and minutes before
   */
  private calculateAlertTime(departureTime: string, minutesBefore: number): string {
    const departureMinutes = parseTimeToMinutes(departureTime);
    const alertMinutes = departureMinutes - minutesBefore;

    // Handle day wraparound
    const adjustedMinutes = alertMinutes < 0 ? alertMinutes + 24 * 60 : alertMinutes;
    return formatMinutesToTime(adjustedMinutes);
  }

  /**
   * Check if time string is in the future
   */
  private isTimeInFuture(timeString: string): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = parseTimeToMinutes(timeString);

    return targetMinutes > currentMinutes;
  }

  /**
   * Convert time string to Date for today
   */
  private timeStringToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  /**
   * Build notification message
   */
  private buildNotificationMessage(
    prediction: MLPrediction,
    minutesBefore: number,
    includeDelayPrediction: boolean
  ): { title: string; body: string } {
    const title = '출발 알림';

    let body = `${minutesBefore}분 후 출발 예정입니다. (예상 출발: ${prediction.predictedDepartureTime})`;

    if (includeDelayPrediction && prediction.delayProbability > 0.3) {
      const delayPercent = Math.round(prediction.delayProbability * 100);
      body += `\n⚠️ 지연 가능성: ${delayPercent}%`;
    }

    if (prediction.confidence < 0.5) {
      body += '\n(참고: 예측 신뢰도가 낮습니다)';
    }

    return { title, body };
  }
}

// ============================================================================
// Export
// ============================================================================

export const departureAlertService = new DepartureAlertService();
export default departureAlertService;
