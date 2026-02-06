/**
 * useMLPrediction Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { modelService, trainingService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { isPredictionReliable } from '@/models/ml';
import { useMLPrediction } from '../useMLPrediction';

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/ml', () => ({
  modelService: {
    initialize: jest.fn(),
    getMetadata: jest.fn(),
    predict: jest.fn(),
    clearCache: jest.fn(),
  },
  trainingService: {
    onProgress: jest.fn().mockReturnValue(jest.fn()),
  },
}));

jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn(),
  },
}));

jest.mock('@/models/ml', () => ({
  MIN_LOGS_FOR_ML_TRAINING: 10,
  isPredictionReliable: jest.fn(),
}));

jest.mock('@/models/pattern', () => ({
  getDayOfWeek: jest.fn().mockReturnValue('monday'),
}));

const mockUser = { id: 'user-1' };

describe('useMLPrediction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (modelService.initialize as jest.Mock).mockResolvedValue(true);
    (modelService.getMetadata as jest.Mock).mockReturnValue({ version: '1.0' });
    (modelService.predict as jest.Mock).mockResolvedValue({ confidence: 0.8 });
    (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
      { id: '1' }, { id: '2' }, { id: '3' },
    ]);
    (trainingService.onProgress as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should initialize model on mount', async () => {
    const { result } = renderHook(() => useMLPrediction());

    await waitFor(() => expect(result.current.isModelReady).toBe(true));

    expect(modelService.initialize).toHaveBeenCalled();
    expect(result.current.modelMetadata).toEqual({ version: '1.0' });
    expect(result.current.isTensorFlowReady).toBe(false);
  });

  it('should handle initialization error', async () => {
    (modelService.initialize as jest.Mock).mockRejectedValue(new Error('Init failed'));

    const { result } = renderHook(() => useMLPrediction());

    await waitFor(() => expect(result.current.error).toBe('Init failed'));
  });

  it('should load user logs', async () => {
    const { result } = renderHook(() => useMLPrediction());

    await waitFor(() => expect(result.current.logCount).toBe(3));

    expect(commuteLogService.getRecentLogsForAnalysis).toHaveBeenCalledWith('user-1');
  });

  it('should clear logs without user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useMLPrediction());

    await waitFor(() => expect(result.current.logCount).toBe(0));
  });

  it('should subscribe to training progress', () => {
    renderHook(() => useMLPrediction());

    expect(trainingService.onProgress).toHaveBeenCalled();
  });

  describe('refreshPrediction', () => {
    it('should refresh prediction', async () => {
      const mockPrediction = { confidence: 0.85, predictedDuration: 30 };
      (modelService.predict as jest.Mock).mockResolvedValue(mockPrediction);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      await act(async () => {
        await result.current.refreshPrediction();
      });

      await waitFor(() => {
        expect(result.current.prediction).toEqual(mockPrediction);
      });
    });

    it('should require login', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useMLPrediction());

      await act(async () => {
        await result.current.refreshPrediction();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should require model ready', async () => {
      (modelService.initialize as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(false));

      await act(async () => {
        await result.current.refreshPrediction();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle predict error', async () => {
      (modelService.predict as jest.Mock).mockRejectedValue(new Error('Predict failed'));

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      await act(async () => {
        await result.current.refreshPrediction();
      });

      expect(result.current.error).toBe('Predict failed');
    });
  });

  describe('trainModel', () => {
    it('should return error without user', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useMLPrediction());

      let trainingResult: { success?: boolean };
      await act(async () => {
        trainingResult = await result.current.trainModel();
      });

      expect(trainingResult!.success).toBe(false);
    });

    it('should return error with insufficient data', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([{ id: '1' }]);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.logCount).toBe(1));

      let trainingResult: { success?: boolean; error?: string };
      await act(async () => {
        trainingResult = await result.current.trainModel();
      });

      expect(trainingResult!.success).toBe(false);
      expect(trainingResult!.error).toContain('데이터가 부족');
    });

    it('should return disabled message with sufficient data', async () => {
      const mockLogs = Array.from({ length: 15 }, (_, i) => ({ id: `log-${i}` }));
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.logCount).toBe(15));

      let trainingResult: { success?: boolean; error?: string };
      await act(async () => {
        trainingResult = await result.current.trainModel();
      });

      expect(trainingResult!.success).toBe(false);
      expect(trainingResult!.error).toContain('비활성화');
    });
  });

  describe('getWeekPredictions', () => {
    it('should return predictions for 7 days', async () => {
      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      let predictions: unknown[];
      await act(async () => {
        predictions = await result.current.getWeekPredictions();
      });

      expect(predictions!).toHaveLength(7);
    });

    it('should handle individual day errors', async () => {
      // First call may happen from auto-prediction, so set up enough mocks
      (modelService.predict as jest.Mock).mockResolvedValue({ confidence: 0.7 });

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      // Now set up for the week predictions call
      (modelService.predict as jest.Mock).mockReset();
      let callCount = 0;
      (modelService.predict as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve({ confidence: 0.7 });
      });

      let predictions: unknown[];
      await act(async () => {
        predictions = await result.current.getWeekPredictions();
      });

      expect(predictions!).toHaveLength(7);
      expect(predictions![1]).toBeNull(); // 2nd call failed
    });
  });

  describe('clearCache', () => {
    it('should clear cache and prediction', async () => {
      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      act(() => {
        result.current.clearCache();
      });

      expect(modelService.clearCache).toHaveBeenCalled();
      expect(result.current.prediction).toBeNull();
    });
  });

  describe('checkReliability', () => {
    it('should return false without prediction', () => {
      const { result } = renderHook(() => useMLPrediction());

      expect(result.current.checkReliability()).toBe(false);
    });

    it('should delegate to isPredictionReliable', async () => {
      (isPredictionReliable as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.isModelReady).toBe(true));

      // Trigger auto-prediction
      await waitFor(() => expect(result.current.prediction).toBeTruthy());

      const reliable = result.current.checkReliability(0.7);
      expect(reliable).toBe(true);
    });
  });

  describe('hasEnoughData', () => {
    it('should return false with few logs', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([{ id: '1' }]);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.logCount).toBe(1));

      expect(result.current.hasEnoughData).toBe(false);
    });

    it('should return true with enough logs', async () => {
      const mockLogs = Array.from({ length: 15 }, (_, i) => ({ id: `${i}` }));
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useMLPrediction());

      await waitFor(() => expect(result.current.logCount).toBe(15));

      expect(result.current.hasEnoughData).toBe(true);
    });
  });
});
