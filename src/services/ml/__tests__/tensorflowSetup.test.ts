/**
 * TensorFlow Setup Service Tests
 */

import {
  tensorFlowSetup,
  createTensor,
  disposeTensor,
  tidyOperation,
  normalize,
  denormalize,
  getTensorFlow,
} from '../tensorflowSetup';

describe('TensorFlowSetupService', () => {
  describe('initialize', () => {
    it('should return fallback status when TensorFlow not available', async () => {
      const status = await tensorFlowSetup.initialize();

      // Service should be ready in fallback mode
      expect(status.isReady).toBe(true);
      expect(status.mode).toBe('fallback');
      expect(status.backend).toBe('statistics');
      expect(status.version).toBe('fallback');
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = tensorFlowSetup.getStatus();

      expect(status).toHaveProperty('isReady');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('mode');
    });
  });

  describe('isReady', () => {
    it('should return true after initialization (fallback mode)', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.isReady()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return false when TensorFlow is not installed', () => {
      expect(tensorFlowSetup.isAvailable()).toBe(false);
    });
  });

  describe('isFallbackMode', () => {
    it('should return true when using fallback', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.isFallbackMode()).toBe(true);
    });
  });

  describe('getBackend', () => {
    it('should return "statistics" in fallback mode', async () => {
      await tensorFlowSetup.initialize();
      expect(tensorFlowSetup.getBackend()).toBe('statistics');
    });
  });

  describe('dispose', () => {
    it('should be a no-op in fallback mode', () => {
      expect(() => tensorFlowSetup.dispose()).not.toThrow();
    });
  });

  describe('getMemoryInfo', () => {
    it('should return null in fallback mode', () => {
      expect(tensorFlowSetup.getMemoryInfo()).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should be a no-op in fallback mode', async () => {
      await expect(tensorFlowSetup.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getTf', () => {
    it('should return null in fallback mode', () => {
      expect(tensorFlowSetup.getTf()).toBeNull();
    });
  });
});

describe('Utility Functions', () => {
  describe('createTensor', () => {
    it('should return null when TensorFlow not available', () => {
      expect(createTensor([1, 2, 3])).toBeNull();
      expect(createTensor([[1, 2], [3, 4]], [2, 2])).toBeNull();
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
  });

  describe('tidyOperation', () => {
    it('should execute function directly in fallback mode', () => {
      // In fallback mode, tidyOperation should execute the function directly
      const result = tidyOperation(() => 'value');
      expect(result).toBe('value');
    });

    it('should return null on error', () => {
      const result = tidyOperation(() => {
        throw new Error('test error');
      });
      expect(result).toBeNull();
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
    });

    it('should return 0 when min equals max', () => {
      expect(normalize(50, 50, 50)).toBe(0);
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
    });
  });

  describe('getTensorFlow', () => {
    it('should return null when TensorFlow not installed', () => {
      expect(getTensorFlow()).toBeNull();
    });
  });
});
