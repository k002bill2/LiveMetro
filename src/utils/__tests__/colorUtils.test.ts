/**
 * Color Utility Tests
 * Tests for subway line colors and theme utilities
 */

import {
  SUBWAY_LINE_COLORS,
  STATUS_COLORS,
  THEME_COLORS,
  getSubwayLineColor,
} from '../colorUtils';

describe('colorUtils', () => {
  describe('SUBWAY_LINE_COLORS', () => {
    it('should have colors for all main lines 1-9', () => {
      expect(SUBWAY_LINE_COLORS['1']).toBe('#0d3692');
      expect(SUBWAY_LINE_COLORS['2']).toBe('#00a84d');
      expect(SUBWAY_LINE_COLORS['3']).toBe('#ef7c1c');
      expect(SUBWAY_LINE_COLORS['4']).toBe('#00a2d1');
      expect(SUBWAY_LINE_COLORS['5']).toBe('#996cac');
      expect(SUBWAY_LINE_COLORS['6']).toBe('#cd7c2f');
      expect(SUBWAY_LINE_COLORS['7']).toBe('#747f00');
      expect(SUBWAY_LINE_COLORS['8']).toBe('#e6186c');
      expect(SUBWAY_LINE_COLORS['9']).toBe('#bb8336');
    });

    it('should have colors for extension lines', () => {
      expect(SUBWAY_LINE_COLORS.gyeongui).toBe('#77c4a3');
      expect(SUBWAY_LINE_COLORS.bundang).toBe('#fabe00');
      expect(SUBWAY_LINE_COLORS.sinbundang).toBe('#d4003b');
      expect(SUBWAY_LINE_COLORS.gyeongchun).toBe('#32c6a6');
      expect(SUBWAY_LINE_COLORS.airport).toBe('#0090d2');
    });
  });

  describe('STATUS_COLORS', () => {
    it('should have standard status colors', () => {
      expect(STATUS_COLORS.success).toBe('#10b981');
      expect(STATUS_COLORS.warning).toBe('#f59e0b');
      expect(STATUS_COLORS.error).toBe('#ef4444');
      expect(STATUS_COLORS.info).toBe('#3b82f6');
    });

    it('should have delay severity colors', () => {
      expect(STATUS_COLORS.minor).toBe('#10b981');
      expect(STATUS_COLORS.moderate).toBe('#f59e0b');
      expect(STATUS_COLORS.major).toBe('#fb923c');
      expect(STATUS_COLORS.severe).toBe('#ef4444');
    });
  });

  describe('THEME_COLORS', () => {
    it('should have light theme colors', () => {
      expect(THEME_COLORS.light.primary).toBe('#2563eb');
      expect(THEME_COLORS.light.background).toBe('#f9fafb');
      expect(THEME_COLORS.light.surface).toBe('#ffffff');
      expect(THEME_COLORS.light.text).toBe('#111827');
    });

    it('should have dark theme colors', () => {
      expect(THEME_COLORS.dark.primary).toBe('#3b82f6');
      expect(THEME_COLORS.dark.background).toBe('#111827');
      expect(THEME_COLORS.dark.surface).toBe('#1f2937');
      expect(THEME_COLORS.dark.text).toBe('#f9fafb');
    });

    it('should include status colors in both themes', () => {
      expect(THEME_COLORS.light.success).toBe(STATUS_COLORS.success);
      expect(THEME_COLORS.light.error).toBe(STATUS_COLORS.error);
      expect(THEME_COLORS.dark.success).toBe(STATUS_COLORS.success);
      expect(THEME_COLORS.dark.error).toBe(STATUS_COLORS.error);
    });
  });

  describe('getSubwayLineColor', () => {
    it('should return correct color for numeric line IDs', () => {
      expect(getSubwayLineColor('1')).toBe('#0d3692');
      expect(getSubwayLineColor('2')).toBe('#00a84d');
      expect(getSubwayLineColor('9')).toBe('#bb8336');
    });

    it('should return correct color for named lines', () => {
      expect(getSubwayLineColor('gyeongui')).toBe('#77c4a3');
      expect(getSubwayLineColor('bundang')).toBe('#fabe00');
    });

    it('should handle case-insensitive line IDs', () => {
      expect(getSubwayLineColor('GYEONGUI')).toBe('#77c4a3');
      expect(getSubwayLineColor('Bundang')).toBe('#fabe00');
      expect(getSubwayLineColor('AIRPORT')).toBe('#0090d2');
    });

    it('should return default color for unknown lines', () => {
      // Unknown lines return default color
      const result = getSubwayLineColor('unknown-line');
      expect(typeof result).toBe('string');
      expect(result.startsWith('#')).toBe(true);
    });
  });
});
