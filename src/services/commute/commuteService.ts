/**
 * Commute Settings Service
 * Handles saving and loading commute settings to/from Firebase
 * Works with both anonymous and authenticated users using UID
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/services/firebase/config';
import { CommuteRoute } from '@/models/commute';

// Firestore collection name
const COMMUTE_COLLECTION = 'commuteSettings';

export interface CommuteSettings {
  morningRoute: CommuteRoute | null;
  eveningRoute: CommuteRoute | null;
  /**
   * Whether the evening commute leg is active. A settings-level flag kept
   * separate from `eveningRoute` so toggling the leg off (and back on)
   * preserves the saved 퇴근 route data. Legacy documents written before
   * this field existed default to `true` — an existing eveningRoute was
   * implicitly enabled.
   */
  eveningEnabled: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SaveCommuteResult {
  success: boolean;
  error?: string;
}

/**
 * Save commute routes to Firebase Firestore
 * Uses user UID as document ID (works for both anonymous and authenticated users)
 */
export const saveCommuteRoutes = async (
  uid: string,
  morningRoute: CommuteRoute,
  eveningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);

    await setDoc(docRef, {
      morningRoute: {
        departureTime: morningRoute.departureTime,
        departureStationId: morningRoute.departureStationId,
        departureStationName: morningRoute.departureStationName,
        departureLineId: morningRoute.departureLineId,
        arrivalStationId: morningRoute.arrivalStationId,
        arrivalStationName: morningRoute.arrivalStationName,
        arrivalLineId: morningRoute.arrivalLineId,
        transferStations: morningRoute.transferStations || [],
        notifications: morningRoute.notifications,
        bufferMinutes: morningRoute.bufferMinutes,
      },
      eveningRoute: {
        departureTime: eveningRoute.departureTime,
        departureStationId: eveningRoute.departureStationId,
        departureStationName: eveningRoute.departureStationName,
        departureLineId: eveningRoute.departureLineId,
        arrivalStationId: eveningRoute.arrivalStationId,
        arrivalStationName: eveningRoute.arrivalStationName,
        arrivalLineId: eveningRoute.arrivalLineId,
        transferStations: eveningRoute.transferStations || [],
        notifications: eveningRoute.notifications,
        bufferMinutes: eveningRoute.bufferMinutes,
      },
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    console.log('Commute routes saved successfully for UID:', uid);
    return { success: true };
  } catch (error) {
    console.error('Error saving commute routes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * Load commute routes from Firebase Firestore
 * Uses user UID to fetch settings
 */
export const loadCommuteRoutes = async (
  uid: string
): Promise<CommuteSettings | null> => {
  if (!uid) {
    console.warn('No UID provided for loading commute routes');
    return null;
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Commute routes loaded successfully for UID:', uid);
      return {
        morningRoute: data.morningRoute || null,
        eveningRoute: data.eveningRoute || null,
        // Legacy docs predate this field — default to enabled.
        eveningEnabled: data.eveningEnabled ?? true,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    }

    console.log('No commute settings found for UID:', uid);
    return null;
  } catch (error) {
    console.error('Error loading commute routes:', error);
    return null;
  }
};

/**
 * Update only morning route
 */
export const updateMorningRoute = async (
  uid: string,
  morningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await updateDoc(docRef, {
      morningRoute: {
        departureTime: morningRoute.departureTime,
        departureStationId: morningRoute.departureStationId,
        departureStationName: morningRoute.departureStationName,
        departureLineId: morningRoute.departureLineId,
        arrivalStationId: morningRoute.arrivalStationId,
        arrivalStationName: morningRoute.arrivalStationName,
        arrivalLineId: morningRoute.arrivalLineId,
        transferStations: morningRoute.transferStations || [],
        notifications: morningRoute.notifications,
        bufferMinutes: morningRoute.bufferMinutes,
      },
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating morning route:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * Update only evening route
 */
export const updateEveningRoute = async (
  uid: string,
  eveningRoute: CommuteRoute
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await updateDoc(docRef, {
      eveningRoute: {
        departureTime: eveningRoute.departureTime,
        departureStationId: eveningRoute.departureStationId,
        departureStationName: eveningRoute.departureStationName,
        departureLineId: eveningRoute.departureLineId,
        arrivalStationId: eveningRoute.arrivalStationId,
        arrivalStationName: eveningRoute.arrivalStationName,
        arrivalLineId: eveningRoute.arrivalLineId,
        transferStations: eveningRoute.transferStations || [],
        notifications: eveningRoute.notifications,
        bufferMinutes: eveningRoute.bufferMinutes,
      },
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating evening route:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
    };
  }
};

/**
 * Enable or disable the evening commute leg.
 *
 * Persists only the `eveningEnabled` settings flag — the saved
 * `eveningRoute` data is left untouched, so toggling the leg back on
 * restores the route without forcing the user to re-enter it. Uses
 * `setDoc` with `merge` so the call is safe even if the document was
 * somehow not created yet.
 */
export const updateEveningEnabled = async (
  uid: string,
  enabled: boolean
): Promise<SaveCommuteResult> => {
  if (!uid) {
    return { success: false, error: '사용자 인증이 필요합니다' };
  }

  try {
    const docRef = doc(firestore, COMMUTE_COLLECTION, uid);
    await setDoc(
      docRef,
      { eveningEnabled: enabled, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating evening enabled flag:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다',
    };
  }
};

export default {
  saveCommuteRoutes,
  loadCommuteRoutes,
  updateMorningRoute,
  updateEveningRoute,
  updateEveningEnabled,
};
