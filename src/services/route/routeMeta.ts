/**
 * Derived metadata for a routed Route — direction, walking time estimate, and
 * fare estimate. Currently a mix of graph-derived (direction) and heuristic
 * stub (fare/walking) values; replace stubs with real sources when the
 * fare-calculation/distance pipelines land.
 */
import { LINE_STATIONS, STATIONS } from '@/utils/subwayMapData';
import type { Route } from '@/models/route';
import { fareService } from './fareService';

/**
 * Origin walk + destination walk + ~1 min per transfer. Real walking time
 * needs station-exit-to-platform measurements which we don't have yet.
 */
export const estimateWalkingMinutes = (route: Route): number => {
  return 6 + route.transferCount;
};

/**
 * Regular-type fare (KRW) for a route via the distance-based {@link fareService}.
 *
 * Station count = non-transfer hops + 1 (a transfer reuses the same station,
 * so transfer segments must NOT inflate the count). `fareService` estimates
 * distance as `(stationCount - 1) * 1.2km` and applies the Seoul Metro 2024
 * tiered surcharge. This replaces the former hop-bucket stub — distance-based
 * tiers are more accurate near the 10km base-fare boundary and unify the app
 * on a single fare source. Drives the 'min-fare' sort tab.
 */
export const deriveFare = (route: Route): number => {
  const hopCount = route.segments.filter(s => !s.isTransfer).length;
  const stationCount = hopCount + 1;
  return fareService.calculateFare(stationCount, 'regular').totalFare;
};

/**
 * Direction (방면) for one train leg on a line — the line's endpoint station
 * name in the direction of travel, or null when either station is not on a
 * single operational subarray of the line. Branched lines have multiple
 * subarrays; direction is meaningful only within one of them.
 */
export const getLegDirection = (
  lineId: string,
  fromStationId: string,
  toStationId: string
): string | null => {
  const segments = LINE_STATIONS[lineId];
  if (!segments || segments.length === 0) return null;
  for (const stations of segments) {
    const fromIdx = stations.indexOf(fromStationId);
    const toIdx = stations.indexOf(toStationId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) continue;
    const endpointId =
      toIdx > fromIdx ? stations[stations.length - 1] : stations[0];
    if (!endpointId) return null;
    return STATIONS[endpointId]?.name ?? null;
  }
  return null;
};

/**
 * Direction (방면) for a single-leg route — the line's endpoint station name
 * in the direction of travel. Returns null for transfer routes (caller is
 * expected to skip the inline detail in that case).
 */
export const getRouteDirection = (route: Route): string | null => {
  if (route.transferCount > 0 || route.segments.length === 0) return null;
  const firstTrain = route.segments.find(s => !s.isTransfer);
  if (!firstTrain) return null;
  return getLegDirection(firstTrain.lineId, firstTrain.fromStationId, firstTrain.toStationId);
};
