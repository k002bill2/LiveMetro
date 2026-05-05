/**
 * useCommuteRouteSummary — derive transfer/station/fare facts from a
 * pair of station IDs.
 *
 * Used by HomeScreen's CommuteRouteCard to populate the bottom fact grid
 * (환승 N회 / N개역 이동 / N원 요금) without bundling the heavyweight
 * AlternativeRoutes UI. Wraps `routeService.calculateRoute` (sync,
 * graph-based A*) and `fareService.calculateFare` (distance-based table
 * lookup); both are pure given station IDs, so the hook collapses to a
 * `useMemo` keyed on the input pair.
 *
 * Failure modes (returns `{ ready: false }` with no facts):
 *   - either station id missing
 *   - both ids equal (no journey)
 *   - graph search returns null (disconnected components)
 *   - any thrown error during calculation
 *
 * `stationCount` counts non-transfer segments — i.e. station-to-station
 * rides on the same line. A 2-segment route with one transfer counts
 * 1 station (the transfer leg itself contributes 0). For a typical
 * 8-stop morning commute through a single line the count is 8.
 */
import { useMemo } from 'react';
import { routeService } from '@services/route';
import { fareService } from '@services/route';

export interface CommuteRouteSummary {
  /** Number of transfers between origin and destination. */
  transferCount?: number;
  /** Count of station-to-station rides (excludes transfer-only segments). */
  stationCount?: number;
  /** Estimated fare in KRW (regular fare type). */
  fareKrw?: number;
  /**
   * False until both station ids are provided AND a route is found.
   * Consumers can use `ready` to gate fact-grid rendering.
   */
  ready: boolean;
}

const EMPTY: CommuteRouteSummary = { ready: false };

export function useCommuteRouteSummary(
  fromStationId?: string,
  toStationId?: string,
): CommuteRouteSummary {
  return useMemo<CommuteRouteSummary>(() => {
    if (!fromStationId || !toStationId || fromStationId === toStationId) {
      return EMPTY;
    }
    try {
      const route = routeService.calculateRoute(fromStationId, toStationId);
      if (!route) return EMPTY;
      const stationCount = route.segments.filter((s) => !s.isTransfer).length;
      const fare = fareService.calculateFare(stationCount).totalFare;
      return {
        transferCount: route.transferCount,
        stationCount,
        fareKrw: fare,
        ready: true,
      };
    } catch {
      // Calculation failures are non-fatal for HomeScreen — caller falls
      // back to hiding the fact grid. No console.error to keep the home
      // tab quiet on every render.
      return EMPTY;
    }
  }, [fromStationId, toStationId]);
}

export default useCommuteRouteSummary;
