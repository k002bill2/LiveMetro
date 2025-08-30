/**
 * Location Hook
 * Custom hook for managing location services and user positioning
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { locationService, LocationCoordinates } from '../services/location/locationService';

interface UseLocationState {
  location: LocationCoordinates | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
  isTracking: boolean;
  accuracy: number | null;
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  enableBackgroundLocation?: boolean;
  onLocationUpdate?: (location: LocationCoordinates) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for managing user location with permission handling and error management
 */
export const useLocation = (options: UseLocationOptions = {}) => {
  const {
    enableHighAccuracy = false,
    distanceFilter = 10,
    onLocationUpdate,
    onError
  } = options;

  const [state, setState] = useState<UseLocationState>({
    location: null,
    loading: false,
    error: null,
    hasPermission: false,
    isTracking: false,
    accuracy: null,
  });

  const appStateRef = useRef(AppState.currentState);
  const trackingRef = useRef(false);

  const updateState = useCallback((updates: Partial<UseLocationState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  const handleLocationUpdate = useCallback((location: LocationCoordinates) => {
    updateState({
      location,
      loading: false,
      error: null,
      accuracy: location.accuracy || null,
    });

    if (onLocationUpdate) {
      onLocationUpdate(location);
    }
  }, [updateState, onLocationUpdate]);

  const handleError = useCallback((error: string) => {
    console.error('Location error:', error);
    updateState({
      error,
      loading: false,
    });

    if (onError) {
      onError(error);
    }
  }, [updateState, onError]);

  /**
   * Initialize location service and request permissions
   */
  const initializeLocation = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      
      const hasPermission = await locationService.initialize();
      
      updateState({ 
        hasPermission,
        loading: false 
      });

      if (!hasPermission) {
        handleError('위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
        return false;
      }

      return true;
    } catch (error) {
      handleError(error instanceof Error ? error.message : '위치 서비스 초기화에 실패했습니다.');
      return false;
    }
  }, [updateState, handleError]);

  /**
   * Get current location once
   */
  const getCurrentLocation = useCallback(async () => {
    if (!state.hasPermission) {
      const initialized = await initializeLocation();
      if (!initialized) return null;
    }

    try {
      updateState({ loading: true, error: null });
      
      const location = await locationService.getCurrentLocation(enableHighAccuracy);
      
      if (location) {
        handleLocationUpdate(location);
        return location;
      } else {
        handleError('현재 위치를 가져올 수 없습니다.');
        return null;
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : '위치 정보를 가져올 수 없습니다.');
      return null;
    }
  }, [state.hasPermission, initializeLocation, enableHighAccuracy, updateState, handleLocationUpdate, handleError]);

  /**
   * Start continuous location tracking
   */
  const startTracking = useCallback(async () => {
    if (trackingRef.current) {
      console.warn('Location tracking already active');
      return true;
    }

    if (!state.hasPermission) {
      const initialized = await initializeLocation();
      if (!initialized) return false;
    }

    try {
      const success = await locationService.startLocationTracking(
        handleLocationUpdate,
        {
          accuracy: enableHighAccuracy ? 
            Location.Accuracy.BestForNavigation : 
            Location.Accuracy.Balanced,
          distanceInterval: distanceFilter,
        }
      );

      if (success) {
        trackingRef.current = true;
        updateState({ isTracking: true });
        console.log('Location tracking started');
        return true;
      } else {
        handleError('위치 추적을 시작할 수 없습니다.');
        return false;
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : '위치 추적 시작에 실패했습니다.');
      return false;
    }
  }, [state.hasPermission, initializeLocation, handleLocationUpdate, enableHighAccuracy, distanceFilter, updateState, handleError]);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback(() => {
    if (!trackingRef.current) {
      console.warn('Location tracking is not active');
      return;
    }

    locationService.stopLocationTracking();
    trackingRef.current = false;
    updateState({ isTracking: false });
    console.log('Location tracking stopped');
  }, [updateState]);

  /**
   * Handle app state changes for battery optimization
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('App state changed:', appStateRef.current, '->', nextAppState);

    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground - resume tracking if it was active
      if (trackingRef.current && !state.isTracking) {
        console.log('Resuming location tracking');
        startTracking();
      }
    } else if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is going to background - optionally stop tracking for battery saving
      if (state.isTracking && !options.enableBackgroundLocation) {
        console.log('Pausing location tracking (background)');
        stopTracking();
      }
    }

    appStateRef.current = nextAppState;
  }, [state.isTracking, startTracking, stopTracking, options.enableBackgroundLocation]);

  /**
   * Check if location services are available
   */
  const checkLocationServices = useCallback(async () => {
    try {
      const isEnabled = await locationService.isLocationServicesEnabled();
      if (!isEnabled) {
        handleError('위치 서비스가 비활성화되어 있습니다. 설정에서 위치 서비스를 활성화해주세요.');
      }
      return isEnabled;
    } catch (error) {
      handleError('위치 서비스 상태를 확인할 수 없습니다.');
      return false;
    }
  }, [handleError]);

  // Initialize on mount
  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  // App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingRef.current) {
        locationService.stopLocationTracking();
      }
    };
  }, []);

  return {
    ...state,
    getCurrentLocation,
    startTracking,
    stopTracking,
    checkLocationServices,
    initializeLocation,
  };
};

/**
 * Simplified hook for one-time location access
 */
export const useCurrentLocation = () => {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const hasPermission = await locationService.initialize();
      if (!hasPermission) {
        throw new Error('위치 권한이 필요합니다.');
      }

      const currentLocation = await locationService.getCurrentLocation();
      setLocation(currentLocation);
      return currentLocation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '위치를 가져올 수 없습니다.';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    location,
    loading,
    error,
    getLocation,
  };
};