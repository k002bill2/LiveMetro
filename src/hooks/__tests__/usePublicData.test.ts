/**
 * usePublicData Hook Tests
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { publicDataApi } from '@/services/api';
import {
  usePublicDataForStation,
  useAccessibilityInfo,
  useExitInfo,
  useSubwayAlerts,
} from '../usePublicData';

jest.mock('@/services/api', () => ({
  publicDataApi: {
    getAccessibilityInfo: jest.fn(),
    getExitInfoGrouped: jest.fn(),
    getActiveAlerts: jest.fn(),
    getAlertsByLine: jest.fn(),
  },
}));

describe('usePublicDataForStation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicDataApi.getAccessibilityInfo as jest.Mock).mockResolvedValue({ hasElevator: true });
    (publicDataApi.getExitInfoGrouped as jest.Mock).mockResolvedValue([{ exit: '1' }]);
    (publicDataApi.getActiveAlerts as jest.Mock).mockResolvedValue([]);
  });

  it('should fetch all data on mount', async () => {
    const { result } = renderHook(() => usePublicDataForStation('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAccessibilityInfo).toHaveBeenCalledWith('강남');
    expect(publicDataApi.getExitInfoGrouped).toHaveBeenCalledWith('강남');
    expect(publicDataApi.getActiveAlerts).toHaveBeenCalled();
    expect(result.current.accessibility).toEqual({ hasElevator: true });
    expect(result.current.exitInfo).toEqual([{ exit: '1' }]);
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      usePublicDataForStation('강남', { enabled: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAccessibilityInfo).not.toHaveBeenCalled();
  });

  it('should not fetch with empty station name', async () => {
    const { result } = renderHook(() => usePublicDataForStation(''));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAccessibilityInfo).not.toHaveBeenCalled();
  });

  it('should fetch alerts by line when lineName provided', async () => {
    (publicDataApi.getAlertsByLine as jest.Mock).mockResolvedValue([{ id: 'alert-1' }]);

    const { result } = renderHook(() =>
      usePublicDataForStation('강남', { lineName: '2호선' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAlertsByLine).toHaveBeenCalledWith('2호선');
    expect(result.current.alerts).toEqual([{ id: 'alert-1' }]);
  });

  it('should handle partial failures gracefully', async () => {
    (publicDataApi.getAccessibilityInfo as jest.Mock).mockRejectedValue(new Error('fail'));
    (publicDataApi.getExitInfoGrouped as jest.Mock).mockResolvedValue([{ exit: '2' }]);
    (publicDataApi.getActiveAlerts as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => usePublicDataForStation('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessibility).toBeNull();
    expect(result.current.exitInfo).toEqual([{ exit: '2' }]);
    expect(result.current.error).toBeNull();
  });

  it('should provide refetch function', async () => {
    const { result } = renderHook(() => usePublicDataForStation('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('useAccessibilityInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicDataApi.getAccessibilityInfo as jest.Mock).mockResolvedValue({ hasElevator: true });
  });

  it('should fetch accessibility info', async () => {
    const { result } = renderHook(() => useAccessibilityInfo('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessibility).toEqual({ hasElevator: true });
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useAccessibilityInfo('강남', false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAccessibilityInfo).not.toHaveBeenCalled();
  });

  it('should not fetch with empty station name', async () => {
    const { result } = renderHook(() => useAccessibilityInfo(''));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAccessibilityInfo).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    (publicDataApi.getAccessibilityInfo as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAccessibilityInfo('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.accessibility).toBeNull();
  });
});

describe('useExitInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicDataApi.getExitInfoGrouped as jest.Mock).mockResolvedValue([{ exit: '1' }]);
  });

  it('should fetch exit info', async () => {
    const { result } = renderHook(() => useExitInfo('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.exitInfo).toEqual([{ exit: '1' }]);
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useExitInfo('강남', false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getExitInfoGrouped).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    (publicDataApi.getExitInfoGrouped as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useExitInfo('강남'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });
});

describe('useSubwayAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (publicDataApi.getActiveAlerts as jest.Mock).mockResolvedValue([{ id: 'a1' }]);
    (publicDataApi.getAlertsByLine as jest.Mock).mockResolvedValue([{ id: 'a2' }]);
  });

  it('should fetch all active alerts', async () => {
    const { result } = renderHook(() => useSubwayAlerts());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getActiveAlerts).toHaveBeenCalled();
    expect(result.current.alerts).toEqual([{ id: 'a1' }]);
  });

  it('should fetch alerts by line', async () => {
    const { result } = renderHook(() => useSubwayAlerts('2호선'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getAlertsByLine).toHaveBeenCalledWith('2호선');
    expect(result.current.alerts).toEqual([{ id: 'a2' }]);
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useSubwayAlerts(undefined, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(publicDataApi.getActiveAlerts).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    (publicDataApi.getActiveAlerts as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSubwayAlerts());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });
});
