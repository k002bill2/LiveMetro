/**
 * Notification domain models and types
 * Handles push notifications, alerts, and real-time messaging
 */

import { CongestionLevel } from './train';

export interface Notification {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: NotificationData;
  readonly priority: NotificationPriority;
  readonly isRead: boolean;
  readonly createdAt: Date;
  readonly scheduledFor: Date | null;
  readonly expiresAt: Date | null;
}

export enum NotificationType {
  DELAY_ALERT = 'delay_alert',
  SUSPENSION_ALERT = 'suspension_alert',
  CONGESTION_UPDATE = 'congestion_update',
  ALTERNATIVE_ROUTE = 'alternative_route',
  SERVICE_UPDATE = 'service_update',
  DAILY_COMMUTE = 'daily_commute',
  EMERGENCY = 'emergency'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface NotificationData {
  readonly stationId?: string;
  readonly lineId?: string;
  readonly trainId?: string;
  readonly delayMinutes?: number;
  readonly alternativeRoute?: AlternativeRoute;
  readonly deepLink?: string;
  readonly actionButtons?: NotificationAction[];
}

export interface NotificationAction {
  readonly id: string;
  readonly label: string;
  readonly action: string;
  readonly url?: string;
}

export interface AlternativeRoute {
  readonly fromStationId: string;
  readonly toStationId: string;
  readonly routes: readonly RouteOption[];
  readonly estimatedDelay: number;
}

export interface RouteOption {
  readonly id: string;
  readonly description: string;
  readonly totalTime: number;
  readonly walkingTime: number;
  readonly transfers: readonly Transfer[];
  readonly congestionLevel: CongestionLevel;
  readonly reliability: number; // 0-100%
}

export interface Transfer {
  readonly fromLineId: string;
  readonly toLineId: string;
  readonly stationId: string;
  readonly walkingMinutes: number;
}

export interface PushNotificationPayload {
  readonly notification: {
    readonly title: string;
    readonly body: string;
    readonly icon?: string;
    readonly badge?: number;
    readonly sound?: string;
  };
  readonly data: Record<string, string>;
  readonly android?: AndroidNotificationConfig;
  readonly ios?: IOSNotificationConfig;
}

export interface AndroidNotificationConfig {
  readonly channelId: string;
  readonly priority: 'min' | 'low' | 'default' | 'high' | 'max';
  readonly color?: string;
  readonly smallIcon?: string;
  readonly largeIcon?: string;
}

export interface IOSNotificationConfig {
  readonly badge?: number;
  readonly category?: string;
  readonly threadId?: string;
  readonly sound?: string | IOSCriticalSound;
}

export interface IOSCriticalSound {
  readonly critical: boolean;
  readonly name: string;
  readonly volume: number;
}

export interface NotificationTemplate {
  readonly type: NotificationType;
  readonly titleTemplate: string;
  readonly bodyTemplate: string;
  readonly priority: NotificationPriority;
  readonly variables: readonly string[];
}