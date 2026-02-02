/**
 * Report Verification Cloud Functions
 * Admin functions for verifying delay reports
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

/**
 * Delay report from Firestore
 */
interface DelayReport {
  id: string;
  userId: string;
  lineId: string;
  stationId: string;
  delayMinutes: number;
  reason?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  metadata?: {
    deviceId?: string;
    location?: { latitude: number; longitude: number };
  };
}

/**
 * User trust profile
 */
interface UserTrustProfile {
  userId: string;
  trustScore: number;
  trustLevel: string;
  totalReports: number;
  verifiedReports: number;
  rejectedReports: number;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Verification request
 */
interface VerificationRequest {
  reportId: string;
  action: 'verify' | 'reject';
  reason?: string;
}

/**
 * Auto-verification config
 */
interface AutoVerificationConfig {
  minTrustScore: number;
  maxDelayMinutes: number;
  requireLocationMatch: boolean;
  minSimilarReports: number;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTIONS = {
  REPORTS: 'delay_reports',
  USERS: 'users',
  TRUST_PROFILES: 'user_trust_profiles',
  VERIFICATION_LOG: 'verification_log',
};

const DEFAULT_AUTO_CONFIG: AutoVerificationConfig = {
  minTrustScore: 60,
  maxDelayMinutes: 30,
  requireLocationMatch: false,
  minSimilarReports: 2,
};

// ============================================================================
// Admin Verification Function
// ============================================================================

/**
 * Admin function to verify or reject a delay report
 */
export const verifyDelayReport = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: VerificationRequest,
      context: functions.https.CallableContext
    ): Promise<{ success: boolean; message: string }> => {
      // 1. Authentication check
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      // 2. Check admin role
      const adminCheck = await checkAdminRole(context.auth.uid);
      if (!adminCheck) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '관리자 권한이 필요합니다.'
        );
      }

      // 3. Validate request
      if (!data.reportId || !data.action) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          '유효하지 않은 요청입니다.'
        );
      }

      // 4. Get report
      const reportRef = db.collection(COLLECTIONS.REPORTS).doc(data.reportId);
      const reportSnap = await reportRef.get();

      if (!reportSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '제보를 찾을 수 없습니다.'
        );
      }

      const report = reportSnap.data() as DelayReport;

      // 5. Check if already processed
      if (report.status !== 'pending') {
        return {
          success: false,
          message: '이미 처리된 제보입니다.',
        };
      }

      // 6. Update report
      const isVerified = data.action === 'verify';
      await reportRef.update({
        status: isVerified ? 'verified' : 'rejected',
        verifiedBy: context.auth.uid,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationReason: data.reason || null,
      });

      // 7. Update user trust score
      await updateUserTrustScore(report.userId, isVerified);

      // 8. Log verification
      await db.collection(COLLECTIONS.VERIFICATION_LOG).add({
        reportId: data.reportId,
        adminId: context.auth.uid,
        action: data.action,
        reason: data.reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: isVerified ? '제보가 검증되었습니다.' : '제보가 거부되었습니다.',
      };
    }
  );

// ============================================================================
// Auto-Verification Function
// ============================================================================

/**
 * Automatically verify reports from trusted users
 * Runs every 5 minutes
 */
export const autoVerifyReports = functions
  .region('asia-northeast3')
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    const config = DEFAULT_AUTO_CONFIG;

    // Get pending reports
    const pendingReports = await db
      .collection(COLLECTIONS.REPORTS)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get();

    if (pendingReports.empty) {
      console.log('No pending reports to process');
      return null;
    }

    let verified = 0;
    let skipped = 0;

    for (const doc of pendingReports.docs) {
      const report = doc.data() as DelayReport;

      try {
        const shouldAutoVerify = await checkAutoVerification(report, config);

        if (shouldAutoVerify.approved) {
          await doc.ref.update({
            status: 'verified',
            verifiedBy: 'system',
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            verificationReason: shouldAutoVerify.reason,
          });

          await updateUserTrustScore(report.userId, true);
          verified++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error processing report ${doc.id}:`, error);
        skipped++;
      }
    }

    console.log(`Auto-verification complete: ${verified} verified, ${skipped} skipped`);
    return null;
  });

// ============================================================================
// Report Aggregation Trigger
// ============================================================================

/**
 * Trigger when multiple reports for same line/time are received
 * Cross-validates reports
 */
export const onDelayReportCreated = functions
  .region('asia-northeast3')
  .firestore.document('delay_reports/{reportId}')
  .onCreate(async (snap, context) => {
    const report = snap.data() as DelayReport;
    const reportId = context.params.reportId;

    // Find similar reports (same line, within 10 minutes)
    const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(
      report.createdAt.toMillis() - 10 * 60 * 1000
    );

    const similarReports = await db
      .collection(COLLECTIONS.REPORTS)
      .where('lineId', '==', report.lineId)
      .where('createdAt', '>=', tenMinutesAgo)
      .where('status', '==', 'pending')
      .get();

    // Exclude current report
    const otherReports = similarReports.docs.filter(d => d.id !== reportId);

    if (otherReports.length >= DEFAULT_AUTO_CONFIG.minSimilarReports) {
      // Calculate average delay
      const delays = otherReports.map(d => (d.data() as DelayReport).delayMinutes);
      delays.push(report.delayMinutes);
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

      // Check if current report is within reasonable range
      const diff = Math.abs(report.delayMinutes - avgDelay);
      const isConsistent = diff <= 10;

      if (isConsistent) {
        // Auto-verify all similar reports
        const batch = db.batch();

        for (const doc of [...otherReports, snap.ref]) {
          const ref = doc instanceof admin.firestore.DocumentReference ? doc : doc.ref;
          batch.update(ref, {
            status: 'verified',
            verifiedBy: 'community',
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            verificationReason: `${delays.length}명의 사용자가 유사한 지연을 제보`,
          });
        }

        await batch.commit();

        // Update trust scores
        for (const doc of otherReports) {
          const data = doc.data() as DelayReport;
          await updateUserTrustScore(data.userId, true);
        }
        await updateUserTrustScore(report.userId, true);

        console.log(`Community verified ${delays.length} reports for line ${report.lineId}`);
      }
    }

    return null;
  });

// ============================================================================
// Admin Dashboard Data
// ============================================================================

/**
 * Get pending reports for admin review
 */
export const getPendingReports = functions
  .region('asia-northeast3')
  .https.onCall(
    async (
      data: { limit?: number; offset?: number },
      context: functions.https.CallableContext
    ) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }

      const adminCheck = await checkAdminRole(context.auth.uid);
      if (!adminCheck) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '관리자 권한이 필요합니다.'
        );
      }

      const limit = Math.min(data.limit ?? 20, 100);

      const reportsQuery = db
        .collection(COLLECTIONS.REPORTS)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      const snapshot = await reportsQuery.get();

      const reports = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const report = doc.data() as DelayReport;

          // Get user info
          const userDoc = await db.collection(COLLECTIONS.USERS).doc(report.userId).get();
          const userData = userDoc.exists ? userDoc.data() : null;

          // Get trust profile
          const trustDoc = await db
            .collection(COLLECTIONS.TRUST_PROFILES)
            .doc(report.userId)
            .get();
          const trustData = trustDoc.exists ? trustDoc.data() : null;

          return {
            id: doc.id,
            ...report,
            user: userData
              ? { displayName: userData.displayName, email: userData.email }
              : null,
            trustProfile: trustData,
          };
        })
      );

      return {
        reports,
        total: snapshot.size,
      };
    }
  );

/**
 * Get verification statistics
 */
export const getVerificationStats = functions
  .region('asia-northeast3')
  .https.onCall(async (_data: unknown, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const adminCheck = await checkAdminRole(context.auth.uid);
    if (!adminCheck) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '관리자 권한이 필요합니다.'
      );
    }

    // Get counts by status
    const pendingCount = await db
      .collection(COLLECTIONS.REPORTS)
      .where('status', '==', 'pending')
      .count()
      .get();

    const verifiedCount = await db
      .collection(COLLECTIONS.REPORTS)
      .where('status', '==', 'verified')
      .count()
      .get();

    const rejectedCount = await db
      .collection(COLLECTIONS.REPORTS)
      .where('status', '==', 'rejected')
      .count()
      .get();

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    const todayVerified = await db
      .collection(COLLECTIONS.REPORTS)
      .where('status', '==', 'verified')
      .where('verifiedAt', '>=', todayTimestamp)
      .count()
      .get();

    return {
      pending: pendingCount.data().count,
      verified: verifiedCount.data().count,
      rejected: rejectedCount.data().count,
      todayVerified: todayVerified.data().count,
    };
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has admin role
 */
async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) return false;

    const userData = userDoc.data();
    return userData?.role === 'admin' || userData?.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * Update user trust score
 */
async function updateUserTrustScore(
  userId: string,
  wasVerified: boolean
): Promise<void> {
  const trustRef = db.collection(COLLECTIONS.TRUST_PROFILES).doc(userId);
  const trustDoc = await trustRef.get();

  const scoreChange = wasVerified ? 5 : -10;

  if (trustDoc.exists) {
    const data = trustDoc.data() as UserTrustProfile;
    const newScore = Math.max(-100, Math.min(100, data.trustScore + scoreChange));

    await trustRef.update({
      trustScore: newScore,
      trustLevel: getTrustLevel(newScore),
      totalReports: admin.firestore.FieldValue.increment(1),
      verifiedReports: wasVerified
        ? admin.firestore.FieldValue.increment(1)
        : data.verifiedReports,
      rejectedReports: wasVerified
        ? data.rejectedReports
        : admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Create new profile
    const initialScore = 10 + scoreChange;
    await trustRef.set({
      userId,
      trustScore: initialScore,
      trustLevel: getTrustLevel(initialScore),
      totalReports: 1,
      verifiedReports: wasVerified ? 1 : 0,
      rejectedReports: wasVerified ? 0 : 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Get trust level from score
 */
function getTrustLevel(score: number): string {
  if (score < 0) return 'suspended';
  if (score < 20) return 'new';
  if (score < 40) return 'basic';
  if (score < 60) return 'trusted';
  if (score < 80) return 'verified';
  return 'expert';
}

/**
 * Check if report should be auto-verified
 */
async function checkAutoVerification(
  report: DelayReport,
  config: AutoVerificationConfig
): Promise<{ approved: boolean; reason: string }> {
  // Get user trust profile
  const trustDoc = await db
    .collection(COLLECTIONS.TRUST_PROFILES)
    .doc(report.userId)
    .get();

  if (!trustDoc.exists) {
    return { approved: false, reason: '사용자 신뢰도 프로필 없음' };
  }

  const trust = trustDoc.data() as UserTrustProfile;

  // Check trust score
  if (trust.trustScore < config.minTrustScore) {
    return { approved: false, reason: '신뢰도 점수 부족' };
  }

  // Check delay amount
  if (report.delayMinutes > config.maxDelayMinutes) {
    return { approved: false, reason: '지연 시간이 자동 검증 한도 초과' };
  }

  // Check for similar reports
  const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(
    report.createdAt.toMillis() - 10 * 60 * 1000
  );

  const similarReports = await db
    .collection(COLLECTIONS.REPORTS)
    .where('lineId', '==', report.lineId)
    .where('createdAt', '>=', tenMinutesAgo)
    .where('status', 'in', ['pending', 'verified'])
    .get();

  if (similarReports.size >= config.minSimilarReports) {
    return {
      approved: true,
      reason: `신뢰할 수 있는 사용자 (점수: ${trust.trustScore}) + ${similarReports.size}개 유사 제보`,
    };
  }

  // High trust users can be auto-verified
  if (trust.trustScore >= 80) {
    return {
      approved: true,
      reason: `전문가 사용자 자동 검증 (점수: ${trust.trustScore})`,
    };
  }

  return { approved: false, reason: '자동 검증 조건 미충족' };
}
