/**
 * Push Token Service
 *
 * Persists the device's Expo push token + the lines the user is subscribed to
 * (derived from favorites) into `pushTokens/{uid}`. The server reads this for
 * targeting (lines array-contains) when sending real-time push (e.g. delay
 * alerts). Does NOT request permission redundantly beyond the gate here; a
 * denied permission simply means no token is issued and nothing is written.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/services/firebase/config';
import { notificationService } from './notificationService';

const COLLECTION = 'pushTokens';

class PushTokenService {
  async registerPushToken(uid: string, lines: readonly string[]): Promise<void> {
    try {
      const permission = await notificationService.requestPermissions();
      if (!permission.granted) return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await setDoc(doc(firestore, COLLECTION, uid), {
        uid,
        token,
        platform: Platform.OS,
        lines: [...lines],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Push token registration failed:', error);
    }
  }

  async unregisterPushToken(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(firestore, COLLECTION, uid));
    } catch (error) {
      console.error('Push token unregister failed:', error);
    }
  }
}

export const pushTokenService = new PushTokenService();
export default pushTokenService;
