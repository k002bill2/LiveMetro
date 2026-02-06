/**
 * Monitoring Manager Tests
 */

import { monitoringManager } from '../index';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/performanceUtils', () => ({
  measureAsyncOperation: jest.fn((_, fn) => fn()),
  getTimestamp: jest.fn(() => Date.now()),
  throttle: jest.fn((fn) => fn),
}));

jest.mock('../../api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../data/dataManager', () => ({
  dataManager: {
    getStations: jest.fn().mockReturnValue([]),
    hasData: jest.fn().mockReturnValue(true),
    getLastSyncTime: jest.fn().mockReturnValue(Date.now()),
  },
}));

// Mock global __DEV__
(global as Record<string, unknown>).__DEV__ = true;
// Mock global fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ status: 'ok' }),
});

describe('MonitoringManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(
        monitoringManager.initialize({
          crashReporting: { enabled: false },
          performance: { enabled: false },
          healthCheck: { enabled: false },
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should set user without error', () => {
      expect(() => monitoringManager.setUser('user-1')).not.toThrow();
    });
  });

  describe('setCurrentScreen', () => {
    it('should set screen name', () => {
      expect(() => monitoringManager.setCurrentScreen('HomeScreen')).not.toThrow();
    });
  });

  describe('recordAppStart', () => {
    it('should record app start', () => {
      expect(() => monitoringManager.recordAppStart()).not.toThrow();
    });
  });

  describe('recordApiCall', () => {
    it('should record API call', () => {
      expect(() => monitoringManager.recordApiCall('/api/test', 100, true)).not.toThrow();
    });
  });

  describe('recordRenderTime', () => {
    it('should record render time', () => {
      expect(() => monitoringManager.recordRenderTime('TestComponent', 50)).not.toThrow();
    });
  });

  describe('reportError', () => {
    it('should report error', async () => {
      await expect(
        monitoringManager.reportError(new Error('Test error'))
      ).resolves.not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb', () => {
      expect(() => monitoringManager.addBreadcrumb('test action', 'navigation')).not.toThrow();
    });
  });

  describe('getCurrentHealth', () => {
    it('should return health status', () => {
      const health = monitoringManager.getCurrentHealth();
      expect(health === null || typeof health === 'object').toBe(true);
    });
  });

  describe('isSystemHealthy', () => {
    it('should return boolean', () => {
      const result = monitoringManager.isSystemHealthy();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return summary', () => {
      const summary = monitoringManager.getPerformanceSummary();
      expect(summary === null || typeof summary === 'object').toBe(true);
    });
  });

  describe('flush', () => {
    it('should flush without error', async () => {
      await expect(monitoringManager.flush()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown without error', async () => {
      await expect(monitoringManager.shutdown()).resolves.not.toThrow();
    });
  });
});
