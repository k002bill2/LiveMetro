/**
 * Notification Triggers
 * Firebase triggers for automatic push notifications
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { pushNotificationService } from '../services/pushNotificationService';
import { tokenManagementService } from '../services/tokenManagementService';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface DelayReport {
  lineId: string;
  lineName: string;
  stationId: string;
  stationName: string;
  delayMinutes: number;
  reason?: string;
  status: string;
  createdAt: admin.firestore.Timestamp;
}

interface DelayCertificate {
  userId: string;
  lineId: string;
  lineName: string;
  stationName: string;
  date: string;
  status: string;
  createdAt: admin.firestore.Timestamp;
}

interface UserTrustProfile {
  userId: string;
  trustScore: number;
  trustLevel: string;
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    earnedAt: admin.firestore.Timestamp;
  }[];
}

interface CommuteSchedule {
  userId: string;
  stationName: string;
  departureTime: string;
  daysOfWeek: number[];
  notifyMinutesBefore: number;
  enabled: boolean;
}

// ============================================================================
// Delay Report Triggers
// ============================================================================

/**
 * Trigger when a delay report is verified
 * Notifies users subscribed to that line
 */
export const onDelayReportVerified = functions
  .region('asia-northeast3')
  .firestore.document('delay_reports/{reportId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as DelayReport;
    const after = change.after.data() as DelayReport;

    // Only trigger when status changes to verified
    if (before.status === after.status || after.status !== 'verified') {
      return null;
    }

    // Check if delay is significant (>= 5 minutes)
    if (after.delayMinutes < 5) {
      console.log(`Delay too small (${after.delayMinutes}min), skipping notification`);
      return null;
    }

    // Get users subscribed to this line's topic
    const topicName = `line_${after.lineId}`;

    try {
      const result = await pushNotificationService.send(
        { type: 'topic', topic: topicName },
        {
          title: `⚠️ ${after.lineName} 지연 알림`,
          body: `${after.stationName} 부근 약 ${after.delayMinutes}분 지연${after.reason ? ` (${after.reason})` : ''}`,
          data: {
            type: 'delay_alert',
            reportId: context.params.reportId,
            lineId: after.lineId,
            delayMinutes: after.delayMinutes.toString(),
          },
        }
      );

      console.log(`Delay notification sent to topic ${topicName}:`, result);
      return result;
    } catch (error) {
      console.error('Failed to send delay notification:', error);
      return null;
    }
  });

// ============================================================================
// Certificate Triggers
// ============================================================================

/**
 * Trigger when a delay certificate is created
 * Notifies the user that their certificate is ready
 */
export const onCertificateCreated = functions
  .region('asia-northeast3')
  .firestore.document('delay_certificates/{certificateId}')
  .onCreate(async (snap, context) => {
    const certificate = snap.data() as DelayCertificate;
    const certificateId = context.params.certificateId;

    try {
      // Get user's FCM tokens
      const tokens = await tokenManagementService.getUserTokens(certificate.userId);

      if (tokens.length === 0) {
        console.log(`No tokens found for user ${certificate.userId}`);
        return null;
      }

      const result = await pushNotificationService.sendCertificateReady(
        tokens[0]!,
        {
          certificateId,
          lineName: certificate.lineName,
          date: certificate.date,
        }
      );

      console.log(`Certificate notification sent to user ${certificate.userId}:`, result);
      return result;
    } catch (error) {
      console.error('Failed to send certificate notification:', error);
      return null;
    }
  });

// ============================================================================
// Trust/Badge Triggers
// ============================================================================

/**
 * Trigger when a user earns a new badge
 */
export const onBadgeEarned = functions
  .region('asia-northeast3')
  .firestore.document('user_trust_profiles/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as UserTrustProfile;
    const after = change.after.data() as UserTrustProfile;
    const userId = context.params.userId;

    // Check for new badges
    const beforeBadgeIds = new Set(before.badges?.map(b => b.id) ?? []);
    const newBadges = (after.badges ?? []).filter(b => !beforeBadgeIds.has(b.id));

    if (newBadges.length === 0) {
      return null;
    }

    try {
      const tokens = await tokenManagementService.getUserTokens(userId);

      if (tokens.length === 0) {
        console.log(`No tokens found for user ${userId}`);
        return null;
      }

      // Notify for each new badge
      for (const badge of newBadges) {
        await pushNotificationService.sendBadgeEarned(tokens[0]!, {
          badgeName: badge.name,
          badgeIcon: badge.icon,
          description: badge.description,
        });
      }

      console.log(`Badge notifications sent to user ${userId}:`, newBadges.map(b => b.name));
      return null;
    } catch (error) {
      console.error('Failed to send badge notification:', error);
      return null;
    }
  });

// ============================================================================
// Scheduled Triggers
// ============================================================================

/**
 * Send commute reminders
 * Runs every minute to check for upcoming commutes
 */
export const sendCommuteReminders = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Query schedules that should trigger now
    // This is a simplified version - production would need more sophisticated scheduling
    const schedulesSnapshot = await db
      .collection('commute_schedules')
      .where('enabled', '==', true)
      .where('daysOfWeek', 'array-contains', currentDay)
      .get();

    let sentCount = 0;

    for (const doc of schedulesSnapshot.docs) {
      const schedule = doc.data() as CommuteSchedule;

      // Parse departure time
      const [hours, minutes] = schedule.departureTime.split(':').map(Number);
      if (hours === undefined || minutes === undefined) continue;

      const departureMinutes = hours * 60 + minutes;
      const notifyMinutes = departureMinutes - schedule.notifyMinutesBefore;

      // Check if it's time to notify (within 1 minute window)
      if (Math.abs(currentMinutes - notifyMinutes) <= 1) {
        try {
          const tokens = await tokenManagementService.getUserTokens(schedule.userId);

          if (tokens.length > 0) {
            await pushNotificationService.sendCommuteReminder(tokens[0]!, {
              departureTime: schedule.departureTime,
              stationName: schedule.stationName,
              minutesBefore: schedule.notifyMinutesBefore,
            });
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send commute reminder to ${schedule.userId}:`, error);
        }
      }
    }

    console.log(`Sent ${sentCount} commute reminders`);
    return null;
  });

/**
 * Cleanup expired FCM tokens
 * Runs daily at 3 AM KST
 */
export const cleanupExpiredTokens = functions
  .region('asia-northeast3')
  .pubsub.schedule('0 3 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    try {
      const cleanedCount = await tokenManagementService.cleanupExpiredTokens();
      console.log(`Cleaned up ${cleanedCount} expired tokens`);
      return null;
    } catch (error) {
      console.error('Failed to cleanup tokens:', error);
      return null;
    }
  });

// ============================================================================
// Token Management Triggers
// ============================================================================

/**
 * Handle FCM token registration
 */
export const registerFcmToken = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: {
        token: string;
        deviceId: string;
        platform: 'ios' | 'android' | 'web';
        appVersion: string;
      },
      context: functions.https.CallableContext
    ) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      try {
        await tokenManagementService.registerToken({
          ...data,
          userId: context.auth.uid,
        });

        return { success: true };
      } catch (error) {
        console.error('Token registration failed:', error);
        throw new functions.https.HttpsError(
          'internal',
          '토큰 등록에 실패했습니다.'
        );
      }
    }
  );

/**
 * Handle FCM token removal (logout/uninstall)
 */
export const unregisterFcmToken = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: { token: string },
      context: functions.https.CallableContext
    ) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      try {
        await tokenManagementService.invalidateToken(data.token);
        return { success: true };
      } catch (error) {
        console.error('Token removal failed:', error);
        throw new functions.https.HttpsError(
          'internal',
          '토큰 제거에 실패했습니다.'
        );
      }
    }
  );
