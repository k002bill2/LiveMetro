/**
 * LiveMetro Cloud Functions
 * Email notification service using SendGrid
 */

import * as functions from 'firebase-functions';
import { emailService } from './services/emailService';
import { getUserById, isEmailNotificationEnabled } from './services/userService';
import {
  NotificationType,
  EmailNotificationRequest,
  EmailNotificationResponse,
} from './types';

/**
 * Callable function to send email notifications
 *
 * Usage from client:
 * const sendEmail = httpsCallable(functions, 'sendEmailNotification');
 * await sendEmail({ type: 'DELAY_ALERT', data: { ... } });
 */
export const sendEmailNotification = functions
  .region('asia-northeast3') // Seoul region
  .https.onCall(
    async (
      data: EmailNotificationRequest,
      context: functions.https.CallableContext
    ): Promise<EmailNotificationResponse> => {
      // 1. Authentication check
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      const uid = context.auth.uid;

      // 2. Validate request data
      if (!data || !data.type) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '알림 타입이 필요합니다.'
        );
      }

      // Validate notification type
      if (!Object.values(NotificationType).includes(data.type)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '유효하지 않은 알림 타입입니다.'
        );
      }

      // 3. Check if email notifications are enabled for this user
      const isEnabled = await isEmailNotificationEnabled(uid);
      if (!isEnabled) {
        return {
          success: false,
          error: '이메일 알림이 비활성화되어 있습니다.',
        };
      }

      // 4. Get user data
      const user = await getUserById(uid);
      if (!user || !user.email) {
        return {
          success: false,
          error: '사용자 이메일을 찾을 수 없습니다.',
        };
      }

      // 5. Send email
      const result = await emailService.sendNotification(
        user.email,
        data.type,
        data.data || {}
      );

      // 6. Log the result
      if (result.success) {
        console.log(
          `Email sent successfully to ${user.email} (type: ${data.type}, messageId: ${result.messageId})`
        );
      } else {
        console.error(
          `Email send failed for ${user.email} (type: ${data.type}, error: ${result.error})`
        );
      }

      return result;
    }
  );

/**
 * Test function to verify SendGrid configuration
 * Only callable by authenticated users
 */
export const testEmailConfiguration = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      _data: unknown,
      context: functions.https.CallableContext
    ): Promise<{ configured: boolean; error?: string }> => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      try {
        const config = functions.config();
        const hasApiKey = !!config.sendgrid?.apikey;
        const hasSender = !!config.sendgrid?.sender;

        if (!hasApiKey) {
          return {
            configured: false,
            error: 'SendGrid API 키가 설정되지 않았습니다.',
          };
        }

        if (!hasSender) {
          return {
            configured: false,
            error: '발신자 이메일이 설정되지 않았습니다.',
          };
        }

        return { configured: true };
      } catch (error) {
        return {
          configured: false,
          error: error instanceof Error ? error.message : '설정 확인 실패',
        };
      }
    }
  );
