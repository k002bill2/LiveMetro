/**
 * ML Model Service
 * TensorFlow is disabled - uses statistics-based fallback predictions
 */

import { featureExtractor } from './featureExtractor';
import { commuteDurationMinutes } from '@/services/pattern/commuteDuration';
import { CommuteLog, DayOfWeek } from '@/models/pattern';
import {
  MLPrediction,
  ModelMetadata,
  WeatherCondition,
  createDefaultPrediction,
} from '@/models/ml';

// ============================================================================
// Constants
// ============================================================================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const MINUTES_PER_DAY = 24 * 60;

// ============================================================================
// Types
// ============================================================================

/**
 * OD scope for a prediction. Matching is by station *name* — the log writers'
 * station-id domains diverge (numeric codes vs slugs) while names agree, the
 * same convention as commuteDuration.ts.
 */
interface PredictionRoute {
  originStationName: string;
  destinationStationName: string;
}

interface CachedPrediction {
  prediction: MLPrediction;
  timestamp: number;
  key: string;
}

// ============================================================================
// Service
// ============================================================================

class ModelService {
  private predictionCache: Map<string, CachedPrediction> = new Map();
  private isInitialized = false;
  private metadata: ModelMetadata | null = null;

  /**
   * Initialize the model service
   * TensorFlow is disabled - always uses fallback predictions
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // TensorFlow is disabled, use fallback mode

    this.metadata = {
      version: 'fallback',
      lastTrainedAt: new Date(),
      trainingDataCount: 0,
      accuracy: 0,
      loss: 1,
      isFineTuned: false,
    };

    this.isInitialized = true;
    return true;
  }

  /**
   * Make a prediction for a given date
   * Uses statistics-based fallback since TensorFlow is disabled
   */
  async predict(
    logs: readonly CommuteLog[],
    targetDayOfWeek: DayOfWeek,
    options: {
      weather?: WeatherCondition;
      isHoliday?: boolean;
      useCache?: boolean;
      /** With destinationStationName, scopes the fallback to one OD (by name). */
      originStationName?: string;
      /** With originStationName, scopes the fallback to one OD (by name). */
      destinationStationName?: string;
    } = {}
  ): Promise<MLPrediction> {
    const {
      weather = 'clear',
      isHoliday = false,
      useCache = true,
      originStationName,
      destinationStationName,
    } = options;

    // Route context is all-or-nothing: a half-specified OD cannot scope logs.
    const route: PredictionRoute | undefined =
      originStationName && destinationStationName
        ? { originStationName, destinationStationName }
        : undefined;

    // Generate cache key
    const cacheKey = this.generateCacheKey(logs, targetDayOfWeek, weather, isHoliday, route);

    // Check cache
    if (useCache) {
      const cached = this.getCachedPrediction(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Ensure service is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Use fallback prediction (statistics-based)
    const prediction = this.fallbackPrediction(logs, targetDayOfWeek, route);

    // Cache the prediction
    if (useCache) {
      this.cachePrediction(cacheKey, prediction);
    }

    return prediction;
  }

  /**
   * Get model metadata
   */
  getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  /**
   * Check if model is ready
   * Always returns true in fallback mode
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
  }

  /**
   * Save model - no-op when TensorFlow is disabled
   */
  async saveModel(): Promise<boolean> {
    // No-op in fallback mode
    return false;
  }

  /**
   * Get the underlying model - always returns null when TensorFlow is disabled
   */
  getModel(): unknown | null {
    return null;
  }

  /**
   * Set a new model - no-op when TensorFlow is disabled
   */
  setModel(_model: unknown, _metadata: ModelMetadata): void {
    // No-op in fallback mode
  }

  /**
   * Dispose model and cleanup
   */
  dispose(): void {
    this.predictionCache.clear();
    this.isInitialized = false;
    this.metadata = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fallback prediction using simple statistics
   */
  private fallbackPrediction(
    logs: readonly CommuteLog[],
    targetDayOfWeek: DayOfWeek,
    route?: PredictionRoute
  ): MLPrediction {
    // Filter logs for target day; with route context, additionally to the
    // exact OD — a weekday mixes 출근/퇴근 legs whose averages are meaningless
    // together (the 13:15→13:05 inversion came from exactly that mixture).
    const relevantLogs = logs.filter(
      (log) =>
        log.dayOfWeek === targetDayOfWeek &&
        (!route ||
          (log.departureStationName === route.originStationName &&
            log.arrivalStationName === route.destinationStationName))
    );

    if (relevantLogs.length === 0) {
      // No data for this scope. The default deliberately carries NO route tag
      // even when a route was requested: it is not derived from that OD's
      // logs, so route-aware consumers must not promote it as if it were.
      return createDefaultPrediction('08:00', '08:45');
    }

    // Calculate average departure time
    const departureTimes = relevantLogs.map((log) =>
      featureExtractor.normalizeTime(log.departureTime)
    );
    const avgDeparture =
      departureTimes.reduce((a, b) => a + b, 0) / departureTimes.length;

    // Derive arrival from departure + average *measured duration* — never from
    // an independent arrival-time average. Averaging wall-clock arrivals is not
    // order-preserving once morning and evening logs (or open logs missing an
    // arrival) share a weekday: dep avg 13:15 / arr avg 13:05 reads downstream
    // as a 1430-minute midnight wrap. `% 1` wraps a near-midnight sum so
    // denormalizeTime's clamp cannot distort it.
    const durations = relevantLogs
      .map((log) => commuteDurationMinutes(log))
      .filter((minutes): minutes is number => minutes !== null);
    const avgArrival =
      durations.length > 0
        ? (avgDeparture +
            durations.reduce((a, b) => a + b, 0) / durations.length / MINUTES_PER_DAY) %
          1
        : avgDeparture + 0.05;

    // Calculate delay probability
    const delayRate = featureExtractor.calculateDelayRate(relevantLogs);

    return {
      predictedDepartureTime: featureExtractor.denormalizeTime(avgDeparture),
      predictedArrivalTime: featureExtractor.denormalizeTime(avgArrival),
      delayProbability: delayRate,
      confidence: Math.min(0.5, relevantLogs.length / 10), // Low confidence for fallback
      modelVersion: 'fallback',
      predictedAt: new Date(),
      // Tag the OD the numbers were actually computed from, so consumers can
      // check it against their registered route before promoting the result.
      ...(route ?? {}),
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    logs: readonly CommuteLog[],
    dayOfWeek: DayOfWeek,
    weather: WeatherCondition,
    isHoliday: boolean,
    route?: PredictionRoute
  ): string {
    const today = new Date().toISOString().split('T')[0];
    // Route-less keys keep their historical shape; scoped predictions get an
    // OD suffix so 출근/퇴근 (and route-less) results never replay each other.
    const routeSuffix = route
      ? `_${route.originStationName}→${route.destinationStationName}`
      : '';
    return `${today}_${this.logsFingerprint(logs)}_${dayOfWeek}_${weather}_${isHoliday}${routeSuffix}`;
  }

  /**
   * Content fingerprint of the logs a prediction is computed from.
   *
   * The cache is a module-level singleton, so the key must be scoped both by
   * WHOSE logs feed the numbers (a user-blind key replays user A's cached
   * commute to user B for the same day/weather/OD tuple) and by WHAT those
   * logs currently say. Logs are edited in place — an open commute later
   * receives its arrivalTime, changing the measured durations the arrival is
   * derived from while user/day/weather/route stay identical — and CommuteLog
   * carries no updatedAt to detect that, so the fields the prediction actually
   * reads are folded in directly.
   *
   * Order-sensitive on purpose: a reordered list simply hashes differently and
   * recomputes, which is the safe direction to fail. Hashed (djb2) so the key
   * stays bounded however many logs a user accumulates.
   */
  private logsFingerprint(logs: readonly CommuteLog[]): string {
    let hash = 5381;
    for (const log of logs) {
      const fields = `${log.userId}|${log.dayOfWeek}|${log.departureTime}|${
        log.arrivalTime ?? ''
      }|${log.departureStationName}|${log.arrivalStationName}|${log.wasDelayed}`;
      for (let i = 0; i < fields.length; i += 1) {
        hash = ((hash * 33) ^ fields.charCodeAt(i)) >>> 0;
      }
    }
    return `${logs.length}-${hash.toString(36)}`;
  }

  /**
   * Get cached prediction if valid
   */
  private getCachedPrediction(key: string): MLPrediction | null {
    const cached = this.predictionCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION_MS) {
      this.predictionCache.delete(key);
      return null;
    }

    return cached.prediction;
  }

  /**
   * Cache a prediction
   */
  private cachePrediction(key: string, prediction: MLPrediction): void {
    this.predictionCache.set(key, {
      prediction,
      timestamp: Date.now(),
      key,
    });

    // Limit cache size
    if (this.predictionCache.size > 50) {
      const firstKey = this.predictionCache.keys().next().value;
      if (firstKey) {
        this.predictionCache.delete(firstKey);
      }
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const modelService = new ModelService();
export default modelService;
