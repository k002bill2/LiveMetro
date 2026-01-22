/**
 * Commute Log Service Tests
 */

import { commuteLogService } from '../commuteLogService';
import { DayOfWeek } from '@/models/pattern';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mockCollectionRef'),
  doc: jest.fn(() => 'mockDocRef'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ type: 'where', args })),
  orderBy: jest.fn((...args) => ({ type: 'orderBy', args })),
  limit: jest.fn((n) => ({ type: 'limit', value: n })),
  Timestamp: {
    fromDate: jest.fn((date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// Mock pattern model
jest.mock('@/models/pattern', () => ({
  DayOfWeek: 0,
  MAX_LOG_AGE_DAYS: 30,
  getDayOfWeek: jest.fn(() => 1), // Monday
  formatDateString: jest.fn((date) => date.toISOString().split('T')[0]),
  getCurrentTimeString: jest.fn(() => '08:30'),
  fromCommuteLogDoc: jest.fn((id, userId, data) => ({
    id,
    userId,
    date: data.date,
    dayOfWeek: data.dayOfWeek,
    departureTime: data.departureTime,
    arrivalTime: data.arrivalTime,
    departureStationId: data.departureStationId,
    departureStationName: data.departureStationName,
    arrivalStationId: data.arrivalStationId,
    arrivalStationName: data.arrivalStationName,
    lineIds: data.lineIds,
    wasDelayed: data.wasDelayed,
    delayMinutes: data.delayMinutes,
    isManual: data.isManual,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: new Date(),
  })),
}));

describe('CommuteLogService', () => {
  const mockLogInput = {
    departureStationId: 'gangnam',
    departureStationName: '강남',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    lineIds: ['2'],
    departureTime: '08:30',
    arrivalTime: '09:00',
    wasDelayed: false,
  };

  const mockLogDoc = {
    id: 'log-123',
    data: () => ({
      date: '2024-01-15',
      dayOfWeek: 1,
      departureTime: '08:30',
      arrivalTime: '09:00',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: { toDate: () => new Date('2024-01-15T08:30:00') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCommute', () => {
    it('should log a commute successfully', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-log-id' });

      const result = await commuteLogService.logCommute('user-123', mockLogInput);

      expect(result.id).toBe('new-log-id');
      expect(result.departureStationName).toBe('강남');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should use current time if departure time not provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-log-id' });

      const inputWithoutTime = {
        ...mockLogInput,
        departureTime: undefined,
      };

      const result = await commuteLogService.logCommute('user-123', inputWithoutTime);

      expect(result.departureTime).toBe('08:30'); // mocked current time
    });
  });

  describe('getCommuteLogs', () => {
    it('should return commute logs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getCommuteLogs('user-123');

      expect(result).toHaveLength(1);
    });

    it('should filter by dayOfWeek', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getCommuteLogs('user-123', {
        dayOfWeek: 1 as DayOfWeek,
      });

      expect(result).toHaveLength(1);
    });

    it('should respect maxResults', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc, mockLogDoc],
      });

      await commuteLogService.getCommuteLogs('user-123', {
        maxResults: 10,
      });

      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('getRecentLogsForAnalysis', () => {
    it('should return recent logs', async () => {
      // Mock with today's date to pass the filter
      const todayLogDoc = {
        ...mockLogDoc,
        data: () => ({
          ...mockLogDoc.data(),
          date: new Date().toISOString().split('T')[0],
        }),
      };
      mockGetDocs.mockResolvedValue({
        docs: [todayLogDoc],
      });

      const result = await commuteLogService.getRecentLogsForAnalysis('user-123');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getLogsForDayOfWeek', () => {
    it('should return logs for specific day', async () => {
      // Mock with today's date to pass the filter
      const todayLogDoc = {
        ...mockLogDoc,
        data: () => ({
          ...mockLogDoc.data(),
          date: new Date().toISOString().split('T')[0],
        }),
      };
      mockGetDocs.mockResolvedValue({
        docs: [todayLogDoc],
      });

      const result = await commuteLogService.getLogsForDayOfWeek('user-123', 1 as DayOfWeek);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('updateLog', () => {
    it('should update log properties', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await commuteLogService.updateLog('user-123', 'log-123', {
        arrivalTime: '09:15',
        wasDelayed: true,
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteLog', () => {
    it('should delete a log', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await commuteLogService.deleteLog('user-123', 'log-123');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('hasLoggedToday', () => {
    it('should return true if logged today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.hasLoggedToday('user-123');

      expect(result).toBe(true);
    });

    it('should return false if not logged today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await commuteLogService.hasLoggedToday('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getTodayLog', () => {
    it('should return today\'s log if exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getTodayLog('user-123');

      expect(result).not.toBeNull();
    });

    it('should return null if no log today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await commuteLogService.getTodayLog('user-123');

      expect(result).toBeNull();
    });
  });

  describe('autoLogIfAppropriate', () => {
    it('should create new log for departure if no log today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });
      mockAddDoc.mockResolvedValue({ id: 'auto-log-id' });

      const result = await commuteLogService.autoLogIfAppropriate(
        'user-123',
        'gangnam',
        '강남',
        '2',
        'departure'
      );

      expect(result).not.toBeNull();
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should not create log if already logged today for departure', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.autoLogIfAppropriate(
        'user-123',
        'gangnam',
        '강남',
        '2',
        'departure'
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs', async () => {
      const mockDocRefs = [
        { ref: { id: 'old-log-1' } },
        { ref: { id: 'old-log-2' } },
      ];
      mockGetDocs.mockResolvedValue({
        docs: mockDocRefs,
      });
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await commuteLogService.cleanupOldLogs('user-123');

      expect(result).toBe(2);
    });

    it('should return 0 if no old logs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      });

      const result = await commuteLogService.cleanupOldLogs('user-123');

      expect(result).toBe(0);
    });
  });
});
