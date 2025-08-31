/**
 * Performance Utils Tests
 */

import {
  performanceMonitor,
  debounce,
  throttle,
  shallowEqual,
  batchProcess,
} from '../performanceUtils';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startMeasure and endMeasure', () => {
    it('should measure performance correctly', () => {
      performanceMonitor.startMeasure('test-operation');
      
      // Advance time by 150ms
      jest.advanceTimersByTime(150);
      
      const duration = performanceMonitor.endMeasure('test-operation');
      
      expect(duration).toBe(150);
    });

    it('should return 0 for non-existent measurement', () => {
      const duration = performanceMonitor.endMeasure('non-existent');
      
      expect(duration).toBe(0);
    });

    it('should store metrics correctly', () => {
      performanceMonitor.startMeasure('test-op');
      jest.advanceTimersByTime(100);
      performanceMonitor.endMeasure('test-op');
      
      const metrics = performanceMonitor.getMetrics('test-op');
      
      expect(metrics).toBeDefined();
      expect(metrics?.duration).toBe(100);
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
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delay function execution', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);
    
    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);
    
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments correctly', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);
    
    debouncedFn('arg1', 'arg2');
    
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should limit function calls', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    throttledFn();
    throttledFn();
    throttledFn();
    
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after throttle period', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(100);
    
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
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, c: 2 };
    
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
  it('should process items in batches', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const processor = jest.fn((x) => x * 2);
    
    const result = batchProcess(items, processor, 2);
    
    expect(result).toEqual([2, 4, 6, 8, 10, 12]);
    expect(processor).toHaveBeenCalledTimes(6);
  });

  it('should handle empty arrays', () => {
    const result = batchProcess([], (x) => x, 5);
    
    expect(result).toEqual([]);
  });

  it('should use default batch size', () => {
    const items = new Array(60).fill(1);
    const processor = jest.fn((x) => x);
    
    const result = batchProcess(items, processor);
    
    expect(result).toHaveLength(60);
    expect(processor).toHaveBeenCalledTimes(60);
  });

  it('should process single batch correctly', () => {
    const items = [1, 2, 3];
    const processor = (x: number) => x * 3;
    
    const result = batchProcess(items, processor, 10);
    
    expect(result).toEqual([3, 6, 9]);
  });
});