/**
 * Realtime Trains Hook
 * Custom hook for subscribing to real-time train data with error handling and caching
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  const updateState = useCallback((updates: Partial<UseRealtimeTrainsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Realtime trains error:', error);
    updateState({ 
      error, 
      loading: false 
    });
    
    if (onError) {
      onError(error);
    }
  }, [updateState, onError]);

  const handleDataReceived = useCallback((data: RealtimeTrainData | null) => {
    if (data) {
      updateState({
        trains: data.trains,
        loading: false,
        error: null,
        lastUpdated: data.lastUpdated,
        isStale: false,
      });

      retryCountRef.current = 0; // Reset retry count on successful data

      // Set up stale timer
      if (staleTimerRef.current) {
        clearTimeout(staleTimerRef.current);
      }
      
      staleTimerRef.current = setTimeout(() => {
        updateState({ isStale: true });
      }, staleTime);

      if (onDataReceived) {
        onDataReceived(data);
      }
    } else {
      // Handle retry logic
      retryCountRef.current++;
      
      if (retryCountRef.current >= retryAttempts) {
        handleError(`최대 재시도 횟수(${retryAttempts})에 도달했습니다.`);
      } else {
        updateState({ 
          error: `데이터 로드 실패, 재시도 중... (${retryCountRef.current}/${retryAttempts})` 
        });
      }
    }
  }, [updateState, handleError, onDataReceived, retryAttempts, staleTime]);

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

  return {
    ...state,
    refetch,
    unsubscribe,
    isRetrying: retryCountRef.current > 0 && retryCountRef.current < retryAttempts,
  };
};

/**
 * Hook for multiple stations real-time data
 */
export const useMultipleRealtimeTrains = (
  stationNames: string[],
  options: UseRealtimeTrainsOptions = {}
) => {
  const [stationsData, setStationsData] = useState<Record<string, UseRealtimeTrainsState>>({});

  const updateStationData = useCallback((stationName: string, data: Partial<UseRealtimeTrainsState>) => {
    setStationsData(prev => ({
      ...prev,
      [stationName]: {
        trains: [],
        loading: false,
        error: null,
        lastUpdated: null,
        isStale: false,
        ...prev[stationName],
        ...data,
      }
    }));
  }, []);

  // Initialize state for all stations
  useEffect(() => {
    const initialState: Record<string, UseRealtimeTrainsState> = {};
    stationNames.forEach(stationName => {
      initialState[stationName] = {
        trains: [],
        loading: true,
        error: null,
        lastUpdated: null,
        isStale: false,
      };
    });
    setStationsData(initialState);
  }, [stationNames]);

  // Create individual hooks for each station - moved outside component
  const stationHooks = useMemo(() => 
    stationNames.map(stationName => ({
      stationName,
      options: {
        ...options,
        onDataReceived: (data: RealtimeTrainData) => {
          updateStationData(stationName, {
            trains: data.trains,
            loading: false,
            error: null,
            lastUpdated: data.lastUpdated,
            isStale: false,
          });
          options.onDataReceived?.(data);
        },
        onError: (error: string) => {
          updateStationData(stationName, {
            error,
            loading: false,
          });
          options.onError?.(error);
        }
      }
    })), [stationNames, options, updateStationData]
  );

  const refetchAll = useCallback(() => {
    // In real implementation, you would call refetch on each station hook
    console.log('Refetching all station data');
  }, []);

  const unsubscribeAll = useCallback(() => {
    // In real implementation, you would call unsubscribe on each station hook
    console.log('Unsubscribing from all station data');
  }, []);

  const allLoading = Object.values(stationsData).some(data => data.loading);
  const hasErrors = Object.values(stationsData).some(data => data.error);
  const allStale = Object.values(stationsData).every(data => data.isStale);

  return {
    stationsData,
    allLoading,
    hasErrors,
    allStale,
    refetchAll,
    unsubscribeAll,
  };
};