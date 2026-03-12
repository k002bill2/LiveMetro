/**
 * TensorFlow Setup Service Tests
 */

import {
  tensorFlowSetup,
  createTensor,
  createTensor2d,
  createTensor3d,
  disposeTensor,
  tidyOperation,
  normalize,
  denormalize,
  getTensorFlow,
  isTensorFlowAvailable,
} from '../tensorflowSetup';

describe('TensorFlowSetupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should return fallback status when TensorFlow not available', async () => {
      const status = await tensorFlowSetup.initialize();

      // Service should be ready in fallback mode
      expect(status.isReady).toBe(true);
      expect(status.mode).toBe('fallback');
      expect(status.backend).toBe('statistics');
      expect(status.version).toBe('fallback');
    });

    it('should cache initialization result on subsequent calls', async () => {
      const status1 = await tensorFlowSetup.initialize();
      const status2 = await tensorFlowSetup.initialize();

      expect(status1).toEqual(status2);
    });

    it('should set isReady to true in fallback mode', async () => {
      const status = await tensorFlowSetup.initialize();
      expect(status.isReady).toBe(true);
    });

    it('should not have error field when successful', async () => {
      const status = await tensorFlowSetup.initialize();
      expect(status.error).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = tensorFlowSetup.getStatus();

      expect(status).toHaveProperty('isReady');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('version');
    });

    it('should return status with all required properties', () => {
      const status = tensorFlowSetup.getStatus();
      expect(typeof status.isReady).toBe('boolean');
      expect(typeof status.backend).toBe('string');
      expect(typeof status.version).toBe('string');
      expect(['tensorflow', 'fallback']).toContain(status.mode);
    });
  });

  describe('isReady', () => {
    it('should return true after initialization (fallback mode)', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.isReady()).toBe(true);
    });

    it('should return isReady status', () => {
      const ready = tensorFlowSetup.isReady();
      expect(typeof ready).toBe('boolean');
    });
  });

  describe('isAvailable', () => {
    it('should return false when TensorFlow is not installed', () => {
      expect(tensorFlowSetup.isAvailable()).toBe(false);
    });

    it('should return boolean', () => {
      const available = tensorFlowSetup.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('isFallbackMode', () => {
    it('should return true when using fallback', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.isFallbackMode()).toBe(true);
    });

    it('should return boolean', () => {
      const fallback = tensorFlowSetup.isFallbackMode();
      expect(typeof fallback).toBe('boolean');
    });
  });

  describe('getBackend', () => {
    it('should return "statistics" in fallback mode', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.getBackend()).toBe('statistics');
    });

    it('should return string', async () => {
      await tensorFlowSetup.initialize();
      const backend = tensorFlowSetup.getBackend();
      expect(typeof backend).toBe('string');
    });
  });

  describe('getTf', () => {
    it('should return null in fallback mode', () => {
      expect(tensorFlowSetup.getTf()).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should be a no-op in fallback mode', () => {
      expect(() => tensorFlowSetup.dispose()).not.toThrow();
    });

    it('should not throw error', () => {
      tensorFlowSetup.dispose();
      // Test passes if no error thrown
      expect(true).toBe(true);
    });
  });

  describe('getMemoryInfo', () => {
    it('should return null in fallback mode', () => {
      expect(tensorFlowSetup.getMemoryInfo()).toBeNull();
    });

    it('should return null when TensorFlow is not available', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.getMemoryInfo()).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should be a no-op in fallback mode', async () => {
      await expect(tensorFlowSetup.cleanup()).resolves.not.toThrow();
    });

    it('should complete without error', async () => {
      await tensorFlowSetup.cleanup();
      expect(true).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  describe('createTensor', () => {
    it('should return null when TensorFlow not available', () => {
      expect(createTensor([1, 2, 3])).toBeNull();
      expect(createTensor([[1, 2], [3, 4]], [2, 2])).toBeNull();
    });

    it('should handle various input types', () => {
      // All should return null in fallback mode
      expect(createTensor([1, 2, 3])).toBeNull();
      expect(createTensor(new Float32Array([1, 2, 3]))).toBeNull();
      expect(createTensor([1, 2, 3], [3])).toBeNull();
    });

    it('should handle different dtypes', () => {
      expect(createTensor([1, 2, 3], undefined, 'float32')).toBeNull();
      expect(createTensor([1, 2], undefined, 'int32')).toBeNull();
      expect(createTensor([1, 0], undefined, 'bool')).toBeNull();
    });

    it('should handle empty arrays', () => {
      expect(createTensor([])).toBeNull();
    });

    it('should handle 2D arrays', () => {
      expect(createTensor([[1, 2], [3, 4]], [2, 2])).toBeNull();
    });
  });

  describe('createTensor2d', () => {
    it('should return null when TensorFlow not available', () => {
      expect(createTensor2d([[1, 2], [3, 4]])).toBeNull();
    });

    it('should handle basic 2D arrays', () => {
      expect(createTensor2d([[1, 2], [3, 4], [5, 6]])).toBeNull();
    });

    it('should handle shape parameter', () => {
      expect(createTensor2d([[1, 2], [3, 4]], [2, 2])).toBeNull();
    });

    it('should handle different matrix sizes', () => {
      expect(createTensor2d([[1], [2], [3], [4]])).toBeNull();
      expect(createTensor2d([[1, 2, 3, 4]])).toBeNull();
    });

    it('should handle empty 2D array', () => {
      expect(createTensor2d([])).toBeNull();
    });
  });

  describe('createTensor3d', () => {
    it('should return null when TensorFlow not available', () => {
      expect(createTensor3d([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])).toBeNull();
    });

    it('should handle basic 3D arrays', () => {
      expect(createTensor3d([[[1, 2], [3, 4]]])).toBeNull();
    });

    it('should handle shape parameter', () => {
      expect(createTensor3d([[[1, 2], [3, 4]]], [1, 2, 2])).toBeNull();
    });

    it('should handle larger 3D tensors', () => {
      const values = [[[1, 2], [3, 4]], [[5, 6], [7, 8]]];
      expect(createTensor3d(values, [2, 2, 2])).toBeNull();
    });

    it('should handle empty 3D array', () => {
      expect(createTensor3d([])).toBeNull();
    });
  });

  describe('disposeTensor', () => {
    it('should be a no-op for null/undefined', () => {
      expect(() => disposeTensor(null)).not.toThrow();
      expect(() => disposeTensor(undefined)).not.toThrow();
    });

    it('should call dispose on tensor-like objects', () => {
      const mockDispose = jest.fn();
      const mockTensor = {
        shape: [2, 2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([1, 2, 3, 4])),
        dispose: mockDispose,
      };
      disposeTensor(mockTensor);
      expect(mockDispose).toHaveBeenCalled();
    });

    it('should handle objects without dispose function', () => {
      const mockTensor = {
        shape: [2, 2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([1, 2, 3, 4])),
      };
      expect(() => disposeTensor(mockTensor as any)).not.toThrow();
    });

    it('should handle dispose being non-function', () => {
      const mockTensor = {
        shape: [2, 2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([1, 2, 3, 4])),
        dispose: 'not a function',
      };
      expect(() => disposeTensor(mockTensor as any)).not.toThrow();
    });

    it('should call dispose exactly once', () => {
      const mockDispose = jest.fn();
      const mockTensor = {
        shape: [2, 2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([1, 2, 3, 4])),
        dispose: mockDispose,
      };
      disposeTensor(mockTensor);
      expect(mockDispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('tidyOperation', () => {
    it('should execute function directly in fallback mode', () => {
      const result = tidyOperation(() => 'value');
      expect(result).toBe('value');
    });

    it('should return null on error', () => {
      const result = tidyOperation(() => {
        throw new Error('test error');
      });
      expect(result).toBeNull();
    });

    it('should handle function returning different types', () => {
      expect(tidyOperation(() => 42)).toBe(42);
      expect(tidyOperation(() => true)).toBe(true);
      expect(tidyOperation(() => ({ a: 1 }))).toEqual({ a: 1 });
      expect(tidyOperation(() => [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should handle function returning null', () => {
      expect(tidyOperation(() => null)).toBeNull();
    });

    it('should handle function returning undefined', () => {
      expect(tidyOperation(() => undefined)).toBeUndefined();
    });

    it('should catch errors thrown in function', () => {
      const result = tidyOperation(() => {
        throw new Error('Intentional error');
      });
      expect(result).toBeNull();
    });

    it('should handle complex operations', () => {
      const result = tidyOperation(() => {
        const arr = [1, 2, 3];
        return arr.reduce((a, b) => a + b, 0);
      });
      expect(result).toBe(6);
    });
  });

  describe('normalize', () => {
    it('should normalize value to 0-1 range', () => {
      expect(normalize(50, 0, 100)).toBe(0.5);
      expect(normalize(0, 0, 100)).toBe(0);
      expect(normalize(100, 0, 100)).toBe(1);
    });

    it('should handle negative ranges', () => {
      expect(normalize(0, -50, 50)).toBe(0.5);
      expect(normalize(-50, -50, 50)).toBe(0);
      expect(normalize(50, -50, 50)).toBe(1);
    });

    it('should return 0 when min equals max', () => {
      expect(normalize(50, 50, 50)).toBe(0);
      expect(normalize(0, 0, 0)).toBe(0);
    });

    it('should handle floating point values', () => {
      expect(normalize(1.5, 0, 3)).toBe(0.5);
      expect(normalize(0.25, 0, 1)).toBe(0.25);
    });

    it('should handle values outside range', () => {
      expect(normalize(-10, 0, 100)).toBe(-0.1);
      expect(normalize(150, 0, 100)).toBe(1.5);
    });

    it('should handle fractional ranges', () => {
      expect(normalize(0.5, 0, 1)).toBe(0.5);
      expect(normalize(0.25, 0, 1)).toBe(0.25);
    });
  });

  describe('denormalize', () => {
    it('should denormalize from 0-1 range', () => {
      expect(denormalize(0.5, 0, 100)).toBe(50);
      expect(denormalize(0, 0, 100)).toBe(0);
      expect(denormalize(1, 0, 100)).toBe(100);
    });

    it('should handle negative ranges', () => {
      expect(denormalize(0.5, -50, 50)).toBe(0);
      expect(denormalize(0, -50, 50)).toBe(-50);
      expect(denormalize(1, -50, 50)).toBe(50);
    });

    it('should handle floating point values', () => {
      expect(denormalize(0.25, 0, 100)).toBe(25);
      expect(denormalize(0.75, 0, 100)).toBe(75);
    });

    it('should handle values outside 0-1 range', () => {
      expect(denormalize(1.5, 0, 100)).toBe(150);
      expect(denormalize(-0.5, 0, 100)).toBe(-50);
    });

    it('should be inverse of normalize', () => {
      const min = 10;
      const max = 90;
      const value = 50;
      const normalized = normalize(value, min, max);
      const denormalized = denormalize(normalized, min, max);
      expect(denormalized).toBeCloseTo(value);
    });

    it('should handle fractional ranges', () => {
      expect(denormalize(0.5, 0, 1)).toBeCloseTo(0.5);
      expect(denormalize(0.25, 0, 1)).toBeCloseTo(0.25);
    });
  });

  describe('getTensorFlow', () => {
    it('should return null when TensorFlow not installed', () => {
      expect(getTensorFlow()).toBeNull();
    });

    it('should return TensorFlowModule type or null', () => {
      const tf = getTensorFlow();
      expect(tf === null || typeof tf === 'object').toBe(true);
    });
  });

  describe('isTensorFlowAvailable', () => {
    it('should return false when TensorFlow not installed', () => {
      expect(isTensorFlowAvailable()).toBe(false);
    });

    it('should return boolean', () => {
      const available = isTensorFlowAvailable();
      expect(typeof available).toBe('boolean');
    });
  });
});

describe('Integration Tests', () => {
  describe('TensorFlowSetupService initialization flow', () => {
    it('should have fallback mode enabled by default', () => {
      const status = tensorFlowSetup.getStatus();
      expect(status.mode).toBe('fallback');
      expect(status.isReady).toBe(true);
    });

    it('should not be available when TensorFlow is not loaded', () => {
      expect(tensorFlowSetup.isAvailable()).toBe(false);
      expect(tensorFlowSetup.getTf()).toBeNull();
    });

    it('should return consistent status after multiple calls', () => {
      const status1 = tensorFlowSetup.getStatus();
      const status2 = tensorFlowSetup.getStatus();
      const status3 = tensorFlowSetup.getStatus();

      expect(status1).toEqual(status2);
      expect(status2).toEqual(status3);
    });

    it('should return consistent backend name', () => {
      const backend1 = tensorFlowSetup.getBackend();
      const backend2 = tensorFlowSetup.getBackend();
      expect(backend1).toBe(backend2);
    });
  });

  describe('Tensor creation and disposal flow', () => {
    it('should gracefully handle tensor creation without TensorFlow', () => {
      const tensor1d = createTensor([1, 2, 3, 4, 5]);
      const tensor2d = createTensor2d([[1, 2], [3, 4]]);
      const tensor3d = createTensor3d([[[1, 2], [3, 4]]]);

      expect(tensor1d).toBeNull();
      expect(tensor2d).toBeNull();
      expect(tensor3d).toBeNull();
    });

    it('should safely dispose multiple tensors', () => {
      const mockDispose1 = jest.fn();
      const mockDispose2 = jest.fn();
      const tensor1 = {
        shape: [2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([1, 2])),
        dispose: mockDispose1,
      };
      const tensor2 = {
        shape: [2],
        dtype: 'float32',
        data: () => Promise.resolve(new Float32Array([3, 4])),
        dispose: mockDispose2,
      };

      disposeTensor(tensor1);
      disposeTensor(tensor2);

      expect(mockDispose1).toHaveBeenCalledTimes(1);
      expect(mockDispose2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Normalization utilities', () => {
    it('normalize and denormalize should be inverse operations', () => {
      const testCases = [
        { value: 25, min: 0, max: 100 },
        { value: -10, min: -20, max: 20 },
        { value: 0.5, min: 0, max: 1 },
        { value: 1000, min: 0, max: 2000 },
      ];

      testCases.forEach(({ value, min, max }) => {
        const normalized = normalize(value, min, max);
        const denormalized = denormalize(normalized, min, max);
        expect(denormalized).toBeCloseTo(value, 5);
      });
    });

    it('should handle edge cases in normalization', () => {
      // Zero range
      expect(normalize(5, 5, 5)).toBe(0);

      // Single point
      expect(normalize(10, 10, 10)).toBe(0);

      // Large range
      expect(normalize(500, 0, 1000)).toBe(0.5);
    });

    it('should handle edge cases in denormalization', () => {
      // Zero at start
      expect(denormalize(0, 100, 200)).toBe(100);

      // One at end
      expect(denormalize(1, 100, 200)).toBe(200);

      // Large range
      expect(denormalize(0.5, 0, 1000000)).toBe(500000);
    });
  });

  describe('Error handling in tidyOperation', () => {
    it('should handle synchronous errors gracefully', () => {
      const result = tidyOperation(() => {
        throw new Error('Sync error');
      });
      expect(result).toBeNull();
    });

    it('should handle errors from nested function calls', () => {
      const result = tidyOperation(() => {
        const fn = () => {
          throw new Error('Nested error');
        };
        return fn();
      });
      expect(result).toBeNull();
    });

    it('should execute successful operations without catching', () => {
      const operation = jest.fn(() => 42);
      const result = tidyOperation(operation);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result).toBe(42);
    });

    it('should handle operations with side effects', () => {
      const sideEffect = jest.fn();
      const result = tidyOperation(() => {
        sideEffect();
        return 'success';
      });
      expect(sideEffect).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });
  });

  describe('Service state consistency', () => {
    it('should maintain status immutability', () => {
      const status = tensorFlowSetup.getStatus();
      const originalStatus = { ...status };

      tensorFlowSetup.dispose();
      tensorFlowSetup.cleanup();

      const newStatus = tensorFlowSetup.getStatus();
      expect(newStatus).toEqual(originalStatus);
    });

    it('should have all required status fields', () => {
      const status = tensorFlowSetup.getStatus();
      expect(status).toHaveProperty('isReady');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('mode');
    });

    it('should not have error when in fallback mode', () => {
      const status = tensorFlowSetup.getStatus();
      if (status.mode === 'fallback') {
        expect(status.error).toBeUndefined();
      }
    });
  });

  describe('Memory management', () => {
    it('should return null memory info in fallback mode', () => {
      const memInfo = tensorFlowSetup.getMemoryInfo();
      expect(memInfo).toBeNull();
    });

    it('should safely handle dispose in fallback mode', () => {
      expect(() => {
        tensorFlowSetup.dispose();
        tensorFlowSetup.dispose();
        tensorFlowSetup.dispose();
      }).not.toThrow();
    });

    it('should safely handle cleanup in fallback mode', async () => {
      await expect(tensorFlowSetup.cleanup()).resolves.toBeUndefined();
      await expect(tensorFlowSetup.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Type safety and return values', () => {
    it('createTensor should always return null or TensorLike', () => {
      const result = createTensor([1, 2, 3]);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('createTensor2d should always return null or TensorLike', () => {
      const result = createTensor2d([[1, 2], [3, 4]]);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('createTensor3d should always return null or TensorLike', () => {
      const result = createTensor3d([[[1, 2], [3, 4]]]);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('tidyOperation should always return result or null', () => {
      const result1 = tidyOperation(() => 42);
      const result2 = tidyOperation(() => { throw new Error(); });
      expect(result1 === 42 || result1 === null).toBe(true);
      expect(result2 === null).toBe(true);
    });

    it('normalize should always return a number', () => {
      const result1 = normalize(50, 0, 100);
      const result2 = normalize(-50, -100, 0);
      const result3 = normalize(10, 10, 10);
      expect(typeof result1).toBe('number');
      expect(typeof result2).toBe('number');
      expect(typeof result3).toBe('number');
    });

    it('denormalize should always return a number', () => {
      const result1 = denormalize(0.5, 0, 100);
      const result2 = denormalize(-1, -100, 100);
      const result3 = denormalize(2, 0, 1);
      expect(typeof result1).toBe('number');
      expect(typeof result2).toBe('number');
      expect(typeof result3).toBe('number');
    });
  });
});
