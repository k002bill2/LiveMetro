/**
 * LiveMetro Cloud Functions
 * Email notification service using SendGrid
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  onCall,
  HttpsError,
  FunctionsErrorCode,
} from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { emailService } from './services/emailService';
import { getUserById, isEmailNotificationEnabled } from './services/userService';
import {
  verifyKakaoAccessToken,
  upsertKakaoFirebaseUser,
  KakaoAuthError,
  KakaoAuthErrorKind,
} from './services/kakaoAuthService';
import {
  NotificationType,
  EmailNotificationRequest,
  EmailNotificationResponse,
  KakaoLoginRequest,
  KakaoLoginResponse,
} from './types';

// Kakao Developers "앱 ID" (numeric). Read at deploy time from functions/.env
// via firebase-functions params. Used to reject tokens minted for other apps.
// A required param blocks CI `firebase deploy --non-interactive` when
// functions/.env is absent; declare it optional (default '') and enforce
// presence with a runtime guard in the handler instead.
const kakaoAppId = defineString('KAKAO_APP_ID', { default: '' });

// KakaoAuthError kind → callable HttpsError (code + Korean user message).
// Unknown errors are masked to 'internal' by the handler (never reach this map).
const KAKAO_ERROR_MAP: Record<
  KakaoAuthErrorKind,
  { code: FunctionsErrorCode; message: string }
> = {
  'invalid-token': {
    code: 'unauthenticated',
    message: 'Kakao 인증에 실패했습니다. 다시 로그인해 주세요.',
  },
  'app-mismatch': {
    code: 'permission-denied',
    message: '허용되지 않은 Kakao 앱입니다.',
  },
  timeout: {
    code: 'deadline-exceeded',
    message: 'Kakao 서버 응답이 지연되었습니다. 잠시 후 다시 시도해 주세요.',
  },
  'kakao-unavailable': {
    code: 'unavailable',
    message: 'Kakao 서버에 일시적으로 연결할 수 없습니다.',
  },
  'malformed-response': {
    code: 'internal',
    message: 'Kakao 로그인 처리 중 오류가 발생했습니다.',
  },
};

// Export notification triggers
export {
  onDelayReportVerified,
  onCertificateCreated,
  onBadgeEarned,
  sendCommuteReminders,
  cleanupExpiredTokens,
  registerFcmToken,
  unregisterFcmToken,
} from './triggers/notificationTriggers';

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

/**
 * Callable (v2) that exchanges a Kakao access token for a Firebase custom token.
 *
 * Called BEFORE the user has a Firebase session, so it requires no auth. The
 * access token is verified server-side against kapi.kakao.com (rejecting tokens
 * issued for a different Kakao app), then a `kakao:{id}` user is upserted and a
 * custom token minted. Admin is already initialized by userService's import.
 *
 * Usage from client:
 *   const kakaoLogin = httpsCallable(functions, 'kakaoLogin');
 *   const { data } = await kakaoLogin({ accessToken });
 *   await signInWithCustomToken(auth, data.token);
 */
export const kakaoLogin = onCall<KakaoLoginRequest>(
  { region: 'asia-northeast3' },
  async (request): Promise<KakaoLoginResponse> => {
    const accessToken = request.data?.accessToken;
    if (
      typeof accessToken !== 'string' ||
      accessToken.length === 0 ||
      accessToken.length > 1024
    ) {
      throw new HttpsError('invalid-argument', '액세스 토큰이 필요합니다.');
    }

    // KAKAO_APP_ID is optional at deploy time (see defineString above) so CI can
    // deploy without functions/.env; reject calls until it is actually configured.
    if (kakaoAppId.value() === '') {
      throw new HttpsError(
        'failed-precondition',
        '카카오 로그인이 아직 구성되지 않았습니다.',
      );
    }

    try {
      const profile = await verifyKakaoAccessToken(
        accessToken,
        kakaoAppId.value(),
        fetch
      );
      const uid = await upsertKakaoFirebaseUser(admin.auth(), profile);
      const token = await admin.auth().createCustomToken(uid, { provider: 'KAKAO' });
      return { token, profile: { nickname: profile.nickname } };
    } catch (error) {
      if (error instanceof KakaoAuthError) {
        const mapped = KAKAO_ERROR_MAP[error.kind];
        throw new HttpsError(mapped.code, mapped.message);
      }
      // Mask unknown errors; log only a message (never the token/response body).
      console.error(
        'kakaoLogin unexpected error:',
        error instanceof Error ? error.message : 'unknown'
      );
      throw new HttpsError('internal', 'Kakao 로그인 처리 중 오류가 발생했습니다.');
    }
  }
);
