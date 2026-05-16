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
import { fareService, getDiverseRoutes } from '@services/route';
import { resolveInternalStationId } from '@utils/stationIdResolver';

export interface CommuteRouteSummary {
  /** Number of transfers between origin and destination. */
  transferCount?: number;
  /** Count of station-to-station rides (excludes transfer-only segments). */
  stationCount?: number;
  /** Estimated fare in KRW (regular fare type). */
  fareKrw?: number;
  /** Estimated ride time in minutes from graph search (excludes walk). */
  rideMinutes?: number;
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
      if (__DEV__ && (fromStationId || toStationId)) {
        console.warn('[useCommuteRouteSummary] skipped — invalid id pair', {
          fromStationId,
          toStationId,
        });
      }
      return EMPTY;
    }
    // Storage layer (onboarding / Firestore) may persist Seoul Metro
    // station_cd codes ("0220", "3762") while the graph layer keys on
    // internal slugs ("seolleung", "s_ec82b0ea"). Normalize at the boundary
    // so the graph stays slug-only and callers don't have to know which
    // universe their ids came from.
    const fromSlug = resolveInternalStationId(fromStationId);
    const toSlug = resolveInternalStationId(toStationId);
    if (!fromSlug || !toSlug) {
      if (__DEV__) {
        console.warn('[useCommuteRouteSummary] unresolved station id', {
          fromStationId,
          toStationId,
          fromSlug,
          toSlug,
        });
      }
      return EMPTY;
    }
    if (fromSlug === toSlug) return EMPTY;
    try {
      // `getDiverseRoutes` runs Yen's K-shortest (K=15) then picks the
      // fastest path under MAX_ROUTE_TRANSFERS≤2 with a 1.5× time-gap cap.
      // This matches Naver's "최단시간" card semantics. Plain dijkstra (K=1)
      // misses 산곡↔선릉 강남구청-via path which only surfaces at K≥11 — see
      // memory note `Yen's signature-dedupe efficiency` (PR #91+#102).
      const route = getDiverseRoutes(fromSlug, toSlug)[0] ?? null;
      if (!route) {
        if (__DEV__) {
          console.warn('[useCommuteRouteSummary] getDiverseRoutes returned no path', {
            fromStationId,
            toStationId,
            fromSlug,
            toSlug,
          });
        }
        return EMPTY;
      }
      const stationCount = route.segments.filter((s) => !s.isTransfer).length;
      const fare = fareService.calculateFare(stationCount).totalFare;
      return {
        transferCount: route.transferCount,
        stationCount,
        fareKrw: fare,
        rideMinutes: route.totalMinutes,
        ready: true,
      };
    } catch (error) {
      if (__DEV__) {
        console.warn('[useCommuteRouteSummary] calculation threw', {
          fromStationId,
          toStationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return EMPTY;
    }
  }, [fromStationId, toStationId]);
}

export default useCommuteRouteSummary;
