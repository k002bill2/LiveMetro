/**
 * Crash Reporting Service
 * Centralized error reporting and crash analytics
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performanceMonitor } from '../../utils/performanceUtils';

export interface CrashReport {
  id: string;
  timestamp: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  context: {
    userId?: string;
    sessionId: string;
    screen?: string;
    action?: string;
    metadata?: Record<string, any>;
  };
  device: {
    model?: string;
    osVersion: string;
    appState: 'active' | 'background' | 'inactive';
  };
}

class CrashReportingService {
  private sessionId: string;
  private userId?: string;
  private currentScreen?: string;
  private isEnabled: boolean = true;
  private reportQueue: CrashReport[] = [];
  private readonly maxQueueSize = 50;
  private readonly storageKey = '@crash_reports_queue';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadQueueFromStorage();
  }

  /**
   * Initialize crash reporting service
   */
  async initialize(userId?: string): Promise<void> {
    performanceMonitor.startMeasure('crash_service_init');
    
    try {
      this.userId = userId;
      
      // Load queued reports from storage
      await this.loadQueueFromStorage();
      
      // Set up global error handlers
      this.setupGlobalErrorHandlers();
      
      // Process any queued reports
      await this.processQueuedReports();
      
      console.log('📊 CrashReportingService initialized');
    } catch (error) {
      console.error('Failed to initialize crash reporting:', error);
    } finally {
      performanceMonitor.endMeasure('crash_service_init');
    }
  }

  /**
   * Enable or disable crash reporting
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📊 Crash reporting ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set current user for crash context
   */
  setUser(userId: string): void {
    this.userId = userId;
  }

  /**
   * Set current screen for crash context
   */
  setCurrentScreen(screenName: string): void {
    this.currentScreen = screenName;
  }

  /**
   * Report an error manually
   */
  async reportError(
    error: Error,
    context?: {
      screen?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    if (!this.isEnabled) return;

    performanceMonitor.startMeasure('crash_report_error');

    try {
      const crashReport = await this.createCrashReport(error, context);
      await this.queueReport(crashReport);
      
      console.warn('📊 Error reported:', crashReport.error.message);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    } finally {
      performanceMonitor.endMeasure('crash_report_error');
    }
  }

  /**
   * Report a handled exception
   */
  async reportHandledException(
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    await this.reportError(error, {
      metadata: { ...context, handledException: true },
    });
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    if (!this.isEnabled) return;

    try {
      const breadcrumb = {
        timestamp: new Date().toISOString(),
        message,
        category: category || 'custom',
        data,
      };

      // Store breadcrumbs for context (implementation would store in memory/storage)
      console.log('🍞 Breadcrumb:', breadcrumb);
    } catch (error) {
      console.error('Failed to add breadcrumb:', error);
    }
  }

  /**
   * Force crash report upload (for testing)
   */
  async flush(): Promise<void> {
    await this.processQueuedReports();
  }

  private setupGlobalErrorHandlers(): void {
    // Global error handler for unhandled promise rejections
    const originalHandler = global.ErrorUtils?.getGlobalHandler();
    
    global.ErrorUtils?.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (isFatal) {
        this.reportError(error, {
          metadata: { 
            fatal: true,
            globalErrorHandler: true,
          },
        });
      }
      
      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    // Unhandled promise rejection handler
    if (typeof global?.process?.on === 'function') {
      global.process.on('unhandledRejection', (reason: any) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.reportError(error, {
          metadata: { 
            unhandledRejection: true,
            reason: String(reason),
          },
        });
      });
    }
  }

  private async createCrashReport(
    error: Error,
    context?: {
      screen?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<CrashReport> {
    const report: CrashReport = {
      id: this.generateReportId(),
      timestamp: new Date().toISOString(),
      platform: Platform.OS as 'ios' | 'android' | 'web',
      appVersion: '1.0.0', // Would come from app config
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context: {
        userId: this.userId,
        sessionId: this.sessionId,
        screen: context?.screen || this.currentScreen,
        action: context?.action,
        metadata: context?.metadata,
      },
      device: {
        osVersion: Platform.Version.toString(),
        appState: 'active', // Would get actual app state
      },
    };

    return report;
  }

  private async queueReport(report: CrashReport): Promise<void> {
    try {
      // Add to in-memory queue
      this.reportQueue.unshift(report);
      
      // Maintain queue size
      if (this.reportQueue.length > this.maxQueueSize) {
        this.reportQueue = this.reportQueue.slice(0, this.maxQueueSize);
      }

      // Persist to storage
      await this.saveQueueToStorage();

      // Try to send immediately
      await this.processQueuedReports();
    } catch (error) {
      console.error('Failed to queue crash report:', error);
    }
  }

  private async processQueuedReports(): Promise<void> {
    if (this.reportQueue.length === 0) return;

    try {
      // In production, send to crash reporting service
      if (__DEV__) {
        console.log(`📊 Would send ${this.reportQueue.length} crash reports to service`);
        // Clear queue in development
        this.reportQueue = [];
        await this.saveQueueToStorage();
      } else {
        // Production implementation would send to Sentry, Crashlytics, etc.
        const reportsToSend = [...this.reportQueue];
        
        // Example: await this.sendToService(reportsToSend);
        
        // Clear successfully sent reports
        this.reportQueue = [];
        await this.saveQueueToStorage();
      }
    } catch (error) {
      console.error('Failed to process queued reports:', error);
    }
  }

  private async sendToService(reports: CrashReport[]): Promise<void> {
    // Implementation would send to crash reporting service
    // Example implementations:
    
    // Sentry:
    // reports.forEach(report => {
    //   Sentry.captureException(new Error(report.error.message), {
    //     contexts: { crash_report: report }
    //   });
    // });

    // Firebase Crashlytics:
    // reports.forEach(report => {
    //   crashlytics().recordError(new Error(report.error.message));
    //   crashlytics().setAttributes(report.context);
    // });

    // Custom service:
    // await fetch('/api/crash-reports', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(reports)
    // });

    console.log('📊 Crash reports sent to service:', reports.length);
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.reportQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load crash reports from storage:', error);
      this.reportQueue = [];
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.reportQueue));
    } catch (error) {
      console.error('Failed to save crash reports to storage:', error);
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const crashReportingService = new CrashReportingService();