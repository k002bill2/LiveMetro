/**
 * Delay Response Alert Service Tests
 */

import { delayResponseAlertService } from '../delayResponseAlertService';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

jest.mock('../../api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/models/pattern', () => ({
  getDayOfWeek: jest.fn().mockReturnValue(1),
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }),
  formatMinutesToTime: jest.fn((mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }),
}));

jest.mock('@/services/ml', () => ({
  modelService: {
    predict: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../pattern/commuteLogService', () => ({
  commuteLogService: {
    getRecentLogs: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/models/ml', () => ({
  generateAlertId: jest.fn().mockReturnValue('alert-123'),
}));

describe('DelayResponseAlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    delayResponseAlertService.destroy();
    jest.useRealTimers();
  });

  describe('checkRouteDelays', () => {
    it('should check for delays', async () => {
      const result = await delayResponseAlertService.checkRouteDelays('user-1', {
        departureStationId: 'gangnam',
        departureStationName: '강남역',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      });
      expect(result).toBeDefined();
    });
  });

  describe('calculateAdjustedDeparture', () => {
    it('should return adjusted departure time', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:30', 5, 5
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle zero delay', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:30', 0, 0
      );
      expect(result).toBe('08:30');
    });
  });

  describe('startDelayMonitoring', () => {
    it('should return session ID', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: {
          departureStationId: 'gangnam',
          departureStationName: '강남역',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          lineIds: ['2'],
        },
        pollingIntervalSeconds: 30,
        bufferMinutes: 10,
      });
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });
  });

  describe('stopDelayMonitoring', () => {
    it('should stop existing session', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: {
          departureStationId: 'gangnam',
          departureStationName: '강남역',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          lineIds: ['2'],
        },
        pollingIntervalSeconds: 30,
        bufferMinutes: 10,
      });
      const result = delayResponseAlertService.stopDelayMonitoring(sessionId);
      expect(result).toBe(true);
    });

    it('should return false for unknown session', () => {
      const result = delayResponseAlertService.stopDelayMonitoring('unknown');
      expect(result).toBe(false);
    });
  });

  describe('stopAllMonitoring', () => {
    it('should stop all sessions for user', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: {
          departureStationId: 'gangnam',
          departureStationName: '강남역',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          lineIds: ['2'],
        },
        pollingIntervalSeconds: 30,
        bufferMinutes: 10,
      });
      const count = delayResponseAlertService.stopAllMonitoring('user-1');
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 for user with no sessions', () => {
      const count = delayResponseAlertService.stopAllMonitoring('unknown');
      expect(count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should cleanup all resources', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: {
          departureStationId: 'gangnam',
          departureStationName: '강남역',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          lineIds: ['2'],
        },
        pollingIntervalSeconds: 30,
        bufferMinutes: 10,
      });
      expect(() => delayResponseAlertService.destroy()).not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: {
          departureStationId: 'gangnam',
          departureStationName: '강남역',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          lineIds: ['2'],
        },
        pollingIntervalSeconds: 30,
        bufferMinutes: 10,
      });
      const sessions = delayResponseAlertService.getActiveSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
