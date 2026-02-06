/**
 * Storage Utilities Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageUtils, STORAGE_KEYS } from '../storageUtils';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('storageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setItem', () => {
    it('should save item to storage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await storageUtils.setItem('key', { foo: 'bar' });

      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('key', '{"foo":"bar"}');
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('fail'));

      const result = await storageUtils.setItem('key', 'value');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('getItem', () => {
    it('should get item from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"foo":"bar"}');

      const result = await storageUtils.getItem<{ foo: string }>('key');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for missing item', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await storageUtils.getItem('key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('fail'));

      const result = await storageUtils.getItem('key');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('removeItem', () => {
    it('should remove item from storage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await storageUtils.removeItem('key');

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key');
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('fail'));

      const result = await storageUtils.removeItem('key');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear all storage', async () => {
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      const result = await storageUtils.clear();

      expect(result).toBe(true);
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(new Error('fail'));

      const result = await storageUtils.clear();

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should have all expected keys', () => {
      expect(STORAGE_KEYS.USER_PREFERENCES).toBe('@livemetro_user_preferences');
      expect(STORAGE_KEYS.CACHED_STATIONS).toBe('@livemetro_cached_stations');
      expect(STORAGE_KEYS.LAST_LOCATION).toBe('@livemetro_last_location');
    });
  });
});
