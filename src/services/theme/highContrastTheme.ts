/**
 * High Contrast Theme
 * Accessibility-focused theme with enhanced contrast ratios
 */
import { weightToFontFamily } from '@/styles/modernTheme';

// ============================================================================
// Types
// ============================================================================

export interface HighContrastThemeColors {
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Background colors
  background: string;
  surface: string;
  card: string;

  // Text colors
  text: string;
  textSecondary: string;
  textDisabled: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI colors
  border: string;
  divider: string;
  overlay: string;

  // Line colors (Seoul Metro)
  lines: Record<string, string>;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeTypography {
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  body: TextStyle;
  bodyLarge: TextStyle;
  caption: TextStyle;
  button: TextStyle;
}

interface TextStyle {
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '500' | '600' | '700';
  fontFamily: string;
  lineHeight: number;
}

export interface Theme {
  colors: HighContrastThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  shadows: {
    sm: ShadowStyle;
    md: ShadowStyle;
    lg: ShadowStyle;
  };
}

interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

// ============================================================================
// Standard Theme
// ============================================================================

export const standardLightTheme: Theme = {
  colors: {
    primary: '#007AFF',
    primaryDark: '#0056B3',
    primaryLight: '#E3F2FD',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    textDisabled: '#9E9E9E',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    border: '#E0E0E0',
    divider: '#F0F0F0',
    overlay: 'rgba(0, 0, 0, 0.5)',
    lines: {
      '1': '#0052A4',
      '2': '#00A84D',
      '3': '#EF7C1C',
      '4': '#00A5DE',
      '5': '#996CAC',
      '6': '#CD7C2F',
      '7': '#747F00',
      '8': '#E6186C',
      '9': '#BDB092',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold', fontFamily: weightToFontFamily('bold'), lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: 'bold', fontFamily: weightToFontFamily('bold'), lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600', fontFamily: weightToFontFamily('600'), lineHeight: 28 },
    body: { fontSize: 16, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 24 },
    bodyLarge: { fontSize: 18, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 26 },
    caption: { fontSize: 14, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 20 },
    button: { fontSize: 16, fontWeight: '600', fontFamily: weightToFontFamily('600'), lineHeight: 24 },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};

// ============================================================================
// High Contrast Light Theme
// ============================================================================

export const highContrastLightTheme: Theme = {
  colors: {
    primary: '#0056B3', // Darker blue
    primaryDark: '#003D80',
    primaryLight: '#CCE5FF',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#000000', // Pure black
    textSecondary: '#333333',
    textDisabled: '#666666',
    success: '#2E7D32', // Darker green
    warning: '#E65100', // Darker orange
    error: '#C62828', // Darker red
    info: '#1565C0',
    border: '#000000', // Black borders
    divider: '#333333',
    overlay: 'rgba(0, 0, 0, 0.7)',
    lines: {
      '1': '#002D5C', // Darkened line colors
      '2': '#006030',
      '3': '#B85A10',
      '4': '#006B8A',
      '5': '#6B4A7A',
      '6': '#8A5620',
      '7': '#4A5200',
      '8': '#A31050',
      '9': '#8A7A60',
    },
  },
  spacing: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 28,
    xl: 36,
    xxl: 52,
  },
  typography: {
    h1: { fontSize: 36, fontWeight: 'bold', fontFamily: weightToFontFamily('bold'), lineHeight: 44 },
    h2: { fontSize: 28, fontWeight: 'bold', fontFamily: weightToFontFamily('bold'), lineHeight: 36 },
    h3: { fontSize: 22, fontWeight: '700', fontFamily: weightToFontFamily('700'), lineHeight: 30 },
    body: { fontSize: 18, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 28 },
    bodyLarge: { fontSize: 20, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 30 },
    caption: { fontSize: 16, fontWeight: 'normal', fontFamily: weightToFontFamily('normal'), lineHeight: 24 },
    button: { fontSize: 18, fontWeight: '700', fontFamily: weightToFontFamily('700'), lineHeight: 26 },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 6,
    },
  },
};

// ============================================================================
// Dark Theme
// ============================================================================

export const standardDarkTheme: Theme = {
  colors: {
    primary: '#64B5F6',
    primaryDark: '#1E88E5',
    primaryLight: '#1A2744',
    background: '#121212',
    surface: '#1E1E1E',
    card: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textDisabled: '#666666',
    success: '#81C784',
    warning: '#FFB74D',
    error: '#E57373',
    info: '#64B5F6',
    border: '#333333',
    divider: '#2C2C2C',
    overlay: 'rgba(0, 0, 0, 0.7)',
    lines: {
      '1': '#5C9BD5',
      '2': '#6BCF7F',
      '3': '#FFB366',
      '4': '#5CC8E5',
      '5': '#C99DD9',
      '6': '#E5A366',
      '7': '#A6B333',
      '8': '#F56C9B',
      '9': '#D9CCAD',
    },
  },
  spacing: standardLightTheme.spacing,
  typography: standardLightTheme.typography,
  borderRadius: standardLightTheme.borderRadius,
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};

// ============================================================================
// High Contrast Dark Theme
// ============================================================================

export const highContrastDarkTheme: Theme = {
  colors: {
    primary: '#90CAF9',
    primaryDark: '#64B5F6',
    primaryLight: '#1A3A5C',
    background: '#000000',
    surface: '#121212',
    card: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#E0E0E0',
    textDisabled: '#808080',
    success: '#A5D6A7',
    warning: '#FFCC80',
    error: '#EF9A9A',
    info: '#90CAF9',
    border: '#FFFFFF',
    divider: '#666666',
    overlay: 'rgba(0, 0, 0, 0.85)',
    lines: {
      '1': '#7AB8E8',
      '2': '#8BE09A',
      '3': '#FFC57F',
      '4': '#7FDAE8',
      '5': '#D9B3E8',
      '6': '#E8B87F',
      '7': '#C2CC66',
      '8': '#F59AB3',
      '9': '#E8DEC2',
    },
  },
  spacing: highContrastLightTheme.spacing,
  typography: highContrastLightTheme.typography,
  borderRadius: highContrastLightTheme.borderRadius,
  shadows: highContrastLightTheme.shadows,
};

// ============================================================================
// Theme Selector
// ============================================================================

export function getTheme(
  isDarkMode: boolean,
  isHighContrast: boolean
): Theme {
  if (isHighContrast) {
    return isDarkMode ? highContrastDarkTheme : highContrastLightTheme;
  }
  return isDarkMode ? standardDarkTheme : standardLightTheme;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get relative luminance of a color
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}

/**
 * Check if contrast meets WCAG AA standard
 */
export function meetsContrastAA(color1: string, color2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standard
 */
export function meetsContrastAAA(color1: string, color2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}
