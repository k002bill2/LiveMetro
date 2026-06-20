/**
 * Expo Push Service
 *
 * Sends push notifications via Expo's push service (https://exp.host/...), so
 * the client only needs an Expo push token (no native FCM/APNs token juggling).
 * Chunks messages (Expo caps at 100/request) and reports tokens Expo rejects as
 * invalid so callers can prune them.
 */
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

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
  private expo = new Expo();

  async sendToTokens(tokens: string[], message: PushMessage): Promise<SendResult> {
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
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const receipts = await this.expo.sendPushNotificationsAsync(chunk);
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
