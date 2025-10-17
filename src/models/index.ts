/**
 * Centralized export for all domain models
 * Provides a single import point for type definitions
 */

// Train domain exports
export type {
  Station,
  SubwayLine,
  Train,
  TrainDelay,
  CongestionData,
  TrainSchedule,
  ServiceDisruption
} from './train';

export {
  TrainStatus,
  DelaySeverity,
  CongestionLevel
} from './train';

// User domain exports
export type {
  User,
  UserPreferences,
  FavoriteStation,
  NotificationSettings,
  QuietHours,
  NotificationAlertTypes,
  CommuteSchedule,
  DailySchedule,
  CommuteTime,
  UserActivity
} from './user';

export {
  SubscriptionStatus,
  UserAction
} from './user';

// Notification domain exports
export type {
  Notification,
  NotificationData,
  NotificationAction,
  AlternativeRoute,
  RouteOption,
  Transfer,
  PushNotificationPayload,
  AndroidNotificationConfig,
  IOSNotificationConfig,
  IOSCriticalSound,
  NotificationTemplate
} from './notification';

export {
  NotificationType,
  NotificationPriority
} from './notification';

// Common types used across domains
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly timestamp: Date;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly pageSize: number;
  readonly currentPage: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface Location {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy?: number;
  readonly timestamp: Date;
}
