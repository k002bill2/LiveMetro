# Location Services - Code Examples

## useLocation Hook

```typescript
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import type { LocationObject } from 'expo-location';

interface UseLocationReturn {
  location: LocationObject | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setError('Location permission denied');
        return false;
      }

      return true;
    } catch (err) {
      setError('Failed to request location permission');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentLocation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    location,
    loading,
    error,
    requestPermission,
    refreshLocation: getCurrentLocation,
  };
};
```

---

## useNearbyStations Hook

```typescript
import { getDistance } from 'geolib';

interface Station {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

const findNearbyStations = (
  userLocation: { latitude: number; longitude: number },
  stations: Station[],
  maxDistance = 1000 // meters
): Station[] => {
  return stations
    .map(station => ({
      ...station,
      distance: getDistance(
        userLocation,
        station.coordinates
      ),
    }))
    .filter(station => station.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
};

export const useNearbyStations = (maxDistance = 1000) => {
  const { location } = useLocation();
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);

  useEffect(() => {
    if (!location) return;

    const fetchNearbyStations = async () => {
      const allStations = await stationService.getAllStations();
      const nearby = findNearbyStations(
        location.coords,
        allStations,
        maxDistance
      );
      setNearbyStations(nearby);
    };

    fetchNearbyStations();
  }, [location, maxDistance]);

  return nearbyStations;
};
```

---

## Background Location Tracking

```typescript
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    console.log('Background location update:', locations);
  }
});

// Start background location updates
const startBackgroundLocation = async () => {
  const { granted } = await Location.requestBackgroundPermissionsAsync();

  if (!granted) {
    console.log('Background location permission denied');
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000, // 1 minute
    distanceInterval: 100, // 100 meters
  });
};

// Stop background updates
const stopBackgroundLocation = async () => {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
};
```

---

## Permission States Handling

```typescript
const checkLocationPermission = async (): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> => {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

  switch (status) {
    case 'granted':
      return { granted: true, canAskAgain: true };
    case 'denied':
      return { granted: false, canAskAgain };
    case 'undetermined':
      return { granted: false, canAskAgain: true };
    default:
      return { granted: false, canAskAgain: false };
  }
};

// When permission denied permanently
if (!canAskAgain) {
  Alert.alert(
    'Location Permission Required',
    'Please enable location access in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() }
    ]
  );
}
```

---

## Location Caching

```typescript
let cachedLocation: LocationObject | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute

const getCachedLocation = async (): Promise<LocationObject> => {
  const now = Date.now();

  if (cachedLocation && now - lastFetchTime < CACHE_DURATION) {
    return cachedLocation;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  cachedLocation = location;
  lastFetchTime = now;

  return location;
};
```

---

## Testing Mocks

```typescript
// __tests__/useLocation.test.ts
const mockLocation: LocationObject = {
  coords: {
    latitude: 37.4979,
    longitude: 127.0276,
    altitude: null,
    accuracy: 100,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
};

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
  }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue(mockLocation),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
  },
}));
```

---

## Accuracy Selection Guide

```typescript
/**
 * Location Accuracy Selection for Seoul Subway App
 *
 * | Accuracy | Battery | Use Case |
 * |----------|---------|----------|
 * | Lowest   | Best    | City-level (not recommended) |
 * | Low      | Good    | District-level (~1km) |
 * | Balanced | Medium  | Station finding (~100m) - RECOMMENDED |
 * | High     | Poor    | Walking navigation (~10m) |
 * | Highest  | Worst   | Precise tracking (~1m) |
 */

const getAccuracyForUseCase = (
  useCase: 'nearby_stations' | 'walking_navigation' | 'background'
): Location.Accuracy => {
  switch (useCase) {
    case 'nearby_stations':
      return Location.Accuracy.Balanced; // ~100m is enough
    case 'walking_navigation':
      return Location.Accuracy.High; // Need precision
    case 'background':
      return Location.Accuracy.Low; // Save battery
    default:
      return Location.Accuracy.Balanced;
  }
};
```

---

## Error Recovery Pattern

```typescript
const getLocationWithFallback = async (): Promise<{
  location: LocationObject | null;
  source: 'gps' | 'cached' | 'default';
}> => {
  // Try GPS first
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });
    return { location, source: 'gps' };
  } catch (gpsError) {
    console.log('GPS failed, trying cached location');
  }

  // Fallback to last known location
  try {
    const cached = await Location.getLastKnownPositionAsync();
    if (cached) {
      return { location: cached, source: 'cached' };
    }
  } catch (cacheError) {
    console.log('Cache failed, using default');
  }

  // Ultimate fallback: Seoul Station coordinates
  const defaultLocation: LocationObject = {
    coords: {
      latitude: 37.5546,
      longitude: 126.9706,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };

  return { location: defaultLocation, source: 'default' };
};
```

---

## Distance Calculation Utilities

```typescript
import { getDistance, isPointWithinRadius } from 'geolib';

/**
 * Calculate distance between two points in meters
 */
const calculateDistance = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number => {
  return getDistance(from, to);
};

/**
 * Format distance for display
 */
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

/**
 * Check if station is within walking distance
 */
const isWalkable = (
  userLocation: { latitude: number; longitude: number },
  stationLocation: { latitude: number; longitude: number },
  maxWalkingDistance = 500 // meters
): boolean => {
  return isPointWithinRadius(stationLocation, userLocation, maxWalkingDistance);
};
```
