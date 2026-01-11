/**
 * TensorFlow.js Setup Service
 * TensorFlow is disabled due to Expo Managed Workflow compatibility
 * This module provides stub implementations for type safety
 */

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
// Service
// ============================================================================

/**
 * TensorFlow.js Setup Service
 * Currently disabled - always returns unavailable status
 */
class TensorFlowSetupService {
  private status: TensorFlowStatus = {
    isReady: false,
    backend: 'none',
    version: 'unavailable',
    error: 'TensorFlow disabled for Expo Managed Workflow compatibility',
  };

  /**
   * Initialize TensorFlow.js
   * Always returns unavailable status
   */
  async initialize(): Promise<TensorFlowStatus> {
    console.log('ℹ️ TensorFlow is disabled. Using statistics-based fallback predictions.');
    return this.status;
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
    return false;
  }

  /**
   * Check if TensorFlow is available
   */
  isAvailable(): boolean {
    return false;
  }

  /**
   * Get TensorFlow backend name
   */
  getBackend(): string {
    return 'none';
  }

  /**
   * Dispose - no-op when TensorFlow is disabled
   */
  dispose(): void {
    // No-op
  }

  /**
   * Get memory info - always returns null when disabled
   */
  getMemoryInfo(): { numTensors: number; numBytes: number } | null {
    return null;
  }

  /**
   * Cleanup - no-op when TensorFlow is disabled
   */
  async cleanup(): Promise<void> {
    // No-op
  }
}

// ============================================================================
// Utility Functions (safe stubs)
// ============================================================================

/**
 * Create a tensor - always returns null when TensorFlow is disabled
 */
export function createTensor(
  _values: number[] | number[][] | Float32Array,
  _shape?: number[],
  _dtype?: 'float32' | 'int32' | 'bool'
): unknown | null {
  return null;
}

/**
 * Safely dispose a tensor - no-op when TensorFlow is disabled
 */
export function disposeTensor(_tensor: unknown | null | undefined): void {
  // No-op
}

/**
 * Run operations within a tidy block - always returns null when TensorFlow is disabled
 */
export function tidyOperation<T>(_fn: () => T): T | null {
  return null;
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
 * Get TensorFlow instance - always returns null when disabled
 */
export function getTensorFlow(): null {
  return null;
}

// ============================================================================
// Export
// ============================================================================

export const tensorFlowSetup = new TensorFlowSetupService();
export default tensorFlowSetup;
