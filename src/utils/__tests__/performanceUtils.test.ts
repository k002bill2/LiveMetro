/**
 * Performance Utils Tests
 */

// Unmock to test actual implementation
import {
  performanceMonitor,
  debounce,
  throttle,
  shallowEqual,
  batchProcess,
  optimizeImageProps,
  performanceLog,
  scheduleAfterInteractions,
} from '../performanceUtils';
import { InteractionManager } from 'react-native';

jest.unmock('../performanceUtils');

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
  });

  describe('startMeasure and endMeasure', () => {
    it('should measure performance correctly', async () => {
      performanceMonitor.startMeasure('test-operation');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = performanceMonitor.endMeasure('test-operation');

      expect(duration).toBeGreaterThanOrEqual(45); // Allow some variance
    });

    it('should return 0 for non-existent measurement', () => {
      const duration = performanceMonitor.endMeasure('non-existent');

      expect(duration).toBe(0);
    });

    it('should store metrics correctly', async () => {
      performanceMonitor.startMeasure('test-op');
      await new Promise(resolve => setTimeout(resolve, 10));
      performanceMonitor.endMeasure('test-op');

      const metrics = performanceMonitor.getMetrics('test-op');

      expect(metrics).toBeDefined();
      expect(metrics?.duration).toBeGreaterThan(0);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all stored metrics', () => {
      performanceMonitor.startMeasure('test1');
      performanceMonitor.startMeasure('test2');
      
      performanceMonitor.clearMetrics();
      
      expect(performanceMonitor.getMetrics('test1')).toBeUndefined();
      expect(performanceMonitor.getMetrics('test2')).toBeUndefined();
    });
  });
});

describe('debounce', () => {
  it('should delay function execution', async () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls', async () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn();
    await new Promise(resolve => setTimeout(resolve, 20));
    debouncedFn();
    await new Promise(resolve => setTimeout(resolve, 20));
    debouncedFn();

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments correctly', async () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn('arg1', 'arg2');

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  it('should limit function calls', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after throttle period', async () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 50);

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setTimeout(resolve, 60));

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments correctly', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn('test', 123);

    expect(mockFn).toHaveBeenCalledWith('test', 123);
  });
});

describe('shallowEqual', () => {
  it('should return true for identical objects', () => {
    const obj1 = { a: 1, b: 2, c: 'test' };
    const obj2 = { a: 1, b: 2, c: 'test' };

    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  it('should return false for objects with different values', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };

    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('should return false for objects with different keys', () => {
    const obj1: Record<string, number> = { a: 1, b: 2 };
    const obj2: Record<string, number> = { a: 1, c: 2 };

    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('should return false for objects with different key counts', () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 1, b: 2 };

    expect(shallowEqual(obj1, obj2)).toBe(false);
  });

  it('should handle empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });
});

describe('batchProcess', () => {
  it('should process items within single batch', () => {
    const items = [1, 2, 3];
    const processor = jest.fn((x: number) => x * 2);

    // Use batch size larger than array length to avoid async path
    const result = batchProcess(items, processor, 10);

    expect(result).toEqual([2, 4, 6]);
    expect(processor).toHaveBeenCalledTimes(3);
  });

  it('should handle empty arrays', () => {
    const result = batchProcess([], (x) => x, 5);

    expect(result).toEqual([]);
  });

  it('should process items correctly', () => {
    const items = [10, 20, 30];
    const processor = (x: number) => x * 3;

    const result = batchProcess(items, processor, 100);

    expect(result).toEqual([30, 60, 90]);
  });
});

describe('PerformanceMonitor - setTimeFunction', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
    performanceMonitor.resetTimeFunction();
  });

  it('should use custom time function', () => {
    let time = 5000;
    performanceMonitor.setTimeFunction(() => time);

    performanceMonitor.startMeasure('custom-time');
    time = 5100;
    const duration = performanceMonitor.endMeasure('custom-time');

    expect(duration).toBe(100);
  });

  it('should reset to default time function', () => {
    performanceMonitor.setTimeFunction(() => 9999);
    performanceMonitor.resetTimeFunction();

    performanceMonitor.startMeasure('default');
    const metrics = performanceMonitor.getMetrics('default');
    expect(metrics?.startTime).not.toBe(9999);
  });

  it('should warn for slow operations (>100ms)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    let time = 1000;
    performanceMonitor.setTimeFunction(() => time);

    performanceMonitor.startMeasure('slow');
    time = 1200;
    performanceMonitor.endMeasure('slow');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('slow took 200ms'));
    warnSpy.mockRestore();
  });

  it('should get memory usage', () => {
    const mem = performanceMonitor.getMemoryUsage();
    expect(typeof mem).toBe('number');
  });
});

describe('throttle - cancel', () => {
  it('should cancel throttle and allow immediate re-call', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const throttled = throttle(fn, 200);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    throttled.cancel();
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});

describe('optimizeImageProps', () => {
  it('should return optimized props', () => {
    const source = { uri: 'https://example.com/img.png' };
    const result = optimizeImageProps(source);

    expect(result.source).toBe(source);
    expect(result.resizeMode).toBe('cover');
    expect(result.progressiveRenderingEnabled).toBe(true);
    expect(result.fadeDuration).toBe(0);
    expect(result.cache).toBe('force-cache');
  });
});

describe('scheduleAfterInteractions', () => {
  it('should call InteractionManager.runAfterInteractions', () => {
    const spy = jest.spyOn(InteractionManager, 'runAfterInteractions');
    const cb = jest.fn();

    scheduleAfterInteractions(cb);

    expect(spy).toHaveBeenCalledWith(cb);
    spy.mockRestore();
  });
});

describe('performanceLog', () => {
  it('should log info', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    performanceLog.info('test info', { data: 1 });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should log warnings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    performanceLog.warn('test warn');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should log errors', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    performanceLog.error('test error', new Error('fail'));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});