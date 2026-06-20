/**
 * useCommutePattern Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { patternAnalysisService } from '@/services/pattern/patternAnalysisService';
import { smartNotificationService } from '@/services/pattern/smartNotificationService';
import { useCommuteLogs, useSmartNotifications, useCommutePattern } from '../useCommutePattern';

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn(),
    logCommute: jest.fn(),
    deleteLog: jest.fn(),
  },
}));

jest.mock('@/services/pattern/patternAnalysisService', () => ({
  patternAnalysisService: {
    getPatterns: jest.fn(),
    predictCommute: jest.fn(),
    getWeekPredictions: jest.fn(),
    analyzeAndUpdatePatterns: jest.fn(),
  },
}));

jest.mock('@/services/pattern/smartNotificationService', () => ({
  smartNotificationService: {
    getSettings: jest.fn(),
    getTodayNotification: jest.fn(),
    getWeekSchedule: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    updateSettings: jest.fn(),
    setCustomAlertTime: jest.fn(),
  },
}));

const mockUser = { id: 'user-1', email: 'test@test.com' };

describe('useCommuteLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([]);
  });

  it('should load logs on mount', async () => {
    const mockLogs = [{ id: 'log-1', startStation: 'A' }];
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.logs).toEqual(mockLogs);
    expect(commuteLogService.getRecentLogsForAnalysis).toHaveBeenCalledWith('user-1');
  });

  it('should not load without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(commuteLogService.getRecentLogsForAnalysis).not.toHaveBeenCalled();
  });

  it('should handle load error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should log commute', async () => {
    const mockLog = { id: 'new-log', startStation: 'B' };
    (commuteLogService.logCommute as jest.Mock).mockResolvedValue(mockLog);

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let logged: unknown;
    await act(async () => {
      logged = await result.current.logCommute({
        departureStationId: 's1',
        departureStationName: 'Station A',
        arrivalStationId: 's2',
        arrivalStationName: 'Station B',
        lineIds: ['2'],
      });
    });

    expect(logged).toEqual(mockLog);
    expect(result.current.logs).toContainEqual(mockLog);
  });

  it('should return null when logging without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let logged: unknown;
    await act(async () => {
      logged = await result.current.logCommute({
        departureStationId: 's1',
        departureStationName: 'Station A',
        arrivalStationId: 's2',
        arrivalStationName: 'Station B',
        lineIds: ['2'],
      });
    });

    expect(logged).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('should handle log error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (commuteLogService.logCommute as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logCommute({
        departureStationId: 's1',
        departureStationName: 'Station A',
        arrivalStationId: 's2',
        arrivalStationName: 'Station B',
        lineIds: ['2'],
      });
    });

    expect(result.current.error).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should delete log', async () => {
    const mockLogs = [{ id: 'log-1' }, { id: 'log-2' }];
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);
    (commuteLogService.deleteLog as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteLog('log-1');
    });

    expect(commuteLogService.deleteLog).toHaveBeenCalledWith('user-1', 'log-1');
    expect(result.current.logs.find((l: { id: string }) => l.id === 'log-1')).toBeUndefined();
  });

  it('should handle delete error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (commuteLogService.deleteLog as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteLog('log-1');
    });

    expect(result.current.error).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should refresh logs', async () => {
    const { result } = renderHook(() => useCommuteLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));

    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([{ id: 'refreshed' }]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.logs).toEqual([{ id: 'refreshed' }]);
  });
});

describe('useSmartNotifications', () => {
  const mockSettings = { enabled: true, alertMinutesBefore: 15 };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (smartNotificationService.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (smartNotificationService.getTodayNotification as jest.Mock).mockResolvedValue(null);
    (smartNotificationService.getWeekSchedule as jest.Mock).mockResolvedValue([]);
  });

  it('should load settings on mount', async () => {
    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.isEnabled).toBe(true);
  });

  it('should not load without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(smartNotificationService.getSettings).not.toHaveBeenCalled();
  });

  it('should handle load error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (smartNotificationService.getSettings as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should enable notifications', async () => {
    (smartNotificationService.enable as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.enable();
    });

    expect(smartNotificationService.enable).toHaveBeenCalledWith('user-1');
  });

  it('should disable notifications', async () => {
    (smartNotificationService.disable as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disable();
    });

    expect(smartNotificationService.disable).toHaveBeenCalledWith('user-1');
  });

  it('should update settings', async () => {
    (smartNotificationService.updateSettings as jest.Mock).mockResolvedValue(undefined);
    const newSettings = { enabled: false, alertMinutesBefore: 30 };

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateSettings(newSettings as never);
    });

    expect(smartNotificationService.updateSettings).toHaveBeenCalledWith('user-1', newSettings);
    expect(result.current.settings).toEqual(newSettings);
  });

  it('should set custom alert time', async () => {
    (smartNotificationService.setCustomAlertTime as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSmartNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setCustomAlertTime('monday' as never, '07:30');
    });

    expect(smartNotificationService.setCustomAlertTime).toHaveBeenCalledWith('user-1', 'monday', '07:30');
  });
});

describe('useCommutePattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (patternAnalysisService.getPatterns as jest.Mock).mockResolvedValue([]);
    (patternAnalysisService.predictCommute as jest.Mock).mockResolvedValue(null);
    (patternAnalysisService.getWeekPredictions as jest.Mock).mockResolvedValue([]);
    (patternAnalysisService.analyzeAndUpdatePatterns as jest.Mock).mockResolvedValue([]);
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([]);
    (smartNotificationService.getSettings as jest.Mock).mockResolvedValue(null);
    (smartNotificationService.getTodayNotification as jest.Mock).mockResolvedValue(null);
  });

  it('should load all data on mount', async () => {
    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(patternAnalysisService.getPatterns).toHaveBeenCalledWith('user-1');
    expect(patternAnalysisService.predictCommute).toHaveBeenCalledWith('user-1');
    expect(commuteLogService.getRecentLogsForAnalysis).toHaveBeenCalledWith('user-1');
  });

  it('should not load without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(patternAnalysisService.getPatterns).not.toHaveBeenCalled();
  });

  it('should handle load error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (patternAnalysisService.getPatterns as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should log commute and add to recent logs', async () => {
    const mockLog = { id: 'new-log' };
    (commuteLogService.logCommute as jest.Mock).mockResolvedValue(mockLog);

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logCommute({
        departureStationId: 's1',
        departureStationName: 'Station A',
        arrivalStationId: 's2',
        arrivalStationName: 'Station B',
        lineIds: ['2'],
      });
    });

    expect(result.current.recentLogs).toContainEqual(mockLog);
  });

  it('should analyze patterns', async () => {
    const mockPatterns = [{ id: 'p1' }];
    (patternAnalysisService.analyzeAndUpdatePatterns as jest.Mock).mockResolvedValue(mockPatterns);
    (patternAnalysisService.predictCommute as jest.Mock).mockResolvedValue({ confidence: 0.9 });
    (patternAnalysisService.getWeekPredictions as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.analyzePatterns();
    });

    expect(patternAnalysisService.analyzeAndUpdatePatterns).toHaveBeenCalledWith('user-1');
    expect(result.current.patterns).toEqual(mockPatterns);
  });

  it('should enable smart notifications', async () => {
    (smartNotificationService.enable as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.enableSmartNotifications();
    });

    expect(smartNotificationService.enable).toHaveBeenCalledWith('user-1');
  });

  it('should disable smart notifications', async () => {
    (smartNotificationService.disable as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disableSmartNotifications();
    });

    expect(smartNotificationService.disable).toHaveBeenCalledWith('user-1');
  });

  it('should update notification settings', async () => {
    (smartNotificationService.updateSettings as jest.Mock).mockResolvedValue(undefined);
    const newSettings = { enabled: true };

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateNotificationSettings(newSettings as never);
    });

    expect(smartNotificationService.updateSettings).toHaveBeenCalledWith('user-1', newSettings);
  });

  it('should refresh all data', async () => {
    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    // Called twice: once on mount, once on refresh
    expect(patternAnalysisService.getPatterns).toHaveBeenCalledTimes(2);
  });

  it('should compute (analyze) patterns on mount before reading', async () => {
    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The precompute that populates the `commutePatterns` collection must run
    // on mount — without it the read-only getters return empty forever (결함 B).
    expect(patternAnalysisService.analyzeAndUpdatePatterns).toHaveBeenCalledWith('user-1');
  });

  it('should populate predictions via compute-before-read ordering', async () => {
    const mockPrediction = { confidence: 0.9 };
    let computed = false;
    // Compute flips the flag; the reads only return data once compute has run,
    // so a populated result proves compute executed BEFORE the reads.
    (patternAnalysisService.analyzeAndUpdatePatterns as jest.Mock).mockImplementation(async () => {
      computed = true;
      return [{ id: 'p1' }];
    });
    (patternAnalysisService.predictCommute as jest.Mock).mockImplementation(async () =>
      computed ? mockPrediction : null,
    );
    (patternAnalysisService.getWeekPredictions as jest.Mock).mockImplementation(async () =>
      computed ? [mockPrediction] : [],
    );

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.todayPrediction).toEqual(mockPrediction);
    expect(result.current.weekPredictions).toEqual([mockPrediction]);
  });

  it('should degrade gracefully when compute throws (no user-facing error)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (patternAnalysisService.analyzeAndUpdatePatterns as jest.Mock).mockRejectedValue(
      new Error('compute failed'),
    );
    // Reads still succeed despite the compute failure.
    (patternAnalysisService.getPatterns as jest.Mock).mockResolvedValue([{ id: 'p1' }]);

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Compute failure is swallowed: no setError, reads still populate state.
    expect(result.current.error).toBeFalsy();
    expect(result.current.patterns).toEqual([{ id: 'p1' }]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should not compute patterns without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(patternAnalysisService.analyzeAndUpdatePatterns).not.toHaveBeenCalled();
  });

  it('should surface empty pattern state without error', async () => {
    // compute + reads all empty (e.g. fewer than MIN_LOGS_FOR_PATTERN logs) —
    // an empty result is a normal "collecting data" state, not an error.
    const { result } = renderHook(() => useCommutePattern());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.patterns).toEqual([]);
    expect(result.current.weekPredictions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
