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

// 일출/일몰 실계산은 sunSchedule.test.ts에서 검증 — 여기선 판정만 제어
jest.mock('@/utils/sunSchedule', () => ({
  isNightInSeoul: jest.fn().mockReturnValue(false),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isNightInSeoul } = require('@/utils/sunSchedule') as {
  isNightInSeoul: jest.Mock;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('themeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    isNightInSeoul.mockReturnValue(false);
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

  describe('accent color', () => {
    it('defaults to classic blue with the base palette untouched', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accentColorId).toBe('blue');
      expect(result.current.colors.primary).toBe('#546FFF');
    });

    it('overrides primary palette when an accent is selected', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setAccentColor('purple');
      });

      expect(result.current.accentColorId).toBe('purple');
      expect(result.current.colors.primary).toBe('#8B5CF6');
      expect(result.current.colors.blue).toBe('#8B5CF6');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_accent_color',
        'purple'
      );
    });

    it('uses the dark accent variant in dark mode', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@livemetro_theme') return Promise.resolve('dark');
        if (key === '@livemetro_accent_color') return Promise.resolve('green');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accentColorId).toBe('green');
      expect(result.current.colors.primary).toBe('#34D399');
    });

    it('ignores an invalid saved accent id', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_accent_color' ? 'magenta' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accentColorId).toBe('blue');
    });
  });

  describe('auto dark switch', () => {
    it('defaults to disabled', async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.autoSwitchEnabled).toBe(false);
    });

    it('loads the persisted enabled flag', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === '@livemetro_theme_auto_switch' ? 'true' : null)
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.autoSwitchEnabled).toBe(true);
    });

    it('resolves dark after sunset regardless of the selected mode', async () => {
      isNightInSeoul.mockReturnValue(true);

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setThemeMode('light');
        await result.current.setAutoSwitchEnabled(true);
      });

      expect(result.current.resolvedTheme).toBe('dark');
      expect(result.current.isDark).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_theme_auto_switch',
        'true'
      );
    });

    it('resolves light during the day even when mode is dark', async () => {
      isNightInSeoul.mockReturnValue(false);

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setThemeMode('dark');
        await result.current.setAutoSwitchEnabled(true);
      });

      expect(result.current.resolvedTheme).toBe('light');
    });

    it('clears the polling interval when disabled (subscription cleanup)', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setAutoSwitchEnabled(true);
      });
      await act(async () => {
        await result.current.setAutoSwitchEnabled(false);
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
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
});
