/**
 * Derived metadata for a routed Route — direction, walking time estimate, and
 * fare estimate. Currently a mix of graph-derived (direction) and heuristic
 * stub (fare/walking) values; replace stubs with real sources when the
 * fare-calculation/distance pipelines land.
 */
import { LINE_STATIONS, STATIONS } from '@/utils/subwayMapData';
import type { Route } from '@/models/route';

/**
 * Origin walk + destination walk + ~1 min per transfer. Real walking time
 * needs station-exit-to-platform measurements which we don't have yet.
 */
export const estimateWalkingMinutes = (route: Route): number => {
  return 6 + route.transferCount;
};

/**
 * Stub matching Seoul Metro 2024 fare structure (1,400 base + tier per
 * traveled distance). We approximate distance with hop count because many
 * graph nodes still lack coordinates.
 */
export const estimateFare = (route: Route): number => {
  const hopCount = route.segments.filter(s => !s.isTransfer).length;
  if (hopCount <= 10) return 1400;
  if (hopCount <= 20) return 1500;
  if (hopCount <= 30) return 1700;
  return 1900;
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
  const segments = LINE_STATIONS[firstTrain.lineId];
  if (!segments || segments.length === 0) return null;
  // Find the subarray containing both endpoints — direction is meaningful
  // only within a single operational segment of the line. Branched lines
  // have multiple subarrays; cross-subarray legs would imply a transfer
  // (already filtered above by transferCount === 0 guard).
  for (const stations of segments) {
    const fromIdx = stations.indexOf(firstTrain.fromStationId);
    const toIdx = stations.indexOf(firstTrain.toStationId);
    if (fromIdx === -1 || toIdx === -1) continue;
    const endpointId =
      toIdx > fromIdx ? stations[stations.length - 1] : stations[0];
    if (!endpointId) return null;
    return STATIONS[endpointId]?.name ?? null;
  }
  return null;
};
