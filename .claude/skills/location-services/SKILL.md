---
name: location-services
description: Location services, GPS tracking, and geolocation features using Expo Location. Use when implementing location-based functionality like finding nearby stations.
---

# Location Services Guidelines

## When to Use This Skill
- Requesting location permissions
- Getting user's current position
- Finding nearby subway stations
- Calculating distances between coordinates
- Implementing location-based features

## Core Setup

### 1. Installation
```bash
npx expo install expo-location
```

### 2. Configuration (app.json)
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "LiveMetro needs your location to find nearby subway stations and provide arrival notifications."
      }
    },
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

## Permission Handling

### useLocation Hook Pattern
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

## Permission States

### Handling All Permission States
```typescript
import * as Location from 'expo-location';

const checkLocationPermission = async (): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> => {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

  switch (status) {
    case 'granted':
      return { granted: true, canAskAgain: true };

    case 'denied':
      // User denied but can ask again
      return { granted: false, canAskAgain };

    case 'undetermined':
      // Never asked before
      return { granted: false, canAskAgain: true };

    default:
      return { granted: false, canAskAgain: false };
  }
};

// UI Component
const LocationPermissionPrompt: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('');

  const handleRequest = async () => {
    const { granted, canAskAgain } = await checkLocationPermission();

    if (granted) {
      // Proceed with location features
    } else if (!canAskAgain) {
      // Show instructions to enable in settings
      Alert.alert(
        'Location Permission Required',
        'Please enable location access in Settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  // Render permission prompt UI
};
```

## Geolocation Features

### 1. Finding Nearby Stations
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
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        {
          latitude: station.coordinates.latitude,
          longitude: station.coordinates.longitude,
        }
      ),
    }))
    .filter(station => station.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
};
```

### 2. useNearbyStations Hook
```typescript
export const useNearbyStations = (maxDistance = 1000) => {
  const { location } = useLocation();
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);

  useEffect(() => {
    if (!location) return;

    const fetchNearbyStations = async () => {
      // Fetch all stations (from Firebase or cache)
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

### 3. Distance Formatting
```typescript
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};
```

## Background Location (Optional)

### Background Tracking Setup
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
    // Handle location update
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

## Error Handling

### Common Location Errors
```typescript
const handleLocationError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('permission')) {
      return 'Location permission is required';
    }
    if (error.message.includes('timeout')) {
      return 'Location request timed out. Please try again.';
    }
    if (error.message.includes('unavailable')) {
      return 'Location services are unavailable';
    }
  }
  return 'Failed to get location';
};
```

## Performance Optimization

### Accuracy Levels
```typescript
// Choose appropriate accuracy for use case
const accuracyLevels = {
  // Battery-friendly, ~3000m accuracy
  lowest: Location.Accuracy.Lowest,

  // Good for nearby stations, ~1000m accuracy
  low: Location.Accuracy.Low,

  // Balanced option, ~100m accuracy
  balanced: Location.Accuracy.Balanced,

  // High accuracy, ~10m
  high: Location.Accuracy.High,

  // Best accuracy, uses GPS
  highest: Location.Accuracy.Highest,
};

// Example: Use balanced for nearby stations
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});
```

### Caching Location
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

## Testing

### Mock Location Data
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
}));
```

## Best Practices

### 1. Request Permission at Right Time
```tsx
// ❌ Bad: Request on app launch
useEffect(() => {
  requestLocationPermission();
}, []);

// ✅ Good: Request when user needs feature
const handleFindNearby = async () => {
  const hasPermission = await requestLocationPermission();
  if (hasPermission) {
    // Proceed with location feature
  }
};
```

### 2. Provide Clear Messaging
```tsx
<View>
  <Text>
    We need your location to find nearby subway stations and provide
    personalized arrival notifications.
  </Text>
  <Button title="Enable Location" onPress={requestPermission} />
</View>
```

### 3. Handle Offline Gracefully
```typescript
const getLocationSafely = async (): Promise<LocationObject | null> => {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch (error) {
    // Return last known location or null
    return cachedLocation;
  }
};
```

## Important Notes
- Always explain WHY you need location permission
- Request permission when user needs the feature, not on app start
- Handle permission denial gracefully
- Use appropriate accuracy level to save battery
- Cache location data when appropriate
- Test on both iOS and Android (permission flows differ)
