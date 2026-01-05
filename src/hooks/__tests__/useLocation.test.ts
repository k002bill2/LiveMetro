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
    BestForNavigation: 6,
    Balanced: 3,
  },
}));

const mockLocationService = locationService as jest.Mocked<typeof locationService>;

// Mock AppState
let appStateCallback: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();

jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
  appStateCallback = callback as (state: AppStateStatus) => void;
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
    appStateCallback = null;
    mockLocationService.initialize.mockResolvedValue(true);
    mockLocationService.getCurrentLocation.mockResolvedValue(createMockLocation());
    mockLocationService.startLocationTracking.mockResolvedValue(true);
    mockLocationService.isLocationServicesEnabled.mockResolvedValue(true);
  });

  describe('Initial State', () => {
    it('should initialize with loading false', async () => {
      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should call initializeLocation on mount', async () => {
      renderHook(() => useLocation());

      await waitFor(() => {
        expect(mockLocationService.initialize).toHaveBeenCalled();
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
      mockLocationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() => useLocation());

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

    it('getCurrentLocation should initialize if no permission', async () => {
      mockLocationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      // Clear previous calls
      mockLocationService.initialize.mockClear();
      mockLocationService.initialize.mockResolvedValue(true);

      await act(async () => {
        await result.current.getCurrentLocation();
      });

      expect(mockLocationService.initialize).toHaveBeenCalled();
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

    it('startTracking should initialize if no permission', async () => {
      mockLocationService.initialize.mockResolvedValueOnce(false);

      const { result } = renderHook(() => useLocation());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      mockLocationService.initialize.mockClear();
      mockLocationService.initialize.mockResolvedValue(true);

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocationService.initialize).toHaveBeenCalled();
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
