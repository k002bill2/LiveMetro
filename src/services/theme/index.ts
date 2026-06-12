/**
 * Theme Services
 * Centralized exports for theme-related services
 */

export * from './highContrastTheme';
export { ThemeProvider, useTheme, useColors } from './themeContext';
export type { ThemeColors, ThemeMode, ResolvedTheme } from './themeContext';
export {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR_ID,
  getAccentColorOption,
  isAccentColorId,
} from './accentColors';
export type { AccentColorId, AccentColorOption } from './accentColors';
