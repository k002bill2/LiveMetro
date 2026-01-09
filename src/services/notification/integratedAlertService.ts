/**
 * Integrated Alert Service (Scenario 4)
 * Orchestrates all alert scenarios into a unified smart notification system
 */

import { notificationService, NotificationType } from './notificationService';
import { departureAlertService } from './departureAlertService';
import { trainArrivalAlertService } from './trainArrivalAlertService';
import { delayResponseAlertService } from './delayResponseAlertService';
import { modelService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { patternAnalysisService } from '@/services/pattern/patternAnalysisService';
import {
  getDayOfWeek,
  parseTimeToMinutes,
  formatMinutesToTime,
  FrequentRoute,
} from '@/models/pattern';
import {
  IntegratedAlert,
  IntegratedAlertType,
  AlertPriority,
  MLPrediction,
  DelayStatus,
  AlertAction,
  MonitoringSettings,
  DEFAULT_MONITORING_SETTINGS,
  generateAlertId,
  calculateAlertPriority,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface IntegratedAlertConfig {
  readonly userId: string;
  readonly settings: MonitoringSettings;
  readonly enableDepartureAlert: boolean;
  readonly enableTrainArrivalAlert: boolean;
  readonly enableDelayAlert: boolean;
  readonly departureMinutesBefore: number;
  readonly trainArrivalMinutesBefore: number;
}

interface ActiveMonitoring {
  readonly userId: string;
  readonly config: IntegratedAlertConfig;
  readonly intervalId: ReturnType<typeof setInterval> | null;
  readonly lastCheck: Date | null;
  readonly isActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DEPARTURE_MINUTES_BEFORE = 15;
const DEFAULT_TRAIN_ARRIVAL_MINUTES_BEFORE = 3;
const MONITORING_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

// ============================================================================
// Service
// ============================================================================

class IntegratedAlertService {
  private activeMonitoring: Map<string, ActiveMonitoring> = new Map();
  private alertHistory: IntegratedAlert[] = [];

  /**
   * Generate an integrated alert for the user
   */
  async generateIntegratedAlert(
    userId: string,
    date: Date = new Date()
  ): Promise<IntegratedAlert | null> {
    try {
      // Get user's commute logs
      const logs = await commuteLogService.getRecentLogsForAnalysis(userId);
      if (logs.length === 0) {
        return null;
      }

      // Get pattern for today
      const dayOfWeek = getDayOfWeek(date);
      const pattern = await patternAnalysisService.getPatternForDay(userId, dayOfWeek);
      if (!pattern) {
        return null;
      }

      // Get ML prediction
      const prediction = await modelService.predict(logs, dayOfWeek);

      // Check for delays on route
      const delayStatus = await this.checkDelayStatus(userId, pattern.frequentRoute);

      // Determine alert type and priority
      const { type, priority } = this.determineAlertTypeAndPriority(prediction, delayStatus);

      // Build alert message
      const { title, body } = this.buildAlertMessage(type, prediction, delayStatus);

      // Calculate alert time
      const alertTime = this.calculateAlertTime(prediction, delayStatus, type);

      // Create integrated alert
      const alert: IntegratedAlert = {
        id: generateAlertId(),
        type,
        priority,
        title,
        body,
        scheduledTime: alertTime,
        prediction,
        delayStatus,
        trainInfo: null, // Will be populated when train monitoring is active
        actionButtons: this.generateActionButtons(type),
        createdAt: new Date(),
      };

      // Store in history
      this.alertHistory.push(alert);
      if (this.alertHistory.length > 100) {
        this.alertHistory.shift();
      }

      return alert;
    } catch {
      return null;
    }
  }

  /**
   * Schedule background monitoring for a user
   */
  async scheduleBackgroundMonitoring(
    userId: string,
    config: Partial<IntegratedAlertConfig> = {}
  ): Promise<string> {
    const fullConfig: IntegratedAlertConfig = {
      userId,
      settings: config.settings || DEFAULT_MONITORING_SETTINGS,
      enableDepartureAlert: config.enableDepartureAlert ?? true,
      enableTrainArrivalAlert: config.enableTrainArrivalAlert ?? true,
      enableDelayAlert: config.enableDelayAlert ?? true,
      departureMinutesBefore: config.departureMinutesBefore ?? DEFAULT_DEPARTURE_MINUTES_BEFORE,
      trainArrivalMinutesBefore: config.trainArrivalMinutesBefore ?? DEFAULT_TRAIN_ARRIVAL_MINUTES_BEFORE,
    };

    // Stop existing monitoring if any
    this.stopBackgroundMonitoring(userId);

    // Start new monitoring
    const monitoringId = generateAlertId();
    const intervalId = setInterval(
      () => this.performMonitoringCheck(userId),
      MONITORING_CHECK_INTERVAL_MS
    );

    this.activeMonitoring.set(userId, {
      userId,
      config: fullConfig,
      intervalId,
      lastCheck: null,
      isActive: true,
    });

    // Perform initial check
    await this.performMonitoringCheck(userId);

    return monitoringId;
  }

  /**
   * Stop background monitoring for a user
   */
  stopBackgroundMonitoring(userId: string): boolean {
    const monitoring = this.activeMonitoring.get(userId);
    if (!monitoring) {
      return false;
    }

    if (monitoring.intervalId) {
      clearInterval(monitoring.intervalId);
    }

    // Also stop individual service monitoring
    departureAlertService.cancelAllAlerts(userId);
    trainArrivalAlertService.stopAllMonitoring(userId);
    delayResponseAlertService.stopAllMonitoring(userId);

    this.activeMonitoring.delete(userId);
    return true;
  }

  /**
   * Clean up all resources - call when service is no longer needed
   */
  destroy(): void {
    // Stop all monitoring sessions
    for (const monitoring of this.activeMonitoring.values()) {
      if (monitoring.intervalId) {
        clearInterval(monitoring.intervalId);
      }
    }
    this.activeMonitoring.clear();
    this.alertHistory = [];

    // Also clean up dependent services
    trainArrivalAlertService.destroy();
    delayResponseAlertService.destroy();
  }

  /**
   * Get today's alerts for a user
   */
  async getTodayAlerts(_userId: string): Promise<IntegratedAlert[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.alertHistory.filter((alert) => {
      return alert.createdAt >= today;
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): IntegratedAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Check if monitoring is active for a user
   */
  isMonitoringActive(userId: string): boolean {
    const monitoring = this.activeMonitoring.get(userId);
    return monitoring?.isActive ?? false;
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveMonitoringSessions(): ActiveMonitoring[] {
    return Array.from(this.activeMonitoring.values());
  }

  /**
   * Send integrated notification
   */
  async sendIntegratedNotification(alert: IntegratedAlert): Promise<boolean> {
    try {
      await notificationService.sendLocalNotification({
        type: NotificationType.COMMUTE_REMINDER,
        title: alert.title,
        body: alert.body,
        data: {
          alertId: alert.id,
          alertType: alert.type,
          prediction: {
            departureTime: alert.prediction.predictedDepartureTime,
            arrivalTime: alert.prediction.predictedArrivalTime,
            delayProbability: alert.prediction.delayProbability,
            confidence: alert.prediction.confidence,
          },
        },
        priority: alert.priority === 'urgent' ? 'high' : alert.priority === 'high' ? 'high' : 'normal',
      });

      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check delay status for a route
   */
  private async checkDelayStatus(
    userId: string,
    route: FrequentRoute
  ): Promise<DelayStatus | null> {
    try {
      const routeStatus = await delayResponseAlertService.checkRouteDelays(userId, route);

      if (!routeStatus.hasDelays) {
        return null;
      }

      return {
        hasDelay: true,
        affectedLines: routeStatus.affectedLines,
        maxDelayMinutes: routeStatus.maxDelayMinutes,
        reason: routeStatus.delayDetails[0]?.reason,
        adjustedDepartureTime: routeStatus.adjustedDepartureTime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Determine alert type and priority based on prediction and delay status
   */
  private determineAlertTypeAndPriority(
    prediction: MLPrediction,
    delayStatus: DelayStatus | null
  ): { type: IntegratedAlertType; priority: AlertPriority } {
    // If there's an active delay, prioritize delay warning
    if (delayStatus?.hasDelay && delayStatus.maxDelayMinutes >= 5) {
      return {
        type: 'delay_warning',
        priority: calculateAlertPriority(delayStatus, prediction),
      };
    }

    // If high delay probability predicted by ML
    if (prediction.delayProbability >= 0.5) {
      return {
        type: 'delay_warning',
        priority: 'medium',
      };
    }

    // Default to departure alert
    return {
      type: 'departure',
      priority: 'low',
    };
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(
    type: IntegratedAlertType,
    prediction: MLPrediction,
    delayStatus: DelayStatus | null
  ): { title: string; body: string } {
    switch (type) {
      case 'delay_warning':
        if (delayStatus?.hasDelay) {
          return {
            title: '🚇 지연 알림',
            body: `${delayStatus.affectedLines.join(', ')} 노선 ${delayStatus.maxDelayMinutes}분 지연 중. ${delayStatus.adjustedDepartureTime}까지 출발하세요.`,
          };
        }
        return {
          title: '⚠️ 지연 예상',
          body: `오늘 지연 가능성이 ${Math.round(prediction.delayProbability * 100)}%입니다. 여유있게 출발하세요.`,
        };

      case 'train_arrival':
        return {
          title: '🚃 열차 도착',
          body: `곧 열차가 도착합니다. 플랫폼으로 이동하세요.`,
        };

      case 'integrated':
        return {
          title: '📍 통근 알림',
          body: this.buildIntegratedMessage(prediction, delayStatus),
        };

      case 'departure':
      default:
        return {
          title: '🏃 출발 알림',
          body: `${prediction.predictedDepartureTime} 출발 예정입니다. 준비하세요.`,
        };
    }
  }

  /**
   * Build integrated message combining all information
   */
  private buildIntegratedMessage(
    prediction: MLPrediction,
    delayStatus: DelayStatus | null
  ): string {
    let message = `예상 출발: ${prediction.predictedDepartureTime}`;

    if (delayStatus?.hasDelay) {
      message += ` | 지연: ${delayStatus.maxDelayMinutes}분 (${delayStatus.affectedLines.join(', ')})`;
      message += ` | 권장: ${delayStatus.adjustedDepartureTime} 출발`;
    } else if (prediction.delayProbability > 0.3) {
      message += ` | 지연 가능성: ${Math.round(prediction.delayProbability * 100)}%`;
    }

    return message;
  }

  /**
   * Calculate optimal alert time
   */
  private calculateAlertTime(
    prediction: MLPrediction,
    delayStatus: DelayStatus | null,
    type: IntegratedAlertType
  ): string {
    const departureTime = delayStatus?.adjustedDepartureTime || prediction.predictedDepartureTime;
    const departureMinutes = parseTimeToMinutes(departureTime);

    let alertMinutes: number;

    switch (type) {
      case 'delay_warning':
        // Alert 30 minutes before adjusted departure
        alertMinutes = departureMinutes - 30;
        break;
      case 'train_arrival':
        // Alert 5 minutes before departure
        alertMinutes = departureMinutes - 5;
        break;
      default:
        // Alert 15 minutes before departure
        alertMinutes = departureMinutes - 15;
    }

    // Handle wraparound
    if (alertMinutes < 0) {
      alertMinutes += 24 * 60;
    }

    return formatMinutesToTime(alertMinutes);
  }

  /**
   * Generate action buttons for alert
   */
  private generateActionButtons(type: IntegratedAlertType): AlertAction[] {
    const buttons: AlertAction[] = [
      {
        id: 'dismiss',
        label: '확인',
        type: 'dismiss',
      },
    ];

    if (type === 'delay_warning') {
      buttons.unshift({
        id: 'check_alternatives',
        label: '대체 경로',
        type: 'check_alternatives',
      });
    }

    buttons.push({
      id: 'snooze',
      label: '5분 후',
      type: 'snooze',
    });

    return buttons;
  }

  /**
   * Perform monitoring check
   */
  private async performMonitoringCheck(userId: string): Promise<void> {
    const monitoring = this.activeMonitoring.get(userId);
    if (!monitoring || !monitoring.isActive) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Check if within monitoring hours
    const settings = monitoring.config.settings;
    const isMorningWindow =
      settings.morningEnabled &&
      currentHour >= settings.morningStartHour &&
      currentHour < settings.morningEndHour;

    const isEveningWindow =
      settings.eveningEnabled &&
      currentHour >= settings.eveningStartHour &&
      currentHour < settings.eveningEndHour;

    const isDayToMonitor = settings.daysToMonitor.includes(currentDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);

    if (!isDayToMonitor || (!isMorningWindow && !isEveningWindow)) {
      return;
    }

    // Generate and send alert
    const alert = await this.generateIntegratedAlert(userId, now);
    if (alert) {
      await this.sendIntegratedNotification(alert);

      // Update last check time
      this.activeMonitoring.set(userId, {
        ...monitoring,
        lastCheck: now,
      });
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const integratedAlertService = new IntegratedAlertService();
export default integratedAlertService;
