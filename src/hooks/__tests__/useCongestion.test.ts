/**
 * useCongestion Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import {
  useTrainCongestion,
  useLineCongestion,
  useCongestionReport,
} from '../useCongestion';
import { useAuth } from '@/services/auth/AuthContext';
import { CongestionLevel, TrainCongestionSummary } from '@/models/congestion';

// Import the mocked service
import { congestionService as importedCongestionService } from '@/services/congestion/congestionService';

// Mock congestionService with explicit implementation
jest.mock('@/services/congestion/congestionService', () => ({
  congestionService: {
    getTrainCongestion: jest.fn(),
    getLineCongestion: jest.fn(),
    subscribeToTrainCongestion: jest.fn(() => jest.fn()),
    subscribeToLineCongestion: jest.fn(() => jest.fn()),
    submitReport: jest.fn(),
    hasRecentReport: jest.fn(),
  },
}));
jest.mock('@/services/auth/AuthContext');
const mockCongestionService = importedCongestionService as jest.Mocked<typeof importedCongestionService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = { id: 'user-123', email: 'test@test.com' };

const createMockCongestionSummary = (trainId: string): TrainCongestionSummary => ({
  id: `summary-${trainId}`,
  trainId,
  lineId: '2',
  direction: 'up' as const,
  overallLevel: CongestionLevel.MODERATE,
  cars: [
    { carNumber: 1, congestionLevel: CongestionLevel.LOW, reportCount: 5, lastUpdated: new Date() },
    { carNumber: 2, congestionLevel: CongestionLevel.MODERATE, reportCount: 3, lastUpdated: new Date() },
  ],
  reportCount: 8,
  lastUpdated: new Date(),
});

describe('useTrainCongestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCongestionService.subscribeToTrainCongestion.mockReturnValue(jest.fn());
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.congestion).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should not load when lineId is empty', () => {
    const { result } = renderHook(() =>
      useTrainCongestion('', 'up', 'train-123')
    );

    expect(result.current.loading).toBe(false);
  });

  it('should not load when trainId is empty', () => {
    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', '')
    );

    expect(result.current.loading).toBe(false);
  });

  it('should subscribe to train congestion updates', () => {
    renderHook(() => useTrainCongestion('2', 'up', 'train-123'));

    expect(mockCongestionService.subscribeToTrainCongestion).toHaveBeenCalledWith(
      '2',
      'up',
      'train-123',
      expect.any(Function)
    );
  });

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToTrainCongestion.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should provide refresh function', async () => {
    mockCongestionService.getTrainCongestion.mockResolvedValue(
      createMockCongestionSummary('train-123')
    );

    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockCongestionService.getTrainCongestion).toHaveBeenCalledWith(
      '2',
      'up',
      'train-123'
    );
  });

  it('should handle refresh error', async () => {
    mockCongestionService.getTrainCongestion.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('혼잡도 정보를 불러오는데 실패했습니다');
  });
});

describe('useLineCongestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(jest.fn());
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useLineCongestion('2'));

    expect(result.current.loading).toBe(true);
    expect(result.current.congestion).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should not load when lineId is empty', () => {
    const { result } = renderHook(() => useLineCongestion(''));

    expect(result.current.loading).toBe(false);
  });

  it('should subscribe to line congestion updates', () => {
    renderHook(() => useLineCongestion('2'));

    expect(mockCongestionService.subscribeToLineCongestion).toHaveBeenCalledWith(
      '2',
      expect.any(Function)
    );
  });

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useLineCongestion('2'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should provide refresh function', async () => {
    mockCongestionService.getLineCongestion.mockResolvedValue([
      createMockCongestionSummary('train-1'),
      createMockCongestionSummary('train-2'),
    ]);

    const { result } = renderHook(() => useLineCongestion('2'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockCongestionService.getLineCongestion).toHaveBeenCalledWith('2');
  });

  it('should handle refresh error', async () => {
    mockCongestionService.getLineCongestion.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useLineCongestion('2'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('노선 혼잡도를 불러오는데 실패했습니다');
  });
});

describe('useCongestionReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when user is not logged in', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: jest.fn(),
        signOut: jest.fn(),
        signInAnonymously: jest.fn(),
        signUp: jest.fn(),
      } as any);
    });

    it('should return error when trying to submit without login', async () => {
      const { result } = renderHook(() => useCongestionReport());

      let report;
      await act(async () => {
        report = await result.current.submitReport({
          trainId: 'train-123',
          lineId: '2',
          stationId: 'station-123',
          direction: 'up',
          carNumber: 1,
          congestionLevel: CongestionLevel.MODERATE,
        });
      });

      expect(report).toBeNull();
      expect(result.current.error).toBe('로그인이 필요합니다');
    });
  });

  describe('when user is logged in', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: jest.fn(),
        signOut: jest.fn(),
        signInAnonymously: jest.fn(),
        signUp: jest.fn(),
      } as any);
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCongestionReport());

      expect(result.current.submitting).toBe(false);
      expect(result.current.lastReport).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should provide submitReport function', () => {
      const { result } = renderHook(() => useCongestionReport());

      expect(typeof result.current.submitReport).toBe('function');
    });

    it('should provide canSubmitReport function', () => {
      const { result } = renderHook(() => useCongestionReport());

      expect(typeof result.current.canSubmitReport).toBe('function');
    });

    it('should check if user can submit report', async () => {
      mockCongestionService.hasRecentReport.mockResolvedValue(false); // false means can submit

      const { result } = renderHook(() => useCongestionReport());

      const canSubmit = await result.current.canSubmitReport('train-123', 1);

      expect(canSubmit).toBe(true);
      expect(mockCongestionService.hasRecentReport).toHaveBeenCalledWith(
        mockUser.id,
        'train-123',
        1
      );
    });

    it('should submit report successfully', async () => {
      const now = new Date();
      const mockReport = {
        id: 'report-1',
        trainId: 'train-123',
        lineId: '2',
        stationId: 'station-123',
        direction: 'up' as const,
        carNumber: 1,
        congestionLevel: CongestionLevel.MODERATE,
        reporterId: mockUser.id,
        timestamp: now,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      };

      mockCongestionService.submitReport.mockResolvedValue(mockReport);

      const { result } = renderHook(() => useCongestionReport());

      let report;
      await act(async () => {
        report = await result.current.submitReport({
          trainId: 'train-123',
          lineId: '2',
          stationId: 'station-123',
          direction: 'up',
          carNumber: 1,
          congestionLevel: CongestionLevel.MODERATE,
        });
      });

      expect(report).toEqual(mockReport);
      expect(result.current.lastReport).toEqual(mockReport);
    });

    it('should handle submit error', async () => {
      mockCongestionService.submitReport.mockRejectedValue(new Error('Submit failed'));

      const { result } = renderHook(() => useCongestionReport());

      let report;
      await act(async () => {
        report = await result.current.submitReport({
          trainId: 'train-123',
          lineId: '2',
          stationId: 'station-123',
          direction: 'up',
          carNumber: 1,
          congestionLevel: CongestionLevel.MODERATE,
        });
      });

      expect(report).toBeNull();
      expect(result.current.error).toBe('혼잡도 제보에 실패했습니다');
    });
  });
});
