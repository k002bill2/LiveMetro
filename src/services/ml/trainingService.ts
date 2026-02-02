/**
 * ML Training Service
 * Handles model training with TensorFlow.js or fallback statistics
 */

import {
  TrainingResult,
  TrainingOptions,
  DEFAULT_TRAINING_OPTIONS,
  MIN_LOGS_FOR_ML_TRAINING,
} from '@/models/ml';
import { CommuteLog } from '@/models/pattern';
import { tensorFlowSetup, getTensorFlow } from './tensorflowSetup';
import { featureExtractor } from './featureExtractor';
import {
  DEFAULT_MODEL_CONFIG,
  createSequence,
} from './modelArchitecture';

// ============================================================================
// Types
// ============================================================================

interface TrainingState {
  isTraining: boolean;
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

type TrainingProgressCallback = (state: TrainingState) => void;

interface TrainingData {
  inputs: number[][][]; // [batch, sequence, features]
  labels: number[][]; // [batch, outputs]
}

// ============================================================================
// Service
// ============================================================================

class TrainingService {
  private trainingState: TrainingState = {
    isTraining: false,
    progress: 0,
    currentEpoch: 0,
    totalEpochs: 0,
    loss: 0,
    accuracy: 0,
  };
  private progressCallbacks: Set<TrainingProgressCallback> = new Set();
  private model: unknown = null;
  private lastTrainingResult: TrainingResult | null = null;

  /**
   * Train or fine-tune the model with user data
   */
  async train(
    logs: readonly CommuteLog[],
    options: Partial<TrainingOptions> = {}
  ): Promise<TrainingResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_TRAINING_OPTIONS, ...options };

    // Check minimum data requirement
    if (logs.length < MIN_LOGS_FOR_ML_TRAINING) {
      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: Date.now() - startTime,
        error: `Insufficient training data. Need at least ${MIN_LOGS_FOR_ML_TRAINING} logs, have ${logs.length}`,
      };
    }

    // Initialize TensorFlow if needed
    await tensorFlowSetup.initialize();

    if (tensorFlowSetup.isAvailable()) {
      return this.trainWithTensorFlow(logs, mergedOptions, startTime);
    } else {
      return this.trainWithFallback(logs, mergedOptions, startTime);
    }
  }

  /**
   * Train using TensorFlow.js
   */
  private async trainWithTensorFlow(
    logs: readonly CommuteLog[],
    options: TrainingOptions,
    startTime: number
  ): Promise<TrainingResult> {
    const tf = getTensorFlow();
    if (!tf) {
      return this.trainWithFallback(logs, options, startTime);
    }

    try {
      this.updateState({
        isTraining: true,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: options.epochs,
        loss: 0,
        accuracy: 0,
      });

      // Prepare training data
      const trainingData = this.prepareTrainingData(logs);

      // Create model if not exists
      if (!this.model) {
        this.model = this.createModel(tf);
      }

      // Convert to tensors
      const inputTensor = tf.tensor3d(trainingData.inputs);
      const labelTensor = tf.tensor2d(trainingData.labels);

      // Train the model
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = this.model as any;
      const history = await model.fit(inputTensor, labelTensor, {
        epochs: options.epochs,
        batchSize: options.batchSize,
        validationSplit: options.validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch: number, epochLogs: { loss?: number; acc?: number }) => {
            this.updateState({
              isTraining: true,
              progress: (epoch + 1) / options.epochs,
              currentEpoch: epoch + 1,
              totalEpochs: options.epochs,
              loss: epochLogs?.loss ?? 0,
              accuracy: epochLogs?.acc ?? 0,
            });
          },
        },
      });

      // Cleanup tensors
      inputTensor.dispose();
      labelTensor.dispose();

      // Get final metrics
      const finalLoss = history.history.loss?.slice(-1)[0] ?? 1;
      const valAcc = history.history.val_acc?.slice(-1)[0] ?? 0;

      this.updateState({
        isTraining: false,
        progress: 1,
        currentEpoch: options.epochs,
        totalEpochs: options.epochs,
        loss: finalLoss as number,
        accuracy: valAcc as number,
      });

      this.lastTrainingResult = {
        success: true,
        epochsCompleted: options.epochs,
        finalLoss: finalLoss as number,
        validationAccuracy: valAcc as number,
        durationMs: Date.now() - startTime,
      };

      return this.lastTrainingResult;
    } catch (error) {
      this.updateState({
        isTraining: false,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0,
        loss: 0,
        accuracy: 0,
      });

      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Training failed',
      };
    }
  }

  /**
   * Create TensorFlow.js model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createModel(tf: any): unknown {
    const config = DEFAULT_MODEL_CONFIG;

    const model = tf.sequential();

    // LSTM layer 1
    model.add(tf.layers.lstm({
      units: config.lstmUnits,
      returnSequences: true,
      inputShape: [config.sequenceLength, config.inputFeatures + 5], // +5 for route embedding
    }));

    model.add(tf.layers.dropout({ rate: config.dropoutRate }));

    // LSTM layer 2
    model.add(tf.layers.lstm({
      units: config.lstmUnits,
      returnSequences: false,
    }));

    model.add(tf.layers.dropout({ rate: config.dropoutRate }));

    // Dense layers
    model.add(tf.layers.dense({
      units: config.denseUnits,
      activation: 'relu',
    }));

    model.add(tf.layers.dense({
      units: config.outputCount,
      activation: 'sigmoid',
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Train using statistics-based fallback
   */
  private async trainWithFallback(
    logs: readonly CommuteLog[],
    options: TrainingOptions,
    startTime: number
  ): Promise<TrainingResult> {
    // Simulate training progress for statistics-based model
    this.updateState({
      isTraining: true,
      progress: 0,
      currentEpoch: 0,
      totalEpochs: options.epochs,
      loss: 0,
      accuracy: 0,
    });

    // Calculate statistics from logs
    const delayRate = logs.filter(l => l.wasDelayed).length / logs.length;
    const accuracy = 1 - delayRate; // Simple accuracy estimate

    // Simulate epoch progress
    for (let epoch = 0; epoch < Math.min(options.epochs, 5); epoch++) {
      await new Promise(resolve => setTimeout(resolve, 100));

      this.updateState({
        isTraining: true,
        progress: (epoch + 1) / options.epochs,
        currentEpoch: epoch + 1,
        totalEpochs: options.epochs,
        loss: 1 - accuracy,
        accuracy,
      });
    }

    this.updateState({
      isTraining: false,
      progress: 1,
      currentEpoch: options.epochs,
      totalEpochs: options.epochs,
      loss: 1 - accuracy,
      accuracy,
    });

    this.lastTrainingResult = {
      success: true,
      epochsCompleted: options.epochs,
      finalLoss: 1 - accuracy,
      validationAccuracy: accuracy,
      durationMs: Date.now() - startTime,
    };

    return this.lastTrainingResult;
  }

  /**
   * Prepare training data from commute logs
   */
  private prepareTrainingData(logs: readonly CommuteLog[]): TrainingData {
    const sequenceLength = DEFAULT_MODEL_CONFIG.sequenceLength;
    const inputs: number[][][] = [];
    const labels: number[][] = [];

    // Extract feature vectors
    const featureResult = featureExtractor.extractFeatures(logs);
    const vectors = featureResult.featureVectors;

    // Create sequences
    for (let i = sequenceLength; i < vectors.length; i++) {
      const sequenceVectors = vectors.slice(i - sequenceLength, i);
      const sequence = createSequence(sequenceVectors, sequenceLength);
      inputs.push(sequence);

      // Create label from the next log
      const nextLog = logs[i];
      if (nextLog) {
        const departureNorm = featureExtractor.normalizeTime(nextLog.departureTime);
        const arrivalNorm = nextLog.arrivalTime
          ? featureExtractor.normalizeTime(nextLog.arrivalTime)
          : departureNorm + 0.05;
        const delayProb = nextLog.wasDelayed ? 1 : 0;

        labels.push([departureNorm, arrivalNorm, delayProb]);
      }
    }

    return { inputs, labels };
  }

  /**
   * Check if model should be retrained
   */
  shouldRetrain(newLogsCount: number): boolean {
    if (!this.lastTrainingResult?.success) return true;
    if (newLogsCount >= 10) return true;
    return false;
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

  /**
   * Get the trained model
   */
  getModel(): unknown {
    return this.model;
  }

  /**
   * Set a pre-trained model
   */
  setModel(model: unknown): void {
    this.model = model;
  }

  /**
   * Get last training result
   */
  getLastResult(): TrainingResult | null {
    return this.lastTrainingResult;
  }

  /**
   * Update training state and notify callbacks
   */
  private updateState(state: TrainingState): void {
    this.trainingState = state;
    this.progressCallbacks.forEach(cb => cb(state));
  }
}

// ============================================================================
// Export
// ============================================================================

export const trainingService = new TrainingService();
export default trainingService;

// Re-export types for convenience
export type { TrainingOptions };
export { DEFAULT_TRAINING_OPTIONS };
