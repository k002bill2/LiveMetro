/**
 * Type definitions for LiveMetro Cloud Functions
 */

// Email notification types (matching frontend NotificationType)
export enum NotificationType {
  DELAY_ALERT = 'DELAY_ALERT',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT',
  SERVICE_UPDATE = 'SERVICE_UPDATE',
  ARRIVAL_REMINDER = 'ARRIVAL_REMINDER',
  COMMUTE_REMINDER = 'COMMUTE_REMINDER',
}

// Request payload for sendEmailNotification function
export interface EmailNotificationRequest {
  type: NotificationType;
  data: EmailNotificationData;
}

// Data payload for different notification types
export interface EmailNotificationData {
  stationName?: string;
  lineName?: string;
  delayMinutes?: number;
  reason?: string;
  message?: string;
  affectedLines?: string[];
  arrivalTime?: string;
}

// Response from sendEmailNotification function
export interface EmailNotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// User data structure from Firestore.
//
// Mirrors the subset of `src/models/user.ts` that Cloud Functions
// read/write. New fields added by the Wanted handoff settings PRs
// (#38–#43) are typed as optional here so existing user documents
// without those keys remain valid; AuthContext.getDefaultPreferences
// seeds them on signup.
export interface UserData {
  id: string;
  email: string;
  displayName: string;
  isAnonymous: boolean;
  preferences: {
    notificationSettings: {
      enabled: boolean;
      emailNotifications: boolean;
      pushNotifications: boolean;
      alertTypes: {
        delays: boolean;
        suspensions: boolean;
        congestion: boolean;
        alternativeRoutes: boolean;
        serviceUpdates: boolean;
      };
      quietHours?: {
        enabled: boolean;
        startTime: string;
        endTime: string;
        weekendsAlwaysSilent?: boolean;
      };
      lineFilter?: readonly string[];
      alertSources?: {
        official: boolean;
        community: boolean;
        urgent: boolean;
      };
      perEventSound?: {
        trainArrival: boolean;
        delayDetected: boolean;
        communityReport: boolean;
      };
    };
    commuteSchedule?: {
      autoDetect: boolean;
      alertEnabled?: boolean;
      activeDays?: readonly boolean[];
      smartFeatures?: {
        mlPredictionEnabled: boolean;
        autoAlternativeRoutes: boolean;
        autoDepartureDetection: 'always' | 'sometimes' | 'never';
      };
    };
  };
}

// SendGrid email template IDs
export interface EmailTemplates {
  delayAlert: string;
  emergencyAlert: string;
  serviceUpdate: string;
}

// Email content structure
export interface EmailContent {
  to: string;
  subject: string;
  html: string;
}
