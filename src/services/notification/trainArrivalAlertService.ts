/**
 * Train Arrival Alert Service (Scenario 2)
 * Monitors real-time train arrivals and sends notifications when target train is approaching
 */

import { notificationService, NotificationType } from './notificationService';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';
import { modelService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { getDayOfWeek, parseTimeToMinutes, formatMinutesToTime } from '@/models/pattern';
import {
  TrainArrivalConfig,
  OptimalTrain,
  AlternativeTrain,
  generateAlertId,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface TrainArrivalAlert {
  readonly id: string;
  readonly userId: string;
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly targetTime: string;
  readonly alertMinutesBefore: number;
  readonly isActive: boolean;
}

export interface MonitoringSession {
  readonly alertId: string;
  readonly config: TrainArrivalConfig;
  readonly intervalId: ReturnType<typeof setInterval> | null;
  readonly startedAt: Date;
  readonly lastPolled: Date | null;
}

export interface TrainArrivalStatus {
  readonly stationName: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly trainNumber: string;
  readonly arrivalTime: string;
  readonly arrivalMinutes: number;
  readonly finalDestination: string;
  readonly status: 'on_time' | 'delayed' | 'approaching' | 'arrived';
}

// ============================================================================
// Constants
// ============================================================================

const MIN_POLLING_INTERVAL_SECONDS = 30; // Seoul API requirement

// ============================================================================
// Service
// ============================================================================

class TrainArrivalAlertService {
  private activeSessions: Map<string, MonitoringSession> = new Map();
  private alertsSent: Set<string> = new Set(); // Track sent alerts to avoid duplicates

  /**
   * Start monitoring for a specific train arrival
   */
  async startMonitoring(
    _userId: string,
    config: TrainArrivalConfig
  ): Promise<{ success: boolean; alertId: string | null; error?: string }> {
    try {
      // Validate polling interval
      const pollingSeconds = Math.max(
        config.pollingIntervalSeconds,
        MIN_POLLING_INTERVAL_SECONDS
      );

      const alertId = generateAlertId();

      // Create monitoring session
      const session: MonitoringSession = {
        alertId,
        config: {
          ...config,
          pollingIntervalSeconds: pollingSeconds,
        },
        intervalId: null,
        startedAt: new Date(),
        lastPolled: null,
      };

      // Start polling
      const intervalId = setInterval(
        () => this.pollAndNotify(alertId),
        pollingSeconds * 1000
      );

      // Update session with interval ID
      this.activeSessions.set(alertId, {
        ...session,
        intervalId,
      });

      // Initial poll
      await this.pollAndNotify(alertId);

      return { success: true, alertId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, alertId: null, error: errorMessage };
    }
  }

  /**
   * Stop monitoring for a specific alert
   */
  stopMonitoring(alertId: string): boolean {
    const session = this.activeSessions.get(alertId);
    if (!session) {
      return false;
    }

    if (session.intervalId) {
      clearInterval(session.intervalId);
    }

    this.activeSessions.delete(alertId);
    this.alertsSent.delete(alertId);
    return true;
  }

  /**
   * Stop all monitoring sessions for a user
   */
  stopAllMonitoring(userId: string): number {
    let stoppedCount = 0;

    for (const [alertId, session] of this.activeSessions) {
      if (session.config.userId === userId) {
        this.stopMonitoring(alertId);
        stoppedCount++;
      }
    }

    return stoppedCount;
  }

  /**
   * Clean up all resources - call when service is no longer needed
   */
  destroy(): void {
    // Stop all sessions regardless of user
    for (const [alertId, session] of this.activeSessions) {
      if (session.intervalId) {
        clearInterval(session.intervalId);
      }
    }
    this.activeSessions.clear();
    this.alertsSent.clear();
  }

  /**
   * Calculate optimal train based on commute pattern
   */
  async calculateOptimalTrain(
    userId: string,
    stationName: string,
    lineId: string,
    direction: 'up' | 'down',
    date: Date = new Date()
  ): Promise<OptimalTrain | null> {
    try {
      // Get user's commute logs and prediction
      const logs = await commuteLogService.getRecentLogsForAnalysis(userId);
      if (logs.length === 0) {
        return null;
      }

      const dayOfWeek = getDayOfWeek(date);
      const prediction = await modelService.predict(logs, dayOfWeek);

      // Get real-time arrivals
      const arrivals = await seoulSubwayApi.getRealtimeArrival(stationName);

      // Filter by line and direction
      const filteredArrivals = arrivals.filter((arr) => {
        const isCorrectLine = arr.subwayId === lineId || arr.trainLineNm?.includes(lineId);
        const isCorrectDirection = this.matchesDirection(arr.updnLine, direction);
        return isCorrectLine && isCorrectDirection;
      });

      if (filteredArrivals.length === 0) {
        // Fallback to prediction time
        return {
          scheduledTime: prediction.predictedDepartureTime,
          direction,
          confidence: prediction.confidence * 0.5, // Lower confidence without real-time data
          alternativeTrains: [],
        };
      }

      // Find the optimal train closest to predicted departure time
      const targetMinutes = parseTimeToMinutes(prediction.predictedDepartureTime);
      let optimalArrival = filteredArrivals[0];
      let minDiff = Infinity;

      for (const arrival of filteredArrivals) {
        const arrivalMinutes = this.extractArrivalMinutes(arrival.arvlMsg2 || '');
        const arrivalTime = this.addMinutesToNow(arrivalMinutes);
        const arrivalTimeMinutes = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();
        const diff = Math.abs(arrivalTimeMinutes - targetMinutes);

        if (diff < minDiff) {
          minDiff = diff;
          optimalArrival = arrival;
        }
      }

      // Extract optimal train info
      const optimalMinutes = this.extractArrivalMinutes(optimalArrival?.arvlMsg2 || '');
      const optimalTime = this.addMinutesToNow(optimalMinutes);
      const optimalTimeStr = formatMinutesToTime(
        optimalTime.getHours() * 60 + optimalTime.getMinutes()
      );

      // Find alternative trains
      const alternatives: AlternativeTrain[] = filteredArrivals
        .filter((arr) => arr !== optimalArrival)
        .slice(0, 3)
        .map((arr) => {
          const minutes = this.extractArrivalMinutes(arr.arvlMsg2 || '');
          const time = this.addMinutesToNow(minutes);
          const timeStr = formatMinutesToTime(time.getHours() * 60 + time.getMinutes());
          const diff = minutes - optimalMinutes;
          return {
            scheduledTime: timeStr,
            minutesDifference: diff,
            reason: diff < 0 ? 'earlier' : 'later',
          } as AlternativeTrain;
        });

      return {
        scheduledTime: optimalTimeStr,
        trainNumber: optimalArrival?.btrainNo,
        direction,
        confidence: prediction.confidence,
        alternativeTrains: alternatives,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get current train arrival status
   */
  async getTrainArrivalStatus(
    stationName: string,
    lineId: string,
    direction: 'up' | 'down'
  ): Promise<TrainArrivalStatus[]> {
    try {
      const arrivals = await seoulSubwayApi.getRealtimeArrival(stationName);

      return arrivals
        .filter((arr) => {
          const isCorrectLine = arr.subwayId === lineId || arr.trainLineNm?.includes(lineId);
          const isCorrectDirection = this.matchesDirection(arr.updnLine, direction);
          return isCorrectLine && isCorrectDirection;
        })
        .map((arr) => {
          const minutes = this.extractArrivalMinutes(arr.arvlMsg2 || '');
          const arrivalTime = this.addMinutesToNow(minutes);
          const status = this.determineStatus(arr.arvlMsg2 || '', minutes);

          return {
            stationName,
            lineId,
            direction,
            trainNumber: arr.btrainNo || 'unknown',
            arrivalTime: formatMinutesToTime(
              arrivalTime.getHours() * 60 + arrivalTime.getMinutes()
            ),
            arrivalMinutes: minutes,
            finalDestination: arr.bstatnNm || '',
            status,
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveSessions(): MonitoringSession[] {
    return Array.from(this.activeSessions.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Poll for train arrivals and send notification if needed
   */
  private async pollAndNotify(alertId: string): Promise<void> {
    const session = this.activeSessions.get(alertId);
    if (!session) {
      return;
    }

    try {
      // Get station name from station ID (simplified - in production, use station service)
      const stationName = session.config.stationId; // Assuming stationId is the name

      const statuses = await this.getTrainArrivalStatus(
        stationName,
        session.config.lineId,
        session.config.direction
      );

      // Update last polled time
      this.activeSessions.set(alertId, {
        ...session,
        lastPolled: new Date(),
      });

      // Check if any train is arriving within alert threshold
      for (const status of statuses) {
        if (
          status.arrivalMinutes <= session.config.alertMinutesBefore &&
          status.arrivalMinutes > 0
        ) {
          // Check if we already sent an alert for this
          const alertKey = `${alertId}_${status.trainNumber}_${status.arrivalTime}`;
          if (this.alertsSent.has(alertKey)) {
            continue;
          }

          // Send notification
          await this.sendTrainArrivalNotification(session, status);
          this.alertsSent.add(alertKey);

          // Stop monitoring after successful alert
          this.stopMonitoring(alertId);
          break;
        }
      }
    } catch {
      // Log error but don't stop monitoring
    }
  }

  /**
   * Send train arrival notification
   */
  private async sendTrainArrivalNotification(
    session: MonitoringSession,
    status: TrainArrivalStatus
  ): Promise<void> {
    const title = '열차 도착 알림';
    const body = `${status.finalDestination}행 열차가 ${status.arrivalMinutes}분 후 도착합니다.`;

    await notificationService.sendLocalNotification({
      type: NotificationType.ARRIVAL_REMINDER,
      title,
      body,
      data: {
        trainNumber: status.trainNumber,
        stationId: session.config.stationId,
        lineId: session.config.lineId,
      },
      priority: 'high',
    });
  }

  /**
   * Match direction string to up/down
   */
  private matchesDirection(updnLine: string | undefined, direction: 'up' | 'down'): boolean {
    if (!updnLine) return true; // No direction info, include all

    const upKeywords = ['상행', '내선', '외선'];
    const downKeywords = ['하행'];

    if (direction === 'up') {
      return upKeywords.some((kw) => updnLine.includes(kw));
    } else {
      return downKeywords.some((kw) => updnLine.includes(kw));
    }
  }

  /**
   * Extract arrival minutes from message
   */
  private extractArrivalMinutes(message: string): number {
    // Match patterns like "3분후", "곧 도착", "진입", "도착"
    const minuteMatch = message.match(/(\d+)분/);
    if (minuteMatch?.[1]) {
      return parseInt(minuteMatch[1], 10);
    }

    if (message.includes('곧 도착') || message.includes('진입')) {
      return 1;
    }

    if (message.includes('도착')) {
      return 0;
    }

    return 10; // Default if can't parse
  }

  /**
   * Add minutes to current time
   */
  private addMinutesToNow(minutes: number): Date {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now;
  }

  /**
   * Determine train status from message
   */
  private determineStatus(
    message: string,
    minutes: number
  ): 'on_time' | 'delayed' | 'approaching' | 'arrived' {
    if (message.includes('도착') && !message.includes('곧 도착')) {
      return 'arrived';
    }
    if (minutes <= 1 || message.includes('곧 도착') || message.includes('진입')) {
      return 'approaching';
    }
    if (message.includes('지연')) {
      return 'delayed';
    }
    return 'on_time';
  }
}

// ============================================================================
// Export
// ============================================================================

export const trainArrivalAlertService = new TrainArrivalAlertService();
export default trainArrivalAlertService;
