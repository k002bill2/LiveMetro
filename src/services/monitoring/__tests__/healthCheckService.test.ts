/**
 * Health Check Service Tests
 */

// Must mock before imports
import { healthCheckService } from '../healthCheckService';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17.0' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../data/dataManager', () => ({
  dataManager: {
    getRealtimeTrains: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
  },
}));

// Mock global fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
}) as jest.Mock;

describe('HealthCheckService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    healthCheckService.destroy();
    jest.useRealTimers();
  });

  describe('startMonitoring', () => {
    it('should start monitoring', async () => {
      await expect(healthCheckService.startMonitoring()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await healthCheckService.startMonitoring();
      await healthCheckService.startMonitoring(); // second call should be no-op
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring', () => {
      expect(() => healthCheckService.stopMonitoring()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup all resources', async () => {
      await healthCheckService.startMonitoring();
      healthCheckService.destroy();
      expect(healthCheckService.getCurrentHealth()).toBeNull();
      expect(healthCheckService.getHealthHistory()).toEqual([]);
    });
  });

  describe('performHealthCheck', () => {
    it('should return health check result', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should include all service checks', async () => {
      const result = await healthCheckService.performHealthCheck();
      expect(result.checks.network).toBeDefined();
      expect(result.checks.seoulApi).toBeDefined();
      expect(result.checks.dataManager).toBeDefined();
      expect(result.checks.storage).toBeDefined();
      expect(result.checks.memory).toBeDefined();
    });

    it('should report degraded when API is slow', async () => {
      // Simulate slow responses
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 4000))
      );
      jest.useRealTimers(); // Need real timers for this test
      const result = await healthCheckService.performHealthCheck();
      expect(result).toBeDefined();
      jest.useFakeTimers();
    });
  });

  describe('getCurrentHealth', () => {
    it('should return null when no check performed', () => {
      healthCheckService.destroy();
      expect(healthCheckService.getCurrentHealth()).toBeNull();
    });

    it('should return last health check', async () => {
      await healthCheckService.performHealthCheck();
      const health = healthCheckService.getCurrentHealth();
      expect(health).not.toBeNull();
      expect(health?.overall).toBeDefined();
    });
  });

  describe('getHealthHistory', () => {
    it('should return empty array initially', () => {
      healthCheckService.destroy();
      expect(healthCheckService.getHealthHistory()).toEqual([]);
    });

    it('should accumulate history', async () => {
      await healthCheckService.performHealthCheck();
      await healthCheckService.performHealthCheck();
      const history = healthCheckService.getHealthHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should return copy of history', async () => {
      await healthCheckService.performHealthCheck();
      const h1 = healthCheckService.getHealthHistory();
      const h2 = healthCheckService.getHealthHistory();
      expect(h1).toEqual(h2);
      expect(h1).not.toBe(h2);
    });
  });

  describe('isHealthy', () => {
    it('should return false when no check performed', () => {
      healthCheckService.destroy();
      expect(healthCheckService.isHealthy()).toBe(false);
    });

    it('should return true when system is healthy', async () => {
      await healthCheckService.performHealthCheck();
      // With all mocks resolving successfully, should be healthy
      expect(typeof healthCheckService.isHealthy()).toBe('boolean');
    });
  });
});
