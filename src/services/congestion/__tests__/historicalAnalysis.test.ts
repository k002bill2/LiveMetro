/**
 * Historical Analysis Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { historicalAnalysisService } from '../historicalAnalysis';

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

describe('HistoricalAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(historicalAnalysisService.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted storage data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await expect(historicalAnalysisService.initialize()).resolves.not.toThrow();
    });
  });

  describe('addRecord', () => {
    it('should add a congestion record', async () => {
      await expect(
        historicalAnalysisService.addRecord('222', '2', 'up', 'moderate' as any)
      ).resolves.not.toThrow();
    });
  });

  describe('analyzeTrend', () => {
    it('should analyze trend for a station', async () => {
      const result = await historicalAnalysisService.analyzeTrend(
        '222', '2', 'weekly'
      );
      expect(result).toBeDefined();
    });
  });

  describe('compareStations', () => {
    it('should compare stations', async () => {
      const result = await historicalAnalysisService.compareStations(
        '2', ['222', '223'], ['역삼', '선릉']
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTimePatterns', () => {
    it('should return time patterns', async () => {
      const result = await historicalAnalysisService.getTimePatterns('222', '2');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies', async () => {
      const result = await historicalAnalysisService.detectAnomalies('222', '2');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSummaryStats', () => {
    it('should return summary statistics', async () => {
      const result = await historicalAnalysisService.getSummaryStats('222', '2');
      expect(result).toBeDefined();
    });
  });

  describe('clearRecords', () => {
    it('should clear records without error', async () => {
      await expect(historicalAnalysisService.clearRecords()).resolves.not.toThrow();
    });
  });
});
