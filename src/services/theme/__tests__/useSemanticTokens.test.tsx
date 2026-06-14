/**
 * useSemanticTokens Tests — verifies the hook picks the right Wanted semantic
 * token set across dark mode × high-contrast.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { useSemanticTokens } from '../useSemanticTokens';
import { WANTED_TOKENS } from '@/styles/modernTheme';
import {
  WANTED_TOKENS_LIGHT_HC,
  WANTED_TOKENS_DARK_HC,
} from '@/styles/highContrastTokens';
import AccessibilityContext from '@/contexts/AccessibilityContext';
import { useTheme } from '../themeContext';

jest.mock('../themeContext', () => ({
  useTheme: jest.fn(),
}));

const mockUseTheme = useTheme as jest.Mock;

// Controlled AccessibilityContext value (the value type is internal → cast).
const hcWrapper = (highContrastEnabled: boolean) => {
  const HcWrapper = ({ children }: { children: React.ReactNode }) => (
    <AccessibilityContext.Provider
      value={
        { settings: { highContrastEnabled } } as unknown as React.ContextType<
          typeof AccessibilityContext
        >
      }
    >
      {children}
    </AccessibilityContext.Provider>
  );
  return HcWrapper;
};

describe('useSemanticTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the standard light tokens when high contrast is off in light mode', () => {
    mockUseTheme.mockReturnValue({ isDark: false });
    // No AccessibilityProvider → tolerant fallback to high-contrast off.
    const { result } = renderHook(() => useSemanticTokens());
    expect(result.current).toBe(WANTED_TOKENS.light);
  });

  it('returns the standard dark tokens when high contrast is off in dark mode', () => {
    mockUseTheme.mockReturnValue({ isDark: true });
    const { result } = renderHook(() => useSemanticTokens());
    expect(result.current).toBe(WANTED_TOKENS.dark);
  });

  it('returns the high-contrast light tokens when high contrast is on in light mode', () => {
    mockUseTheme.mockReturnValue({ isDark: false });
    const { result } = renderHook(() => useSemanticTokens(), {
      wrapper: hcWrapper(true),
    });
    expect(result.current).toBe(WANTED_TOKENS_LIGHT_HC);
    expect(result.current.bgBase).toBe('#FFFFFF');
    expect(result.current.lineNormal).toBe('#000000');
    expect(result.current.labelNormal).toBe('#000000');
  });

  it('returns the high-contrast dark tokens when high contrast is on in dark mode', () => {
    mockUseTheme.mockReturnValue({ isDark: true });
    const { result } = renderHook(() => useSemanticTokens(), {
      wrapper: hcWrapper(true),
    });
    expect(result.current).toBe(WANTED_TOKENS_DARK_HC);
    expect(result.current.bgBase).toBe('#000000');
    expect(result.current.lineNormal).toBe('#FFFFFF');
    expect(result.current.labelNormal).toBe('#FFFFFF');
  });

  it('falls back to standard tokens when high contrast is explicitly off', () => {
    mockUseTheme.mockReturnValue({ isDark: false });
    const { result } = renderHook(() => useSemanticTokens(), {
      wrapper: hcWrapper(false),
    });
    expect(result.current).toBe(WANTED_TOKENS.light);
  });
});
