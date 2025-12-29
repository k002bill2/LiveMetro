/**
 * Notification Storage Service
 * Manages notification history and persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@livemetro:notifications';
const MAX_STORED_NOTIFICATIONS = 50;

export interface StoredNotification {
  id: string;
  type: string; // Notification type as string for flexibility
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string; // ISO string
  data?: Record<string, unknown>;
}

class NotificationStorageService {
  /**
   * Save notification to storage
   */
  async saveNotification(notification: Omit<StoredNotification, 'id' | 'createdAt' | 'isRead'>): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();

      const newNotification: StoredNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      // Add to beginning of array
      notifications.unshift(newNotification);

      // Keep only latest N notifications
      const trimmedNotifications = notifications.slice(0, MAX_STORED_NOTIFICATIONS);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedNotifications));
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  }

  /**
   * Get all notifications
   */
  async getAllNotifications(): Promise<StoredNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const notifications: StoredNotification[] = JSON.parse(stored);
      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(): Promise<StoredNotification[]> {
    try {
      const all = await this.getAllNotifications();
      return all.filter(n => !n.isRead);
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      );

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const updated = notifications.map(n => ({ ...n, isRead: true }));

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getAllNotifications();
      const filtered = notifications.filter(n => n.id !== notificationId);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const unread = await this.getUnreadNotifications();
      return unread.length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationStorageService = new NotificationStorageService();
