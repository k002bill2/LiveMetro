/**
 * Notifications Hook
 * Custom hook for managing push notifications and delay alerts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationType } from '../services/notification/notificationService';
import { dataManager } from '../services/data/dataManager';
import { useAuth } from '../services/auth/AuthContext';
import { TrainDelay } from '../models/train';

interface UseNotificationsState {
  hasPermission: boolean;
  loading: boolean;
  error: string | null;
  pushToken: string | null;
  lastNotification: Notifications.Notification | null;
}

interface UseNotificationsOptions {
  enableDelayAlerts?: boolean;
  enableEmergencyAlerts?: boolean;
  monitoredStations?: string[];
  delayThresholdMinutes?: number;
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void;
}

/**
 * Hook for managing notifications and delay monitoring
 */
export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const {
    enableDelayAlerts = true,
    enableEmergencyAlerts = true,
    monitoredStations = [],
    delayThresholdMinutes = 5,
    onNotificationReceived,
    onNotificationTapped
  } = options;

  const { user } = useAuth();
  
  const [state, setState] = useState<UseNotificationsState>({
    hasPermission: false,
    loading: true,
    error: null,
    pushToken: null,
    lastNotification: null,
  });

  const monitoringRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastDelaysRef = useRef<Map<string, TrainDelay[]>>(new Map());

  const updateState = useCallback((updates: Partial<UseNotificationsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  /**
   * Initialize notification service
   */
  const initializeNotifications = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });

      const success = await notificationService.initialize();
      
      if (success) {
        const pushToken = notificationService.getPushToken();
        const permissionStatus = notificationService.getPermissionStatus();

        updateState({
          hasPermission: permissionStatus?.granted || false,
          pushToken,
          loading: false,
        });

        return true;
      } else {
        updateState({
          hasPermission: false,
          error: '알림 서비스를 초기화할 수 없습니다.',
          loading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      updateState({
        error: error instanceof Error ? error.message : '알림 초기화 실패',
        loading: false,
      });
      return false;
    }
  }, [updateState]);

  /**
   * Send a test notification
   */
  const sendTestNotification = useCallback(async () => {
    if (!state.hasPermission) {
      console.warn('No notification permission');
      return false;
    }

    try {
      const identifier = await notificationService.sendLocalNotification({
        type: NotificationType.SERVICE_UPDATE,
        title: '🚇 LiveMetro 테스트',
        body: '알림이 정상적으로 작동합니다!',
        priority: 'normal',
        data: { test: true }
      });

      return !!identifier;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, [state.hasPermission]);

  /**
   * Monitor station for delays
   */
  const monitorStationDelays = useCallback(async (stationName: string) => {
    if (!enableDelayAlerts || !state.hasPermission) return;

    // Clear existing monitoring for this station
    const existingTimer = monitoringRef.current.get(stationName);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const checkDelays = async () => {
      try {
        const delays = await dataManager.detectDelays(stationName);
        const previousDelays = lastDelaysRef.current.get(stationName) || [];

        // Check for new or worsened delays
        for (const delay of delays) {
          if (delay.delayMinutes >= delayThresholdMinutes) {
            const wasAlreadyReported = previousDelays.some(
              prevDelay => 
                prevDelay.trainId === delay.trainId && 
                prevDelay.delayMinutes >= delay.delayMinutes
            );

            if (!wasAlreadyReported) {
              // Should send notification based on user settings
              const shouldSend = user?.preferences?.notificationSettings ? 
                notificationService.shouldSendNotification(
                  user.preferences.notificationSettings,
                  NotificationType.DELAY_ALERT
                ) : true;

              if (shouldSend) {
                await notificationService.sendDelayAlert(
                  stationName,
                  delay.lineId,
                  delay.delayMinutes,
                  delay.reason
                );
              }
            }
          }
        }

        lastDelaysRef.current.set(stationName, delays);
      } catch (error) {
        console.error(`Error monitoring delays for ${stationName}:`, error);
      }
    };

    // Initial check
    await checkDelays();

    // Set up periodic monitoring
    const timer = setInterval(checkDelays, 60000); // Check every minute
    monitoringRef.current.set(stationName, timer);

    console.log(`Started delay monitoring for ${stationName}`);
  }, [enableDelayAlerts, state.hasPermission, delayThresholdMinutes, user]);

  /**
   * Stop monitoring a station
   */
  const stopMonitoringStation = useCallback((stationName: string) => {
    const timer = monitoringRef.current.get(stationName);
    if (timer) {
      clearInterval(timer);
      monitoringRef.current.delete(stationName);
      lastDelaysRef.current.delete(stationName);
      console.log(`Stopped delay monitoring for ${stationName}`);
    }
  }, []);

  /**
   * Start monitoring all configured stations
   */
  const startMonitoring = useCallback(() => {
    if (!enableDelayAlerts || monitoredStations.length === 0) return;

    console.log('Starting delay monitoring for stations:', monitoredStations);
    monitoredStations.forEach(stationName => {
      monitorStationDelays(stationName);
    });
  }, [enableDelayAlerts, monitoredStations, monitorStationDelays]);

  /**
   * Stop all monitoring
   */
  const stopAllMonitoring = useCallback(() => {
    monitoringRef.current.forEach((timer, stationName) => {
      clearInterval(timer);
      console.log(`Stopped monitoring ${stationName}`);
    });
    monitoringRef.current.clear();
    lastDelaysRef.current.clear();
  }, []);

  /**
   * Send emergency alert
   */
  const sendEmergencyAlert = useCallback(async (
    title: string,
    message: string,
    affectedLines: string[]
  ) => {
    if (!enableEmergencyAlerts || !state.hasPermission) return false;

    const shouldSend = user?.preferences?.notificationSettings ? 
      notificationService.shouldSendNotification(
        user.preferences.notificationSettings,
        NotificationType.EMERGENCY_ALERT
      ) : true;

    if (!shouldSend) return false;

    try {
      const identifier = await notificationService.sendEmergencyAlert(
        title,
        message,
        affectedLines
      );
      return !!identifier;
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      return false;
    }
  }, [enableEmergencyAlerts, state.hasPermission, user]);

  /**
   * Schedule commute reminder
   */
  const scheduleCommuteReminder = useCallback(async (
    title: string,
    body: string,
    time: Date
  ) => {
    if (!state.hasPermission) return null;

    try {
      return await notificationService.scheduleCommuteReminder(title, body, time);
    } catch (error) {
      console.error('Error scheduling commute reminder:', error);
      return null;
    }
  }, [state.hasPermission]);

  /**
   * Cancel notification
   */
  const cancelNotification = useCallback(async (identifier: string) => {
    try {
      await notificationService.cancelNotification(identifier);
      return true;
    } catch (error) {
      console.error('Error canceling notification:', error);
      return false;
    }
  }, []);

  /**
   * Handle incoming notifications
   */
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    
    updateState({ lastNotification: notification });

    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  }, [updateState, onNotificationReceived]);

  /**
   * Handle notification response (when user taps notification)
   */
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('Notification response:', response);

    const { actionIdentifier, notification } = response;
    const { data } = notification.request.content;

    // Handle different notification types
    if (data?.type === NotificationType.DELAY_ALERT) {
      // Navigate to affected station/line
      console.log('User tapped delay alert for:', data.stationName);
    } else if (data?.type === NotificationType.EMERGENCY_ALERT) {
      // Navigate to alerts screen
      console.log('User tapped emergency alert');
    }

    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  }, [onNotificationTapped]);

  // Initialize notifications on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  // Set up notification listeners
  useEffect(() => {
    const receivedListener = notificationService.addNotificationListener(handleNotificationReceived);
    const responseListener = notificationService.addNotificationResponseListener(handleNotificationResponse);

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Start monitoring when configured
  useEffect(() => {
    if (state.hasPermission && !state.loading) {
      startMonitoring();
    }

    return stopAllMonitoring;
  }, [state.hasPermission, state.loading, startMonitoring, stopAllMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllMonitoring();
    };
  }, [stopAllMonitoring]);

  return {
    ...state,
    initializeNotifications,
    sendTestNotification,
    monitorStationDelays,
    stopMonitoringStation,
    startMonitoring,
    stopAllMonitoring,
    sendEmergencyAlert,
    scheduleCommuteReminder,
    cancelNotification,
    isMonitoring: monitoringRef.current.size > 0,
    monitoredStationsCount: monitoringRef.current.size,
  };
};

/**
 * Simple hook for one-time notification sending
 */
export const useSimpleNotification = () => {
  const [loading, setLoading] = useState(false);
  
  const sendNotification = useCallback(async (title: string, body: string) => {
    try {
      setLoading(true);
      
      const hasPermission = await notificationService.initialize();
      if (!hasPermission) {
        throw new Error('알림 권한이 없습니다.');
      }

      const identifier = await notificationService.sendLocalNotification({
        type: NotificationType.SERVICE_UPDATE,
        title,
        body,
        priority: 'normal'
      });

      return !!identifier;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    sendNotification,
  };
};