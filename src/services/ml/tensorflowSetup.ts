/**
 * TensorFlow.js Setup Service
 * Initializes TensorFlow.js for React Native environment
 * Gracefully handles missing native modules (expo-gl)
 */

import { InteractionManager, Platform } from 'react-native';

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
let tf: typeof import('@tensorflow/tfjs') | null = null;
let isTensorFlowAvailable = false;

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
    version: 'unknown',
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
   * Check if TensorFlow is available (native modules present)
   */
  isAvailable(): boolean {
    return isTensorFlowAvailable;
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
    if (tf) {
      tf.disposeVariables();
    }
    isInitialized = false;
    initializationPromise = null;
    this.status = {
      isReady: false,
      backend: 'none',
      version: tf?.version?.tfjs || 'unknown',
    };
  }

  /**
   * Get memory info
   */
  getMemoryInfo(): { numTensors: number; numBytes: number } | null {
    if (tf) {
      return tf.memory();
    }
    return null;
  }

  /**
   * Run a cleanup of unused tensors
   */
  async cleanup(): Promise<void> {
    if (tf) {
      tf.tidy(() => {
        // Empty tidy block to trigger cleanup
      });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async doInitialize(): Promise<TensorFlowStatus> {
    try {
      // Defer TensorFlow initialization until after interactions complete
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve();
        });
      });

      // Dynamically import TensorFlow.js to catch native module errors
      try {
        tf = await import('@tensorflow/tfjs');

        // Try to import React Native bindings (this may fail if expo-gl is not properly linked)
        await import('@tensorflow/tfjs-react-native');

        isTensorFlowAvailable = true;
      } catch (importError) {
        const errorMsg = importError instanceof Error ? importError.message : String(importError);
        console.warn(`TensorFlow.js native modules not available: ${errorMsg}`);
        console.warn('ML features will be disabled. App will continue without ML predictions.');

        this.status = {
          isReady: false,
          backend: 'none',
          version: 'unavailable',
          error: `Native modules not available: ${errorMsg}`,
        };

        isInitialized = true;
        isTensorFlowAvailable = false;
        return this.status;
      }

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
      console.log(`✅ TensorFlow.js initialized with ${backend} backend`);
      return this.status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`TensorFlow.js initialization failed: ${errorMessage}`);

      this.status = {
        isReady: false,
        backend: 'none',
        version: tf?.version?.tfjs || 'unknown',
        error: errorMessage,
      };

      isInitialized = true;
      isTensorFlowAvailable = false;
      return this.status;
    }
  }
}

// ============================================================================
// Utility Functions (safe wrappers)
// ============================================================================

/**
 * Create a tensor from array with proper cleanup handling
 * Returns null if TensorFlow is not available
 */
export function createTensor<R extends number>(
  values: number[] | number[][] | Float32Array,
  shape?: number[],
  dtype?: 'float32' | 'int32' | 'bool'
): unknown | null {
  if (!tf || !isTensorFlowAvailable) {
    console.warn('TensorFlow not available, cannot create tensor');
    return null;
  }
  return tf.tensor(values, shape, dtype);
}

/**
 * Safely dispose a tensor
 */
export function disposeTensor(tensor: unknown | null | undefined): void {
  if (!tf || !tensor) return;
  const t = tensor as { isDisposed?: boolean; dispose?: () => void };
  if (t.dispose && !t.isDisposed) {
    t.dispose();
  }
}

/**
 * Run operations within a tidy block for automatic memory management
 */
export function tidyOperation<T>(fn: () => T): T | null {
  if (!tf || !isTensorFlowAvailable) {
    console.warn('TensorFlow not available, cannot run tidy operation');
    return null;
  }
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

/**
 * Get TensorFlow instance (may be null if not available)
 */
export function getTensorFlow(): typeof import('@tensorflow/tfjs') | null {
  return tf;
}

// ============================================================================
// Export
// ============================================================================

export const tensorFlowSetup = new TensorFlowSetupService();
export default tensorFlowSetup;
