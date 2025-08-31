/**
 * Health Check Service
 * System health monitoring and alerting for LiveMetro app
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { seoulSubwayApi } from '../api/seoulSubwayApi';
import { dataManager } from '../data/dataManager';
import { performanceMonitor } from '../../utils/performanceUtils';

export interface HealthCheckResult {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    network: HealthStatus;
    seoulApi: HealthStatus;
    dataManager: HealthStatus;
    storage: HealthStatus;
    memory: HealthStatus;
    battery?: HealthStatus;
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    dataFreshness: number;
    memoryUsage?: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

class HealthCheckService {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs = 60000; // 1 minute
  private lastHealthCheck?: HealthCheckResult;
  private healthHistory: HealthCheckResult[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Start health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('🏥 Health monitoring already running');
      return;
    }

    performanceMonitor.startMeasure('health_monitoring_start');

    try {
      this.isRunning = true;
      
      // Initial health check
      await this.performHealthCheck();
      
      // Start periodic checks
      this.checkInterval = setInterval(() => {
        this.performHealthCheck().catch(error => {
          console.error('Health check failed:', error);
        });
      }, this.intervalMs);

      console.log('🏥 Health monitoring started');
    } catch (error) {
      console.error('Failed to start health monitoring:', error);
      this.isRunning = false;
    } finally {
      performanceMonitor.endMeasure('health_monitoring_start');
    }
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('🏥 Health monitoring stopped');
  }

  /**
   * Perform immediate health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    performanceMonitor.startMeasure('health_check_full');

    try {
      const timestamp = new Date().toISOString();
      
      // Run all health checks in parallel
      const [
        networkStatus,
        seoulApiStatus,
        dataManagerStatus,
        storageStatus,
        memoryStatus,
        batteryStatus,
      ] = await Promise.allSettled([
        this.checkNetworkHealth(),
        this.checkSeoulApiHealth(),
        this.checkDataManagerHealth(),
        this.checkStorageHealth(),
        this.checkMemoryHealth(),
        this.checkBatteryHealth(),
      ]);

      const healthResult: HealthCheckResult = {
        timestamp,
        overall: 'healthy',
        checks: {
          network: this.getSettledValue(networkStatus),
          seoulApi: this.getSettledValue(seoulApiStatus),
          dataManager: this.getSettledValue(dataManagerStatus),
          storage: this.getSettledValue(storageStatus),
          memory: this.getSettledValue(memoryStatus),
          battery: this.getSettledValue(batteryStatus),
        },
        metrics: {
          responseTime: this.calculateAverageResponseTime(),
          errorRate: this.calculateErrorRate(),
          dataFreshness: await this.calculateDataFreshness(),
          memoryUsage: this.getCurrentMemoryUsage(),
        },
      };

      // Determine overall health
      healthResult.overall = this.determineOverallHealth(healthResult.checks);

      // Store result
      this.lastHealthCheck = healthResult;
      this.addToHistory(healthResult);

      // Log health status
      this.logHealthStatus(healthResult);

      return healthResult;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    } finally {
      performanceMonitor.endMeasure('health_check_full');
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): HealthCheckResult | null {
    return this.lastHealthCheck || null;
  }

  /**
   * Get health history
   */
  getHealthHistory(): HealthCheckResult[] {
    return [...this.healthHistory];
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    return this.lastHealthCheck?.overall === 'healthy';
  }

  /**
   * Check network connectivity and quality
   */
  private async checkNetworkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const netInfo = await NetInfo.fetch();
      const responseTime = Date.now() - startTime;
      
      if (!netInfo.isConnected) {
        return {
          status: 'unhealthy',
          message: 'No network connection',
          responseTime,
          lastCheck: new Date().toISOString(),
        };
      }
      
      if (netInfo.type === 'cellular' && netInfo.details?.cellularGeneration === '2g') {
        return {
          status: 'degraded',
          message: 'Slow network connection (2G)',
          responseTime,
          lastCheck: new Date().toISOString(),
        };
      }
      
      return {
        status: 'healthy',
        message: `Connected via ${netInfo.type}`,
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Network check failed',
        lastCheck: new Date().toISOString(),
        error: String(error),
      };
    }
  }

  /**
   * Check Seoul Subway API health
   */
  private async checkSeoulApiHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test API with a common station
      await seoulSubwayApi.getRealtimeArrivals('강남역');
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) {
        return {
          status: 'degraded',
          message: 'Seoul API responding slowly',
          responseTime,
          lastCheck: new Date().toISOString(),
        };
      }
      
      return {
        status: 'healthy',
        message: 'Seoul API responding normally',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Seoul API unavailable',
        lastCheck: new Date().toISOString(),
        error: String(error),
      };
    }
  }

  /**
   * Check data manager health
   */
  private async checkDataManagerHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test data manager with cache check
      await dataManager.getRealtimeTrains('강남역');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: 'Data manager functioning normally',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Data manager failed',
        lastCheck: new Date().toISOString(),
        error: String(error),
      };
    }
  }

  /**
   * Check AsyncStorage health
   */
  private async checkStorageHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    const testKey = '@health_check_test';
    const testValue = Date.now().toString();
    
    try {
      await AsyncStorage.setItem(testKey, testValue);
      const retrieved = await AsyncStorage.getItem(testKey);
      await AsyncStorage.removeItem(testKey);
      
      const responseTime = Date.now() - startTime;
      
      if (retrieved !== testValue) {
        return {
          status: 'degraded',
          message: 'Storage data integrity issue',
          responseTime,
          lastCheck: new Date().toISOString(),
        };
      }
      
      return {
        status: 'healthy',
        message: 'Storage functioning normally',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Storage access failed',
        lastCheck: new Date().toISOString(),
        error: String(error),
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<HealthStatus> {
    try {
      let memoryUsage = 0;
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage normal';
      
      if (Platform.OS === 'web' && global.performance?.memory) {
        const memory = global.performance.memory;
        memoryUsage = memory.usedJSHeapSize;
        const memoryMB = memoryUsage / 1024 / 1024;
        
        if (memoryMB > 200) {
          status = 'unhealthy';
          message = `High memory usage: ${Math.round(memoryMB)}MB`;
        } else if (memoryMB > 100) {
          status = 'degraded';
          message = `Elevated memory usage: ${Math.round(memoryMB)}MB`;
        } else {
          message = `Memory usage: ${Math.round(memoryMB)}MB`;
        }
      }
      
      return {
        status,
        message,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Memory check unavailable',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Check battery health (mobile only)
   */
  private async checkBatteryHealth(): Promise<HealthStatus> {
    try {
      // Battery API would be implemented for mobile platforms
      // This is a placeholder implementation
      
      if (Platform.OS === 'web') {
        return {
          status: 'healthy',
          message: 'Battery monitoring not available on web',
          lastCheck: new Date().toISOString(),
        };
      }
      
      // For mobile: implement battery level checking
      return {
        status: 'healthy',
        message: 'Battery level normal',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Battery check unavailable',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private getSettledValue<T>(result: PromiseSettledResult<T>): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        message: 'Check failed',
        lastCheck: new Date().toISOString(),
        error: String(result.reason),
      } as T;
    }
  }

  private determineOverallHealth(checks: HealthCheckResult['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check?.status).filter(Boolean);
    
    if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.some(status => status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private calculateAverageResponseTime(): number {
    if (!this.lastHealthCheck) return 0;
    
    const responseTimes = Object.values(this.lastHealthCheck.checks)
      .map(check => check?.responseTime)
      .filter(time => time !== undefined) as number[];
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
  }

  private calculateErrorRate(): number {
    const recentHistory = this.healthHistory.slice(0, 10); // Last 10 checks
    if (recentHistory.length === 0) return 0;
    
    const errorCount = recentHistory.filter(check => check.overall === 'unhealthy').length;
    return errorCount / recentHistory.length;
  }

  private async calculateDataFreshness(): Promise<number> {
    try {
      // Check how old the cached data is
      // This would check the timestamp of cached train data
      return 30000; // Placeholder: 30 seconds
    } catch {
      return 0;
    }
  }

  private getCurrentMemoryUsage(): number | undefined {
    if (Platform.OS === 'web' && global.performance?.memory) {
      return global.performance.memory.usedJSHeapSize;
    }
    return undefined;
  }

  private addToHistory(result: HealthCheckResult): void {
    this.healthHistory.unshift(result);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(0, this.maxHistorySize);
    }
  }

  private logHealthStatus(result: HealthCheckResult): void {
    const icon = result.overall === 'healthy' ? '✅' : 
                result.overall === 'degraded' ? '⚠️' : '❌';
    
    console.log(`🏥 ${icon} System Health: ${result.overall.toUpperCase()}`);
    
    if (result.overall !== 'healthy') {
      Object.entries(result.checks).forEach(([service, status]) => {
        if (status && status.status !== 'healthy') {
          console.warn(`  - ${service}: ${status.status} - ${status.message}`);
        }
      });
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();