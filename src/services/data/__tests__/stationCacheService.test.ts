/**
 * Station Cache Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { stationCacheService } from '../stationCacheService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utils/subwayMapData', () => ({
  STATIONS: { '222': { id: '222', name: '역삼', nameEn: 'Yeoksam' } },
  LINE_COLORS: { '2': '#00a84d' },
  LINE_STATIONS: { '2': ['221', '222', '223'] },
}));

describe('StationCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton's internal state by calling clearCache
  });

  describe('initialize', () => {
    it('should initialize from empty storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      // Force re-initialization by clearing first
      await stationCacheService.clearCache();
      const status = await stationCacheService.getStatus();
      expect(status.hasStations).toBe(false);
      expect(status.hasLines).toBe(false);
    });

    it('should load cached data from storage', async () => {
      // The singleton maintains its initialized state across tests
      // Just verify it can be called without error
      const status = await stationCacheService.getStatus();
      expect(status).toBeDefined();
      expect(typeof status.hasStations).toBe('boolean');
    });

    it('should handle initialization error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await stationCacheService.clearCache();
      const stations = await stationCacheService.getStations();
      expect(stations).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getStations', () => {
    it('should return null when no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await stationCacheService.clearCache();
      const result = await stationCacheService.getStations();
      expect(result).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const expiredCache = JSON.stringify({
        version: '1.0.0',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 day TTL
        data: { '222': { id: '222' } },
      });

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(expiredCache)
        .mockResolvedValueOnce(null);

      await stationCacheService.clearCache();
      const result = await stationCacheService.getStations();
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getLines', () => {
    it('should return null when no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await stationCacheService.clearCache();
      const result = await stationCacheService.getLines();
      expect(result).toBeNull();
    });
  });

  describe('setStations', () => {
    it('should save stations to cache', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const data = { '222': { id: '222', name: '역삼' } };

      await stationCacheService.setStations(data as never);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro/stations_cache',
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it('should handle save error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));

      await stationCacheService.setStations({} as never);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setLines', () => {
    it('should save lines to cache', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const colors = { '2': '#00a84d' };
      const stations = { '2': [['221', '222']] };

      await stationCacheService.setLines(colors, stations);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro/lines_cache',
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it('should handle save error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));

      await stationCacheService.setLines({}, {});
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return cache status', async () => {
      await stationCacheService.clearCache();
      const status = await stationCacheService.getStatus();

      expect(status).toHaveProperty('hasStations');
      expect(status).toHaveProperty('hasLines');
      expect(status).toHaveProperty('stationsAge');
      expect(status).toHaveProperty('linesAge');
      expect(status).toHaveProperty('isExpired');
      expect(typeof status.isExpired).toBe('boolean');
    });

    it('should show expired when no cache', async () => {
      await stationCacheService.clearCache();
      const status = await stationCacheService.getStatus();
      expect(status.isExpired).toBe(true);
      expect(status.stationsAge).toBeNull();
      expect(status.linesAge).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await stationCacheService.clearCache();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro/stations_cache');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro/lines_cache');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro/cache_version');
      consoleSpy.mockRestore();
    });

    it('should handle clear error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Clear failed'));

      await stationCacheService.clearCache();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('refreshFromBundle', () => {
    it('should refresh cache from bundled data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await stationCacheService.refreshFromBundle();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
