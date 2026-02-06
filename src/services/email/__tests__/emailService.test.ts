/**
 * Email Service Tests
 */

import { emailNotificationService, NotificationType } from '../emailService';

jest.mock('firebase/functions', () => {
  const mockCallableFn = jest.fn().mockResolvedValue({ data: { success: true } });
  return {
    httpsCallable: jest.fn(() => mockCallableFn),
    __mockCallableFn: mockCallableFn,
  };
});

jest.mock('@/services/firebase/config', () => ({
  functions: {},
}));

// Get the mock reference after the module is loaded
const getMock = (): jest.Mock => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('firebase/functions') as { __mockCallableFn: jest.Mock };
  return mod.__mockCallableFn;
};

describe('EmailNotificationService', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockCallableFn = getMock();
    mockCallableFn.mockReset();
    mockCallableFn.mockResolvedValue({ data: { success: true } });
  });

  describe('checkConfiguration', () => {
    it('should return configuration status', async () => {
      mockCallableFn.mockResolvedValue({ data: { configured: true } });

      const result = await emailNotificationService.checkConfiguration();

      expect(result.configured).toBe(true);
    });

    it('should handle error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Network error'));

      const result = await emailNotificationService.checkConfiguration();

      expect(result.configured).toBe(false);
      expect(result.error).toBe('Network error');
      consoleSpy.mockRestore();
    });

    it('should handle non-Error exception', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue('string error');

      const result = await emailNotificationService.checkConfiguration();

      expect(result.configured).toBe(false);
      expect(result.error).toBe('설정 확인 실패');
      consoleSpy.mockRestore();
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      const result = await emailNotificationService.sendTestEmail();

      expect(result).toBe(true);
      expect(mockCallableFn).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Send failed'));

      const result = await emailNotificationService.sendTestEmail();

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendDelayAlert', () => {
    it('should send delay alert', async () => {
      const result = await emailNotificationService.sendDelayAlert('강남', '2호선', 10, '신호 장애');

      expect(result).toBe(true);
      expect(mockCallableFn).toHaveBeenCalledWith({
        type: NotificationType.DELAY_ALERT,
        data: { stationName: '강남', lineName: '2호선', delayMinutes: 10, reason: '신호 장애' },
      });
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Failed'));

      expect(await emailNotificationService.sendDelayAlert('a', 'b', 5)).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendEmergencyAlert', () => {
    it('should send emergency alert', async () => {
      const result = await emailNotificationService.sendEmergencyAlert('긴급', ['2호선']);

      expect(result).toBe(true);
      expect(mockCallableFn).toHaveBeenCalledWith({
        type: NotificationType.EMERGENCY_ALERT,
        data: { message: '긴급', affectedLines: ['2호선'] },
      });
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Failed'));

      expect(await emailNotificationService.sendEmergencyAlert('test')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendServiceUpdate', () => {
    it('should send service update', async () => {
      const result = await emailNotificationService.sendServiceUpdate('업데이트');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Failed'));

      expect(await emailNotificationService.sendServiceUpdate('test')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendArrivalReminder', () => {
    it('should send arrival reminder', async () => {
      const result = await emailNotificationService.sendArrivalReminder('강남', '2호선', '08:30');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Failed'));

      expect(await emailNotificationService.sendArrivalReminder('a', 'b', 'c')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('sendCommuteReminder', () => {
    it('should send commute reminder', async () => {
      const result = await emailNotificationService.sendCommuteReminder('역삼', '2호선', '07:00');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCallableFn.mockRejectedValue(new Error('Failed'));

      expect(await emailNotificationService.sendCommuteReminder('a', 'b', 'c')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('NotificationType', () => {
    it('should have all types', () => {
      expect(NotificationType.DELAY_ALERT).toBe('DELAY_ALERT');
      expect(NotificationType.EMERGENCY_ALERT).toBe('EMERGENCY_ALERT');
      expect(NotificationType.SERVICE_UPDATE).toBe('SERVICE_UPDATE');
      expect(NotificationType.ARRIVAL_REMINDER).toBe('ARRIVAL_REMINDER');
      expect(NotificationType.COMMUTE_REMINDER).toBe('COMMUTE_REMINDER');
    });
  });
});
