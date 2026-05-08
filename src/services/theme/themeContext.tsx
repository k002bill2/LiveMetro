/**
 * Theme Context for light/dark mode support
 * Supports: light, dark, system (auto)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@livemetro_theme';
const DENSITY_STORAGE_KEY = '@livemetro_density';
const CONG_STYLE_STORAGE_KEY = '@livemetro_cong_style';
const LINE_EMPHASIS_STORAGE_KEY = '@livemetro_line_emphasis';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type Density = 'loose' | 'balanced' | 'dense';
export type CongStyle = 'bar' | 'dots' | 'heat';

const DEFAULT_DENSITY: Density = 'loose';
const DEFAULT_CONG_STYLE: CongStyle = 'bar';
const DEFAULT_LINE_EMPHASIS = true;

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
  density: Density;
  setDensity: (density: Density) => Promise<void>;
  congStyle: CongStyle;
  setCongStyle: (style: CongStyle) => Promise<void>;
  lineEmphasis: boolean;
  setLineEmphasis: (emphasis: boolean) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [density, setDensityState] = useState<Density>(DEFAULT_DENSITY);
  const [congStyle, setCongStyleState] = useState<CongStyle>(DEFAULT_CONG_STYLE);
  const [lineEmphasis, setLineEmphasisState] = useState<boolean>(DEFAULT_LINE_EMPHASIS);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preferences on mount (parallel for fast cold-start)
  useEffect(() => {
    const loadPreferences = async (): Promise<void> => {
      try {
        const [savedTheme, savedDensity, savedCongStyle, savedLineEmphasis] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(DENSITY_STORAGE_KEY),
          AsyncStorage.getItem(CONG_STYLE_STORAGE_KEY),
          AsyncStorage.getItem(LINE_EMPHASIS_STORAGE_KEY),
        ]);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeModeState(savedTheme);
        }
        if (savedDensity === 'loose' || savedDensity === 'balanced' || savedDensity === 'dense') {
          setDensityState(savedDensity);
        }
        if (savedCongStyle === 'bar' || savedCongStyle === 'dots' || savedCongStyle === 'heat') {
          setCongStyleState(savedCongStyle);
        }
        if (savedLineEmphasis === 'true' || savedLineEmphasis === 'false') {
          setLineEmphasisState(savedLineEmphasis === 'true');
        }
      } catch (error) {
        console.error('Error loading theme preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Resolve theme based on mode and system preference
  const resolvedTheme: ResolvedTheme = React.useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

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

  const setDensity = useCallback(async (next: Density): Promise<void> => {
    try {
      await AsyncStorage.setItem(DENSITY_STORAGE_KEY, next);
      setDensityState(next);
    } catch (error) {
      console.error('Error saving density preference:', error);
      throw error;
    }
  }, []);

  const setCongStyle = useCallback(async (next: CongStyle): Promise<void> => {
    try {
      await AsyncStorage.setItem(CONG_STYLE_STORAGE_KEY, next);
      setCongStyleState(next);
    } catch (error) {
      console.error('Error saving congestion style preference:', error);
      throw error;
    }
  }, []);

  const setLineEmphasis = useCallback(async (next: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(LINE_EMPHASIS_STORAGE_KEY, String(next));
      setLineEmphasisState(next);
    } catch (error) {
      console.error('Error saving line emphasis preference:', error);
      throw error;
    }
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    themeMode,
    resolvedTheme,
    colors,
    isDark,
    setThemeMode,
    density,
    setDensity,
    congStyle,
    setCongStyle,
    lineEmphasis,
    setLineEmphasis,
    isLoading,
  }), [
    themeMode,
    resolvedTheme,
    colors,
    isDark,
    setThemeMode,
    density,
    setDensity,
    congStyle,
    setCongStyle,
    lineEmphasis,
    setLineEmphasis,
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
