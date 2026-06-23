/**
 * Nearby Stations Hook
 * Custom hook for finding and managing nearby subway stations based on user location
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from './useLocation';
import { locationService, NearbyStation, LocationCoordinates, AdaptiveRadiusResult, LAST_KNOWN_REQUIRED_ACCURACY_M } from '../services/location/locationService';
import {
  getNearbyAutoSearchEnabled,
  subscribeNearbyAutoSearch,
} from '../services/location/nearbySearchPreference';
import { trainService } from '../services/train/trainService';
import { Station } from '../models/train';

interface UseNearbyStationsState {
  nearbyStations: NearbyStation[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  closestStation: NearbyStation | null;
  effectiveRadius: number | null;
  radiusExpanded: boolean;
}

interface UseNearbyStationsOptions {
  radius?: number; // in meters
  maxStations?: number;
  minStations?: number; // Minimum stations for adaptive radius (default: 3)
  maxRadius?: number; // Hard cap for adaptive expansion. Pass equal to `radius` to disable expansion entirely.
  autoUpdate?: boolean;
  minUpdateInterval?: number; // in milliseconds
  onStationsFound?: (stations: NearbyStation[]) => void;
  onClosestStationChanged?: (station: NearbyStation | null) => void;
  mockLocation?: LocationCoordinates; // For testing: override GPS location
  externalLocation?: LocationCoordinates | null; // Use location from parent hook instead of creating new tracking
}

// Delay (ms) before a single automatic retry when a cold-start fix never
// arrives. Long enough for a slow first GPS/cell lock to settle, short enough
// that the user isn't stranded on an empty screen for long.
const COLD_START_RETRY_DELAY_MS = 6000;

/**
 * Hook for managing nearby stations based on user location
 */
export const useNearbyStations = (options: UseNearbyStationsOptions = {}) => {
  const {
    radius = 600, // 600m default — 도심 환경에서 도보 7-8분 거리
    maxStations = 10,
    minStations = 3, // Adaptive radius: expand until this many found
    maxRadius, // Hard cap for adaptive expansion (undefined = unbounded, original behaviour)
    autoUpdate = true,
    minUpdateInterval = 30000, // 30 seconds
    onStationsFound,
    onClosestStationChanged,
    mockLocation, // 🧪 Test mode: use fixed coordinates
    externalLocation, // 🔗 Use location from parent hook
  } = options;

  const [state, setState] = useState<UseNearbyStationsState>({
    nearbyStations: [],
    loading: true,
    error: null,
    lastUpdated: null,
    closestStation: null,
    effectiveRadius: null,
    radiusExpanded: false,
  });

  const [allStations, setAllStations] = useState<Station[]>([]);

  // "자동 주변 역 검색" 설정 (위치 권한 화면 토글). off면 위치 기반 자동
  // 검색을 중단한다 — 수동 refresh()는 명시적 액션이라 게이트하지 않음.
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true);
  useEffect(() => {
    let alive = true;
    getNearbyAutoSearchEnabled().then((enabled) => {
      if (alive) setAutoSearchEnabled(enabled);
    });
    const unsubscribe = subscribeNearbyAutoSearch(setAutoSearchEnabled);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Refs (not state) for values mutated *inside* findNearbyStations:
  // listing them in the useCallback deps below would recreate the callback
  // on every successful run, re-fire the location useEffect, and produce the
  // "Loaded 24 subway lines" 9x logging signature observed in production.
  // Refs also give us synchronous updates so two concurrent triggers
  // (location effect + onLocationUpdate callback) cannot both pass throttle.
  const lastUpdateTimeRef = useRef<number>(0);
  const closestStationIdRef = useRef<string | null>(null);

  // In-flight dedup for loadAllStations: mount effect and the
  // findNearbyStations fallback both call this; without dedup setAllStations
  // hasn't committed yet on the second caller, so they both refetch all 24
  // lines (the 2x "Loaded 24 subway lines" residual after the deps fix).
  const loadAllStationsPromiseRef = useRef<Promise<Station[]> | null>(null);

  // Guards the one-shot GPS fallback (see the fallback effect below). Declared
  // here, not at the effect, so refresh() can re-arm it — a manual refresh then
  // recovers from a stuck null-fix cold-start where the guard never re-arms on
  // its own (gpsLocation stays null forever).
  const oneShotFallbackAttemptedRef = useRef(false);

  // Guards a single delayed auto-retry of the cold-start fix (see the auto-retry
  // effect below). The timer handle lives in a ref — not effect cleanup — so it
  // survives the locationLoading true→false churn each getCurrentLocation() emits;
  // clearing it on every dep change would cancel the retry before it ever fires.
  const autoRetryAttemptedRef = useRef(false);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use mockLocation in test mode, otherwise use real GPS
  // Skip onLocationUpdate when external location is provided (parent handles tracking)
  const { location: gpsLocation, loading: locationLoading, error: locationError, getCurrentLocation } = useLocation({
    // Balanced (wifi/cell), not High (GPS-only): the nearby search only needs to
    // place the user among ~500m-spaced stations, so a GPS-only cold-start fix
    // buys unused precision at a large latency cost. getCurrentLocation still
    // degrades High→Balanced internally if a caller ever needs High elsewhere.
    enableHighAccuracy: false,
    distanceFilter: 20, // 600m 반경에서 50m 오차는 8% — 20m로 줄여 정확도 유지
    onLocationUpdate: autoUpdate && !mockLocation && !externalLocation ? handleLocationUpdate : undefined,
  });

  // Priority: mockLocation > externalLocation > GPS
  const location = mockLocation ?? externalLocation ?? gpsLocation;

  const updateState = useCallback((updates: Partial<UseNearbyStationsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  /**
   * Load all stations from the service (Firebase/API).
   * Dedup: if a previous call is in-flight, return its promise so the mount
   * effect and the findNearbyStations fallback don't both refetch 24 lines.
   */
  const loadAllStations = useCallback(async (): Promise<Station[]> => {
    if (loadAllStationsPromiseRef.current) {
      return loadAllStationsPromiseRef.current;
    }

    const promise = (async (): Promise<Station[]> => {
      try {
        const lines = await trainService.getSubwayLines();
        if (__DEV__) {
          console.log(`[useNearbyStations] Loaded ${lines.length} subway lines`);
        }

        const stationsPromises = lines.map(line => trainService.getStationsByLine(line.id));
        const stationArrays = await Promise.all(stationsPromises);

        const stations = stationArrays.flat();
        if (__DEV__) {
          console.log(`[useNearbyStations] Loaded ${stations.length} total stations`);
        }

        setAllStations(stations);
        return stations;
      } catch (error) {
        console.error('Error loading stations:', error);
        updateState({
          error: '역 정보를 불러올 수 없습니다.',
          loading: false,
        });
        return [];
      } finally {
        // Clear the in-flight ref so subsequent calls can refetch when needed
        // (e.g. an explicit refresh after the cached set has changed).
        loadAllStationsPromiseRef.current = null;
      }
    })();

    loadAllStationsPromiseRef.current = promise;
    return promise;
  }, [updateState]);

  /**
   * Find nearby stations based on current location
   */
  const findNearbyStations = useCallback(async (currentLocation = location) => {
    if (!currentLocation) {
      return;
    }

    // Throttle updates (synchronous via ref to avoid race when location
    // effect and onLocationUpdate fire in the same tick).
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < minUpdateInterval) {
      return;
    }
    lastUpdateTimeRef.current = now;

    try {
      updateState({ loading: true, error: null });

      let stations = allStations;
      if (stations.length === 0) {
        stations = await loadAllStations();
      }

      const adaptiveResult: AdaptiveRadiusResult = locationService.findNearbyStationsAdaptive(
        currentLocation,
        stations,
        radius,
        minStations,
        maxRadius
      );
      const nearbyStations = adaptiveResult.stations.slice(0, maxStations);

      if (__DEV__) {
        console.log(`[useNearbyStations] Location: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`);
        console.log(`[useNearbyStations] Found ${nearbyStations.length} stations within ${adaptiveResult.effectiveRadius}m${adaptiveResult.expanded ? ' (expanded)' : ''}`);
      }

      const closestStation: NearbyStation | null = nearbyStations.at(0) ?? null;

      // Check if closest station changed — compare against ref (not state)
      // so this comparison doesn't depend on the rendered state, removing
      // `state.closestStation` from the useCallback deps below.
      // Normalize both sides to `string | null` so an absent station
      // (undefined from optional chaining) compares equal to a previous
      // null state, instead of always firing the callback.
      const newClosestId: string | null = closestStation?.id ?? null;
      if (newClosestId !== closestStationIdRef.current && onClosestStationChanged) {
        onClosestStationChanged(closestStation);
      }
      closestStationIdRef.current = newClosestId;

      updateState({
        nearbyStations,
        closestStation,
        loading: false,
        lastUpdated: new Date(),
        effectiveRadius: adaptiveResult.effectiveRadius,
        radiusExpanded: adaptiveResult.expanded,
      });

      if (onStationsFound) {
        onStationsFound(nearbyStations);
      }

    } catch (error) {
      console.error('Error finding nearby stations:', error);
      updateState({
        error: '주변 역을 찾을 수 없습니다.',
        loading: false,
      });
    }
  }, [
    location,
    allStations,
    loadAllStations,
    updateState,
    radius,
    maxStations,
    minStations,
    maxRadius,
    minUpdateInterval,
    onStationsFound,
    onClosestStationChanged,
  ]);

  /**
   * Handle location updates
   */
  function handleLocationUpdate(newLocation: LocationCoordinates) {
    if (!autoSearchEnabled) {
      return;
    }
    findNearbyStations(newLocation);
  }

  /**
   * Manually refresh nearby stations
   */
  const refresh = useCallback(() => {
    lastUpdateTimeRef.current = 0; // Reset throttle (sync, no re-render)
    // Re-acquire a fresh fix instead of re-running the search on the stale
    // closure location: the new fix flows through the location effect, which
    // re-runs findNearbyStations with the user's current position. Re-arming
    // the one-shot guard also recovers from a stuck null-fix cold-start
    // dead-end (the guard never re-arms on its own while gpsLocation is null).
    oneShotFallbackAttemptedRef.current = false;
    // Re-arm the auto-retry too: a manual refresh restarts the recovery cycle, so
    // if this fresh fix also fails the delayed retry can fire again.
    autoRetryAttemptedRef.current = false;
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    getCurrentLocation();
  }, [getCurrentLocation]);

  /**
   * Get station by distance category
   */
  const getStationsByCategory = useMemo(() => {
    const categories = {
      'very-close': [] as NearbyStation[],
      'close': [] as NearbyStation[],
      'nearby': [] as NearbyStation[],
      'far': [] as NearbyStation[],
    };

    state.nearbyStations.forEach(station => {
      const category = locationService.getDistanceCategory(station.distance);
      categories[category].push(station);
    });

    return categories;
  }, [state.nearbyStations]);

  /**
   * Check if user is at a station
   */
  const isAtStation = useMemo(() => {
    return state.nearbyStations.some(station => station.distance <= 100); // Within 100m
  }, [state.nearbyStations]);

  /**
   * Get formatted distances for display
   */
  const getFormattedStations = useMemo(() => {
    return state.nearbyStations.map(station => ({
      ...station,
      formattedDistance: locationService.formatDistance(station.distance),
      distanceCategory: locationService.getDistanceCategory(station.distance),
    }));
  }, [state.nearbyStations]);

  // Initialize stations on mount
  useEffect(() => {
    loadAllStations();
  }, [loadAllStations]);

  // Fallback: if no external/mock location and GPS hasn't provided one, try
  // one-shot. Guarded by a ref because a *failed* getCurrentLocation() leaves
  // gpsLocation null while toggling locationLoading true→false; that settle
  // re-satisfies the condition below and, without the guard, re-fires forever
  // (the iOS kCLErrorLocationUnknown retry loop that spammed location errors
  // from both the Home and Routes tabs at once). The guard re-arms whenever a
  // location source (mock/external/GPS) is present, so the one-shot can fire
  // again if every source later goes away.
  useEffect(() => {
    if (!autoSearchEnabled) {
      return;
    }
    if (mockLocation || externalLocation || gpsLocation) {
      oneShotFallbackAttemptedRef.current = false;
      return;
    }
    if (!locationLoading && !oneShotFallbackAttemptedRef.current) {
      oneShotFallbackAttemptedRef.current = true;
      getCurrentLocation();
    }
  }, [autoSearchEnabled, mockLocation, externalLocation, gpsLocation, locationLoading, getCurrentLocation]);

  // Auto-recover from a cold-start dead-end: the one-shot above fires only once,
  // so when it fails and no location source ever arrives, gpsLocation stays null
  // forever (previously only a manual refresh re-armed it). Schedule exactly one
  // delayed retry so the "주변 역" section recovers on its own. Guarded against
  // the loading churn: schedule only when no timer is pending and none has fired,
  // cancel only when a location arrives or on unmount.
  useEffect(() => {
    if (!autoSearchEnabled) {
      return;
    }
    if (mockLocation || externalLocation || gpsLocation) {
      // A fix arrived — drop any pending retry and re-arm for a future loss.
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      autoRetryAttemptedRef.current = false;
      return;
    }
    if (!locationLoading && !autoRetryAttemptedRef.current && !autoRetryTimerRef.current) {
      autoRetryTimerRef.current = setTimeout(() => {
        autoRetryTimerRef.current = null;
        autoRetryAttemptedRef.current = true;
        getCurrentLocation();
      }, COLD_START_RETRY_DELAY_MS);
    }
  }, [autoSearchEnabled, mockLocation, externalLocation, gpsLocation, locationLoading, getCurrentLocation]);

  // Clear the pending retry timer on unmount (subscription-cleanup).
  useEffect(
    () => () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    },
    []
  );

  // Find nearby stations when location is available
  useEffect(() => {
    if (location && !locationLoading && autoSearchEnabled) {
      findNearbyStations();
    }
  }, [location, locationLoading, autoSearchEnabled, findNearbyStations]);

  // Handle location errors
  useEffect(() => {
    if (locationError) {
      updateState({
        error: locationError,
        loading: false,
      });
    }
  }, [locationError, updateState]);

  // When external or mock location is provided, ignore internal locationLoading
  const effectiveLocationLoading = (externalLocation != null || mockLocation != null) ? false : locationLoading;

  // A live fix is accepted up to MAX_ACCEPTABLE_ACCURACY_M (500m), so an
  // accepted fix can still be 100–500m coarse. Flag derived UI as estimated
  // when the fix is coarser than the last-known confidence bound (or unknown),
  // so the screen avoids asserting "nearest station" off a low-confidence fix.
  const isEstimated =
    location != null &&
    (location.accuracy == null || location.accuracy > LAST_KNOWN_REQUIRED_ACCURACY_M);

  return {
    ...state,
    loading: state.loading || effectiveLocationLoading,
    refresh,
    getStationsByCategory,
    isAtStation,
    getFormattedStations,
    hasLocation: !!location,
    isEstimated,
    searchRadius: state.effectiveRadius ?? radius,
    radiusExpanded: state.radiusExpanded,
  };
};

/**
 * Hook for finding a specific station by name with distance info
 */
export const useStationDistance = (stationName: string) => {
  const [station, setStation] = useState<NearbyStation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { location } = useLocation();

  const findStation = useCallback(async () => {
    if (!location || !stationName.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const stationInfo = await trainService.searchStations(stationName);
      
      if (stationInfo.length === 0) {
        throw new Error(`"${stationName}" 역을 찾을 수 없습니다.`);
      }

      const targetStation = stationInfo.at(0);
      if (!targetStation) {
        throw new Error(`"${stationName}" 역을 찾을 수 없습니다.`);
      }
      const distance = locationService.calculateDistance(
        location.latitude,
        location.longitude,
        targetStation.coordinates.latitude,
        targetStation.coordinates.longitude
      );

      const bearing = locationService.calculateBearing(
        location.latitude,
        location.longitude,
        targetStation.coordinates.latitude,
        targetStation.coordinates.longitude
      );

      setStation({
        ...targetStation,
        distance,
        bearing,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '역 정보를 가져올 수 없습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [location, stationName]);

  useEffect(() => {
    findStation();
  }, [findStation]);

  return {
    station,
    loading,
    error,
    formattedDistance: station ? locationService.formatDistance(station.distance) : null,
    distanceCategory: station ? locationService.getDistanceCategory(station.distance) : null,
    refresh: findStation,
  };
};
