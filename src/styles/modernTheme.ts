/**
 * Modern Design System
 * Updated based on style.json - Green Primary, Modern Minimalism
 */

export const COLORS = {
  // Grayscale Palette (from style.json neutral)
  black: '#212529', // gray_900
  gray: {
    950: '#212529', // gray_900
    900: '#212529', // gray_900
    850: '#343a40',
    800: '#495057', // gray_700
    700: '#495057',
    600: '#868E96', // gray_500
    500: '#868E96',
    400: '#ADB5BD',
    300: '#DEE2E6', // gray_300
    200: '#E9ECEF',
    150: '#F1F3F5', // gray_100
    100: '#F8F9FA', // gray_50
    50: '#F8F9FA',
  },
  white: '#FFFFFF',

  // Brand Colors
  primary: {
    main: '#00C853',
    hover: '#00B04A',
    pressed: '#009D42',
    light: '#E8F5E9', // Light green background (derived)
  },

  // Secondary/Accent Colors (from style.json)
  secondary: {
    blue: '#4285F4',
    yellow: '#FFC107',
    red: '#F44336',
    blueLight: '#E3F2FD',
    yellowLight: '#FFF9E6',
    redLight: '#FFEBEE',
  },

  // Backward compatibility & Semantic mapping
  accent: {
    primary: '#00C853', // Green
    secondary: '#4285F4', // Blue
    tertiary: '#FFC107', // Yellow
  },

  semantic: {
    success: '#00C853',
    warning: '#FFC107',
    error: '#F44336',
    info: '#4285F4',
  },

  // Surface Colors
  surface: {
    background: '#F8F9FA', // secondary background
    card: '#FFFFFF', // card background
    elevated: '#FFFFFF',
    overlay: 'rgba(33, 37, 41, 0.5)', // gray_900 with opacity
  },

  // Text Colors
  text: {
    primary: '#212529', // gray_900
    secondary: '#495057', // gray_700
    tertiary: '#868E96', // gray_500
    disabled: '#DEE2E6', // gray_300
    inverse: '#FFFFFF',
    link: '#4285F4', // blue
  },

  // Border Colors
  border: {
    light: '#F1F3F5', // gray_100
    medium: '#DEE2E6', // gray_300 - default border
    dark: '#868E96', // gray_500
    focus: '#00C853', // primary main
  },
};

export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  // Scale from style.json:
  // caption: 12, body_small: 13, body: 14, body_large: 16,
  // heading_3: 18, heading_2: 20, heading_1: 24
  fontSize: {
    xs: 12, // caption
    sm: 13, // body_small
    base: 14, // body
    lg: 16, // body_large
    xl: 18, // heading_3
    '2xl': 20, // heading_2
    '3xl': 24, // heading_1
    '4xl': 28, // large amounts
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4, // approx 20px/14px
    relaxed: 1.6, // approx 32px/20px
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const RADIUS = {
  none: 0,
  sm: 8,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999, // round
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    // card shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  base: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  md: {
    // elevated
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    // floating
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const TRANSITIONS = {
  duration: {
    fast: 150,
    base: 250,
    slow: 350,
  },
  easing: {
    ease: 'ease',
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

export const LAYOUT = {
  maxWidth: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  containerPadding: SPACING.xl, // 20px
  sectionGap: SPACING['2xl'], // 24px
  headerHeight: 56,
  bottomNavHeight: 64,
};
