/**
 * Theme Context for light/dark mode support
 * Supports: light, dark, system (auto)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isNightInSeoul } from '@/utils/sunSchedule';
import {
  AccentColorId,
  DEFAULT_ACCENT_COLOR_ID,
  applyAccentToColors,
  isAccentColorId,
} from './accentColors';

const THEME_STORAGE_KEY = '@livemetro_theme';
const ACCENT_STORAGE_KEY = '@livemetro_accent_color';
const AUTO_SWITCH_STORAGE_KEY = '@livemetro_theme_auto_switch';
/** 자동 전환 재판정 주기 — 일출/일몰 경계 1분 해상도면 충분 */
const AUTO_SWITCH_POLL_MS = 60 * 1000;

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Light theme colors (Updated based on designStyle.json)
const lightColors = {
  // Background
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#757575',
  textTertiary: '#A0A0A0',
  textDisabled: '#EEEEEE',
  textInverse: '#FFFFFF',

  // Border
  borderLight: '#F4F6F8',
  borderMedium: '#EEEEEE',
  borderDark: '#A0A0A0',

  // Primary (Blue/Indigo)
  primary: '#546FFF',
  primaryHover: '#3742FA',
  primaryLight: '#E0E7FF',

  // Secondary colors
  blue: '#546FFF',
  yellow: '#F2C94C',
  red: '#EB5757',

  // Semantic
  success: '#27AE60',
  successLight: '#D1FAE5',
  warning: '#F2C94C',
  warningLight: '#FEF3C7',
  error: '#EB5757',
  errorLight: '#FEE2E2',
  info: '#546FFF',
  infoLight: '#E0E7FF',

  // Gray scale
  black: '#1A1A1A',
  white: '#FFFFFF',
  gray100: '#F8F9FA',
  gray200: '#F4F6F8',
  gray300: '#EEEEEE',
  gray400: '#BDBDBD',
  gray500: '#A0A0A0',
  gray600: '#757575',
  gray700: '#404040',
  gray800: '#1A1A1A',

  // Special
  overlay: 'rgba(26, 26, 26, 0.5)',
  cardShadow: 'rgba(0, 0, 0, 0.05)',
};

// Dark theme colors (Updated based on designStyle.json)
const darkColors = {
  // Background
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  surface: '#1E1E1E',
  surfaceElevated: '#2C2C2C',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#808080',
  textDisabled: '#4A4A4A',
  textInverse: '#121212',

  // Border
  borderLight: '#2C2C2C',
  borderMedium: '#3D3D3D',
  borderDark: '#5A5A5A',

  // Primary (Blue/Indigo - slightly brighter for dark mode)
  primary: '#7B8CFF',
  primaryHover: '#546FFF',
  primaryLight: '#1E2A5E',

  // Secondary colors
  blue: '#7B8CFF',
  yellow: '#FFD966',
  red: '#FF6B6B',

  // Semantic
  success: '#4ADE80',
  successLight: '#1A3D2E',
  warning: '#FFD966',
  warningLight: '#3D3520',
  error: '#FF6B6B',
  errorLight: '#3D2020',
  info: '#7B8CFF',
  infoLight: '#1E2A5E',

  // Gray scale (inverted for dark mode)
  black: '#FFFFFF',
  white: '#121212',
  gray100: '#1E1E1E',
  gray200: '#2C2C2C',
  gray300: '#3D3D3D',
  gray400: '#5A5A5A',
  gray500: '#808080',
  gray600: '#B0B0B0',
  gray700: '#D0D0D0',
  gray800: '#FFFFFF',

  // Special
  overlay: 'rgba(0, 0, 0, 0.7)',
  cardShadow: 'rgba(0, 0, 0, 0.3)',
};

export type ThemeColors = typeof lightColors;

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  /** 강조 색상 — primary 계열 팔레트 오버라이드 */
  accentColorId: AccentColorId;
  setAccentColor: (id: AccentColorId) => Promise<void>;
  /** 시간대별 자동 전환 — ON이면 서울 일출/일몰이 모드 선택을 우선함 */
  autoSwitchEnabled: boolean;
  setAutoSwitchEnabled: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [accentColorId, setAccentColorIdState] = useState<AccentColorId>(
    DEFAULT_ACCENT_COLOR_ID
  );
  const [autoSwitchEnabled, setAutoSwitchEnabledState] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preferences on mount
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      try {
        const [savedTheme, savedAccent, savedAutoSwitch] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
          AsyncStorage.getItem(AUTO_SWITCH_STORAGE_KEY),
        ]);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeModeState(savedTheme);
        }
        if (isAccentColorId(savedAccent)) {
          setAccentColorIdState(savedAccent);
        }
        if (savedAutoSwitch === 'true') {
          setAutoSwitchEnabledState(true);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // 자동 전환 ON 동안 1분 해상도로 일출/일몰 경계 재판정
  useEffect(() => {
    if (!autoSwitchEnabled) {
      return undefined;
    }
    const update = (): void => {
      setIsNight(isNightInSeoul(new Date()));
    };
    update();
    const intervalId = setInterval(update, AUTO_SWITCH_POLL_MS);
    return () => clearInterval(intervalId);
  }, [autoSwitchEnabled]);

  // Resolve theme: 자동 전환 > 수동 모드 > 시스템
  const resolvedTheme: ResolvedTheme = React.useMemo(() => {
    if (autoSwitchEnabled) {
      return isNight ? 'dark' : 'light';
    }
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [autoSwitchEnabled, isNight, themeMode, systemColorScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = useMemo(
    () => applyAccentToColors(isDark ? darkColors : lightColors, accentColorId, isDark),
    [isDark, accentColorId]
  );

  // Set theme and persist
  const setThemeMode = useCallback(async (mode: ThemeMode): Promise<void> => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
      throw error;
    }
  }, []);

  const setAccentColor = useCallback(async (id: AccentColorId): Promise<void> => {
    try {
      await AsyncStorage.setItem(ACCENT_STORAGE_KEY, id);
      setAccentColorIdState(id);
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Error saving accent color preference:', error);
      }
      throw error;
    }
  }, []);

  const setAutoSwitchEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(AUTO_SWITCH_STORAGE_KEY, enabled ? 'true' : 'false');
      setAutoSwitchEnabledState(enabled);
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Error saving auto switch preference:', error);
      }
      throw error;
    }
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    themeMode,
    resolvedTheme,
    colors,
    isDark,
    setThemeMode,
    accentColorId,
    setAccentColor,
    autoSwitchEnabled,
    setAutoSwitchEnabled,
    isLoading,
  }), [
    themeMode,
    resolvedTheme,
    colors,
    isDark,
    setThemeMode,
    accentColorId,
    setAccentColor,
    autoSwitchEnabled,
    setAutoSwitchEnabled,
    isLoading,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};
