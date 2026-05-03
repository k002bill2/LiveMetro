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

/* ============================================================================
 * Wanted Design System Tokens (Phase 1 of design refresh)
 *
 * Layered alongside existing COLORS/SPACING above. New design components
 * (LineBadge, Pill, CongestionBar, etc.) reference WANTED_TOKENS directly.
 * Screens migrate one-by-one in Phases 2–4.
 *
 * Source: Wanted Design System tokens from design handoff (lib/wanted-tokens.css)
 * Korean reference: 원티드 디자인 시스템
 * ========================================================================== */

export const WANTED_TOKENS = {
  /* Atomic palette */
  neutral: {
    50: '#FAFAFA',
    100: '#F7F7F8',
    200: '#F4F4F5',
    300: '#DBDCDF',
    400: '#C2C4C8',
    500: '#AEB0B6',
    600: '#989BA2',
    700: '#70737C',
    800: '#46474C',
    900: '#1B1C1E',
  },
  cool: {
    100: '#F7F8FA',
    200: '#F1F5F8',
    300: '#DCE0E5',
    700: '#6B7785',
    900: '#14191E',
  },
  blue: {
    50:  '#EAF2FE',
    100: '#D4E3FE',
    300: '#6FA8FF',
    400: '#3385FF',
    500: '#0066FF',  /* primary */
    600: '#005EEB',  /* hover */
    700: '#0044BB',  /* pressed */
    900: '#002D7A',
  },
  status: {
    red100:    '#FEE9E9',
    red500:    '#FF4242',
    red700:    '#C42727',
    green500:  '#00BF40',
    green700:  '#008F30',
    yellow500: '#FFB400',
    yellow700: '#C28800',
    violet500: '#9747FF',
    violet700: '#6541F2',
    cyan500:   '#0098B2',
  },

  /* Semantic — Light */
  light: {
    bgBase:        '#FFFFFF',
    bgSubtle:      'rgba(112,115,124,0.08)',
    bgSubtlePage:  '#F7F8FA',
    bgElevated:    '#FFFFFF',
    bgTranslucent: 'rgba(255,255,255,0.6)',

    labelStrong:   '#000000',
    labelNormal:   '#171719',
    labelNeutral:  '#37383C',
    labelAlt:      '#70737C',
    labelDisabled: 'rgba(112,115,124,0.40)',
    labelOnColor:  '#FFFFFF',

    lineNormal: 'rgba(112,115,124,0.22)',
    lineSubtle: 'rgba(112,115,124,0.16)',
    lineStrong: '#000000',

    primaryNormal: '#0066FF',
    primaryHover:  '#005EEB',
    primaryPress:  '#0044BB',
    primaryBg:     '#EAF2FE',

    statusPositive:   '#00BF40',
    statusNegative:   '#FF4242',
    statusCautionary: '#FFB400',
    statusInfo:       '#0098B2',
  },

  /* Semantic — Dark */
  dark: {
    bgBase:        '#1B1C1E',
    bgSubtle:      'rgba(255,255,255,0.06)',
    bgSubtlePage:  '#14191E',
    bgElevated:    '#1B1C1E',
    bgTranslucent: 'rgba(27,28,30,0.6)',

    labelStrong:   '#FFFFFF',
    labelNormal:   '#F4F4F5',
    labelNeutral:  'rgba(255,255,255,0.88)',
    labelAlt:      '#989BA2',
    labelDisabled: 'rgba(255,255,255,0.32)',
    labelOnColor:  '#FFFFFF',

    lineNormal: 'rgba(255,255,255,0.16)',
    lineSubtle: 'rgba(255,255,255,0.10)',
    lineStrong: '#FFFFFF',

    primaryNormal: '#3385FF',
    primaryHover:  '#0066FF',
    primaryPress:  '#005EEB',
    primaryBg:     'rgba(0,102,255,0.16)',

    statusPositive:   '#00BF40',
    statusNegative:   '#FF4242',
    statusCautionary: '#FFB400',
    statusInfo:       '#0098B2',
  },

  /* Congestion semantic — 4 levels matching design's CONG_TONE */
  congestion: {
    low:   { color: '#00BF40', label: '여유',     pct: 0.30 },
    mid:   { color: '#FFB400', label: '보통',     pct: 0.55 },
    high:  { color: '#FF7A1A', label: '혼잡',     pct: 0.80 },
    vhigh: { color: '#FF4242', label: '매우혼잡', pct: 0.95 },
  },

  /* Direction tints */
  direction: {
    up:   '#FF4242', // 상행 / 내선
    down: '#0066FF', // 하행 / 외선
  },

  /* Type scale (size, lineHeight, letterSpacing-em, weight) */
  type: {
    display2:  { size: 40, lh: 52, tracking: -0.0282, weight: '700' as const },
    display3:  { size: 36, lh: 48, tracking: -0.027,  weight: '700' as const },
    title1:    { size: 32, lh: 44, tracking: -0.0253, weight: '700' as const },
    title2:    { size: 28, lh: 38, tracking: -0.0236, weight: '700' as const },
    title3:    { size: 24, lh: 32, tracking: -0.023,  weight: '700' as const },
    heading1:  { size: 22, lh: 30, tracking: -0.0194, weight: '700' as const },
    heading2:  { size: 20, lh: 28, tracking: -0.012,  weight: '700' as const },
    headline1: { size: 18, lh: 26, tracking: -0.002,  weight: '600' as const },
    headline2: { size: 17, lh: 24, tracking: 0,       weight: '600' as const },
    body1:     { size: 16, lh: 24, tracking: 0.0057,  weight: '500' as const },
    body2:     { size: 15, lh: 22, tracking: 0.0096,  weight: '500' as const },
    label1:    { size: 14, lh: 20, tracking: 0.0145,  weight: '600' as const },
    label2:    { size: 13, lh: 18, tracking: 0.0194,  weight: '600' as const },
    caption1:  { size: 12, lh: 16, tracking: 0.0252,  weight: '600' as const },
    caption2:  { size: 11, lh: 14, tracking: 0.0311,  weight: '600' as const },
  },

  /* Spacing — 8px base */
  spacing: {
    s1:  4,
    s2:  8,
    s3:  12,
    s4:  16,
    s5:  20,
    s6:  24,
    s8:  32,
    s10: 40,
    s12: 48,
    s16: 64,
    s24: 96,
    s32: 128,
  },

  /* Radius */
  radius: {
    r2:    4,
    r4:    8,
    r5:    10,
    r6:    12,
    r8:    16,
    r10:   20,
    r12:   24,
    r16:   32,
    r30:   60,
    pill:  9999,
  },

  /* Shadow (RN-friendly: shadowColor/Offset/Opacity/Radius + elevation) */
  shadow: {
    flat: {
      shadowColor:   '#171717',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius:  2,
      elevation:     1,
    },
    card: {
      shadowColor:   '#171717',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius:  8,
      elevation:     3,
    },
    popover: {
      shadowColor:   '#000000',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius:  24,
      elevation:     6,
    },
    modal: {
      shadowColor:   '#000000',
      shadowOffset:  { width: 0, height: 16 },
      shadowOpacity: 0.12,
      shadowRadius:  48,
      elevation:     12,
    },
  },

  /* Motion */
  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
  },

  /* Font family — set once Pretendard fonts are loaded via expo-font */
  fontFamily: {
    sans: 'Pretendard',                 // Pretendard-Regular/Medium/SemiBold/Bold
    sansMedium: 'Pretendard-Medium',
    sansSemibold: 'Pretendard-SemiBold',
    sansBold: 'Pretendard-Bold',
    display: 'WantedSans',              // optional, falls back to Pretendard
    mono: 'Menlo',
  },
} as const;

export type WantedSemanticTheme = typeof WANTED_TOKENS.light;
export type CongestionLevel = keyof typeof WANTED_TOKENS.congestion;
