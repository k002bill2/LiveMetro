/**
 * Delay Response Alert Service (Scenario 3)
 * Detects delays on user's commute route and suggests adjusted departure time
 */

import { notificationService, NotificationType } from './notificationService';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';
import { modelService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import {
  getDayOfWeek,
  parseTimeToMinutes,
  formatMinutesToTime,
  FrequentRoute,
} from '@/models/pattern';
import { generateAlertId } from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface RouteDelayStatus {
  readonly hasDelays: boolean;
  readonly affectedLines: readonly string[];
  readonly maxDelayMinutes: number;
  readonly adjustedDepartureTime: string;
  readonly originalDepartureTime: string;
  readonly recommendation: string;
  readonly delayDetails: readonly DelayDetail[];
}

export interface DelayDetail {
  readonly lineId: string;
  readonly lineName: string;
  readonly delayMinutes: number;
  readonly reason: string;
  readonly stationName: string;
}

export interface DelayResponseAlert {
  readonly id: string;
  readonly userId: string;
  readonly originalDepartureTime: string;
  readonly adjustedDepartureTime: string;
  readonly maxDelayMinutes: number;
  readonly affectedLines: readonly string[];
  readonly recommendation: string;
  readonly createdAt: Date;
}

export interface DelayMonitoringConfig {
  readonly userId: string;
  readonly route: FrequentRoute;
  readonly pollingIntervalSeconds: number;
  readonly bufferMinutes: number;
}

interface MonitoringSession {
  readonly id: string;
  readonly config: DelayMonitoringConfig;
  readonly intervalId: ReturnType<typeof setInterval> | null;
  readonly lastAlert: Date | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_POLLING_INTERVAL_SECONDS = 60;
const DEFAULT_BUFFER_MINUTES = 10;
const MIN_DELAY_THRESHOLD_MINUTES = 3;
const ALERT_COOLDOWN_MINUTES = 30;

// ============================================================================
// Service
// ============================================================================

class DelayResponseAlertService {
  private activeSessions: Map<string, MonitoringSession> = new Map();

  /**
   * Check delays on user's commute route
   */
  async checkRouteDelays(
    userId: string,
    route: FrequentRoute
  ): Promise<RouteDelayStatus> {
    try {
      // Get delays for all lines in the route
      const delayDetails: DelayDetail[] = [];
      let maxDelayMinutes = 0;
      const affectedLines: string[] = [];

      for (const lineId of route.lineIds) {
        const delays = await this.getLineDelays(lineId, route.departureStationName);

        for (const delay of delays) {
          if (delay.delayMinutes >= MIN_DELAY_THRESHOLD_MINUTES) {
            delayDetails.push(delay);
            if (delay.delayMinutes > maxDelayMinutes) {
              maxDelayMinutes = delay.delayMinutes;
            }
            if (!affectedLines.includes(lineId)) {
              affectedLines.push(lineId);
            }
          }
        }
      }

      // Get predicted departure time
      const logs = await commuteLogService.getRecentLogsForAnalysis(userId);
      const dayOfWeek = getDayOfWeek(new Date());
      const prediction = await modelService.predict(logs, dayOfWeek);

      const originalDepartureTime = prediction.predictedDepartureTime;

      // Calculate adjusted departure time
      const adjustedDepartureTime = this.calculateAdjustedDeparture(
        originalDepartureTime,
        maxDelayMinutes,
        DEFAULT_BUFFER_MINUTES
      );

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        maxDelayMinutes,
        affectedLines,
        adjustedDepartureTime
      );

      return {
        hasDelays: delayDetails.length > 0,
        affectedLines,
        maxDelayMinutes,
        adjustedDepartureTime,
        originalDepartureTime,
        recommendation,
        delayDetails,
      };
    } catch {
      // Return no delays on error
      return {
        hasDelays: false,
        affectedLines: [],
        maxDelayMinutes: 0,
        adjustedDepartureTime: '08:00',
        originalDepartureTime: '08:00',
        recommendation: '지연 정보를 확인할 수 없습니다.',
        delayDetails: [],
      };
    }
  }

  /**
   * Calculate adjusted departure time based on delay
   */
  calculateAdjustedDeparture(
    normalTime: string,
    delayMinutes: number,
    bufferMinutes: number
  ): string {
    const normalMinutes = parseTimeToMinutes(normalTime);
    const adjustedMinutes = normalMinutes - delayMinutes - bufferMinutes;

    // Handle wraparound
    const finalMinutes = adjustedMinutes < 0 ? adjustedMinutes + 24 * 60 : adjustedMinutes;
    return formatMinutesToTime(finalMinutes);
  }

  /**
   * Start monitoring route for delays
   */
  startDelayMonitoring(config: DelayMonitoringConfig): string {
    const sessionId = generateAlertId();

    const intervalId = setInterval(
      () => this.checkAndNotify(sessionId),
      (config.pollingIntervalSeconds || DEFAULT_POLLING_INTERVAL_SECONDS) * 1000
    );

    const session: MonitoringSession = {
      id: sessionId,
      config,
      intervalId,
      lastAlert: null,
    };

    this.activeSessions.set(sessionId, session);

    // Initial check
    this.checkAndNotify(sessionId);

    return sessionId;
  }

  /**
   * Stop delay monitoring
   */
  stopDelayMonitoring(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.intervalId) {
      clearInterval(session.intervalId);
    }

    this.activeSessions.delete(sessionId);
    return true;
  }

  /**
   * Stop all monitoring for a user
   */
  stopAllMonitoring(userId: string): number {
    let stoppedCount = 0;

    for (const [sessionId, session] of this.activeSessions) {
      if (session.config.userId === userId) {
        this.stopDelayMonitoring(sessionId);
        stoppedCount++;
      }
    }

    return stoppedCount;
  }

  /**
   * Clean up all resources - call when service is no longer needed
   */
  destroy(): void {
    for (const session of this.activeSessions.values()) {
      if (session.intervalId) {
        clearInterval(session.intervalId);
      }
    }
    this.activeSessions.clear();
  }

  /**
   * Subscribe to route delays (one-time callback approach)
   */
  async subscribeToRouteDelays(
    route: FrequentRoute,
    callback: (status: RouteDelayStatus) => void,
    userId: string
  ): Promise<() => void> {
    const sessionId = generateAlertId();

    const checkDelays = async (): Promise<void> => {
      const status = await this.checkRouteDelays(userId, route);
      callback(status);
    };

    // Initial check
    await checkDelays();

    // Set up interval
    const intervalId = setInterval(checkDelays, DEFAULT_POLLING_INTERVAL_SECONDS * 1000);

    // Store session for cleanup
    this.activeSessions.set(sessionId, {
      id: sessionId,
      config: {
        userId,
        route,
        pollingIntervalSeconds: DEFAULT_POLLING_INTERVAL_SECONDS,
        bufferMinutes: DEFAULT_BUFFER_MINUTES,
      },
      intervalId,
      lastAlert: null,
    });

    // Return unsubscribe function
    return () => {
      this.stopDelayMonitoring(sessionId);
    };
  }

  /**
   * Send delay response alert
   */
  async sendDelayAlert(
    userId: string,
    status: RouteDelayStatus
  ): Promise<DelayResponseAlert | null> {
    if (!status.hasDelays) {
      return null;
    }

    try {
      const title = '지연 알림';
      const body = status.recommendation;

      await notificationService.sendLocalNotification({
        type: NotificationType.DELAY_ALERT,
        title,
        body,
        data: {
          userId,
          maxDelayMinutes: status.maxDelayMinutes,
          affectedLines: status.affectedLines,
          adjustedDepartureTime: status.adjustedDepartureTime,
        },
        priority: 'high',
      });

      const alert: DelayResponseAlert = {
        id: generateAlertId(),
        userId,
        originalDepartureTime: status.originalDepartureTime,
        adjustedDepartureTime: status.adjustedDepartureTime,
        maxDelayMinutes: status.maxDelayMinutes,
        affectedLines: status.affectedLines,
        recommendation: status.recommendation,
        createdAt: new Date(),
      };

      return alert;
    } catch {
      return null;
    }
  }

  /**
   * Get active monitoring sessions
   */
  getActiveSessions(): MonitoringSession[] {
    return Array.from(this.activeSessions.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get delays for a specific line
   */
  private async getLineDelays(
    lineId: string,
    stationName: string
  ): Promise<DelayDetail[]> {
    try {
      const arrivals = await seoulSubwayApi.getRealtimeArrival(stationName);
      const delays: DelayDetail[] = [];

      for (const arrival of arrivals) {
        // Check if this is the right line
        const isCorrectLine =
          arrival.subwayId === lineId || arrival.trainLineNm?.includes(lineId);
        if (!isCorrectLine) continue;

        // Check for delay keywords
        const message = arrival.arvlMsg2 || '';
        const delayInfo = this.extractDelayInfo(message);

        if (delayInfo.hasDelay) {
          delays.push({
            lineId,
            lineName: arrival.trainLineNm || lineId,
            delayMinutes: delayInfo.minutes,
            reason: delayInfo.reason,
            stationName: arrival.statnNm || stationName,
          });
        }
      }

      return delays;
    } catch {
      return [];
    }
  }

  /**
   * Extract delay information from message
   */
  private extractDelayInfo(message: string): {
    hasDelay: boolean;
    minutes: number;
    reason: string;
  } {
    const delayKeywords = ['지연', '운행지연', '서행', '운행중지', '장애', '사고'];
    const hasDelay = delayKeywords.some((kw) => message.includes(kw));

    if (!hasDelay) {
      return { hasDelay: false, minutes: 0, reason: '' };
    }

    // Try to extract minutes
    const minuteMatch = message.match(/(\d+)\s*분/);
    const minutes = minuteMatch?.[1] ? parseInt(minuteMatch[1], 10) : 5;

    // Determine reason
    let reason = '운행 지연';
    if (message.includes('사고')) reason = '사고 발생';
    else if (message.includes('장애') || message.includes('고장')) reason = '시설 장애';
    else if (message.includes('혼잡')) reason = '역 혼잡';
    else if (message.includes('점검')) reason = '시설 점검';

    return { hasDelay: true, minutes, reason };
  }

  /**
   * Generate human-readable recommendation
   */
  private generateRecommendation(
    delayMinutes: number,
    affectedLines: readonly string[],
    adjustedTime: string
  ): string {
    if (delayMinutes === 0 || affectedLines.length === 0) {
      return '현재 지연 없이 정상 운행 중입니다.';
    }

    const lineText = affectedLines.join(', ');

    if (delayMinutes >= 15) {
      return `⚠️ ${lineText} 노선 약 ${delayMinutes}분 지연 중입니다. ${adjustedTime}까지 출발하세요!`;
    } else if (delayMinutes >= 5) {
      return `${lineText} 노선 약 ${delayMinutes}분 지연 중입니다. 여유 있게 ${adjustedTime}에 출발하세요.`;
    } else {
      return `${lineText} 노선 약간의 지연이 있습니다. 참고해주세요.`;
    }
  }

  /**
   * Check for delays and notify if needed
   */
  private async checkAndNotify(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Check cooldown
    if (session.lastAlert) {
      const timeSinceLastAlert = Date.now() - session.lastAlert.getTime();
      if (timeSinceLastAlert < ALERT_COOLDOWN_MINUTES * 60 * 1000) {
        return;
      }
    }

    const status = await this.checkRouteDelays(
      session.config.userId,
      session.config.route
    );

    if (status.hasDelays && status.maxDelayMinutes >= MIN_DELAY_THRESHOLD_MINUTES) {
      await this.sendDelayAlert(session.config.userId, status);

      // Update last alert time
      this.activeSessions.set(sessionId, {
        ...session,
        lastAlert: new Date(),
      });
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const delayResponseAlertService = new DelayResponseAlertService();
export default delayResponseAlertService;
