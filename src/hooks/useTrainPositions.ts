/**
 * Real-time train positions hook (Seoul `realtimePosition` API).
 *
 * Polls the whole-line position feed at a 30s minimum interval (the service
 * layer's RateLimiter is the second line of defense), with AppState
 * foreground-resume refetch + burst guard, and a module-level last-success
 * cache so transient API failures degrade to stale data instead of an empty
 * screen (project error policy).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';
import { toSeoulApiLineName } from '@/utils/formatUtils';
import type { TrainPosition } from '@/models/trainPosition';

interface UseTrainPositionsState {
  positions: TrainPosition[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  /** True when `positions` came from the fallback cache, not a live fetch. */
  isStale: boolean;
}

interface UseTrainPositionsOptions {
  /** Gate polling on screen focus — pass `useIsFocused()` from the screen. */
  enabled?: boolean;
  /** Poll interval in ms; clamped to the 30s Seoul API minimum. */
  refetchInterval?: number;
}

const MIN_POLL_INTERVAL_MS = 30000;
const BURST_GUARD_MS = 5000;

/** Last successful result per lineId — survives unmount for cache fallback. */
const lastSuccessCache = new Map<string, { positions: TrainPosition[]; at: Date }>();

export const useTrainPositions = (
  lineId: string,
  options: UseTrainPositionsOptions = {}
): UseTrainPositionsState & { refetch: () => void; unsupported: boolean } => {
  const { enabled = true, refetchInterval = MIN_POLL_INTERVAL_MS } = options;
  const pollInterval = Math.max(refetchInterval, MIN_POLL_INTERVAL_MS);

  // null = the Seoul realtimePosition API does not cover this line; calling
  // anyway returns INFO-200 (or worse, a digit-extracted wrong line name).
  const apiLineName = lineId ? toSeoulApiLineName(lineId) : null;

  const [state, setState] = useState<UseTrainPositionsState>({
    positions: [],
    loading: true,
    error: null,
    lastUpdated: null,
    isStale: false,
  });

  const mountedRef = useRef(true);
  const lastFetchAtRef = useRef(0);

  const fetchPositions = useCallback(async (): Promise<void> => {
    if (apiLineName === null) return;
    try {
      const rows = await seoulSubwayApi.getRealtimePosition(apiLineName);
      const positions = rows.map((row) => seoulSubwayApi.convertToTrainPosition(row));
      const at = new Date();
      lastSuccessCache.set(lineId, { positions, at });
      lastFetchAtRef.current = at.getTime();
      if (!mountedRef.current) return;
      setState({ positions, loading: false, error: null, lastUpdated: at, isStale: false });
    } catch (error) {
      console.error('Train positions fetch failed:', error);
      if (!mountedRef.current) return;
      const cached = lastSuccessCache.get(lineId);
      setState({
        positions: cached?.positions ?? [],
        loading: false,
        error: '열차 위치를 불러오지 못했습니다',
        lastUpdated: cached?.at ?? null,
        isStale: cached != null,
      });
    }
  }, [lineId, apiLineName]);

  const refetch = useCallback(() => {
    if (apiLineName === null) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetchPositions();
  }, [fetchPositions, apiLineName]);

  // Polling lifecycle — gated on `enabled` (screen focus) per the inactive
  // screen polling rule; interval + mounted flag cleaned up on unmount.
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !lineId || apiLineName === null) {
      setState((prev) => ({ ...prev, loading: false }));
      return undefined;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetchPositions();

    const intervalId = setInterval(() => {
      void fetchPositions();
    }, pollInterval);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [enabled, lineId, apiLineName, pollInterval, fetchPositions]);

  // Foreground-resume refetch with burst guard (mirrors useRealtimeTrains).
  useEffect(() => {
    if (!enabled) return undefined;

    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        if (Date.now() - lastFetchAtRef.current < BURST_GUARD_MS) return;
        void fetchPositions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, fetchPositions]);

  return { ...state, unsupported: apiLineName === null && lineId !== '', refetch };
};
