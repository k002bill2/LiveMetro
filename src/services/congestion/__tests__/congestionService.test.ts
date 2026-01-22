/**
 * Congestion Service Tests
 */

import { congestionService } from '../congestionService';
import { CongestionLevel } from '@/models/congestion';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockWriteBatch = {
  commit: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mockCollectionRef'),
  doc: jest.fn(() => 'mockDocRef'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ type: 'where', args })),
  orderBy: jest.fn((...args) => ({ type: 'orderBy', args })),
  limit: jest.fn((n) => ({ type: 'limit', value: n })),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
  writeBatch: () => mockWriteBatch,
}));

// Mock congestion model
jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
  TRAIN_CAR_COUNT: 10,
  REPORT_EXPIRATION_MINUTES: 15,
  calculateOverallCongestion: jest.fn(() => 'moderate'),
  generateSummaryId: jest.fn((lineId, direction, trainId) => `${lineId}_${direction}_${trainId}`),
  createEmptyCarCongestions: jest.fn(() =>
    Array.from({ length: 10 }, (_, i) => ({
      carNumber: i + 1,
      congestionLevel: 'low',
      reportCount: 0,
      lastUpdated: new Date(),
    }))
  ),
  fromCongestionReportDoc: jest.fn((id, data) => ({
    id,
    trainId: data.trainId,
    lineId: data.lineId,
    stationId: data.stationId,
    direction: data.direction,
    carNumber: data.carNumber,
    congestionLevel: data.congestionLevel,
    reporterId: data.reporterId,
    timestamp: data.timestamp?.toDate() || new Date(),
    expiresAt: data.expiresAt?.toDate() || new Date(),
  })),
  fromCongestionSummaryDoc: jest.fn((id, data) => ({
    id,
    trainId: data.trainId,
    lineId: data.lineId,
    direction: data.direction,
    cars: data.cars || [],
    overallLevel: data.overallLevel,
    reportCount: data.reportCount,
    lastUpdated: data.lastUpdated?.toDate() || new Date(),
  })),
}));

describe('CongestionService', () => {
  const mockReportInput = {
    trainId: 'train-123',
    lineId: '2',
    stationId: 'gangnam',
    direction: 'up' as const,
    carNumber: 5,
    congestionLevel: CongestionLevel.MODERATE,
  };

  const mockReportDoc = {
    id: 'report-123',
    data: () => ({
      trainId: 'train-123',
      lineId: '2',
      stationId: 'gangnam',
      direction: 'up',
      carNumber: 5,
      congestionLevel: 'moderate',
      reporterId: 'user-123',
      timestamp: { toDate: () => new Date('2024-01-15T08:30:00') },
      expiresAt: { toDate: () => new Date('2024-01-15T08:45:00') },
    }),
  };

  const mockSummaryDoc = {
    exists: () => true,
    data: () => ({
      trainId: 'train-123',
      lineId: '2',
      direction: 'up',
      cars: [],
      overallLevel: 'moderate',
      reportCount: 5,
      lastUpdated: { toDate: () => new Date('2024-01-15T08:30:00') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteBatch.commit.mockResolvedValue(undefined);
  });

  describe('submitReport', () => {
    it('should submit a congestion report', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-report-id' });
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await congestionService.submitReport(mockReportInput, 'user-123');

      expect(result.id).toBe('new-report-id');
      expect(result.trainId).toBe('train-123');
      expect(result.congestionLevel).toBe(CongestionLevel.MODERATE);
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should set expiration time', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-report-id' });
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await congestionService.submitReport(mockReportInput, 'user-123');

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt.getTime()).toBeGreaterThan(result.timestamp.getTime());
    });
  });

  describe('getTrainCongestion', () => {
    it('should return congestion summary for a train', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockSummaryDoc],
      });

      const result = await congestionService.getTrainCongestion('2', 'up', 'train-123');

      expect(result).not.toBeNull();
      expect(result?.trainId).toBe('train-123');
    });

    it('should return null if no summary exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await congestionService.getTrainCongestion('2', 'up', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getLineCongestion', () => {
    it('should return all congestion summaries for a line', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockSummaryDoc],
      });

      const result = await congestionService.getLineCongestion('2');

      expect(result).toHaveLength(1);
    });
  });

  describe('subscribeToTrainCongestion', () => {
    it('should set up snapshot listener', () => {
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation((_, cb) => {
        cb(mockSummaryDoc);
        return jest.fn();
      });

      const unsubscribe = congestionService.subscribeToTrainCongestion(
        '2',
        'up',
        'train-123',
        callback
      );

      expect(callback).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return null when document does not exist', () => {
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation((_, cb) => {
        cb({ exists: () => false });
        return jest.fn();
      });

      congestionService.subscribeToTrainCongestion('2', 'up', 'train-123', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('subscribeToLineCongestion', () => {
    it('should set up snapshot listener for line', () => {
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation((_, cb) => {
        cb({ docs: [mockSummaryDoc] });
        return jest.fn();
      });

      const unsubscribe = congestionService.subscribeToLineCongestion('2', callback);

      expect(callback).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getStationReports', () => {
    it('should return reports for a station', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockReportDoc],
      });

      const result = await congestionService.getStationReports('gangnam');

      expect(result).toHaveLength(1);
      expect(result[0]?.stationId).toBe('gangnam');
    });
  });

  describe('hasRecentReport', () => {
    it('should return true if user has recent report', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockReportDoc],
      });

      const result = await congestionService.hasRecentReport('user-123', 'train-123', 5);

      expect(result).toBe(true);
    });

    it('should return false if no recent report', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await congestionService.hasRecentReport('user-123', 'train-123', 5);

      expect(result).toBe(false);
    });
  });

  describe('getCarCongestionFromReports', () => {
    it('should return aggregated car congestion', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockReportDoc],
      });

      const result = await congestionService.getCarCongestionFromReports('2', 'up', 'train-123');

      expect(result).toHaveLength(10);
    });
  });

  describe('cleanupExpiredReports', () => {
    it('should delete expired reports', async () => {
      const mockDocRefs = [
        { ref: { id: 'report-1' } },
        { ref: { id: 'report-2' } },
      ];
      mockGetDocs.mockResolvedValue({
        empty: false,
        size: 2,
        docs: mockDocRefs,
      });

      const result = await congestionService.cleanupExpiredReports();

      expect(result).toBe(2);
    });

    it('should return 0 if no expired reports', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        size: 0,
        docs: [],
      });

      const result = await congestionService.cleanupExpiredReports();

      expect(result).toBe(0);
    });
  });
});
