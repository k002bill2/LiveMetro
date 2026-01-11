/**
 * Public Data Hook
 * Custom hook for fetching public data portal API data for station details
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { publicDataApi } from '@/services/api';
import type {
  AccessibilityInfo,
  ExitInfo,
  SubwayAlert,
} from '@/models/publicData';

// ============================================================================
// Types
// ============================================================================

interface UsePublicDataState {
  accessibility: AccessibilityInfo | null;
  exitInfo: ExitInfo[];
  alerts: SubwayAlert[];
  loading: boolean;
  error: string | null;
}

interface UsePublicDataOptions {
  enabled?: boolean;
  lineName?: string;
}

// ============================================================================
// Hook: usePublicDataForStation
// ============================================================================

/**
 * Fetches public data (accessibility, exits, alerts) for a station
 */
export function usePublicDataForStation(
  stationName: string,
  options: UsePublicDataOptions = {}
) {
  const { enabled = true, lineName } = options;

  const [state, setState] = useState<UsePublicDataState>({
    accessibility: null,
    exitInfo: [],
    alerts: [],
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!stationName || !enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch all data in parallel
      const [accessibilityResult, exitResult, alertsResult] = await Promise.allSettled([
        publicDataApi.getAccessibilityInfo(stationName),
        publicDataApi.getExitInfoGrouped(stationName),
        lineName
          ? publicDataApi.getAlertsByLine(lineName)
          : publicDataApi.getActiveAlerts(),
      ]);

      if (!mountedRef.current) return;

      // Extract results with fallbacks
      const accessibility =
        accessibilityResult.status === 'fulfilled' ? accessibilityResult.value : null;
      const exitInfo =
        exitResult.status === 'fulfilled' ? exitResult.value : [];
      const alerts =
        alertsResult.status === 'fulfilled' ? alertsResult.value : [];

      setState({
        accessibility,
        exitInfo,
        alerts,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (!mountedRef.current) return;

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch public data';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [stationName, enabled, lineName]);

  // Fetch on mount and when station changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ============================================================================
// Hook: useAccessibilityInfo
// ============================================================================

/**
 * Fetches accessibility info for a single station
 */
export function useAccessibilityInfo(stationName: string, enabled = true) {
  const [accessibility, setAccessibility] = useState<AccessibilityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stationName || !enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    publicDataApi
      .getAccessibilityInfo(stationName)
      .then((data) => {
        if (mounted) {
          setAccessibility(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch accessibility info');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [stationName, enabled]);

  return { accessibility, loading, error };
}

// ============================================================================
// Hook: useExitInfo
// ============================================================================

/**
 * Fetches exit landmarks for a station
 */
export function useExitInfo(stationName: string, enabled = true) {
  const [exitInfo, setExitInfo] = useState<ExitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stationName || !enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    publicDataApi
      .getExitInfoGrouped(stationName)
      .then((data) => {
        if (mounted) {
          setExitInfo(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch exit info');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [stationName, enabled]);

  return { exitInfo, loading, error };
}

// ============================================================================
// Hook: useSubwayAlerts
// ============================================================================

/**
 * Fetches active subway alerts, optionally filtered by line
 */
export function useSubwayAlerts(lineName?: string, enabled = true) {
  const [alerts, setAlerts] = useState<SubwayAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const fetchAlerts = lineName
      ? publicDataApi.getAlertsByLine(lineName)
      : publicDataApi.getActiveAlerts();

    fetchAlerts
      .then((data) => {
        if (mounted) {
          setAlerts(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [lineName, enabled]);

  return { alerts, loading, error };
}

export default usePublicDataForStation;
