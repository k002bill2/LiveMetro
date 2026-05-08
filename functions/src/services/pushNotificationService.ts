/**
 * Push Notification Service (FCM)
 * Sends push notifications via Firebase Cloud Messaging
 */

import * as admin from 'firebase-admin';

// ============================================================================
// Types
// ============================================================================

/**
 * Push notification payload
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
}

/**
 * Notification target
 */
export type NotificationTarget =
  | { type: 'token'; token: string }
  | { type: 'tokens'; tokens: string[] }
  | { type: 'topic'; topic: string }
  | { type: 'condition'; condition: string };

/**
 * Send result
 */
export interface SendResult {
  success: boolean;
  successCount?: number;
  failureCount?: number;
  failedTokens?: string[];
  messageId?: string;
  error?: string;
}

/**
 * Notification types
 */
export type PushNotificationType =
  | 'arrival_alert'      // Train arrival
  | 'delay_alert'        // Delay notification
  | 'congestion_alert'   // High congestion
  | 'service_alert'      // Service disruption
  | 'commute_reminder'   // Commute time reminder
  | 'certificate_ready'  // Delay certificate ready
  | 'trust_update'       // Trust score changed
  | 'badge_earned';      // New badge earned

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATION_CHANNELS = {
  arrival: {
    id: 'arrival_channel',
    name: '도착 알림',
    importance: 'high',
  },
  delay: {
    id: 'delay_channel',
    name: '지연 알림',
    importance: 'high',
  },
  general: {
    id: 'general_channel',
    name: '일반 알림',
    importance: 'default',
  },
};

// ============================================================================
// Service
// ============================================================================

/**
 * Common FCM message shape before a routing key (`token`/`topic`/`condition`/`tokens`)
 * is attached. Each `sendToX` method spreads this base and appends its own key.
 */
type FcmBaseMessage = Omit<admin.messaging.MulticastMessage, 'tokens'>;

class PushNotificationService {
  private messaging: admin.messaging.Messaging;

  constructor() {
    this.messaging = admin.messaging();
  }

  /**
   * Send push notification
   */
  async send(
    target: NotificationTarget,
    payload: PushNotificationPayload
  ): Promise<SendResult> {
    try {
      const message = this.buildMessage(payload);

      switch (target.type) {
        case 'token':
          return await this.sendToToken(target.token, message);
        case 'tokens':
          return await this.sendToTokens(target.tokens, message);
        case 'topic':
          return await this.sendToTopic(target.topic, message);
        case 'condition':
          return await this.sendToCondition(target.condition, message);
        default:
          return { success: false, error: 'Invalid target type' };
      }
    } catch (error) {
      console.error('Push notification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send arrival alert
   */
  async sendArrivalAlert(
    token: string,
    data: {
      lineName: string;
      stationName: string;
      direction: string;
      minutes: number;
    }
  ): Promise<SendResult> {
    return this.send(
      { type: 'token', token },
      {
        title: `🚇 ${data.lineName} 도착 알림`,
        body: `${data.stationName} ${data.direction} 방면 열차가 ${data.minutes}분 후 도착합니다`,
        data: {
          type: 'arrival_alert',
          lineName: data.lineName,
          stationName: data.stationName,
          direction: data.direction,
          minutes: data.minutes.toString(),
        },
        sound: 'arrival.wav',
      }
    );
  }

  /**
   * Send delay alert
   */
  async sendDelayAlert(
    tokens: string[],
    data: {
      lineName: string;
      delayMinutes: number;
      reason?: string;
    }
  ): Promise<SendResult> {
    return this.send(
      { type: 'tokens', tokens },
      {
        title: `⚠️ ${data.lineName} 지연 알림`,
        body: `현재 약 ${data.delayMinutes}분 지연 운행 중${data.reason ? ` (${data.reason})` : ''}`,
        data: {
          type: 'delay_alert',
          lineName: data.lineName,
          delayMinutes: data.delayMinutes.toString(),
          reason: data.reason ?? '',
        },
        sound: 'alert.wav',
      }
    );
  }

  /**
   * Send congestion alert
   */
  async sendCongestionAlert(
    token: string,
    data: {
      lineName: string;
      stationName: string;
      level: 'high' | 'very_high';
    }
  ): Promise<SendResult> {
    const levelText = data.level === 'very_high' ? '매우 혼잡' : '혼잡';

    return this.send(
      { type: 'token', token },
      {
        title: `🚨 ${data.lineName} 혼잡 알림`,
        body: `${data.stationName}역이 현재 ${levelText}합니다. 우회 경로를 추천합니다.`,
        data: {
          type: 'congestion_alert',
          lineName: data.lineName,
          stationName: data.stationName,
          level: data.level,
        },
      }
    );
  }

  /**
   * Send commute reminder
   */
  async sendCommuteReminder(
    token: string,
    data: {
      departureTime: string;
      stationName: string;
      minutesBefore: number;
    }
  ): Promise<SendResult> {
    return this.send(
      { type: 'token', token },
      {
        title: '⏰ 출발 시간 알림',
        body: `${data.minutesBefore}분 후 ${data.stationName}역 출발 예정입니다`,
        data: {
          type: 'commute_reminder',
          departureTime: data.departureTime,
          stationName: data.stationName,
        },
      }
    );
  }

  /**
   * Send service alert to topic subscribers
   */
  async sendServiceAlert(
    lineId: string,
    data: {
      lineName: string;
      alertType: 'suspension' | 'modified' | 'restoration';
      message: string;
    }
  ): Promise<SendResult> {
    const titles = {
      suspension: `🛑 ${data.lineName} 운행 중단`,
      modified: `🔄 ${data.lineName} 우회 운행`,
      restoration: `✅ ${data.lineName} 운행 재개`,
    };

    return this.send(
      { type: 'topic', topic: `line_${lineId}` },
      {
        title: titles[data.alertType],
        body: data.message,
        data: {
          type: 'service_alert',
          lineId,
          alertType: data.alertType,
        },
      }
    );
  }

  /**
   * Send certificate ready notification
   */
  async sendCertificateReady(
    token: string,
    data: {
      certificateId: string;
      lineName: string;
      date: string;
    }
  ): Promise<SendResult> {
    return this.send(
      { type: 'token', token },
      {
        title: '📄 지연 증명서 발급 완료',
        body: `${data.date} ${data.lineName} 지연 증명서가 발급되었습니다`,
        data: {
          type: 'certificate_ready',
          certificateId: data.certificateId,
        },
      }
    );
  }

  /**
   * Send badge earned notification
   */
  async sendBadgeEarned(
    token: string,
    data: {
      badgeName: string;
      badgeIcon: string;
      description: string;
    }
  ): Promise<SendResult> {
    return this.send(
      { type: 'token', token },
      {
        title: `🏆 새 뱃지 획득!`,
        body: `${data.badgeIcon} ${data.badgeName}: ${data.description}`,
        data: {
          type: 'badge_earned',
          badgeName: data.badgeName,
        },
      }
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build FCM message
   */
  private buildMessage(payload: PushNotificationPayload): FcmBaseMessage {
    const notification: admin.messaging.Notification = {
      title: payload.title,
      body: payload.body,
    };

    if (payload.imageUrl) {
      notification.imageUrl = payload.imageUrl;
    }

    const android: admin.messaging.AndroidConfig = {
      priority: 'high',
      notification: {
        channelId: NOTIFICATION_CHANNELS.general.id,
        sound: payload.sound ?? 'default',
        priority: 'high',
        defaultVibrateTimings: true,
      },
    };

    const apns: admin.messaging.ApnsConfig = {
      payload: {
        aps: {
          badge: payload.badge,
          sound: payload.sound ?? 'default',
          contentAvailable: true,
        },
      },
    };

    return {
      notification,
      data: payload.data,
      android,
      apns,
    } as admin.messaging.Message;
  }

  /**
   * Send to single token
   */
  private async sendToToken(
    token: string,
    message: FcmBaseMessage
  ): Promise<SendResult> {
    const fullMessage = { ...message, token };
    const response = await this.messaging.send(fullMessage);

    return {
      success: true,
      messageId: response,
    };
  }

  /**
   * Send to multiple tokens
   */
  private async sendToTokens(
    tokens: string[],
    message: FcmBaseMessage
  ): Promise<SendResult> {
    if (tokens.length === 0) {
      return { success: false, error: 'No tokens provided' };
    }

    // FCM supports up to 500 tokens per multicast
    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const failedTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const multicastMessage: admin.messaging.MulticastMessage = {
        ...message,
        tokens: batch,
      };

      const response = await this.messaging.sendEachForMulticast(multicastMessage);

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const failedToken = batch[idx];
          if (failedToken) {
            failedTokens.push(failedToken);
          }
        }
      });
    }

    return {
      success: failureCount === 0,
      successCount,
      failureCount,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
    };
  }

  /**
   * Send to topic
   */
  private async sendToTopic(
    topic: string,
    message: FcmBaseMessage
  ): Promise<SendResult> {
    const fullMessage = { ...message, topic };
    const response = await this.messaging.send(fullMessage);

    return {
      success: true,
      messageId: response,
    };
  }

  /**
   * Send to condition
   */
  private async sendToCondition(
    condition: string,
    message: FcmBaseMessage
  ): Promise<SendResult> {
    const fullMessage = { ...message, condition };
    const response = await this.messaging.send(fullMessage);

    return {
      success: true,
      messageId: response,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
