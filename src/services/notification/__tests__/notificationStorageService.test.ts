/**
 * NotificationStorageService Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationStorageService, StoredNotification } from '../notificationStorageService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const createMockNotification = (overrides: Partial<StoredNotification> = {}): StoredNotification => ({
  id: `notif_${Date.now()}`,
  type: 'DELAY_ALERT',
  title: 'Test Alert',
  body: 'Test body',
  priority: 'normal',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('NotificationStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getAllNotifications', () => {
    it('should return empty array when no notifications stored', async () => {
      const result = await notificationStorageService.getAllNotifications();
      expect(result).toEqual([]);
    });

    it('should return stored notifications', async () => {
      const mockNotifs = [createMockNotification()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockNotifs));

      const result = await notificationStorageService.getAllNotifications();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Alert');
    });

    it('should handle storage error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await notificationStorageService.getAllNotifications();
      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('saveNotification', () => {
    it('should save new notification', async () => {
      await notificationStorageService.saveNotification({
        type: 'DELAY_ALERT',
        title: 'New Alert',
        body: 'Alert body',
        priority: 'high',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro:notifications',
        expect.any(String)
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].title).toBe('New Alert');
      expect(savedData[0].isRead).toBe(false);
      expect(savedData[0].id).toBeDefined();
    });

    it('should prepend to existing notifications', async () => {
      const existing = [createMockNotification({ title: 'Old' })];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

      await notificationStorageService.saveNotification({
        type: 'INFO',
        title: 'New',
        body: 'body',
        priority: 'normal',
      });

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].title).toBe('New');
      expect(savedData[1].title).toBe('Old');
    });

    it('should handle save error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

      await notificationStorageService.saveNotification({
        type: 'INFO',
        title: 'Test',
        body: 'body',
        priority: 'low',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return only unread notifications', async () => {
      const notifs = [
        createMockNotification({ isRead: false, title: 'Unread' }),
        createMockNotification({ isRead: true, title: 'Read' }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(notifs));

      const result = await notificationStorageService.getUnreadNotifications();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Unread');
    });

    it('should return empty array on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      const result = await notificationStorageService.getUnreadNotifications();
      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('markAsRead', () => {
    it('should mark specific notification as read', async () => {
      const notifs = [
        createMockNotification({ id: 'notif_1', isRead: false }),
        createMockNotification({ id: 'notif_2', isRead: false }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(notifs));

      await notificationStorageService.markAsRead('notif_1');

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].isRead).toBe(true);
      expect(savedData[1].isRead).toBe(false);
    });

    it('should handle error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      await notificationStorageService.markAsRead('notif_1');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const notifs = [
        createMockNotification({ id: 'n1', isRead: false }),
        createMockNotification({ id: 'n2', isRead: false }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(notifs));

      await notificationStorageService.markAllAsRead();

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.every((n: StoredNotification) => n.isRead)).toBe(true);
    });

    it('should handle error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      await notificationStorageService.markAllAsRead();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('deleteNotification', () => {
    it('should remove specific notification', async () => {
      const notifs = [
        createMockNotification({ id: 'keep' }),
        createMockNotification({ id: 'delete' }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(notifs));

      await notificationStorageService.deleteNotification('delete');

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('keep');
    });

    it('should handle error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      await notificationStorageService.deleteNotification('id');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clearAll', () => {
    it('should remove all notifications', async () => {
      await notificationStorageService.clearAll();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro:notifications');
    });

    it('should handle error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Error'));

      await notificationStorageService.clearAll();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      const notifs = [
        createMockNotification({ isRead: false }),
        createMockNotification({ isRead: true }),
        createMockNotification({ isRead: false }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(notifs));

      const count = await notificationStorageService.getUnreadCount();
      expect(count).toBe(2);
    });

    it('should return 0 on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      const count = await notificationStorageService.getUnreadCount();
      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });
});
