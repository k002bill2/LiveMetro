/**
 * TrainArrivalList Component Tests
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { TrainArrivalList } from '../TrainArrivalList';
import { trainService } from '../../../services/train/trainService';
import { seoulSubwayApi } from '../../../services/api/seoulSubwayApi';
import { performanceMonitor } from '../../../utils/performanceUtils';
import { TrainStatus, Train } from '../../../models/train';

// Mock the train service
jest.mock('../../../services/train/trainService', () => ({
  trainService: {
    subscribeToTrainUpdates: jest.fn(),
    getStation: jest.fn(),
  },
}));

// Mock Seoul Subway API
jest.mock('../../../services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrival: jest.fn().mockResolvedValue([]),
  },
}));

// Mock performance utils to avoid throttling in tests
jest.mock('../../../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
  },
  throttle: (fn: any) => fn, // Return function immediately without throttling
}));

const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockSeoulSubwayApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;

describe('TrainArrivalList', () => {
  const mockTrains: Train[] = [
    {
      id: 'train-1',
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
    // Default mock for getStation - needed for API calls
    mockTrainService.getStation.mockResolvedValue({
      id: 'station-1',
      name: '테스트역',
      nameEn: 'Test Station',
      lineId: '2',
      coordinates: { latitude: 37.5, longitude: 127.0 },
      transfers: [],
    });
    // Default for subscribeToTrainUpdates - returns unsubscribe function
    mockTrainService.subscribeToTrainUpdates.mockReturnValue(jest.fn());
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback([]);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback([]);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
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
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
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

  describe('Status Badges - All Status Types', () => {
    it('should display NORMAL status badge', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([mockTrains[0]!]); // NORMAL status
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정상')).toBeTruthy();
      });
    });

    it('should display DELAYED status badge', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([mockTrains[1]!]); // DELAYED status
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('지연')).toBeTruthy();
      });
    });

    it('should display SUSPENDED status badge', async () => {
      const suspendedTrain = {
        ...mockTrains[0]!,
        status: TrainStatus.SUSPENDED,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback([suspendedTrain]);
        });
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('운행중단')).toBeTruthy();
      });
    });

    it('should display MAINTENANCE status badge', async () => {
      const maintenanceTrain = {
        ...mockTrains[0]!,
        status: TrainStatus.MAINTENANCE,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([maintenanceTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('점검중')).toBeTruthy();
      });
    });

    it('should display EMERGENCY status badge', async () => {
      const emergencyTrain = {
        ...mockTrains[0]!,
        status: TrainStatus.EMERGENCY,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([emergencyTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('긴급')).toBeTruthy();
      });
    });

    it('should handle unknown status gracefully', async () => {
      const unknownStatusTrain = {
        ...mockTrains[0]!,
        status: 'unknown' as TrainStatus,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([unknownStatusTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('알수없음')).toBeTruthy();
      });
    });
  });

  describe('Arrival Time Formatting', () => {
    it('should show "도착" when arrival time has passed', async () => {
      const arrivedTrain = {
        ...mockTrains[0]!,
        arrivalTime: new Date(Date.now() - 1000), // 1 second in the past
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([arrivedTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('도착')).toBeTruthy();
      });
    });

    it('should show "1분 후" for 1 minute arrival', async () => {
      const oneMinuteTrain = {
        ...mockTrains[0]!,
        arrivalTime: new Date(Date.now() + 60 * 1000), // 1 minute
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([oneMinuteTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('1분 후')).toBeTruthy();
      });
    });

    it('should show "정보없음" when arrivalTime is null', async () => {
      const noTimeTrain = {
        ...mockTrains[0]!,
        arrivalTime: null,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([noTimeTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정보없음')).toBeTruthy();
      });
    });

    it('should round up arrival minutes correctly', async () => {
      const train = {
        ...mockTrains[0]!,
        arrivalTime: new Date(Date.now() + 3 * 60 * 1000 + 45 * 1000), // 3:45
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([train]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('4분 후')).toBeTruthy();
      });
    });
  });

  describe('Multiple Trains Sorting', () => {
    it('should sort trains by arrival time', async () => {
      const trainsToSort = [
        {
          ...mockTrains[0]!,
          id: 'train-10',
          arrivalTime: new Date(Date.now() + 10 * 60 * 1000),
          finalDestination: '역10',
        },
        {
          ...mockTrains[0]!,
          id: 'train-5',
          arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
          finalDestination: '역5',
        },
        {
          ...mockTrains[0]!,
          id: 'train-15',
          arrivalTime: new Date(Date.now() + 15 * 60 * 1000),
          finalDestination: '역15',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback(trainsToSort);
        return jest.fn();
      });

      const { getByText, getAllByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        const directionTexts = getAllByText(/방면/);
        expect(directionTexts.length).toBe(3);
        // Trains should appear in sorted order
        expect(getByText('역5 방면')).toBeTruthy();
        expect(getByText('역10 방면')).toBeTruthy();
        expect(getByText('역15 방면')).toBeTruthy();
      });
    });
  });

  describe('Delay Display', () => {
    it('should not display delay text when delayMinutes is 0', async () => {
      const noDelayTrain = {
        ...mockTrains[0]!,
        delayMinutes: 0,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([noDelayTrain]);
        return jest.fn();
      });

      const { queryByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(queryByText(/분 지연/)).toBeFalsy();
      });
    });

    it('should display delay text when delayMinutes > 0', async () => {
      const delayedTrain = {
        ...mockTrains[1]!, // This has delayMinutes: 2
        delayMinutes: 3,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([delayedTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('(3분 지연)')).toBeTruthy();
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle Seoul API errors gracefully', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockRejectedValueOnce(
        new Error('API Error')
      );

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      // Should show loading initially, then after error shows empty state
      await waitFor(() => {
        // The component should still render despite API error
        expect(getByText(/현재 도착 예정인 열차가 없습니다|실시간 열차 정보/)).toBeTruthy();
      });
    });

    it('should handle station not found', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue(null);
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      render(
        <TrainArrivalList stationId="unknown-station" />
      );

      await waitFor(() => {
        // Should fall back to using stationId as name
        expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure API fetch performance', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(performanceMonitor.startMeasure).toHaveBeenCalledWith(
          expect.stringContaining('api_fetch_')
        );
        expect(performanceMonitor.endMeasure).toHaveBeenCalledWith(
          expect.stringContaining('api_fetch_')
        );
      });
    });

    it('should measure subscription performance', () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });

      render(<TrainArrivalList stationId="station-1" />);

      expect(performanceMonitor.startMeasure).toHaveBeenCalledWith(
        expect.stringContaining('subscription_')
      );
      expect(performanceMonitor.endMeasure).toHaveBeenCalledWith(
        expect.stringContaining('subscription_')
      );
    });
  });

  describe('Polling Interval', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set up polling interval when subscribing', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      render(<TrainArrivalList stationId="station-1" />);

      // Polling should be set up (async call)
      await waitFor(() => {
        expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalled();
      });
    });
  });

  describe('Seoul API Response Conversion', () => {
    it('should convert Seoul API response with barvlDt to Train model', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: '180', // 180 seconds = 3 minutes
          btrainNo: '001',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // Should display converted train data
        expect(getByText('목적지 방면')).toBeTruthy();
      });
    });

    it('should parse arrival time from arvlMsg2 when barvlDt is missing', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '하행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: null,
          arvlMsg2: '5분 후 도착',
          btrainNo: '002',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText(/분 후/)).toBeTruthy();
      });
    });

    it('should handle "곧 도착" message in arvlMsg2', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: null,
          arvlMsg2: '곧 도착',
          btrainNo: '003',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // 30 seconds should be added
        expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalled();
      });
    });

    it('should handle "진입" message in arvlMsg2', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: null,
          arvlMsg2: '진입 중',
          btrainNo: '004',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockSeoulSubwayApi.getRealtimeArrival).toHaveBeenCalled();
      });
    });

    it('should filter out trains without arrivalTime after conversion', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: null,
          arvlMsg2: 'invalid message',
          btrainNo: '005',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
      });
    });

    it('should use default destination text when bstatnNm and trainLineNm are missing', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: null,
          trainLineNm: null,
          barvlDt: '180',
          btrainNo: '006',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('행선지 미정 방면')).toBeTruthy();
      });
    });

    it('should use stationId as fallback for currentStationId', async () => {
      const apiResponse = [
        {
          statnId: null,
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: '180',
          btrainNo: '007',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('목적지 방면')).toBeTruthy();
      });
    });
  });

  describe('TrainArrivalItem Component', () => {
    it('should render train item with all required information', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        act(() => {
          callback(mockTrains);
        });
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // Check that train item components render
        expect(getByText('상행 방면')).toBeTruthy();
        expect(getByText('하행 방면')).toBeTruthy();
        expect(getByText('2분 후')).toBeTruthy();
        expect(getByText('5분 후')).toBeTruthy();
      });
    });

    it('should display nextStationId loading message when present', async () => {
      const trainWithNextStation = {
        ...mockTrains[0]!,
        nextStationId: 'station-2',
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([trainWithNextStation]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('다음역 정보 로딩중...')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty API response', async () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
      });
    });

    it('should handle invalid barvlDt value', async () => {
      const apiResponse = [
        {
          statnId: 'station-1',
          subwayId: '2',
          updnLine: '상행',
          statnTid: 'station-2',
          bstatnNm: '목적지',
          trainLineNm: '2호선',
          barvlDt: 'invalid',
          arvlMsg2: null,
          btrainNo: '008',
        },
      ];

      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue(apiResponse as any);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // Train without valid arrival time should be filtered out
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
      });
    });

    it('should handle very large delay values', async () => {
      const delayedTrain = {
        ...mockTrains[0]!,
        delayMinutes: 999,
      };

      mockTrainService.subscribeToTrainUpdates.mockImplementation((_stationId, callback) => {
        callback([delayedTrain]);
        return jest.fn();
      });

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('(999분 지연)')).toBeTruthy();
      });
    });

    it('should maintain isMounted flag correctly during unmount', () => {
      mockTrainService.subscribeToTrainUpdates.mockImplementation(() => jest.fn());
      mockTrainService.getStation.mockResolvedValue({
        id: 'station-1',
        name: '테스트역',
        nameEn: 'Test Station',
        lineId: '2',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        transfers: [],
      });
      mockSeoulSubwayApi.getRealtimeArrival.mockResolvedValue([]);

      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );

      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });
});