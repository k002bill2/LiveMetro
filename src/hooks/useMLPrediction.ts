/**
 * useMLPrediction — separate prediction pipeline from useCommutePattern.
 * HomeScreen consumes this hook (MLPrediction shape); WeeklyPredictionScreen
 * consumes useCommutePattern (PredictedCommute shape, extended in
 * docs/superpowers/specs/2026-05-12-predicted-commute-model-extension-design.md §7.1).
 */
/**
 * useMLPrediction Hook
 * Provides statistics-based commute predictions
 * TensorFlow is disabled - uses fallback predictions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { modelService, trainingService } from '@/services/ml';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { averageCommuteDurationFor } from '@/services/pattern/commuteDuration';
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
   * User's personal baseline commute duration in minutes, for one leg.
   *
   * Average of measured durations from recent logs that ran exactly
   * `origin` → `destination` (matched by station name) and carry both
   * departureTime and arrivalTime. `null` when the leg is unresolved or has no
   * completed logs. Drives MLHeroCard's "평소보다 ±N분" delta pill.
   *
   * The leg is a required argument rather than an internal default: the two
   * directions of a commute are different populations, so any caller that
   * labels a number "출근" must ask for that leg explicitly.
   */
  baselineMinutesFor: (
    origin: string | undefined,
    destination: string | undefined
  ) => number | null;
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
  /** OD scope forwarded to modelService.predict — normally injected from the
   * hook-level route context, not per call. */
  originStationName?: string;
  destinationStationName?: string;
}

/**
 * Registered commute OD (station *names* — the id domains diverge across log
 * writers) that scopes fallback predictions to one leg. Optional and
 * half-tolerant: until both endpoints resolve, predictions stay route-less
 * and consumers must not treat them as OD-scoped.
 */
export interface MLPredictionRouteContext {
  originStationName?: string;
  destinationStationName?: string;
}

export type UseMLPredictionReturn = UseMLPredictionState & UseMLPredictionActions;

// ============================================================================
// Hook
// ============================================================================

export function useMLPrediction(route?: MLPredictionRouteContext): UseMLPredictionReturn {
  const { user } = useAuth();
  // Destructured to primitives so effect/callback deps track the names, not
  // the (possibly re-created) route object identity.
  const routeOrigin = route?.originStationName;
  const routeDestination = route?.destinationStationName;
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
  // Monotonic request generation: only the LATEST refreshPrediction call may
  // write prediction/error/loading. Without it, the initial route-less request
  // and the OD-scoped one issued when the route context resolves can return
  // out of order, letting the stale mixed-population result overwrite state.
  const requestGenerationRef = useRef(0);

  // useLocation은 위치 권한이 없거나 미허용이면 location=null. 그 경우
  // weatherService.getWeatherCondition()이 null 반환 → 자동 주입 안 됨,
  // ML은 modelService의 weather 기본값 'clear'로 동작 (graceful degrade).
  const { location } = useLocation();

  // Baseline = average of past *measured* commute durations, scoped to one
  // origin→destination leg. Callers must pass the leg they are labelling: a
  // round trip is not one population (real data: 산곡→선릉 ~69min vs 선릉→산곡
  // ~81min), so a leg-blind mean is wrong in both directions at once. Returns
  // null for an unresolved or unseen leg so the UI shows its honest empty state.
  const baselineMinutesFor = useCallback(
    (origin: string | undefined, destination: string | undefined): number | null =>
      averageCommuteDurationFor(logs, origin, destination),
    [logs]
  );

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
  // 좌표 원시값만 의존 — location 객체 identity 변경으로는 재요청하지 않는다.
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async (): Promise<void> => {
      try {
        await weatherService.initialize();
        const coords =
          latitude !== undefined && longitude !== undefined
            ? { latitude, longitude }
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
  }, [latitude, longitude]);

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

      const generation = ++requestGenerationRef.current;
      setLoading(true);
      setError(null);

      try {
        const targetDay = dayOfWeek ?? getDayOfWeek(new Date());
        // 자동 weather 주입: 호출자가 options.weather를 명시했으면 그 값을
        // 우선하고, 아니면 currentWeather를 사용. modelService.predict는
        // weather 미제공 시 'clear'로 fallback하므로 currentWeather=null이어도
        // 안전 (graceful degrade).
        // Route context는 all-or-nothing: 한쪽 역명만으로는 OD를 scope할 수
        // 없으므로 둘 다 해소됐을 때만 주입한다 (미해소 시 route-less 예측).
        const mergedOptions: PredictionOptions = {
          ...(currentWeather !== null ? { weather: currentWeather } : {}),
          ...(routeOrigin && routeDestination
            ? { originStationName: routeOrigin, destinationStationName: routeDestination }
            : {}),
          ...options,
        };
        const result = await modelService.predict(logs, targetDay, mergedOptions);
        if (generation !== requestGenerationRef.current) return;
        setPrediction(result);
      } catch (err) {
        if (generation !== requestGenerationRef.current) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        if (generation === requestGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [user?.id, isModelReady, logs, currentWeather, routeOrigin, routeDestination]
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

  // Auto-refresh prediction on mount and when logs change — and when the
  // route context resolves, so the OD-scoped prediction replaces the initial
  // route-less one. No `!loading` gate: skipping while a request is in flight
  // would DROP the OD-scoped refresh when the route resolves mid-request; the
  // generation guard in refreshPrediction makes overlapping requests safe.
  useEffect(() => {
    if (isModelReady && logs.length > 0) {
      refreshPrediction();
    }
  }, [isModelReady, logs.length, routeOrigin, routeDestination]); // eslint-disable-line react-hooks/exhaustive-deps

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
    baselineMinutesFor,

    // Actions
    refreshPrediction,
    trainModel,
    getWeekPredictions,
    clearCache,
    checkReliability,
  };
}

export default useMLPrediction;
