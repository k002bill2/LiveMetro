/**
 * Performance Monitoring Service
 * Real-time performance tracking and alerting for subway app
 */

import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performanceMonitor } from '../../utils/performanceUtils';

export interface PerformanceMetrics {
  timestamp: string;
  sessionId: string;
  metrics: {
    // App Performance
    appStartTime?: number;
    firstRenderTime?: number;
    jsHeapSize?: number;
    memoryUsage?: number;
    
    // Network Performance
    apiResponseTime?: number;
    networkFailureRate?: number;
    dataFreshness?: number;
    
    // UI Performance
    frameDrops?: number;
    renderTime?: number;
    navigationTime?: number;
    
    // Business Metrics
    realTimeDataAccuracy?: number;
    userEngagementTime?: number;
    errorRate?: number;
  };
  context: {
    platform: string;
    screenSize: { width: number; height: number };
    connectionType?: string;
    userId?: string;
    screen?: string;
  };
}

export interface PerformanceThresholds {
  // Critical thresholds for subway app
  appStartTime: number; // 3s max
  apiResponseTime: number; // 2s max for real-time data
  renderTime: number; // 100ms max
  memoryUsage: number; // 100MB max
  errorRate: number; // 1% max
  dataFreshness: number; // 30s max for real-time data
}

class PerformanceMonitoringService {
  private sessionId: string;
  private userId?: string;
  private currentScreen?: string;
  private isEnabled: boolean = true;
  private metricsQueue: PerformanceMetrics[] = [];
  private readonly maxQueueSize = 100;
  private readonly storageKey = '@performance_metrics_queue';
  
  private readonly thresholds: PerformanceThresholds = {
    appStartTime: 3000, // 3s
    apiResponseTime: 2000, // 2s 
    renderTime: 100, // 100ms
    memoryUsage: 100 * 1024 * 1024, // 100MB
    errorRate: 0.01, // 1%
    dataFreshness: 30000, // 30s
  };

  private startTimes: Map<string, number> = new Map();
  private performanceData: Map<string, number[]> = new Map();
  private metricsIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  async initialize(userId?: string): Promise<void> {
    performanceMonitor.startMeasure('perf_service_init');

    try {
      this.userId = userId;
      await this.loadQueueFromStorage();
      
      // Start periodic metric collection
      this.startPeriodicCollection();
      
      // Monitor app lifecycle
      this.setupAppStateMonitoring();
      
      console.log('📈 PerformanceMonitoringService initialized');
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    } finally {
      performanceMonitor.endMeasure('perf_service_init');
    }
  }

  /**
   * Set current user for performance context
   */
  setUser(userId: string): void {
    this.userId = userId;
  }

  /**
   * Set current screen for performance context
   */
  setCurrentScreen(screenName: string): void {
    this.currentScreen = screenName;
    this.recordMetric('navigation_time', Date.now());
  }

  /**
   * Record app start performance
   */
  recordAppStart(): void {
    const startTime = Date.now();
    this.startTimes.set('app_start', startTime);
    
    // Record first render when component mounts
    setTimeout(() => {
      this.recordMetric('app_start_time', Date.now() - startTime);
      this.recordMetric('first_render_time', Date.now() - startTime);
    }, 0);
  }

  /**
   * Record API call performance
   */
  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    this.recordMetric(`api_${endpoint}_duration`, duration);
    
    if (!success) {
      this.recordMetric('api_error_count', 1);
    }

    // Check against thresholds
    if (duration > this.thresholds.apiResponseTime) {
      console.warn(`⚠️ Slow API response: ${endpoint} took ${duration}ms`);
      this.recordAlert('slow_api_response', { endpoint, duration });
    }
  }

  /**
   * Record real-time data freshness
   */
  recordDataFreshness(dataType: string, age: number): void {
    this.recordMetric(`data_freshness_${dataType}`, age);
    
    if (age > this.thresholds.dataFreshness) {
      console.warn(`⚠️ Stale data detected: ${dataType} is ${age}ms old`);
      this.recordAlert('stale_data', { dataType, age });
    }
  }

  /**
   * Record render performance
   */
  recordRenderTime(component: string, duration: number): void {
    this.recordMetric(`render_${component}`, duration);
    
    if (duration > this.thresholds.renderTime) {
      console.warn(`⚠️ Slow render: ${component} took ${duration}ms`);
      this.recordAlert('slow_render', { component, duration });
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if (Platform.OS === 'web' && global.performance?.memory) {
      const memory = global.performance.memory;
      const usedHeap = memory.usedJSHeapSize;
      
      this.recordMetric('js_heap_size', usedHeap);
      
      if (usedHeap > this.thresholds.memoryUsage) {
        console.warn(`⚠️ High memory usage: ${Math.round(usedHeap / 1024 / 1024)}MB`);
        this.recordAlert('high_memory_usage', { usedHeap });
      }
    }
  }

  /**
   * Record user engagement time
   */
  recordEngagementTime(screen: string, duration: number): void {
    this.recordMetric(`engagement_${screen}`, duration);
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    
    for (const [key, values] of this.performanceData.entries()) {
      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        summary[`${key}_avg`] = Math.round(avg);
        summary[`${key}_max`] = max;
        summary[`${key}_min`] = min;
        summary[`${key}_count`] = values.length;
      }
    }
    
    return summary;
  }

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceHealthy(): boolean {
    const summary = this.getPerformanceSummary();
    
    const checks = [
      (summary.api_response_time_avg || 0) < this.thresholds.apiResponseTime,
      (summary.render_time_avg || 0) < this.thresholds.renderTime,
      (summary.js_heap_size_avg || 0) < this.thresholds.memoryUsage,
      (summary.error_rate || 0) < this.thresholds.errorRate,
    ];
    
    return checks.every(check => check);
  }

  /**
   * Force performance data upload
   */
  async flush(): Promise<void> {
    await this.processQueuedMetrics();
  }

  /**
   * Clean up all resources - call when service is no longer needed
   */
  destroy(): void {
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }
    this.isEnabled = false;
    this.performanceData.clear();
    this.startTimes.clear();
    this.metricsQueue = [];
  }

  private recordMetric(name: string, value: number): void {
    if (!this.performanceData.has(name)) {
      this.performanceData.set(name, []);
    }
    
    const values = this.performanceData.get(name)!;
    values.push(value);
    
    // Keep only last 100 values per metric
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
  }

  private recordAlert(type: string, data: Record<string, any>): void {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      data,
      sessionId: this.sessionId,
      userId: this.userId,
      screen: this.currentScreen,
    };
    
    // In production, send to alerting service
    console.warn('🚨 Performance Alert:', alert);
  }

  private async createMetricsSnapshot(): Promise<PerformanceMetrics> {
    const screenSize = Dimensions.get('window');
    
    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      metrics: {
        ...this.calculateAverageMetrics(),
      },
      context: {
        platform: `${Platform.OS} ${Platform.Version}`,
        screenSize: {
          width: screenSize.width,
          height: screenSize.height,
        },
        userId: this.userId,
        screen: this.currentScreen,
      },
    };

    return metrics;
  }

  private calculateAverageMetrics(): Record<string, number> {
    const summary = this.getPerformanceSummary();
    
    return {
      appStartTime: summary.app_start_time_avg || 0,
      firstRenderTime: summary.first_render_time_avg || 0,
      jsHeapSize: summary.js_heap_size_avg || 0,
      apiResponseTime: summary.api_response_time_avg || 0,
      renderTime: summary.render_time_avg || 0,
      errorRate: this.calculateErrorRate(),
      dataFreshness: summary.data_freshness_avg || 0,
      userEngagementTime: summary.engagement_avg || 0,
    };
  }

  private calculateErrorRate(): number {
    const errorCount = this.performanceData.get('api_error_count')?.length || 0;
    const totalRequests = Array.from(this.performanceData.keys())
      .filter(key => key.startsWith('api_') && key.endsWith('_duration'))
      .reduce((total, key) => total + (this.performanceData.get(key)?.length || 0), 0);
    
    return totalRequests > 0 ? errorCount / totalRequests : 0;
  }

  private startPeriodicCollection(): void {
    // Clear existing interval if any
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
    }

    // Collect metrics every 30 seconds
    this.metricsIntervalId = setInterval(async () => {
      if (this.isEnabled) {
        try {
          this.recordMemoryUsage();

          const metrics = await this.createMetricsSnapshot();
          await this.queueMetrics(metrics);
        } catch (error) {
          console.error('Failed to collect periodic metrics:', error);
        }
      }
    }, 30000);
  }

  private setupAppStateMonitoring(): void {
    // Monitor app state changes for engagement tracking
    // Implementation would use AppState from React Native
  }

  private async queueMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      this.metricsQueue.unshift(metrics);
      
      if (this.metricsQueue.length > this.maxQueueSize) {
        this.metricsQueue = this.metricsQueue.slice(0, this.maxQueueSize);
      }

      await this.saveQueueToStorage();
      await this.processQueuedMetrics();
    } catch (error) {
      console.error('Failed to queue performance metrics:', error);
    }
  }

  private async processQueuedMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    try {
      if (__DEV__) {
        console.log(`📈 Would send ${this.metricsQueue.length} performance metrics to service`);
        this.metricsQueue = [];
        await this.saveQueueToStorage();
      } else {
        // Production: send to analytics service
        await this.sendToAnalyticsService([...this.metricsQueue]);
        this.metricsQueue = [];
        await this.saveQueueToStorage();
      }
    } catch (error) {
      console.error('Failed to process performance metrics:', error);
    }
  }

  private async sendToAnalyticsService(metrics: PerformanceMetrics[]): Promise<void> {
    // Implementation would send to analytics service
    // Examples: Firebase Analytics, Google Analytics, custom service
    console.log('📈 Performance metrics sent to service:', metrics.length);
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.metricsQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load metrics from storage:', error);
      this.metricsQueue = [];
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.metricsQueue));
    } catch (error) {
      console.error('Failed to save metrics to storage:', error);
    }
  }

  private initializeMonitoring(): void {
    // Record app initialization
    this.recordAppStart();
  }

  private generateSessionId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();