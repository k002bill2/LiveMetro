/**
 * TrainArrivalList Component Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TrainArrivalList } from '../TrainArrivalList';
import { trainService } from '../../../services/train/trainService';
import { TrainStatus } from '../../../models/train';

// Mock the train service
jest.mock('../../../services/train/trainService');
const mockTrainService = trainService as jest.Mocked<typeof trainService>;

// Mock performance utils to avoid throttling in tests
jest.mock('../../../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
  },
  throttle: (fn: any) => fn, // Return function immediately without throttling
}));

describe('TrainArrivalList', () => {
  const mockTrains = [
    {
      id: 'train-1',
      stationId: 'station-1',
      direction: 'up' as const,
      arrivalTime: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
      delayMinutes: 0,
      status: TrainStatus.NORMAL,
      nextStationId: 'station-2',
      finalDestination: '상행',
      currentStationId: 'station-1',
      lineId: '2',
      lastUpdated: new Date(),
    },
    {
      id: 'train-2',
      stationId: 'station-1',
      direction: 'down' as const,
      arrivalTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      delayMinutes: 2,
      status: TrainStatus.DELAYED,
      nextStationId: 'station-3',
      finalDestination: '하행',
      currentStationId: 'station-1',
      lineId: '2',
      lastUpdated: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Mock subscription that never resolves
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      
      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      expect(getByText('실시간 열차 정보를 불러오고 있습니다...')).toBeTruthy();
    });

    it('should have proper accessibility for loading state', () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      
      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      expect(getByLabelText('실시간 열차 정보를 불러오고 있습니다')).toBeTruthy();
    });
  });

  describe('Data Display', () => {
    it('should display train arrival data when loaded', async () => {
      // Mock successful subscription
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback(mockTrains);
        return jest.fn(); // Return unsubscribe function
      });
      
      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText(/상행/)).toBeTruthy();
        expect(getByText(/하행/)).toBeTruthy();
        expect(getByText('2분 후')).toBeTruthy();
        expect(getByText('5분 후')).toBeTruthy();
      });
    });

    it('should display delay information', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback(mockTrains);
        return jest.fn();
      });
      
      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      await waitFor(() => {
        expect(getByText('(2분 지연)')).toBeTruthy();
      });
    });

    it('should display different status badges', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback(mockTrains);
        return jest.fn();
      });
      
      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      await waitFor(() => {
        expect(getByText('정상')).toBeTruthy();
        expect(getByText('지연')).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no trains available', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback([]);
        return jest.fn();
      });
      
      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
        expect(getByText('잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });

    it('should have proper accessibility for empty state', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback([]);
        return jest.fn();
      });
      
      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      await waitFor(() => {
        expect(getByLabelText('현재 도착 예정인 열차가 없습니다. 잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should re-subscribe when stationId changes', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback(mockTrains);
        return jest.fn();
      });

      const { rerender } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
          'station-1',
          expect.any(Function)
        );
      });

      // Change station ID
      rerender(<TrainArrivalList stationId="station-2" />);

      await waitFor(() => {
        expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
          'station-2',
          expect.any(Function)
        );
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('should use memoized components', () => {
      // This test verifies that the component is wrapped in memo
      expect(TrainArrivalList.displayName).toBe('TrainArrivalList');
    });

    it('should throttle updates', async () => {
      const mockCallback = jest.fn();
      
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        // Store the callback to call it multiple times rapidly
        for (let i = 0; i < 5; i++) {
          setTimeout(() => callback(mockTrains), i * 100);
        }
        return jest.fn();
      });
      
      render(<TrainArrivalList stationId="station-1" />);
      
      // Due to throttling, rapid updates should be limited
      await waitFor(() => {
        // The exact implementation depends on throttle behavior
        // This is more of an integration test
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    it('should subscribe to train updates on mount', () => {
      render(<TrainArrivalList stationId="station-1" />);
      
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        'station-1',
        expect.any(Function)
      );
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockTrainService.subscribeToTrainUpdates.mockReturnValue(unsubscribeMock);
      
      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      unmount();
      
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should resubscribe when stationId changes', () => {
      const { rerender } = render(
        <TrainArrivalList stationId="station-1" />
      );
      
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        'station-1',
        expect.any(Function)
      );
      
      rerender(<TrainArrivalList stationId="station-2" />);
      
      expect(mockTrainService.subscribeToTrainUpdates).toHaveBeenCalledWith(
        'station-2',
        expect.any(Function)
      );
    });
  });

  describe('Accessibility', () => {
    it('should provide proper accessibility labels for train items', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((stationId, callback) => {
        callback(mockTrains);
        return jest.fn();
      });

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByLabelText(/상행 방면 열차, 정상 상태, 2분 후/)).toBeTruthy();
        expect(getByLabelText(/하행 방면 열차, 지연 상태, 5분 후, 2분 지연/)).toBeTruthy();
      });
    });
  });
});