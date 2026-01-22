/**
 * Delay Report Service Tests
 */

import { delayReportService } from '../delayReportService';
import { ReportType, ReportSeverity } from '@/models/delayReport';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mockCollectionRef'),
  doc: jest.fn(() => 'mockDocRef'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ type: 'where', args })),
  orderBy: jest.fn((...args) => ({ type: 'orderBy', args })),
  limit: jest.fn((n) => ({ type: 'limit', value: n })),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
  arrayUnion: jest.fn((val) => ({ type: 'arrayUnion', value: val })),
  arrayRemove: jest.fn((val) => ({ type: 'arrayRemove', value: val })),
  increment: jest.fn((val) => ({ type: 'increment', value: val })),
}));

describe('DelayReportService', () => {
  const mockReportInput = {
    userId: 'user-123',
    userDisplayName: '테스트유저',
    lineId: '2',
    stationId: '0222',
    stationName: '강남',
    reportType: ReportType.DELAY,
    severity: ReportSeverity.MEDIUM,
    description: '열차 지연 발생',
    estimatedDelayMinutes: 10,
  };

  const mockReportDoc = {
    id: 'report-123',
    data: () => ({
      userId: 'user-123',
      userDisplayName: '테스트유저',
      lineId: '2',
      stationId: '0222',
      stationName: '강남',
      reportType: ReportType.DELAY,
      severity: ReportSeverity.MEDIUM,
      description: '열차 지연 발생',
      estimatedDelayMinutes: 10,
      timestamp: { toDate: () => new Date('2024-01-15T08:30:00') },
      upvotes: 5,
      upvotedBy: ['user-1', 'user-2'],
      verified: false,
      active: true,
      updatedAt: { toDate: () => new Date('2024-01-15T08:30:00') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitReport', () => {
    it('should submit a new delay report', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-report-id' });

      const result = await delayReportService.submitReport(mockReportInput);

      expect(result.id).toBe('new-report-id');
      expect(result.lineId).toBe('2');
      expect(result.stationName).toBe('강남');
      expect(result.reportType).toBe(ReportType.DELAY);
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-report-id' });

      const minimalInput = {
        userId: 'user-123',
        lineId: '2',
        stationId: '0222',
        stationName: '강남',
        reportType: ReportType.DELAY,
      };

      const result = await delayReportService.submitReport(minimalInput);

      expect(result.userDisplayName).toBe('익명');
      expect(result.severity).toBe(ReportSeverity.MEDIUM);
    });
  });

  describe('getLineReports', () => {
    it('should return reports for a specific line', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockReportDoc],
      });

      const result = await delayReportService.getLineReports('2');

      expect(result).toHaveLength(1);
      expect(result[0]?.lineId).toBe('2');
    });

    it('should respect maxResults parameter', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await delayReportService.getLineReports('2', 10);

      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('getActiveReports', () => {
    it('should return all active reports', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockReportDoc],
      });

      const result = await delayReportService.getActiveReports();

      expect(result).toHaveLength(1);
      expect(result[0]?.active).toBe(true);
    });
  });

  describe('subscribeToLineReports', () => {
    it('should set up snapshot listener', () => {
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation((_, cb) => {
        cb({ docs: [mockReportDoc] });
        return jest.fn();
      });

      const unsubscribe = delayReportService.subscribeToLineReports('2', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Array));
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('subscribeToActiveReports', () => {
    it('should set up snapshot listener for all active reports', () => {
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation((_, cb) => {
        cb({ docs: [mockReportDoc] });
        return jest.fn();
      });

      const unsubscribe = delayReportService.subscribeToActiveReports(callback);

      expect(callback).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('upvoteReport', () => {
    it('should increment upvote count', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await delayReportService.upvoteReport('report-123', 'user-456');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('removeUpvote', () => {
    it('should decrement upvote count', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await delayReportService.removeUpvote('report-123', 'user-456');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('resolveReport', () => {
    it('should mark report as inactive', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await delayReportService.resolveReport('report-123');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteReport', () => {
    it('should delete report from firestore', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await delayReportService.deleteReport('report-123');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('getLineSummaries', () => {
    it('should return summaries grouped by line', async () => {
      const docs = [
        mockReportDoc,
        {
          id: 'report-456',
          data: () => ({
            ...mockReportDoc.data(),
            lineId: '3',
          }),
        },
      ];
      mockGetDocs.mockResolvedValue({ docs });

      const result = await delayReportService.getLineSummaries();

      expect(result.length).toBeGreaterThan(0);
    });

    it('should calculate total upvotes per line', async () => {
      const docs = [
        {
          id: 'report-1',
          data: () => ({
            ...mockReportDoc.data(),
            upvotes: 5,
          }),
        },
        {
          id: 'report-2',
          data: () => ({
            ...mockReportDoc.data(),
            upvotes: 3,
          }),
        },
      ];
      mockGetDocs.mockResolvedValue({ docs });

      const result = await delayReportService.getLineSummaries();

      const line2Summary = result.find(s => s.lineId === '2');
      expect(line2Summary?.totalUpvotes).toBe(8);
    });
  });

  describe('hasRecentReport', () => {
    it('should return true if user has recent report', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockReportDoc],
      });

      const result = await delayReportService.hasRecentReport('user-123', '2');

      expect(result).toBe(true);
    });

    it('should return false if no recent report', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await delayReportService.hasRecentReport('user-123', '2');

      expect(result).toBe(false);
    });
  });
});
