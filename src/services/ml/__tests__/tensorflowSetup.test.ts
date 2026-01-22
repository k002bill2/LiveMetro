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
    it('should return unavailable status', async () => {
      const status = await tensorFlowSetup.initialize();

      expect(status.isReady).toBe(false);
      expect(status.backend).toBe('none');
      expect(status.version).toBe('unavailable');
      expect(status.error).toContain('TensorFlow disabled');
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = tensorFlowSetup.getStatus();

      expect(status.isReady).toBe(false);
      expect(status.backend).toBe('none');
    });
  });

  describe('isReady', () => {
    it('should always return false', () => {
      expect(tensorFlowSetup.isReady()).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should always return false', () => {
      expect(tensorFlowSetup.isAvailable()).toBe(false);
    });
  });

  describe('getBackend', () => {
    it('should return "none"', () => {
      expect(tensorFlowSetup.getBackend()).toBe('none');
    });
  });

  describe('dispose', () => {
    it('should be a no-op', () => {
      expect(() => tensorFlowSetup.dispose()).not.toThrow();
    });
  });

  describe('getMemoryInfo', () => {
    it('should return null', () => {
      expect(tensorFlowSetup.getMemoryInfo()).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should be a no-op', async () => {
      await expect(tensorFlowSetup.cleanup()).resolves.not.toThrow();
    });
  });
});

describe('Utility Functions', () => {
  describe('createTensor', () => {
    it('should return null', () => {
      expect(createTensor([1, 2, 3])).toBeNull();
      expect(createTensor([[1, 2], [3, 4]], [2, 2])).toBeNull();
    });
  });

  describe('disposeTensor', () => {
    it('should be a no-op', () => {
      expect(() => disposeTensor(null)).not.toThrow();
      expect(() => disposeTensor(undefined)).not.toThrow();
      expect(() => disposeTensor({})).not.toThrow();
    });
  });

  describe('tidyOperation', () => {
    it('should return null', () => {
      expect(tidyOperation(() => 'value')).toBeNull();
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
    it('should return null', () => {
      expect(getTensorFlow()).toBeNull();
    });
  });
});
