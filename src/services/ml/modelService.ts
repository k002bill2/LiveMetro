/**
 * ML Model Service
 * TensorFlow is disabled - uses statistics-based fallback predictions
 */

import { featureExtractor } from './featureExtractor';
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

// ============================================================================
// Types
// ============================================================================

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
    console.log('ℹ️ ML Model Service initialized in fallback mode (statistics-based predictions)');

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
    } = {}
  ): Promise<MLPrediction> {
    const { weather = 'clear', isHoliday = false, useCache = true } = options;

    // Generate cache key
    const cacheKey = this.generateCacheKey(targetDayOfWeek, weather, isHoliday);

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
    const prediction = this.fallbackPrediction(logs, targetDayOfWeek);

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
    targetDayOfWeek: DayOfWeek
  ): MLPrediction {
    // Filter logs for target day
    const relevantLogs = logs.filter((log) => log.dayOfWeek === targetDayOfWeek);

    if (relevantLogs.length === 0) {
      // No data, return default
      return createDefaultPrediction('08:00', '08:45');
    }

    // Calculate average departure time
    const departureTimes = relevantLogs.map((log) =>
      featureExtractor.normalizeTime(log.departureTime)
    );
    const avgDeparture =
      departureTimes.reduce((a, b) => a + b, 0) / departureTimes.length;

    // Calculate average arrival time
    const arrivalTimes = relevantLogs
      .filter((log) => log.arrivalTime)
      .map((log) => featureExtractor.normalizeTime(log.arrivalTime!));
    const avgArrival =
      arrivalTimes.length > 0
        ? arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length
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
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    dayOfWeek: DayOfWeek,
    weather: WeatherCondition,
    isHoliday: boolean
  ): string {
    const today = new Date().toISOString().split('T')[0];
    return `${today}_${dayOfWeek}_${weather}_${isHoliday}`;
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
