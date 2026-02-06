/**
 * useCongestion Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useTrainCongestion,
  useLineCongestion,
  useCongestionReport,
  useCongestion,
} from '../useCongestion';
import { useAuth } from '@/services/auth/AuthContext';
import { CongestionLevel, TrainCongestionSummary } from '@/models/congestion';
import { congestionService } from '@/services/congestion/congestionService';

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

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  })),
}));

const mockCongestionService = congestionService as jest.Mocked<typeof congestionService>;
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
    expect(mockCongestionService.subscribeToTrainCongestion).not.toHaveBeenCalled();
  });

  it('should not load when trainId is empty', () => {
    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', '')
    );

    expect(result.current.loading).toBe(false);
    expect(mockCongestionService.subscribeToTrainCongestion).not.toHaveBeenCalled();
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

  it('should update congestion when subscription callback is called', () => {
    const mockSummary = createMockCongestionSummary('train-123');
    let subscriptionCallback: ((summary: TrainCongestionSummary) => void) | undefined;

    mockCongestionService.subscribeToTrainCongestion.mockImplementation(
      (_lineId, _direction, _trainId, callback) => {
        subscriptionCallback = callback;
        return jest.fn();
      }
    );

    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    act(() => {
      subscriptionCallback?.(mockSummary);
    });

    expect(result.current.congestion).toEqual(mockSummary);
    expect(result.current.loading).toBe(false);
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

  it('should resubscribe when parameters change', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToTrainCongestion.mockReturnValue(mockUnsubscribe);

    const { rerender } = renderHook(
      ({ lineId, direction, trainId }) =>
        useTrainCongestion(lineId, direction, trainId),
      {
        initialProps: { lineId: '2', direction: 'up' as const, trainId: 'train-123' },
      }
    );

    expect(mockCongestionService.subscribeToTrainCongestion).toHaveBeenCalledTimes(1);

    rerender({ lineId: '2', direction: 'down' as const, trainId: 'train-456' });

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockCongestionService.subscribeToTrainCongestion).toHaveBeenCalledTimes(2);
  });

  it('should provide refresh function', async () => {
    const mockSummary = createMockCongestionSummary('train-123');
    mockCongestionService.getTrainCongestion.mockResolvedValue(mockSummary);

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
    expect(result.current.congestion).toEqual(mockSummary);
  });

  it('should handle refresh error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockCongestionService.getTrainCongestion.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('혼잡도 정보를 불러오는데 실패했습니다');
    expect(result.current.loading).toBe(false);
    consoleError.mockRestore();
  });

  it('should not refresh when lineId or trainId is empty', async () => {
    const { result } = renderHook(() =>
      useTrainCongestion('', 'up', '')
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockCongestionService.getTrainCongestion).not.toHaveBeenCalled();
  });

  it('should clear error on successful refresh', async () => {
    const mockSummary = createMockCongestionSummary('train-123');
    mockCongestionService.getTrainCongestion
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(mockSummary);

    const { result } = renderHook(() =>
      useTrainCongestion('2', 'up', 'train-123')
    );

    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('혼잡도 정보를 불러오는데 실패했습니다');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.congestion).toEqual(mockSummary);

    consoleError.mockRestore();
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
    expect(mockCongestionService.subscribeToLineCongestion).not.toHaveBeenCalled();
  });

  it('should subscribe to line congestion updates', () => {
    renderHook(() => useLineCongestion('2'));

    expect(mockCongestionService.subscribeToLineCongestion).toHaveBeenCalledWith(
      '2',
      expect.any(Function)
    );
  });

  it('should update congestion when subscription callback is called', () => {
    const mockSummaries = [
      createMockCongestionSummary('train-1'),
      createMockCongestionSummary('train-2'),
    ];
    let subscriptionCallback: ((summaries: TrainCongestionSummary[]) => void) | undefined;

    mockCongestionService.subscribeToLineCongestion.mockImplementation(
      (_lineId, callback) => {
        subscriptionCallback = callback;
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useLineCongestion('2'));

    act(() => {
      subscriptionCallback?.(mockSummaries);
    });

    expect(result.current.congestion).toEqual(mockSummaries);
    expect(result.current.loading).toBe(false);
  });

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useLineCongestion('2'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should provide refresh function', async () => {
    const mockSummaries = [
      createMockCongestionSummary('train-1'),
      createMockCongestionSummary('train-2'),
    ];
    mockCongestionService.getLineCongestion.mockResolvedValue(mockSummaries);

    const { result } = renderHook(() => useLineCongestion('2'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockCongestionService.getLineCongestion).toHaveBeenCalledWith('2');
    expect(result.current.congestion).toEqual(mockSummaries);
  });

  it('should handle refresh error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockCongestionService.getLineCongestion.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useLineCongestion('2'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe('노선 혼잡도를 불러오는데 실패했습니다');
    consoleError.mockRestore();
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as ReturnType<typeof useAuth>);
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

    it('should return false for canSubmitReport when not logged in', async () => {
      const { result } = renderHook(() => useCongestionReport());

      let canSubmit: boolean = true;
      await act(async () => {
        canSubmit = await result.current.canSubmitReport('train-123', 1);
      });

      expect(canSubmit).toBe(false);
    });
  });

  describe('when user is logged in', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as unknown as ReturnType<typeof useAuth>);
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCongestionReport());

      expect(result.current.submitting).toBe(false);
      expect(result.current.lastReport).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should check if user can submit report', async () => {
      mockCongestionService.hasRecentReport.mockResolvedValue(false);

      const { result } = renderHook(() => useCongestionReport());

      let canSubmit: boolean = false;
      await act(async () => {
        canSubmit = await result.current.canSubmitReport('train-123', 1);
      });

      expect(canSubmit).toBe(true);
      expect(mockCongestionService.hasRecentReport).toHaveBeenCalledWith(
        mockUser.id,
        'train-123',
        1
      );
    });

    it('should return false when user has recent report', async () => {
      mockCongestionService.hasRecentReport.mockResolvedValue(true);

      const { result } = renderHook(() => useCongestionReport());

      let canSubmit: boolean = true;
      await act(async () => {
        canSubmit = await result.current.canSubmitReport('train-123', 1);
      });

      expect(canSubmit).toBe(false);
    });

    it('should handle error in canSubmitReport', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockCongestionService.hasRecentReport.mockRejectedValue(new Error('Check failed'));

      const { result } = renderHook(() => useCongestionReport());

      let canSubmit: boolean = true;
      await act(async () => {
        canSubmit = await result.current.canSubmitReport('train-123', 1);
      });

      expect(canSubmit).toBe(false);
      consoleError.mockRestore();
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
      expect(result.current.error).toBeNull();
    });

    it('should handle submit error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
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
      consoleError.mockRestore();
    });

    it('should return submitting false after completion', async () => {
      const mockReport = {
        id: 'report-1',
        trainId: 'train-123',
        lineId: '2',
        stationId: 'station-123',
        direction: 'up' as const,
        carNumber: 1,
        congestionLevel: CongestionLevel.MODERATE,
        reporterId: mockUser.id,
        timestamp: new Date(),
        expiresAt: new Date(),
      };

      mockCongestionService.submitReport.mockResolvedValue(mockReport);

      const { result } = renderHook(() => useCongestionReport());

      await act(async () => {
        await result.current.submitReport({
          trainId: 'train-123',
          lineId: '2',
          stationId: 'station-123',
          direction: 'up',
          carNumber: 1,
          congestionLevel: CongestionLevel.MODERATE,
        });
      });

      expect(result.current.submitting).toBe(false);
    });
  });
});

describe('useCongestion (combined hook)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(jest.fn());
    mockUseAuth.mockReturnValue({
      user: mockUser,
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('should initialize with default options', async () => {
    const { result } = renderHook(() => useCongestion());

    // With no lineId and autoSubscribe=true, loading is set to false immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trainCongestion).toBeNull();
    expect(result.current.lineCongestion).toEqual([]);
  });

  it('should subscribe to line congestion with autoSubscribe', () => {
    renderHook(() =>
      useCongestion({
        lineId: '2',
        autoSubscribe: true,
      })
    );

    expect(mockCongestionService.subscribeToLineCongestion).toHaveBeenCalledWith(
      '2',
      expect.any(Function)
    );
  });

  it('should not subscribe when autoSubscribe is false', () => {
    renderHook(() =>
      useCongestion({
        lineId: '2',
        autoSubscribe: false,
      })
    );

    expect(mockCongestionService.subscribeToLineCongestion).not.toHaveBeenCalled();
  });

  it('should update train and line congestion from subscription', () => {
    const mockSummaries = [
      createMockCongestionSummary('train-123'),
      createMockCongestionSummary('train-456'),
    ];

    let subscriptionCallback: ((summaries: TrainCongestionSummary[]) => void) | undefined;

    mockCongestionService.subscribeToLineCongestion.mockImplementation(
      (_lineId, callback) => {
        subscriptionCallback = callback;
        return jest.fn();
      }
    );

    const { result } = renderHook(() =>
      useCongestion({
        lineId: '2',
        trainId: 'train-123',
        direction: 'up',
        autoSubscribe: true,
      })
    );

    act(() => {
      subscriptionCallback?.(mockSummaries);
    });

    expect(result.current.lineCongestion).toEqual(mockSummaries);
    expect(result.current.trainCongestion).toEqual(mockSummaries[0]);
  });

  it('should submit report with options-provided values', async () => {
    const mockReport = {
      id: 'report-1',
      trainId: 'train-123',
      lineId: '2',
      stationId: 'station-123',
      direction: 'up' as const,
      carNumber: 1,
      congestionLevel: CongestionLevel.HIGH,
      reporterId: mockUser.id,
      timestamp: new Date(),
      expiresAt: new Date(),
    };

    mockCongestionService.submitReport.mockResolvedValue(mockReport);

    const { result } = renderHook(() =>
      useCongestion({
        lineId: '2',
        trainId: 'train-123',
        direction: 'up',
      })
    );

    await act(async () => {
      await result.current.submitReport({
        stationId: 'station-123',
        carNumber: 1,
        congestionLevel: CongestionLevel.HIGH,
      });
    });

    expect(mockCongestionService.submitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        trainId: 'train-123',
        lineId: '2',
        direction: 'up',
      }),
      mockUser.id
    );
  });

  it('should return error when required train info is missing', async () => {
    const { result } = renderHook(() => useCongestion({ lineId: '2' }));

    await act(async () => {
      await result.current.submitReport({
        stationId: 'station-123',
        carNumber: 1,
        congestionLevel: CongestionLevel.HIGH,
      });
    });

    expect(result.current.error).toBe('열차 정보가 필요합니다');
  });

  it('should refresh both train and line congestion', async () => {
    const mockTrainCongestion = createMockCongestionSummary('train-123');
    const mockLineCongestion = [mockTrainCongestion];

    mockCongestionService.getTrainCongestion.mockResolvedValue(mockTrainCongestion);
    mockCongestionService.getLineCongestion.mockResolvedValue(mockLineCongestion);

    const { result } = renderHook(() =>
      useCongestion({
        lineId: '2',
        trainId: 'train-123',
        direction: 'up',
      })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockCongestionService.getTrainCongestion).toHaveBeenCalled();
    expect(mockCongestionService.getLineCongestion).toHaveBeenCalled();
  });

  it('should unsubscribe and resubscribe on parameter change', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(mockUnsubscribe);

    const { rerender } = renderHook(
      ({ lineId }) => useCongestion({ lineId, autoSubscribe: true }),
      { initialProps: { lineId: '2' } }
    );

    expect(mockCongestionService.subscribeToLineCongestion).toHaveBeenCalledTimes(1);

    rerender({ lineId: '3' });

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockCongestionService.subscribeToLineCongestion).toHaveBeenCalledTimes(2);
  });

  it('should cleanup subscription on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockCongestionService.subscribeToLineCongestion.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() =>
      useCongestion({ lineId: '2', autoSubscribe: true })
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should check canSubmitReport with trainId', async () => {
    mockCongestionService.hasRecentReport.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useCongestion({
        lineId: '2',
        trainId: 'train-123',
        direction: 'up',
      })
    );

    let canSubmit: boolean = false;
    await act(async () => {
      canSubmit = await result.current.canSubmitReport(1);
    });

    expect(canSubmit).toBe(true);
    expect(mockCongestionService.hasRecentReport).toHaveBeenCalledWith(
      mockUser.id,
      'train-123',
      1
    );
  });

  it('should return false for canSubmitReport when no user', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() =>
      useCongestion({
        lineId: '2',
        trainId: 'train-123',
        direction: 'up',
      })
    );

    let canSubmit: boolean = true;
    await act(async () => {
      canSubmit = await result.current.canSubmitReport(1);
    });

    expect(canSubmit).toBe(false);
  });

  it('should return false for canSubmitReport when no trainId', async () => {
    const { result } = renderHook(() => useCongestion({ lineId: '2' }));

    let canSubmit: boolean = true;
    await act(async () => {
      canSubmit = await result.current.canSubmitReport(1);
    });

    expect(canSubmit).toBe(false);
  });
});
