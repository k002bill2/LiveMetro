/**
 * Theme Context Tests
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme, useColors } from '../themeContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('themeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useTheme', () => {
    it('should throw when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');
      consoleSpy.mockRestore();
    });

    it('should default to system theme mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.themeMode).toBe('system');
    });

    it('should load saved theme from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.themeMode).toBe('dark');
      expect(result.current.isDark).toBe(true);
    });

    it('should ignore invalid saved theme', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.themeMode).toBe('system');
    });

    it('should change theme mode', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setThemeMode('dark');
      });

      expect(result.current.themeMode).toBe('dark');
      expect(result.current.isDark).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@livemetro_theme', 'dark');
    });

    it('should set light theme', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setThemeMode('light');
      });

      expect(result.current.themeMode).toBe('light');
      expect(result.current.isDark).toBe(false);
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('should provide colors based on theme', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.colors).toBeDefined();
      expect(result.current.colors.background).toBeDefined();
      expect(result.current.colors.textPrimary).toBeDefined();
      expect(result.current.colors.primary).toBeDefined();
    });

    it('should provide dark colors in dark mode', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.colors.background).toBe('#121212');
    });

    it('should provide light colors in light mode', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.colors.background).toBe('#FFFFFF');
    });

    it('should handle storage error on load', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.themeMode).toBe('system');
      consoleSpy.mockRestore();
    });

    it('should throw on storage error when setting theme', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.setThemeMode('dark');
        })
      ).rejects.toThrow('Write error');

      consoleSpy.mockRestore();
    });
  });

  describe('useColors', () => {
    it('should return colors object', async () => {
      const { result } = renderHook(() => useColors(), { wrapper });

      await waitFor(() => {
        expect(result.current.background).toBeDefined();
      });

      expect(result.current.primary).toBeDefined();
      expect(result.current.success).toBeDefined();
      expect(result.current.error).toBeDefined();
    });
  });

  describe('density preference', () => {
    it('should default to loose when no value stored', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.density).toBe('loose');
    });

    it('should load saved density from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_density' ? 'dense' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.density).toBe('dense');
    });

    it('should ignore invalid saved density', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_density' ? 'huge' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.density).toBe('loose');
    });

    it('should persist density via setDensity', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setDensity('balanced');
      });

      expect(result.current.density).toBe('balanced');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@livemetro_density', 'balanced');
    });

    it('should throw on storage error when setting density', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.setDensity('dense');
        })
      ).rejects.toThrow('Write error');

      consoleSpy.mockRestore();
    });
  });

  describe('congStyle preference', () => {
    it('should default to bar when no value stored', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.congStyle).toBe('bar');
    });

    it('should load saved congStyle from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_cong_style' ? 'heat' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.congStyle).toBe('heat');
    });

    it('should ignore invalid saved congStyle', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_cong_style' ? 'rainbow' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.congStyle).toBe('bar');
    });

    it('should persist congStyle via setCongStyle', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setCongStyle('dots');
      });

      expect(result.current.congStyle).toBe('dots');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@livemetro_cong_style', 'dots');
    });
  });

  describe('lineEmphasis preference', () => {
    it('should default to true when no value stored', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lineEmphasis).toBe(true);
    });

    it('should load saved lineEmphasis=true from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_line_emphasis' ? 'true' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lineEmphasis).toBe(true);
    });

    it('should load saved lineEmphasis=false from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_line_emphasis' ? 'false' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lineEmphasis).toBe(false);
    });

    it('should ignore invalid saved lineEmphasis', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_line_emphasis' ? 'maybe' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lineEmphasis).toBe(true);
    });

    it('should persist lineEmphasis via setLineEmphasis', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setLineEmphasis(false);
      });

      expect(result.current.lineEmphasis).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@livemetro_line_emphasis', 'false');
    });

    it('should round-trip lineEmphasis true via setLineEmphasis', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setLineEmphasis(false);
      });
      await act(async () => {
        await result.current.setLineEmphasis(true);
      });

      expect(result.current.lineEmphasis).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@livemetro_line_emphasis', 'true');
    });
  });
});
