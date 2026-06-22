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
  getLastKnownPositionAsync: jest.fn(),
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

    it('dedups same-location stations with different names (서울/서울역, within ~100m)', () => {
      // The 서울역 complex registers '서울역' (1호선) and '서울' (GTX-A) ~89m
      // apart under different names; name-only dedup left both as separate
      // cards. Coordinate-proximity dedup collapses them into one.
      const sameComplex: Station[] = [
        {
          id: 'seoul-station-1',
          name: '서울역',
          nameEn: 'Seoul Station',
          lineId: '1',
          coordinates: { latitude: 37.5547, longitude: 126.9707 },
          transfers: ['4'],
        },
        {
          id: 'seoul-gtxa',
          name: '서울',
          nameEn: 'Seoul',
          lineId: 'GTX-A',
          coordinates: { latitude: 37.5555, longitude: 126.9707 }, // ~89m from 서울역
          transfers: [],
        },
        {
          id: 'sicheong',
          name: '시청역',
          nameEn: 'City Hall',
          lineId: '1',
          coordinates: { latitude: 37.5577, longitude: 126.9707 }, // ~333m from 서울역
          transfers: ['2'],
        },
      ];

      const location: LocationCoordinates = { latitude: 37.5547, longitude: 126.9707 };
      const result = locationService.findNearbyStations(location, sameComplex, 2000);

      // 서울역/서울 collapse to one (the closest), 시청역 stays separate.
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('서울역');
      expect(result.some(s => s.name === '시청역')).toBe(true);
    });

    it('does not merge distinct nearby stations more than ~100m apart', () => {
      // Safety guard: the proximity threshold must not collapse genuinely
      // distinct adjacent stations (Seoul metro stations are ~300m+ apart).
      const distinctStations: Station[] = [
        {
          id: 'a', name: '역A', nameEn: 'A', lineId: '2',
          coordinates: { latitude: 37.5, longitude: 127.0 },
          transfers: [],
        },
        {
          id: 'b', name: '역B', nameEn: 'B', lineId: '2',
          coordinates: { latitude: 37.503, longitude: 127.0 }, // ~333m away
          transfers: [],
        },
      ];

      const location: LocationCoordinates = { latitude: 37.5, longitude: 127.0 };
      const result = locationService.findNearbyStations(location, distinctStations, 2000);

      expect(result).toHaveLength(2);
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

  describe('findNearbyStationsAdaptive', () => {
    const adaptiveLocation: LocationCoordinates = {
      latitude: 37.5,
      longitude: 127.0,
    };

    const makeStation = (id: string, latOffset: number): Station => ({
      id,
      name: id,
      nameEn: id,
      lineId: '2',
      coordinates: { latitude: 37.5 + latOffset, longitude: 127.0 },
      transfers: [],
    });

    // All three within 600m (0m / ~222m / ~445m)
    const closeStations: Station[] = [
      makeStation('near1', 0),
      makeStation('near2', 0.002),
      makeStation('near3', 0.004),
    ];

    // Spread out: 0m / ~890m / ~1334m — needs expansion to gather 3
    const spreadStations: Station[] = [
      makeStation('near1', 0),
      makeStation('far1', 0.008),
      makeStation('far2', 0.012),
    ];

    it('should not expand when minStations are found at the initial radius', () => {
      const result = locationService.findNearbyStationsAdaptive(
        adaptiveLocation,
        closeStations,
        600,
        3
      );

      expect(result.stations).toHaveLength(3);
      expect(result.effectiveRadius).toBe(600);
      expect(result.expanded).toBe(false);
    });

    it('should expand through ADAPTIVE_RADIUS_STEPS when maxRadius is omitted', () => {
      const result = locationService.findNearbyStationsAdaptive(
        adaptiveLocation,
        spreadStations,
        600,
        3
      );

      // Expands 600 -> 1000 -> 1500 until all 3 are gathered
      expect(result.stations).toHaveLength(3);
      expect(result.effectiveRadius).toBe(1500);
      expect(result.expanded).toBe(true);
    });

    it('should not expand beyond maxRadius even if fewer than minStations are found', () => {
      const result = locationService.findNearbyStationsAdaptive(
        adaptiveLocation,
        spreadStations,
        500,
        3,
        500 // maxRadius cap — disables expansion
      );

      // Only near1 is within 500m; expansion is suppressed by the cap
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0]?.id).toBe('near1');
      expect(result.effectiveRadius).toBe(500);
      expect(result.expanded).toBe(false);
    });

    it('should clamp initialRadius down to maxRadius when initialRadius is larger', () => {
      const result = locationService.findNearbyStationsAdaptive(
        adaptiveLocation,
        spreadStations,
        1000, // larger than the cap
        3,
        500 // maxRadius cap
      );

      expect(result.effectiveRadius).toBe(500);
      expect(result.expanded).toBe(false);
      expect(result.stations).toHaveLength(1);
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
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);

      const location = await locationService.getCurrentLocation();

      expect(location).toBeNull();
    });

    it('falls back to last known position when the live fix fails transiently', async () => {
      // iOS kCLErrorLocationUnknown (Code=0) / cold GPS: the live request throws,
      // but a recent cached fix should still be returned instead of null.
      mockLocation.getCurrentPositionAsync.mockRejectedValue(
        new Error('Cannot obtain current location: Error Domain=kCLErrorDomain Code=0 "(null)"')
      );
      mockLocation.getLastKnownPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5547,
          longitude: 126.9707,
          accuracy: 65,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location).not.toBeNull();
      expect(location?.latitude).toBe(37.5547);
      expect(location?.longitude).toBe(126.9707);
      expect(location?.accuracy).toBe(65);
    });

    it('returns null when both the live fix and last known position are unavailable', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(
        new Error('Error Domain=kCLErrorDomain Code=0 "(null)"')
      );
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);

      const location = await locationService.getCurrentLocation();

      expect(location).toBeNull();
    });

    it('requests High (not navigation-grade) accuracy for the high-accuracy fix', async () => {
      // BestForNavigation is GPS-only and the slowest/most failure-prone on a
      // cold start; High (~10m) is ample for nearby-station use.
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 8,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation(true);

      expect(location?.latitude).toBe(37.5);
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: Location.Accuracy.High,
      });
    });

    it('retries at Balanced accuracy when the high-accuracy fix fails and no last known position exists', async () => {
      // Real-device cold GPS: the high-accuracy (GPS-only) request throws
      // kCLErrorLocationUnknown and there is no cached fix, but a lower-accuracy
      // request resolves via wifi/cell positioning.
      mockLocation.getCurrentPositionAsync
        .mockRejectedValueOnce(
          new Error('Cannot obtain current location: Error Domain=kCLErrorDomain Code=0 "(null)"')
        )
        .mockResolvedValueOnce({
          coords: {
            latitude: 37.5172,
            longitude: 127.0473,
            accuracy: 140,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            speed: 0,
          },
          timestamp: Date.now(),
        });
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);

      const location = await locationService.getCurrentLocation(true);

      expect(location).not.toBeNull();
      expect(location?.latitude).toBe(37.5172);
      expect(location?.accuracy).toBe(140);
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenNthCalledWith(1, {
        accuracy: Location.Accuracy.High,
      });
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenNthCalledWith(2, {
        accuracy: Location.Accuracy.Balanced,
      });
    });

    it('prefers a good last-known fix and skips the slow live request entirely', async () => {
      // Reorder: a recent, sufficiently-accurate cached fix (gated to ≤100m by
      // getLastKnownLocation) should short-circuit the chain so the first render
      // is not blocked on a cold-start GPS fix.
      mockLocation.getLastKnownPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 50,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location?.accuracy).toBe(50);
      expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('bounds a hanging live fix with a timeout and falls through to the Balanced retry', async () => {
      // getCurrentPositionAsync has no timeout option, so a cold/indoor GPS fix
      // can hang forever. The live attempt must be bounded so the chain advances.
      jest.useFakeTimers();
      try {
        mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
        mockLocation.getCurrentPositionAsync
          .mockReturnValueOnce(
            new Promise<Location.LocationObject>(() => {
              /* never resolves — cold/indoor GPS */
            })
          )
          .mockResolvedValueOnce({
            coords: {
              latitude: 37.5,
              longitude: 127.0,
              accuracy: 120,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: 0,
          });

        const pending = locationService.getCurrentLocation(true);
        await jest.advanceTimersByTimeAsync(15000);
        const location = await pending;

        expect(location?.accuracy).toBe(120);
        expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    }, 10000);
  });

  describe('accuracy gating (coarse-fix rejection)', () => {
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
      // clearAllMocks() resets call data but NOT the mockResolvedValueOnce queue;
      // a once-value left unconsumed by one test would leak into the next. Reset
      // the two position mocks so each test in this block starts from a clean slate.
      mockLocation.getCurrentPositionAsync.mockReset();
      mockLocation.getLastKnownPositionAsync.mockReset();
    });

    it('rejects a coarse live fix (accuracy > 500m) and falls back to last known position', async () => {
      // A cell-tower-only fix (~2km radius) cannot place the user among
      // ~500m-spaced stations, so it must be treated as a miss — not accepted as
      // definitive. The precise cached fix should win instead.
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 2000,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });
      mockLocation.getLastKnownPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5547,
          longitude: 126.9707,
          accuracy: 60,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location?.latitude).toBe(37.5547);
      expect(location?.accuracy).toBe(60);
    });

    it('falls through to the Balanced retry when the high-accuracy fix is too coarse', async () => {
      // A coarse High fix (e.g. 1500m, indoors) must not be accepted; the code
      // should drop to the Balanced (wifi/cell) retry, which can resolve a
      // usable fix where GPS-grade could not.
      mockLocation.getCurrentPositionAsync
        .mockResolvedValueOnce({
          coords: {
            latitude: 37.9,
            longitude: 127.9,
            accuracy: 1500,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            speed: 0,
          },
          timestamp: Date.now(),
        })
        .mockResolvedValueOnce({
          coords: {
            latitude: 37.5,
            longitude: 127.0,
            accuracy: 40,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            speed: 0,
          },
          timestamp: Date.now(),
        });
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);

      const location = await locationService.getCurrentLocation(true);

      expect(location?.latitude).toBe(37.5);
      expect(location?.accuracy).toBe(40);
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenNthCalledWith(1, {
        accuracy: Location.Accuracy.High,
      });
      expect(mockLocation.getCurrentPositionAsync).toHaveBeenNthCalledWith(2, {
        accuracy: Location.Accuracy.Balanced,
      });
    });

    it('accepts a fix at the 500m accuracy boundary (threshold is strict >, not >=)', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 500,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location?.latitude).toBe(37.5);
      expect(location?.accuracy).toBe(500);
    });

    it('returns a coarse live fix as a last resort instead of null when no accurate fix is available', async () => {
      // Real-device cold start indoors: the only fixes available are coarse
      // (>500m via wifi/cell) and there is no usable cached fix. Returning null
      // here renders an empty "주변 역" section. Accept the coarse fix as a last
      // resort so downstream can show approximate stations flagged 추정 —
      // "빈 데이터 금지" beats a blank screen.
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 1200,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location).not.toBeNull();
      expect(location?.latitude).toBe(37.5);
      expect(location?.accuracy).toBe(1200);
    });

    it('still rejects an absurdly coarse fix beyond the last-resort ceiling (returns null)', async () => {
      // The last-resort accepts a coarse fix, but not an unbounded one: a ~5km
      // fix is too vague to drive a "주변 역" list even when flagged 추정 (a wrong
      // definitive-looking nearest station, location-services BP#5). Past the
      // ceiling, an honest empty screen beats a confidently-misplaced list.
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 5000,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location).toBeNull();
    });

    it('preserves a reported accuracy of 0 instead of dropping it to undefined', async () => {
      // toCoordinates used `accuracy || undefined`, which silently coerced a
      // legitimate 0 (a precise fix) to undefined. `?? undefined` keeps the 0 so
      // a downstream accuracy gate can tell "precise 0" from "unknown".
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: {
          latitude: 37.5,
          longitude: 127.0,
          accuracy: 0,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationService.getCurrentLocation();

      expect(location?.accuracy).toBe(0);
    });

    it('requests last known position with a requiredAccuracy bound, not just maxAge', async () => {
      // maxAge bounds staleness but NOT quality: a 60s-fresh cell-tower fix
      // (~2km) would otherwise pass. requiredAccuracy makes expo-location itself
      // return null for coarse cached fixes, so the fallback chain advances.
      mockLocation.getCurrentPositionAsync.mockRejectedValue(
        new Error('Error Domain=kCLErrorDomain Code=0 "(null)"')
      );
      mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);

      await locationService.getCurrentLocation();

      expect(mockLocation.getLastKnownPositionAsync).toHaveBeenCalledWith(
        expect.objectContaining({ maxAge: 60000, requiredAccuracy: 100 })
      );
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

  describe('startLocationTracking accuracy preservation', () => {
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
      await locationService.stopLocationTracking();
    });

    it('preserves a precise (accuracy 0) fix from the watch callback instead of mangling it to undefined', async () => {
      // Regression: `location.coords.accuracy || undefined` coerced a precise 0
      // fix to undefined, so a perfect tracked fix was reported as "unknown".
      let watchCallback:
        | ((location: { coords: { latitude: number; longitude: number; accuracy: number } }) => void)
        | undefined;
      (mockLocation.watchPositionAsync as jest.Mock).mockImplementation((_opts, cb) => {
        watchCallback = cb;
        return Promise.resolve({ remove: jest.fn() });
      });

      const received: LocationCoordinates[] = [];
      await locationService.startLocationTracking((coords) => received.push(coords));

      watchCallback?.({ coords: { latitude: 37.5, longitude: 127.0, accuracy: 0 } });

      expect(received).toHaveLength(1);
      expect(received[0]?.accuracy).toBe(0);
    });
  });
});
