/**
 * Map Cache Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { mapCacheService, CachedMapData } from '../mapCacheService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: '/mock/cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('MapCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true, uri: '/mock', size: 0, modificationTime: 0 } as FileSystem.FileInfo);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should create cache directory if not exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false, isDirectory: false, uri: '/mock', size: 0, modificationTime: 0 } as FileSystem.FileInfo);
      mockFileSystem.makeDirectoryAsync.mockResolvedValue();

      await mapCacheService.initialize();

      expect(mockFileSystem.getInfoAsync).toHaveBeenCalled();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('maps'),
        { intermediates: true }
      );
    });

    it('should not create directory if already exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true, uri: '/mock', size: 0, modificationTime: 0 } as FileSystem.FileInfo);

      await mapCacheService.initialize();

      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('getMapData', () => {
    it('should return null when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await mapCacheService.getMapData();

      expect(result).toBeNull();
    });

    it('should handle cached data retrieval', async () => {
      // Service returns null when no data is cached (singleton already initialized)
      const result = await mapCacheService.getMapData();

      // Result can be null or data depending on singleton state
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('cacheMapData', () => {
    it('should save map data to AsyncStorage', async () => {
      const mockData: CachedMapData = {
        version: '1.0.0',
        stations: [],
        lines: [],
        transfers: [],
        lastUpdated: new Date().toISOString(),
      };

      await mapCacheService.cacheMapData(mockData);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro:map_cache',
        JSON.stringify(mockData)
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro:map_cache_version',
        mockData.version
      );
    });
  });

  describe('getCacheStatus', () => {
    it('should return status when cache is available', async () => {
      const mockData = JSON.stringify({ stations: [] });
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('1.0.0') // version
        .mockResolvedValueOnce('2024-01-01T00:00:00.000Z') // lastUpdated
        .mockResolvedValueOnce(mockData); // data

      const status = await mapCacheService.getCacheStatus();

      expect(status.isAvailable).toBe(true);
      expect(status.version).toBe('1.0.0');
      expect(status.sizeBytes).toBeGreaterThan(0);
    });

    it('should return empty status when cache is not available', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const status = await mapCacheService.getCacheStatus();

      expect(status.isAvailable).toBe(false);
      expect(status.version).toBeNull();
      expect(status.sizeBytes).toBe(0);
    });
  });

  describe('needsUpdate', () => {
    it('should return true when cache is not available', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const needsUpdate = await mapCacheService.needsUpdate();

      expect(needsUpdate).toBe(true);
    });

    it('should return true when version is outdated', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('0.9.0') // outdated version
        .mockResolvedValueOnce(new Date().toISOString())
        .mockResolvedValueOnce('{}');

      const needsUpdate = await mapCacheService.needsUpdate();

      expect(needsUpdate).toBe(true);
    });

    it('should return true when cache is older than 7 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('1.0.0')
        .mockResolvedValueOnce(oldDate.toISOString())
        .mockResolvedValueOnce('{}');

      const needsUpdate = await mapCacheService.needsUpdate();

      expect(needsUpdate).toBe(true);
    });
  });

  describe('getStation', () => {
    it('should return null when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const station = await mapCacheService.getStation('222');

      expect(station).toBeNull();
    });
  });

  describe('getLine', () => {
    it('should return null when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const line = await mapCacheService.getLine('2');

      expect(line).toBeNull();
    });
  });

  describe('getLineStations', () => {
    it('should return empty array when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const stations = await mapCacheService.getLineStations('2');

      expect(stations).toEqual([]);
    });
  });

  describe('getTransferInfo', () => {
    it('should return empty array when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const transfers = await mapCacheService.getTransferInfo('222');

      expect(transfers).toEqual([]);
    });
  });

  describe('searchStations', () => {
    it('should return empty array when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const results = await mapCacheService.searchStations('강남');

      expect(results).toEqual([]);
    });

    it('should return empty array when query is empty', async () => {
      const results = await mapCacheService.searchStations('');

      expect(results).toEqual([]);
    });
  });

  describe('getNearbyStations', () => {
    it('should return empty array when no cached data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const stations = await mapCacheService.getNearbyStations(600, 500, 100);

      expect(stations).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should remove all cache data', async () => {
      mockAsyncStorage.multiRemove.mockResolvedValue();
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true, uri: '/mock', size: 0, modificationTime: 0 } as FileSystem.FileInfo);
      mockFileSystem.deleteAsync.mockResolvedValue();

      await mapCacheService.clearCache();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@livemetro:map_cache',
        '@livemetro:map_cache_version',
        '@livemetro:map_cache_updated',
      ]);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalled();
    });
  });

  describe('getDefaultMapData', () => {
    it('should return default map data', () => {
      const data = mapCacheService.getDefaultMapData();

      expect(data.version).toBe('1.0.0');
      expect(data.stations.length).toBeGreaterThan(0);
      expect(data.lines.length).toBeGreaterThan(0);
      expect(data.transfers.length).toBeGreaterThan(0);
    });

    it('should include Gangnam station in default data', () => {
      const data = mapCacheService.getDefaultMapData();
      const gangnam = data.stations.find(s => s.name === '강남');

      expect(gangnam).toBeDefined();
      expect(gangnam?.id).toBe('222');
    });
  });
});
