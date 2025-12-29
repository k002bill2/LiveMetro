/**
 * Nearby Stations Hook
 * Custom hook for finding and managing nearby subway stations based on user location
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from './useLocation';
import { locationService, NearbyStation, LocationCoordinates } from '../services/location/locationService';
import { trainService } from '../services/train/trainService';
import { Station } from '../models/train';

interface UseNearbyStationsState {
  nearbyStations: NearbyStation[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  closestStation: NearbyStation | null;
}

interface UseNearbyStationsOptions {
  radius?: number; // in meters
  maxStations?: number;
  autoUpdate?: boolean;
  minUpdateInterval?: number; // in milliseconds
  onStationsFound?: (stations: NearbyStation[]) => void;
  onClosestStationChanged?: (station: NearbyStation | null) => void;
  mockLocation?: LocationCoordinates; // For testing: override GPS location
}

/**
 * Hook for managing nearby stations based on user location
 */
export const useNearbyStations = (options: UseNearbyStationsOptions = {}) => {
  const {
    radius = 1000, // 1km default
    maxStations = 10,
    autoUpdate = true,
    minUpdateInterval = 30000, // 30 seconds
    onStationsFound,
    onClosestStationChanged,
    mockLocation, // 🧪 Test mode: use fixed coordinates
  } = options;

  const [state, setState] = useState<UseNearbyStationsState>({
    nearbyStations: [],
    loading: true,
    error: null,
    lastUpdated: null,
    closestStation: null,
  });

  const [allStations, setAllStations] = useState<Station[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  // Use mockLocation in test mode, otherwise use real GPS
  const { location: gpsLocation, loading: locationLoading, error: locationError } = useLocation({
    enableHighAccuracy: false,
    distanceFilter: 50, // Update when user moves 50m
    onLocationUpdate: autoUpdate && !mockLocation ? handleLocationUpdate : undefined,
  });

  // Prefer mockLocation over GPS for testing
  const location = mockLocation ?? gpsLocation;

  const updateState = useCallback((updates: Partial<UseNearbyStationsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  /**
   * Load all stations from the service
   */
  const loadAllStations = useCallback(async () => {
    try {
      // Try to get stations from Firebase first
      const lines = await trainService.getSubwayLines();
      const stationsPromises = lines.map(line => trainService.getStationsByLine(line.id));
      const stationArrays = await Promise.all(stationsPromises);
      
      const stations = stationArrays.flat();
      setAllStations(stations);
      return stations;
    } catch (error) {
      console.error('Error loading stations:', error);
      updateState({ 
        error: '역 정보를 불러올 수 없습니다.',
        loading: false 
      });
      return [];
    }
  }, [updateState]);

  /**
   * Find nearby stations based on current location
   */
  const findNearbyStations = useCallback(async (currentLocation = location) => {
    if (!currentLocation) {
      return;
    }

    // Throttle updates
    const now = Date.now();
    if (now - lastUpdateTime < minUpdateInterval) {
      return;
    }

    try {
      updateState({ loading: true, error: null });

      let stations = allStations;
      if (stations.length === 0) {
        stations = await loadAllStations();
      }

      const nearbyStations = locationService.findNearbyStations(
        currentLocation,
        stations,
        radius
      ).slice(0, maxStations);

      const closestStation: NearbyStation | null = nearbyStations.at(0) ?? null;

      // Check if closest station changed
      if (closestStation?.id !== state.closestStation?.id && onClosestStationChanged) {
        onClosestStationChanged(closestStation);
      }

      updateState({
        nearbyStations,
        closestStation,
        loading: false,
        lastUpdated: new Date(),
      });

      setLastUpdateTime(now);

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
    lastUpdateTime,
    minUpdateInterval,
    state.closestStation,
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
    setLastUpdateTime(0); // Reset throttle
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

  return {
    ...state,
    loading: state.loading || locationLoading,
    refresh,
    getStationsByCategory,
    isAtStation,
    getFormattedStations,
    hasLocation: !!location,
    searchRadius: radius,
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
