/**
 * Theme Utilities
 * Consistent design tokens and styling utilities
 */

import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');
const READABILITY_FONT_DELTA = 2;
const readableFontSize = (value: number): number => value + READABILITY_FONT_DELTA;

/**
 * Design Tokens - Spacing
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/**
 * Design Tokens - Typography
 */
export const TYPOGRAPHY = {
  sizes: {
    xs: readableFontSize(12),
    sm: readableFontSize(14),
    base: readableFontSize(16),
    lg: readableFontSize(18),
    xl: readableFontSize(20),
    xxl: readableFontSize(24),
    xxxl: readableFontSize(32),
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

/**
 * Design Tokens - Border Radius
 */
export const BORDER_RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

/**
 * Design Tokens - Shadows
 */
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

/**
 * Design Tokens - Touch Targets
 */
export const TOUCH_TARGET = {
  min: 44, // Minimum touch target size (iOS HIG & Android Material Design)
  comfortable: 48, // Comfortable touch target size
} as const;

/**
 * Device Helpers
 */
export const DEVICE = {
  width,
  height,
  isSmall: width < 375,
  isMedium: width >= 375 && width < 414,
  isLarge: width >= 414,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
} as const;

/**
 * Animation Durations
 */
export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 350,
  slowest: 500,
} as const;

/**
 * Z-Index Levels
 */
export const Z_INDEX = {
  background: 0,
  content: 1,
  overlay: 10,
  modal: 100,
  toast: 1000,
} as const;

/**
 * Utility Functions
 */

/**
 * Get responsive spacing based on screen size
 */
export const getResponsiveSpacing = (base: keyof typeof SPACING): number => {
  const spacing = SPACING[base];
  
  if (DEVICE.isSmall) {
    return Math.max(SPACING.xs, spacing * 0.8);
  }
  
  if (DEVICE.isLarge) {
    return spacing * 1.2;
  }
  
  return spacing;
};

/**
 * Get responsive font size based on screen size
 */
export const getResponsiveFontSize = (base: keyof typeof TYPOGRAPHY.sizes): number => {
  const fontSize = TYPOGRAPHY.sizes[base];
  
  if (DEVICE.isSmall) {
    return Math.max(TYPOGRAPHY.sizes.xs, fontSize * 0.9);
  }
  
  if (DEVICE.isLarge) {
    return fontSize * 1.1;
  }
  
  return fontSize;
};

/**
 * Create responsive styles with screen size breakpoints
 */
export const createResponsiveStyle = <T extends Record<string, any>>(
  small: T,
  medium: T = small,
  large: T = medium
): T => {
  if (DEVICE.isSmall) return small;
  if (DEVICE.isMedium) return medium;
  return large;
};

/**
 * Haptic Feedback Types
 */
export const HAPTIC_TYPES = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;
