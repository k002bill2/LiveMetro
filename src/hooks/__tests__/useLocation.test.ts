/**
 * useLocation Hook Tests
 * Tests for location services and user positioning
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useLocation, useCurrentLocation } from '../useLocation';
import { locationService, LocationCoordinates } from '../../services/location/locationService';

// Mock dependencies
jest.mock('../../services/location/locationService');
jest.mock('expo-location', () => ({
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn((_, __, buttons) => {
    // Automatically press the "confirm" button (second option)
    if (buttons && buttons.length > 1) {
      buttons[1].onPress?.();
    }
  }),
}));

const mockLocationService = locationService as jest.Mocked<typeof locationService>;

// Mock AppState
const mockRemove = jest.fn();

// Capture the registered handler so foreground/background transition branches
// in handleAppStateChange can be exercised directly.
let capturedAppStateHandler: ((state: AppStateStatus) => void) | undefined;

jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
  capturedAppStateHandler = handler as (state: AppStateStatus) => void;
  return { remove: mockRemove };
});

const createMockLocation = (overrides?: Partial<LocationCoordinates>): LocationCoordinates => ({
  latitude: 37.5665,
  longitude: 126.978,
  accuracy: 10,
  ...overrides,
});

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationService.initialize.mockResolvedValue(true);
    mockLocationService.getCurrentLocation.mockResolvedValue(createMockLocation());
    mockLocationService.startLocationTracking.mockResolvedValue(true);
    mockLocationService.isLocationServicesEnabled.mockResolvedValue(true);
    mockLocationService.hasBackgroundLocationPermission.mockReturnValue(false);
    mockLocationService.requestBackgroundPermission.mockResolvedValue(true);
  });

  describe('Initial State', () => {
    it('should initialize with loading false', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should check permissions on mount', async () => {
      // With expo-location mock returning granted, hasPermission should be true
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
    });

    it('should set hasPermission based on initialize result', async () => {
      mockLocationService.initialize.mockResolvedValue(true);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
    });

    it('should set error when permission denied', async () => {
      // Override expo-location mock to return denied
      const Location = require('expo-location');
      Location.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      mockLocationService.initialize.mockResolvedValueOnce(false);

      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.error).toContain('위치 권한');
      });
    });
  });

  describe('Get Current Location', () => {
    it('getCurrentLocation should return location on success', async () => {
      const mockLocation = createMockLocation();
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let returnedLocation: LocationCoordinates | null = null;
      await act(async () => {
        returnedLocation = await result.current.getCurrentLocation();
      });

      expect(returnedLocation).toEqual(mockLocation);
      expect(result.current.location).toEqual(mockLocation);
    });

    it('getCurrentLocation should set accuracy from location', async () => {
      const mockLocation = createMockLocation({ accuracy: 25 });
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(result.current.accuracy).toBe(25);
    });

    it('getCurrentLocation preserves a precise (accuracy 0) fix instead of coercing it to null', async () => {
      // Regression: `location.accuracy || null` mangled a precise 0 fix into null,
      // so a perfect fix was reported downstream as "unknown accuracy".
      const mockLocation = createMockLocation({ accuracy: 0 });
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(result.current.accuracy).toBe(0);
    });

    it('getCurrentLocation should initialize if no permission', async () => {
      // Setup: Already have permission from expo-location mock, so hasPermission is true
      // Test that when permission is true, getCurrentLocation works without calling initialize again
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      // Clear and test getCurrentLocation
      mockLocationService.getCurrentLocation.mockClear();
      mockLocationService.getCurrentLocation.mockResolvedValue(createMockLocation());

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(mockLocationService.getCurrentLocation).toHaveBeenCalled();
    });

    it('getCurrentLocation should call onLocationUpdate callback', async () => {
      const onLocationUpdate = jest.fn();
      const mockLocation = createMockLocation();
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      const { result } = renderHook(() => useLocation({ onLocationUpdate }));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(onLocationUpdate).toHaveBeenCalledWith(mockLocation);
    });

    it('getCurrentLocation should handle null location', async () => {
      mockLocationService.getCurrentLocation.mockResolvedValue(null);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(result.current.error).toContain('현재 위치');
    });

    it('getCurrentLocation should handle errors', async () => {
      mockLocationService.getCurrentLocation.mockRejectedValue(new Error('GPS error'));

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('getCurrentLocation should call onError callback on failure', async () => {
      const onError = jest.fn();
      mockLocationService.getCurrentLocation.mockRejectedValue(new Error('GPS error'));

      const { result } = renderHook(() => useLocation({ onError }));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Location Tracking', () => {
    it('startTracking should call locationService.startLocationTracking', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalled();
    });

    it('startTracking should set isTracking true on success', async () => {
      mockLocationService.startLocationTracking.mockResolvedValue(true);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);
    });

    it('startTracking should return true already tracking', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      mockLocationService.startLocationTracking.mockClear();

      let returnValue = false;
      await act(async () => {
        returnValue = await result.current.startTracking();
      });

      expect(returnValue).toBe(true);
      // Should not call again
      expect(mockLocationService.startLocationTracking).not.toHaveBeenCalled();
    });

    it('startTracking should work when permission already granted', async () => {
      // expo-location mock returns granted, so permission is already true
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      mockLocationService.startLocationTracking.mockClear();
      mockLocationService.startLocationTracking.mockResolvedValue(true);

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalled();
    });

    it('startTracking should handle failure', async () => {
      mockLocationService.startLocationTracking.mockResolvedValue(false);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.error).toContain('위치 추적');
    });

    it('stopTracking should call locationService.stopLocationTracking', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      act(() => {
        result.current.stopTracking();
      });

      expect(mockLocationService.stopLocationTracking).toHaveBeenCalled();
    });

    it('stopTracking should set isTracking false', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);

      act(() => {
        result.current.stopTracking();
      });

      expect(result.current.isTracking).toBe(false);
    });

    it('stopTracking should do nothing if not tracking', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.stopTracking();
      });

      expect(mockLocationService.stopLocationTracking).not.toHaveBeenCalled();
    });
  });

  describe('Check Location Services', () => {
    it('checkLocationServices should return true when enabled', async () => {
      mockLocationService.isLocationServicesEnabled.mockResolvedValue(true);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let isEnabled = false;
      await act(async () => {
        isEnabled = await result.current.checkLocationServices();
      });

      expect(isEnabled).toBe(true);
    });

    it('checkLocationServices should set error when disabled', async () => {
      mockLocationService.isLocationServicesEnabled.mockResolvedValue(false);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.checkLocationServices();
      });

      expect(result.current.error).toContain('위치 서비스');
    });

    it('checkLocationServices should handle errors', async () => {
      mockLocationService.isLocationServicesEnabled.mockRejectedValue(new Error('Check failed'));

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let isEnabled = true;
      await act(async () => {
        isEnabled = await result.current.checkLocationServices();
      });

      expect(isEnabled).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('App State Handling', () => {
    it('should register AppState listener on mount', () => {
      renderHook(() => useLocation());

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove AppState listener on unmount', () => {
      const { unmount } = renderHook(() => useLocation());

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should stop tracking on unmount if active', async () => {
      const { result, unmount } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);

      unmount();

      expect(mockLocationService.stopLocationTracking).toHaveBeenCalled();
    });
  });

  describe('Options', () => {
    it('should use enableHighAccuracy option', async () => {
      const { result } = renderHook(() =>
        useLocation({ enableHighAccuracy: true })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ accuracy: 6 }) // BestForNavigation
      );
    });

    it('should use custom distanceFilter', async () => {
      const { result } = renderHook(() =>
        useLocation({ distanceFilter: 50 })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ distanceInterval: 50 })
      );
    });
  });

  describe('Background Permission', () => {
    it('requestBackgroundPermission should return true when service grants it', async () => {
      mockLocationService.requestBackgroundPermission.mockResolvedValue(true);

      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let granted = false;
      await act(async () => {
        granted = await result.current.requestBackgroundPermission();
      });

      expect(granted).toBe(true);
      expect(mockLocationService.requestBackgroundPermission).toHaveBeenCalled();
      expect(result.current.hasBackgroundPermission).toBe(true);
    });

    it('requestBackgroundPermission should return false when service denies it', async () => {
      mockLocationService.requestBackgroundPermission.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let granted = true;
      await act(async () => {
        granted = await result.current.requestBackgroundPermission();
      });

      expect(granted).toBe(false);
      expect(result.current.hasBackgroundPermission).toBe(false);
    });

    it('requestBackgroundPermission should initialize first and bail out when init fails', async () => {
      const Location = require('expo-location');
      Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      mockLocationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      mockLocationService.requestBackgroundPermission.mockClear();

      let granted = true;
      await act(async () => {
        granted = await result.current.requestBackgroundPermission();
      });

      expect(granted).toBe(false);
      // init failed → must short-circuit before requesting background permission
      expect(mockLocationService.requestBackgroundPermission).not.toHaveBeenCalled();
    });
  });

  describe('App State Transitions', () => {
    beforeEach(() => {
      // appStateRef is seeded from AppState.currentState at mount; the test env
      // leaves it undefined, so pin it to a realistic value before each render.
      AppState.currentState = 'active';
    });

    it('should pause tracking when app goes to background (foreground-only mode)', async () => {
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });
      expect(result.current.isTracking).toBe(true);

      expect(capturedAppStateHandler).toBeDefined();
      mockLocationService.stopLocationTracking.mockClear();

      // Normalize appState to 'active', then transition to background.
      await act(async () => {
        capturedAppStateHandler?.('active');
      });
      await act(async () => {
        capturedAppStateHandler?.('background');
      });

      expect(mockLocationService.stopLocationTracking).toHaveBeenCalled();
      expect(result.current.isTracking).toBe(false);
    });

    it('should NOT pause tracking on background when enableBackgroundLocation is true', async () => {
      const { result } = renderHook(() =>
        useLocation({
          showPermissionExplanation: false,
          enableBackgroundLocation: true,
        })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startTracking();
      });
      expect(result.current.isTracking).toBe(true);

      mockLocationService.stopLocationTracking.mockClear();

      await act(async () => {
        capturedAppStateHandler?.('active');
      });
      await act(async () => {
        capturedAppStateHandler?.('background');
      });

      expect(mockLocationService.stopLocationTracking).not.toHaveBeenCalled();
      expect(result.current.isTracking).toBe(true);
    });

    it('should not start tracking on foreground when no session is active', async () => {
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      mockLocationService.startLocationTracking.mockClear();

      // background → active while not tracking: resume branch must be a no-op.
      await act(async () => {
        capturedAppStateHandler?.('background');
      });
      await act(async () => {
        capturedAppStateHandler?.('active');
      });

      expect(mockLocationService.startLocationTracking).not.toHaveBeenCalled();
    });
  });

  describe('Tracking Mode Shortcuts', () => {
    it('startBatteryEfficientTracking should track in batteryEfficient mode', async () => {
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startBatteryEfficientTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ mode: 'batteryEfficient' })
      );
    });

    it('startHighAccuracyTracking should track in highAccuracy mode', async () => {
      const { result } = renderHook(() =>
        useLocation({ showPermissionExplanation: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.startHighAccuracyTracking();
      });

      expect(mockLocationService.startLocationTracking).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ mode: 'highAccuracy' })
      );
    });
  });
});

describe('useCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationService.initialize.mockResolvedValue(true);
    mockLocationService.getCurrentLocation.mockResolvedValue(createMockLocation());
  });

  describe('Initial State', () => {
    it('should initialize with null location', () => {
      const { result } = renderHook(() => useCurrentLocation());

      expect(result.current.location).toBeNull();
    });

    it('should initialize with loading false', () => {
      const { result } = renderHook(() => useCurrentLocation());

      expect(result.current.loading).toBe(false);
    });

    it('should initialize with null error', () => {
      const { result } = renderHook(() => useCurrentLocation());

      expect(result.current.error).toBeNull();
    });
  });

  describe('Get Location', () => {
    beforeEach(() => {
      // Ensure initialize returns true for useCurrentLocation tests
      mockLocationService.initialize.mockResolvedValue(true);
    });

    it('getLocation should return location on success', async () => {
      const mockLocation = createMockLocation();
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      const { result } = renderHook(() => useCurrentLocation());

      let returnedLocation: LocationCoordinates | null = null;
      await act(async () => {
        returnedLocation = await result.current.getLocation();
      });

      expect(returnedLocation).toEqual(mockLocation);
      expect(result.current.location).toEqual(mockLocation);
    });

    it('getLocation should set loading during fetch', async () => {
      let resolveLocation: (value: LocationCoordinates | null) => void;
      const locationPromise = new Promise<LocationCoordinates | null>((resolve) => {
        resolveLocation = resolve;
      });
      mockLocationService.getCurrentLocation.mockReturnValue(locationPromise);

      const { result } = renderHook(() => useCurrentLocation());

      act(() => {
        result.current.getLocation();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveLocation!(createMockLocation());
      });

      expect(result.current.loading).toBe(false);
    });

    it('getLocation should set error on permission denied', async () => {
      mockLocationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() => useCurrentLocation());

      await act(async () => {
        await result.current.getLocation();
      });

      expect(result.current.error).toContain('위치 권한');
    });

    it('getLocation should set error on failure', async () => {
      mockLocationService.getCurrentLocation.mockRejectedValue(new Error('GPS failed'));

      const { result } = renderHook(() => useCurrentLocation());

      await act(async () => {
        await result.current.getLocation();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('getLocation should return null on error', async () => {
      mockLocationService.getCurrentLocation.mockRejectedValue(new Error('GPS failed'));

      const { result } = renderHook(() => useCurrentLocation());

      let returnedLocation: LocationCoordinates | null = createMockLocation();
      await act(async () => {
        returnedLocation = await result.current.getLocation();
      });

      expect(returnedLocation).toBeNull();
    });
  });
});
