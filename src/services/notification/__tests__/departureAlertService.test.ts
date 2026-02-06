/**
 * Departure Alert Service Tests
 * Tests for ML-based departure prediction and notification scheduling
 */

import { departureAlertService } from '../departureAlertService';
import { DepartureAlertConfig } from '@/models/ml';

// Mock dependencies
jest.mock('../notificationService', () => ({
  notificationService: {
    scheduleCommuteReminder: jest.fn().mockResolvedValue('notification-123'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
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

let mockAlertIdCounter = 0;
jest.mock('@/models/ml', () => ({
  generateAlertId: jest.fn(() => `alert-${++mockAlertIdCounter}-${Date.now()}`),
  isPredictionReliable: jest.fn((prediction, minConfidence = 0.3) => prediction.confidence >= minConfidence),
}));

jest.mock('@/models/pattern', () => ({
  getDayOfWeek: jest.fn(() => 1), // Monday
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

describe('DepartureAlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertIdCounter = 0; // Reset counter

    // Set a fixed "now" time for testing (8:00 AM)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T08:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('scheduleDepartureAlert', () => {
    it('should schedule alert based on ML prediction', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
        { departureTime: '08:35', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const result = await departureAlertService.scheduleDepartureAlert('user-123');

      expect(result.success).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.predictedDepartureTime).toBe('08:30');
      expect(result.alert?.confidence).toBe(0.85);
      expect(mockNotificationService.scheduleCommuteReminder).toHaveBeenCalled();
    });

    it('should fail when no commute history available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const result = await departureAlertService.scheduleDepartureAlert('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No commute history available');
      expect(result.alert).toBeNull();
    });

    it('should fail when prediction confidence is below threshold', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.2, // Below default threshold of 0.3
        delayProbability: 0.1,
      });

      const result = await departureAlertService.scheduleDepartureAlert('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('confidence');
    });

    it('should respect custom confidence threshold', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.5,
        delayProbability: 0.1,
      });

      const config: Partial<DepartureAlertConfig> = {
        minConfidence: 0.7, // Higher threshold
      };

      const result = await departureAlertService.scheduleDepartureAlert('user-123', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('confidence');
    });

    it('should fail when alert time has already passed', async () => {
      // Set time to 8:20 AM, prediction is 8:30 AM, alert would be at 8:15 AM (already passed)
      jest.setSystemTime(new Date('2024-01-15T08:20:00'));

      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const result = await departureAlertService.scheduleDepartureAlert('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Alert time has already passed');
    });

    it('should use custom minutesBefore setting', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const config: Partial<DepartureAlertConfig> = {
        minutesBefore: 20,
      };

      const result = await departureAlertService.scheduleDepartureAlert('user-123', config);

      expect(result.success).toBe(true);
      expect(result.alert?.alertTime).toBe('08:10'); // 08:30 - 20 min
    });
  });

  describe('cancelAlert', () => {
    it('should cancel a scheduled alert', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const scheduleResult = await departureAlertService.scheduleDepartureAlert('user-123');
      const alertId = scheduleResult.alert!.id;

      const cancelled = await departureAlertService.cancelAlert(alertId);

      expect(cancelled).toBe(true);
      expect(mockNotificationService.cancelNotification).toHaveBeenCalledWith('notification-123');
    });

    it('should return false for non-existent alert', async () => {
      const cancelled = await departureAlertService.cancelAlert('non-existent-id');

      expect(cancelled).toBe(false);
    });
  });

  describe('cancelAllAlerts', () => {
    it('should cancel all alerts for a user', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      // Schedule multiple alerts
      await departureAlertService.scheduleDepartureAlert('user-123');
      await departureAlertService.scheduleDepartureAlert('user-123');

      const cancelledCount = await departureAlertService.cancelAllAlerts('user-123');

      expect(cancelledCount).toBe(2);
    });
  });

  describe('getScheduledAlerts', () => {
    it('should return all scheduled alerts for a user', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      await departureAlertService.scheduleDepartureAlert('user-123');

      const alerts = departureAlertService.getScheduledAlerts('user-123');

      expect(alerts.length).toBe(1);
      expect(alerts[0]?.userId).toBe('user-123');
    });

    it('should return empty array when no alerts scheduled', () => {
      const alerts = departureAlertService.getScheduledAlerts('user-999');

      expect(alerts).toEqual([]);
    });
  });

  describe('getPredictedDeparture', () => {
    it('should return ML prediction for departure', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const prediction = await departureAlertService.getPredictedDeparture('user-123');

      expect(prediction).not.toBeNull();
      expect(prediction?.predictedDepartureTime).toBe('08:30');
      expect(prediction?.confidence).toBe(0.85);
    });

    it('should return null when no logs available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const prediction = await departureAlertService.getPredictedDeparture('user-123');

      expect(prediction).toBeNull();
    });

    it('should return null on error', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockRejectedValue(new Error('DB error'));

      const prediction = await departureAlertService.getPredictedDeparture('user-123');

      expect(prediction).toBeNull();
    });
  });

  describe('shouldAlertNow', () => {
    it('should return true when within buffer time of departure', async () => {
      // Current time: 8:27 AM, departure: 8:30 AM (3 minutes away)
      jest.setSystemTime(new Date('2024-01-15T08:27:00'));

      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const result = await departureAlertService.shouldAlertNow('user-123', 5);

      expect(result.shouldAlert).toBe(true);
      expect(result.prediction).not.toBeNull();
      expect(result.reason).toContain('minutes until departure');
    });

    it('should return false when departure time has passed', async () => {
      // Current time: 8:35 AM, departure was: 8:30 AM
      jest.setSystemTime(new Date('2024-01-15T08:35:00'));

      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const result = await departureAlertService.shouldAlertNow('user-123');

      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('Departure time has passed');
    });

    it('should return false when no prediction available', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([]);

      const result = await departureAlertService.shouldAlertNow('user-123');

      expect(result.shouldAlert).toBe(false);
      expect(result.prediction).toBeNull();
      expect(result.reason).toBe('No prediction available');
    });

    it('should return false when prediction confidence is too low', async () => {
      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.2, // Low confidence
        delayProbability: 0.1,
      });

      const result = await departureAlertService.shouldAlertNow('user-123');

      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('Prediction confidence too low');
    });

    it('should return false when not yet time to alert', async () => {
      // Current time: 8:00 AM, departure: 8:30 AM (30 minutes away, buffer is 5)
      jest.setSystemTime(new Date('2024-01-15T08:00:00'));

      mockCommuteLogService.getRecentLogsForAnalysis.mockResolvedValue([
        { departureTime: '08:30', dayOfWeek: 1 },
      ]);
      mockModelService.predict.mockResolvedValue({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
        confidence: 0.85,
        delayProbability: 0.1,
      });

      const result = await departureAlertService.shouldAlertNow('user-123', 5);

      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toContain('not yet time');
    });
  });
});
