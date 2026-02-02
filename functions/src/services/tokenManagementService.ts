/**
 * Token Management Service
 * Manages FCM tokens for users
 */

import * as admin from 'firebase-admin';

// ============================================================================
// Types
// ============================================================================

/**
 * Device token record
 */
export interface DeviceToken {
  token: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  createdAt: admin.firestore.Timestamp;
  lastUsedAt: admin.firestore.Timestamp;
  isValid: boolean;
}

/**
 * Token registration request
 */
export interface TokenRegistrationRequest {
  token: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION = 'fcm_tokens';
const TOKEN_EXPIRY_DAYS = 60;

// ============================================================================
// Service
// ============================================================================

class TokenManagementService {
  private db: admin.firestore.Firestore;

  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Register or update a device token
   */
  async registerToken(request: TokenRegistrationRequest): Promise<void> {
    const { token, userId, deviceId, platform, appVersion } = request;

    // Check for existing token with same deviceId
    const existing = await this.db
      .collection(COLLECTION)
      .where('deviceId', '==', deviceId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!existing.empty) {
      // Update existing
      const doc = existing.docs[0];
      if (doc) {
        await doc.ref.update({
          token,
          platform,
          appVersion,
          lastUsedAt: now,
          isValid: true,
        });
      }
    } else {
      // Create new
      await this.db.collection(COLLECTION).add({
        token,
        userId,
        deviceId,
        platform,
        appVersion,
        createdAt: now,
        lastUsedAt: now,
        isValid: true,
      });
    }

    // Also store in user document for quick access
    await this.db.collection('users').doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
      lastTokenUpdate: now,
    });
  }

  /**
   * Get all valid tokens for a user
   */
  async getUserTokens(userId: string): Promise<string[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .where('isValid', '==', true)
      .get();

    return snapshot.docs.map(doc => (doc.data() as DeviceToken).token);
  }

  /**
   * Get tokens for multiple users
   */
  async getMultipleUserTokens(userIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    // Firestore 'in' queries limited to 30 items
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const snapshot = await this.db
        .collection(COLLECTION)
        .where('userId', 'in', batch)
        .where('isValid', '==', true)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data() as DeviceToken;
        const existing = result.get(data.userId) ?? [];
        existing.push(data.token);
        result.set(data.userId, existing);
      }
    }

    return result;
  }

  /**
   * Invalidate a token
   */
  async invalidateToken(token: string): Promise<void> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('token', '==', token)
      .get();

    const batch = this.db.batch();

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { isValid: false });

      // Also remove from user document
      const data = doc.data() as DeviceToken;
      const userRef = this.db.collection('users').doc(data.userId);
      batch.update(userRef, {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
      });
    }

    await batch.commit();
  }

  /**
   * Invalidate tokens for a device
   */
  async invalidateDeviceTokens(deviceId: string): Promise<void> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('deviceId', '==', deviceId)
      .get();

    const batch = this.db.batch();

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { isValid: false });
    }

    await batch.commit();
  }

  /**
   * Remove all tokens for a user
   */
  async removeUserTokens(userId: string): Promise<void> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .get();

    const batch = this.db.batch();

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }

    // Clear from user document
    batch.update(this.db.collection('users').doc(userId), {
      fcmTokens: [],
    });

    await batch.commit();
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - TOKEN_EXPIRY_DAYS);
    const expiryTimestamp = admin.firestore.Timestamp.fromDate(expiryDate);

    const snapshot = await this.db
      .collection(COLLECTION)
      .where('lastUsedAt', '<', expiryTimestamp)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = this.db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as DeviceToken;

      batch.delete(doc.ref);

      // Remove from user document
      batch.update(this.db.collection('users').doc(data.userId), {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(data.token),
      });

      count++;
    }

    await batch.commit();
    return count;
  }

  /**
   * Handle failed tokens from FCM response
   */
  async handleFailedTokens(tokens: string[]): Promise<void> {
    for (const token of tokens) {
      await this.invalidateToken(token);
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    total: number;
    valid: number;
    byPlatform: Record<string, number>;
  }> {
    const allTokens = await this.db.collection(COLLECTION).get();
    const validTokens = await this.db
      .collection(COLLECTION)
      .where('isValid', '==', true)
      .get();

    const byPlatform: Record<string, number> = {};

    for (const doc of validTokens.docs) {
      const platform = (doc.data() as DeviceToken).platform;
      byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
    }

    return {
      total: allTokens.size,
      valid: validTokens.size,
      byPlatform,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const tokenManagementService = new TokenManagementService();
export default tokenManagementService;
