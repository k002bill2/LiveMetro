/**
 * Smart Notification Service
 * Schedules and manages predictive notifications based on commute patterns
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  SmartNotificationSettings,
  PredictedCommute,
  DayOfWeek,
  getDayOfWeek,
  isWeekday,
  parseTimeToMinutes,
  getCurrentTimeString,
  createDefaultSmartNotificationSettings,
  DAY_NAMES_KO,
} from '@/models/pattern';
import { patternAnalysisService } from './patternAnalysisService';
import { delayReportService } from '@/services/delay/delayReportService';

const SETTINGS_COLLECTION = 'smartNotificationSettings';

// ============================================================================
// Types
// ============================================================================

export interface SmartNotification {
  id: string;
  title: string;
  body: string;
  scheduledTime: string;
  prediction: PredictedCommute;
  hasDelays: boolean;
  affectedLines: string[];
}

export interface DelayCheckResult {
  hasDelays: boolean;
  affectedLines: string[];
  maxDelayMinutes: number;
  summary: string;
}

// ============================================================================
// Service
// ============================================================================

class SmartNotificationService {
  /**
   * Get smart notification settings for a user
   */
  async getSettings(userId: string): Promise<SmartNotificationSettings> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
    const docSnap = await getDoc(settingsRef);

    if (!docSnap.exists()) {
      return createDefaultSmartNotificationSettings();
    }

    return docSnap.data() as SmartNotificationSettings;
  }

  /**
   * Update smart notification settings
   */
  async updateSettings(
    userId: string,
    settings: SmartNotificationSettings
  ): Promise<void> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
    await setDoc(settingsRef, settings);
  }

  /**
   * Enable smart notifications
   */
  async enable(userId: string): Promise<void> {
    const settings = await this.getSettings(userId);
    await this.updateSettings(userId, { ...settings, enabled: true });
  }

  /**
   * Disable smart notifications
   */
  async disable(userId: string): Promise<void> {
    const settings = await this.getSettings(userId);
    await this.updateSettings(userId, { ...settings, enabled: false });
  }

  /**
   * Check if smart notifications are enabled
   */
  async isEnabled(userId: string): Promise<boolean> {
    const settings = await this.getSettings(userId);
    return settings.enabled;
  }

  /**
   * Get today's smart notification if applicable
   */
  async getTodayNotification(userId: string): Promise<SmartNotification | null> {
    const settings = await this.getSettings(userId);

    if (!settings.enabled) {
      return null;
    }

    const dayOfWeek = getDayOfWeek(new Date());

    // Check if weekends are excluded
    if (!settings.includeWeekends && !isWeekday(dayOfWeek)) {
      return null;
    }

    // Get prediction for today
    const prediction = await patternAnalysisService.predictCommute(userId);

    if (!prediction || prediction.confidence < 0.5) {
      return null;
    }

    // Check for delays on relevant lines
    const delayCheck = await this.checkDelaysForPrediction(prediction, settings);

    // Build notification
    return this.buildNotification(prediction, delayCheck, settings);
  }

  /**
   * Check if it's time to show a notification
   */
  async shouldShowNotification(
    userId: string,
    currentTime?: string
  ): Promise<boolean> {
    const settings = await this.getSettings(userId);

    if (!settings.enabled) {
      return false;
    }

    const now = currentTime || getCurrentTimeString();
    const prediction = await patternAnalysisService.predictCommute(userId);

    if (!prediction) {
      return false;
    }

    // Check custom alert times first
    const dayOfWeek = getDayOfWeek(new Date());
    const customAlert = settings.customAlertTimes.find(
      (a) => a.dayOfWeek === dayOfWeek && a.enabled
    );

    const targetTime = customAlert?.alertTime || prediction.suggestedAlertTime;
    const nowMinutes = parseTimeToMinutes(now);
    const targetMinutes = parseTimeToMinutes(targetTime);

    // Show if within 5 minutes of target time
    return Math.abs(nowMinutes - targetMinutes) <= 5;
  }

  /**
   * Get notification schedule for the week
   */
  async getWeekSchedule(
    userId: string
  ): Promise<{ date: string; dayOfWeek: DayOfWeek; alertTime: string | null }[]> {
    const settings = await this.getSettings(userId);
    const predictions = await patternAnalysisService.getWeekPredictions(
      userId,
      settings.includeWeekends
    );

    return predictions.map((pred) => {
      const customAlert = settings.customAlertTimes.find(
        (a) => a.dayOfWeek === pred.dayOfWeek && a.enabled
      );

      return {
        date: pred.date,
        dayOfWeek: pred.dayOfWeek,
        alertTime: customAlert?.alertTime || pred.suggestedAlertTime,
      };
    });
  }

  /**
   * Set custom alert time for a day
   */
  async setCustomAlertTime(
    userId: string,
    dayOfWeek: DayOfWeek,
    alertTime: string,
    enabled: boolean = true
  ): Promise<void> {
    const settings = await this.getSettings(userId);

    // Remove existing custom alert for this day
    const filteredAlerts = settings.customAlertTimes.filter(
      (a) => a.dayOfWeek !== dayOfWeek
    );

    // Add new one
    const newCustomAlertTimes = [
      ...filteredAlerts,
      { dayOfWeek, alertTime, enabled },
    ];

    await this.updateSettings(userId, {
      ...settings,
      customAlertTimes: newCustomAlertTimes,
    });
  }

  /**
   * Remove custom alert time for a day
   */
  async removeCustomAlertTime(
    userId: string,
    dayOfWeek: DayOfWeek
  ): Promise<void> {
    const settings = await this.getSettings(userId);

    const filteredAlerts = settings.customAlertTimes.filter(
      (a) => a.dayOfWeek !== dayOfWeek
    );

    await this.updateSettings(userId, {
      ...settings,
      customAlertTimes: filteredAlerts,
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check for delays affecting the predicted commute
   */
  private async checkDelaysForPrediction(
    prediction: PredictedCommute,
    settings: SmartNotificationSettings
  ): Promise<DelayCheckResult> {
    try {
      // Get lines to check (from settings or from prediction)
      const linesToCheck =
        settings.checkDelaysFor.length > 0
          ? settings.checkDelaysFor
          : prediction.route.lineIds;

      // Get active delay reports for these lines
      const reports = await delayReportService.getActiveReports(50);

      const affectedReports = reports.filter((r) =>
        linesToCheck.includes(r.lineId)
      );

      if (affectedReports.length === 0) {
        return {
          hasDelays: false,
          affectedLines: [],
          maxDelayMinutes: 0,
          summary: '현재 지연 없음',
        };
      }

      const affectedLines = [...new Set(affectedReports.map((r) => r.lineId))];
      const maxDelay = Math.max(
        ...affectedReports.map((r) => r.estimatedDelayMinutes || 0)
      );

      const summary =
        affectedLines.length === 1
          ? `${affectedLines[0]}호선 약 ${maxDelay}분 지연`
          : `${affectedLines.length}개 노선 지연 (최대 ${maxDelay}분)`;

      return {
        hasDelays: true,
        affectedLines,
        maxDelayMinutes: maxDelay,
        summary,
      };
    } catch (error) {
      console.error('Error checking delays:', error);
      return {
        hasDelays: false,
        affectedLines: [],
        maxDelayMinutes: 0,
        summary: '지연 정보 확인 불가',
      };
    }
  }

  /**
   * Build a smart notification
   */
  private buildNotification(
    prediction: PredictedCommute,
    delayCheck: DelayCheckResult,
    settings: SmartNotificationSettings
  ): SmartNotification {
    const dayName = DAY_NAMES_KO[prediction.dayOfWeek];
    const route = prediction.route;

    let title: string;
    let body: string;

    if (delayCheck.hasDelays) {
      title = `${dayName} 출근 알림 - 지연 발생`;
      body = `${route.departureStationName} → ${route.arrivalStationName}\n예상 출발: ${prediction.predictedDepartureTime}\n${delayCheck.summary}`;
    } else {
      title = `${dayName} 출근 알림`;
      body = `${route.departureStationName} → ${route.arrivalStationName}\n예상 출발: ${prediction.predictedDepartureTime}\n현재 정상 운행 중`;
    }

    // Determine scheduled time
    const customAlert = settings.customAlertTimes.find(
      (a) => a.dayOfWeek === prediction.dayOfWeek && a.enabled
    );
    const scheduledTime = customAlert?.alertTime || prediction.suggestedAlertTime;

    return {
      id: `smart-${prediction.date}-${prediction.dayOfWeek}`,
      title,
      body,
      scheduledTime,
      prediction,
      hasDelays: delayCheck.hasDelays,
      affectedLines: delayCheck.affectedLines,
    };
  }
}

export const smartNotificationService = new SmartNotificationService();
export default smartNotificationService;
