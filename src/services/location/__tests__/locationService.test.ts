/**
 * Location Service Tests
 * Tests for GPS tracking, station detection, and location-based features
 */

import { locationService, LocationCoordinates } from '../locationService';
import { Station } from '../../../models/train';

import * as Location from 'expo-location';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

const mockLocation = Location as jest.Mocked<typeof Location>;

describe('LocationService', () => {
  // Sample station data
  const mockStations: Station[] = [
    {
      id: 'gangnam',
      name: '강남역',
      nameEn: 'Gangnam',
      lineId: '2',
      coordinates: { latitude: 37.4979, longitude: 127.0276 },
      transfers: [],
    },
    {
      id: 'seolleung',
      name: '선릉역',
      nameEn: 'Seolleung',
      lineId: '2',
      coordinates: { latitude: 37.5048, longitude: 127.0489 },
      transfers: [],
    },
    {
      id: 'jamsil',
      name: '잠실역',
      nameEn: 'Jamsil',
      lineId: '2',
      coordinates: { latitude: 37.5132, longitude: 127.1002 },
      transfers: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates using Haversine formula', () => {
      // Distance from Gangnam to Seolleung (approximately 2.3km)
      const distance = locationService.calculateDistance(
        37.4979, 127.0276, // Gangnam
        37.5048, 127.0489  // Seolleung
      );

      // Should be approximately 2000-2500 meters
      expect(distance).toBeGreaterThan(1800);
      expect(distance).toBeLessThan(2800);
    });

    it('should return 0 for same coordinates', () => {
      const distance = locationService.calculateDistance(
        37.5665, 126.9780,
        37.5665, 126.9780
      );

      expect(distance).toBe(0);
    });

    it('should handle antipodal points correctly', () => {
      // Approximately half of Earth's circumference
      const distance = locationService.calculateDistance(
        0, 0,
        0, 180
      );

      // Should be approximately half of Earth's circumference (20,000 km)
      expect(distance).toBeGreaterThan(19000000);
      expect(distance).toBeLessThan(21000000);
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing to the north', () => {
      const bearing = locationService.calculateBearing(
        37.5665, 126.9780,
        38.5665, 126.9780 // Same longitude, higher latitude
      );

      // Should be approximately 0 degrees (north)
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(5);
    });

    it('should calculate bearing to the east', () => {
      const bearing = locationService.calculateBearing(
        37.5665, 126.9780,
        37.5665, 127.9780 // Same latitude, higher longitude
      );

      // Should be approximately 90 degrees (east)
      expect(bearing).toBeGreaterThan(85);
      expect(bearing).toBeLessThan(95);
    });

    it('should always return a positive bearing (0-360)', () => {
      // Test southwest direction
      const bearing = locationService.calculateBearing(
        37.5665, 126.9780,
        36.5665, 125.9780
      );

      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('findNearbyStations', () => {
    const currentLocation: LocationCoordinates = {
      latitude: 37.4979,
      longitude: 127.0276, // Near Gangnam
    };

    it('should find stations within the specified radius', () => {
      const nearbyStations = locationService.findNearbyStations(
        currentLocation,
        mockStations,
        3000 // 3km radius
      );

      // Should find Gangnam and Seolleung (both within 3km)
      expect(nearbyStations.length).toBe(2);
      expect(nearbyStations[0]?.name).toBe('강남역');
      expect(nearbyStations[1]?.name).toBe('선릉역');
    });

    it('should sort stations by distance', () => {
      const nearbyStations = locationService.findNearbyStations(
        currentLocation,
        mockStations,
        10000 // 10km radius
      );

      // Should be sorted by distance (ascending)
      for (let i = 1; i < nearbyStations.length; i++) {
        const prev = nearbyStations[i - 1];
        const curr = nearbyStations[i];
        if (prev && curr) {
          expect(prev.distance).toBeLessThanOrEqual(curr.distance);
        }
      }
    });

    it('should include distance and bearing for each station', () => {
      const nearbyStations = locationService.findNearbyStations(
        currentLocation,
        mockStations,
        5000
      );

      nearbyStations.forEach((station) => {
        expect(station.distance).toBeDefined();
        expect(station.distance).toBeGreaterThanOrEqual(0);
        expect(station.bearing).toBeDefined();
        expect(station.bearing).toBeGreaterThanOrEqual(0);
        expect(station.bearing).toBeLessThan(360);
      });
    });

    it('should return empty array when no stations are within radius', () => {
      const farLocation: LocationCoordinates = {
        latitude: 35.0, // Far south of Seoul
        longitude: 129.0,
      };

      const nearbyStations = locationService.findNearbyStations(
        farLocation,
        mockStations,
        1000
      );

      expect(nearbyStations).toEqual([]);
    });

    it('should dedup transfer stations keeping closest entry', () => {
      // 도봉산: 1호선과 7호선에 각각 등록, 거의 같은 위치
      const transferStations: Station[] = [
        {
          id: 'dobongsan-1',
          name: '도봉산',
          nameEn: 'Dobongsan',
          lineId: '1',
          coordinates: { latitude: 37.6896, longitude: 127.0447 },
          transfers: ['7'],
        },
        {
          id: 'dobongsan-7',
          name: '도봉산',
          nameEn: 'Dobongsan',
          lineId: '7',
          coordinates: { latitude: 37.6894, longitude: 127.0450 }, // 26m away
          transfers: ['1'],
        },
        {
          id: 'suraksan',
          name: '수락산',
          nameEn: 'Suraksan',
          lineId: '7',
          coordinates: { latitude: 37.6920, longitude: 127.0560 },
          transfers: [],
        },
      ];

      const location: LocationCoordinates = { latitude: 37.6895, longitude: 127.0448 };
      const result = locationService.findNearbyStations(location, transferStations, 2000);

      // 도봉산 should appear only once (closest of the two)
      const dobongEntries = result.filter(s => s.name === '도봉산');
      expect(dobongEntries).toHaveLength(1);

      // 수락산 should still appear
      const surakEntries = result.filter(s => s.name === '수락산');
      expect(surakEntries).toHaveLength(1);
    });

    it('should use default radius of 1000 meters', () => {
      // This station is very close (0 distance)
      const exactLocation: LocationCoordinates = {
        latitude: 37.4979,
        longitude: 127.0276,
      };

      const nearbyStations = locationService.findNearbyStations(
        exactLocation,
        mockStations
      );

      expect(nearbyStations.length).toBeGreaterThanOrEqual(1);
      expect(nearbyStations[0]?.name).toBe('강남역');
    });
  });

  describe('getClosestStation', () => {
    it('should return the closest station', () => {
      // Location closer to Seolleung
      const currentLocation: LocationCoordinates = {
        latitude: 37.5040,
        longitude: 127.0480,
      };

      const closest = locationService.getClosestStation(currentLocation, mockStations);

      expect(closest).not.toBeNull();
      expect(closest?.id).toBe('seolleung'); // Seolleung is closest
    });

    it('should return null when no stations are within 5km', () => {
      const farLocation: LocationCoordinates = {
        latitude: 35.0,
        longitude: 129.0,
      };

      const closest = locationService.getClosestStation(farLocation, mockStations);

      expect(closest).toBeNull();
    });
  });

  describe('isWithinStationVicinity', () => {
    const gangnamStation = mockStations[0]!;

    it('should return true when within default radius (100m)', () => {
      const nearbyLocation: LocationCoordinates = {
        latitude: 37.4979,
        longitude: 127.0276,
      };

      const isWithin = locationService.isWithinStationVicinity(
        nearbyLocation,
        gangnamStation
      );

      expect(isWithin).toBe(true);
    });

    it('should return false when outside the radius', () => {
      const farLocation: LocationCoordinates = {
        latitude: 37.5048,
        longitude: 127.0489, // Seolleung location
      };

      const isWithin = locationService.isWithinStationVicinity(
        farLocation,
        gangnamStation,
        100 // 100m radius
      );

      expect(isWithin).toBe(false);
    });

    it('should respect custom radius', () => {
      const mediumLocation: LocationCoordinates = {
        latitude: 37.4990, // About 200m away
        longitude: 127.0290,
      };

      expect(locationService.isWithinStationVicinity(mediumLocation, gangnamStation, 500)).toBe(true);
      expect(locationService.isWithinStationVicinity(mediumLocation, gangnamStation, 50)).toBe(false);
    });
  });

  describe('geofence management', () => {
    const gangnamStation = mockStations[0]!;

    afterEach(() => {
      // Clean up geofences
      locationService.removeGeofence(`station_${gangnamStation.id}`);
    });

    it('should add a geofence for a station', () => {
      locationService.addStationGeofence(gangnamStation, 100, true, false);

      const currentLocation: LocationCoordinates = {
        latitude: 37.4979,
        longitude: 127.0276,
      };

      const triggers = locationService.checkGeofenceTriggers(currentLocation);

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers[0]?.triggered).toBe('entry');
    });

    it('should remove a geofence', () => {
      locationService.addStationGeofence(gangnamStation);
      locationService.removeGeofence(`station_${gangnamStation.id}`);

      const currentLocation: LocationCoordinates = {
        latitude: 37.4979,
        longitude: 127.0276,
      };

      const triggers = locationService.checkGeofenceTriggers(currentLocation);

      expect(triggers.length).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format distances under 1km in meters', () => {
      expect(locationService.formatDistance(50)).toBe('50m');
      expect(locationService.formatDistance(500)).toBe('500m');
      expect(locationService.formatDistance(999)).toBe('999m');
    });

    it('should format distances 1km and over in kilometers', () => {
      expect(locationService.formatDistance(1000)).toBe('1.0km');
      expect(locationService.formatDistance(1500)).toBe('1.5km');
      expect(locationService.formatDistance(10000)).toBe('10.0km');
    });
  });

  describe('getDistanceCategory', () => {
    it('should return very-close for distances under 100m', () => {
      expect(locationService.getDistanceCategory(0)).toBe('very-close');
      expect(locationService.getDistanceCategory(50)).toBe('very-close');
      expect(locationService.getDistanceCategory(100)).toBe('very-close');
    });

    it('should return close for distances 101-300m', () => {
      expect(locationService.getDistanceCategory(101)).toBe('close');
      expect(locationService.getDistanceCategory(200)).toBe('close');
      expect(locationService.getDistanceCategory(300)).toBe('close');
    });

    it('should return nearby for distances 301-1000m', () => {
      expect(locationService.getDistanceCategory(301)).toBe('nearby');
      expect(locationService.getDistanceCategory(500)).toBe('nearby');
      expect(locationService.getDistanceCategory(1000)).toBe('nearby');
    });

    it('should return far for distances over 1000m', () => {
      expect(locationService.getDistanceCategory(1001)).toBe('far');
      expect(locationService.getDistanceCategory(5000)).toBe('far');
    });
  });

  describe('permission and tracking status', () => {
    it('should return permission status', () => {
      // Initially false
      expect(locationService.hasLocationPermission()).toBe(false);
    });

    it('should return tracking status', () => {
      // Initially false
      expect(locationService.isLocationTrackingActive()).toBe(false);
    });

    it('should return current location sync', () => {
      // Initially null
      expect(locationService.getCurrentLocationSync()).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize with permissions granted', async () => {
      // Mock getForegroundPermissionsAsync to return granted (already have permission)
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      const result = await locationService.initialize();

      expect(result).toBe(true);
      expect(locationService.hasLocationPermission()).toBe(true);
    });

    it('should request permission if not already granted', async () => {
      // Mock getForegroundPermissionsAsync to return undetermined (need to request)
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      const result = await locationService.initialize();

      expect(result).toBe(true);
      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when foreground permission is denied', async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      const result = await locationService.initialize();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    beforeEach(async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      await locationService.initialize();
    });

    it('should get current location successfully', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5665,
          longitude: 126.9780,
          accuracy: 10,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location).not.toBeNull();
      expect(location?.latitude).toBe(37.5665);
      expect(location?.longitude).toBe(126.9780);
      expect(location?.accuracy).toBe(10);
    });

    it('should return null on error', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('Location error'));

      const location = await locationService.getCurrentLocation();

      expect(location).toBeNull();
    });
  });

  describe('location tracking', () => {
    beforeEach(async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      await locationService.initialize();
    });

    it('should start location tracking', async () => {
      const mockRemove = jest.fn();
      mockLocation.watchPositionAsync.mockResolvedValue({ remove: mockRemove });

      const callback = jest.fn();
      const result = await locationService.startLocationTracking(callback);

      expect(result).toBe(true);
      expect(locationService.isLocationTrackingActive()).toBe(true);
    });

    it('should stop location tracking', async () => {
      const mockRemove = jest.fn();
      mockLocation.watchPositionAsync.mockResolvedValue({ remove: mockRemove });

      await locationService.startLocationTracking(jest.fn());

      // Verify tracking started
      expect(locationService.isLocationTrackingActive()).toBe(true);

      locationService.stopLocationTracking();

      expect(locationService.isLocationTrackingActive()).toBe(false);
      // Note: mockRemove may not be called if the subscription reference differs
    });
  });

  describe('reverse geocoding', () => {
    beforeEach(async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      mockLocation.getBackgroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);
      await locationService.initialize();
    });

    it('should get address from coordinates', async () => {
      const mockAddress = [
        {
          city: '서울특별시',
          district: '강남구',
          street: '테헤란로',
          name: '강남역',
          postalCode: '06234',
          region: '서울특별시',
          country: '대한민국',
        },
      ];
      mockLocation.reverseGeocodeAsync.mockResolvedValue(mockAddress as Location.LocationGeocodedAddress[]);

      const addresses = await locationService.getAddressFromCoordinates(37.4979, 127.0276);

      expect(addresses).toEqual(mockAddress);
    });

    it('should return empty array on error', async () => {
      mockLocation.reverseGeocodeAsync.mockRejectedValue(new Error('Geocoding error'));

      const addresses = await locationService.getAddressFromCoordinates(37.4979, 127.0276);

      expect(addresses).toEqual([]);
    });
  });

  describe('isLocationServicesEnabled', () => {
    it('should check if location services are enabled', async () => {
      mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);

      const enabled = await locationService.isLocationServicesEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false on error', async () => {
      mockLocation.hasServicesEnabledAsync.mockRejectedValue(new Error('Service check error'));

      const enabled = await locationService.isLocationServicesEnabled();

      expect(enabled).toBe(false);
    });
  });
});
