/**
 * TensorFlow.js Setup Service
 * Initializes TensorFlow.js for React Native environment
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { InteractionManager } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface TensorFlowStatus {
  readonly isReady: boolean;
  readonly backend: string;
  readonly version: string;
  readonly error?: string;
}

// ============================================================================
// State
// ============================================================================

let isInitialized = false;
let initializationPromise: Promise<TensorFlowStatus> | null = null;

// ============================================================================
// Service
// ============================================================================

/**
 * TensorFlow.js Setup Service
 * Manages TensorFlow.js initialization for React Native
 */
class TensorFlowSetupService {
  private status: TensorFlowStatus = {
    isReady: false,
    backend: 'none',
    version: tf.version.tfjs,
  };

  /**
   * Initialize TensorFlow.js
   * Should be called once at app startup
   */
  async initialize(): Promise<TensorFlowStatus> {
    // Return existing promise if initialization is in progress
    if (initializationPromise) {
      return initializationPromise;
    }

    // Return cached status if already initialized
    if (isInitialized) {
      return this.status;
    }

    // Start initialization
    initializationPromise = this.doInitialize();
    return initializationPromise;
  }

  /**
   * Get current TensorFlow status
   */
  getStatus(): TensorFlowStatus {
    return this.status;
  }

  /**
   * Check if TensorFlow is ready
   */
  isReady(): boolean {
    return this.status.isReady;
  }

  /**
   * Get TensorFlow backend name
   */
  getBackend(): string {
    return this.status.backend;
  }

  /**
   * Dispose all tensors and clean up
   */
  dispose(): void {
    tf.disposeVariables();
    isInitialized = false;
    initializationPromise = null;
    this.status = {
      isReady: false,
      backend: 'none',
      version: tf.version.tfjs,
    };
  }

  /**
   * Get memory info
   */
  getMemoryInfo(): tf.MemoryInfo {
    return tf.memory();
  }

  /**
   * Run a cleanup of unused tensors
   */
  async cleanup(): Promise<void> {
    // Force garbage collection on tensors
    tf.tidy(() => {
      // Empty tidy block to trigger cleanup
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async doInitialize(): Promise<TensorFlowStatus> {
    try {
      // Defer TensorFlow initialization until after interactions complete
      // This prevents blocking the UI thread during app startup
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve();
        });
      });

      // Wait for TensorFlow.js to be ready
      await tf.ready();

      // Try to use the React Native backend
      const backend = tf.getBackend();

      this.status = {
        isReady: true,
        backend: backend || 'cpu',
        version: tf.version.tfjs,
      };

      isInitialized = true;
      return this.status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.status = {
        isReady: false,
        backend: 'none',
        version: tf.version.tfjs,
        error: errorMessage,
      };

      // Don't throw, return status with error
      return this.status;
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a tensor from array with proper cleanup handling
 */
export function createTensor<R extends tf.Rank>(
  values: tf.TensorLike,
  shape?: tf.ShapeMap[R],
  dtype?: tf.DataType
): tf.Tensor<R> {
  return tf.tensor(values, shape, dtype) as tf.Tensor<R>;
}

/**
 * Safely dispose a tensor
 */
export function disposeTensor(tensor: tf.Tensor | null | undefined): void {
  if (tensor && !tensor.isDisposed) {
    tensor.dispose();
  }
}

/**
 * Run operations within a tidy block for automatic memory management
 */
export function tidyOperation<T extends tf.TensorContainer>(fn: () => T): T {
  return tf.tidy(fn);
}

/**
 * Normalize a value to 0-1 range
 */
export function normalize(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Denormalize a value from 0-1 range
 */
export function denormalize(
  normalizedValue: number,
  min: number,
  max: number
): number {
  return normalizedValue * (max - min) + min;
}

// ============================================================================
// Export
// ============================================================================

export const tensorFlowSetup = new TensorFlowSetupService();
export default tensorFlowSetup;

// Re-export tf for convenience
export { tf };
