/**
 * TrainArrivalList Component Tests
 *
 * Tests DataManager subscription as the sole data source.
 * The component subscribes via dataManager.subscribeToRealtimeUpdates()
 * and receives pre-converted Train[] objects.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TrainArrivalList } from '../TrainArrivalList';
import { trainService } from '@services/train/trainService';
import { dataManager } from '@services/data/dataManager';
import { TrainStatus, Train } from '@models/train';

// Mock the train service (getStation for station name resolution)
jest.mock('@services/train/trainService', () => ({
  trainService: {
    getStation: jest.fn(),
  },
}));

// Mock DataManager (central data layer)
jest.mock('@services/data/dataManager', () => ({
  dataManager: {
    subscribeToRealtimeUpdates: jest.fn(),
  },
  // Re-export type for import compatibility
}));

// Mock stationsDataService
jest.mock('@services/data/stationsDataService', () => ({
  getLocalStation: jest.fn().mockReturnValue(null),
}));

// Mock performance utils to avoid throttling in tests
jest.mock('@utils/performanceUtils', () => ({
  throttle: (fn: unknown) => fn,
}));

const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;

const defaultStation = {
  id: 'station-1',
  name: '테스트역',
  nameEn: 'Test Station',
  lineId: '2',
  coordinates: { latitude: 37.5, longitude: 127.0 },
  transfers: [],
};

const makeTrain = (overrides: Partial<Train> = {}): Train => ({
  id: 'train-1',
  lineId: '2',
  direction: 'up',
  currentStationId: 'station-1',
  nextStationId: null,
  finalDestination: '목적지',
  status: TrainStatus.NORMAL,
  arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
  delayMinutes: 0,
  lastUpdated: new Date(),
  ...overrides,
});

/**
 * Helper: mock subscribeToRealtimeUpdates to call callback with given trains immediately
 */
const mockSubscription = (trains: Train[]): jest.Mock => {
  const unsubscribe = jest.fn();
  mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
    (_stationName, callback) => {
      // Call callback asynchronously to match real behavior
      Promise.resolve().then(() => {
        callback({
          stationId: 'station-1',
          trains,
          lastUpdated: new Date(),
        });
      });
      return unsubscribe;
    }
  );
  return unsubscribe;
};

/**
 * Helper: mock subscribeToRealtimeUpdates with null (API failure)
 */
const mockSubscriptionNull = (): jest.Mock => {
  const unsubscribe = jest.fn();
  mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
    (_stationName, callback) => {
      Promise.resolve().then(() => {
        callback(null);
      });
      return unsubscribe;
    }
  );
  return unsubscribe;
};

describe('TrainArrivalList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrainService.getStation.mockResolvedValue(defaultStation);
    // Default: empty trains
    mockSubscription([]);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Subscription never calls back → stays in loading
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(() => jest.fn());

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(getByText('실시간 열차 정보를 불러오고 있습니다...')).toBeTruthy();
    });

    it('should have proper accessibility for loading state', () => {
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(() => jest.fn());

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(getByLabelText('실시간 열차 정보를 불러오고 있습니다')).toBeTruthy();
    });
  });

  describe('Data Display', () => {
    it('should display train arrival data when loaded', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race during render/waitFor delay.
        makeTrain({ id: 't1', finalDestination: '상행역', direction: 'up', arrivalTime: new Date(Date.now() + 2 * 60 * 1000 + 5000) }),
        makeTrain({ id: 't2', finalDestination: '하행역', direction: 'down', arrivalTime: new Date(Date.now() + 5 * 60 * 1000 + 5000) }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText(/상행역/)).toBeTruthy();
        expect(getByText(/하행역/)).toBeTruthy();
        expect(getByText('2분후')).toBeTruthy();
        expect(getByText('5분후')).toBeTruthy();
      });
    });

    it('should display NORMAL status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.NORMAL })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정상')).toBeTruthy();
      });
    });

    it('should display DELAYED status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.DELAYED, delayMinutes: 3 })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('지연')).toBeTruthy();
        expect(getByText('(3분 지연)')).toBeTruthy();
      });
    });

    it('should display SUSPENDED status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.SUSPENDED })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('운행중단')).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no trains available', async () => {
      mockSubscription([]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
        expect(getByText('잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });

    it('should show empty state when subscription returns null', async () => {
      mockSubscriptionNull();

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
      });
    });

    it('should have proper accessibility for empty state', async () => {
      mockSubscription([]);

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByLabelText('현재 도착 예정인 열차가 없습니다. 잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    it('should subscribe via DataManager on mount', async () => {
      mockSubscription([]);

      render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
          '테스트역', // resolved station name
          expect.any(Function),
          35000 // polling interval
        );
      });
    });

    it('should unsubscribe on unmount', async () => {
      const unsubscribe = mockSubscription([]);

      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should re-subscribe when stationId changes', async () => {
      mockSubscription([]);

      const { rerender } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);
      });

      // Change station ID
      mockTrainService.getStation.mockResolvedValue({
        ...defaultStation,
        id: 'station-2',
        name: '다른역',
      });

      rerender(<TrainArrivalList stationId="station-2" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(2);
      });
    });

    it('should use stationNameProp when provided (skip name resolution)', async () => {
      mockSubscription([]);

      render(<TrainArrivalList stationId="station-1" stationName="직접제공역" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
          '직접제공역',
          expect.any(Function),
          35000
        );
      });

      // Should NOT call getStation since stationName prop was provided
      expect(mockTrainService.getStation).not.toHaveBeenCalled();
    });
  });

  describe('Performance Optimizations', () => {
    it('should use memoized components', () => {
      expect(TrainArrivalList.displayName).toBe('TrainArrivalList');
    });
  });

  describe('Accessibility', () => {
    it('should provide proper accessibility labels for train items', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race.
        makeTrain({ finalDestination: '상행역', direction: 'up', arrivalTime: new Date(Date.now() + 2 * 60 * 1000 + 5000) }),
      ]);

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByLabelText(/상행역 방면 열차, 정상 상태, 2분후/)).toBeTruthy();
      });
    });
  });

  describe('Arrival Time Formatting', () => {
    it('should show "도착" when arrival time has passed', async () => {
      mockSubscription([
        makeTrain({ arrivalTime: new Date(Date.now() - 1000) }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('도착')).toBeTruthy();
      });
    });

    it('should show "1분후" for 1 minute arrival', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race.
        makeTrain({ arrivalTime: new Date(Date.now() + 60 * 1000 + 5000) }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('1분후')).toBeTruthy();
      });
    });

    it('should show "정보없음" when arrivalTime is null', async () => {
      mockSubscription([
        makeTrain({ arrivalTime: null }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정보없음')).toBeTruthy();
      });
    });
  });

  describe('Multiple Trains Sorting', () => {
    it('should sort trains by arrival time', async () => {
      mockSubscription([
        makeTrain({ id: 't1', finalDestination: '역10', arrivalTime: new Date(Date.now() + 10 * 60 * 1000) }),
        makeTrain({ id: 't2', finalDestination: '역5', arrivalTime: new Date(Date.now() + 5 * 60 * 1000) }),
        makeTrain({ id: 't3', finalDestination: '역15', arrivalTime: new Date(Date.now() + 15 * 60 * 1000) }),
      ]);

      const { getByText, getAllByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        const directionTexts = getAllByText(/방면/);
        expect(directionTexts.length).toBe(3);
        expect(getByText('역5 방면')).toBeTruthy();
        expect(getByText('역10 방면')).toBeTruthy();
        expect(getByText('역15 방면')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unmount during name resolution', () => {
      // getStation never resolves → component unmounts before subscription
      mockTrainService.getStation.mockReturnValue(new Promise(() => {}));

      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(() => unmount()).not.toThrow();
    });

    it('should display nextStationId loading message when present', async () => {
      mockSubscription([
        makeTrain({ nextStationId: 'station-2' }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('다음역 정보 로딩중...')).toBeTruthy();
      });
    });

    it('should handle very large delay values', async () => {
      mockSubscription([
        makeTrain({ delayMinutes: 999 }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('(999분 지연)')).toBeTruthy();
      });
    });
  });

  // Guide (2026-05-16) item #8: differentiate 일반 / 급행 / 특급. Verifies
  // service-tier badge surfaces in the inline TrainArrivalItem after the
  // service-layer wiring (dataManager + arrivalService preserve trainType).
  describe('Train type badge', () => {
    it('should render 급행 badge when trainType is express', async () => {
      mockSubscription([makeTrain({ trainType: 'express' })]);

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(getByText('급행')).toBeTruthy();
      });
    });

    it('should render 특급 badge when trainType is rapid', async () => {
      mockSubscription([makeTrain({ trainType: 'rapid' })]);

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(getByText('특급')).toBeTruthy();
      });
    });

    it('should not render any tier badge when trainType is normal', async () => {
      mockSubscription([makeTrain({ trainType: 'normal' })]);

      const { queryByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(queryByText('급행')).toBeNull();
        expect(queryByText('특급')).toBeNull();
      });
    });

    it('should not render any tier badge when trainType is undefined (backward compat)', async () => {
      mockSubscription([makeTrain({ /* trainType omitted */ })]);

      const { queryByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(queryByText('급행')).toBeNull();
        expect(queryByText('특급')).toBeNull();
      });
    });
  });
});
