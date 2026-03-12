/**
 * Smart Notification Service Tests
 */

import { smartNotificationService } from '../smartNotificationService';
import { DayOfWeek, SmartNotificationSettings, PredictedCommute, CustomAlertTime } from '@/models/pattern';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => false,
    data: () => null,
  }),
  setDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

jest.mock('@/models/pattern', () => ({
  getDayOfWeek: jest.fn((date: Date) => (date.getDay() as DayOfWeek)),
  isWeekday: jest.fn((day: DayOfWeek) => day >= 1 && day <= 5),
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }),
  getCurrentTimeString: jest.fn(() => '08:00'),
  createDefaultSmartNotificationSettings: jest.fn(() => ({
    enabled: false,
    alertMinutesBefore: 15,
    checkDelaysFor: [],
    includeWeekends: false,
    customAlertTimes: [],
  })),
  DAY_NAMES_KO: {
    0: '일요일',
    1: '월요일',
    2: '화요일',
    3: '수요일',
    4: '목요일',
    5: '금요일',
    6: '토요일',
  },
}));

jest.mock('../patternAnalysisService', () => ({
  patternAnalysisService: {
    predictCommute: jest.fn().mockResolvedValue(null),
    getWeekPredictions: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    getActiveReports: jest.fn().mockResolvedValue([]),
  },
}));

describe('SmartNotificationService', () => {
  let mockGetDoc: jest.Mock;
  let mockSetDoc: jest.Mock;
  let mockGetDayOfWeek: jest.Mock;
  let mockIsWeekday: jest.Mock;
  let mockParseTimeToMinutes: jest.Mock;
  let mockGetCurrentTimeString: jest.Mock;
  let mockCreateDefaultSmartNotificationSettings: jest.Mock;
  let mockPredictCommute: jest.Mock;
  let mockGetWeekPredictions: jest.Mock;
  let mockGetActiveReports: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get all mocked functions via require
    const firestore = require('firebase/firestore');
    mockGetDoc = firestore.getDoc;
    mockSetDoc = firestore.setDoc;

    const pattern = require('@/models/pattern');
    mockGetDayOfWeek = pattern.getDayOfWeek;
    mockIsWeekday = pattern.isWeekday;
    mockParseTimeToMinutes = pattern.parseTimeToMinutes;
    mockGetCurrentTimeString = pattern.getCurrentTimeString;
    mockCreateDefaultSmartNotificationSettings = pattern.createDefaultSmartNotificationSettings;

    const patternAnalysis = require('../patternAnalysisService');
    mockPredictCommute = patternAnalysis.patternAnalysisService.predictCommute;
    mockGetWeekPredictions = patternAnalysis.patternAnalysisService.getWeekPredictions;

    const delayReport = require('@/services/delay/delayReportService');
    mockGetActiveReports = delayReport.delayReportService.getActiveReports;

    // Reset mocks to default behaviors
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    });
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDayOfWeek.mockReturnValue(1 as DayOfWeek); // Monday
    mockIsWeekday.mockReturnValue(true);
    mockParseTimeToMinutes.mockImplementation((time: string) => {
      const [h, m] = time.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    });
    mockGetCurrentTimeString.mockReturnValue('08:00');
    mockCreateDefaultSmartNotificationSettings.mockReturnValue({
      enabled: false,
      alertMinutesBefore: 15,
      checkDelaysFor: [],
      includeWeekends: false,
      customAlertTimes: [],
    });
    mockPredictCommute.mockResolvedValue(null);
    mockGetWeekPredictions.mockResolvedValue([]);
    mockGetActiveReports.mockResolvedValue([]);
  });

  describe('getSettings', () => {
    it('should return default settings for new user', async () => {
      const settings = await smartNotificationService.getSettings('user-1');
      expect(settings).toBeDefined();
      expect(settings.enabled).toBe(false);
      expect(mockGetDoc).toHaveBeenCalled();
    });

    it('should return saved settings when exists', async () => {
      const savedSettings: SmartNotificationSettings = {
        enabled: true,
        alertMinutesBefore: 10,
        checkDelaysFor: ['1호선', '2호선'],
        includeWeekends: true,
        customAlertTimes: [],
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => savedSettings,
      });

      const settings = await smartNotificationService.getSettings('user-1');
      expect(settings).toEqual(savedSettings);
      expect(settings.enabled).toBe(true);
      expect(settings.alertMinutesBefore).toBe(10);
    });

    it('should handle Firebase errors gracefully', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firebase error'));
      await expect(smartNotificationService.getSettings('user-1')).rejects.toThrow('Firebase error');
    });
  });

  describe('updateSettings', () => {
    it('should save settings successfully', async () => {
      const settings: SmartNotificationSettings = {
        enabled: true,
        alertMinutesBefore: 20,
        checkDelaysFor: ['1호선'],
        includeWeekends: false,
        customAlertTimes: [],
      };

      await smartNotificationService.updateSettings('user-1', settings);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should handle Firebase errors on update', async () => {
      const settings: SmartNotificationSettings = {
        enabled: true,
        alertMinutesBefore: 15,
        checkDelaysFor: [],
        includeWeekends: false,
        customAlertTimes: [],
      };

      mockSetDoc.mockRejectedValueOnce(new Error('Write failed'));
      await expect(smartNotificationService.updateSettings('user-1', settings)).rejects.toThrow('Write failed');
    });
  });

  describe('enable', () => {
    it('should enable notifications for disabled user', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: false,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      await smartNotificationService.enable('user-1');
      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.enabled).toBe(true);
    });
  });

  describe('disable', () => {
    it('should disable notifications for enabled user', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      await smartNotificationService.disable('user-1');
      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.enabled).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return false for new user', async () => {
      const result = await smartNotificationService.isEnabled('user-1');
      expect(result).toBe(false);
    });

    it('should return true for enabled user', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const result = await smartNotificationService.isEnabled('user-1');
      expect(result).toBe(true);
    });
  });

  describe('getTodayNotification', () => {
    it('should return null when notifications disabled', async () => {
      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).toBeNull();
    });

    it('should return null on weekend when weekends excluded', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      mockGetDayOfWeek.mockReturnValue(6 as DayOfWeek); // Saturday
      mockIsWeekday.mockReturnValue(false);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).toBeNull();
    });

    it('should return null when no prediction available', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      mockPredictCommute.mockResolvedValueOnce(null);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).toBeNull();
    });

    it('should return null when prediction confidence too low', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const lowConfidencePrediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.3,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(lowConfidencePrediction);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).toBeNull();
    });

    it('should return notification with delays', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);

      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          estimatedDelayMinutes: 5,
          reason: 'Track maintenance',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).not.toBeNull();
      expect(result?.hasDelays).toBe(true);
      expect(result?.affectedLines).toContain('1호선');
      expect(result?.title).toContain('지연');
    });

    it('should return notification without delays', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).not.toBeNull();
      expect(result?.hasDelays).toBe(false);
      expect(result?.affectedLines).toEqual([]);
      expect(result?.title).toContain('월요일');
      expect(result?.body).toContain('정상 운행');
    });

    it('should use custom alert time when available', async () => {
      const customAlert: CustomAlertTime = {
        dayOfWeek: 1 as DayOfWeek,
        alertTime: '07:30',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [customAlert],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.scheduledTime).toBe('07:30');
    });
  });

  describe('shouldShowNotification', () => {
    it('should return false when disabled', async () => {
      const result = await smartNotificationService.shouldShowNotification('user-1', '08:00');
      expect(result).toBe(false);
    });

    it('should return false when no prediction', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      mockPredictCommute.mockResolvedValueOnce(null);

      const result = await smartNotificationService.shouldShowNotification('user-1', '08:00');
      expect(result).toBe(false);
    });

    it('should return true when current time matches target time (exact)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      const result1 = await smartNotificationService.shouldShowNotification('user-1', '08:15');
      expect(result1).toBe(true);
    });

    it('should return true when current time within 5 minutes of target', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      const result = await smartNotificationService.shouldShowNotification('user-1', '08:19');
      expect(result).toBe(true);
    });

    it('should return false when current time outside 5 minutes of target', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      const result = await smartNotificationService.shouldShowNotification('user-1', '08:21');
      expect(result).toBe(false);
    });

    it('should use custom alert time when available', async () => {
      const customAlert: CustomAlertTime = {
        dayOfWeek: 1 as DayOfWeek,
        alertTime: '07:45',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [customAlert],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);

      const result = await smartNotificationService.shouldShowNotification('user-1', '07:45');
      expect(result).toBe(true);
    });

    it('should use default time string when not provided', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetCurrentTimeString.mockReturnValue('08:15');

      const result = await smartNotificationService.shouldShowNotification('user-1');
      expect(result).toBe(true);
      expect(mockGetCurrentTimeString).toHaveBeenCalled();
    });
  });

  describe('getWeekSchedule', () => {
    it('should return empty schedule when no predictions', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      mockGetWeekPredictions.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getWeekSchedule('user-1');
      expect(result).toEqual([]);
    });

    it('should return week schedule with predictions', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const predictions: PredictedCommute[] = [
        {
          date: '2024-01-01',
          dayOfWeek: 1 as DayOfWeek,
          predictedDepartureTime: '08:30',
          route: {
            departureStationId: 'S001',
            departureStationName: '강남역',
            arrivalStationId: 'S002',
            arrivalStationName: '서초역',
            lineIds: ['1호선'],
          },
          confidence: 0.8,
          suggestedAlertTime: '08:15',
        },
        {
          date: '2024-01-02',
          dayOfWeek: 2 as DayOfWeek,
          predictedDepartureTime: '08:35',
          route: {
            departureStationId: 'S001',
            departureStationName: '강남역',
            arrivalStationId: 'S002',
            arrivalStationName: '서초역',
            lineIds: ['1호선'],
          },
          confidence: 0.75,
          suggestedAlertTime: '08:20',
        },
      ];

      mockGetWeekPredictions.mockResolvedValueOnce(predictions);

      const result = await smartNotificationService.getWeekSchedule('user-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        dayOfWeek: 1,
        alertTime: '08:15',
      });
    });

    it('should use custom alert times in schedule', async () => {
      const customAlert: CustomAlertTime = {
        dayOfWeek: 1 as DayOfWeek,
        alertTime: '07:30',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [customAlert],
        }),
      });

      const predictions: PredictedCommute[] = [
        {
          date: '2024-01-01',
          dayOfWeek: 1 as DayOfWeek,
          predictedDepartureTime: '08:30',
          route: {
            departureStationId: 'S001',
            departureStationName: '강남역',
            arrivalStationId: 'S002',
            arrivalStationName: '서초역',
            lineIds: ['1호선'],
          },
          confidence: 0.8,
          suggestedAlertTime: '08:15',
        },
      ];

      mockGetWeekPredictions.mockResolvedValueOnce(predictions);

      const result = await smartNotificationService.getWeekSchedule('user-1');
      expect(result[0]?.alertTime).toBe('07:30');
    });

    it('should pass includeWeekends setting to predictions', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: true,
          customAlertTimes: [],
        }),
      });

      mockGetWeekPredictions.mockResolvedValueOnce([]);

      await smartNotificationService.getWeekSchedule('user-1');
      expect(mockGetWeekPredictions).toHaveBeenCalledWith('user-1', true);
    });
  });

  describe('setCustomAlertTime', () => {
    it('should set custom alert time for a day', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      await smartNotificationService.setCustomAlertTime('user-1', 1 as DayOfWeek, '07:30', true);

      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.customAlertTimes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 1,
            alertTime: '07:30',
            enabled: true,
          }),
        ])
      );
    });

    it('should replace existing custom alert time for same day', async () => {
      const existingAlert: CustomAlertTime = {
        dayOfWeek: 1 as DayOfWeek,
        alertTime: '08:00',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [existingAlert],
        }),
      });

      await smartNotificationService.setCustomAlertTime('user-1', 1 as DayOfWeek, '07:30', true);

      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];

      // Should only have one alert for Monday
      const mondayAlerts = callArgs.customAlertTimes.filter((a: CustomAlertTime) => a.dayOfWeek === 1);
      expect(mondayAlerts).toHaveLength(1);
      expect(mondayAlerts[0].alertTime).toBe('07:30');
    });

    it('should support disabled custom alert time', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      await smartNotificationService.setCustomAlertTime('user-1', 1 as DayOfWeek, '07:30', false);

      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.customAlertTimes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 1,
            alertTime: '07:30',
            enabled: false,
          }),
        ])
      );
    });
  });

  describe('removeCustomAlertTime', () => {
    it('should remove custom alert time for a day', async () => {
      const alertToKeep: CustomAlertTime = {
        dayOfWeek: 2 as DayOfWeek,
        alertTime: '08:00',
        enabled: true,
      };

      const alertToRemove: CustomAlertTime = {
        dayOfWeek: 1 as DayOfWeek,
        alertTime: '07:30',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [alertToRemove, alertToKeep],
        }),
      });

      await smartNotificationService.removeCustomAlertTime('user-1', 1 as DayOfWeek);

      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.customAlertTimes).toEqual([alertToKeep]);
    });

    it('should handle removing non-existent alert time', async () => {
      const existingAlert: CustomAlertTime = {
        dayOfWeek: 2 as DayOfWeek,
        alertTime: '08:00',
        enabled: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [existingAlert],
        }),
      });

      await smartNotificationService.removeCustomAlertTime('user-1', 1 as DayOfWeek);

      expect(mockSetDoc).toHaveBeenCalled();
      const callArgs = mockSetDoc.mock.calls[0][1];
      expect(callArgs.customAlertTimes).toEqual([existingAlert]);
    });
  });

  describe('checkDelaysForPrediction (private method tested via getTodayNotification)', () => {
    it('should return no delays when no active reports', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선', '2호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(false);
      expect(result?.body).toContain('정상 운행 중');
    });

    it('should filter delays for checked lines only', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: ['1호선'],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선', '2호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          estimatedDelayMinutes: 5,
          reason: 'Track maintenance',
          reportedAt: new Date(),
        },
        {
          id: 'report-2',
          lineId: '3호선',
          estimatedDelayMinutes: 10,
          reason: 'Accident',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(true);
      expect(result?.affectedLines).toEqual(['1호선']);
      expect(result?.body).toContain('1호선호선 약 5분 지연');
    });

    it('should use prediction route lines when checkDelaysFor is empty', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['2호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '2호선',
          estimatedDelayMinutes: 8,
          reason: 'Track maintenance',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(true);
      expect(result?.affectedLines).toEqual(['2호선']);
    });

    it('should deduplicate affected lines and find max delay', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선', '2호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          estimatedDelayMinutes: 5,
          reason: 'Track maintenance',
          reportedAt: new Date(),
        },
        {
          id: 'report-2',
          lineId: '1호선',
          estimatedDelayMinutes: 8,
          reason: 'Another issue',
          reportedAt: new Date(),
        },
        {
          id: 'report-3',
          lineId: '2호선',
          estimatedDelayMinutes: 12,
          reason: 'Accident',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(true);
      expect(result?.affectedLines).toHaveLength(2);
      expect(result?.body).toContain('2개 노선 지연');
      expect(result?.body).toContain('최대 12분');
    });

    it('should show single line delay message correctly', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          estimatedDelayMinutes: 7,
          reason: 'Track maintenance',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.body).toContain('1호선호선 약 7분 지연');
    });

    it('should handle delay check errors gracefully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockRejectedValueOnce(new Error('Delay service error'));

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).not.toBeNull();
      expect(result?.hasDelays).toBe(false);
      // When error occurs, notification is still built but with no delays
      expect(result?.body).toContain('정상 운행');
    });
  });

  describe('buildNotification (private method tested via getTodayNotification)', () => {
    it('should generate correct notification with Korean day names', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 2 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.title).toBe('화요일 출근 알림');
    });

    it('should include station names and predicted time in body', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.body).toContain('강남역');
      expect(result?.body).toContain('서초역');
      expect(result?.body).toContain('08:30');
    });

    it('should generate unique notification ID based on date and day', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-15',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.id).toBe('smart-2024-01-15-1');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty checkDelaysFor list', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선', '2호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          estimatedDelayMinutes: 5,
          reason: 'Maintenance',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(true);
    });

    it('should handle report with missing estimatedDelayMinutes', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          enabled: true,
          alertMinutesBefore: 15,
          checkDelaysFor: [],
          includeWeekends: false,
          customAlertTimes: [],
        }),
      });

      const prediction: PredictedCommute = {
        date: '2024-01-01',
        dayOfWeek: 1 as DayOfWeek,
        predictedDepartureTime: '08:30',
        route: {
          departureStationId: 'S001',
          departureStationName: '강남역',
          arrivalStationId: 'S002',
          arrivalStationName: '서초역',
          lineIds: ['1호선'],
        },
        confidence: 0.8,
        suggestedAlertTime: '08:15',
      };

      mockPredictCommute.mockResolvedValueOnce(prediction);
      mockGetActiveReports.mockResolvedValueOnce([
        {
          id: 'report-1',
          lineId: '1호선',
          reason: 'Maintenance',
          reportedAt: new Date(),
        },
      ]);

      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result?.hasDelays).toBe(true);
    });
  });
});
