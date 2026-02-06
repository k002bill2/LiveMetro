/**
 * Congestion Prediction Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { congestionPredictionService } from '../congestionPredictionService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
}));

describe('CongestionPredictionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(congestionPredictionService.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted storage data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await expect(congestionPredictionService.initialize()).resolves.not.toThrow();
    });
  });

  describe('recordObservation', () => {
    it('should record congestion observation', async () => {
      await congestionPredictionService.recordObservation({
        stationId: '222',
        lineId: '2',
        direction: 'up' as const,
        congestionLevel: 2,
      });
      // Service should process observation
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));
      await expect(
        congestionPredictionService.recordObservation({
          stationId: '222',
          lineId: '2',
          direction: 'up' as const,
          congestionLevel: 3,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('predictCongestion', () => {
    it('should return prediction with Date argument', async () => {
      const targetTime = new Date(2024, 0, 15, 8, 30);
      const result = await congestionPredictionService.predictCongestion(
        '222', '2', 'up', targetTime
      );
      expect(result).toBeDefined();
      expect(result.stationId).toBe('222');
      expect(result.predictedLevel).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('getHourlyPattern', () => {
    it('should return hourly pattern', async () => {
      const result = await congestionPredictionService.getHourlyPattern(
        '222', '2', 'up', 1
      );
      expect(result).toBeDefined();
      expect(result.stationId).toBe('222');
      expect(result.hourlyStats).toBeDefined();
    });
  });

  describe('getUpcomingPredictions', () => {
    it('should return upcoming predictions', async () => {
      const results = await congestionPredictionService.getUpcomingPredictions(
        '222', '2', 'up', 4
      );
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getPeakHoursSummary', () => {
    it('should return peak hours summary', async () => {
      const result = await congestionPredictionService.getPeakHoursSummary(
        '222', '2', 'up'
      );
      expect(result).toBeDefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear without error', async () => {
      await expect(congestionPredictionService.clearHistory()).resolves.not.toThrow();
    });
  });
});
