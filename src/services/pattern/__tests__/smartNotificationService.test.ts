/**
 * Smart Notification Service Tests
 */

import { smartNotificationService } from '../smartNotificationService';
import { getDoc } from 'firebase/firestore';

const mockDocSnap = {
  exists: jest.fn().mockReturnValue(false),
  data: jest.fn().mockReturnValue(null),
};

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

jest.mock('@/models/pattern', () => ({
  DayOfWeek: { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 },
  getDayOfWeek: jest.fn().mockReturnValue(1),
  isWeekday: jest.fn().mockReturnValue(true),
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }),
  getCurrentTimeString: jest.fn().mockReturnValue('08:00'),
  createDefaultSmartNotificationSettings: jest.fn().mockReturnValue({
    enabled: false,
    userId: '',
    morningAlert: true,
    eveningAlert: false,
    leadTimeMinutes: 15,
    customAlertTimes: [],
  }),
  DAY_NAMES_KO: ['일', '월', '화', '수', '목', '금', '토'],
}));

jest.mock('../patternAnalysisService', () => ({
  patternAnalysisService: {
    getPredictedCommutes: jest.fn().mockResolvedValue([]),
    getCommutePattern: jest.fn().mockResolvedValue(null),
    getWeekPredictions: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    getActiveDelays: jest.fn().mockResolvedValue([]),
  },
}));

describe('SmartNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocSnap.exists.mockReturnValue(false);
    mockDocSnap.data.mockReturnValue(null);
    (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
  });

  describe('getSettings', () => {
    it('should return default settings for new user', async () => {
      const settings = await smartNotificationService.getSettings('user-1');
      expect(settings).toBeDefined();
      expect(settings.enabled).toBe(false);
    });

    it('should return saved settings when exists', async () => {
      mockDocSnap.exists.mockReturnValue(true);
      mockDocSnap.data.mockReturnValue({
        enabled: true,
        userId: 'user-1',
        morningAlert: true,
        eveningAlert: true,
        leadTimeMinutes: 10,
        customAlertTimes: {},
      });

      const settings = await smartNotificationService.getSettings('user-1');
      expect(settings).toBeDefined();
    });
  });

  describe('updateSettings', () => {
    it('should save settings', async () => {
      const { setDoc } = require('firebase/firestore');
      await smartNotificationService.updateSettings('user-1', { enabled: true });
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('enable', () => {
    it('should enable notifications', async () => {
      await expect(smartNotificationService.enable('user-1')).resolves.not.toThrow();
    });
  });

  describe('disable', () => {
    it('should disable notifications', async () => {
      await expect(smartNotificationService.disable('user-1')).resolves.not.toThrow();
    });
  });

  describe('isEnabled', () => {
    it('should return false for new user', async () => {
      const result = await smartNotificationService.isEnabled('user-1');
      expect(result).toBe(false);
    });
  });

  describe('getTodayNotification', () => {
    it('should return null when no pattern', async () => {
      const result = await smartNotificationService.getTodayNotification('user-1');
      expect(result).toBeNull();
    });
  });

  describe('shouldShowNotification', () => {
    it('should return false when disabled', async () => {
      const result = await smartNotificationService.shouldShowNotification('user-1', 1);
      expect(result).toBe(false);
    });
  });

  describe('getWeekSchedule', () => {
    it('should return schedule array', async () => {
      const result = await smartNotificationService.getWeekSchedule('user-1');
      expect(result).toBeDefined();
    });
  });

  describe('setCustomAlertTime', () => {
    it('should set custom alert time', async () => {
      await expect(
        smartNotificationService.setCustomAlertTime('user-1', 1, '08:00')
      ).resolves.not.toThrow();
    });
  });

  describe('removeCustomAlertTime', () => {
    it('should remove custom alert time', async () => {
      await expect(
        smartNotificationService.removeCustomAlertTime('user-1', 1)
      ).resolves.not.toThrow();
    });
  });
});
