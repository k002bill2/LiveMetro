---
name: location-services
description: GPS tracking, geofencing, and nearby station detection for LiveMetro. Use when implementing location-based features.
---

# Location Services Guidelines

## Architecture

LiveMetro uses Expo Location API with battery-optimized tracking:

```
GPS Hardware → Expo Location → LocationService → React Components
                                     ↓
                               Geofencing Logic
                               Nearby Stations
```

## Core Service (src/services/location/locationService.ts)

### 1. Service Initialization

```typescript
import * as Location from 'expo-location';

class LocationService {
  private static instance: LocationService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking: boolean = false;

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Initialize location services and request permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Location permission denied');
        return false;
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        console.warn('Location services disabled');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Location initialization error:', error);
      return false;
    }
  }

  /**
   * Get current position once
   */
  async getCurrentPosition(): Promise<Location.LocationObject | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return location;
    } catch (error) {
      console.error('Error getting current position:', error);
      return null;
    }
  }
}

export const locationService = LocationService.getInstance();
```

### 2. Real-time Location Tracking

```typescript
/**
 * Start continuous location tracking
 * Battery-optimized with configurable accuracy
 */
async startLocationTracking(
  callback: (location: Location.LocationObject) => void,
  options: {
    accuracy?: Location.Accuracy;
    distanceInterval?: number;
    timeInterval?: number;
  } = {}
): Promise<boolean> {
  if (this.isTracking) {
    console.warn('Already tracking location');
    return true;
  }

  try {
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: options.accuracy || Location.Accuracy.Balanced,
        distanceInterval: options.distanceInterval || 100, // meters
        timeInterval: options.timeInterval || 10000, // milliseconds
      },
      (location) => {
        callback(location);
      }
    );

    this.isTracking = true;
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
}

/**
 * Stop location tracking to save battery
 */
stopLocationTracking(): void {
  if (this.locationSubscription) {
    this.locationSubscription.remove();
    this.locationSubscription = null;
    this.isTracking = false;
  }
}

/**
 * Check if currently tracking
 */
isCurrentlyTracking(): boolean {
  return this.isTracking;
}
```

### 3. Geofencing for Station Proximity

```typescript
/**
 * Station geofence configuration
 */
interface StationGeofence {
  stationId: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
}

private activeGeofences: Map<string, StationGeofence> = new Map();

/**
 * Add geofence for a station
 */
addStationGeofence(geofence: StationGeofence): void {
  this.activeGeofences.set(geofence.stationId, geofence);
}

/**
 * Remove geofence for a station
 */
removeStationGeofence(stationId: string): void {
  this.activeGeofences.delete(stationId);
}

/**
 * Check if location is within any geofence
 */
checkGeofences(
  location: Location.LocationObject,
  onEnter: (stationId: string) => void,
  onExit: (stationId: string) => void
): void {
  this.activeGeofences.forEach((geofence, stationId) => {
    const distance = this.calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      geofence.latitude,
      geofence.longitude
    );

    if (distance <= geofence.radius) {
      onEnter(stationId);
    } else {
      onExit(stationId);
    }
  });
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
private calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

## Custom Hook Pattern (src/hooks/useLocation.ts)

```typescript
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { locationService } from '@services/location/locationService';

interface UseLocationReturn {
  location: Location.LocationObject | null;
  error: string | null;
  loading: boolean;
  refreshLocation: () => Promise<void>;
}

/**
 * Hook for accessing current location
 */
export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLocation = async () => {
    setLoading(true);
    setError(null);

    const initialized = await locationService.initialize();
    if (!initialized) {
      setError('위치 권한이 필요합니다');
      setLoading(false);
      return;
    }

    const currentLocation = await locationService.getCurrentPosition();
    if (currentLocation) {
      setLocation(currentLocation);
    } else {
      setError('위치를 가져올 수 없습니다');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return {
    location,
    error,
    loading,
    refreshLocation: fetchLocation,
  };
};
```

## Nearby Stations Hook (src/hooks/useNearbyStations.ts)

```typescript
import { useState, useEffect, useMemo } from 'react';
import * as Location from 'expo-location';
import { locationService } from '@services/location/locationService';
import type { Station } from '@models/train';

interface UseNearbyStationsOptions {
  radius?: number; // Search radius in meters
  maxResults?: number;
}

/**
 * Hook for finding nearby subway stations
 */
export const useNearbyStations = (
  location: Location.LocationObject | null,
  options: UseNearbyStationsOptions = {}
): Station[] => {
  const { radius = 1000, maxResults = 10 } = options;
  const [allStations, setAllStations] = useState<Station[]>([]);

  useEffect(() => {
    // Load all stations from Firebase/AsyncStorage
    loadStations().then(setAllStations);
  }, []);

  const nearbyStations = useMemo(() => {
    if (!location || allStations.length === 0) {
      return [];
    }

    const { latitude, longitude } = location.coords;

    // Calculate distance for each station
    const stationsWithDistance = allStations.map((station) => ({
      ...station,
      distance: locationService.calculateDistance(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      ),
    }));

    // Filter by radius and sort by distance
    return stationsWithDistance
      .filter((station) => station.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);
  }, [location, allStations, radius, maxResults]);

  return nearbyStations;
};
```

## Permission Handling

```typescript
/**
 * Request location permissions with user-friendly messaging
 */
export const requestLocationPermissions = async (): Promise<{
  granted: boolean;
  message?: string;
}> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    switch (status) {
      case 'granted':
        return { granted: true };

      case 'denied':
        return {
          granted: false,
          message: '위치 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.',
        };

      default:
        return {
          granted: false,
          message: '위치 권한을 확인할 수 없습니다.',
        };
    }
  } catch (error) {
    console.error('Permission request error:', error);
    return {
      granted: false,
      message: '권한 요청 중 오류가 발생했습니다.',
    };
  }
};

/**
 * Request background location permissions (iOS only)
 */
export const requestBackgroundPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Background permission error:', error);
    return false;
  }
};
```

## Battery Optimization

### 1. Adaptive Accuracy

```typescript
/**
 * Choose accuracy based on app state and battery level
 */
const getOptimalAccuracy = (
  appState: string,
  batteryLevel: number
): Location.Accuracy => {
  // High precision when app is active and battery is good
  if (appState === 'active' && batteryLevel > 0.5) {
    return Location.Accuracy.High;
  }

  // Balanced for normal use
  if (batteryLevel > 0.2) {
    return Location.Accuracy.Balanced;
  }

  // Low power mode
  return Location.Accuracy.Low;
};
```

### 2. Intelligent Tracking Intervals

```typescript
/**
 * Adjust tracking intervals based on user activity
 */
const getTrackingInterval = (
  userMoving: boolean,
  nearStation: boolean
): number => {
  // Frequent updates when near station and moving
  if (nearStation && userMoving) {
    return 5000; // 5 seconds
  }

  // Moderate updates when moving
  if (userMoving) {
    return 15000; // 15 seconds
  }

  // Infrequent updates when stationary
  return 60000; // 1 minute
};
```

## Location Component Pattern

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { useLocation } from '@hooks/useLocation';
import { useNearbyStations } from '@hooks/useNearbyStations';

export const NearbyStationsScreen: React.FC = () => {
  const { location, error, loading, refreshLocation } = useLocation();
  const nearbyStations = useNearbyStations(location, { radius: 500 });

  if (loading) {
    return <Text>위치 정보를 가져오는 중...</Text>;
  }

  if (error) {
    return (
      <View>
        <Text>{error}</Text>
        <Button title="다시 시도" onPress={refreshLocation} />
      </View>
    );
  }

  return (
    <View>
      <Text>주변 역 {nearbyStations.length}개</Text>
      {nearbyStations.map((station) => (
        <Text key={station.id}>
          {station.name} ({Math.round(station.distance)}m)
        </Text>
      ))}
    </View>
  );
};
```

## Testing Location Services

```typescript
import { locationService } from '@services/location/locationService';

// Mock location for testing
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 37.5665,
        longitude: 126.9780,
      },
    })
  ),
}));

describe('LocationService', () => {
  it('should get current position', async () => {
    const location = await locationService.getCurrentPosition();
    expect(location).toBeTruthy();
    expect(location?.coords.latitude).toBe(37.5665);
  });
});
```

## Remember

- ✅ Always request permissions before accessing location
- ✅ Use appropriate accuracy levels to save battery
- ✅ Stop tracking when not needed
- ✅ Handle permission denied gracefully
- ✅ Implement geofencing for nearby station notifications
- ✅ Use Haversine formula for distance calculations
- ✅ Consider battery level when choosing accuracy
- ✅ Test with mock locations
- ✅ Provide clear user messaging for permission requests

## Additional Resources

- [Expo Location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [iOS Location Permissions](https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services)
- [Android Location Permissions](https://developer.android.com/training/location/permissions)
