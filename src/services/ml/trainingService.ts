/**
 * ML Training Service
 * TensorFlow is disabled - training is not available
 */

import {
  TrainingResult,
  TrainingOptions,
  DEFAULT_TRAINING_OPTIONS,
  MIN_LOGS_FOR_ML_TRAINING,
} from '@/models/ml';
import { CommuteLog } from '@/models/pattern';

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
   * TensorFlow is disabled - always returns not available
   */
  async train(
    logs: readonly CommuteLog[],
    _options: Partial<TrainingOptions> = {}
  ): Promise<TrainingResult> {
    // Check minimum data requirement for better error message
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

    // TensorFlow is disabled
    return {
      success: false,
      epochsCompleted: 0,
      finalLoss: 1,
      validationAccuracy: 0,
      durationMs: 0,
      error: 'ML training is disabled. Using statistics-based predictions instead.',
    };
  }

  /**
   * Check if model should be retrained
   * Always returns false since TensorFlow is disabled
   */
  shouldRetrain(_newLogsCount: number): boolean {
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
   * Always false since TensorFlow is disabled
   */
  isTraining(): boolean {
    return false;
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
