/**
 * Theme Context for light/dark mode support
 * Supports: light, dark, system (auto)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@livemetro_theme';

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
  warning: '#F2C94C',
  error: '#EB5757',
  info: '#546FFF',

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
  warning: '#FFD966',
  error: '#FF6B6B',
  info: '#7B8CFF',

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
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeModeState(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
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

  const value: ThemeContextType = {
    themeMode,
    resolvedTheme,
    colors,
    isDark,
    setThemeMode,
    isLoading,
  };

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
