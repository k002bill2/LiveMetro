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

// User data structure from Firestore
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
