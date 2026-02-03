/**
 * Train Arrival Alert Service Tests
 * Tests for real-time train arrival monitoring and notification
 */

import { trainArrivalAlertService, TrainArrivalStatus } from '../trainArrivalAlertService';
import { TrainArrivalConfig } from '@/models/ml';

// Mock dependencies
jest.mock('../notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn().mockResolvedValue('notification-123'),
  },
  NotificationType: {
    ARRIVAL_REMINDER: 'ARRIVAL_REMINDER',
  },
}));

jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn(),
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

let mockTrainAlertIdCounter = 0;
jest.mock('@/models/ml', () => ({
  generateAlertId: jest.fn(() => `alert-${++mockTrainAlertIdCounter}-${Date.now()}`),
}));

const mockNotificationService = require('../notificationService').notificationService;
const mockSeoulSubwayApi = require('@/services/api/seoulSubwayApi').seoulSubwayApi;
const mockModelService = require('@/services/ml').modelService;
const mockCommuteLogService = require('@/services/pattern/commuteLogService').commuteLogService;

describe('TrainArrivalAlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrainAlertIdCounter = 0; // Reset counter
    jest.useFakeTimers();
    // Clean up any existing sessions
    trainArrivalAlertService.destroy();
  });

  afterEach(() => {
    trainArrivalAlertService.destroy();
    jest.useRealTimers();
  });

  describe('startMonitoring', () => {
    const mockConfig: TrainArrivalConfig = {
      userId: 'user-123',
      stationId: '강남',
      lineId: '2',
      direction: 'up',
      targetTime: '08:30',
      alertMinutesBefore: 3,
      pollingIntervalSeconds: 30,
    };

    it('should start monitoring and return success with alertId', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const result = await trainArrivalAlertService.startMonitoring('user-123', mockConfig);

      expect(result.success).toBe(true);
      expect(result.alertId).toBeTruthy();
      expect(result.error).toBeUndefined();
    });

    it('should enforce minimum polling interval of 30 seconds', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const configWithShortInterval: TrainArrivalConfig = {
        ...mockConfig,
        pollingIntervalSeconds: 10, // Below minimum
      };

      const result = await trainArrivalAlertService.startMonitoring('user-123', configWithShortInterval);

      expect(result.success).toBe(true);
      // Session should have enforced minimum interval
      const sessions = trainArrivalAlertService.getActiveSessions();
      expect(sessions[0]?.config.pollingIntervalSeconds).toBeGreaterThanOrEqual(30);
    });

    it('should perform initial poll on start', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      await trainArrivalAlertService.startMonitoring('user-123', mockConfig);

      expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalledWith('강남');
    });

    it('should add session to active sessions', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      await trainArrivalAlertService.startMonitoring('user-123', mockConfig);

      const sessions = trainArrivalAlertService.getActiveSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.config.userId).toBe('user-123');
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring for a specific alert', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const result = await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      expect(trainArrivalAlertService.getActiveSessions().length).toBe(1);

      const stopped = trainArrivalAlertService.stopMonitoring(result.alertId!);

      expect(stopped).toBe(true);
      expect(trainArrivalAlertService.getActiveSessions().length).toBe(0);
    });

    it('should return false for non-existent alert', () => {
      const stopped = trainArrivalAlertService.stopMonitoring('non-existent-id');

      expect(stopped).toBe(false);
    });
  });

  describe('stopAllMonitoring', () => {
    it('should stop all monitoring sessions for a user', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      // Start multiple sessions for same user
      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '잠실',
        lineId: '2',
        direction: 'down',
        targetTime: '09:00',
        alertMinutesBefore: 5,
        pollingIntervalSeconds: 30,
      });

      expect(trainArrivalAlertService.getActiveSessions().length).toBe(2);

      const stoppedCount = trainArrivalAlertService.stopAllMonitoring('user-123');

      expect(stoppedCount).toBe(2);
      expect(trainArrivalAlertService.getActiveSessions().length).toBe(0);
    });

    it('should not affect other users sessions', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      await trainArrivalAlertService.startMonitoring('user-456', {
        userId: 'user-456',
        stationId: '잠실',
        lineId: '2',
        direction: 'down',
        targetTime: '09:00',
        alertMinutesBefore: 5,
        pollingIntervalSeconds: 30,
      });

      trainArrivalAlertService.stopAllMonitoring('user-123');

      expect(trainArrivalAlertService.getActiveSessions().length).toBe(1);
      expect(trainArrivalAlertService.getActiveSessions()[0]?.config.userId).toBe('user-456');
    });
  });

  describe('destroy', () => {
    it('should clean up all sessions regardless of user', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      await trainArrivalAlertService.startMonitoring('user-456', {
        userId: 'user-456',
        stationId: '잠실',
        lineId: '2',
        direction: 'down',
        targetTime: '09:00',
        alertMinutesBefore: 5,
        pollingIntervalSeconds: 30,
      });

      trainArrivalAlertService.destroy();

      expect(trainArrivalAlertService.getActiveSessions().length).toBe(0);
    });
  });

  describe('getTrainArrivalStatus', () => {
    it('should return filtered train arrivals by line and direction', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '3분 후 도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
        {
          subwayId: '2',
          updnLine: '하행',
          arvlMsg2: '5분 후 도착',
          btrainNo: '2002',
          bstatnNm: '강남',
        },
        {
          subwayId: '3',
          updnLine: '상행',
          arvlMsg2: '2분 후 도착',
          btrainNo: '3001',
          bstatnNm: '대화',
        },
      ]);

      const statuses = await trainArrivalAlertService.getTrainArrivalStatus('강남', '2', 'up');

      expect(statuses.length).toBe(1);
      expect(statuses[0]?.lineId).toBe('2');
      expect(statuses[0]?.direction).toBe('up');
      expect(statuses[0]?.arrivalMinutes).toBe(3);
    });

    it('should parse arrival messages correctly', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '곧 도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
      ]);

      const statuses = await trainArrivalAlertService.getTrainArrivalStatus('강남', '2', 'up');

      expect(statuses[0]?.arrivalMinutes).toBe(1);
      expect(statuses[0]?.status).toBe('approaching');
    });

    it('should handle "도착" status', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
      ]);

      const statuses = await trainArrivalAlertService.getTrainArrivalStatus('강남', '2', 'up');

      expect(statuses[0]?.arrivalMinutes).toBe(0);
      expect(statuses[0]?.status).toBe('arrived');
    });

    it('should return empty array on API error', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValue(new Error('API error'));

      const statuses = await trainArrivalAlertService.getTrainArrivalStatus('강남', '2', 'up');

      expect(statuses).toEqual([]);
    });
  });

  describe('calculateOptimalTrain', () => {
    it('should return null when no commute logs available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const result = await trainArrivalAlertService.calculateOptimalTrain(
        'user-123',
        '강남',
        '2',
        'up'
      );

      expect(result).toBeNull();
    });

    it('should calculate optimal train based on prediction and arrivals', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        confidence: 0.8,
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '5분 후 도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
      ]);

      const result = await trainArrivalAlertService.calculateOptimalTrain(
        'user-123',
        '강남',
        '2',
        'up'
      );

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.8);
      expect(result?.direction).toBe('up');
    });

    it('should return prediction-based result when no real-time data available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        confidence: 0.8,
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const result = await trainArrivalAlertService.calculateOptimalTrain(
        'user-123',
        '강남',
        '2',
        'up'
      );

      expect(result).not.toBeNull();
      expect(result?.scheduledTime).toBe('08:30');
      expect(result?.confidence).toBe(0.4); // Lower confidence without real-time
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active monitoring sessions', async () => {
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      const sessions = trainArrivalAlertService.getActiveSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0]?.config.stationId).toBe('강남');
      expect(sessions[0]?.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('notification triggering', () => {
    it('should send notification when train arrives within alert threshold', async () => {
      // Train already within alert threshold on initial poll
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '2분 후 도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
      ]);

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3, // Alert when 3 min or less, train is 2 min away
        pollingIntervalSeconds: 30,
      });

      // Allow all pending promises to resolve (initial poll is awaited in startMonitoring)
      await jest.runAllTimersAsync();

      // Initial poll happens immediately and should trigger notification
      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalled();
    });

    it('should not send duplicate notifications for same train', async () => {
      const trainData = [
        {
          subwayId: '2',
          updnLine: '상행',
          arvlMsg2: '2분 후 도착',
          btrainNo: '2001',
          bstatnNm: '신도림',
        },
      ];

      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(trainData);

      await trainArrivalAlertService.startMonitoring('user-123', {
        userId: 'user-123',
        stationId: '강남',
        lineId: '2',
        direction: 'up',
        targetTime: '08:30',
        alertMinutesBefore: 3,
        pollingIntervalSeconds: 30,
      });

      // First notification should be sent and monitoring stopped
      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledTimes(1);

      // Session should be removed after successful alert
      expect(trainArrivalAlertService.getActiveSessions().length).toBe(0);
    });
  });
});
