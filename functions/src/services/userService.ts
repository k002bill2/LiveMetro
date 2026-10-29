/**
 * User Service - Firestore Integration
 * Handles user data retrieval for email notifications
 */

import * as admin from 'firebase-admin';
import { UserData } from '../types';
import { isEmailOptInEnabled } from './emailRecipient';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get user data by UID
 */
export async function getUserById(uid: string): Promise<UserData | null> {
  try {
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.log(`User not found: ${uid}`);
      return null;
    }

    const data = userDoc.data();
    if (!data) {
      return null;
    }

    return {
      id: userDoc.id,
      email: data.email || '',
      displayName: data.displayName || '',
      isAnonymous: data.isAnonymous || false,
      preferences: {
        notificationSettings: {
          enabled: data.preferences?.notificationSettings?.enabled ?? true,
          emailNotifications: data.preferences?.notificationSettings?.emailNotifications ?? false,
          pushNotifications: data.preferences?.notificationSettings?.pushNotifications ?? true,
          alertTypes: {
            delays: data.preferences?.notificationSettings?.alertTypes?.delays ?? true,
            suspensions: data.preferences?.notificationSettings?.alertTypes?.suspensions ?? true,
            congestion: data.preferences?.notificationSettings?.alertTypes?.congestion ?? false,
            alternativeRoutes: data.preferences?.notificationSettings?.alertTypes?.alternativeRoutes ?? false,
            serviceUpdates: data.preferences?.notificationSettings?.alertTypes?.serviceUpdates ?? true,
          },
        },
      },
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Check if user has email notifications enabled
 */
export async function isEmailNotificationEnabled(uid: string): Promise<boolean> {
  const user = await getUserById(uid);
  if (!user) return false;

  return (
    user.preferences.notificationSettings.enabled &&
    user.preferences.notificationSettings.emailNotifications &&
    !!user.email &&
    !user.isAnonymous
  );
}

/**
 * Check only the email opt-in preferences in the Firestore users doc.
 *
 * Unlike isEmailNotificationEnabled, this does NOT gate on the doc's
 * `email` / `isAnonymous` fields: those are client-writable and go stale when
 * a user links an email later. The recipient address must instead come from
 * Firebase Auth (see emailRecipient.ts).
 */
export async function isEmailOptedIn(uid: string): Promise<boolean> {
  const user = await getUserById(uid);
  return isEmailOptInEnabled(user ? user.preferences.notificationSettings : null);
}

/**
 * Get user email if notifications are enabled
 */
export async function getUserEmailIfEnabled(uid: string): Promise<string | null> {
  const user = await getUserById(uid);
  if (!user) return null;

  const isEnabled =
    user.preferences.notificationSettings.enabled &&
    user.preferences.notificationSettings.emailNotifications &&
    !!user.email &&
    !user.isAnonymous;

  return isEnabled ? user.email : null;
}
