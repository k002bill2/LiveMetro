/**
 * Machine Learning Types
 * Types for ML-based commute pattern prediction
 */

// ============================================================================
// Core ML Types
// ============================================================================

/**
 * Feature vector for ML model input
 */
export interface MLFeatureVector {
  /** Cyclic encoding of day of week [sin, cos] */
  readonly dayOfWeekCyclic: readonly [number, number];
  /** Normalized departure time (0-1) */
  readonly departureTimeNormalized: number;
  /** Normalized arrival time (0-1) */
  readonly arrivalTimeNormalized: number;
  /** Route embedding hash (4 dimensions) */
  readonly routeEmbedding: readonly number[];
  /** Historical delay rate (0-1) */
  readonly historicalDelayRate: number;
  /** Recent delay indicator (binary) */
  readonly recentDelayIndicator: number;
  /** Weather condition (0-4) */
  readonly weatherFeature: number;
  /** Holiday flag (binary) */
  readonly holidayFlag: number;
}

/**
 * Weather conditions for ML features
 */
export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'fog' | 'other';

/**
 * ML model prediction output
 */
export interface MLPrediction {
  /** Predicted departure time (HH:mm) */
  readonly predictedDepartureTime: string;
  /** Predicted arrival time (HH:mm) */
  readonly predictedArrivalTime: string;
  /** Probability of delay (0-1) */
  readonly delayProbability: number;
  /** Model confidence score (0-1) */
  readonly confidence: number;
  /** Model version used for prediction */
  readonly modelVersion: string;
  /** Timestamp of prediction */
  readonly predictedAt: Date;
}

/**
 * Training result after on-device learning
 */
export interface TrainingResult {
  /** Whether training was successful */
  readonly success: boolean;
  /** Number of epochs completed */
  readonly epochsCompleted: number;
  /** Final loss value */
  readonly finalLoss: number;
  /** Validation accuracy */
  readonly validationAccuracy: number;
  /** Training duration in milliseconds */
  readonly durationMs: number;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Training options for on-device learning
 */
export interface TrainingOptions {
  /** Number of training epochs */
  readonly epochs: number;
  /** Batch size */
  readonly batchSize: number;
  /** Learning rate */
  readonly learningRate: number;
  /** Layers to freeze during transfer learning */
  readonly freezeLayers: readonly string[];
  /** Validation split ratio */
  readonly validationSplit: number;
  /** Early stopping patience */
  readonly earlyStoppingPatience: number;
}

/**
 * Model metadata
 */
export interface ModelMetadata {
  /** Model version */
  readonly version: string;
  /** Date when model was last trained */
  readonly lastTrainedAt: Date;
  /** Number of training samples used */
  readonly trainingDataCount: number;
  /** Model accuracy on validation set */
  readonly accuracy: number;
  /** Model loss on validation set */
  readonly loss: number;
  /** Whether this is the base model or fine-tuned */
  readonly isFineTuned: boolean;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Integrated alert combining all scenarios
 */
export interface IntegratedAlert {
  /** Unique alert ID */
  readonly id: string;
  /** Alert type */
  readonly type: IntegratedAlertType;
  /** Priority level */
  readonly priority: AlertPriority;
  /** Alert title */
  readonly title: string;
  /** Alert body message */
  readonly body: string;
  /** Scheduled time for the alert */
  readonly scheduledTime: string;
  /** ML prediction data */
  readonly prediction: MLPrediction;
  /** Current delay status if any */
  readonly delayStatus: DelayStatus | null;
  /** Train information if applicable */
  readonly trainInfo: TrainAlertInfo | null;
  /** Action buttons */
  readonly actionButtons: readonly AlertAction[];
  /** Created timestamp */
  readonly createdAt: Date;
}

/**
 * Alert types
 */
export type IntegratedAlertType =
  | 'departure'        // Scenario 1: Leave home reminder
  | 'train_arrival'    // Scenario 2: Train arriving soon
  | 'delay_warning'    // Scenario 3: Delay detected, leave early
  | 'integrated';      // Scenario 4: Combined smart alert

/**
 * Alert priority levels
 */
export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Delay status for alerts
 */
export interface DelayStatus {
  /** Whether there's an active delay */
  readonly hasDelay: boolean;
  /** Affected line IDs */
  readonly affectedLines: readonly string[];
  /** Maximum delay in minutes */
  readonly maxDelayMinutes: number;
  /** Delay reason if known */
  readonly reason?: string;
  /** Suggested adjusted departure time */
  readonly adjustedDepartureTime: string;
}

/**
 * Train information for alerts
 */
export interface TrainAlertInfo {
  /** Train number */
  readonly trainNumber: string;
  /** Scheduled arrival time */
  readonly scheduledArrivalTime: string;
  /** Current status */
  readonly status: 'on_time' | 'delayed' | 'approaching' | 'arrived';
  /** Direction */
  readonly direction: 'up' | 'down';
  /** Final destination */
  readonly finalDestination: string;
}

/**
 * Alert action button
 */
export interface AlertAction {
  /** Action ID */
  readonly id: string;
  /** Display label */
  readonly label: string;
  /** Action type */
  readonly type: 'snooze' | 'dismiss' | 'view_details' | 'check_alternatives';
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Departure alert configuration
 */
export interface DepartureAlertConfig {
  /** User ID */
  readonly userId: string;
  /** Minutes before departure to send alert */
  readonly minutesBefore: number;
  /** Whether to include delay predictions */
  readonly includeDelayPrediction: boolean;
  /** Minimum confidence threshold */
  readonly minConfidence: number;
}

/**
 * Train arrival alert configuration
 */
export interface TrainArrivalConfig {
  /** User ID */
  readonly userId: string;
  /** Departure station ID */
  readonly stationId: string;
  /** Line ID */
  readonly lineId: string;
  /** Direction */
  readonly direction: 'up' | 'down';
  /** Minutes before arrival to alert */
  readonly alertMinutesBefore: number;
  /** Polling interval in seconds */
  readonly pollingIntervalSeconds: number;
}

/**
 * Optimal train suggestion
 */
export interface OptimalTrain {
  /** Scheduled departure time */
  readonly scheduledTime: string;
  /** Train number if available */
  readonly trainNumber?: string;
  /** Direction */
  readonly direction: 'up' | 'down';
  /** Confidence score */
  readonly confidence: number;
  /** Alternative trains */
  readonly alternativeTrains: readonly AlternativeTrain[];
}

/**
 * Alternative train option
 */
export interface AlternativeTrain {
  /** Scheduled time */
  readonly scheduledTime: string;
  /** Minutes difference from optimal */
  readonly minutesDifference: number;
  /** Reason for being alternative */
  readonly reason: 'earlier' | 'later' | 'less_crowded';
}

/**
 * Monitoring settings for background alerts
 */
export interface MonitoringSettings {
  /** Enable morning commute monitoring */
  readonly morningEnabled: boolean;
  /** Morning commute start hour (0-23) */
  readonly morningStartHour: number;
  /** Morning commute end hour (0-23) */
  readonly morningEndHour: number;
  /** Enable evening commute monitoring */
  readonly eveningEnabled: boolean;
  /** Evening commute start hour (0-23) */
  readonly eveningStartHour: number;
  /** Evening commute end hour (0-23) */
  readonly eveningEndHour: number;
  /** Days to monitor */
  readonly daysToMonitor: readonly DayOfWeekNumber[];
  /** Polling interval in minutes */
  readonly pollingIntervalMinutes: number;
}

/** Day of week as number (0 = Sunday) */
export type DayOfWeekNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ============================================================================
// Constants
// ============================================================================

/** Minimum logs required for ML training */
export const MIN_LOGS_FOR_ML_TRAINING = 10;

/** Default training options */
export const DEFAULT_TRAINING_OPTIONS: TrainingOptions = {
  epochs: 20,
  batchSize: 8,
  learningRate: 0.001,
  freezeLayers: ['lstm_1', 'lstm_2'],
  validationSplit: 0.2,
  earlyStoppingPatience: 5,
};

/** Default monitoring settings */
export const DEFAULT_MONITORING_SETTINGS: MonitoringSettings = {
  morningEnabled: true,
  morningStartHour: 6,
  morningEndHour: 10,
  eveningEnabled: true,
  eveningStartHour: 17,
  eveningEndHour: 21,
  daysToMonitor: [1, 2, 3, 4, 5], // Weekdays only
  pollingIntervalMinutes: 5,
};

/** Weather condition to feature value mapping */
export const WEATHER_FEATURE_MAP: Record<WeatherCondition, number> = {
  clear: 0,
  rain: 1,
  snow: 2,
  fog: 3,
  other: 4,
};

/** Model input feature count */
export const MODEL_INPUT_FEATURES = 7;

/** Model output count */
export const MODEL_OUTPUT_COUNT = 3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create default ML prediction with low confidence
 */
export function createDefaultPrediction(
  departureTime: string,
  arrivalTime: string
): MLPrediction {
  return {
    predictedDepartureTime: departureTime,
    predictedArrivalTime: arrivalTime,
    delayProbability: 0,
    confidence: 0,
    modelVersion: 'fallback',
    predictedAt: new Date(),
  };
}

/**
 * Check if prediction meets minimum confidence threshold
 */
export function isPredictionReliable(
  prediction: MLPrediction,
  minConfidence: number = 0.5
): boolean {
  return prediction.confidence >= minConfidence;
}

/**
 * Calculate alert priority based on delay status and confidence
 */
export function calculateAlertPriority(
  delayStatus: DelayStatus | null,
  prediction: MLPrediction
): AlertPriority {
  if (delayStatus?.hasDelay && delayStatus.maxDelayMinutes >= 15) {
    return 'urgent';
  }
  if (delayStatus?.hasDelay && delayStatus.maxDelayMinutes >= 5) {
    return 'high';
  }
  if (prediction.delayProbability >= 0.7) {
    return 'high';
  }
  if (prediction.delayProbability >= 0.4) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate unique alert ID
 */
export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
