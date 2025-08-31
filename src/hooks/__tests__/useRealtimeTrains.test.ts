/**
 * useRealtimeTrains Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useRealtimeTrains } from '../useRealtimeTrains';
import { trainService } from '../../services/train/trainService';
import { Train } from '../../models/train';

// Mock trainService
jest.mock('../../services/train/trainService');
const mockTrainService = trainService as jest.Mocked<typeof trainService>;

describe('useRealtimeTrains', () => {
  const mockTrains: Train[] = [
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

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with loading state', () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.trains).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it('should fetch trains successfully', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((station, callback) => {
        callback(mockTrains);
        return jest.fn();
      });

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.trains).toEqual(mockTrains);
      expect(result.current.error).toBe(null);
    });

    it('should handle subscription errors', async () => {
      const error = new Error('Subscription failed');
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.trains).toEqual([]);
      expect(result.current.error).toBe(error);
    });
  });

  describe('Station Changes', () => {
    it('should resubscribe when station changes', () => {
      const unsubscribeMock = jest.fn();
      mockTrainService.subscribeToTrainUpdates.mockReturnValue(unsubscribeMock);

      const { rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function)
      );

      // Change station
      rerender({ station: '홍대입구역' });

      expect(unsubscribeMock).toHaveBeenCalled();
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        '홍대입구역',
        expect.any(Function)
      );
    });

    it('should reset state when station changes', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((station, callback) => {
        if (station === '강남역') {
          callback(mockTrains);
        }
        return jest.fn();
      });

      const { result, rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.trains).toEqual(mockTrains);

      // Change station - should reset to loading state
      act(() => {
        rerender({ station: '홍대입구역' });
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.trains).toEqual([]);
    });
  });

  describe('Options Configuration', () => {
    it('should use custom refetch interval', () => {
      const options = {
        refetchInterval: 60000, // 1 minute
        retryAttempts: 5,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());

      renderHook(() =>
        useRealtimeTrains('강남역', options)
      );

      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        '강남역',
        expect.any(Function)
      );
      // The interval configuration would be handled internally
    });

    it('should handle disabled auto-refresh', () => {
      const options = {
        refetchInterval: 0, // Disable auto-refresh
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());

      renderHook(() =>
        useRealtimeTrains('강남역', options)
      );

      // Should still create subscription but without auto-refresh
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalled();
    });
  });

  describe('Lifecycle Management', () => {
    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockTrainService.subscribeToTrainUpdates.mockReturnValue(unsubscribeMock);

      const { unmount } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should handle multiple rapid station changes', () => {
      const unsubscribeMocks = [jest.fn(), jest.fn(), jest.fn()];
      let callCount = 0;

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => {
        return unsubscribeMocks[callCount++];
      });

      const { rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      rerender({ station: '홍대입구역' });
      rerender({ station: '신촌역' });
      rerender({ station: '이대역' });

      // Should unsubscribe from previous subscriptions
      expect(unsubscribeMocks[0]).toHaveBeenCalled();
      expect(unsubscribeMocks[1]).toHaveBeenCalled();
      expect(unsubscribeMocks[2]).toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide manual refetch function', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((station, callback) => {
        callback(mockTrains);
        return jest.fn();
      });
      mockTrainService.getRealtimeTrains.mockResolvedValue(mockTrains);

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockTrainService.getRealtimeTrains).toHaveBeenCalledWith('강남역');
      expect(result.current.trains).toEqual(mockTrains);
    });

    it('should handle refetch errors gracefully', async () => {
      const refetchError = new Error('Manual refetch failed');
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getRealtimeTrains.mockRejectedValue(refetchError);

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe(refetchError);
      expect(result.current.loading).toBe(false);
    });

    it('should update loading state during refetch', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getRealtimeTrains.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTrains), 100))
      );

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(100);
        await jest.runAllPromises();
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should recover from temporary network errors', async () => {
      let callCount = 0;
      mockTrainService.subscribeToTrainUpdates.mockImplementation((station, callback) => {
        if (callCount++ === 0) {
          throw new Error('Network error');
        } else {
          callback(mockTrains);
        }
        return jest.fn();
      });

      const { result, rerender } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.error).toBeInstanceOf(Error);

      // Simulate retry by changing station and back
      act(() => {
        rerender();
      });

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.trains).toEqual(mockTrains);
      expect(result.current.error).toBe(null);
    });

    it('should clear previous error on successful refetch', async () => {
      const initialError = new Error('Initial error');
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => {
        throw initialError;
      });
      mockTrainService.getRealtimeTrains.mockResolvedValue(mockTrains);

      const { result } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      await act(async () => {
        jest.runAllTimers();
      });

      expect(result.current.error).toBe(initialError);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.trains).toEqual(mockTrains);
    });
  });

  describe('Performance Optimization', () => {
    it('should memoize subscription callback', () => {
      const callbackSpy = jest.fn();
      mockTrainService.subscribeToTrainUpdates.mockImplementation((station, callback) => {
        callbackSpy(callback);
        return jest.fn();
      });

      const { rerender } = renderHook(() =>
        useRealtimeTrains('강남역')
      );

      const firstCallback = callbackSpy.mock.calls[0][0];

      rerender();

      const secondCallback = callbackSpy.mock.calls[1][0];

      // Callback should be the same reference (memoized)
      expect(firstCallback).toBe(secondCallback);
    });

    it('should not create new subscription if station is undefined', () => {
      renderHook(() =>
        useRealtimeTrains(undefined as any)
      );

      expect(mockTrainService.subscribeToTrainUpdates).not.toHaveBeenCalled();
    });

    it('should debounce rapid station changes', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());

      const { rerender } = renderHook(
        ({ station }) => useRealtimeTrains(station),
        { initialProps: { station: '강남역' } }
      );

      // Rapid station changes
      rerender({ station: '홍대입구역' });
      rerender({ station: '신촌역' });
      rerender({ station: '이대역' });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Should only subscribe to the final station after debounce period
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenLastCalledWith(
        '이대역',
        expect.any(Function)
      );
    });
  });
});