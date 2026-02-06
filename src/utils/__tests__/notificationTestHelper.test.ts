/**
 * Notification Test Helper Tests
 */

import { notificationStorageService } from '../../services/notification/notificationStorageService';
import {
  addTestNotifications,
  clearTestNotifications,
  getNotificationCount,
  addRandomNotification,
} from '../notificationTestHelper';

jest.mock('../../services/notification/notificationStorageService', () => ({
  notificationStorageService: {
    saveNotification: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
    getAllNotifications: jest.fn().mockResolvedValue([]),
  },
}));

describe('notificationTestHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set default mock implementations after clearAllMocks
    (notificationStorageService.saveNotification as jest.Mock).mockResolvedValue(undefined);
    (notificationStorageService.clearAll as jest.Mock).mockResolvedValue(undefined);
    (notificationStorageService.getAllNotifications as jest.Mock).mockResolvedValue([]);
  });

  describe('addTestNotifications', () => {
    it('should add 5 test notifications', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await addTestNotifications();

      expect(notificationStorageService.saveNotification).toHaveBeenCalledTimes(5);
      consoleSpy.mockRestore();
    });

    it('should add notifications with different types', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await addTestNotifications();

      const calls = (notificationStorageService.saveNotification as jest.Mock).mock.calls;
      const types = calls.map((c: unknown[]) => (c[0] as { type: string }).type);
      expect(types).toContain('DELAY_ALERT');
      expect(types).toContain('ARRIVAL');
      expect(types).toContain('DISRUPTION');
      consoleSpy.mockRestore();
    });

    it('should throw on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (notificationStorageService.saveNotification as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(addTestNotifications()).rejects.toThrow('fail');
      consoleSpy.mockRestore();
    });
  });

  describe('clearTestNotifications', () => {
    it('should clear all notifications', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await clearTestNotifications();

      expect(notificationStorageService.clearAll).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (notificationStorageService.clearAll as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(clearTestNotifications()).rejects.toThrow('fail');
      consoleSpy.mockRestore();
    });
  });

  describe('getNotificationCount', () => {
    it('should return notification count', async () => {
      (notificationStorageService.getAllNotifications as jest.Mock).mockResolvedValue([
        { id: '1' },
        { id: '2' },
      ]);

      const count = await getNotificationCount();

      expect(count).toBe(2);
    });

    it('should return 0 on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (notificationStorageService.getAllNotifications as jest.Mock).mockRejectedValue(new Error('fail'));

      const count = await getNotificationCount();

      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('addRandomNotification', () => {
    it('should add one notification', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await addRandomNotification();

      expect(notificationStorageService.saveNotification).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should have valid notification structure', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await addRandomNotification();

      const call = (notificationStorageService.saveNotification as jest.Mock).mock.calls[0][0];
      expect(call.type).toBeDefined();
      expect(call.title).toBeDefined();
      expect(call.body).toBeDefined();
      expect(call.priority).toBeDefined();
      consoleSpy.mockRestore();
    });
  });
});
