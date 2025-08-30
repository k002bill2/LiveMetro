/**
 * User domain models and types
 * Handles user preferences, authentication, and personalization
 */

export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly profilePicture: string | null;
  readonly preferences: UserPreferences;
  readonly subscription: SubscriptionStatus;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
}

export interface UserPreferences {
  readonly favoriteStations: readonly FavoriteStation[];
  readonly notificationSettings: NotificationSettings;
  readonly commuteSchedule: CommuteSchedule;
  readonly language: 'ko' | 'en';
  readonly theme: 'light' | 'dark' | 'system';
  readonly units: 'metric' | 'imperial';
}

export interface FavoriteStation {
  readonly id: string;
  readonly stationId: string;
  readonly lineId: string;
  readonly alias: string | null;  // User-defined name like "Home", "Work"
  readonly direction: 'up' | 'down' | 'both';
  readonly isCommuteStation: boolean;
  readonly addedAt: Date;
}

export interface NotificationSettings {
  readonly enabled: boolean;
  readonly delayThresholdMinutes: number;
  readonly quietHours: QuietHours;
  readonly weekdaysOnly: boolean;
  readonly alertTypes: NotificationAlertTypes;
  readonly pushNotifications: boolean;
  readonly emailNotifications: boolean;
}

export interface QuietHours {
  readonly enabled: boolean;
  readonly startTime: string; // HH:mm format
  readonly endTime: string;   // HH:mm format
}

export interface NotificationAlertTypes {
  readonly delays: boolean;
  readonly suspensions: boolean;
  readonly congestion: boolean;
  readonly alternativeRoutes: boolean;
  readonly serviceUpdates: boolean;
}

export interface CommuteSchedule {
  readonly weekdays: DailySchedule;
  readonly weekends: DailySchedule | null;
  readonly autoDetect: boolean;
}

export interface DailySchedule {
  readonly morningCommute: CommuteTime | null;
  readonly eveningCommute: CommuteTime | null;
}

export interface CommuteTime {
  readonly departureTime: string; // HH:mm format
  readonly stationId: string;
  readonly destinationStationId: string;
  readonly bufferMinutes: number;
}

export enum SubscriptionStatus {
  FREE = 'free',
  PREMIUM = 'premium',
  TRIAL = 'trial'
}

export interface UserActivity {
  readonly userId: string;
  readonly action: UserAction;
  readonly stationId?: string;
  readonly lineId?: string;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown>;
}

export enum UserAction {
  VIEW_TRAIN_INFO = 'view_train_info',
  ADD_FAVORITE = 'add_favorite',
  REMOVE_FAVORITE = 'remove_favorite',
  CHECK_DELAYS = 'check_delays',
  VIEW_ALTERNATIVE_ROUTE = 'view_alternative_route',
  UPDATE_PREFERENCES = 'update_preferences',
  REPORT_CONGESTION = 'report_congestion'
}