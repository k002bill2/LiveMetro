/**
 * Alternative Routes Hook
 * Calculates and provides alternative routes when delays occur
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { routeService } from '@services/route';
import {
  Route,
  AlternativeRoute,
  AlternativeReason,
  AlternativeRouteOptions,
  DEFAULT_ALTERNATIVE_OPTIONS,
} from '@models/route';
import type { DelayInfo } from '@components/delays/DelayAlertBanner';

// ============================================================================
// Types
// ============================================================================

interface UseAlternativeRoutesOptions {
  /** Delay information from useDelayDetection */
  delays?: DelayInfo[];
  /** Maximum number of alternative routes to return */
  maxAlternatives?: number;
  /** Alternative route calculation options */
  routeOptions?: AlternativeRouteOptions;
  /** Auto-calculate when delays change */
  autoCalculate?: boolean;
}

interface UseAlternativeRoutesResult {
  /** Original route (if calculated) */
  originalRoute: Route | null;
  /** Alternative routes avoiding delayed lines */
  alternatives: AlternativeRoute[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Calculate alternative routes */
  calculate: (
    fromStationId: string,
    toStationId: string,
    reason?: AlternativeReason
  ) => Promise<void>;
  /** Clear calculated routes */
  clear: () => void;
  /** Check if any delayed lines affect the original route */
  hasAffectedRoute: boolean;
  /** Lines that are delayed and affect the route */
  affectedLineIds: string[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for calculating alternative routes when delays occur
 *
 * @example
 * ```tsx
 * const { delays } = useDelayDetection();
 * const {
 *   alternatives,
 *   calculate,
 *   hasAffectedRoute,
 * } = useAlternativeRoutes({ delays });
 *
 * // Calculate when user selects destination
 * await calculate('seoul', 'gangnam');
 *
 * // Show alternatives if route is affected
 * if (hasAffectedRoute) {
 *   navigation.navigate('AlternativeRoutes', { alternatives });
 * }
 * ```
 */
export function useAlternativeRoutes(
  options: UseAlternativeRoutesOptions = {}
): UseAlternativeRoutesResult {
  const {
    delays = [],
    maxAlternatives = 3,
    routeOptions = DEFAULT_ALTERNATIVE_OPTIONS,
    autoCalculate = false,
  } = options;

  // State
  const [originalRoute, setOriginalRoute] = useState<Route | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFrom, setCurrentFrom] = useState<string | null>(null);
  const [currentTo, setCurrentTo] = useState<string | null>(null);

  // Extract delayed line IDs
  const delayedLineIds = useMemo(() => {
    return delays.map(d => d.lineId);
  }, [delays]);

  // Check if original route uses any delayed lines
  const affectedLineIds = useMemo(() => {
    if (!originalRoute) return [];
    return originalRoute.lineIds.filter(lineId =>
      delayedLineIds.includes(lineId)
    );
  }, [originalRoute, delayedLineIds]);

  const hasAffectedRoute = affectedLineIds.length > 0;

  /**
   * Calculate routes
   */
  const calculate = useCallback(
    async (
      fromStationId: string,
      toStationId: string,
      reason: AlternativeReason = 'DELAY'
    ): Promise<void> => {
      if (!fromStationId || !toStationId) {
        setError('출발역과 도착역을 선택해주세요');
        return;
      }

      if (fromStationId === toStationId) {
        setError('출발역과 도착역이 같습니다');
        return;
      }

      setLoading(true);
      setError(null);
      setCurrentFrom(fromStationId);
      setCurrentTo(toStationId);

      try {
        // Calculate original route
        const original = routeService.calculateRoute(fromStationId, toStationId);
        if (!original) {
          setError('경로를 찾을 수 없습니다');
          setOriginalRoute(null);
          setAlternatives([]);
          return;
        }

        setOriginalRoute(original);

        // Find affected lines in original route
        const routeAffectedLines = original.lineIds.filter(lineId =>
          delayedLineIds.includes(lineId)
        );

        // If route is affected, calculate alternatives
        if (routeAffectedLines.length > 0) {
          const alts = routeService.findAlternativeRoutes(
            fromStationId,
            toStationId,
            routeAffectedLines,
            reason,
            routeOptions
          );

          // Sort by time difference and take top N
          const sortedAlts = alts
            .sort((a, b) => a.timeDifference - b.timeDifference)
            .slice(0, maxAlternatives);

          setAlternatives(sortedAlts);
        } else {
          setAlternatives([]);
        }
      } catch (err) {
        console.error('Error calculating alternative routes:', err);
        setError('대체 경로 계산 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    },
    [delayedLineIds, maxAlternatives, routeOptions]
  );

  /**
   * Clear all calculated routes
   */
  const clear = useCallback((): void => {
    setOriginalRoute(null);
    setAlternatives([]);
    setError(null);
    setCurrentFrom(null);
    setCurrentTo(null);
  }, []);

  // Auto-recalculate when delays change (if enabled and route exists)
  useEffect(() => {
    if (autoCalculate && currentFrom && currentTo && delays.length > 0) {
      calculate(currentFrom, currentTo);
    }
  }, [autoCalculate, currentFrom, currentTo, delays, calculate]);

  return {
    originalRoute,
    alternatives,
    loading,
    error,
    calculate,
    clear,
    hasAffectedRoute,
    affectedLineIds,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get delay reason from DelayInfo
 */
export function getDelayReason(delayInfo: DelayInfo): AlternativeReason {
  const reason = delayInfo.reason?.toLowerCase() || '';

  if (reason.includes('중단') || reason.includes('중지')) {
    return 'SUSPENSION';
  }
  if (reason.includes('혼잡')) {
    return 'CONGESTION';
  }
  return 'DELAY';
}

/**
 * Format route for display
 */
export function formatRouteDisplay(route: Route): string {
  if (route.segments.length === 0) return '';

  const firstSegment = route.segments[0];
  const lastSegment = route.segments[route.segments.length - 1];

  if (!firstSegment || !lastSegment) return '';

  return `${firstSegment.fromStationName} → ${lastSegment.toStationName}`;
}

/**
 * Get transfer stations from route
 */
export function getTransferStations(route: Route): string[] {
  return route.segments
    .filter(segment => segment.isTransfer)
    .map(segment => segment.toStationName);
}

export default useAlternativeRoutes;
