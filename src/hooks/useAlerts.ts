/**
 * useAlerts Hook
 * Manages notification history and alert data
 */

import { useState, useEffect, useCallback } from 'react';
import {
  notificationStorageService,
  StoredNotification,
} from '../services/notification/notificationStorageService';

export interface UseAlertsResult {
  notifications: StoredNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing notification alerts and history
 */
export const useAlerts = (): UseAlertsResult => {
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load notifications from storage
   */
  const loadNotifications = useCallback(async (isRefreshing: boolean = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [allNotifications, count] = await Promise.all([
        notificationStorageService.getAllNotifications(),
        notificationStorageService.getUnreadCount(),
      ]);

      setNotifications(allNotifications);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('알림을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      await notificationStorageService.markAsRead(notificationId);
      await loadNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw new Error('알림을 읽음으로 표시하는 데 실패했습니다.');
    }
  }, [loadNotifications]);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      await notificationStorageService.markAllAsRead();
      await loadNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
      throw new Error('모든 알림을 읽음으로 표시하는 데 실패했습니다.');
    }
  }, [loadNotifications]);

  /**
   * Delete single notification
   */
  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    try {
      await notificationStorageService.deleteNotification(notificationId);
      await loadNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw new Error('알림을 삭제하는 데 실패했습니다.');
    }
  }, [loadNotifications]);

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(async (): Promise<void> => {
    try {
      await notificationStorageService.clearAll();
      await loadNotifications();
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      throw new Error('모든 알림을 삭제하는 데 실패했습니다.');
    }
  }, [loadNotifications]);

  /**
   * Refresh notifications
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadNotifications(true);
  }, [loadNotifications]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refreshing,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  };
};
