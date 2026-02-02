/**
 * TensorFlow.js Setup Service
 * Provides TensorFlow.js integration with fallback for environments where it's unavailable
 */

// ============================================================================
// Types
// ============================================================================

export interface TensorFlowStatus {
  readonly isReady: boolean;
  readonly backend: string;
  readonly version: string;
  readonly error?: string;
  readonly mode: 'tensorflow' | 'fallback';
}

export interface TensorLike {
  readonly shape: readonly number[];
  readonly dtype: string;
  data(): Promise<Float32Array | Int32Array | Uint8Array>;
  dispose(): void;
}

// TensorFlow.js 타입 정의 (모듈이 없을 때를 위한 인터페이스)
interface TensorFlowModule {
  ready(): Promise<void>;
  getBackend(): string | null;
  version: { tfjs?: string };
  memory(): { numTensors: number; numBytes: number };
  disposeVariables(): void;
  tensor(values: number[], shape?: number[], dtype?: string): TensorLike;
  tensor2d(values: number[][], shape?: [number, number]): TensorLike;
  tensor3d(values: number[][][], shape?: [number, number, number]): TensorLike;
  tidy<T>(fn: () => T): T;
}

// ============================================================================
// TensorFlow.js Dynamic Import
// ============================================================================

let tf: TensorFlowModule | null = null;
let tfInitialized = false;

/**
 * Try to load TensorFlow.js dynamically
 */
async function loadTensorFlow(): Promise<TensorFlowModule | null> {
  if (tf) return tf;

  try {
    // Dynamic import to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tfModule = require('@tensorflow/tfjs') as TensorFlowModule;

    // Try to load React Native backend if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@tensorflow/tfjs-react-native');
      await tfModule.ready();
    } catch {
      // React Native backend not available, use default
      await tfModule.ready();
    }

    tf = tfModule;
    return tf;
  } catch {
    console.log('ℹ️ TensorFlow.js not available, using fallback mode');
    return null;
  }
}

// ============================================================================
// Service
// ============================================================================

/**
 * TensorFlow.js Setup Service
 * Attempts to initialize TensorFlow.js, falls back to statistics-based predictions
 */
class TensorFlowSetupService {
  private status: TensorFlowStatus = {
    isReady: false,
    backend: 'none',
    version: 'unknown',
    mode: 'fallback',
  };

  /**
   * Initialize TensorFlow.js
   */
  async initialize(): Promise<TensorFlowStatus> {
    if (tfInitialized) {
      return this.status;
    }

    try {
      const tfModule = await loadTensorFlow();

      if (tfModule) {
        this.status = {
          isReady: true,
          backend: tfModule.getBackend() || 'cpu',
          version: tfModule.version.tfjs || 'unknown',
          mode: 'tensorflow',
        };
        console.log(`✅ TensorFlow.js initialized (backend: ${this.status.backend})`);
      } else {
        this.status = {
          isReady: true,
          backend: 'statistics',
          version: 'fallback',
          mode: 'fallback',
        };
        console.log('ℹ️ Using statistics-based fallback predictions');
      }
    } catch (error) {
      this.status = {
        isReady: true,
        backend: 'statistics',
        version: 'fallback',
        mode: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.log('ℹ️ TensorFlow.js initialization failed, using fallback');
    }

    tfInitialized = true;
    return this.status;
  }

  /**
   * Get current TensorFlow status
   */
  getStatus(): TensorFlowStatus {
    return this.status;
  }

  /**
   * Check if TensorFlow is ready (either mode)
   */
  isReady(): boolean {
    return this.status.isReady;
  }

  /**
   * Check if TensorFlow.js is available (not fallback)
   */
  isAvailable(): boolean {
    return this.status.mode === 'tensorflow' && tf !== null;
  }

  /**
   * Check if using fallback mode
   */
  isFallbackMode(): boolean {
    return this.status.mode === 'fallback';
  }

  /**
   * Get TensorFlow backend name
   */
  getBackend(): string {
    return this.status.backend;
  }

  /**
   * Get TensorFlow.js instance (null if fallback mode)
   */
  getTf(): TensorFlowModule | null {
    return tf;
  }

  /**
   * Dispose all tensors - cleanup
   */
  dispose(): void {
    if (tf) {
      tf.disposeVariables();
    }
  }

  /**
   * Get memory info
   */
  getMemoryInfo(): { numTensors: number; numBytes: number } | null {
    if (!tf) return null;
    const memory = tf.memory();
    return {
      numTensors: memory.numTensors,
      numBytes: memory.numBytes,
    };
  }

  /**
   * Cleanup and reset
   */
  async cleanup(): Promise<void> {
    if (tf) {
      tf.disposeVariables();
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a tensor
 */
export function createTensor(
  values: number[] | number[][] | Float32Array,
  shape?: number[],
  dtype?: 'float32' | 'int32' | 'bool'
): TensorLike | null {
  if (!tf) return null;

  try {
    if (shape) {
      return tf.tensor(values as number[], shape, dtype) as unknown as TensorLike;
    }
    return tf.tensor(values as number[], undefined, dtype) as unknown as TensorLike;
  } catch {
    return null;
  }
}

/**
 * Create a 2D tensor
 */
export function createTensor2d(
  values: number[][],
  shape?: [number, number]
): TensorLike | null {
  if (!tf) return null;

  try {
    return tf.tensor2d(values, shape) as unknown as TensorLike;
  } catch {
    return null;
  }
}

/**
 * Create a 3D tensor (for sequences)
 */
export function createTensor3d(
  values: number[][][],
  shape?: [number, number, number]
): TensorLike | null {
  if (!tf) return null;

  try {
    return tf.tensor3d(values, shape) as unknown as TensorLike;
  } catch {
    return null;
  }
}

/**
 * Safely dispose a tensor
 */
export function disposeTensor(tensor: TensorLike | null | undefined): void {
  if (tensor && typeof tensor.dispose === 'function') {
    tensor.dispose();
  }
}

/**
 * Run operations within a tidy block (auto-cleanup)
 */
export function tidyOperation<T>(fn: () => T): T | null {
  if (!tf) {
    try {
      return fn();
    } catch {
      return null;
    }
  }

  try {
    return tf.tidy(fn);
  } catch {
    return null;
  }
}

/**
 * Normalize a value to 0-1 range
 * Pure math function - works without TensorFlow
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
 * Pure math function - works without TensorFlow
 */
export function denormalize(
  normalizedValue: number,
  min: number,
  max: number
): number {
  return normalizedValue * (max - min) + min;
}

/**
 * Get TensorFlow instance
 */
export function getTensorFlow(): TensorFlowModule | null {
  return tf;
}

/**
 * Check if TensorFlow is available
 */
export function isTensorFlowAvailable(): boolean {
  return tf !== null;
}

// ============================================================================
// Export
// ============================================================================

export const tensorFlowSetup = new TensorFlowSetupService();
export default tensorFlowSetup;
