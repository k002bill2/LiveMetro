/**
 * Advanced Pattern Service Tests
 */

import { advancedPatternService } from '../advancedPatternService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/models/pattern', () => ({
  DayOfWeek: { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 },
  parseTimeToMinutes: jest.fn((time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }),
  formatMinutesToTime: jest.fn((mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }),
}));

describe('AdvancedPatternService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzePatterns', () => {
    it('should analyze empty logs', async () => {
      const result = await advancedPatternService.analyzePatterns('user-1', []);
      expect(result).toBeDefined();
    });

    it('should analyze logs with data', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          date: '2024-01-15',
          departureStation: '강남',
          arrivalStation: '역삼',
          departureTime: '08:30',
          arrivalTime: '08:35',
          lineId: '2',
          dayOfWeek: 1,
          isCommute: true,
          direction: 'morning' as const,
        },
      ];
      const result = await advancedPatternService.analyzePatterns('user-1', mockLogs);
      expect(result).toBeDefined();
    });
  });

  describe('getCachedPattern', () => {
    it('should return null for unknown user', () => {
      const result = advancedPatternService.getCachedPattern('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getOptimalDepartureTime', () => {
    it('should return optimal time with logs', async () => {
      const mockLogs = [
        {
          id: 'log-1', userId: 'user-1', date: '2024-01-15',
          departureStation: '강남', arrivalStation: '역삼',
          departureTime: '08:30', arrivalTime: '08:35',
          lineId: '2', dayOfWeek: 1, isCommute: true, direction: 'morning' as const,
        },
        {
          id: 'log-2', userId: 'user-1', date: '2024-01-16',
          departureStation: '강남', arrivalStation: '역삼',
          departureTime: '08:25', arrivalTime: '08:33',
          lineId: '2', dayOfWeek: 1, isCommute: true, direction: 'morning' as const,
        },
      ];
      const result = await advancedPatternService.getOptimalDepartureTime(mockLogs, 1);
      expect(result).toBeDefined();
      expect(result.optimalTime).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty logs', async () => {
      const result = await advancedPatternService.getOptimalDepartureTime([], 1);
      expect(result).toBeDefined();
    });
  });

  describe('detectAnomalies', () => {
    it('should return empty for no logs', () => {
      const result = advancedPatternService.detectAnomalies([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('predictDelayProbability', () => {
    it('should return default for empty logs', () => {
      const result = advancedPatternService.predictDelayProbability(
        [], 1, '08:30'
      );
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });
});
