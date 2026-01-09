/**
 * Feature Extractor Service
 * Converts commute logs to ML-ready feature vectors
 */

import { tf, tidyOperation, normalize } from './tensorflowSetup';
import { CommuteLog, FrequentRoute, DayOfWeek, parseTimeToMinutes } from '@/models/pattern';
import {
  MLFeatureVector,
  WeatherCondition,
  WEATHER_FEATURE_MAP,
  MODEL_INPUT_FEATURES,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface FeatureExtractionResult {
  readonly features: tf.Tensor2D;
  readonly labels: tf.Tensor2D;
  readonly featureVectors: readonly MLFeatureVector[];
}

export interface ExtractedFeatures {
  readonly inputTensor: tf.Tensor2D;
  readonly featureVector: MLFeatureVector;
}

// ============================================================================
// Constants
// ============================================================================

/** Minutes in a day for normalization */
const MINUTES_IN_DAY = 24 * 60;

/** Route embedding dimension */
const ROUTE_EMBEDDING_DIM = 4;

// ============================================================================
// Service
// ============================================================================

class FeatureExtractorService {
  /**
   * Extract features from a single commute log
   */
  extractSingleFeature(
    log: CommuteLog,
    historicalDelayRate: number = 0,
    recentDelay: boolean = false,
    weather: WeatherCondition = 'clear',
    isHoliday: boolean = false
  ): MLFeatureVector {
    const dayOfWeekCyclic = this.encodeDayOfWeek(log.dayOfWeek);
    const departureTimeNormalized = this.normalizeTime(log.departureTime);
    const arrivalTimeNormalized = log.arrivalTime
      ? this.normalizeTime(log.arrivalTime)
      : departureTimeNormalized + 0.05; // Estimate 30 min commute if no arrival time
    const routeEmbedding = this.embedRoute({
      departureStationId: log.departureStationId,
      departureStationName: log.departureStationName,
      arrivalStationId: log.arrivalStationId,
      arrivalStationName: log.arrivalStationName,
      lineIds: log.lineIds as string[],
    });

    return {
      dayOfWeekCyclic,
      departureTimeNormalized,
      arrivalTimeNormalized,
      routeEmbedding,
      historicalDelayRate: Math.min(1, Math.max(0, historicalDelayRate)),
      recentDelayIndicator: recentDelay ? 1 : 0,
      weatherFeature: WEATHER_FEATURE_MAP[weather],
      holidayFlag: isHoliday ? 1 : 0,
    };
  }

  /**
   * Extract features from multiple commute logs
   * Returns tensors ready for training/inference
   */
  extractFeatures(
    logs: readonly CommuteLog[],
    options: {
      historicalDelayRate?: number;
      weather?: WeatherCondition;
      isHoliday?: boolean;
    } = {}
  ): FeatureExtractionResult {
    const {
      historicalDelayRate = 0,
      weather = 'clear',
      isHoliday = false,
    } = options;

    // Calculate delay rate from logs
    const delayRate = this.calculateDelayRate(logs);

    // Extract feature vectors
    const featureVectors: MLFeatureVector[] = [];
    const inputData: number[][] = [];
    const outputData: number[][] = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!log) continue;

      // Check if previous day had delay
      const recentDelay = i > 0 ? (logs[i - 1]?.wasDelayed ?? false) : false;

      const featureVector = this.extractSingleFeature(
        log,
        historicalDelayRate || delayRate,
        recentDelay,
        weather,
        isHoliday
      );

      featureVectors.push(featureVector);
      inputData.push(this.featureVectorToArray(featureVector));
      outputData.push(this.createOutputVector(log));
    }

    // Create tensors
    const features = tidyOperation(() =>
      tf.tensor2d(inputData, [inputData.length, MODEL_INPUT_FEATURES])
    );

    const labels = tidyOperation(() =>
      tf.tensor2d(outputData, [outputData.length, 3])
    );

    return {
      features,
      labels,
      featureVectors,
    };
  }

  /**
   * Create input tensor for single prediction
   */
  createInputTensor(featureVector: MLFeatureVector): tf.Tensor2D {
    const inputArray = this.featureVectorToArray(featureVector);
    return tidyOperation(() =>
      tf.tensor2d([inputArray], [1, MODEL_INPUT_FEATURES])
    );
  }

  /**
   * Normalize time string (HH:mm) to 0-1 range
   */
  normalizeTime(timeString: string): number {
    const minutes = parseTimeToMinutes(timeString);
    return normalize(minutes, 0, MINUTES_IN_DAY);
  }

  /**
   * Denormalize from 0-1 to time string
   */
  denormalizeTime(normalizedValue: number): string {
    // Clamp value between 0 and 1
    const clamped = Math.max(0, Math.min(1, normalizedValue));
    const minutes = Math.round(clamped * MINUTES_IN_DAY);
    const adjustedMinutes = minutes % MINUTES_IN_DAY; // Handle overflow

    const hours = Math.floor(adjustedMinutes / 60);
    const mins = adjustedMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Encode day of week using cyclic (sin/cos) encoding
   * This preserves the circular nature of days
   */
  encodeDayOfWeek(day: DayOfWeek): readonly [number, number] {
    const angle = (2 * Math.PI * day) / 7;
    return [Math.sin(angle), Math.cos(angle)] as const;
  }

  /**
   * Create a simple route embedding using hash
   */
  embedRoute(route: FrequentRoute): readonly number[] {
    // Create a simple hash-based embedding
    const routeString = `${route.departureStationId}-${route.arrivalStationId}-${route.lineIds.join(',')}`;
    const hash = this.simpleHash(routeString);

    // Create embedding vector from hash
    const embedding: number[] = [];
    for (let i = 0; i < ROUTE_EMBEDDING_DIM; i++) {
      // Use different portions of hash for each dimension
      const portion = (hash >> (i * 8)) & 0xff;
      embedding.push(portion / 255); // Normalize to 0-1
    }

    return embedding;
  }

  /**
   * Calculate delay rate from logs
   */
  calculateDelayRate(logs: readonly CommuteLog[]): number {
    if (logs.length === 0) return 0;
    const delayedCount = logs.filter((log) => log.wasDelayed).length;
    return delayedCount / logs.length;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Convert feature vector to flat array for tensor
   */
  private featureVectorToArray(vector: MLFeatureVector): number[] {
    return [
      vector.dayOfWeekCyclic[0], // sin
      vector.dayOfWeekCyclic[1], // cos
      vector.departureTimeNormalized,
      vector.historicalDelayRate,
      vector.recentDelayIndicator,
      vector.weatherFeature / 4, // Normalize to 0-1
      vector.holidayFlag,
    ];
  }

  /**
   * Create output vector for training (departure time, arrival time, delay probability)
   */
  private createOutputVector(log: CommuteLog): number[] {
    const departureNorm = this.normalizeTime(log.departureTime);
    const arrivalNorm = log.arrivalTime
      ? this.normalizeTime(log.arrivalTime)
      : departureNorm + 0.05;
    const delayProb = log.wasDelayed ? Math.min(1, (log.delayMinutes || 5) / 30) : 0;

    return [departureNorm, arrivalNorm, delayProb];
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// Export
// ============================================================================

export const featureExtractor = new FeatureExtractorService();
export default featureExtractor;
