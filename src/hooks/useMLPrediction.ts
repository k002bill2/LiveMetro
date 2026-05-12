/**
 * useMLPrediction Hook
 * Provides statistics-based commute predictions
 * TensorFlow is disabled - uses fallback predictions
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { modelService, trainingService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { weatherService } from '@/services/weather/weatherService';
import { useLocation } from '@/hooks/useLocation';
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
  /**
   * User's personal baseline commute duration in minutes.
   *
   * Average of actual durations from recent logs that have both
   * departureTime and arrivalTime. `null` when there are no usable logs.
   * Drives MLHeroCard's "평소보다 ±N분" delta pill.
   */
  baselineMinutes: number | null;
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
  // 자동 주입 weather. weatherService가 30분 캐싱하므로 mount + 위치 변경 시
  // 1회 호출이면 충분. 호출자가 PredictionOptions.weather를 명시하면 그 값을
  // 우선하여 override 가능.
  const [currentWeather, setCurrentWeather] = useState<WeatherCondition | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // useLocation은 위치 권한이 없거나 미허용이면 location=null. 그 경우
  // weatherService.getWeatherCondition()이 null 반환 → 자동 주입 안 됨,
  // ML은 modelService의 weather 기본값 'clear'로 동작 (graceful degrade).
  const { location } = useLocation();

  // Baseline = simple average of past actual commute durations (HH:mm pairs).
  // Wraps midnight to handle late-night commutes (23:55 → 00:20 = 25min).
  const baselineMinutes = useMemo<number | null>(() => {
    const MIN_PER_DAY = 24 * 60;
    const parse = (s?: string): number | null => {
      if (!s) return null;
      const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
      if (!m) return null;
      return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
    };
    const durations: number[] = [];
    for (const log of logs) {
      const d = parse(log.departureTime);
      const a = parse(log.arrivalTime);
      if (d === null || a === null) continue;
      const diff = ((a - d) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
      if (diff > 0) durations.push(diff);
    }
    if (durations.length === 0) return null;
    return durations.reduce((sum, n) => sum + n, 0) / durations.length;
  }, [logs]);

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

  // Auto-fetch weather condition for ML feature injection. weatherService는
  // 30분 internal cache + AsyncStorage 영속 캐시를 사용하므로 위치 변경 시
  // 호출해도 실제 네트워크 요청은 드물다. mount 시 한 번 initialize()로
  // 캐시 복원 후 location 기반으로 fetch.
  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async (): Promise<void> => {
      try {
        await weatherService.initialize();
        const coords = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : undefined;
        const data = await weatherService.getCurrentWeather(coords);
        if (!cancelled) {
          setCurrentWeather(data?.condition ?? null);
        }
      } catch {
        if (!cancelled) {
          setCurrentWeather(null);
        }
      }
    };
    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [location?.latitude, location?.longitude]);

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
        // 자동 weather 주입: 호출자가 options.weather를 명시했으면 그 값을
        // 우선하고, 아니면 currentWeather를 사용. modelService.predict는
        // weather 미제공 시 'clear'로 fallback하므로 currentWeather=null이어도
        // 안전 (graceful degrade).
        const mergedOptions: PredictionOptions = {
          ...(currentWeather !== null ? { weather: currentWeather } : {}),
          ...options,
        };
        const result = await modelService.predict(logs, targetDay, mergedOptions);
        setPrediction(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, isModelReady, logs, currentWeather]
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
    // 주간 예측 전체에 동일한 현재 weather 주입. 7일 후 날씨는 다를 수 있지만
    // weatherService.getForecast()로 일별 예측을 받는 건 별도 phase.
    // 현재는 "오늘 날씨가 이렇다는 가정 하의 주간 baseline" 의미.
    const weatherOptions = currentWeather !== null ? { weather: currentWeather } : undefined;

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = getDayOfWeek(date);

      try {
        const pred = await modelService.predict(logs, dayOfWeek, weatherOptions);
        predictions.push(pred);
      } catch {
        predictions.push(null);
      }
    }

    return predictions;
  }, [logs, currentWeather]);

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
    baselineMinutes,

    // Actions
    refreshPrediction,
    trainModel,
    getWeekPredictions,
    clearCache,
    checkReliability,
  };
}

export default useMLPrediction;
