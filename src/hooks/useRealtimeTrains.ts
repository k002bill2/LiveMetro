/**
 * Realtime Trains Hook
 * Custom hook for subscribing to real-time train data with error handling and caching
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { dataManager, RealtimeTrainData } from '../services/data/dataManager';
import { Train } from '../models/train';

/**
 * 'quota' = every Seoul realtime key hit its daily cap (ERROR-337); nothing
 * succeeds until KST midnight, so retry counting is meaningless.
 * 'generic' = any other failure (null data, transient errors).
 */
export type RealtimeTrainsErrorKind = 'quota' | 'generic';

export const DAILY_QUOTA_ERROR_MESSAGE =
  '오늘 실시간 조회 한도를 모두 사용했어요. 실시간 도착정보는 자정에 다시 제공됩니다.';

// Structural check (not instanceof SeoulApiError): seoulSubwayApi is globally
// mocked in jest setup, and the flag is the contract dataManager forwards.
const isDailyQuotaExhausted = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { dailyQuotaExhausted?: unknown }).dailyQuotaExhausted === true;

interface UseRealtimeTrainsState {
  trains: Train[];
  loading: boolean;
  error: string | null;
  errorKind: RealtimeTrainsErrorKind | null;
  lastUpdated: Date | null;
  isStale: boolean;
}

interface UseRealtimeTrainsOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  retryAttempts?: number;
  onError?: (error: string) => void;
  onDataReceived?: (data: RealtimeTrainData) => void;
  /**
   * Keep polling while the app is backgrounded (default false — polling pauses
   * to save the shared daily Seoul API quota). Only route guidance needs this.
   */
  pollInBackground?: boolean;
}

/**
 * Hook for managing real-time train data subscriptions
 */
export const useRealtimeTrains = (
  stationName: string,
  options: UseRealtimeTrainsOptions = {}
) => {
  const {
    enabled = true,
    refetchInterval = 30000, // 30 seconds
    staleTime = 60000, // 1 minute
    retryAttempts = 3,
    onError,
    onDataReceived,
    pollInBackground = false,
  } = options;

  const [state, setState] = useState<UseRealtimeTrainsState>({
    trains: [],
    loading: true,
    error: null,
    errorKind: null,
    lastUpdated: null,
    isStale: false,
  });

  const retryCountRef = useRef(0);
  // Key of the error already logged / reported via onError. The dataManager
  // poll re-delivers the same failure every tick (#419: 985 log lines while the
  // daily quota was exhausted), so log + onError fire only on a state change.
  // Cleared when data arrives or stationName changes.
  const reportedErrorKeyRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Mirrors state.lastUpdated for the AppState listener — using state directly
  // would force the effect to re-subscribe on every data tick, churning the
  // dataManager polling interval.
  const lastFetchAtRef = useRef<number>(0);

  // Stash external callbacks in refs so the subscribe effect does NOT
  // re-run on every parent render. Inline callbacks from the parent
  // (`onDataReceived={(d) => ...}`) get a fresh reference each render —
  // including those in the effect's deps would cause subscribe / unsubscribe
  // to fire on every keystroke or unrelated state change, churning the
  // dataManager polling interval.
  //
  // useLayoutEffect (not useEffect) so the ref is updated synchronously
  // before any other effect in this render reads it. Plain useEffect would
  // leave a one-render lag under React 18 concurrent rendering.
  const onErrorRef = useRef(onError);
  const onDataReceivedRef = useRef(onDataReceived);
  useLayoutEffect(() => {
    onErrorRef.current = onError;
    onDataReceivedRef.current = onDataReceived;
  });

  const updateState = useCallback((updates: Partial<UseRealtimeTrainsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  const handleError = useCallback((error: string, kind: RealtimeTrainsErrorKind = 'generic') => {
    updateState({
      error,
      errorKind: kind,
      loading: false
    });

    const errorKey = `${kind}:${error}`;
    if (reportedErrorKeyRef.current === errorKey) return;
    reportedErrorKeyRef.current = errorKey;

    if (kind === 'quota') {
      console.warn('Realtime trains paused: daily Seoul API quota exhausted');
    } else {
      console.error('Realtime trains error:', error);
    }
    onErrorRef.current?.(error);
  }, [updateState]);

  const handleDataReceived = useCallback((data: RealtimeTrainData | null, error?: unknown) => {
    if (data) {
      reportedErrorKeyRef.current = null;
      updateState({
        trains: data.trains,
        loading: false,
        error: null,
        errorKind: null,
        lastUpdated: data.lastUpdated,
        isStale: false,
      });

      lastFetchAtRef.current = data.lastUpdated.getTime();
      retryCountRef.current = 0; // Reset retry count on successful data

      // Set up stale timer
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
      }

      staleTimerRef.current = setTimeout(() => {
        updateState({ isStale: true });
      }, staleTime) as unknown as NodeJS.Timeout;

      onDataReceivedRef.current?.(data);
    } else if (isDailyQuotaExhausted(error)) {
      // Not a retryable failure: reset retryCount so isRetrying is false even
      // after earlier generic failures.
      retryCountRef.current = 0;
      handleError(DAILY_QUOTA_ERROR_MESSAGE, 'quota');
    } else {
      // Handle retry logic
      retryCountRef.current++;

      if (retryCountRef.current >= retryAttempts) {
        handleError(`최대 재시도 횟수(${retryAttempts})에 도달했습니다.`);
      } else {
        updateState({
          loading: false,
          error: `데이터 로드 실패, 재시도 중... (${retryCountRef.current}/${retryAttempts})`,
          errorKind: 'generic',
        });
      }
    }
  }, [updateState, handleError, retryAttempts, staleTime]);

  const subscribe = useCallback(() => {
    if (!enabled || !stationName.trim()) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    updateState({ loading: true, error: null, errorKind: null });

    unsubscribeRef.current = pollInBackground
      ? dataManager.subscribeToRealtimeUpdates(
          stationName,
          handleDataReceived,
          refetchInterval,
          { keepPollingInBackground: true }
        )
      : dataManager.subscribeToRealtimeUpdates(stationName, handleDataReceived, refetchInterval);
  }, [enabled, stationName, handleDataReceived, refetchInterval, pollInBackground, updateState]);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    subscribe();
  }, [subscribe]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  // A new station gets its own first error logged. refetch() / AppState return
  // keep the key on purpose so a foreground return does not re-log the same failure.
  useEffect(() => {
    reportedErrorKeyRef.current = null;
  }, [stationName]);

  // Effect for managing subscription lifecycle
  useEffect(() => {
    subscribe();
    return unsubscribe;
  }, [subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  // AppState 복귀 시 강제 refresh — 백그라운드에 오래 있다가 돌아오면 폴링 타이머가
  // 죽거나 데이터가 stale 상태로 남아있어 도착 정보가 갱신되지 않는 증상을 해소.
  // 실제 'background'를 거친 뒤의 'active'에서만 1회 refetch 트리거 (iOS의
  // background→inactive→active 경유 포함). 'inactive'만 거친 깜빡임(제어 센터,
  // 앱 스위처 엿보기)은 무시 — arrivalService의 일시정지 정책과 같은 기준이며,
  // 매번 재구독해 폴링 interval 위상을 리셋하던 낭비를 막는다.
  // Burst guard: 5초 내 fresh data가 있으면 refetch skip — 짧은 background→active
  // 전환(앱 스위처, push 알림 닫기)이 30s polling과 겹쳐 Seoul API rate budget을
  // 낭비하는 회귀 방지.
  useEffect(() => {
    if (!enabled) return;

    const BURST_GUARD_MS = 5000;
    let wasBackgrounded = AppState.currentState === 'background';
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        wasBackgrounded = true;
        return;
      }
      if (nextState === 'active' && wasBackgrounded) {
        wasBackgrounded = false;
        const sinceLastFetch = Date.now() - lastFetchAtRef.current;
        if (sinceLastFetch < BURST_GUARD_MS) {
          return;
        }
        refetch();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, refetch]);

  return {
    ...state,
    refetch,
    unsubscribe,
    isRetrying: retryCountRef.current > 0 && retryCountRef.current < retryAttempts,
  };
};

// Future: useMultipleRealtimeTrains helper can be reintroduced when multi-station support ships.
