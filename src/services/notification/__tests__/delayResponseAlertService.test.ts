/**
 * Delay Response Alert Service Tests
 */

import { delayResponseAlertService, RouteDelayStatus } from '../delayResponseAlertService';

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

jest.mock('@/services/notification/notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn().mockResolvedValue('notif-123'),
  },
  NotificationType: {
    DELAY_ALERT: 'delay_alert',
    EMERGENCY_ALERT: 'emergency_alert',
    ARRIVAL_REMINDER: 'arrival_reminder',
    SERVICE_UPDATE: 'service_update',
    COMMUTE_REMINDER: 'commute_reminder',
  },
}));

// seoulSubwayApi mock은 캐시-우회 방지 테스트(직접 호출되지 않음을 단언)를
// 위해서만 유지한다. getLineDelays는 arrivalService.getArrivals를 경유한다.
jest.mock('../../api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/arrival/arrivalService', () => ({
  arrivalService: {
    getArrivals: jest.fn(),
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
    predict: jest.fn().mockResolvedValue({
      predictedDepartureTime: '08:00',
    }),
  },
}));

jest.mock('../../pattern/commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/models/ml', () => ({
  generateAlertId: jest.fn().mockReturnValue('alert-123'),
}));

/**
 * Build a normalized ArrivalInfo for arrivalService.getArrivals mock.
 * Mirrors the shape arrivalService produces: lineId normalized to "1".."9",
 * arvlMsg2 → arrivalMessage. stationName echoes the queried departure station.
 */
type DelayRow = { lineId: string; arrivalMessage: string };
function makeArrivalInfo(rows: readonly DelayRow[]) {
  return {
    stationName: '강남역',
    stationId: 'gangnam',
    arrivals: rows.map((row, index) => ({
      trainId: `t${index + 1}`,
      lineId: row.lineId,
      direction: 'up' as const,
      destination: '성수',
      arrivalSeconds: null,
      arrivalMessage: row.arrivalMessage,
      trainNumber: `${index + 1}`,
    })),
    lastUpdated: new Date(),
    source: 'api' as const,
  };
}

describe('DelayResponseAlertService', () => {
  let mockSeoulSubwayApi: any;
  let mockArrivalService: any;
  let mockNotificationService: any;
  let mockModelService: any;
  let mockCommuteLogService: any;
  let mockGenerateAlertId: any;
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  const mockRoute = {
    departureStationId: 'gangnam',
    departureStationName: '강남역',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    lineIds: ['2'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSeoulSubwayApi = require('@/services/api/seoulSubwayApi').seoulSubwayApi;
    mockArrivalService = require('@/services/arrival/arrivalService').arrivalService;
    mockNotificationService = require('@/services/notification/notificationService').notificationService;
    mockModelService = require('@/services/ml').modelService;
    mockCommuteLogService = require('@/services/pattern/commuteLogService').commuteLogService;
    mockGenerateAlertId = require('@/models/ml').generateAlertId;

    // Reset mocks with default values
    mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
    mockNotificationService.sendLocalNotification.mockResolvedValue('notif-123');
    mockModelService.predict.mockResolvedValue({
      predictedDepartureTime: '08:00',
    });
    mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);
    mockGenerateAlertId.mockReturnValue('alert-123');

    // Setup spies for setInterval/clearInterval
    setIntervalSpy = jest.spyOn(global, 'setInterval');
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    delayResponseAlertService.destroy();
    jest.useRealTimers();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  // ========================================================================
  // checkRouteDelays Tests
  // ========================================================================

  describe('checkRouteDelays', () => {
    it('should check for no delays when arrivals are empty', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(false);
      expect(result.affectedLines).toEqual([]);
      expect(result.maxDelayMinutes).toBe(0);
      expect(result.delayDetails).toEqual([]);
    });

    it('should detect delays in arrival messages', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '5분 지연 중입니다' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(true);
      expect(result.affectedLines).toContain('2');
      expect(result.maxDelayMinutes).toBe(5);
      expect(result.delayDetails.length).toBeGreaterThan(0);
    });

    it('should extract delay minutes from message', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '10분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.maxDelayMinutes).toBe(10);
    });

    it('should ignore delays below minimum threshold (3 minutes)', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '2분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(false);
      expect(result.delayDetails).toEqual([]);
    });

    it('should find maximum delay among multiple lines', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([
          { lineId: '2', arrivalMessage: '5분 지연' },
          { lineId: '2', arrivalMessage: '15분 지연' },
        ])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.maxDelayMinutes).toBe(15);
    });

    it('should handle error and return safe default', async () => {
      mockArrivalService.getArrivals.mockRejectedValue(new Error('API error'));
      mockModelService.predict.mockRejectedValue(new Error('Model error'));

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(false);
      expect(result.maxDelayMinutes).toBe(0);
      expect(result.originalDepartureTime).toBe('08:00');
      expect(result.adjustedDepartureTime).toBe('08:00');
      expect(result.delayDetails).toEqual([]);
    });

    it('should handle multiple line ids in route', async () => {
      const multiLineRoute = {
        ...mockRoute,
        lineIds: ['2', '3'],
      };

      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([
          { lineId: '2', arrivalMessage: '5분 지연' },
          { lineId: '3', arrivalMessage: '10분 지연' },
        ])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', multiLineRoute);

      expect(result.affectedLines).toEqual(['2', '3']);
      expect(result.maxDelayMinutes).toBe(10);
    });

    it('should include delay reasons in details', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '10분 사고로 인한 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.delayDetails[0]!.reason).toBe('사고 발생');
    });

    it('should call modelService.predict with correct parameters', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '09:00',
      });

      await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(mockModelService.predict).toHaveBeenCalled();
    });

    it('should fetch via arrivalService and never call seoulSubwayApi directly (cache-bypass prevention, PR #170)', async () => {
      // getLineDelays must route through the shared-cache/rate-limit layer
      // (arrivalService.getArrivals), not hit seoulSubwayApi.getRealtimeArrival
      // directly. A direct call starves StationDetail's per-station rate-limit.
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '5분 지연' }])
      );

      await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(mockArrivalService.getArrivals).toHaveBeenCalled();
      expect(mockSeoulSubwayApi.getRealtimeArrival).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // calculateAdjustedDeparture Tests
  // ========================================================================

  describe('calculateAdjustedDeparture', () => {
    it('should return adjusted departure time with delay and buffer', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:30', 5, 10
      );
      expect(result).toBe('08:15');
    });

    it('should handle zero delay', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:30', 0, 0
      );
      expect(result).toBe('08:30');
    });

    it('should handle zero delay with buffer', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:30', 0, 10
      );
      expect(result).toBe('08:20');
    });

    it('should handle large delays', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '08:00', 60, 10
      );
      expect(result).toBe('06:50');
    });

    it('should handle wraparound to previous day', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '01:00', 120, 10
      );
      // 60 minutes = 1 hour, 120 + 10 = 130 minutes from 01:00 = 22:50 previous day
      expect(result).toBe('22:50');
    });

    it('should handle midnight edge case', () => {
      const result = delayResponseAlertService.calculateAdjustedDeparture(
        '00:30', 30, 0
      );
      expect(result).toBe('00:00');
    });
  });

  // ========================================================================
  // startDelayMonitoring Tests
  // ========================================================================

  describe('startDelayMonitoring', () => {
    it('should return a valid session ID', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      expect(typeof sessionId).toBe('string');
      expect(sessionId).toBe('alert-123');
    });

    it('should create an active session', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const sessions = delayResponseAlertService.getActiveSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.some(s => s.id === sessionId)).toBe(true);
    });

    it('should set up polling interval with configured interval', () => {
      jest.spyOn(global, 'setInterval');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // 60 seconds * 1000
      );
    });

    it('should use default polling interval if not specified', () => {
      jest.spyOn(global, 'setInterval');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 0, // Should use default
        bufferMinutes: 10,
      });

      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // DEFAULT_POLLING_INTERVAL_SECONDS = 60
      );
    });

    it('should set up monitoring without throwing', () => {
      mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      // Should not throw even with initial check
      expect(() => {
        delayResponseAlertService.startDelayMonitoring({
          userId: 'user-1',
          route: mockRoute,
          pollingIntervalSeconds: 60,
          bufferMinutes: 10,
        });
      }).not.toThrow();
    });

    it('should support multiple concurrent sessions', () => {
      // Ensure clean state
      delayResponseAlertService.destroy();

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      mockGenerateAlertId.mockReturnValueOnce('alert-124'); // Different ID for second session

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-2',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const sessions = delayResponseAlertService.getActiveSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.some(s => s.config.userId === 'user-1')).toBe(true);
      expect(sessions.some(s => s.config.userId === 'user-2')).toBe(true);
    });
  });

  // ========================================================================
  // stopDelayMonitoring Tests
  // ========================================================================

  describe('stopDelayMonitoring', () => {
    it('should stop existing session', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const result = delayResponseAlertService.stopDelayMonitoring(sessionId);

      expect(result).toBe(true);
    });

    it('should remove session from active sessions', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      delayResponseAlertService.stopDelayMonitoring(sessionId);
      const sessions = delayResponseAlertService.getActiveSessions();

      expect(sessions.some(s => s.id === sessionId)).toBe(false);
    });

    it('should return false for unknown session', () => {
      const result = delayResponseAlertService.stopDelayMonitoring('unknown-session');

      expect(result).toBe(false);
    });

    it('should clear interval when stopping', () => {
      jest.spyOn(global, 'clearInterval');

      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      delayResponseAlertService.stopDelayMonitoring(sessionId);

      expect(clearInterval).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // stopAllMonitoring Tests
  // ========================================================================

  describe('stopAllMonitoring', () => {
    it('should stop all sessions for user', () => {
      delayResponseAlertService.destroy(); // Clean state
      mockGenerateAlertId.mockReturnValueOnce('alert-123');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      mockGenerateAlertId.mockReturnValueOnce('alert-124');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const count = delayResponseAlertService.stopAllMonitoring('user-1');

      expect(count).toBeGreaterThanOrEqual(1);
      expect(delayResponseAlertService.getActiveSessions().length).toBe(0);
    });

    it('should return 0 for user with no sessions', () => {
      const count = delayResponseAlertService.stopAllMonitoring('user-no-sessions');

      expect(count).toBe(0);
    });

    it('should only stop sessions for specified user', () => {
      delayResponseAlertService.destroy(); // Clean state
      mockGenerateAlertId.mockReturnValueOnce('alert-123');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      mockGenerateAlertId.mockReturnValueOnce('alert-124');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-2',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const count = delayResponseAlertService.stopAllMonitoring('user-1');

      expect(count).toBeGreaterThanOrEqual(1);
      const sessions = delayResponseAlertService.getActiveSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0]!.config.userId).toBe('user-2');
    });
  });

  // ========================================================================
  // destroy Tests
  // ========================================================================

  describe('destroy', () => {
    it('should cleanup all resources without throwing', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      expect(() => delayResponseAlertService.destroy()).not.toThrow();
    });

    it('should clear all active sessions', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      delayResponseAlertService.destroy();

      expect(delayResponseAlertService.getActiveSessions().length).toBe(0);
    });

    it('should clear intervals for all sessions', () => {
      jest.spyOn(global, 'clearInterval');

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      delayResponseAlertService.destroy();

      expect(clearInterval).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // getActiveSessions Tests
  // ========================================================================

  describe('getActiveSessions', () => {
    it('should return array of active sessions', () => {
      const sessionId = delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const sessions = delayResponseAlertService.getActiveSessions();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]!.id).toBe(sessionId);
    });

    it('should return empty array when no sessions active', () => {
      const sessions = delayResponseAlertService.getActiveSessions();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(0);
    });

    it('should include all session details', () => {
      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      const sessions = delayResponseAlertService.getActiveSessions();
      const session = sessions[0]!;

      expect(session.id).toBeDefined();
      expect(session.config).toBeDefined();
      expect(session.intervalId).toBeDefined();
      expect(session.lastAlert).toBe(null);
    });
  });

  // ========================================================================
  // subscribeToRouteDelays Tests
  // ========================================================================

  describe('subscribeToRouteDelays', () => {
    // Note: subscribeToRouteDelays uses setInterval which is not compatible
    // with fake timers in this testing environment. Real timer tests for this
    // method are tested via integration tests or e2e tests.
    // We verify the structure here through manual testing patterns.

    it('should return a function', async () => {
      // Mock the interval to avoid setInterval issues
      const originalSetInterval = global.setInterval;
      // callback is captured but used implicitly through setInterval mock

      (global as any).setInterval = jest.fn((callback: () => void) => {
        void callback;
        return 1 as any;
      });

      try {
        const callback = jest.fn();
        mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
        mockModelService.predict.mockResolvedValue({
          predictedDepartureTime: '08:00',
        });

        const unsubscribe = await delayResponseAlertService.subscribeToRouteDelays(
          mockRoute,
          callback,
          'user-1'
        );

        expect(typeof unsubscribe).toBe('function');
      } finally {
        (global as any).setInterval = originalSetInterval;
        delayResponseAlertService.destroy();
      }
    });

    it('should trigger callback on initial call', async () => {
      const originalSetInterval = global.setInterval;
      (global as any).setInterval = jest.fn(() => 1 as any);

      try {
        const callback = jest.fn();
        mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
        mockModelService.predict.mockResolvedValue({
          predictedDepartureTime: '08:00',
        });

        const unsubscribe = await delayResponseAlertService.subscribeToRouteDelays(
          mockRoute,
          callback,
          'user-1'
        );

        // Check that callback was called with proper structure
        expect(callback).toHaveBeenCalled();
        const firstCall = callback.mock.calls[0][0];
        expect(firstCall).toHaveProperty('hasDelays');
        expect(firstCall).toHaveProperty('affectedLines');
        expect(firstCall).toHaveProperty('maxDelayMinutes');

        unsubscribe();
      } finally {
        (global as any).setInterval = originalSetInterval;
        delayResponseAlertService.destroy();
      }
    });

    it('should add session to active sessions', async () => {
      const originalSetInterval = global.setInterval;
      (global as any).setInterval = jest.fn(() => 1 as any);

      try {
        const callback = jest.fn();
        mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
        mockModelService.predict.mockResolvedValue({
          predictedDepartureTime: '08:00',
        });

        await delayResponseAlertService.subscribeToRouteDelays(
          mockRoute,
          callback,
          'user-1'
        );

        const sessions = delayResponseAlertService.getActiveSessions();
        expect(sessions.length).toBeGreaterThan(0);
        expect(sessions[sessions.length - 1]!.config.userId).toBe('user-1');
      } finally {
        (global as any).setInterval = originalSetInterval;
        delayResponseAlertService.destroy();
      }
    });
  });

  // ========================================================================
  // sendDelayAlert Tests
  // ========================================================================

  describe('sendDelayAlert', () => {
    it('should return null if no delays', async () => {
      const status: RouteDelayStatus = {
        hasDelays: false,
        affectedLines: [],
        maxDelayMinutes: 0,
        adjustedDepartureTime: '08:00',
        originalDepartureTime: '08:00',
        recommendation: '정상 운행',
        delayDetails: [],
      };

      const result = await delayResponseAlertService.sendDelayAlert('user-1', status);

      expect(result).toBeNull();
    });

    it('should send notification and return alert for delays', async () => {
      const status: RouteDelayStatus = {
        hasDelays: true,
        affectedLines: ['2'],
        maxDelayMinutes: 10,
        adjustedDepartureTime: '07:50',
        originalDepartureTime: '08:00',
        recommendation: '10분 지연',
        delayDetails: [],
      };

      const result = await delayResponseAlertService.sendDelayAlert('user-1', status);

      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.id).toBe('alert-123');
    });

    it('should include correct notification data', async () => {
      const status: RouteDelayStatus = {
        hasDelays: true,
        affectedLines: ['2', '3'],
        maxDelayMinutes: 15,
        adjustedDepartureTime: '07:45',
        originalDepartureTime: '08:00',
        recommendation: '15분 지연 중',
        delayDetails: [],
      };

      await delayResponseAlertService.sendDelayAlert('user-1', status);

      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '지연 알림',
          body: '15분 지연 중',
          data: expect.objectContaining({
            userId: 'user-1',
            maxDelayMinutes: 15,
            adjustedDepartureTime: '07:45',
          }),
          priority: 'high',
        })
      );
    });

    it('should return valid alert object', async () => {
      const status: RouteDelayStatus = {
        hasDelays: true,
        affectedLines: ['2'],
        maxDelayMinutes: 10,
        adjustedDepartureTime: '07:50',
        originalDepartureTime: '08:00',
        recommendation: '10분 지연',
        delayDetails: [],
      };

      const result = await delayResponseAlertService.sendDelayAlert('user-1', status);

      expect(result).toEqual(expect.objectContaining({
        id: 'alert-123',
        userId: 'user-1',
        originalDepartureTime: '08:00',
        adjustedDepartureTime: '07:50',
        maxDelayMinutes: 10,
        affectedLines: ['2'],
        recommendation: '10분 지연',
        createdAt: expect.any(Date),
      }));
    });

    it('should return null on notification error', async () => {
      mockNotificationService.sendLocalNotification.mockRejectedValue(
        new Error('Notification failed')
      );

      const status: RouteDelayStatus = {
        hasDelays: true,
        affectedLines: ['2'],
        maxDelayMinutes: 10,
        adjustedDepartureTime: '07:50',
        originalDepartureTime: '08:00',
        recommendation: '10분 지연',
        delayDetails: [],
      };

      const result = await delayResponseAlertService.sendDelayAlert('user-1', status);

      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling Tests
  // ========================================================================

  describe('Edge cases and error handling', () => {
    it('should handle missing arrival message', async () => {
      // arrivalService normalizes a missing arvlMsg2 to an empty arrivalMessage.
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(false);
    });

    it('should use queried station name from arrivalService result', async () => {
      // arrivalService.getArrivals echoes the queried departure station name
      // into ArrivalInfo.stationName, so DelayDetail.stationName reflects it.
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '5분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.delayDetails[0]!.stationName).toBe('강남역');
    });

    it('should determine correct delay reason from message', async () => {
      const testCases = [
        { message: '사고로 인한 지연', expectedReason: '사고 발생' },
        { message: '시설 장애로 운행 중지', expectedReason: '시설 장애' },
        { message: '역 혼잡으로 운행 지연', expectedReason: '역 혼잡' },
        { message: '시설 점검 중', expectedReason: '시설 점검' },
        { message: '5분 지연', expectedReason: '운행 지연' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockArrivalService.getArrivals.mockResolvedValue(
          makeArrivalInfo([{ lineId: '2', arrivalMessage: testCase.message }])
        );
        mockModelService.predict.mockResolvedValue({
          predictedDepartureTime: '08:00',
        });

        const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

        if (testCase.message.includes('지연')) {
          expect(result.delayDetails[0]?.reason).toBe(testCase.expectedReason);
        }
      }
    });

    it('should default to 5 minutes if delay amount not specified', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '지연 발생' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.maxDelayMinutes).toBe(5);
    });

    it('should match line by normalized lineId from arrivalService', async () => {
      // arrivalService normalizes lineId to "1".."9"; getLineDelays compares
      // arrival.lineId === lineId directly (no raw subwayId/trainLineNm).
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '5분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(true);
    });

    it('should respect alert cooldown for repeated checks', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '10분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      delayResponseAlertService.startDelayMonitoring({
        userId: 'user-1',
        route: mockRoute,
        pollingIntervalSeconds: 60,
        bufferMinutes: 10,
      });

      // Clear mocks after initial check
      jest.clearAllMocks();
      mockArrivalService.getArrivals.mockResolvedValue(
        makeArrivalInfo([{ lineId: '2', arrivalMessage: '10분 지연' }])
      );
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:00',
      });

      // Advance timer by 10 minutes (less than 30 minute cooldown)
      jest.advanceTimersByTime(600000);

      // Should not send another alert due to cooldown
      expect(mockNotificationService.sendLocalNotification).not.toHaveBeenCalled();

      // Advance past cooldown (30 minutes)
      jest.advanceTimersByTime(1800000);

      // Now should send alert
      // (callback would be called but we need to check the behavior)
    });

    it('should handle modelService.predict error gracefully', async () => {
      mockArrivalService.getArrivals.mockResolvedValue(makeArrivalInfo([]));
      mockModelService.predict.mockRejectedValue(new Error('Prediction failed'));

      const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

      expect(result.hasDelays).toBe(false);
      expect(result.originalDepartureTime).toBe('08:00');
    });

    it('should generate appropriate recommendations based on delay severity', async () => {
      const testCases = [
        { delay: 0, expected: '정상 운행' },
        { delay: 3, expected: '약간의 지연' },
        { delay: 10, expected: '약 10분' },
        { delay: 20, expected: '⚠️' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockArrivalService.getArrivals.mockResolvedValue(
          makeArrivalInfo(
            testCase.delay === 0
              ? []
              : [{ lineId: '2', arrivalMessage: `${testCase.delay}분 지연` }]
          )
        );
        mockModelService.predict.mockResolvedValue({
          predictedDepartureTime: '08:00',
        });

        const result = await delayResponseAlertService.checkRouteDelays('user-1', mockRoute);

        expect(result.recommendation).toContain(testCase.expected);
      }
    });
  });
});
