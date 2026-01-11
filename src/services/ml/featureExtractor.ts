/**
 * Feature Extractor Service
 * Converts commute logs to ML-ready feature vectors
 * Pure math implementation (no TensorFlow dependency)
 */

import { normalize } from './tensorflowSetup';
import { CommuteLog, FrequentRoute, DayOfWeek, parseTimeToMinutes } from '@/models/pattern';
import {
  MLFeatureVector,
  WeatherCondition,
  WEATHER_FEATURE_MAP,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

export interface FeatureExtractionResult {
  readonly features: null;
  readonly labels: null;
  readonly featureVectors: readonly MLFeatureVector[];
}

export interface ExtractedFeatures {
  readonly inputTensor: null;
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
   * Returns feature vectors (no tensors since TensorFlow is disabled)
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
    }

    // TensorFlow is disabled - return null for tensors
    return {
      features: null,
      labels: null,
      featureVectors,
    };
  }

  /**
   * Create input tensor for single prediction
   * Always returns null since TensorFlow is disabled
   */
  createInputTensor(_featureVector: MLFeatureVector): null {
    return null;
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
