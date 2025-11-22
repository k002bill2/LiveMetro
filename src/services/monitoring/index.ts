/**
 * Production Monitoring Services
 * Centralized initialization and management for all monitoring services
 */

import { crashReportingService } from './crashReportingService';
import { performanceMonitoringService } from './performanceMonitoringService';
import { healthCheckService } from './healthCheckService';

export interface MonitoringConfig {
  crashReporting: {
    enabled: boolean;
    userId?: string;
  };
  performance: {
    enabled: boolean;
    userId?: string;
  };
  healthCheck: {
    enabled: boolean;
  };
}

class MonitoringManager {
  private isInitialized: boolean = false;
  private config: MonitoringConfig = {
    crashReporting: { enabled: !__DEV__ },
    performance: { enabled: !__DEV__ },
    healthCheck: { enabled: true },
  };

  /**
   * Initialize all monitoring services
   */
  async initialize(config?: Partial<MonitoringConfig>): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Monitoring services already initialized');
      return;
    }

    try {
      // Merge configuration
      if (config) {
        this.config = { ...this.config, ...config };
      }

      console.log('📊 Initializing production monitoring services...');

      // Initialize services in parallel
      const initPromises: Promise<void>[] = [];

      if (this.config.crashReporting.enabled) {
        initPromises.push(
          crashReportingService.initialize(this.config.crashReporting.userId)
        );
      }

      if (this.config.performance.enabled) {
        initPromises.push(
          performanceMonitoringService.initialize(this.config.performance.userId)
        );
      }

      if (this.config.healthCheck.enabled) {
        initPromises.push(
          healthCheckService.startMonitoring()
        );
      }

      await Promise.all(initPromises);

      this.isInitialized = true;
      console.log('📊 All monitoring services initialized successfully');

      // Perform initial health check
      if (this.config.healthCheck.enabled) {
        setTimeout(async () => {
          try {
            const health = await healthCheckService.performHealthCheck();
            console.log(`📊 Initial system health: ${health.overall}`);
          } catch (error) {
            console.error('Initial health check failed:', error);
          }
        }, 5000); // Wait 5 seconds after app start
      }

    } catch (error) {
      console.error('📊 Failed to initialize monitoring services:', error);
      await crashReportingService.reportError(
        error instanceof Error ? error : new Error(String(error)),
        { action: 'monitoring_initialization' }
      );
    }
  }

  /**
   * Set user context for all monitoring services
   */
  setUser(userId: string): void {
    if (this.config.crashReporting.enabled) {
      crashReportingService.setUser(userId);
    }
    if (this.config.performance.enabled) {
      performanceMonitoringService.setUser(userId);
    }

    console.log(`📊 User context set for monitoring: ${userId}`);
  }

  /**
   * Set current screen for all monitoring services
   */
  setCurrentScreen(screenName: string): void {
    if (this.config.crashReporting.enabled) {
      crashReportingService.setCurrentScreen(screenName);
    }
    if (this.config.performance.enabled) {
      performanceMonitoringService.setCurrentScreen(screenName);
    }
  }

  /**
   * Record application startup metrics
   */
  recordAppStart(): void {
    if (this.config.performance.enabled) {
      performanceMonitoringService.recordAppStart();
    }
  }

  /**
   * Record API call performance
   */
  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    if (this.config.performance.enabled) {
      performanceMonitoringService.recordApiCall(endpoint, duration, success);
    }
  }

  /**
   * Record render performance
   */
  recordRenderTime(component: string, duration: number): void {
    if (this.config.performance.enabled) {
      performanceMonitoringService.recordRenderTime(component, duration);
    }
  }

  /**
   * Record error manually
   */
  async reportError(error: Error, context?: Record<string, any>): Promise<void> {
    if (this.config.crashReporting.enabled) {
      await crashReportingService.reportError(error, context);
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    if (this.config.crashReporting.enabled) {
      crashReportingService.addBreadcrumb(message, category, data);
    }
  }

  /**
   * Get current system health
   */
  getCurrentHealth() {
    if (this.config.healthCheck.enabled) {
      return healthCheckService.getCurrentHealth();
    }
    return null;
  }

  /**
   * Check if system is healthy
   */
  isSystemHealthy(): boolean {
    if (this.config.healthCheck.enabled) {
      return healthCheckService.isHealthy();
    }
    return true; // Assume healthy if monitoring disabled
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    if (this.config.performance.enabled) {
      return performanceMonitoringService.getPerformanceSummary();
    }
    return {};
  }

  /**
   * Force upload all queued data
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.crashReporting.enabled) {
      promises.push(crashReportingService.flush());
    }
    if (this.config.performance.enabled) {
      promises.push(performanceMonitoringService.flush());
    }

    await Promise.all(promises);
  }

  /**
   * Shutdown all monitoring services
   */
  async shutdown(): Promise<void> {
    try {
      console.log('📊 Shutting down monitoring services...');

      // Flush any remaining data
      await this.flush();

      // Stop health monitoring
      if (this.config.healthCheck.enabled) {
        healthCheckService.stopMonitoring();
      }

      this.isInitialized = false;
      console.log('📊 Monitoring services shut down');
    } catch (error) {
      console.error('Failed to shutdown monitoring services:', error);
    }
  }
}

// Export singleton instance
export const monitoringManager = new MonitoringManager();

// Export individual services for direct access if needed
export {
  crashReportingService,
  performanceMonitoringService,
  healthCheckService,
};

// Export types
export type { CrashReport } from './crashReportingService';
export type { PerformanceMetrics, PerformanceThresholds } from './performanceMonitoringService';
export type { HealthCheckResult, HealthStatus } from './healthCheckService';
