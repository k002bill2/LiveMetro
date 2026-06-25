/**
 * lineDelayAlert — turn a line-level OfficialDelay into an honest local
 * notification.
 *
 * The existing `notificationService.sendDelayAlert` is station-oriented
 * ("{station}역에서 N분 지연") which misrepresents a line suspension. This builds
 * status-accurate copy: 지연 / 운행 중단 / 운행 변경, including the affected line,
 * delay minutes (when known), and reason.
 */
import {
  notificationService,
  NotificationType,
  type NotificationPayload,
} from './notificationService';
import type { OfficialDelay } from '@services/delay/officialDelayService';

export function buildLineStatusPayload(delay: OfficialDelay): NotificationPayload {
  const { lineId, lineName, status, delayMinutes, reason } = delay;
  const reasonSuffix = reason ? ` 사유: ${reason}` : '';

  let title: string;
  let body: string;
  if (status === 'suspended') {
    title = `🚇 ${lineName} 운행 중단`;
    body = `${lineName} 운행이 중단되었습니다.${reasonSuffix}`;
  } else if (status === 'modified') {
    title = `🚇 ${lineName} 운행 변경`;
    body = `${lineName} 운행에 변경이 있습니다.${reasonSuffix}`;
  } else {
    title = `🚇 ${lineName} 지연`;
    const minutesPhrase = typeof delayMinutes === 'number' ? `약 ${delayMinutes}분 ` : '';
    body = `${lineName}에 ${minutesPhrase}지연이 발생했습니다.${reasonSuffix}`;
  }

  return {
    type: NotificationType.DELAY_ALERT,
    title,
    body,
    priority: 'high',
    channelId: 'delay_alerts',
    data: {
      lineId,
      lineName,
      status,
      delayMinutes,
      reason,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Fire a local notification for a line-level official delay. */
export async function fireLineDelayAlert(delay: OfficialDelay): Promise<string | null> {
  return notificationService.sendLocalNotification(buildLineStatusPayload(delay));
}
