/**
 * Pattern Analysis Service Tests
 */

import { patternAnalysisService } from '../patternAnalysisService';
import {
  DayOfWeek,
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
} from '@/models/pattern';
import * as routeService from '@/services/route/routeService';

import { commuteLogService } from '../commuteLogService';

jest.mock('@/services/route/routeService');
const mockedCalculateRoute = routeService.calculateRoute as jest.MockedFunction<
  typeof routeService.calculateRoute
>;

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

// Mock pattern model — partial mock: keep real constants & derived helpers
// (DEFAULT_*_MIN, computeArrivalTime, deriveDirection) via requireActual so
// producer logic uses canonical values, but override unit-level helpers we
// stub for test ergonomics.
jest.mock('@/models/pattern', () => {
  const actual = jest.requireActual('@/models/pattern');
  return {
    ...actual,
    DayOfWeek: 0,
    MIN_LOGS_FOR_PATTERN: 3,
    getDayOfWeek: jest.fn(() => 1),
    formatDateString: jest.fn((date) => date.toISOString().split('T')[0]),
    isWeekday: jest.fn((day: number) => day >= 1 && day <= 5),
    calculateAverageTime: jest.fn(() => '08:30'),
    calculateTimeStdDev: jest.fn(() => 10),
    calculateConfidence: jest.fn(() => 0.8),
    calculateAlertTime: jest.fn(() => '08:00'),
    fromCommutePatternDoc: jest.fn((userId: string, data: any) => ({
      userId,
      dayOfWeek: data.dayOfWeek,
      avgDepartureTime: data.avgDepartureTime,
      stdDevMinutes: data.stdDevMinutes,
      frequentRoute: data.frequentRoute,
      confidence: data.confidence,
      sampleCount: data.sampleCount,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    })),
  };
});

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

  describe('predictCommute — derived fields on route success', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('populates transitSegments, walk/wait scalars, predictedMinutes, predictedArrivalTime, range, direction', async () => {
      const stubPattern = {
        userId: 'u1',
        dayOfWeek: 2 as DayOfWeek,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: '0150',
          departureStationName: '서울역',
          arrivalStationId: '0220',
          arrivalStationName: '강남역',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date('2026-05-12'),
      };
      jest
        .spyOn(patternAnalysisService, 'getPatternForDay')
        .mockResolvedValueOnce(stubPattern);

      mockedCalculateRoute.mockReturnValueOnce({
        segments: [
          {
            fromStationId: '0150', fromStationName: '서울역',
            toStationId: '0151', toStationName: '시청',
            lineId: '1', lineName: '1호선',
            estimatedMinutes: 20, isTransfer: false,
          },
        ],
        totalMinutes: 20,
        transferCount: 0,
        lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute(
        'u1',
        new Date('2026-05-12'),
      );

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toHaveLength(1);
      expect(result?.transitSegments?.[0]?.congestionForecast).toBeUndefined();
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.predictedMinutes).toBe(4 + 3 + 3 + 20); // 30
      expect(result?.predictedArrivalTime).toBe('08:30');
      expect(result?.predictedMinutesRange).toEqual([27, 33]);
      expect(result?.direction).toBe('up');
    });

    it('returns base fields with transit/total/range undefined when calculateRoute returns null', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: 'unknown-from',
          departureStationName: 'X',
          arrivalStationId: 'unknown-to',
          arrivalStationName: 'Y',
          lineIds: [],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce(null);

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toBeUndefined();
      expect(result?.predictedMinutes).toBeUndefined();
      expect(result?.predictedArrivalTime).toBeUndefined();
      expect(result?.predictedMinutesRange).toBeUndefined();
      expect(result?.direction).toBeUndefined();
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.predictedDepartureTime).toBe('08:00');
      expect(result?.confidence).toBe(0.8);
    });

    it('soft-fails to base when calculateRoute throws', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: 'a', departureStationName: 'A',
          arrivalStationId: 'b', arrivalStationName: 'B',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toBeUndefined();
      expect(result?.predictedMinutes).toBeUndefined();
    });

    it('returns predictedMinutesRange undefined when stdDevMinutes is 0', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 0,
        frequentRoute: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0151', arrivalStationName: '시청',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce({
        segments: [{
          fromStationId: '0150', fromStationName: '서울역',
          toStationId: '0151', toStationName: '시청',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 10, isTransfer: false,
        }],
        totalMinutes: 10,
        transferCount: 0,
        lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result?.predictedMinutes).toBe(20);
      expect(result?.predictedMinutesRange).toBeUndefined();
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
