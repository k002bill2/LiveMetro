/**
 * Statistics Service Tests
 */

import { statisticsService, isCacheValid } from '../statisticsService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('StatisticsService', () => {
  const createMockLog = (overrides: Partial<CommuteLog> = {}): CommuteLog => ({
    id: `log_${Math.random()}`,
    userId: 'user1',
    date: new Date().toISOString().split('T')[0]!,
    dayOfWeek: 1 as DayOfWeek,
    departureTime: '08:30',
    arrivalTime: '09:00',
    departureStationId: 'station1',
    arrivalStationId: 'station2',
    lineIds: ['2'],
    transferCount: 0,
    duration: 30,
    wasDelayed: false,
    delayMinutes: 0,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('calculateSummary', () => {
    it('should return empty summary for no logs', async () => {
      const summary = await statisticsService.calculateSummary([]);

      expect(summary.totalTrips).toBe(0);
      expect(summary.totalDelayMinutes).toBe(0);
      expect(summary.onTimeRate).toBe(100);
    });

    it('should calculate total trips', async () => {
      const logs = [createMockLog(), createMockLog(), createMockLog()];

      const summary = await statisticsService.calculateSummary(logs);

      expect(summary.totalTrips).toBe(3);
    });

    it('should calculate delay statistics', async () => {
      const logs = [
        createMockLog({ wasDelayed: true, delayMinutes: 10 }),
        createMockLog({ wasDelayed: true, delayMinutes: 20 }),
        createMockLog({ wasDelayed: false, delayMinutes: 0 }),
      ];

      const summary = await statisticsService.calculateSummary(logs);

      expect(summary.totalDelayMinutes).toBe(30);
    });

    it('should calculate on-time rate', async () => {
      const logs = [
        createMockLog({ wasDelayed: false }),
        createMockLog({ wasDelayed: false }),
        createMockLog({ wasDelayed: true }),
        createMockLog({ wasDelayed: true }),
      ];

      const summary = await statisticsService.calculateSummary(logs);

      // 2 on-time out of 4 = 50%
      expect(summary.onTimeRate).toBe(50);
    });

    it('should identify most used line', async () => {
      const logs = [
        createMockLog({ lineIds: ['2'] }),
        createMockLog({ lineIds: ['2'] }),
        createMockLog({ lineIds: ['3'] }),
      ];

      const summary = await statisticsService.calculateSummary(logs);

      expect(summary.mostUsedLine).toBe('2호선');
    });
  });

  describe('getDailyStats', () => {
    it('should return empty stats for date with no logs', () => {
      const stats = statisticsService.getDailyStats([], '2024-01-01');

      expect(stats.totalTrips).toBe(0);
      expect(stats.onTimeRate).toBe(100);
    });

    it('should calculate stats for specific date', () => {
      const logs = [
        createMockLog({ date: '2024-01-01', wasDelayed: true }),
        createMockLog({ date: '2024-01-01', wasDelayed: false }),
        createMockLog({ date: '2024-01-02', wasDelayed: false }),
      ];

      const stats = statisticsService.getDailyStats(logs, '2024-01-01');

      expect(stats.totalTrips).toBe(2);
      expect(stats.delayedTrips).toBe(1);
    });
  });

  describe('getWeeklyStats', () => {
    it('should calculate weekly statistics', () => {
      const weekStart = new Date('2024-01-01');
      const logs = [
        createMockLog({ date: '2024-01-01', dayOfWeek: 1 as DayOfWeek }),
        createMockLog({ date: '2024-01-02', dayOfWeek: 2 as DayOfWeek }),
        createMockLog({ date: '2024-01-03', dayOfWeek: 3 as DayOfWeek }),
      ];

      const stats = statisticsService.getWeeklyStats(logs, weekStart);

      expect(stats.totalTrips).toBe(3);
      expect(stats.dailyBreakdown.length).toBe(7);
      expect(stats.byDayOfWeek[1]).toBe(1);
      expect(stats.byDayOfWeek[2]).toBe(1);
    });
  });

  describe('getLineUsageData', () => {
    it('should return empty array for no logs', () => {
      const data = statisticsService.getLineUsageData([]);

      expect(data.length).toBe(0);
    });

    it('should calculate line usage percentages', () => {
      const logs = [
        createMockLog({ lineIds: ['2'] }),
        createMockLog({ lineIds: ['2'] }),
        createMockLog({ lineIds: ['3'] }),
        createMockLog({ lineIds: ['3'] }),
      ];

      const data = statisticsService.getLineUsageData(logs);

      expect(data.length).toBe(2);
      // Each line should have 50% (2 out of 4)
      expect(data[0]?.percentage).toBe(50);
    });

    it('should include line colors', () => {
      const logs = [createMockLog({ lineIds: ['2'] })];

      const data = statisticsService.getLineUsageData(logs);

      expect(data[0]?.color).toBe('#00A84D'); // Line 2 color
    });
  });

  describe('getDelayDistribution', () => {
    it('should categorize delays into ranges', () => {
      const logs = [
        createMockLog({ delayMinutes: 0 }),
        createMockLog({ delayMinutes: 3 }),
        createMockLog({ delayMinutes: 8 }),
        createMockLog({ delayMinutes: 15 }),
        createMockLog({ delayMinutes: 30 }),
      ];

      const distribution = statisticsService.getDelayDistribution(logs);

      expect(distribution.length).toBe(5);
      expect(distribution[0]?.range).toBe('정시');
      expect(distribution[0]?.count).toBe(1);
    });
  });

  describe('getWeeklyTrendData', () => {
    it('should return trend data for specified weeks', () => {
      const logs = [createMockLog()];

      const trend = statisticsService.getWeeklyTrendData(logs, 4);

      expect(trend.length).toBe(4);
      trend.forEach(point => {
        expect(point).toHaveProperty('x');
        expect(point).toHaveProperty('y');
      });
    });
  });

  describe('getHourlyDistributionData', () => {
    it('should return 24 hour distribution', () => {
      const logs = [
        createMockLog({ departureTime: '08:00' }),
        createMockLog({ departureTime: '08:30' }),
        createMockLog({ departureTime: '09:15' }),
      ];

      const distribution = statisticsService.getHourlyDistributionData(logs);

      expect(distribution.length).toBe(24);
      expect(distribution[8]?.y).toBe(2);
      expect(distribution[9]?.y).toBe(1);
    });
  });

  describe('getDelayByDayData', () => {
    it('should return delay data by day of week', () => {
      const logs = [
        createMockLog({ dayOfWeek: 1 as DayOfWeek, delayMinutes: 10 }),
        createMockLog({ dayOfWeek: 1 as DayOfWeek, delayMinutes: 20 }),
        createMockLog({ dayOfWeek: 2 as DayOfWeek, delayMinutes: 5 }),
      ];

      const data = statisticsService.getDelayByDayData(logs);

      expect(data.length).toBe(7);
      // Monday (index 0 in result) average: (10+20)/2 = 15
      expect(data[0]?.x).toBe('월');
      expect(data[0]?.y).toBe(15);
    });
  });

  describe('isCacheValid', () => {
    it('should return true for recent timestamp', () => {
      const recentTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      expect(isCacheValid(recentTimestamp)).toBe(true);
    });

    it('should return false for old timestamp', () => {
      const oldTimestamp = Date.now() - 60 * 60 * 1000; // 1 hour ago
      expect(isCacheValid(oldTimestamp)).toBe(false);
    });
  });
});
