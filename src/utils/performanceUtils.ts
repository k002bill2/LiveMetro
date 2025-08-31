/**
 * Performance Utilities
 * Tools for monitoring and optimizing app performance
 */

import { InteractionManager, Platform } from 'react-native';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: number;
  renderTime?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private isProduction = __DEV__ === false;

  /**
   * Start measuring performance for a specific operation
   */
  startMeasure(key: string): void {
    if (this.isProduction) return;

    this.metrics.set(key, {
      startTime: Date.now(),
    });
  }

  /**
   * End measuring and calculate duration
   */
  endMeasure(key: string): number {
    if (this.isProduction) return 0;

    const metric = this.metrics.get(key);
    if (!metric) return 0;

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    this.metrics.set(key, {
      ...metric,
      endTime,
      duration,
    });

    // Log only if duration is significant (>100ms)
    if (duration > 100) {
      console.warn(`⚡ Performance: ${key} took ${duration}ms`);
    }

    return duration;
  }

  /**
   * Get performance metrics for analysis
   */
  getMetrics(key: string): PerformanceMetrics | undefined {
    return this.metrics.get(key);
  }

  /**
   * Clear all metrics to prevent memory leaks
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Monitor memory usage (iOS only)
   */
  getMemoryUsage(): number {
    if (Platform.OS === 'ios' && global.performance?.memory) {
      return Math.round(global.performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Debounce function to limit API calls
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function for limiting frequent updates
 */
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Schedule heavy operations after interactions
 */
export const scheduleAfterInteractions = (callback: () => void): void => {
  InteractionManager.runAfterInteractions(callback);
};

/**
 * Measure component render time
 */
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> => {
  return (props: P) => {
    const measureKey = `${componentName}_render`;
    
    React.useEffect(() => {
      performanceMonitor.startMeasure(measureKey);
      
      const timer = requestAnimationFrame(() => {
        performanceMonitor.endMeasure(measureKey);
      });
      
      return () => cancelAnimationFrame(timer);
    });

    return React.createElement(Component, props);
  };
};

/**
 * Optimize image loading performance
 */
export const optimizeImageProps = (source: any) => {
  return {
    source,
    resizeMode: 'cover' as const,
    progressiveRenderingEnabled: true,
    fadeDuration: 0, // Disable fade for better performance
    cache: 'force-cache' as const,
  };
};

/**
 * Memory-efficient array operations
 */
export const batchProcess = <T, R>(
  items: T[],
  processor: (item: T) => R,
  batchSize: number = 50
): R[] => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = batch.map(processor);
    results.push(...batchResults);
    
    // Allow other operations to run
    if (i + batchSize < items.length) {
      return new Promise(resolve => {
        setTimeout(() => resolve(results), 0);
      }) as any;
    }
  }
  
  return results;
};

/**
 * Efficient object comparison for React.memo
 */
export const shallowEqual = <T extends Record<string, any>>(
  obj1: T,
  obj2: T
): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Performance-aware logging
 */
export const performanceLog = {
  info: (message: string, data?: any) => {
    if (!__DEV__) return;
    console.log(`📊 Performance: ${message}`, data);
  },
  
  warn: (message: string, data?: any) => {
    if (!__DEV__) return;
    console.warn(`⚠️ Performance Warning: ${message}`, data);
  },
  
  error: (message: string, error?: any) => {
    console.error(`🚨 Performance Error: ${message}`, error);
  }
};