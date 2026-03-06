/**
 * useCurrentStationAlert Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { currentStationAlertService } from '@services/notification/currentStationAlertService';
import { useCurrentStationAlert, useCurrentStationAlerts } from '../useCurrentStationAlert';

jest.mock('@services/notification/currentStationAlertService', () => ({
  currentStationAlertService: {
    isStationMonitored: jest.fn().mockReturnValue(false),
    getLastNotificationTime: jest.fn().mockReturnValue(null),
    getConfig: jest.fn().mockReturnValue({ enabled: true, radius: 500 }),
    addStation: jest.fn().mockResolvedValue(undefined),
    removeStation: jest.fn().mockResolvedValue(undefined),
    setConfig: jest.fn().mockResolvedValue(undefined),
    clearStationHistory: jest.fn().mockResolvedValue(undefined),
    getMonitoredStations: jest.fn().mockReturnValue([]),
    clearAllHistory: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('useCurrentStationAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (currentStationAlertService.isStationMonitored as jest.Mock).mockReturnValue(false);
    (currentStationAlertService.getLastNotificationTime as jest.Mock).mockReturnValue(null);
    (currentStationAlertService.getConfig as jest.Mock).mockReturnValue({
      enabled: true,
      radius: 500,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with station monitoring state', () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    expect(result.current.isMonitored).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.lastNotificationTime).toBeNull();
    expect(currentStationAlertService.isStationMonitored).toHaveBeenCalledWith('station-1');
  });

  it('should reflect monitored state', () => {
    (currentStationAlertService.isStationMonitored as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    expect(result.current.isMonitored).toBe(true);
  });

  it('should add station', async () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.addStation();
    });

    expect(currentStationAlertService.addStation).toHaveBeenCalledWith('station-1');
    expect(result.current.isMonitored).toBe(true);
  });

  it('should remove station', async () => {
    (currentStationAlertService.isStationMonitored as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.removeStation();
    });

    expect(currentStationAlertService.removeStation).toHaveBeenCalledWith('station-1');
    expect(result.current.isMonitored).toBe(false);
  });

  it('should toggle station - add when not monitored', async () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.toggleStation();
    });

    expect(currentStationAlertService.addStation).toHaveBeenCalledWith('station-1');
  });

  it('should toggle station - remove when monitored', async () => {
    (currentStationAlertService.isStationMonitored as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.toggleStation();
    });

    expect(currentStationAlertService.removeStation).toHaveBeenCalledWith('station-1');
  });

  it('should set enabled', async () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.setEnabled(false);
    });

    expect(currentStationAlertService.setConfig).toHaveBeenCalledWith({ enabled: false });
    expect(result.current.isEnabled).toBe(false);
  });

  it('should update config', async () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.updateConfig({ radius: 1000 });
    });

    expect(currentStationAlertService.setConfig).toHaveBeenCalledWith({ radius: 1000 });
  });

  it('should clear history', async () => {
    const { result } = renderHook(() => useCurrentStationAlert('station-1'));

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(currentStationAlertService.clearStationHistory).toHaveBeenCalledWith('station-1');
    expect(result.current.lastNotificationTime).toBeNull();
  });

  it('should poll for updates', () => {
    renderHook(() => useCurrentStationAlert('station-1'));

    // Initial call
    expect(currentStationAlertService.isStationMonitored).toHaveBeenCalledTimes(1);

    // After 5s interval
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(currentStationAlertService.isStationMonitored).toHaveBeenCalledTimes(2);
  });

  it('should cleanup interval on unmount', () => {
    const { unmount } = renderHook(() => useCurrentStationAlert('station-1'));

    unmount();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should not be called more after unmount
    expect(currentStationAlertService.isStationMonitored).toHaveBeenCalledTimes(1);
  });
});

describe('useCurrentStationAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (currentStationAlertService.getMonitoredStations as jest.Mock).mockReturnValue(['s1', 's2']);
    (currentStationAlertService.getConfig as jest.Mock).mockReturnValue({
      enabled: true,
      radius: 500,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return monitored stations', () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    expect(result.current.monitoredStations).toEqual(['s1', 's2']);
    expect(result.current.isEnabled).toBe(true);
  });

  it('should add station', async () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    await act(async () => {
      await result.current.addStation('s3');
    });

    expect(currentStationAlertService.addStation).toHaveBeenCalledWith('s3');
    expect(result.current.monitoredStations).toContain('s3');
  });

  it('should remove station', async () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    await act(async () => {
      await result.current.removeStation('s1');
    });

    expect(currentStationAlertService.removeStation).toHaveBeenCalledWith('s1');
    expect(result.current.monitoredStations).not.toContain('s1');
  });

  it('should clear all stations', async () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    await act(async () => {
      await result.current.clearAll();
    });

    expect(currentStationAlertService.removeStation).toHaveBeenCalledTimes(2);
    expect(result.current.monitoredStations).toEqual([]);
  });

  it('should update config', async () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    await act(async () => {
      await result.current.updateConfig({ radius: 1000 });
    });

    expect(currentStationAlertService.setConfig).toHaveBeenCalledWith({ radius: 1000 });
  });

  it('should clear all history', async () => {
    const { result } = renderHook(() => useCurrentStationAlerts());

    await act(async () => {
      await result.current.clearAllHistory();
    });

    expect(currentStationAlertService.clearAllHistory).toHaveBeenCalled();
  });
});
