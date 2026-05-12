/**
 * Nearby Stations Hook
 * Custom hook for finding and managing nearby subway stations based on user location
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from './useLocation';
import { locationService, NearbyStation, LocationCoordinates, AdaptiveRadiusResult } from '../services/location/locationService';
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
  autoUpdate?: boolean;
  minUpdateInterval?: number; // in milliseconds
  onStationsFound?: (stations: NearbyStation[]) => void;
  onClosestStationChanged?: (station: NearbyStation | null) => void;
  mockLocation?: LocationCoordinates; // For testing: override GPS location
  externalLocation?: LocationCoordinates | null; // Use location from parent hook instead of creating new tracking
}

/**
 * Hook for managing nearby stations based on user location
 */
export const useNearbyStations = (options: UseNearbyStationsOptions = {}) => {
  const {
    radius = 600, // 600m default — 도심 환경에서 도보 7-8분 거리
    maxStations = 10,
    minStations = 3, // Adaptive radius: expand until this many found
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

  // Use mockLocation in test mode, otherwise use real GPS
  // Skip onLocationUpdate when external location is provided (parent handles tracking)
  const { location: gpsLocation, loading: locationLoading, error: locationError, getCurrentLocation } = useLocation({
    enableHighAccuracy: true,
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
        minStations
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
    minUpdateInterval,
    onStationsFound,
    onClosestStationChanged,
  ]);

  /**
   * Handle location updates
   */
  function handleLocationUpdate(newLocation: LocationCoordinates) {
    findNearbyStations(newLocation);
  }

  /**
   * Manually refresh nearby stations
   */
  const refresh = useCallback(() => {
    lastUpdateTimeRef.current = 0; // Reset throttle (sync, no re-render)
    findNearbyStations();
  }, [findNearbyStations]);

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

  // Fallback: if no external/mock location and GPS hasn't provided one, try one-shot
  useEffect(() => {
    if (!mockLocation && !externalLocation && !gpsLocation && !locationLoading) {
      getCurrentLocation();
    }
  }, [mockLocation, externalLocation, gpsLocation, locationLoading, getCurrentLocation]);

  // Find nearby stations when location is available
  useEffect(() => {
    if (location && !locationLoading) {
      findNearbyStations();
    }
  }, [location, locationLoading, findNearbyStations]);

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

  return {
    ...state,
    loading: state.loading || effectiveLocationLoading,
    refresh,
    getStationsByCategory,
    isAtStation,
    getFormattedStations,
    hasLocation: !!location,
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
