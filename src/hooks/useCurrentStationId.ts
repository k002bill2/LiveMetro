/**
 * useCurrentStationId — the user's current location expressed as a subway
 * station, for the current-location map's "you are here" highlight.
 *
 * Underground GPS is unreliable, so "current location" on a subway app means
 * the nearest station (from the last fix), not raw coords. Wraps
 * useNearbyStations and maps closestStation.id → an internal slug
 * (resolveInternalStationId) so it matches the schematic map's station keys.
 *
 * Forces a location refresh once on mount (refresh is ungated by the global
 * auto-search preference) since this is a dedicated location screen. Never
 * throws; reports an honest status instead of faking a position.
 */
import { useEffect, useRef } from 'react';
import { useNearbyStations } from '@hooks/useNearbyStations';
import { resolveInternalStationId } from '@utils/stationIdResolver';

export type CurrentStationStatus = 'locating' | 'located' | 'unavailable';

export interface CurrentStationIdResult {
  currentStationId: string | null;
  currentStationName: string | null;
  distanceM: number | null;
  status: CurrentStationStatus;
}

export function useCurrentStationId(): CurrentStationIdResult {
  const { closestStation, loading, refresh } = useNearbyStations();

  // Dedicated screen: force a one-time location fetch on mount, bypassing the
  // global auto-search preference (refresh is ungated).
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!refreshedRef.current) {
      refreshedRef.current = true;
      refresh();
    }
  }, [refresh]);

  if (closestStation) {
    return {
      currentStationId: resolveInternalStationId(closestStation.id),
      currentStationName: closestStation.name,
      distanceM: closestStation.distance ?? null,
      status: 'located',
    };
  }

  return {
    currentStationId: null,
    currentStationName: null,
    distanceM: null,
    status: loading ? 'locating' : 'unavailable',
  };
}

export default useCurrentStationId;
