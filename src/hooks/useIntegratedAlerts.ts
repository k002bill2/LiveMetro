/**
 * useIntegratedAlerts Hook
 * Manages integrated ML-based commute alerts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { integratedAlertService, IntegratedAlertConfig } from '@/services/notification/integratedAlertService';
import { departureAlertService, DepartureAlert } from '@/services/notification/departureAlertService';
import { delayResponseAlertService, RouteDelayStatus } from '@/services/notification/delayResponseAlertService';
import {
  IntegratedAlert,
  MonitoringSettings,
  DEFAULT_MONITORING_SETTINGS,
} from '@/models/ml';
import { FrequentRoute } from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

export interface UseIntegratedAlertsState {
  /** Current integrated alert */
  currentAlert: IntegratedAlert | null;
  /** Alert history */
  alertHistory: IntegratedAlert[];
  /** Whether monitoring is active */
  isMonitoringActive: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current delay status */
  delayStatus: RouteDelayStatus | null;
  /** Scheduled departure alerts */
  scheduledDepartureAlerts: DepartureAlert[];
}

export interface UseIntegratedAlertsActions {
  /** Start background monitoring */
  startMonitoring: (config?: Partial<IntegratedAlertConfig>) => Promise<void>;
  /** Stop background monitoring */
  stopMonitoring: () => void;
  /** Generate alert for now */
  generateAlert: () => Promise<IntegratedAlert | null>;
  /** Schedule departure alert */
  scheduleDepartureAlert: (minutesBefore?: number) => Promise<DepartureAlert | null>;
  /** Cancel departure alert */
  cancelDepartureAlert: (alertId: string) => Promise<boolean>;
  /** Check route delays */
  checkDelays: (route: FrequentRoute) => Promise<RouteDelayStatus>;
  /** Refresh alert history */
  refreshHistory: () => Promise<void>;
  /** Clear all alerts */
  clearAllAlerts: () => Promise<void>;
  /** Update monitoring settings */
  updateSettings: (settings: Partial<MonitoringSettings>) => void;
}

export interface UseIntegratedAlertsConfig {
  /** Auto-start monitoring on mount */
  autoStartMonitoring?: boolean;
  /** Initial monitoring settings */
  initialSettings?: Partial<MonitoringSettings>;
  /** Enable departure alerts */
  enableDeparture?: boolean;
  /** Enable train arrival alerts */
  enableTrainArrival?: boolean;
  /** Enable delay alerts */
  enableDelay?: boolean;
}

export type UseIntegratedAlertsReturn = UseIntegratedAlertsState & UseIntegratedAlertsActions;

// ============================================================================
// Hook
// ============================================================================

export function useIntegratedAlerts(
  config: UseIntegratedAlertsConfig = {}
): UseIntegratedAlertsReturn {
  const {
    autoStartMonitoring = false,
    initialSettings,
    enableDeparture = true,
    enableTrainArrival = true,
    enableDelay = true,
  } = config;

  const { user } = useAuth();

  // State
  const [currentAlert, setCurrentAlert] = useState<IntegratedAlert | null>(null);
  const [alertHistory, setAlertHistory] = useState<IntegratedAlert[]>([]);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayStatus, setDelayStatus] = useState<RouteDelayStatus | null>(null);
  const [scheduledDepartureAlerts, setScheduledDepartureAlerts] = useState<DepartureAlert[]>([]);
  const [settings, setSettings] = useState<MonitoringSettings>({
    ...DEFAULT_MONITORING_SETTINGS,
    ...initialSettings,
  });

  const monitoringIdRef = useRef<string | null>(null);
  const delayUnsubscribeRef = useRef<(() => void) | null>(null);

  // Start monitoring
  const startMonitoring = useCallback(
    async (alertConfig?: Partial<IntegratedAlertConfig>): Promise<void> => {
      if (!user?.id) {
        setError('로그인이 필요합니다');
        return;
      }

      if (isMonitoringActive) {
        return; // Already monitoring
      }

      setLoading(true);
      setError(null);

      try {
        const monitoringId = await integratedAlertService.scheduleBackgroundMonitoring(
          user.id,
          {
            settings,
            enableDepartureAlert: enableDeparture,
            enableTrainArrivalAlert: enableTrainArrival,
            enableDelayAlert: enableDelay,
            ...alertConfig,
          }
        );

        monitoringIdRef.current = monitoringId;
        setIsMonitoringActive(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, isMonitoringActive, settings, enableDeparture, enableTrainArrival, enableDelay]
  );

  // Stop monitoring
  const stopMonitoring = useCallback((): void => {
    if (!user?.id) return;

    integratedAlertService.stopBackgroundMonitoring(user.id);
    monitoringIdRef.current = null;
    setIsMonitoringActive(false);

    // Also stop delay subscription
    if (delayUnsubscribeRef.current) {
      delayUnsubscribeRef.current();
      delayUnsubscribeRef.current = null;
    }
  }, [user?.id]);

  // Generate alert
  const generateAlert = useCallback(async (): Promise<IntegratedAlert | null> => {
    if (!user?.id) {
      setError('로그인이 필요합니다');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const alert = await integratedAlertService.generateIntegratedAlert(user.id);
      if (alert) {
        setCurrentAlert(alert);
        setAlertHistory((prev) => [alert, ...prev].slice(0, 50));
      }
      return alert;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Schedule departure alert
  const scheduleDepartureAlert = useCallback(
    async (minutesBefore: number = 15): Promise<DepartureAlert | null> => {
      if (!user?.id) {
        setError('로그인이 필요합니다');
        return null;
      }

      try {
        const result = await departureAlertService.scheduleDepartureAlert(user.id, {
          minutesBefore,
          includeDelayPrediction: true,
          minConfidence: 0.3,
          userId: user.id,
        });

        if (result.success && result.alert) {
          setScheduledDepartureAlerts((prev) => [...prev, result.alert!]);
          return result.alert;
        } else {
          setError(result.error || '알림 예약 실패');
          return null;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      }
    },
    [user?.id]
  );

  // Cancel departure alert
  const cancelDepartureAlert = useCallback(
    async (alertId: string): Promise<boolean> => {
      const cancelled = await departureAlertService.cancelAlert(alertId);
      if (cancelled) {
        setScheduledDepartureAlerts((prev) =>
          prev.filter((alert) => alert.id !== alertId)
        );
      }
      return cancelled;
    },
    []
  );

  // Check delays
  const checkDelays = useCallback(
    async (route: FrequentRoute): Promise<RouteDelayStatus> => {
      if (!user?.id) {
        return {
          hasDelays: false,
          affectedLines: [],
          maxDelayMinutes: 0,
          adjustedDepartureTime: '08:00',
          originalDepartureTime: '08:00',
          recommendation: '로그인이 필요합니다',
          delayDetails: [],
        };
      }

      try {
        const status = await delayResponseAlertService.checkRouteDelays(user.id, route);
        setDelayStatus(status);
        return status;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          hasDelays: false,
          affectedLines: [],
          maxDelayMinutes: 0,
          adjustedDepartureTime: '08:00',
          originalDepartureTime: '08:00',
          recommendation: errorMessage,
          delayDetails: [],
        };
      }
    },
    [user?.id]
  );

  // Refresh history
  const refreshHistory = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    try {
      const history = integratedAlertService.getAlertHistory(50);
      setAlertHistory(history);

      const alerts = departureAlertService.getScheduledAlerts(user.id);
      setScheduledDepartureAlerts(alerts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }, [user?.id]);

  // Clear all alerts
  const clearAllAlerts = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    await departureAlertService.cancelAllAlerts(user.id);
    setScheduledDepartureAlerts([]);
    setCurrentAlert(null);
    setDelayStatus(null);
  }, [user?.id]);

  // Update settings
  const updateSettings = useCallback(
    (newSettings: Partial<MonitoringSettings>): void => {
      setSettings((prev) => ({
        ...prev,
        ...newSettings,
      }));
    },
    []
  );

  // Auto-start monitoring if configured
  useEffect(() => {
    if (autoStartMonitoring && user?.id && !isMonitoringActive) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStartMonitoring, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh history on mount
  useEffect(() => {
    if (user?.id) {
      refreshHistory();
    }
  }, [user?.id, refreshHistory]);

  // Update monitoring when settings change
  useEffect(() => {
    if (isMonitoringActive && user?.id) {
      // Restart monitoring with new settings
      stopMonitoring();
      startMonitoring();
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    currentAlert,
    alertHistory,
    isMonitoringActive,
    loading,
    error,
    delayStatus,
    scheduledDepartureAlerts,

    // Actions
    startMonitoring,
    stopMonitoring,
    generateAlert,
    scheduleDepartureAlert,
    cancelDepartureAlert,
    checkDelays,
    refreshHistory,
    clearAllAlerts,
    updateSettings,
  };
}

export default useIntegratedAlerts;
