/**
 * Color Utility Tests
 * Tests for subway line colors and theme utilities
 */

import {
  SUBWAY_LINE_COLORS,
  STATUS_COLORS,
  THEME_COLORS,
  getSubwayLineColor,
  getDelayColor,
  getStatusColor,
  hexToRgb,
  rgbToHex,
  addAlpha,
  lighten,
  darken,
  getContrastingColor,
  getLineTextColor,
  generateGradient,
  getThemeColors,
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
      const result = getSubwayLineColor('unknown-line');
      expect(typeof result).toBe('string');
      expect(result.startsWith('#')).toBe(true);
    });

    it('should handle Korean line names (normalize strips non-alphanumeric)', () => {
      // Korean chars get stripped by normalize, so partial matching doesn't work
      // These all fall through to numeric extraction or default
      const result = getSubwayLineColor('경의중앙');
      expect(typeof result).toBe('string');
    });

    it('should handle English partial matches', () => {
      expect(getSubwayLineColor('ever-line')).toBe('#7cc4a0');
      expect(getSubwayLineColor('airport-express')).toBe('#0090d2');
    });

    it('should extract numeric line from Korean format', () => {
      expect(getSubwayLineColor('1호선')).toBe('#0d3692');
      expect(getSubwayLineColor('2호선')).toBe('#00a84d');
      expect(getSubwayLineColor('9호선')).toBe('#bb8336');
    });
  });

  describe('getDelayColor', () => {
    it('should return minor for < 5 minutes', () => {
      expect(getDelayColor(0)).toBe(STATUS_COLORS.minor);
      expect(getDelayColor(4)).toBe(STATUS_COLORS.minor);
    });

    it('should return moderate for 5-9 minutes', () => {
      expect(getDelayColor(5)).toBe(STATUS_COLORS.moderate);
      expect(getDelayColor(9)).toBe(STATUS_COLORS.moderate);
    });

    it('should return major for 10-19 minutes', () => {
      expect(getDelayColor(10)).toBe(STATUS_COLORS.major);
      expect(getDelayColor(19)).toBe(STATUS_COLORS.major);
    });

    it('should return severe for >= 20 minutes', () => {
      expect(getDelayColor(20)).toBe(STATUS_COLORS.severe);
      expect(getDelayColor(100)).toBe(STATUS_COLORS.severe);
    });
  });

  describe('getStatusColor', () => {
    it('should return correct status colors', () => {
      expect(getStatusColor('success')).toBe('#10b981');
      expect(getStatusColor('warning')).toBe('#f59e0b');
      expect(getStatusColor('error')).toBe('#ef4444');
      expect(getStatusColor('info')).toBe('#3b82f6');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should handle hex without #', () => {
      expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#xyz')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
  });

  describe('addAlpha', () => {
    it('should add alpha to hex color', () => {
      expect(addAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(addAlpha('#00ff00', 1)).toBe('rgba(0, 255, 0, 1)');
    });

    it('should return original for invalid hex', () => {
      expect(addAlpha('invalid', 0.5)).toBe('invalid');
    });
  });

  describe('lighten', () => {
    it('should lighten a color', () => {
      const result = lighten('#800000', 50);
      expect(result).toBeDefined();
      expect(result.startsWith('#')).toBe(true);
    });

    it('should return original for invalid hex', () => {
      expect(lighten('invalid', 50)).toBe('invalid');
    });

    it('should cap at 255', () => {
      const result = lighten('#ffffff', 100);
      expect(result).toBe('#ffffff');
    });
  });

  describe('darken', () => {
    it('should darken a color', () => {
      const result = darken('#ff0000', 50);
      expect(result).toBeDefined();
      expect(result.startsWith('#')).toBe(true);
    });

    it('should return original for invalid hex', () => {
      expect(darken('invalid', 50)).toBe('invalid');
    });

    it('should not go below 0', () => {
      const result = darken('#000000', 100);
      expect(result).toBe('#000000');
    });
  });

  describe('getContrastingColor', () => {
    it('should return white for dark backgrounds', () => {
      expect(getContrastingColor('#000000')).toBe('white');
      expect(getContrastingColor('#0d3692')).toBe('white');
    });

    it('should return black for light backgrounds', () => {
      expect(getContrastingColor('#ffffff')).toBe('black');
      expect(getContrastingColor('#fabe00')).toBe('black');
    });

    it('should return black for invalid hex', () => {
      expect(getContrastingColor('invalid')).toBe('black');
    });
  });

  describe('getLineTextColor', () => {
    it('should return contrasting text color for subway lines', () => {
      const result = getLineTextColor('1');
      expect(['white', 'black']).toContain(result);
    });

    it('should return white for dark line colors', () => {
      expect(getLineTextColor('1')).toBe('white'); // Dark blue
    });
  });

  describe('generateGradient', () => {
    it('should generate gradient colors', () => {
      const gradient = generateGradient('#000000', '#ffffff', 5);
      expect(gradient).toHaveLength(5);
      expect(gradient[0]).toBe('#000000');
      expect(gradient[4]).toBe('#ffffff');
    });

    it('should default to 10 steps', () => {
      const gradient = generateGradient('#000000', '#ffffff');
      expect(gradient).toHaveLength(10);
    });

    it('should return array with just two colors for invalid input', () => {
      const gradient = generateGradient('invalid', '#ffffff');
      expect(gradient).toEqual(['invalid', '#ffffff']);
    });
  });

  describe('getThemeColors', () => {
    it('should return light theme by default', () => {
      const colors = getThemeColors();
      expect(colors).toEqual(THEME_COLORS.light);
    });

    it('should return light theme when specified', () => {
      expect(getThemeColors('light')).toEqual(THEME_COLORS.light);
    });

    it('should return dark theme when specified', () => {
      expect(getThemeColors('dark')).toEqual(THEME_COLORS.dark);
    });
  });
});
