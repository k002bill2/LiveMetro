/**
 * useCommutePattern Hook
 * Provides access to commute pattern data and smart notification settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { commuteLogService, CreateCommuteLogInput } from '@/services/pattern/commuteLogService';
import { patternAnalysisService } from '@/services/pattern/patternAnalysisService';
import { smartNotificationService, SmartNotification } from '@/services/pattern/smartNotificationService';
import {
  CommuteLog,
  CommutePattern,
  PredictedCommute,
  SmartNotificationSettings,
  DayOfWeek,
} from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

interface UseCommutePatternReturn {
  /** All detected patterns */
  patterns: CommutePattern[];
  /** Today's prediction */
  todayPrediction: PredictedCommute | null;
  /** Week's predictions */
  weekPredictions: PredictedCommute[];
  /** Recent commute logs */
  recentLogs: CommuteLog[];
  /** Smart notification settings */
  notificationSettings: SmartNotificationSettings | null;
  /** Today's smart notification if any */
  todayNotification: SmartNotification | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Log a new commute */
  logCommute: (input: CreateCommuteLogInput) => Promise<CommuteLog | null>;
  /** Analyze patterns from logs */
  analyzePatterns: () => Promise<void>;
  /** Update notification settings */
  updateNotificationSettings: (settings: SmartNotificationSettings) => Promise<void>;
  /** Enable smart notifications */
  enableSmartNotifications: () => Promise<void>;
  /** Disable smart notifications */
  disableSmartNotifications: () => Promise<void>;
  /** Refresh all data */
  refresh: () => Promise<void>;
}

interface UseCommuteLogsReturn {
  /** Commute logs */
  logs: CommuteLog[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Log a new commute */
  logCommute: (input: CreateCommuteLogInput) => Promise<CommuteLog | null>;
  /** Delete a log */
  deleteLog: (logId: string) => Promise<void>;
  /** Refresh logs */
  refresh: () => Promise<void>;
}

interface UseSmartNotificationsReturn {
  /** Notification settings */
  settings: SmartNotificationSettings | null;
  /** Today's notification */
  todayNotification: SmartNotification | null;
  /** Week schedule */
  weekSchedule: { date: string; dayOfWeek: DayOfWeek; alertTime: string | null }[];
  /** Is enabled */
  isEnabled: boolean;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Enable notifications */
  enable: () => Promise<void>;
  /** Disable notifications */
  disable: () => Promise<void>;
  /** Update settings */
  updateSettings: (settings: SmartNotificationSettings) => Promise<void>;
  /** Set custom alert time */
  setCustomAlertTime: (dayOfWeek: DayOfWeek, time: string) => Promise<void>;
  /** Refresh data */
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook: useCommuteLogs
// ============================================================================

/**
 * Hook for managing commute logs
 */
export function useCommuteLogs(): UseCommuteLogsReturn {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CommuteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await commuteLogService.getRecentLogsForAnalysis(user.id);
      setLogs(data);
    } catch (err) {
      setError('출퇴근 기록을 불러오는데 실패했습니다');
      console.error('Failed to fetch commute logs:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logCommute = useCallback(
    async (input: CreateCommuteLogInput): Promise<CommuteLog | null> => {
      if (!user) {
        setError('로그인이 필요합니다');
        return null;
      }

      try {
        const log = await commuteLogService.logCommute(user.id, input);
        setLogs((prev) => [log, ...prev]);
        return log;
      } catch (err) {
        setError('출퇴근 기록에 실패했습니다');
        console.error('Failed to log commute:', err);
        return null;
      }
    },
    [user]
  );

  const deleteLog = useCallback(
    async (logId: string): Promise<void> => {
      if (!user) return;

      try {
        await commuteLogService.deleteLog(user.id, logId);
        setLogs((prev) => prev.filter((l) => l.id !== logId));
      } catch (err) {
        setError('기록 삭제에 실패했습니다');
        console.error('Failed to delete log:', err);
      }
    },
    [user]
  );

  return { logs, loading, error, logCommute, deleteLog, refresh };
}

// ============================================================================
// Hook: useSmartNotifications
// ============================================================================

/**
 * Hook for managing smart notifications
 */
export function useSmartNotifications(): UseSmartNotificationsReturn {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SmartNotificationSettings | null>(null);
  const [todayNotification, setTodayNotification] = useState<SmartNotification | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<
    { date: string; dayOfWeek: DayOfWeek; alertTime: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [settingsData, notification, schedule] = await Promise.all([
        smartNotificationService.getSettings(user.id),
        smartNotificationService.getTodayNotification(user.id),
        smartNotificationService.getWeekSchedule(user.id),
      ]);

      setSettings(settingsData);
      setTodayNotification(notification);
      setWeekSchedule(schedule);
    } catch (err) {
      setError('알림 설정을 불러오는데 실패했습니다');
      console.error('Failed to fetch notification settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!user) return;

    try {
      await smartNotificationService.enable(user.id);
      setSettings((prev) => (prev ? { ...prev, enabled: true } : prev));
    } catch (err) {
      setError('알림 활성화에 실패했습니다');
    }
  }, [user]);

  const disable = useCallback(async () => {
    if (!user) return;

    try {
      await smartNotificationService.disable(user.id);
      setSettings((prev) => (prev ? { ...prev, enabled: false } : prev));
    } catch (err) {
      setError('알림 비활성화에 실패했습니다');
    }
  }, [user]);

  const updateSettings = useCallback(
    async (newSettings: SmartNotificationSettings) => {
      if (!user) return;

      try {
        await smartNotificationService.updateSettings(user.id, newSettings);
        setSettings(newSettings);
      } catch (err) {
        setError('설정 저장에 실패했습니다');
      }
    },
    [user]
  );

  const setCustomAlertTime = useCallback(
    async (dayOfWeek: DayOfWeek, time: string) => {
      if (!user) return;

      try {
        await smartNotificationService.setCustomAlertTime(user.id, dayOfWeek, time);
        await refresh();
      } catch (err) {
        setError('알림 시간 설정에 실패했습니다');
      }
    },
    [user, refresh]
  );

  return {
    settings,
    todayNotification,
    weekSchedule,
    isEnabled: settings?.enabled ?? false,
    loading,
    error,
    enable,
    disable,
    updateSettings,
    setCustomAlertTime,
    refresh,
  };
}

// ============================================================================
// Hook: useCommutePattern (Combined)
// ============================================================================

/**
 * Combined hook for commute patterns, predictions, and notifications
 */
export function useCommutePattern(): UseCommutePatternReturn {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<CommutePattern[]>([]);
  const [todayPrediction, setTodayPrediction] = useState<PredictedCommute | null>(null);
  const [weekPredictions, setWeekPredictions] = useState<PredictedCommute[]>([]);
  const [recentLogs, setRecentLogs] = useState<CommuteLog[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<SmartNotificationSettings | null>(null);
  const [todayNotification, setTodayNotification] = useState<SmartNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [patternsData, prediction, weekPreds, logs, settings, notification] =
        await Promise.all([
          patternAnalysisService.getPatterns(user.id),
          patternAnalysisService.predictCommute(user.id),
          patternAnalysisService.getWeekPredictions(user.id),
          commuteLogService.getRecentLogsForAnalysis(user.id),
          smartNotificationService.getSettings(user.id),
          smartNotificationService.getTodayNotification(user.id),
        ]);

      setPatterns(patternsData);
      setTodayPrediction(prediction);
      setWeekPredictions(weekPreds);
      setRecentLogs(logs);
      setNotificationSettings(settings);
      setTodayNotification(notification);
    } catch (err) {
      setError('패턴 정보를 불러오는데 실패했습니다');
      console.error('Failed to fetch pattern data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logCommute = useCallback(
    async (input: CreateCommuteLogInput): Promise<CommuteLog | null> => {
      if (!user) {
        setError('로그인이 필요합니다');
        return null;
      }

      try {
        const log = await commuteLogService.logCommute(user.id, input);
        setRecentLogs((prev) => [log, ...prev]);
        return log;
      } catch (err) {
        setError('출퇴근 기록에 실패했습니다');
        return null;
      }
    },
    [user]
  );

  const analyzePatterns = useCallback(async () => {
    if (!user) return;

    try {
      const newPatterns = await patternAnalysisService.analyzeAndUpdatePatterns(user.id);
      setPatterns(newPatterns);

      // Refresh predictions after analysis
      const [prediction, weekPreds] = await Promise.all([
        patternAnalysisService.predictCommute(user.id),
        patternAnalysisService.getWeekPredictions(user.id),
      ]);
      setTodayPrediction(prediction);
      setWeekPredictions(weekPreds);
    } catch (err) {
      setError('패턴 분석에 실패했습니다');
    }
  }, [user]);

  const updateNotificationSettings = useCallback(
    async (settings: SmartNotificationSettings) => {
      if (!user) return;

      try {
        await smartNotificationService.updateSettings(user.id, settings);
        setNotificationSettings(settings);
      } catch (err) {
        setError('설정 저장에 실패했습니다');
      }
    },
    [user]
  );

  const enableSmartNotifications = useCallback(async () => {
    if (!user) return;

    try {
      await smartNotificationService.enable(user.id);
      setNotificationSettings((prev) => (prev ? { ...prev, enabled: true } : prev));
    } catch (err) {
      setError('알림 활성화에 실패했습니다');
    }
  }, [user]);

  const disableSmartNotifications = useCallback(async () => {
    if (!user) return;

    try {
      await smartNotificationService.disable(user.id);
      setNotificationSettings((prev) => (prev ? { ...prev, enabled: false } : prev));
    } catch (err) {
      setError('알림 비활성화에 실패했습니다');
    }
  }, [user]);

  return {
    patterns,
    todayPrediction,
    weekPredictions,
    recentLogs,
    notificationSettings,
    todayNotification,
    loading,
    error,
    logCommute,
    analyzePatterns,
    updateNotificationSettings,
    enableSmartNotifications,
    disableSmartNotifications,
    refresh,
  };
}

export default useCommutePattern;
