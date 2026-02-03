/**
 * Integrated Alert Service Tests
 * Tests for unified smart notification system orchestration
 */

import {
  integratedAlertService,
  IntegratedAlertConfig,
} from '../integratedAlertService';
import { IntegratedAlert, AlertPriority } from '@/models/ml';

// Mock dependencies
jest.mock('../notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn().mockResolvedValue('notification-123'),
  },
  NotificationType: {
    COMMUTE_REMINDER: 'COMMUTE_REMINDER',
  },
}));

jest.mock('../departureAlertService', () => ({
  departureAlertService: {
    cancelAllAlerts: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('../trainArrivalAlertService', () => ({
  trainArrivalAlertService: {
    stopAllMonitoring: jest.fn().mockReturnValue(0),
    destroy: jest.fn(),
  },
}));

jest.mock('../delayResponseAlertService', () => ({
  delayResponseAlertService: {
    stopAllMonitoring: jest.fn().mockReturnValue(0),
    checkRouteDelays: jest.fn().mockResolvedValue({
      hasDelays: false,
      affectedLines: [],
      maxDelayMinutes: 0,
      delayDetails: [],
      adjustedDepartureTime: null,
    }),
    destroy: jest.fn(),
  },
}));

jest.mock('@/services/api', () => ({
  publicDataApi: {
    getAlertsByLine: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/ml', () => ({
  modelService: {
    predict: jest.fn(),
  },
}));

jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn(),
  },
}));

jest.mock('@/services/pattern/patternAnalysisService', () => ({
  patternAnalysisService: {
    getPatternForDay: jest.fn(),
  },
}));

let mockIntegratedAlertIdCounter = 0;
jest.mock('@/models/ml', () => ({
  generateAlertId: jest.fn(() => `alert-${++mockIntegratedAlertIdCounter}-${Date.now()}`),
  calculateAlertPriority: jest.fn(() => 'medium' as AlertPriority),
  DEFAULT_MONITORING_SETTINGS: {
    morningEnabled: true,
    morningStartHour: 6,
    morningEndHour: 10,
    eveningEnabled: true,
    eveningStartHour: 17,
    eveningEndHour: 21,
    daysToMonitor: [1, 2, 3, 4, 5],
  },
}));

jest.mock('@/models/pattern', () => ({
  getDayOfWeek: jest.fn(() => 1),
  parseTimeToMinutes: jest.fn((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }),
  formatMinutesToTime: jest.fn((minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }),
}));

const mockNotificationService = require('../notificationService').notificationService;
const mockModelService = require('@/services/ml').modelService;
const mockCommuteLogService = require('@/services/pattern/commuteLogService').commuteLogService;
const mockPatternAnalysisService = require('@/services/pattern/patternAnalysisService').patternAnalysisService;
const mockDelayResponseAlertService = require('../delayResponseAlertService').delayResponseAlertService;

describe('IntegratedAlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntegratedAlertIdCounter = 0; // Reset counter
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T08:00:00')); // Monday 8 AM
    integratedAlertService.destroy();
  });

  afterEach(() => {
    integratedAlertService.destroy();
    jest.useRealTimers();
  });

  describe('generateIntegratedAlert', () => {
    it('should generate alert based on pattern and prediction', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('departure');
      expect(alert?.priority).toBe('low');
      expect(alert?.prediction.predictedDepartureTime).toBe('08:30');
    });

    it('should return null when no commute logs available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert).toBeNull();
    });

    it('should return null when no pattern found for day', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue(null);

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert).toBeNull();
    });

    it('should generate delay_warning alert when delays detected', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });
      mockDelayResponseAlertService.checkRouteDelays.mockResolvedValue({
        hasDelays: true,
        affectedLines: ['2호선'],
        maxDelayMinutes: 10,
        delayDetails: [{ reason: '신호 장애' }],
        adjustedDepartureTime: '08:20',
      });

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('delay_warning');
      expect(alert?.delayStatus?.hasDelay).toBe(true);
    });

    it('should generate delay_warning alert for high delay probability', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.6, // High delay probability
      });

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('delay_warning');
      expect(alert?.priority).toBe('medium');
    });

    it('should include action buttons in alert', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const alert = await integratedAlertService.generateIntegratedAlert('user-123');

      expect(alert?.actionButtons).toBeDefined();
      expect(alert?.actionButtons.length).toBeGreaterThan(0);
      expect(alert?.actionButtons.some((b) => b.type === 'dismiss')).toBe(true);
      expect(alert?.actionButtons.some((b) => b.type === 'snooze')).toBe(true);
    });
  });

  describe('scheduleBackgroundMonitoring', () => {
    it('should start background monitoring for user', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const monitoringId = await integratedAlertService.scheduleBackgroundMonitoring('user-123');

      expect(monitoringId).toBeTruthy();
      expect(integratedAlertService.isMonitoringActive('user-123')).toBe(true);
    });

    it('should stop existing monitoring before starting new', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');
      await integratedAlertService.scheduleBackgroundMonitoring('user-123');

      const sessions = integratedAlertService.getActiveMonitoringSessions();
      const userSessions = sessions.filter((s) => s.userId === 'user-123');
      expect(userSessions.length).toBe(1);
    });

    it('should use custom config when provided', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const config: Partial<IntegratedAlertConfig> = {
        enableDepartureAlert: false,
        enableDelayAlert: true,
        departureMinutesBefore: 20,
      };

      await integratedAlertService.scheduleBackgroundMonitoring('user-123', config);

      const sessions = integratedAlertService.getActiveMonitoringSessions();
      expect(sessions[0]?.config.enableDepartureAlert).toBe(false);
      expect(sessions[0]?.config.departureMinutesBefore).toBe(20);
    });
  });

  describe('stopBackgroundMonitoring', () => {
    it('should stop monitoring for user', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');
      expect(integratedAlertService.isMonitoringActive('user-123')).toBe(true);

      const stopped = integratedAlertService.stopBackgroundMonitoring('user-123');

      expect(stopped).toBe(true);
      expect(integratedAlertService.isMonitoringActive('user-123')).toBe(false);
    });

    it('should return false for non-existent monitoring', () => {
      const stopped = integratedAlertService.stopBackgroundMonitoring('non-existent');

      expect(stopped).toBe(false);
    });

    it('should also stop individual service monitoring', async () => {
      const mockDepartureAlert = require('../departureAlertService').departureAlertService;
      const mockTrainArrivalAlert = require('../trainArrivalAlertService').trainArrivalAlertService;
      const mockDelayResponse = require('../delayResponseAlertService').delayResponseAlertService;

      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');
      integratedAlertService.stopBackgroundMonitoring('user-123');

      expect(mockDepartureAlert.cancelAllAlerts).toHaveBeenCalledWith('user-123');
      expect(mockTrainArrivalAlert.stopAllMonitoring).toHaveBeenCalledWith('user-123');
      expect(mockDelayResponse.stopAllMonitoring).toHaveBeenCalledWith('user-123');
    });
  });

  describe('destroy', () => {
    it('should clean up all monitoring sessions', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');
      await integratedAlertService.scheduleBackgroundMonitoring('user-456');

      integratedAlertService.destroy();

      expect(integratedAlertService.getActiveMonitoringSessions().length).toBe(0);
    });

    it('should clean up dependent services', () => {
      const mockTrainArrivalAlert = require('../trainArrivalAlertService').trainArrivalAlertService;
      const mockDelayResponse = require('../delayResponseAlertService').delayResponseAlertService;

      integratedAlertService.destroy();

      expect(mockTrainArrivalAlert.destroy).toHaveBeenCalled();
      expect(mockDelayResponse.destroy).toHaveBeenCalled();
    });
  });

  describe('getTodayAlerts', () => {
    it('should return alerts created today', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      await integratedAlertService.generateIntegratedAlert('user-123');

      const todayAlerts = await integratedAlertService.getTodayAlerts('user-123');

      expect(todayAlerts.length).toBe(1);
    });
  });

  describe('getAlertHistory', () => {
    it('should return alert history with limit', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockPatternAnalysisService.getPatternForDay.mockResolvedValue({
        frequentRoute: {
          startStation: '강남',
          endStation: '신도림',
          lineIds: ['2'],
        },
      });
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      // Generate multiple alerts
      await integratedAlertService.generateIntegratedAlert('user-123');
      await integratedAlertService.generateIntegratedAlert('user-123');
      await integratedAlertService.generateIntegratedAlert('user-123');

      const history = integratedAlertService.getAlertHistory(2);

      expect(history.length).toBe(2);
    });

    it('should return default 50 alerts when no limit specified', async () => {
      const history = integratedAlertService.getAlertHistory();

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('sendIntegratedNotification', () => {
    it('should send notification successfully', async () => {
      const mockAlert: IntegratedAlert = {
        id: 'alert-123',
        type: 'departure',
        priority: 'low',
        title: '출발 알림',
        body: '08:30 출발 예정입니다.',
        scheduledTime: '08:15',
        prediction: {
          predictedDepartureTime: '08:30',
          predictedArrivalTime: '09:00',
          confidence: 0.85,
          delayProbability: 0.1,
        },
        delayStatus: null,
        trainInfo: null,
        actionButtons: [],
        createdAt: new Date(),
      };

      const result = await integratedAlertService.sendIntegratedNotification(mockAlert);

      expect(result).toBe(true);
      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '출발 알림',
          body: '08:30 출발 예정입니다.',
        })
      );
    });

    it('should return false on notification error', async () => {
      mockNotificationService.sendLocalNotification.mockRejectedValueOnce(
        new Error('Notification failed')
      );

      const mockAlert: IntegratedAlert = {
        id: 'alert-123',
        type: 'departure',
        priority: 'low',
        title: '출발 알림',
        body: '08:30 출발 예정입니다.',
        scheduledTime: '08:15',
        prediction: {
          predictedDepartureTime: '08:30',
          predictedArrivalTime: '09:00',
          confidence: 0.85,
          delayProbability: 0.1,
        },
        delayStatus: null,
        trainInfo: null,
        actionButtons: [],
        createdAt: new Date(),
      };

      const result = await integratedAlertService.sendIntegratedNotification(mockAlert);

      expect(result).toBe(false);
    });

    it('should set high priority for urgent alerts', async () => {
      const mockAlert: IntegratedAlert = {
        id: 'alert-123',
        type: 'delay_warning',
        priority: 'urgent',
        title: '긴급 지연 알림',
        body: '2호선 30분 지연',
        scheduledTime: '08:15',
        prediction: {
          predictedDepartureTime: '08:30',
          predictedArrivalTime: '09:00',
          confidence: 0.85,
          delayProbability: 0.8,
        },
        delayStatus: {
          hasDelay: true,
          affectedLines: ['2호선'],
          maxDelayMinutes: 30,
          reason: '신호 장애',
          adjustedDepartureTime: '08:00',
        },
        trainInfo: null,
        actionButtons: [],
        createdAt: new Date(),
      };

      await integratedAlertService.sendIntegratedNotification(mockAlert);

      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
        })
      );
    });
  });

  describe('isMonitoringActive', () => {
    it('should return true when monitoring is active', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');

      expect(integratedAlertService.isMonitoringActive('user-123')).toBe(true);
    });

    it('should return false when monitoring is not active', () => {
      expect(integratedAlertService.isMonitoringActive('user-123')).toBe(false);
    });
  });

  describe('getActiveMonitoringSessions', () => {
    it('should return all active monitoring sessions', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      await integratedAlertService.scheduleBackgroundMonitoring('user-123');
      await integratedAlertService.scheduleBackgroundMonitoring('user-456');

      const sessions = integratedAlertService.getActiveMonitoringSessions();

      expect(sessions.length).toBe(2);
    });
  });
});
