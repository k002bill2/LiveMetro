/**
 * Email Notification Service - Frontend
 * Handles communication with Firebase Cloud Functions for email notifications
 */

import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from '@/services/firebase/config';

// Notification types (matching backend)
export enum NotificationType {
  DELAY_ALERT = 'DELAY_ALERT',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT',
  SERVICE_UPDATE = 'SERVICE_UPDATE',
  ARRIVAL_REMINDER = 'ARRIVAL_REMINDER',
  COMMUTE_REMINDER = 'COMMUTE_REMINDER',
}

// Email notification data payload
export interface EmailNotificationData {
  stationName?: string;
  lineName?: string;
  delayMinutes?: number;
  reason?: string;
  message?: string;
  affectedLines?: string[];
  arrivalTime?: string;
}

// Request payload
interface EmailNotificationRequest {
  type: NotificationType;
  data: EmailNotificationData;
}

// Response from Cloud Function
interface EmailNotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuration check response
interface ConfigurationCheckResponse {
  configured: boolean;
  error?: string;
}

// Cloud Function references
const sendEmailNotificationFn = httpsCallable<
  EmailNotificationRequest,
  EmailNotificationResponse
>(functions, 'sendEmailNotification');

const testEmailConfigurationFn = httpsCallable<unknown, ConfigurationCheckResponse>(
  functions,
  'testEmailConfiguration'
);

/**
 * Email Notification Service
 * Singleton service for sending email notifications via Cloud Functions
 */
class EmailNotificationService {
  /**
   * Check if SendGrid is properly configured
   */
  async checkConfiguration(): Promise<{
    configured: boolean;
    error?: string;
  }> {
    try {
      const result: HttpsCallableResult<ConfigurationCheckResponse> =
        await testEmailConfigurationFn({});
      return result.data;
    } catch (error) {
      console.error('Failed to check email configuration:', error);
      return {
        configured: false,
        error: error instanceof Error ? error.message : '설정 확인 실패',
      };
    }
  }

  /**
   * Send a test email to verify the service is working
   */
  async sendTestEmail(): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.SERVICE_UPDATE,
        data: {
          message:
            '이것은 LiveMetro 이메일 알림 테스트입니다. 이 메일을 받으셨다면 이메일 알림이 정상적으로 설정되었습니다.',
        },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send test email:', error);
      return false;
    }
  }

  /**
   * Send delay alert email
   */
  async sendDelayAlert(
    stationName: string,
    lineName: string,
    delayMinutes: number,
    reason?: string
  ): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.DELAY_ALERT,
        data: {
          stationName,
          lineName,
          delayMinutes,
          reason,
        },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send delay alert email:', error);
      return false;
    }
  }

  /**
   * Send emergency alert email
   */
  async sendEmergencyAlert(
    message: string,
    affectedLines?: string[]
  ): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.EMERGENCY_ALERT,
        data: {
          message,
          affectedLines,
        },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send emergency alert email:', error);
      return false;
    }
  }

  /**
   * Send service update email
   */
  async sendServiceUpdate(message: string): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.SERVICE_UPDATE,
        data: { message },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send service update email:', error);
      return false;
    }
  }

  /**
   * Send arrival reminder email
   */
  async sendArrivalReminder(
    stationName: string,
    lineName: string,
    arrivalTime: string
  ): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.ARRIVAL_REMINDER,
        data: {
          stationName,
          lineName,
          arrivalTime,
        },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send arrival reminder email:', error);
      return false;
    }
  }

  /**
   * Send commute reminder email
   */
  async sendCommuteReminder(
    stationName: string,
    lineName: string,
    arrivalTime: string
  ): Promise<boolean> {
    try {
      const result = await sendEmailNotificationFn({
        type: NotificationType.COMMUTE_REMINDER,
        data: {
          stationName,
          lineName,
          arrivalTime,
        },
      });
      return result.data.success;
    } catch (error) {
      console.error('Failed to send commute reminder email:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
