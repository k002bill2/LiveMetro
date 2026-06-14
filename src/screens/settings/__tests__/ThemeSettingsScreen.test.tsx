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

// BANNED 규칙 준수: jest.fn은 factory 내부 inline 정의 (hoist 함정 회피).
// 테스트에서는 jest.requireMock의 __themeValue로 setter들에 접근한다.
jest.mock('@/services/theme', () => {
  const themeValue = {
    themeMode: 'system',
    setThemeMode: jest.fn(() => Promise.resolve()),
    isDark: false,
    accentColorId: 'blue',
    setAccentColor: jest.fn(() => Promise.resolve()),
    autoSwitchEnabled: false,
    setAutoSwitchEnabled: jest.fn(() => Promise.resolve()),
  };
  return {
    useTheme: jest.fn(() => themeValue),
    useSemanticTokens: jest.fn(() =>
      jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light,
    ),
    __themeValue: themeValue,
  };
});

const { __themeValue: baseThemeValue } = jest.requireMock('@/services/theme') as {
  __themeValue: {
    themeMode: string;
    setThemeMode: jest.Mock;
    isDark: boolean;
    accentColorId: string;
    setAccentColor: jest.Mock;
    autoSwitchEnabled: boolean;
    setAutoSwitchEnabled: jest.Mock;
  };
};
const mockSetThemeMode = baseThemeValue.setThemeMode;
const mockSetAccentColor = baseThemeValue.setAccentColor;
const mockSetAutoSwitchEnabled = baseThemeValue.setAutoSwitchEnabled;

jest.mock('@/components/settings/AccentColorSwatches', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({
      selectedId,
      onSelect,
    }: {
      selectedId: string;
      onSelect: (id: string) => void;
    }) =>
      React.createElement(
        TouchableOpacity,
        { testID: 'accent-swatches', onPress: () => onSelect('purple') },
        React.createElement(Text, null, selectedId),
      ),
  };
});

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

  it('renders the mode section title (design: "모드")', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('모드')).toHaveTextContent('모드');
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
      ...baseThemeValue,
      themeMode: 'dark',
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

  // ========== 다크 모드 자동 전환 ==========

  it('wires the auto dark switch toggle to the theme context', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('toggle-시간대별 자동 전환'));

    expect(mockSetAutoSwitchEnabled).toHaveBeenCalledWith(true);
  });

  it('shows the manual mode caption when auto switch is off', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('직접 모드를 선택해 사용해요.')).toHaveTextContent(
      '직접 모드를 선택해 사용해요.',
    );
  });

  it('shows the sunrise/sunset caption when auto switch is on', () => {
    (useTheme as jest.Mock).mockReturnValueOnce({
      ...baseThemeValue,
      autoSwitchEnabled: true,
    });

    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(
      getByText('서울 일출 · 일몰 기준으로 자동 전환돼요.'),
    ).toHaveTextContent('서울 일출 · 일몰 기준으로 자동 전환돼요.');
  });

  it('turns auto switch off when a mode card is tapped while enabled', () => {
    (useTheme as jest.Mock).mockReturnValueOnce({
      ...baseThemeValue,
      autoSwitchEnabled: true,
    });

    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('theme-mode-light'));

    expect(mockSetAutoSwitchEnabled).toHaveBeenCalledWith(false);
    expect(mockSetThemeMode).toHaveBeenCalledWith('light');
  });

  // ========== 강조 색상 ==========

  it('shows the current accent color label', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);

    expect(getByText('클래식 블루')).toHaveTextContent('클래식 블루');
  });

  it('wires accent selection to the theme context', () => {
    const { getByTestId } = render(<ThemeSettingsScreen {...defaultProps} />);

    fireEvent.press(getByTestId('accent-swatches'));

    expect(mockSetAccentColor).toHaveBeenCalledWith('purple');
  });
});
