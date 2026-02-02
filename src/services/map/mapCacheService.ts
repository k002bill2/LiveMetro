/**
 * Map Cache Service
 * Caches map data for offline usage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// ============================================================================
// Types
// ============================================================================

/**
 * Cached map data
 */
export interface CachedMapData {
  readonly version: string;
  readonly stations: readonly CachedStation[];
  readonly lines: readonly CachedLine[];
  readonly transfers: readonly CachedTransfer[];
  readonly lastUpdated: string;
}

/**
 * Cached station
 */
export interface CachedStation {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly lineIds: readonly string[];
  readonly coordinates: {
    readonly x: number;
    readonly y: number;
  };
  readonly facilities?: readonly string[];
  readonly exits?: readonly StationExit[];
}

/**
 * Station exit info
 */
export interface StationExit {
  readonly number: string;
  readonly description: string;
  readonly landmarks?: readonly string[];
}

/**
 * Cached line
 */
export interface CachedLine {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly stations: readonly string[];
  readonly segments: readonly LineSegment[];
}

/**
 * Line segment for drawing
 */
export interface LineSegment {
  readonly fromStation: string;
  readonly toStation: string;
  readonly isBranch: boolean;
}

/**
 * Cached transfer
 */
export interface CachedTransfer {
  readonly stationId: string;
  readonly fromLine: string;
  readonly toLine: string;
  readonly walkingTime: number;
  readonly instructions?: string;
}

/**
 * Cache status
 */
export interface CacheStatus {
  readonly isAvailable: boolean;
  readonly version: string | null;
  readonly lastUpdated: Date | null;
  readonly sizeBytes: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  MAP_DATA: '@livemetro:map_cache',
  VERSION: '@livemetro:map_cache_version',
  LAST_UPDATED: '@livemetro:map_cache_updated',
};

const CACHE_DIR = `${FileSystem.cacheDirectory}maps/`;
const CURRENT_VERSION = '1.0.0';

// ============================================================================
// Service
// ============================================================================

class MapCacheService {
  private cachedData: CachedMapData | null = null;
  private initialized = false;

  /**
   * Initialize cache service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      // Load cached data
      await this.loadFromStorage();
    } catch {
      // Ignore initialization errors
    }

    this.initialized = true;
  }

  /**
   * Get cached map data
   */
  async getMapData(): Promise<CachedMapData | null> {
    await this.initialize();
    return this.cachedData;
  }

  /**
   * Save map data to cache
   */
  async cacheMapData(data: CachedMapData): Promise<void> {
    await this.initialize();

    try {
      const dataString = JSON.stringify(data);
      await AsyncStorage.setItem(STORAGE_KEYS.MAP_DATA, dataString);
      await AsyncStorage.setItem(STORAGE_KEYS.VERSION, data.version);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATED, data.lastUpdated);

      this.cachedData = data;
    } catch (error) {
      console.error('Failed to cache map data:', error);
    }
  }

  /**
   * Get cache status
   */
  async getCacheStatus(): Promise<CacheStatus> {
    await this.initialize();

    try {
      const [version, lastUpdatedStr, dataStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.VERSION),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED),
        AsyncStorage.getItem(STORAGE_KEYS.MAP_DATA),
      ]);

      return {
        isAvailable: !!dataStr,
        version,
        lastUpdated: lastUpdatedStr ? new Date(lastUpdatedStr) : null,
        sizeBytes: dataStr ? dataStr.length : 0,
      };
    } catch {
      return {
        isAvailable: false,
        version: null,
        lastUpdated: null,
        sizeBytes: 0,
      };
    }
  }

  /**
   * Check if cache needs update
   */
  async needsUpdate(): Promise<boolean> {
    const status = await this.getCacheStatus();

    if (!status.isAvailable) return true;
    if (status.version !== CURRENT_VERSION) return true;

    // Check if cache is older than 7 days
    if (status.lastUpdated) {
      const daysSinceUpdate = (Date.now() - status.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 7) return true;
    }

    return false;
  }

  /**
   * Get station by ID
   */
  async getStation(stationId: string): Promise<CachedStation | null> {
    const data = await this.getMapData();
    if (!data) return null;

    return data.stations.find(s => s.id === stationId) ?? null;
  }

  /**
   * Get line by ID
   */
  async getLine(lineId: string): Promise<CachedLine | null> {
    const data = await this.getMapData();
    if (!data) return null;

    return data.lines.find(l => l.id === lineId) ?? null;
  }

  /**
   * Get stations for a line
   */
  async getLineStations(lineId: string): Promise<readonly CachedStation[]> {
    const data = await this.getMapData();
    if (!data) return [];

    const line = data.lines.find(l => l.id === lineId);
    if (!line) return [];

    return data.stations.filter(s => line.stations.includes(s.id));
  }

  /**
   * Get transfer info for a station
   */
  async getTransferInfo(stationId: string): Promise<readonly CachedTransfer[]> {
    const data = await this.getMapData();
    if (!data) return [];

    return data.transfers.filter(t => t.stationId === stationId);
  }

  /**
   * Search stations by name
   */
  async searchStations(query: string): Promise<readonly CachedStation[]> {
    const data = await this.getMapData();
    if (!data || !query) return [];

    const lowerQuery = query.toLowerCase();
    return data.stations.filter(
      s => s.name.toLowerCase().includes(lowerQuery) ||
           s.nameEn.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get nearby stations
   */
  async getNearbyStations(
    x: number,
    y: number,
    radius: number
  ): Promise<readonly CachedStation[]> {
    const data = await this.getMapData();
    if (!data) return [];

    return data.stations.filter(station => {
      const dx = station.coordinates.x - x;
      const dy = station.coordinates.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= radius;
    });
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.MAP_DATA,
        STORAGE_KEYS.VERSION,
        STORAGE_KEYS.LAST_UPDATED,
      ]);

      // Clear cache directory
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      }

      this.cachedData = null;
    } catch (error) {
      console.error('Failed to clear map cache:', error);
    }
  }

  /**
   * Get default map data for Seoul Metro
   */
  getDefaultMapData(): CachedMapData {
    // This would be bundled with the app
    return {
      version: CURRENT_VERSION,
      stations: this.getDefaultStations(),
      lines: this.getDefaultLines(),
      transfers: this.getDefaultTransfers(),
      lastUpdated: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Load cached data from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_KEYS.MAP_DATA);
      if (dataStr) {
        this.cachedData = JSON.parse(dataStr);
      }
    } catch {
      this.cachedData = null;
    }
  }

  /**
   * Get default stations (subset for example)
   */
  private getDefaultStations(): CachedStation[] {
    return [
      { id: '201', name: '시청', nameEn: 'City Hall', lineIds: ['1', '2'], coordinates: { x: 500, y: 400 } },
      { id: '202', name: '을지로입구', nameEn: 'Euljiro 1-ga', lineIds: ['2'], coordinates: { x: 520, y: 400 } },
      { id: '203', name: '을지로3가', nameEn: 'Euljiro 3-ga', lineIds: ['2', '3'], coordinates: { x: 540, y: 400 } },
      { id: '204', name: '을지로4가', nameEn: 'Euljiro 4-ga', lineIds: ['2', '5'], coordinates: { x: 560, y: 400 } },
      { id: '205', name: '동대문역사문화공원', nameEn: 'DDP', lineIds: ['2', '4', '5'], coordinates: { x: 580, y: 400 } },
      { id: '206', name: '신당', nameEn: 'Sindang', lineIds: ['2', '6'], coordinates: { x: 600, y: 400 } },
      { id: '222', name: '강남', nameEn: 'Gangnam', lineIds: ['2'], coordinates: { x: 600, y: 500 } },
      { id: '223', name: '역삼', nameEn: 'Yeoksam', lineIds: ['2'], coordinates: { x: 620, y: 500 } },
      { id: '224', name: '선릉', nameEn: 'Seolleung', lineIds: ['2', '분당'], coordinates: { x: 640, y: 500 } },
      { id: '225', name: '삼성', nameEn: 'Samsung', lineIds: ['2'], coordinates: { x: 660, y: 500 } },
    ];
  }

  /**
   * Get default lines (subset for example)
   */
  private getDefaultLines(): CachedLine[] {
    return [
      {
        id: '2',
        name: '2호선',
        color: '#00A84D',
        stations: ['201', '202', '203', '204', '205', '206', '222', '223', '224', '225'],
        segments: [
          { fromStation: '201', toStation: '202', isBranch: false },
          { fromStation: '202', toStation: '203', isBranch: false },
          { fromStation: '203', toStation: '204', isBranch: false },
          { fromStation: '204', toStation: '205', isBranch: false },
          { fromStation: '205', toStation: '206', isBranch: false },
          { fromStation: '222', toStation: '223', isBranch: false },
          { fromStation: '223', toStation: '224', isBranch: false },
          { fromStation: '224', toStation: '225', isBranch: false },
        ],
      },
    ];
  }

  /**
   * Get default transfers (subset for example)
   */
  private getDefaultTransfers(): CachedTransfer[] {
    return [
      { stationId: '201', fromLine: '1', toLine: '2', walkingTime: 3 },
      { stationId: '203', fromLine: '2', toLine: '3', walkingTime: 4 },
      { stationId: '204', fromLine: '2', toLine: '5', walkingTime: 5 },
      { stationId: '205', fromLine: '2', toLine: '4', walkingTime: 4 },
      { stationId: '205', fromLine: '2', toLine: '5', walkingTime: 5 },
      { stationId: '206', fromLine: '2', toLine: '6', walkingTime: 3 },
      { stationId: '224', fromLine: '2', toLine: '분당', walkingTime: 4 },
    ];
  }
}

// ============================================================================
// Export
// ============================================================================

export const mapCacheService = new MapCacheService();
export default mapCacheService;
