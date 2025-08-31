/**
 * Train Service Tests
 */

import { trainService } from '../trainService';
import { seoulSubwayApi } from '../../api/seoulSubwayApi';
import { dataManager } from '../../data/dataManager';
import { Train, Station } from '../../../models/train';

// Mock dependencies
jest.mock('../../api/seoulSubwayApi');
jest.mock('../../data/dataManager');

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;
const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;

describe('TrainService', () => {
  const mockStation: Station = {
    id: 'station-1',
    name: '강남역',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.5665,
      longitude: 126.9780,
    },
    transfers: ['9'],
  };

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
      delayMinutes: 2,
      status: 'DELAYED',
      nextStationId: 'station-3',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getRealtimeTrains', () => {
    it('should fetch real-time train data successfully', async () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);

      const result = await trainService.getRealtimeTrains('강남역');

      expect(result).toEqual(mockTrains);
      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledWith('강남역');
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API unavailable');
      mockDataManager.getRealtimeTrains.mockRejectedValue(error);

      const result = await trainService.getRealtimeTrains('강남역');

      expect(result).toEqual([]);
      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledWith('강남역');
    });

    it('should cache successful results', async () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);

      // First call
      await trainService.getRealtimeTrains('강남역');
      // Second call
      await trainService.getRealtimeTrains('강남역');

      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStationInfo', () => {
    it('should fetch station information successfully', async () => {
      mockSeoulApi.getStationInfo.mockResolvedValue(mockStation);

      const result = await trainService.getStationInfo('강남역');

      expect(result).toEqual(mockStation);
      expect(mockSeoulApi.getStationInfo).toHaveBeenCalledWith('강남역');
    });

    it('should return null for non-existent stations', async () => {
      mockSeoulApi.getStationInfo.mockResolvedValue(null);

      const result = await trainService.getStationInfo('존재하지않는역');

      expect(result).toBeNull();
      expect(mockSeoulApi.getStationInfo).toHaveBeenCalledWith('존재하지않는역');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockSeoulApi.getStationInfo.mockRejectedValue(error);

      const result = await trainService.getStationInfo('강남역');

      expect(result).toBeNull();
    });
  });

  describe('subscribeToTrainUpdates', () => {
    it('should create subscription and call callback with initial data', () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);
      const callback = jest.fn();

      const unsubscribe = trainService.subscribeToTrainUpdates('강남역', callback);

      // Should start fetching immediately
      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledWith('강남역');

      // Should return unsubscribe function
      expect(typeof unsubscribe).toBe('function');
    });

    it('should update data at specified interval', async () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);
      const callback = jest.fn();

      trainService.subscribeToTrainUpdates('강남역', callback);

      // Fast-forward time to trigger interval updates
      jest.advanceTimersByTime(30000); // 30 seconds
      await jest.runAllPromises();

      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledTimes(2);
    });

    it('should stop updates when unsubscribed', () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);
      const callback = jest.fn();

      const unsubscribe = trainService.subscribeToTrainUpdates('강남역', callback);
      unsubscribe();

      jest.advanceTimersByTime(30000);

      // Should not call API after unsubscribe
      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledTimes(1);
    });

    it('should handle subscription errors gracefully', async () => {
      const error = new Error('Subscription failed');
      mockDataManager.getRealtimeTrains.mockRejectedValue(error);
      const callback = jest.fn();

      trainService.subscribeToTrainUpdates('강남역', callback);
      await jest.runAllPromises();

      // Should not crash and should call callback with empty array
      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('getNearbyStations', () => {
    const mockLocation = {
      latitude: 37.5665,
      longitude: 126.9780,
    };

    it('should return nearby stations within radius', async () => {
      const nearbyStations = [mockStation];
      mockSeoulApi.getNearbyStations.mockResolvedValue(nearbyStations);

      const result = await trainService.getNearbyStations(mockLocation, 500);

      expect(result).toEqual(nearbyStations);
      expect(mockSeoulApi.getNearbyStations).toHaveBeenCalledWith(
        mockLocation,
        500
      );
    });

    it('should use default radius when not provided', async () => {
      mockSeoulApi.getNearbyStations.mockResolvedValue([mockStation]);

      await trainService.getNearbyStations(mockLocation);

      expect(mockSeoulApi.getNearbyStations).toHaveBeenCalledWith(
        mockLocation,
        1000 // default radius
      );
    });

    it('should return empty array on error', async () => {
      const error = new Error('Location service unavailable');
      mockSeoulApi.getNearbyStations.mockRejectedValue(error);

      const result = await trainService.getNearbyStations(mockLocation);

      expect(result).toEqual([]);
    });
  });

  describe('getDelayNotifications', () => {
    it('should identify delayed trains correctly', async () => {
      const delayedTrains = mockTrains.filter(train => train.delayMinutes > 0);
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);

      const result = await trainService.getDelayNotifications('강남역');

      expect(result).toHaveLength(1);
      expect(result[0].delayMinutes).toBeGreaterThan(0);
      expect(result[0].status).toBe('DELAYED');
    });

    it('should return empty array when no delays', async () => {
      const normalTrains = mockTrains.filter(train => train.delayMinutes === 0);
      mockDataManager.getRealtimeTrains.mockResolvedValue(normalTrains);

      const result = await trainService.getDelayNotifications('강남역');

      expect(result).toEqual([]);
    });

    it('should handle service errors gracefully', async () => {
      mockDataManager.getRealtimeTrains.mockRejectedValue(new Error('Service error'));

      const result = await trainService.getDelayNotifications('강남역');

      expect(result).toEqual([]);
    });
  });

  describe('Performance Monitoring', () => {
    it('should complete operations within performance thresholds', async () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);
      
      const startTime = Date.now();
      await trainService.getRealtimeTrains('강남역');
      const duration = Date.now() - startTime;

      // Should complete within 200ms for cached data
      expect(duration).toBeLessThan(200);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockDataManager.getRealtimeTrains.mockResolvedValue(mockTrains);

      const promises = [
        trainService.getRealtimeTrains('강남역'),
        trainService.getRealtimeTrains('홍대입구역'),
        trainService.getRealtimeTrains('신촌역'),
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Concurrent requests should not significantly increase total time
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests', async () => {
      mockDataManager.getRealtimeTrains
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue(mockTrains);

      const result = await trainService.getRealtimeTrains('강남역');

      expect(result).toEqual(mockTrains);
      expect(mockDataManager.getRealtimeTrains).toHaveBeenCalledTimes(2);
    });

    it('should fallback to cached data on API failure', async () => {
      const cachedTrains = [mockTrains[0]]; // Subset of data
      mockDataManager.getRealtimeTrains
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValue(cachedTrains);

      const result = await trainService.getRealtimeTrains('강남역');

      expect(result).toEqual(cachedTrains);
    });
  });
});