/**
 * Realtime Trains Hook
 * Custom hook for subscribing to real-time train data with error handling and caching
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { dataManager, RealtimeTrainData } from '../services/data/dataManager';
import { Train } from '../models/train';

interface UseRealtimeTrainsState {
  trains: Train[];
  loading: boolean;
  error: string | null;
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
    onDataReceived
  } = options;

  const [state, setState] = useState<UseRealtimeTrainsState>({
    trains: [],
    loading: true,
    error: null,
    lastUpdated: null,
    isStale: false,
  });

  const retryCountRef = useRef(0);
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

  const handleError = useCallback((error: string) => {
    console.error('Realtime trains error:', error);
    updateState({
      error,
      loading: false
    });

    onErrorRef.current?.(error);
  }, [updateState]);

  const handleDataReceived = useCallback((data: RealtimeTrainData | null) => {
    if (data) {
      updateState({
        trains: data.trains,
        loading: false,
        error: null,
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
    } else {
      // Handle retry logic
      retryCountRef.current++;

      if (retryCountRef.current >= retryAttempts) {
        handleError(`최대 재시도 횟수(${retryAttempts})에 도달했습니다.`);
      } else {
        updateState({
          loading: false,
          error: `데이터 로드 실패, 재시도 중... (${retryCountRef.current}/${retryAttempts})`
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

    updateState({ loading: true, error: null });

    unsubscribeRef.current = dataManager.subscribeToRealtimeUpdates(
      stationName,
      handleDataReceived,
      refetchInterval
    );
  }, [enabled, stationName, handleDataReceived, refetchInterval, updateState]);

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
  // background/inactive → active 전환에서만 refetch 트리거.
  // Burst guard: 5초 내 fresh data가 있으면 refetch skip — 짧은 background→active
  // 전환(앱 스위처, push 알림 닫기)이 30s polling과 겹쳐 Seoul API rate budget을
  // 낭비하는 회귀 방지.
  useEffect(() => {
    if (!enabled) return;

    const BURST_GUARD_MS = 5000;
    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
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
