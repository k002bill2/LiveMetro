/**
 * Location Hook
 * Custom hook for managing location services and user positioning
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  locationService,
  LocationCoordinates,
  LocationTrackingMode,
} from '../services/location/locationService';

interface UseLocationState {
  location: LocationCoordinates | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  isTracking: boolean;
  trackingMode: LocationTrackingMode;
  accuracy: number | null;
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  trackingMode?: LocationTrackingMode;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  enableBackgroundLocation?: boolean;
  showPermissionExplanation?: boolean;
  onLocationUpdate?: ((location: LocationCoordinates) => void) | undefined;
  onError?: ((error: string) => void) | undefined;
}

/**
 * Hook for managing user location with permission handling and error management
 */
export const useLocation = (options: UseLocationOptions = {}) => {
  const {
    enableHighAccuracy = false,
    trackingMode = 'normal',
    distanceFilter = 50, // 증가: 10 → 50 (도시 환경에서 충분)
    showPermissionExplanation = true,
    onLocationUpdate,
    onError
  } = options;

  const [state, setState] = useState<UseLocationState>({
    location: null,
    loading: false,
    error: null,
    hasPermission: false,
    hasBackgroundPermission: false,
    isTracking: false,
    trackingMode: 'normal',
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
    if (__DEV__) {
      console.error('Location error:', error);
    }
    updateState({
      error,
      loading: false,
    });

    if (onError) {
      onError(error);
    }
  }, [updateState, onError]);

  /**
   * Show permission explanation before requesting
   */
  const showPermissionExplanationAlert = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        '위치 권한이 필요합니다',
        '주변 역 찾기와 도착 알림을 위해 위치 정보가 필요합니다.\n\n• 현재 위치 기반 가까운 역 표시\n• 역 도착 시 자동 알림\n• 출퇴근 경로 추천',
        [
          { text: '허용 안함', onPress: () => resolve(false), style: 'cancel' },
          { text: '계속', onPress: () => resolve(true) },
        ]
      );
    });
  }, []);

  /**
   * Show Android 11+ background permission guide
   */
  const showBackgroundPermissionGuide = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'android' && Platform.Version >= 30) {
        Alert.alert(
          '항상 허용 설정 필요',
          '백그라운드 알림을 받으려면:\n\n1. "권한" 메뉴 선택\n2. "위치" 선택\n3. "항상 허용" 선택',
          [{ text: '설정으로 이동', onPress: () => resolve() }]
        );
      } else {
        resolve();
      }
    });
  }, []);

  /**
   * Initialize location service and request permissions
   */
  const initializeLocation = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });

      // Check if already have permission
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

      if (currentStatus === 'granted') {
        const hasBackgroundPermission = locationService.hasBackgroundLocationPermission();
        updateState({
          hasPermission: true,
          hasBackgroundPermission,
          loading: false
        });
        return true;
      }

      // Show explanation before requesting permission
      if (showPermissionExplanation) {
        const proceed = await showPermissionExplanationAlert();
        if (!proceed) {
          updateState({ loading: false });
          return false;
        }
      }

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
  }, [updateState, handleError, showPermissionExplanation, showPermissionExplanationAlert]);

  /**
   * Request background location permission with proper UI guidance
   */
  const requestBackgroundPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.hasPermission) {
        const initialized = await initializeLocation();
        if (!initialized) return false;
      }

      // Show guide for Android 11+
      await showBackgroundPermissionGuide();

      const hasBackgroundPermission = await locationService.requestBackgroundPermission();

      updateState({ hasBackgroundPermission });

      if (!hasBackgroundPermission) {
        if (__DEV__) {
          console.warn('Background permission not granted');
        }
      }

      return hasBackgroundPermission;
    } catch (error) {
      handleError(error instanceof Error ? error.message : '백그라운드 권한 요청에 실패했습니다.');
      return false;
    }
  }, [state.hasPermission, initializeLocation, showBackgroundPermissionGuide, updateState, handleError]);

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
   * Start continuous location tracking with optional mode
   */
  const startTracking = useCallback(async (mode?: LocationTrackingMode) => {
    if (trackingRef.current) {
      if (__DEV__) {
        console.warn('Location tracking already active');
      }
      return true;
    }

    if (!state.hasPermission) {
      const initialized = await initializeLocation();
      if (!initialized) return false;
    }

    try {
      const effectiveMode = mode || trackingMode;
      const success = await locationService.startLocationTracking(
        handleLocationUpdate,
        {
          mode: effectiveMode,
          accuracy: enableHighAccuracy ?
            Location.Accuracy.BestForNavigation :
            undefined, // Let mode config handle it
          distanceInterval: distanceFilter,
        }
      );

      if (success) {
        trackingRef.current = true;
        updateState({ isTracking: true, trackingMode: effectiveMode });
        if (__DEV__) {
          console.log(`Location tracking started (mode: ${effectiveMode})`);
        }
        return true;
      } else {
        handleError('위치 추적을 시작할 수 없습니다.');
        return false;
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : '위치 추적 시작에 실패했습니다.');
      return false;
    }
  }, [state.hasPermission, initializeLocation, handleLocationUpdate, enableHighAccuracy, trackingMode, distanceFilter, updateState, handleError]);

  /**
   * Start battery-efficient tracking mode
   */
  const startBatteryEfficientTracking = useCallback(async () => {
    return startTracking('batteryEfficient');
  }, [startTracking]);

  /**
   * Start high-accuracy tracking mode (for station arrival detection)
   */
  const startHighAccuracyTracking = useCallback(async () => {
    return startTracking('highAccuracy');
  }, [startTracking]);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback(() => {
    if (!trackingRef.current) {
      if (__DEV__) {
        console.warn('Location tracking is not active');
      }
      return;
    }

    locationService.stopLocationTracking();
    trackingRef.current = false;
    updateState({ isTracking: false });
    if (__DEV__) {
      console.log('Location tracking stopped');
    }
  }, [updateState]);

  /**
   * Handle app state changes for battery optimization
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (__DEV__) {
      console.log('App state changed:', appStateRef.current, '->', nextAppState);
    }

    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground - resume tracking if it was active
      if (trackingRef.current && !state.isTracking) {
        if (__DEV__) {
          console.log('Resuming location tracking');
        }
        startTracking();
      }
    } else if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is going to background - optionally stop tracking for battery saving
      if (state.isTracking && !options.enableBackgroundLocation) {
        if (__DEV__) {
          console.log('Pausing location tracking (background)');
        }
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
    startBatteryEfficientTracking,
    startHighAccuracyTracking,
    stopTracking,
    checkLocationServices,
    initializeLocation,
    requestBackgroundPermission,
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
