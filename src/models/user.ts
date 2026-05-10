/**
 * User domain models and types
 * Handles user preferences, authentication, and personalization
 */

export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly isAnonymous: boolean;
  readonly profilePicture?: string | null;
  readonly preferences: UserPreferences;
  readonly subscription?: SubscriptionStatus;
  readonly createdAt: Date;
  readonly lastLoginAt: Date;
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
  /**
   * Per-favorite arrival/disruption notification toggle. Optional for
   * backward-compat with existing Firestore documents — `undefined` is
   * interpreted as ON. UI consumers should read this with the
   * `notificationEnabled !== false` pattern.
   */
  readonly notificationEnabled?: boolean;
}

export interface NotificationSettings {
  readonly enabled: boolean;
  readonly delayThresholdMinutes: number;
  readonly quietHours: QuietHours;
  readonly weekdaysOnly: boolean;
  readonly alertTypes: NotificationAlertTypes;
  readonly pushNotifications: boolean;
  readonly emailNotifications: boolean;
  readonly soundSettings: SoundPreferences;
  readonly lineFilter?: readonly string[];        // optional: filter delay alerts by selected line ids. Accepts numeric short codes ('1'..'9') AND full Korean line names ('신분당선', '경의중앙선', '공항철도', '수인분당선', etc) registered in LINE_LABELS aliases (PR #34). undefined/empty = all lines.
  readonly alertSources?: AlertSourcePreferences; // optional: source-based alert toggles (official/community/urgent).
  readonly perEventSound?: PerEventSoundOverrides; // optional: per-event delivery gates for the Wanted handoff "이벤트별" section
}

export interface AlertSourcePreferences {
  readonly official: boolean;   // 공식 운영기관 발표 (Seoul Metro / Korail)
  readonly community: boolean;  // 실시간 제보 (community-sourced reports)
  readonly urgent: boolean;     // 긴급 푸시 (severity-gated push for severe delays)
}

/**
 * Per-event delivery gates for the Wanted handoff "이벤트별" section.
 * Each flag mutes a specific event category. The `Sound` suffix in the
 * interface name is historical — these are full delivery gates (alert is
 * suppressed entirely when off), not just sound mute.
 *
 * Field-to-NotificationType mapping (notificationService.shouldSendNotification):
 * - trainArrival    → NotificationType.ARRIVAL_REMINDER (열차 도착, 3분 전)
 * - delayDetected   → NotificationType.DELAY_ALERT (지연 발생, 실시간 지연).
 *   Note the naming difference from `alertTypes.delays`: `delayDetected` is
 *   a per-event override that gates BEFORE `alertTypes.delays`. Both must
 *   be true to deliver.
 * - communityReport → No NotificationType yet (community reports do not flow
 *   through notificationService). Full community disable is via
 *   `AlertSourcePreferences.community` (PR #40) once that lands.
 */
export interface PerEventSoundOverrides {
  readonly trainArrival: boolean;
  readonly delayDetected: boolean;
  readonly communityReport: boolean;
}

// Sound settings types
export type NotificationSoundId =
  | 'default'
  | 'train_arrival'
  | 'subway_chime'
  | 'gentle_bell'
  | 'urgent_alert'
  | 'silent';

export type VibrationPatternId =
  | 'default'
  | 'short'
  | 'long'
  | 'double'
  | 'triple'
  | 'none';

export interface SoundPreferences {
  readonly soundEnabled: boolean;
  readonly soundId: NotificationSoundId;
  readonly volume: number; // 0-100
  readonly vibrationEnabled: boolean;
  readonly vibrationPattern: VibrationPatternId;
}

export interface QuietHours {
  readonly enabled: boolean;
  readonly startTime: string; // HH:mm format
  readonly endTime: string;   // HH:mm format
  readonly weekendsAlwaysSilent?: boolean; // optional: when true, weekends are silent all day regardless of startTime/endTime
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
  readonly alertEnabled?: boolean;          // optional: master switch for "출퇴근 알림 사용". Defaults to true (existing behavior).
  readonly activeDays?: readonly boolean[]; // optional: 7-element [Mon..Sun] toggles. Defaults to [t,t,t,t,t,f,f] (weekday-only).
  readonly smartFeatures?: SmartFeatures;   // optional: ML/auto-route/auto-departure toggles.
}

export interface SmartFeatures {
  readonly mlPredictionEnabled: boolean;
  readonly autoAlternativeRoutes: boolean;
  readonly autoDepartureDetection: 'always' | 'sometimes' | 'never';
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