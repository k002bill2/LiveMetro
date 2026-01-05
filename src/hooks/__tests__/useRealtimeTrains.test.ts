/**
 * useRealtimeTrains Hook Tests
 * Tests for real-time train data subscription using dataManager
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRealtimeTrains } from '../useRealtimeTrains';
import { dataManager, RealtimeTrainData } from '../../services/data/dataManager';
import { Train } from '../../models/train';

// Mock dataManager
jest.mock('../../services/data/dataManager', () => ({
  dataManager: {
    subscribeToRealtimeUpdates: jest.fn(),
  },
}));

const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;

const createMockTrains = (): Train[] => [
  {
    id: 'train-1',
    stationId: 'station-1',
    direction: 'up',
    arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
    delayMinutes: 0,
    status: 'NORMAL',
    nextStationId: 'station-2',
  },
  {
    id: 'train-2',
    stationId: 'station-1',
    direction: 'down',
    arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
    delayMinutes: 1,
    status: 'DELAYED',
    nextStationId: 'station-3',
  },
];

const createMockRealtimeData = (trains: Train[]): RealtimeTrainData => ({
  trains,
  stationName: '강남역',
  lastUpdated: new Date(),
  isStale: false,
});

describe('useRealtimeTrains', () => {
  let unsubscribeMock: jest.Mock;
  let dataCallback: ((data: RealtimeTrainData | null) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    unsubscribeMock = jest.fn();
    dataCallback = null;

    // Default mock implementation that captures callback
    mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
      (_station, callback, _interval) => {
        dataCallback = callback;
        return unsubscribeMock;
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with loading true', () => {
      const { result } = renderHook(() => useRealtimeTrains('강남역'));

      expect(result.current.loading).toBe(true);
    });

    it('should not subscribe when stationName is empty', () => {
      renderHook(() => useRealtimeTrains(''));

      expect(mockDataManager.subscribeToRealtimeUpdates).not.toHaveBeenCalled();
    });

    it('should not subscribe when enabled is false', () => {
      renderHook(() => useRealtimeTrains('강남역', { enabled: false }));

      expect(mockDataManager.subscribeToRealtimeUpdates).not.toHaveBeenCalled();
    });

    it('should subscribe when stationName is provided', () => {
      renderHook(() => useRealtimeTrains('강남역'));

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function),
        30000 // default refetchInterval
      );
    });
  });

  describe('Subscription', () => {
    it('should call dataManager.subscribeToRealtimeUpdates with correct params', () => {
      renderHook(() =>
        useRealtimeTrains('강남역', { refetchInterval: 60000 })
      );

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function),
        60000
      );
    });

    it('should update trains on successful data callback', async () => {
      const mockTrains = createMockTrains();
      const { result } = renderHook(() => useRealtimeTrains('강남역'));

      // Simulate data received
      await act(async () => {
        dataCallback?.(createMockRealtimeData(mockTrains));
      });

      expect(result.current.trains).toEqual(mockTrains);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should update lastUpdated on data received', async () => {
      const mockTrains = createMockTrains();
      const mockData = createMockRealtimeData(mockTrains);
      const { result } = renderHook(() => useRealtimeTrains('강남역'));

      await act(async () => {
        dataCallback?.(mockData);
      });

      expect(result.current.lastUpdated).toEqual(mockData.lastUpdated);
    });

    it('should set isStale after staleTime elapses', async () => {
      const mockTrains = createMockTrains();
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { staleTime: 1000 })
      );

      await act(async () => {
        dataCallback?.(createMockRealtimeData(mockTrains));
      });

      expect(result.current.isStale).toBe(false);

      // Advance time past staleTime
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      expect(result.current.isStale).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should increment retry count on null data', async () => {
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { retryAttempts: 3 })
      );

      // Simulate null data (failure)
      await act(async () => {
        dataCallback?.(null);
      });

      expect(result.current.isRetrying).toBe(true);
    });

    it('should set error after max retry attempts', async () => {
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { retryAttempts: 2 })
      );

      // Simulate multiple null data (failures)
      await act(async () => {
        dataCallback?.(null);
      });
      await act(async () => {
        dataCallback?.(null);
      });

      expect(result.current.error).toContain('최대 재시도 횟수');
      expect(result.current.loading).toBe(false);
    });

    it('should reset retry count on successful data', async () => {
      const mockTrains = createMockTrains();
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { retryAttempts: 3 })
      );

      // Simulate failure
      await act(async () => {
        dataCallback?.(null);
      });

      expect(result.current.isRetrying).toBe(true);

      // Simulate success
      await act(async () => {
        dataCallback?.(createMockRealtimeData(mockTrains));
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should call onError callback when error occurs', async () => {
      const onErrorMock = jest.fn();
      renderHook(() =>
        useRealtimeTrains('강남역', {
          retryAttempts: 1,
          onError: onErrorMock,
        })
      );

      // Simulate failure to reach max retries
      await act(async () => {
        dataCallback?.(null);
      });

      expect(onErrorMock).toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeTrains('강남역'));

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should resubscribe when stationName changes', () => {
      const { rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function),
        30000
      );

      // Change station
      rerender({ station: '역삼역' });

      expect(unsubscribeMock).toHaveBeenCalled();
      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
        '역삼역',
        expect.any(Function),
        30000
      );
    });

    it('should clear stale timer on unsubscribe', async () => {
      const mockTrains = createMockTrains();
      const { result, unmount } = renderHook(() =>
        useRealtimeTrains('강남역', { staleTime: 5000 })
      );

      await act(async () => {
        dataCallback?.(createMockRealtimeData(mockTrains));
      });

      unmount();

      // Advance time - stale timer should have been cleared
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      // isStale should not change after unmount (timer cleared)
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('Refetch', () => {
    it('refetch should reset retry count', async () => {
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { retryAttempts: 3 })
      );

      // Simulate failure
      await act(async () => {
        dataCallback?.(null);
      });

      expect(result.current.isRetrying).toBe(true);

      // Refetch
      await act(async () => {
        result.current.refetch();
      });

      // New subscription with reset retry count
      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(2);
    });

    it('refetch should trigger new subscription', async () => {
      const { result } = renderHook(() => useRealtimeTrains('강남역'));

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);

      await act(async () => {
        result.current.refetch();
      });

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(2);
    });
  });

  describe('Options', () => {
    it('should use custom refetchInterval', () => {
      renderHook(() =>
        useRealtimeTrains('강남역', { refetchInterval: 45000 })
      );

      expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function),
        45000
      );
    });

    it('should use custom staleTime', async () => {
      const mockTrains = createMockTrains();
      const { result } = renderHook(() =>
        useRealtimeTrains('강남역', { staleTime: 2000 })
      );

      await act(async () => {
        dataCallback?.(createMockRealtimeData(mockTrains));
      });

      // Not stale yet
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(result.current.isStale).toBe(false);

      // Now stale
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
      expect(result.current.isStale).toBe(true);
    });

    it('should call onDataReceived callback', async () => {
      const onDataReceivedMock = jest.fn();
      const mockTrains = createMockTrains();
      const mockData = createMockRealtimeData(mockTrains);

      renderHook(() =>
        useRealtimeTrains('강남역', { onDataReceived: onDataReceivedMock })
      );

      await act(async () => {
        dataCallback?.(mockData);
      });

      expect(onDataReceivedMock).toHaveBeenCalledWith(mockData);
    });

    it('should call onError callback', async () => {
      const onErrorMock = jest.fn();

      renderHook(() =>
        useRealtimeTrains('강남역', {
          retryAttempts: 1,
          onError: onErrorMock,
        })
      );

      // Trigger max retries
      await act(async () => {
        dataCallback?.(null);
      });

      expect(onErrorMock).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only stationName', () => {
      renderHook(() => useRealtimeTrains('   '));

      expect(mockDataManager.subscribeToRealtimeUpdates).not.toHaveBeenCalled();
    });

    it('should handle undefined options gracefully', () => {
      const { result } = renderHook(() => useRealtimeTrains('강남역'));

      expect(result.current.loading).toBe(true);
      expect(result.current.trains).toEqual([]);
    });

    it('should handle multiple rapid rerenders', () => {
      const { rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      rerender({ station: '역삼역' });
      rerender({ station: '선릉역' });
      rerender({ station: '삼성역' });

      // Should have unsubscribed from previous subscriptions
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
