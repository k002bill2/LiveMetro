/**
 * Performance Monitoring Service Tests
 */

import { performanceMonitoringService } from '../performanceMonitoringService';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
  },
}));

describe('PerformanceMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    performanceMonitoringService.destroy();
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(performanceMonitoringService.initialize()).resolves.not.toThrow();
    });

    it('should accept userId', async () => {
      await expect(performanceMonitoringService.initialize('user-1')).resolves.not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should set user', () => {
      expect(() => performanceMonitoringService.setUser('user-1')).not.toThrow();
    });
  });

  describe('setCurrentScreen', () => {
    it('should set screen', () => {
      expect(() => performanceMonitoringService.setCurrentScreen('Home')).not.toThrow();
    });
  });

  describe('recordAppStart', () => {
    it('should record app start', () => {
      expect(() => performanceMonitoringService.recordAppStart()).not.toThrow();
    });
  });

  describe('recordApiCall', () => {
    it('should record successful API call', () => {
      expect(() =>
        performanceMonitoringService.recordApiCall('/api/arrivals', 200, true)
      ).not.toThrow();
    });

    it('should record failed API call', () => {
      expect(() =>
        performanceMonitoringService.recordApiCall('/api/arrivals', 5000, false)
      ).not.toThrow();
    });
  });

  describe('recordDataFreshness', () => {
    it('should record data freshness', () => {
      expect(() =>
        performanceMonitoringService.recordDataFreshness('arrivals', 30000)
      ).not.toThrow();
    });
  });

  describe('recordRenderTime', () => {
    it('should record render time', () => {
      expect(() =>
        performanceMonitoringService.recordRenderTime('HomeScreen', 150)
      ).not.toThrow();
    });
  });

  describe('recordMemoryUsage', () => {
    it('should record memory usage', () => {
      expect(() => performanceMonitoringService.recordMemoryUsage()).not.toThrow();
    });
  });

  describe('recordEngagementTime', () => {
    it('should record engagement time', () => {
      expect(() =>
        performanceMonitoringService.recordEngagementTime('HomeScreen', 5000)
      ).not.toThrow();
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return summary object', () => {
      const summary = performanceMonitoringService.getPerformanceSummary();
      expect(typeof summary).toBe('object');
    });
  });

  describe('isPerformanceHealthy', () => {
    it('should return boolean', () => {
      const result = performanceMonitoringService.isPerformanceHealthy();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('flush', () => {
    it('should resolve without error', async () => {
      await expect(performanceMonitoringService.flush()).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      expect(() => performanceMonitoringService.destroy()).not.toThrow();
    });
  });
});
