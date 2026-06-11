/**
 * ThemeSettingsScreen Test Suite
 * Wanted handoff (settings-detail-2) — 모드 미리보기 3장 그리드 선택 +
 * 접근성 빠른 토글(AccessibilityContext) 배선 검증
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeSettingsScreen } from '../ThemeSettingsScreen';
import { useTheme } from '@/services/theme';
import { useI18n } from '@/services/i18n';

// Proxy stubs every lucide icon name → its own string component.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target: object, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (typeof prop !== 'string') return undefined;
        return prop;
      },
    },
  ),
);

const mockSetThemeMode = jest.fn(() => Promise.resolve());
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    themeMode: 'system',
    setThemeMode: mockSetThemeMode,
    isDark: false,
  })),
}));

jest.mock('@/services/i18n', () => ({
  useI18n: jest.fn(() => ({
    language: 'ko',
    t: { themeSettings: { title: '테마 설정' } },
  })),
}));

const mockUpdateSettings = jest.fn(() => Promise.resolve());
jest.mock('@/contexts/AccessibilityContext', () => ({
  useAccessibility: jest.fn(() => ({
    settings: {
      highContrastEnabled: false,
      boldTextEnabled: false,
      reduceMotionEnabled: true,
    },
    updateSettings: mockUpdateSettings,
  })),
}));

jest.mock('@/components/settings/SettingSection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(
        View,
        { testID: `section-${title}` },
        React.createElement(Text, null, title),
        children,
      ),
  };
});

jest.mock('@/components/settings/SettingToggle', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onValueChange,
    }: {
      label: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
    }) =>
      React.createElement(
        TouchableOpacity,
        { testID: `toggle-${label}`, onPress: () => onValueChange(!value) },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockNavigation = { navigate: jest.fn(), goBack: mockGoBack } as unknown;

const defaultProps = {
  navigation: mockNavigation as never,
  route: {
    key: 'ThemeSettings',
    name: 'ThemeSettings',
    params: undefined,
  } as never,
};

describe('ThemeSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the theme settings section title', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('테마 설정')).toHaveTextContent('테마 설정');
  });

  it('renders the three theme mode preview cards', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByTestId('theme-mode-light').props.accessibilityRole).toBe('button');
    expect(getByTestId('theme-mode-dark').props.accessibilityRole).toBe('button');
    expect(getByTestId('theme-mode-system').props.accessibilityRole).toBe('button');
  });

  it('marks the current theme mode card as selected', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByTestId('theme-mode-system').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByTestId('theme-mode-light').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('calls setThemeMode when a preview card is tapped and stays on screen', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('theme-mode-dark'));

    expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows the currently applied light theme caption', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('현재 적용된 테마: 라이트 모드')).toHaveTextContent(
      '현재 적용된 테마: 라이트 모드',
    );
  });

  it('shows the dark theme caption when isDark is true', () => {
    (useTheme as jest.Mock).mockReturnValueOnce({
      themeMode: 'dark',
      setThemeMode: mockSetThemeMode,
      isDark: true,
    });

    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('현재 적용된 테마: 다크 모드')).toHaveTextContent(
      '현재 적용된 테마: 다크 모드',
    );
  });

  it('renders English titles when language is "en"', () => {
    (useI18n as jest.Mock).mockReturnValueOnce({
      language: 'en',
      t: { themeSettings: { title: 'Theme Settings' } },
    });

    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('Light')).toHaveTextContent('Light');
    expect(getByText('Dark')).toHaveTextContent('Dark');
    expect(getByText('System')).toHaveTextContent('System');
  });

  it('wires the high-contrast toggle to AccessibilityContext', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('toggle-고대비 모드'));

    expect(mockUpdateSettings).toHaveBeenCalledWith({ highContrastEnabled: true });
  });

  it('wires the bold-text toggle to AccessibilityContext', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('toggle-굵은 글씨'));

    expect(mockUpdateSettings).toHaveBeenCalledWith({ boldTextEnabled: true });
  });

  it('wires the reduce-motion toggle to AccessibilityContext (turns off when on)', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('toggle-모션 줄이기'));

    expect(mockUpdateSettings).toHaveBeenCalledWith({ reduceMotionEnabled: false });
  });
});
