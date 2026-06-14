/**
 * useSemanticTokens — single source for picking the active Wanted semantic token
 * set, honoring BOTH dark mode and the accessibility "high contrast" setting.
 *
 * Replaces the inline `const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light`
 * that screens used directly — that selection ignored high contrast entirely, so the
 * accessibility toggle had no effect on the Wanted-design UI (the bulk of the app).
 *
 * The high-contrast read is tolerant (`useContext` + fallback) so components stay
 * testable without wrapping `AccessibilityProvider`; high contrast defaults off.
 */
import { useContext } from 'react';

import {
  WANTED_TOKENS,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import {
  WANTED_TOKENS_LIGHT_HC,
  WANTED_TOKENS_DARK_HC,
} from '@/styles/highContrastTokens';
import AccessibilityContext from '@/contexts/AccessibilityContext';

import { useTheme } from './themeContext';

export function useSemanticTokens(): WantedSemanticTheme {
  const { isDark } = useTheme();
  const accessibility = useContext(AccessibilityContext);
  const highContrastEnabled =
    accessibility?.settings.highContrastEnabled ?? false;

  if (highContrastEnabled) {
    return (
      isDark ? WANTED_TOKENS_DARK_HC : WANTED_TOKENS_LIGHT_HC
    ) as WantedSemanticTheme;
  }
  return isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
}

export default useSemanticTokens;
