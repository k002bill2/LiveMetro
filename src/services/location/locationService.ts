/**
 * Location-based Service
 * GPS tracking, automatic station detection, and location-based notifications
 */

import * as Location from 'expo-location';
import { Station } from '../../models/train';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface NearbyStation extends Station {
  distance: number; // Distance in meters
  bearing?: number; // Bearing in degrees
}

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

class LocationService {
  private currentLocation: LocationCoordinates | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundLocationSubscription: Location.LocationSubscription | null = null;
  private hasPermission: boolean = false;
  private isTracking: boolean = false;
  private geofences: Map<string, GeofenceRegion> = new Map();
  private readonly MIN_DISTANCE_CHANGE = 10; // meters
  private readonly MIN_TIME_INTERVAL = 5000; // 5 seconds

  /**
   * Initialize location service and request permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission not granted');
        return false;
      }

      // Request background location permission for better user experience
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted, but continuing with foreground only');
      }

      this.hasPermission = true;
      console.log('Location service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize location service:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(highAccuracy: boolean = false): Promise<LocationCoordinates | null> {
    try {
      if (!this.hasPermission) {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: highAccuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
      });

      const coordinates: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };

      this.currentLocation = coordinates;
      return coordinates;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Start continuous location tracking
   */
  async startLocationTracking(
    callback: (location: LocationCoordinates) => void,
    options?: {
      accuracy?: Location.Accuracy;
      distanceInterval?: number;
      timeInterval?: number;
    }
  ): Promise<boolean> {
    try {
      if (!this.hasPermission) {
        throw new Error('Location permission not granted');
      }

      if (this.isTracking) {
        console.warn('Location tracking already active');
        return true;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy || Location.Accuracy.Balanced,
          distanceInterval: options?.distanceInterval || this.MIN_DISTANCE_CHANGE,
          timeInterval: options?.timeInterval || this.MIN_TIME_INTERVAL,
        },
        (location) => {
          const coordinates: LocationCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          };

          this.currentLocation = coordinates;
          callback(coordinates);
        }
      );

      this.isTracking = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  stopLocationTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.backgroundLocationSubscription) {
      this.backgroundLocationSubscription.remove();
      this.backgroundLocationSubscription = null;
    }

    this.isTracking = false;
    console.log('Location tracking stopped');
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate bearing from one point to another
   */
  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = this.toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  /**
   * Find nearby stations within specified radius
   */
  findNearbyStations(
    currentLocation: LocationCoordinates,
    allStations: Station[],
    radiusMeters: number = 1000
  ): NearbyStation[] {
    const nearbyStations: NearbyStation[] = [];

    for (const station of allStations) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        station.coordinates.latitude,
        station.coordinates.longitude
      );

      if (distance <= radiusMeters) {
        const bearing = this.calculateBearing(
          currentLocation.latitude,
          currentLocation.longitude,
          station.coordinates.latitude,
          station.coordinates.longitude
        );

        nearbyStations.push({
          ...station,
          distance,
          bearing,
        });
      }
    }

    // Sort by distance
    return nearbyStations.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get the closest station to current location
   */
  getClosestStation(
    currentLocation: LocationCoordinates,
    allStations: Station[]
  ): NearbyStation | null {
    const nearbyStations = this.findNearbyStations(currentLocation, allStations, 5000); // 5km radius
    return nearbyStations.at(0) ?? null;
  }

  /**
   * Check if user is within a station's vicinity
   */
  isWithinStationVicinity(
    currentLocation: LocationCoordinates,
    station: Station,
    radiusMeters: number = 100
  ): boolean {
    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      station.coordinates.latitude,
      station.coordinates.longitude
    );

    return distance <= radiusMeters;
  }

  /**
   * Add geofence for a station
   */
  addStationGeofence(
    station: Station,
    radiusMeters: number = 50,
    notifyOnEntry: boolean = true,
    notifyOnExit: boolean = false
  ): void {
    const geofence: GeofenceRegion = {
      identifier: `station_${station.id}`,
      latitude: station.coordinates.latitude,
      longitude: station.coordinates.longitude,
      radius: radiusMeters,
      notifyOnEntry,
      notifyOnExit,
    };

    this.geofences.set(geofence.identifier, geofence);
    console.log(`Added geofence for station: ${station.name}`);
  }

  /**
   * Remove geofence
   */
  removeGeofence(identifier: string): void {
    this.geofences.delete(identifier);
    console.log(`Removed geofence: ${identifier}`);
  }

  /**
   * Check geofence triggers (call this from location tracking callback)
   */
  checkGeofenceTriggers(
    currentLocation: LocationCoordinates
  ): { geofence: GeofenceRegion; triggered: 'entry' | 'exit' }[] {
    const triggers: { geofence: GeofenceRegion; triggered: 'entry' | 'exit' }[] = [];

    for (const geofence of this.geofences.values()) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;

      // Simple geofence logic - in a real app, you'd track previous state
      if (isInside && geofence.notifyOnEntry) {
        triggers.push({ geofence, triggered: 'entry' });
      } else if (!isInside && geofence.notifyOnExit) {
        triggers.push({ geofence, triggered: 'exit' });
      }
    }

    return triggers;
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<Location.LocationGeocodedAddress[]> {
    try {
      if (!this.hasPermission) {
        throw new Error('Location permission not granted');
      }

      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      return addresses;
    } catch (error) {
      console.error('Error getting address from coordinates:', error);
      return [];
    }
  }

  /**
   * Check if location services are enabled
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  /**
   * Get current location if available, null otherwise
   */
  getCurrentLocationSync(): LocationCoordinates | null {
    return this.currentLocation;
  }

  /**
   * Check if location tracking is active
   */
  isLocationTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Get permission status
   */
  hasLocationPermission(): boolean {
    return this.hasPermission;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Get distance category for UI purposes
   */
  getDistanceCategory(meters: number): 'very-close' | 'close' | 'nearby' | 'far' {
    if (meters <= 100) return 'very-close';
    if (meters <= 300) return 'close';
    if (meters <= 1000) return 'nearby';
    return 'far';
  }
}

// Export singleton instance
export const locationService = new LocationService();
