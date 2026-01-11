/**
 * useMLPrediction Hook
 * Provides statistics-based commute predictions
 * TensorFlow is disabled - uses fallback predictions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { modelService, trainingService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import {
  MLPrediction,
  ModelMetadata,
  TrainingResult,
  WeatherCondition,
  MIN_LOGS_FOR_ML_TRAINING,
  isPredictionReliable,
} from '@/models/ml';
import { DayOfWeek, getDayOfWeek, CommuteLog } from '@/models/pattern';

// ============================================================================
// Types
// ============================================================================

export interface UseMLPredictionState {
  /** Current ML prediction */
  prediction: MLPrediction | null;
  /** Whether prediction is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Model metadata */
  modelMetadata: ModelMetadata | null;
  /** Whether model is ready */
  isModelReady: boolean;
  /** Whether TensorFlow is initialized (always false - disabled) */
  isTensorFlowReady: boolean;
  /** Training progress (0-1) */
  trainingProgress: number;
  /** Whether training is in progress */
  isTraining: boolean;
  /** Number of commute logs available */
  logCount: number;
  /** Whether enough data for ML training */
  hasEnoughData: boolean;
}

export interface UseMLPredictionActions {
  /** Refresh prediction for a specific day */
  refreshPrediction: (dayOfWeek?: DayOfWeek, options?: PredictionOptions) => Promise<void>;
  /** Train/fine-tune the model with user data */
  trainModel: () => Promise<TrainingResult>;
  /** Get predictions for the week */
  getWeekPredictions: () => Promise<(MLPrediction | null)[]>;
  /** Clear prediction cache */
  clearCache: () => void;
  /** Check if prediction is reliable */
  checkReliability: (minConfidence?: number) => boolean;
}

export interface PredictionOptions {
  weather?: WeatherCondition;
  isHoliday?: boolean;
  useCache?: boolean;
}

export type UseMLPredictionReturn = UseMLPredictionState & UseMLPredictionActions;

// ============================================================================
// Hook
// ============================================================================

export function useMLPrediction(): UseMLPredictionReturn {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<MLPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [logs, setLogs] = useState<CommuteLog[]>([]);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize model on mount (fallback mode)
  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        // Initialize model (fallback mode since TensorFlow is disabled)
        const modelReady = await modelService.initialize();
        setIsModelReady(modelReady);
        setModelMetadata(modelService.getMetadata());
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      }
    };

    initialize();

    // Subscribe to training progress (will always be idle since TensorFlow is disabled)
    unsubscribeRef.current = trainingService.onProgress((state) => {
      setIsTraining(state.isTraining);
      setTrainingProgress(state.progress);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Load user's commute logs
  useEffect(() => {
    if (!user?.id) {
      setLogs([]);
      setLogCount(0);
      return;
    }

    const loadLogs = async (): Promise<void> => {
      try {
        const userLogs = await commuteLogService.getRecentLogsForAnalysis(user.id);
        setLogs(userLogs);
        setLogCount(userLogs.length);
      } catch {
        setLogs([]);
        setLogCount(0);
      }
    };

    loadLogs();
  }, [user?.id]);

  // Refresh prediction
  const refreshPrediction = useCallback(
    async (dayOfWeek?: DayOfWeek, options: PredictionOptions = {}): Promise<void> => {
      if (!user?.id) {
        setError('로그인이 필요합니다');
        return;
      }

      if (!isModelReady) {
        setError('모델이 준비되지 않았습니다');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const targetDay = dayOfWeek ?? getDayOfWeek(new Date());
        const result = await modelService.predict(logs, targetDay, options);
        setPrediction(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, isModelReady, logs]
  );

  // Train model (disabled - returns error)
  const trainModel = useCallback(async (): Promise<TrainingResult> => {
    if (!user?.id) {
      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: 0,
        error: '로그인이 필요합니다',
      };
    }

    if (logs.length < MIN_LOGS_FOR_ML_TRAINING) {
      return {
        success: false,
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        durationMs: 0,
        error: `학습 데이터가 부족합니다. 최소 ${MIN_LOGS_FOR_ML_TRAINING}개의 통근 기록이 필요합니다.`,
      };
    }

    // TensorFlow is disabled - training not available
    return {
      success: false,
      epochsCompleted: 0,
      finalLoss: 1,
      validationAccuracy: 0,
      durationMs: 0,
      error: 'ML 학습이 비활성화되어 있습니다. 통계 기반 예측을 사용합니다.',
    };
  }, [user?.id, logs]);

  // Get predictions for the entire week
  const getWeekPredictions = useCallback(async (): Promise<(MLPrediction | null)[]> => {
    const predictions: (MLPrediction | null)[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = getDayOfWeek(date);

      try {
        const pred = await modelService.predict(logs, dayOfWeek);
        predictions.push(pred);
      } catch {
        predictions.push(null);
      }
    }

    return predictions;
  }, [logs]);

  // Clear cache
  const clearCache = useCallback((): void => {
    modelService.clearCache();
    setPrediction(null);
  }, []);

  // Check prediction reliability
  const checkReliability = useCallback(
    (minConfidence: number = 0.5): boolean => {
      if (!prediction) return false;
      return isPredictionReliable(prediction, minConfidence);
    },
    [prediction]
  );

  // Auto-refresh prediction on mount and when logs change
  useEffect(() => {
    if (isModelReady && logs.length > 0 && !loading) {
      refreshPrediction();
    }
  }, [isModelReady, logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    prediction,
    loading,
    error,
    modelMetadata,
    isModelReady,
    isTensorFlowReady: false, // Always false - TensorFlow is disabled
    trainingProgress,
    isTraining,
    logCount,
    hasEnoughData: logCount >= MIN_LOGS_FOR_ML_TRAINING,

    // Actions
    refreshPrediction,
    trainModel,
    getWeekPredictions,
    clearCache,
    checkReliability,
  };
}

export default useMLPrediction;
