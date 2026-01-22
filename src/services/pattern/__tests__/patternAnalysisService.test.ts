/**
 * Pattern Analysis Service Tests
 */

import { patternAnalysisService } from '../patternAnalysisService';
import { DayOfWeek } from '@/models/pattern';

import { commuteLogService } from '../commuteLogService';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mockDocRef'),
  collection: jest.fn(() => 'mockCollectionRef'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock pattern model
jest.mock('@/models/pattern', () => ({
  DayOfWeek: 0,
  MIN_LOGS_FOR_PATTERN: 3,
  getDayOfWeek: jest.fn(() => 1),
  formatDateString: jest.fn((date) => date.toISOString().split('T')[0]),
  isWeekday: jest.fn((day) => day >= 1 && day <= 5),
  calculateAverageTime: jest.fn(() => '08:30'),
  calculateTimeStdDev: jest.fn(() => 10),
  calculateConfidence: jest.fn(() => 0.8),
  calculateAlertTime: jest.fn(() => '08:00'),
  fromCommutePatternDoc: jest.fn((userId, data) => ({
    userId,
    dayOfWeek: data.dayOfWeek,
    avgDepartureTime: data.avgDepartureTime,
    stdDevMinutes: data.stdDevMinutes,
    frequentRoute: data.frequentRoute,
    confidence: data.confidence,
    sampleCount: data.sampleCount,
    lastUpdated: data.lastUpdated?.toDate() || new Date(),
  })),
}));

// Mock commuteLogService
jest.mock('../commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn(),
  },
}));

describe('PatternAnalysisService', () => {
  const mockLogs = [
    {
      id: 'log-1',
      userId: 'user-123',
      date: '2024-01-15',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:30',
      arrivalTime: '09:00',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'log-2',
      userId: 'user-123',
      date: '2024-01-22',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:25',
      arrivalTime: '08:55',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-22'),
      updatedAt: new Date('2024-01-22'),
    },
    {
      id: 'log-3',
      userId: 'user-123',
      date: '2024-01-29',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:35',
      arrivalTime: '09:05',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-29'),
      updatedAt: new Date('2024-01-29'),
    },
  ];

  const mockPatternDoc = {
    exists: () => true,
    data: () => ({
      dayOfWeek: 1,
      avgDepartureTime: '08:30',
      stdDevMinutes: 10,
      frequentRoute: {
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      },
      confidence: 0.8,
      sampleCount: 3,
      lastUpdated: { toDate: () => new Date('2024-01-29') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeAndUpdatePatterns', () => {
    it('should analyze logs and return patterns', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.dayOfWeek).toBe(1);
    });

    it('should return empty array if no logs', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([]);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => mockPatternDoc.data() }],
      });

      const result = await patternAnalysisService.getPatterns('user-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('getPatternForDay', () => {
    it('should return pattern for specific day', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getPatternForDay('user-123', 1 as DayOfWeek);

      expect(result).not.toBeNull();
      expect(result?.avgDepartureTime).toBe('08:30');
    });

    it('should return null if pattern not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.getPatternForDay('user-123', 6 as DayOfWeek);

      expect(result).toBeNull();
    });
  });

  describe('predictCommute', () => {
    it('should return prediction based on pattern', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.predictCommute('user-123');

      expect(result).not.toBeNull();
      expect(result?.predictedDepartureTime).toBe('08:30');
    });

    it('should return null if no pattern exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.predictCommute('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getWeekPredictions', () => {
    it('should return predictions for weekdays', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getWeekPredictions('user-123', false);

      // Should have predictions for weekdays
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include weekends if specified', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getWeekPredictions('user-123', true);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('hasTodayPattern', () => {
    it('should return true if pattern exists with sufficient confidence', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.hasTodayPattern('user-123');

      expect(result).toBe(true);
    });

    it('should return false if no pattern', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.hasTodayPattern('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getTodaySuggestedAlertTime', () => {
    it('should return suggested alert time', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getTodaySuggestedAlertTime('user-123');

      expect(result).toBe('08:00');
    });

    it('should return null if no pattern', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.getTodaySuggestedAlertTime('user-123');

      expect(result).toBeNull();
    });
  });
});
