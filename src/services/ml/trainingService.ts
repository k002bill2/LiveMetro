/**
 * ML Training Service
 * Manages on-device model training and fine-tuning
 */

import { tensorFlowSetup, disposeTensor } from './tensorflowSetup';
import { featureExtractor, FeatureExtractionResult } from './featureExtractor';
import { modelService } from './modelService';
import { CommuteLog } from '@/models/pattern';
import {
  TrainingResult,
  TrainingOptions,
  ModelMetadata,
  DEFAULT_TRAINING_OPTIONS,
  MIN_LOGS_FOR_ML_TRAINING,
} from '@/models/ml';

// ============================================================================
// Constants
// ============================================================================

const MODEL_VERSION = '1.0.0';
const MIN_RETRAIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_NEW_LOGS_FOR_RETRAIN = 5;

// ============================================================================
// Types
// ============================================================================

interface TrainingState {
  isTraining: boolean;
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
}

type TrainingProgressCallback = (state: TrainingState) => void;

// ============================================================================
// Service
// ============================================================================

class TrainingService {
  private trainingState: TrainingState = {
    isTraining: false,
    progress: 0,
    currentEpoch: 0,
    totalEpochs: 0,
  };
  private progressCallbacks: Set<TrainingProgressCallback> = new Set();

  /**
   * Train or fine-tune the model with user data
   */
  async train(
    logs: readonly CommuteLog[],
    options: Partial<TrainingOptions> = {}
  ): Promise<TrainingResult> {
    // Check if already training
    if (this.trainingState.isTraining) {
      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: 0,
        error: 'Training already in progress',
      };
    }

    // Check minimum data requirement
    if (logs.length < MIN_LOGS_FOR_ML_TRAINING) {
      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: 0,
        error: `Insufficient training data. Need at least ${MIN_LOGS_FOR_ML_TRAINING} logs, have ${logs.length}`,
      };
    }

    const startTime = Date.now();
    const mergedOptions: TrainingOptions = {
      ...DEFAULT_TRAINING_OPTIONS,
      ...options,
    };

    try {
      // Initialize model if needed
      await modelService.initialize();

      // Update training state
      this.updateTrainingState({
        isTraining: true,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: mergedOptions.epochs,
      });

      // Extract features
      const features = featureExtractor.extractFeatures(logs);

      // Perform training
      const result = await this.performTraining(features, mergedOptions);

      const durationMs = Date.now() - startTime;

      return {
        ...result,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        epochsCompleted: this.trainingState.currentEpoch,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    } finally {
      this.updateTrainingState({
        isTraining: false,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0,
      });
    }
  }

  /**
   * Check if model should be retrained
   */
  shouldRetrain(newLogsCount: number): boolean {
    const metadata = modelService.getMetadata();

    // Always train if no model exists
    if (!metadata) {
      return newLogsCount >= MIN_LOGS_FOR_ML_TRAINING;
    }

    // Check time since last training
    const timeSinceLastTrain = Date.now() - metadata.lastTrainedAt.getTime();
    if (timeSinceLastTrain < MIN_RETRAIN_INTERVAL_MS) {
      return false;
    }

    // Check if enough new logs
    return newLogsCount >= MIN_NEW_LOGS_FOR_RETRAIN;
  }

  /**
   * Get current training state
   */
  getTrainingState(): TrainingState {
    return { ...this.trainingState };
  }

  /**
   * Subscribe to training progress updates
   */
  onProgress(callback: TrainingProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Check if training is in progress
   */
  isTraining(): boolean {
    return this.trainingState.isTraining;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Perform the actual training
   */
  private async performTraining(
    features: FeatureExtractionResult,
    options: TrainingOptions
  ): Promise<Omit<TrainingResult, 'durationMs'>> {
    const model = modelService.getModel();
    if (!model) {
      throw new Error('Model not initialized');
    }

    // Ensure TensorFlow is ready
    const tfStatus = await tensorFlowSetup.initialize();
    if (!tfStatus.isReady) {
      throw new Error('TensorFlow not ready');
    }

    let bestLoss = Infinity;
    let epochsWithoutImprovement = 0;

    try {
      // Train the model
      const history = await model.fit(features.features, features.labels, {
        epochs: options.epochs,
        batchSize: options.batchSize,
        validationSplit: options.validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch: number, logs?: { loss?: number; val_loss?: number }) => {
            const loss = logs?.loss ?? 1;
            const valLoss = logs?.val_loss ?? loss;

            // Update best loss
            if (valLoss < bestLoss) {
              bestLoss = valLoss;
              epochsWithoutImprovement = 0;
            } else {
              epochsWithoutImprovement++;
            }

            // Update progress
            this.updateTrainingState({
              isTraining: true,
              progress: (epoch + 1) / options.epochs,
              currentEpoch: epoch + 1,
              totalEpochs: options.epochs,
            });

            // Early stopping
            if (epochsWithoutImprovement >= options.earlyStoppingPatience) {
              model.stopTraining = true;
            }
          },
        },
      });

      // Get final metrics
      const finalLoss = history.history.loss?.[history.history.loss.length - 1] ?? 1;
      const valLoss = history.history.val_loss?.[history.history.val_loss.length - 1] ?? finalLoss;

      // Calculate accuracy from loss (inverse relationship for MSE)
      const accuracy = Math.max(0, 1 - (typeof valLoss === 'number' ? valLoss : 1));

      // Update model metadata
      const metadata: ModelMetadata = {
        version: MODEL_VERSION,
        lastTrainedAt: new Date(),
        trainingDataCount: features.featureVectors.length,
        accuracy,
        loss: typeof finalLoss === 'number' ? finalLoss : 1,
        isFineTuned: true,
      };

      // Update model service
      modelService.setModel(model, metadata);

      // Save model
      await modelService.saveModel();

      return {
        success: true,
        epochsCompleted: history.epoch.length,
        finalLoss: typeof finalLoss === 'number' ? finalLoss : 1,
        validationAccuracy: accuracy,
      };
    } finally {
      // Cleanup tensors
      disposeTensor(features.features);
      disposeTensor(features.labels);
    }
  }

  /**
   * Update training state and notify callbacks
   */
  private updateTrainingState(state: Partial<TrainingState>): void {
    this.trainingState = {
      ...this.trainingState,
      ...state,
    };

    // Notify callbacks
    for (const callback of this.progressCallbacks) {
      try {
        callback(this.trainingState);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const trainingService = new TrainingService();
export default trainingService;
