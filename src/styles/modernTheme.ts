/**
 * Modern Design System
 * Updated based on designStyle.json - Blue/Indigo Primary (#546FFF)
 */

export const COLORS = {
  // Grayscale Palette
  black: '#1A1A1A',
  gray: {
    950: '#1A1A1A',
    900: '#1A1A1A',
    850: '#2D2D2D',
    800: '#404040',
    700: '#757575',
    600: '#757575',
    500: '#A0A0A0',
    400: '#BDBDBD',
    300: '#EEEEEE',
    200: '#F4F6F8',
    150: '#F8F9FA',
    100: '#F8F9FA',
    50: '#FFFFFF',
  },
  white: '#FFFFFF',

  // Brand Colors (Updated to Blue/Indigo)
  primary: {
    main: '#546FFF',
    hover: '#3742FA',
    pressed: '#2935CC',
    light: '#E0E7FF',
  },

  // Secondary/Accent Colors
  secondary: {
    blue: '#546FFF',
    yellow: '#F2C94C',
    red: '#EB5757',
    blueLight: '#E0E7FF',
    yellowLight: '#FFF9E6',
    redLight: '#FFEBEE',
  },

  // Backward compatibility & Semantic mapping
  accent: {
    primary: '#546FFF',
    secondary: '#546FFF',
    tertiary: '#F2C94C',
  },

  semantic: {
    success: '#27AE60',
    warning: '#F2C94C',
    error: '#EB5757',
    info: '#546FFF',
  },

  // Surface Colors
  surface: {
    background: '#F8F9FA',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    overlay: 'rgba(26, 26, 26, 0.5)',
  },

  // Text Colors
  text: {
    primary: '#1A1A1A',
    secondary: '#757575',
    tertiary: '#A0A0A0',
    disabled: '#EEEEEE',
    inverse: '#FFFFFF',
    link: '#546FFF',
  },

  // Border Colors
  border: {
    light: '#F4F6F8',
    medium: '#EEEEEE',
    dark: '#A0A0A0',
    focus: '#546FFF',
  },

  // Chat bubble colors (for AI chat interface)
  chat: {
    bubbleAi: '#F4F6F8',
    bubbleUser: '#546FFF',
  },
};

export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  // Scale updated from designStyle.json:
  // h1: 32, h2: 24, h3: 20, body_large: 16, body_medium: 14, caption: 12
  fontSize: {
    xs: 12,   // caption
    sm: 13,   // body_small
    base: 14, // body_medium
    lg: 16,   // body_large
    xl: 20,   // h3
    '2xl': 24, // h2
    '3xl': 32, // h1
    '4xl': 36, // large display
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
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
  '2xl': 24,  // container_padding from designStyle.json
  '3xl': 32,  // section_gap from designStyle.json
  '4xl': 40,
};

export const RADIUS = {
  none: 0,
  sm: 8,      // small from designStyle.json
  base: 8,
  md: 12,     // medium from designStyle.json (inputs)
  lg: 16,     // buttons from designStyle.json
  xl: 20,     // large/cards from designStyle.json
  '2xl': 24,
  full: 9999, // pill shape
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
    // card shadow from designStyle.json
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  base: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  lg: {
    // floating_button shadow from designStyle.json
    shadowColor: '#546FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
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

// Component-specific tokens from designStyle.json
export const COMPONENTS = {
  button: {
    height: 56,
    borderRadius: RADIUS.lg, // 16px
  },
  input: {
    height: 56,
    borderRadius: RADIUS.md, // 12px
  },
  card: {
    borderRadius: RADIUS.xl, // 20px
    padding: 20,
  },
};

export const LAYOUT = {
  maxWidth: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  containerPadding: SPACING['2xl'], // 24px
  elementGap: SPACING.lg,           // 16px
  sectionGap: SPACING['3xl'],       // 32px
  headerHeight: 56,
  bottomNavHeight: 64,
};
