/**
 * Station Cache Service
 *
 * Provides caching layer for subway station data with AsyncStorage.
 * Supports TTL-based expiration and remote data synchronization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StationData } from '@utils/subwayMapData';

// ============================================================================
// Types
// ============================================================================

export interface StationCache {
  version: string;
  timestamp: number;
  ttl: number; // milliseconds
  data: Record<string, StationData>;
}

export interface LinesCache {
  version: string;
  timestamp: number;
  ttl: number;
  colors: Record<string, string>;
  stations: Record<string, string[]>;
}

export interface CacheStatus {
  hasStations: boolean;
  hasLines: boolean;
  stationsAge: number | null; // milliseconds since last update
  linesAge: number | null;
  isExpired: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  STATIONS: '@livemetro/stations_cache',
  LINES: '@livemetro/lines_cache',
  VERSION: '@livemetro/cache_version',
} as const;

// Default TTL: 7 days
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

// Current cache version - increment when data structure changes
const CACHE_VERSION = '1.0.0';

// ============================================================================
// Station Cache Service Class
// ============================================================================

class StationCacheService {
  private stationsCache: StationCache | null = null;
  private linesCache: LinesCache | null = null;
  private initialized: boolean = false;

  /**
   * Initialize cache service by loading from AsyncStorage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [stationsJson, linesJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.LINES),
      ]);

      if (stationsJson) {
        this.stationsCache = JSON.parse(stationsJson);
      }

      if (linesJson) {
        this.linesCache = JSON.parse(linesJson);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[StationCacheService] Failed to initialize:', error);
    }
  }

  /**
   * Get cached stations data
   */
  async getStations(): Promise<Record<string, StationData> | null> {
    await this.initialize();

    if (!this.stationsCache) return null;

    // Check if cache is expired
    if (this.isCacheExpired(this.stationsCache)) {
      console.log('[StationCacheService] Stations cache expired');
      return null;
    }

    return this.stationsCache.data;
  }

  /**
   * Get cached lines data
   */
  async getLines(): Promise<{ colors: Record<string, string>; stations: Record<string, string[]> } | null> {
    await this.initialize();

    if (!this.linesCache) return null;

    if (this.isCacheExpired(this.linesCache)) {
      console.log('[StationCacheService] Lines cache expired');
      return null;
    }

    return {
      colors: this.linesCache.colors,
      stations: this.linesCache.stations,
    };
  }

  /**
   * Save stations data to cache
   */
  async setStations(
    data: Record<string, StationData>,
    ttl: number = DEFAULT_TTL
  ): Promise<void> {
    const cache: StationCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      ttl,
      data,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(cache));
      this.stationsCache = cache;
      console.log(`[StationCacheService] Saved ${Object.keys(data).length} stations to cache`);
    } catch (error) {
      console.error('[StationCacheService] Failed to save stations:', error);
    }
  }

  /**
   * Save lines data to cache
   */
  async setLines(
    colors: Record<string, string>,
    stations: Record<string, string[]>,
    ttl: number = DEFAULT_TTL
  ): Promise<void> {
    const cache: LinesCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      ttl,
      colors,
      stations,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LINES, JSON.stringify(cache));
      this.linesCache = cache;
      console.log(`[StationCacheService] Saved ${Object.keys(stations).length} lines to cache`);
    } catch (error) {
      console.error('[StationCacheService] Failed to save lines:', error);
    }
  }

  /**
   * Get cache status
   */
  async getStatus(): Promise<CacheStatus> {
    await this.initialize();

    const now = Date.now();

    return {
      hasStations: this.stationsCache !== null,
      hasLines: this.linesCache !== null,
      stationsAge: this.stationsCache ? now - this.stationsCache.timestamp : null,
      linesAge: this.linesCache ? now - this.linesCache.timestamp : null,
      isExpired:
        (this.stationsCache ? this.isCacheExpired(this.stationsCache) : true) ||
        (this.linesCache ? this.isCacheExpired(this.linesCache) : true),
    };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.STATIONS),
        AsyncStorage.removeItem(STORAGE_KEYS.LINES),
        AsyncStorage.removeItem(STORAGE_KEYS.VERSION),
      ]);

      this.stationsCache = null;
      this.linesCache = null;

      console.log('[StationCacheService] Cache cleared');
    } catch (error) {
      console.error('[StationCacheService] Failed to clear cache:', error);
    }
  }

  /**
   * Check if cache data is expired
   */
  private isCacheExpired(cache: StationCache | LinesCache): boolean {
    const now = Date.now();
    const expirationTime = cache.timestamp + cache.ttl;
    return now > expirationTime || cache.version !== CACHE_VERSION;
  }

  /**
   * Force refresh cache from bundled JSON
   * Call this after app update to ensure latest data
   */
  async refreshFromBundle(): Promise<void> {
    try {
      // Import bundled data (static import at top level ensures it's always available)
      const { STATIONS, LINE_COLORS, LINE_STATIONS } = require('@utils/subwayMapData');

      await Promise.all([
        this.setStations(STATIONS),
        this.setLines(LINE_COLORS, LINE_STATIONS),
      ]);

      console.log('[StationCacheService] Refreshed from bundle');
    } catch (error) {
      console.error('[StationCacheService] Failed to refresh from bundle:', error);
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const stationCacheService = new StationCacheService();
