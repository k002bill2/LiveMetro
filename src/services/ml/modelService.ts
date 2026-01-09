/**
 * ML Model Service
 * Manages model loading, inference, and storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { tf, tensorFlowSetup, disposeTensor } from './tensorflowSetup';
import { featureExtractor } from './featureExtractor';
import { CommuteLog, DayOfWeek } from '@/models/pattern';
import {
  MLPrediction,
  ModelMetadata,
  MLFeatureVector,
  WeatherCondition,
  MODEL_INPUT_FEATURES,
  MODEL_OUTPUT_COUNT,
  createDefaultPrediction,
} from '@/models/ml';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  MODEL_WEIGHTS: '@livemetro:ml_model_weights',
  MODEL_METADATA: '@livemetro:ml_model_metadata',
  PREDICTION_CACHE: '@livemetro:ml_prediction_cache',
};

const MODEL_VERSION = '1.0.0';
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
  private model: tf.LayersModel | null = null;
  private metadata: ModelMetadata | null = null;
  private predictionCache: Map<string, CachedPrediction> = new Map();
  private isInitialized = false;

  /**
   * Initialize the model service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Ensure TensorFlow is ready
      const tfStatus = await tensorFlowSetup.initialize();
      if (!tfStatus.isReady) {
        return false;
      }

      // Try to load saved model, or create new one
      const loaded = await this.loadModel();
      if (!loaded) {
        await this.createDefaultModel();
      }

      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make a prediction for a given date
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

    // Ensure model is ready
    if (!this.model || !this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized || !this.model) {
        return this.fallbackPrediction(logs, targetDayOfWeek);
      }
    }

    // Filter logs for target day
    const relevantLogs = logs.filter((log) => log.dayOfWeek === targetDayOfWeek);

    if (relevantLogs.length === 0) {
      return this.fallbackPrediction(logs, targetDayOfWeek);
    }

    try {
      // Get the most recent log as basis for features
      const latestLog = relevantLogs[relevantLogs.length - 1];
      if (!latestLog) {
        return this.fallbackPrediction(logs, targetDayOfWeek);
      }

      // Calculate historical delay rate
      const delayRate = featureExtractor.calculateDelayRate(relevantLogs);

      // Check if previous log had delay
      const prevLogIndex = logs.indexOf(latestLog) - 1;
      const recentDelay = prevLogIndex >= 0 ? (logs[prevLogIndex]?.wasDelayed ?? false) : false;

      // Extract features
      const featureVector = featureExtractor.extractSingleFeature(
        latestLog,
        delayRate,
        recentDelay,
        weather,
        isHoliday
      );

      // Run inference
      const prediction = await this.runInference(featureVector);

      // Cache the prediction
      if (useCache) {
        this.cachePrediction(cacheKey, prediction);
      }

      return prediction;
    } catch {
      return this.fallbackPrediction(logs, targetDayOfWeek);
    }
  }

  /**
   * Get model metadata
   */
  getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
  }

  /**
   * Save current model to AsyncStorage
   */
  async saveModel(): Promise<boolean> {
    if (!this.model) {
      return false;
    }

    try {
      // Save model using TensorFlow.js IO handler
      await this.model.save(`asyncstorage://${STORAGE_KEYS.MODEL_WEIGHTS}`);

      // Save metadata
      if (this.metadata) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.MODEL_METADATA,
          JSON.stringify({
            ...this.metadata,
            lastTrainedAt: this.metadata.lastTrainedAt.toISOString(),
          })
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the underlying model for training
   */
  getModel(): tf.LayersModel | null {
    return this.model;
  }

  /**
   * Set a new model (after training)
   */
  setModel(model: tf.LayersModel, metadata: ModelMetadata): void {
    // Dispose old model
    if (this.model) {
      this.model.dispose();
    }

    this.model = model;
    this.metadata = metadata;
    this.clearCache();
  }

  /**
   * Dispose model and cleanup
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.metadata = null;
    this.predictionCache.clear();
    this.isInitialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Load model from AsyncStorage
   */
  private async loadModel(): Promise<boolean> {
    try {
      // Load model
      this.model = await tf.loadLayersModel(
        `asyncstorage://${STORAGE_KEYS.MODEL_WEIGHTS}`
      );

      // Load metadata
      const metadataStr = await AsyncStorage.getItem(STORAGE_KEYS.MODEL_METADATA);
      if (metadataStr) {
        const parsed = JSON.parse(metadataStr) as Record<string, unknown>;
        this.metadata = {
          version: String(parsed.version || MODEL_VERSION),
          lastTrainedAt: new Date(String(parsed.lastTrainedAt)),
          trainingDataCount: Number(parsed.trainingDataCount || 0),
          accuracy: Number(parsed.accuracy || 0),
          loss: Number(parsed.loss || 1),
          isFineTuned: Boolean(parsed.isFineTuned),
        };
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a default LSTM model
   */
  private async createDefaultModel(): Promise<void> {
    // Note: Not using tidyOperation here since LayersModel is not a Tensor
    const model = tf.sequential();

    // Input layer + First dense layer
    model.add(
      tf.layers.dense({
        inputShape: [MODEL_INPUT_FEATURES],
        units: 32,
        activation: 'relu',
        name: 'dense_1',
      })
    );

    // Second dense layer
    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        name: 'dense_2',
      })
    );

    // Output layer
    model.add(
      tf.layers.dense({
        units: MODEL_OUTPUT_COUNT,
        activation: 'sigmoid',
        name: 'output',
      })
    );

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });

    this.model = model;

    this.metadata = {
      version: MODEL_VERSION,
      lastTrainedAt: new Date(),
      trainingDataCount: 0,
      accuracy: 0,
      loss: 1,
      isFineTuned: false,
    };
  }

  /**
   * Run inference on feature vector
   */
  private async runInference(featureVector: MLFeatureVector): Promise<MLPrediction> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    let inputTensor: tf.Tensor2D | null = null;
    let outputTensor: tf.Tensor | null = null;

    try {
      // Create input tensor
      inputTensor = featureExtractor.createInputTensor(featureVector);

      // Run prediction
      outputTensor = this.model.predict(inputTensor) as tf.Tensor;

      // Get output values
      const outputData = await outputTensor.data();
      const departureNorm = outputData[0] ?? 0;
      const arrivalNorm = outputData[1] ?? 0;
      const delayProb = outputData[2] ?? 0;

      // Convert back to time strings
      const predictedDepartureTime = featureExtractor.denormalizeTime(departureNorm);
      const predictedArrivalTime = featureExtractor.denormalizeTime(arrivalNorm);

      // Calculate confidence based on model metadata
      const confidence = this.calculateConfidence();

      return {
        predictedDepartureTime,
        predictedArrivalTime,
        delayProbability: Math.min(1, Math.max(0, delayProb)),
        confidence,
        modelVersion: this.metadata?.version || MODEL_VERSION,
        predictedAt: new Date(),
      };
    } finally {
      // Cleanup tensors
      disposeTensor(inputTensor);
      disposeTensor(outputTensor);
    }
  }

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
   * Calculate confidence score
   */
  private calculateConfidence(): number {
    if (!this.metadata) {
      return 0.3;
    }

    // Base confidence on training data and accuracy
    const dataFactor = Math.min(1, this.metadata.trainingDataCount / 50);
    const accuracyFactor = this.metadata.accuracy;
    const fineTunedBonus = this.metadata.isFineTuned ? 0.1 : 0;

    return Math.min(0.95, dataFactor * 0.5 + accuracyFactor * 0.4 + fineTunedBonus);
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
