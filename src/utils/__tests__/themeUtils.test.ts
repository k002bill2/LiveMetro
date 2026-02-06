/**
 * Theme Utilities Tests
 */

import {
  SPACING,
  TYPOGRAPHY,
  BORDER_RADIUS,
  SHADOWS,
  TOUCH_TARGET,
  DEVICE,
  ANIMATION,
  Z_INDEX,
  getResponsiveSpacing,
  getResponsiveFontSize,
  createResponsiveStyle,
  HAPTIC_TYPES,
} from '../themeUtils';

describe('themeUtils', () => {
  describe('SPACING', () => {
    it('should have correct spacing values', () => {
      expect(SPACING.xs).toBe(4);
      expect(SPACING.sm).toBe(8);
      expect(SPACING.md).toBe(16);
      expect(SPACING.lg).toBe(20);
      expect(SPACING.xl).toBe(24);
      expect(SPACING.xxl).toBe(32);
      expect(SPACING.xxxl).toBe(40);
    });
  });

  describe('TYPOGRAPHY', () => {
    it('should have correct font sizes', () => {
      expect(TYPOGRAPHY.sizes.xs).toBe(12);
      expect(TYPOGRAPHY.sizes.base).toBe(16);
      expect(TYPOGRAPHY.sizes.xxxl).toBe(32);
    });

    it('should have correct font weights', () => {
      expect(TYPOGRAPHY.weights.normal).toBe('400');
      expect(TYPOGRAPHY.weights.bold).toBe('700');
    });

    it('should have correct line heights', () => {
      expect(TYPOGRAPHY.lineHeights.tight).toBe(1.2);
      expect(TYPOGRAPHY.lineHeights.normal).toBe(1.4);
    });
  });

  describe('BORDER_RADIUS', () => {
    it('should have correct border radius values', () => {
      expect(BORDER_RADIUS.xs).toBe(4);
      expect(BORDER_RADIUS.md).toBe(8);
      expect(BORDER_RADIUS.full).toBe(9999);
    });
  });

  describe('SHADOWS', () => {
    it('should have shadow objects', () => {
      expect(SHADOWS.sm.elevation).toBe(1);
      expect(SHADOWS.md.elevation).toBe(2);
      expect(SHADOWS.lg.elevation).toBe(4);
      expect(SHADOWS.sm.shadowColor).toBe('#000');
    });
  });

  describe('TOUCH_TARGET', () => {
    it('should have correct touch target sizes', () => {
      expect(TOUCH_TARGET.min).toBe(44);
      expect(TOUCH_TARGET.comfortable).toBe(48);
    });
  });

  describe('DEVICE', () => {
    it('should have device dimensions', () => {
      expect(typeof DEVICE.width).toBe('number');
      expect(typeof DEVICE.height).toBe('number');
      expect(typeof DEVICE.isSmall).toBe('boolean');
      expect(typeof DEVICE.isIOS).toBe('boolean');
      expect(typeof DEVICE.isAndroid).toBe('boolean');
    });
  });

  describe('ANIMATION', () => {
    it('should have animation durations', () => {
      expect(ANIMATION.fast).toBe(150);
      expect(ANIMATION.normal).toBe(250);
      expect(ANIMATION.slow).toBe(350);
      expect(ANIMATION.slowest).toBe(500);
    });
  });

  describe('Z_INDEX', () => {
    it('should have z-index levels', () => {
      expect(Z_INDEX.background).toBe(0);
      expect(Z_INDEX.content).toBe(1);
      expect(Z_INDEX.overlay).toBe(10);
      expect(Z_INDEX.modal).toBe(100);
      expect(Z_INDEX.toast).toBe(1000);
    });
  });

  describe('HAPTIC_TYPES', () => {
    it('should have haptic types', () => {
      expect(HAPTIC_TYPES.light).toBe('light');
      expect(HAPTIC_TYPES.success).toBe('success');
      expect(HAPTIC_TYPES.error).toBe('error');
    });
  });

  describe('getResponsiveSpacing', () => {
    it('should return spacing value', () => {
      const result = getResponsiveSpacing('md');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return value for all spacing keys', () => {
      expect(getResponsiveSpacing('xs')).toBeGreaterThan(0);
      expect(getResponsiveSpacing('sm')).toBeGreaterThan(0);
      expect(getResponsiveSpacing('lg')).toBeGreaterThan(0);
      expect(getResponsiveSpacing('xl')).toBeGreaterThan(0);
    });
  });

  describe('getResponsiveFontSize', () => {
    it('should return font size', () => {
      const result = getResponsiveFontSize('base');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return value for all font size keys', () => {
      expect(getResponsiveFontSize('xs')).toBeGreaterThan(0);
      expect(getResponsiveFontSize('lg')).toBeGreaterThan(0);
      expect(getResponsiveFontSize('xxxl')).toBeGreaterThan(0);
    });
  });

  describe('createResponsiveStyle', () => {
    it('should return a style object', () => {
      const small = { padding: 8 };
      const medium = { padding: 16 };
      const large = { padding: 24 };

      const result = createResponsiveStyle(small, medium, large);
      expect(result).toBeDefined();
      expect(typeof result.padding).toBe('number');
    });

    it('should return small style when only small provided', () => {
      const style = { padding: 8 };
      const result = createResponsiveStyle(style);
      expect(result.padding).toBe(8);
    });
  });
});
