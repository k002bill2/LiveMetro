/**
 * i18n Context Tests
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nProvider, useI18n, useTranslation } from '../i18nContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe('i18nContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useI18n', () => {
    it('should throw when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      expect(() => {
        renderHook(() => useI18n());
      }).toThrow('useI18n must be used within an I18nProvider');
      consoleSpy.mockRestore();
    });

    it('should default to Korean', async () => {
      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ko');
      expect(result.current.t).toBeDefined();
    });

    it('should load saved language from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('en');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('en');
    });

    it('should ignore invalid saved language', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('fr');

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ko');
    });

    it('should change language', async () => {
      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_language',
        'en'
      );
    });

    it('should handle storage error on load', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read error'));

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.language).toBe('ko');
      consoleSpy.mockRestore();
    });

    it('should throw on storage error when setting language', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.setLanguage('en');
        })
      ).rejects.toThrow('Write error');

      consoleSpy.mockRestore();
    });

    it('should provide translations object', async () => {
      const { result } = renderHook(() => useI18n(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t.common).toBeDefined();
      expect(result.current.t.common.cancel).toBeDefined();
      expect(result.current.t.settings).toBeDefined();
    });
  });

  describe('useTranslation', () => {
    it('should return translations', async () => {
      const { result } = renderHook(() => useTranslation(), { wrapper });

      await waitFor(() => {
        expect(result.current.common).toBeDefined();
      });

      expect(result.current.common.cancel).toBeDefined();
    });
  });
});
