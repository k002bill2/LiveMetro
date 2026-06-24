/**
 * Expo Push Service
 *
 * Sends push notifications via Expo's push service (https://exp.host/...), so
 * the client only needs an Expo push token (no native FCM/APNs token juggling).
 * Chunks messages (Expo caps at 100/request) and reports tokens Expo rejects as
 * invalid so callers can prune them.
 */
import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { loadExpo } from './expoSdkLoader';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface SendResult {
  tickets: ExpoPushTicket[];
  invalidTokens: string[];
}

class ExpoPushService {
  // Cache the (lazily ESM-loaded) Expo class so we import the SDK once, not per
  // send. Loading is deferred to first use — importing this module must NOT pull
  // in expo-server-sdk eagerly, or `firebase deploy` discovery re-hits
  // ERR_REQUIRE_ESM (see expoSdkLoader).
  private expoClassPromise?: ReturnType<typeof loadExpo>;

  private getExpoClass(): ReturnType<typeof loadExpo> {
    if (!this.expoClassPromise) {
      this.expoClassPromise = loadExpo();
    }
    return this.expoClassPromise;
  }

  async sendToTokens(tokens: string[], message: PushMessage): Promise<SendResult> {
    const Expo = await this.getExpoClass();
    const expo = new Expo();

    const valid: string[] = [];
    const invalidTokens: string[] = [];
    for (const t of tokens) {
      if (Expo.isExpoPushToken(t)) {
        valid.push(t);
      } else {
        invalidTokens.push(t);
      }
    }
    if (valid.length === 0) {
      return { tickets: [], invalidTokens };
    }

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
    }));

    const tickets: ExpoPushTicket[] = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...receipts);
      } catch (error) {
        console.error('Expo push chunk failed:', error);
      }
    }
    return { tickets, invalidTokens };
  }
}

export const expoPushService = new ExpoPushService();
export default expoPushService;
