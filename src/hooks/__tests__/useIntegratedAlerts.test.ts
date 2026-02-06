/**
 * useIntegratedAlerts Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { integratedAlertService } from '@/services/notification/integratedAlertService';
import { departureAlertService } from '@/services/notification/departureAlertService';
import { delayResponseAlertService } from '@/services/notification/delayResponseAlertService';
import { useIntegratedAlerts } from '../useIntegratedAlerts';

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/notification/integratedAlertService', () => ({
  integratedAlertService: {
    scheduleBackgroundMonitoring: jest.fn(),
    stopBackgroundMonitoring: jest.fn(),
    generateIntegratedAlert: jest.fn(),
    getAlertHistory: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('@/services/notification/departureAlertService', () => ({
  departureAlertService: {
    scheduleDepartureAlert: jest.fn(),
    cancelAlert: jest.fn(),
    cancelAllAlerts: jest.fn(),
    getScheduledAlerts: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('@/services/notification/delayResponseAlertService', () => ({
  delayResponseAlertService: {
    checkRouteDelays: jest.fn(),
  },
}));

jest.mock('@/models/ml', () => ({
  DEFAULT_MONITORING_SETTINGS: {
    refreshIntervalMs: 30000,
    enablePrediction: true,
  },
}));

const mockUser = { id: 'user-1', email: 'test@test.com' };

describe('useIntegratedAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (integratedAlertService.getAlertHistory as jest.Mock).mockReturnValue([]);
    (departureAlertService.getScheduledAlerts as jest.Mock).mockReturnValue([]);
  });

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useIntegratedAlerts());

    expect(result.current.currentAlert).toBeNull();
    expect(result.current.alertHistory).toEqual([]);
    expect(result.current.isMonitoringActive).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should refresh history on mount', async () => {
    const mockHistory = [{ id: 'alert-1' }];
    (integratedAlertService.getAlertHistory as jest.Mock).mockReturnValue(mockHistory);

    const { result } = renderHook(() => useIntegratedAlerts());

    await waitFor(() => {
      expect(result.current.alertHistory).toEqual(mockHistory);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring', async () => {
      (integratedAlertService.scheduleBackgroundMonitoring as jest.Mock).mockResolvedValue('mon-1');

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(integratedAlertService.scheduleBackgroundMonitoring).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          enableDepartureAlert: true,
          enableTrainArrivalAlert: true,
          enableDelayAlert: true,
        })
      );
      expect(result.current.isMonitoringActive).toBe(true);
    });

    it('should require login', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle monitoring error', async () => {
      (integratedAlertService.scheduleBackgroundMonitoring as jest.Mock).mockRejectedValue(
        new Error('Monitoring failed')
      );

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.error).toBe('Monitoring failed');
      expect(result.current.isMonitoringActive).toBe(false);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring', async () => {
      (integratedAlertService.scheduleBackgroundMonitoring as jest.Mock).mockResolvedValue('mon-1');

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.startMonitoring();
      });

      act(() => {
        result.current.stopMonitoring();
      });

      expect(integratedAlertService.stopBackgroundMonitoring).toHaveBeenCalledWith('user-1');
      expect(result.current.isMonitoringActive).toBe(false);
    });
  });

  describe('generateAlert', () => {
    it('should generate alert', async () => {
      const mockAlert = { id: 'alert-1', message: 'Test' };
      (integratedAlertService.generateIntegratedAlert as jest.Mock).mockResolvedValue(mockAlert);

      const { result } = renderHook(() => useIntegratedAlerts());

      let alert: unknown;
      await act(async () => {
        alert = await result.current.generateAlert();
      });

      expect(alert).toEqual(mockAlert);
      expect(result.current.currentAlert).toEqual(mockAlert);
    });

    it('should return null without user', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useIntegratedAlerts());

      let alert: unknown;
      await act(async () => {
        alert = await result.current.generateAlert();
      });

      expect(alert).toBeNull();
    });

    it('should handle generate error', async () => {
      (integratedAlertService.generateIntegratedAlert as jest.Mock).mockRejectedValue(
        new Error('Generate failed')
      );

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.generateAlert();
      });

      expect(result.current.error).toBe('Generate failed');
    });
  });

  describe('scheduleDepartureAlert', () => {
    it('should schedule departure alert', async () => {
      const mockAlert = { id: 'dep-1' };
      (departureAlertService.scheduleDepartureAlert as jest.Mock).mockResolvedValue({
        success: true,
        alert: mockAlert,
      });

      const { result } = renderHook(() => useIntegratedAlerts());

      let alert: unknown;
      await act(async () => {
        alert = await result.current.scheduleDepartureAlert(10);
      });

      expect(alert).toEqual(mockAlert);
      expect(result.current.scheduledDepartureAlerts).toContainEqual(mockAlert);
    });

    it('should handle schedule failure', async () => {
      (departureAlertService.scheduleDepartureAlert as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Schedule failed',
      });

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.scheduleDepartureAlert();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('cancelDepartureAlert', () => {
    it('should cancel alert', async () => {
      (departureAlertService.cancelAlert as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useIntegratedAlerts());

      let cancelled: boolean = false;
      await act(async () => {
        cancelled = await result.current.cancelDepartureAlert('dep-1');
      });

      expect(cancelled).toBe(true);
    });
  });

  describe('checkDelays', () => {
    it('should check route delays', async () => {
      const mockStatus = { hasDelays: true, maxDelayMinutes: 10 };
      (delayResponseAlertService.checkRouteDelays as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useIntegratedAlerts());

      let status: unknown;
      await act(async () => {
        status = await result.current.checkDelays({ lineIds: ['2'] } as never);
      });

      expect(status).toEqual(mockStatus);
      expect(result.current.delayStatus).toEqual(mockStatus);
    });

    it('should return default without user', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useIntegratedAlerts());

      let status: { hasDelays?: boolean };
      await act(async () => {
        status = await result.current.checkDelays({ lineIds: ['2'] } as never);
      });

      expect(status!.hasDelays).toBe(false);
    });
  });

  describe('clearAllAlerts', () => {
    it('should clear all alerts', async () => {
      (departureAlertService.cancelAllAlerts as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useIntegratedAlerts());

      await act(async () => {
        await result.current.clearAllAlerts();
      });

      expect(departureAlertService.cancelAllAlerts).toHaveBeenCalledWith('user-1');
      expect(result.current.currentAlert).toBeNull();
      expect(result.current.scheduledDepartureAlerts).toEqual([]);
    });
  });

  describe('updateSettings', () => {
    it('should update monitoring settings', () => {
      const { result } = renderHook(() => useIntegratedAlerts());

      act(() => {
        result.current.updateSettings({ refreshIntervalMs: 60000 } as never);
      });

      // No error means success
      expect(result.current.error).toBeNull();
    });
  });
});
