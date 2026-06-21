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

export interface AdaptiveRadiusResult {
  stations: NearbyStation[];
  effectiveRadius: number; // Actually used radius in meters
  expanded: boolean; // Whether radius was expanded from initial
}

/** Adaptive radius configuration */
const ADAPTIVE_RADIUS_STEPS: readonly number[] = [600, 1000, 1500] as const;
const ADAPTIVE_MIN_STATIONS = 3;

/** Freshness window (ms) for the last-known-position fallback. Matches the
 * 60s location cache guidance — a fix older than this is treated as stale. */
const LAST_KNOWN_MAX_AGE_MS = 60_000;

/** Max acceptable horizontal accuracy radius (meters) for a usable live fix.
 * A fix coarser than this is cell-tower-grade: its uncertainty band spans
 * roughly the whole nearby-station search radius, so it cannot reliably place
 * the user among ~500m-spaced stations. Such a fix is treated as a transient
 * miss — the caller falls through to the last-known fix or a lower-accuracy
 * retry instead of rendering a wrong station as definitive. */
const MAX_ACCEPTABLE_ACCURACY_M = 500;

/** Required accuracy (meters) for the last-known-position fallback. `maxAge`
 * alone bounds staleness but not quality: a fresh-but-coarse cached fix would
 * otherwise pass. Asking expo-location for this bound makes it return null for
 * coarse cached fixes, so the chain advances to a live retry. */
export const LAST_KNOWN_REQUIRED_ACCURACY_M = 100;

/** Distance (meters) under which two nearby-search results are treated as the
 * same physical station and merged. The same complex can register under
 * different names (e.g. '서울'/'서울역', ~94m apart), which name-only dedup
 * left as two separate cards. Kept well below Seoul metro's ~300m+ station
 * spacing so genuinely distinct adjacent stations are never collapsed. */
const DEDUP_PROXIMITY_M = 100;

/** Upper bound (ms) for a single live `getCurrentPositionAsync` attempt.
 * expo-location's LocationOptions has no timeout, so a cold/indoor GPS fix can
 * hang indefinitely and block the first render. After this, the attempt is
 * treated as a transient miss so the chain advances to the Balanced retry. */
const LIVE_FIX_TIMEOUT_MS = 8000;

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

/**
 * Location tracking mode configuration
 */
export type LocationTrackingMode = 'normal' | 'batteryEfficient' | 'highAccuracy';

export interface LocationTrackingConfig {
  mode: LocationTrackingMode;
  accuracy: Location.Accuracy;
  distanceInterval: number;
  timeInterval: number;
}

const TRACKING_CONFIGS: Record<LocationTrackingMode, Omit<LocationTrackingConfig, 'mode'>> = {
  normal: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50, // 50m - 도시 환경에서 적절
    timeInterval: 10000,  // 10초
  },
  batteryEfficient: {
    accuracy: Location.Accuracy.Low,
    distanceInterval: 500, // 500m - 배터리 효율 최적화
    timeInterval: 60000,   // 1분
  },
  highAccuracy: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,  // 10m - 정밀 추적
    timeInterval: 5000,    // 5초
  },
};

class LocationService {
  private currentLocation: LocationCoordinates | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundLocationSubscription: Location.LocationSubscription | null = null;
  private hasPermission: boolean = false;
  private hasBackgroundPermission: boolean = false;
  private isTracking: boolean = false;
  private currentTrackingMode: LocationTrackingMode = 'normal';
  private geofences: Map<string, GeofenceRegion> = new Map();

  /**
   * Initialize location service and request foreground permissions only
   * Background permission should be requested separately with proper UI explanation
   */
  async initialize(): Promise<boolean> {
    try {
      // Check current permission status first
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

      if (currentStatus === 'granted') {
        this.hasPermission = true;

        // Check background permission status
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        this.hasBackgroundPermission = bgStatus === 'granted';

        return true;
      }

      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission not granted');
        return false;
      }

      this.hasPermission = true;
      console.log('Location service initialized successfully (foreground only)');
      return true;
    } catch (error) {
      console.error('Failed to initialize location service:', error);
      return false;
    }
  }

  /**
   * Request background location permission with proper status check
   * Should be called after showing explanation UI to the user
   */
  async requestBackgroundPermission(): Promise<boolean> {
    try {
      if (!this.hasPermission) {
        const initialized = await this.initialize();
        if (!initialized) return false;
      }

      const { status: currentStatus } = await Location.getBackgroundPermissionsAsync();

      if (currentStatus === 'granted') {
        this.hasBackgroundPermission = true;
        return true;
      }

      const { status } = await Location.requestBackgroundPermissionsAsync();
      this.hasBackgroundPermission = status === 'granted';

      if (!this.hasBackgroundPermission) {
        console.warn('Background location permission not granted');
      }

      return this.hasBackgroundPermission;
    } catch (error) {
      console.error('Failed to request background permission:', error);
      return false;
    }
  }

  /**
   * Check if background permission is granted
   */
  hasBackgroundLocationPermission(): boolean {
    return this.hasBackgroundPermission;
  }

  /**
   * Get current location.
   *
   * `getCurrentPositionAsync` can fail *transiently*: iOS reports
   * `kCLErrorLocationUnknown` (Error Domain=kCLErrorDomain Code=0) when it
   * cannot resolve a fix right away — cold GPS, indoors, or a simulator with no
   * location set. Apple's guidance is to treat that as "keep trying", not a hard
   * failure. So rather than surfacing `null` on every transient miss (which the
   * UI renders as "현재 위치를 가져올 수 없습니다"), we degrade gracefully to the
   * most recent cached fix from `getLastKnownPositionAsync`.
   */
  async getCurrentLocation(highAccuracy: boolean = false): Promise<LocationCoordinates | null> {
    if (!this.hasPermission) {
      if (__DEV__) {
        console.warn('getCurrentLocation called before location permission was granted');
      }
      return null;
    }

    // Prefer a recent, sufficiently-accurate cached fix first. getLastKnownLocation
    // is gated by requiredAccuracy (100m), so it returns null for coarse caches and
    // only short-circuits when a good fix is instantly available. expo's own
    // guidance is to try the last-known fix before a (slow) live one when a fast
    // response matters and high precision does not — exactly the nearby-station
    // case. This keeps the fast path from being trapped behind a cold-start fix.
    const lastKnown = await this.getLastKnownLocation();
    if (lastKnown) {
      return lastKnown;
    }

    // No good cache — take a live fix. Use High (not BestForNavigation) for the
    // high-accuracy path: navigation-grade fixes are GPS-only and the slowest /
    // most failure-prone on a cold start, while ~10m is ample for nearby stations.
    const primaryAccuracy = highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced;
    const primary = await this.tryGetPosition(primaryAccuracy);
    if (primary) {
      return primary;
    }

    // Live fix missed (e.g. iOS kCLErrorLocationUnknown on a cold GPS, or it
    // timed out) — retry once at Balanced accuracy, which can resolve via
    // wifi/cell positioning (fast, works indoors) where a GPS-grade fix could not.
    if (primaryAccuracy !== Location.Accuracy.Balanced) {
      const balanced = await this.tryGetPosition(Location.Accuracy.Balanced);
      if (balanced) {
        return balanced;
      }
    }

    return null;
  }

  /**
   * Attempt a single live position fix at the given accuracy. Returns coordinates
   * on success, or null on a (transient) failure — kCLErrorLocationUnknown, cold
   * GPS, etc. — without throwing, so callers can fall through to the last known
   * position or a lower-accuracy retry. The dev-only warning keeps a transient
   * miss from becoming red error noise on every poll.
   */
  private async tryGetPosition(
    accuracy: Location.Accuracy
  ): Promise<LocationCoordinates | null> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bound the live fix: getCurrentPositionAsync has no timeout option, so a
      // cold/indoor GPS request can hang indefinitely. Race it against a timer;
      // if the timer wins, treat it as a transient miss (null) so the caller can
      // fall through to a Balanced retry instead of blocking the UI forever.
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy }),
        new Promise<null>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(null), LIVE_FIX_TIMEOUT_MS);
        }),
      ]);

      if (!location) {
        if (__DEV__) {
          console.warn(
            `getCurrentPositionAsync(accuracy=${accuracy}) timed out after ${LIVE_FIX_TIMEOUT_MS}ms; treating as a miss`
          );
        }
        return null;
      }

      const coordinates = this.toCoordinates(location.coords);

      // Reject a fix whose reported uncertainty is too large to place the user
      // among nearby stations. Treat it like a transient miss (return null) so
      // the caller can fall through to the last-known fix or a Balanced retry,
      // rather than caching/returning a coarse fix as if it were definitive.
      if (
        coordinates.accuracy != null &&
        coordinates.accuracy > MAX_ACCEPTABLE_ACCURACY_M
      ) {
        if (__DEV__) {
          console.warn(
            `getCurrentPositionAsync(accuracy=${accuracy}) returned a coarse fix (${coordinates.accuracy}m > ${MAX_ACCEPTABLE_ACCURACY_M}m); rejecting`
          );
        }
        return null;
      }

      this.currentLocation = coordinates;
      return coordinates;
    } catch (error) {
      if (__DEV__) {
        console.warn(`getCurrentPositionAsync(accuracy=${accuracy}) failed:`, error);
      }
      return null;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Return the device's last cached fix (within LAST_KNOWN_MAX_AGE_MS), or null
   * when no recent fix is available. Used as a graceful fallback when a live fix
   * cannot be obtained.
   */
  private async getLastKnownLocation(): Promise<LocationCoordinates | null> {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
      });

      if (!lastKnown) {
        return null;
      }

      const coordinates = this.toCoordinates(lastKnown.coords);
      this.currentLocation = coordinates;
      return coordinates;
    } catch (error) {
      if (__DEV__) {
        console.warn('getLastKnownPositionAsync failed:', error);
      }
      return null;
    }
  }

  /**
   * Map an expo-location coords payload to our internal coordinate shape.
   */
  private toCoordinates(coords: Location.LocationObjectCoords): LocationCoordinates {
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      // `?? undefined` (not `|| undefined`): a legitimate accuracy of 0 (a
      // precise fix) must survive instead of being coerced to undefined, so a
      // downstream gate can distinguish "precise 0" from "unknown accuracy".
      accuracy: coords.accuracy ?? undefined,
    };
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
      mode?: LocationTrackingMode;
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

      // Use mode-based config if provided, otherwise use individual options
      const mode = options?.mode || 'normal';
      const modeConfig = TRACKING_CONFIGS[mode];

      this.currentTrackingMode = mode;

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy ?? modeConfig.accuracy,
          distanceInterval: options?.distanceInterval ?? modeConfig.distanceInterval,
          timeInterval: options?.timeInterval ?? modeConfig.timeInterval,
        },
        (location) => {
          const coordinates: LocationCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? undefined,
          };

          this.currentLocation = coordinates;
          callback(coordinates);
        }
      );

      this.isTracking = true;
      console.log(`Location tracking started (mode: ${mode})`);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Start battery-efficient location tracking
   * Uses lower accuracy and longer intervals to conserve battery
   */
  async startBatteryEfficientTracking(
    callback: (location: LocationCoordinates) => void
  ): Promise<boolean> {
    return this.startLocationTracking(callback, { mode: 'batteryEfficient' });
  }

  /**
   * Start high-accuracy location tracking
   * Uses highest accuracy for precise location (e.g., station arrival detection)
   */
  async startHighAccuracyTracking(
    callback: (location: LocationCoordinates) => void
  ): Promise<boolean> {
    return this.startLocationTracking(callback, { mode: 'highAccuracy' });
  }

  /**
   * Get current tracking mode
   */
  getCurrentTrackingMode(): LocationTrackingMode {
    return this.currentTrackingMode;
  }

  /**
   * Get tracking configuration for a specific mode
   */
  getTrackingConfig(mode: LocationTrackingMode): LocationTrackingConfig {
    return { mode, ...TRACKING_CONFIGS[mode] };
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
    nearbyStations.sort((a, b) => a.distance - b.distance);

    // Dedup co-located stations. The list is distance-sorted, so keep the
    // closest entry and drop any later one that is either the same name OR
    // within DEDUP_PROXIMITY_M of an already-kept entry. Name-only dedup left
    // the same physical complex under different names (e.g. '서울'/'서울역',
    // ~94m apart) as two separate cards.
    const deduped: NearbyStation[] = [];
    for (const station of nearbyStations) {
      const isDuplicate = deduped.some(
        kept =>
          kept.name === station.name ||
          this.calculateDistance(
            kept.coordinates.latitude,
            kept.coordinates.longitude,
            station.coordinates.latitude,
            station.coordinates.longitude
          ) < DEDUP_PROXIMITY_M
      );
      if (!isDuplicate) {
        deduped.push(station);
      }
    }

    return deduped;
  }

  /**
   * Find nearby stations with adaptive radius expansion.
   * Starts at initialRadius and expands through ADAPTIVE_RADIUS_STEPS
   * until minStations are found or max radius is reached.
   *
   * When `maxRadius` is provided, expansion is hard-capped: `initialRadius`
   * is clamped down to `maxRadius` and no expansion step beyond `maxRadius`
   * is considered. Callers that need a strict radius (e.g. HomeScreen's
   * "주변 역" card) pass `maxRadius` equal to their desired radius to opt out
   * of adaptive expansion entirely. Omitting `maxRadius` keeps the original
   * unbounded expansion behaviour.
   */
  findNearbyStationsAdaptive(
    currentLocation: LocationCoordinates,
    allStations: Station[],
    initialRadius: number = ADAPTIVE_RADIUS_STEPS[0] ?? 1000,
    minStations: number = ADAPTIVE_MIN_STATIONS,
    maxRadius?: number
  ): AdaptiveRadiusResult {
    // Clamp the starting radius so an explicit cap is never exceeded.
    const cappedInitial =
      maxRadius != null ? Math.min(initialRadius, maxRadius) : initialRadius;

    // Build step list: start at the (clamped) initial radius, then add
    // larger expansion steps that still fall within the cap.
    const steps = [
      cappedInitial,
      ...ADAPTIVE_RADIUS_STEPS.filter(
        r => r > cappedInitial && (maxRadius == null || r <= maxRadius)
      ),
    ];

    for (const radius of steps) {
      const stations = this.findNearbyStations(currentLocation, allStations, radius);
      if (stations.length >= minStations || radius === steps[steps.length - 1]) {
        return {
          stations,
          effectiveRadius: radius,
          expanded: radius > cappedInitial,
        };
      }
    }

    // Fallback (should not reach here due to loop logic)
    const fallbackRadius = steps[steps.length - 1] ?? cappedInitial;
    return {
      stations: this.findNearbyStations(currentLocation, allStations, fallbackRadius),
      effectiveRadius: fallbackRadius,
      expanded: fallbackRadius > cappedInitial,
    };
  }

  /**
   * Get the closest station to current location
   */
  getClosestStation(
    currentLocation: LocationCoordinates,
    allStations: Station[]
  ): NearbyStation | null {
    const nearbyStations = this.findNearbyStations(currentLocation, allStations, 2000); // 2km radius
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
