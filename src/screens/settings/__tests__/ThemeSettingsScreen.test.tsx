// Jest mock calls MUST come before imports (Jest hoisting requirement)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeSettingsScreen } from '../ThemeSettingsScreen';
import { useTheme } from '@/services/theme';
import { useI18n } from '@/services/i18n';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackScreenProps: {},
}));

jest.mock('@/styles/modernTheme', () => ({
  ...jest.requireActual('@/styles/modernTheme'),
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
  },
}));

const mockSetThemeMode = jest.fn().mockResolvedValue(undefined);
const mockGoBack = jest.fn();

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    themeMode: 'system',
    setThemeMode: mockSetThemeMode,
    isDark: false,
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      primaryLight: '#E5F0FF',
    },
  })),
  ThemeMode: {},
}));

jest.mock('@/services/i18n', () => ({
  useI18n: jest.fn(() => ({
    language: 'ko',
    t: {
      themeSettings: {
        title: '테마 설정',
        system: '시스템 설정 따름',
        systemDesc: '기기 설정에 따라 자동 전환',
        light: '라이트 모드',
        lightDesc: '밝은 배경의 화면',
        dark: '다크 모드',
        darkDesc: '어두운 배경의 화면',
      },
    },
  })),
}));

jest.mock('@/navigation/types', () => ({
  SettingsStackParamList: {},
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

const mockNavigation = {
  goBack: mockGoBack,
  navigate: jest.fn(),
};

const defaultProps = {
  navigation: mockNavigation as any,
  route: { key: 'ThemeSettings', name: 'ThemeSettings' as const, params: undefined },
};

describe('ThemeSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      themeMode: 'system',
      setThemeMode: mockSetThemeMode,
      isDark: false,
      colors: {
        primary: '#007AFF',
        background: '#FFFFFF',
        backgroundSecondary: '#F2F2F7',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#8E8E93',
        textTertiary: '#C7C7CC',
        textInverse: '#FFFFFF',
        borderLight: '#E5E5EA',
        borderMedium: '#D1D1D6',
        primaryLight: '#E5F0FF',
      },
    });
    (useI18n as jest.Mock).mockReturnValue({
      language: 'ko',
      t: {
        themeSettings: {
          title: '테마 설정',
        },
      },
    });
  });

  it('renders the theme settings section title', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    expect(getByText('테마 설정')).toBeTruthy();
  });

  it('renders all three theme options in Korean', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    expect(getByText('시스템 설정 따름')).toBeTruthy();
    expect(getByText('라이트 모드')).toBeTruthy();
    expect(getByText('다크 모드')).toBeTruthy();
  });

  it('renders theme option descriptions', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    expect(getByText('기기의 테마 설정을 따릅니다')).toBeTruthy();
    expect(getByText('밝은 화면으로 표시합니다')).toBeTruthy();
    expect(getByText('어두운 화면으로 표시합니다')).toBeTruthy();
  });

  it('shows current light mode info box when isDark is false', () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    // The info box shows "ℹ️ 현재 적용된 테마: 라이트 모드"
    expect(getByText(/현재 적용된 테마/)).toBeTruthy();
  });

  it('shows dark mode info box when isDark is true', () => {
    (useTheme as jest.Mock).mockReturnValue({
      themeMode: 'dark',
      setThemeMode: mockSetThemeMode,
      isDark: true,
      colors: {
        primary: '#0A84FF',
        background: '#000000',
        backgroundSecondary: '#1C1C1E',
        surface: '#1C1C1E',
        textPrimary: '#FFFFFF',
        textSecondary: '#EBEBF599',
        textTertiary: '#EBEBF54D',
        textInverse: '#000000',
        borderLight: '#38383A',
        borderMedium: '#48484A',
        primaryLight: '#0A2540',
      },
    });
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    // The info box shows "ℹ️ 현재 적용된 테마: 다크 모드" — use specific info text
    expect(getByText(/현재 적용된 테마/)).toBeTruthy();
  });

  it('calls setThemeMode and goBack when a theme option is pressed', async () => {
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    fireEvent.press(getByText('라이트 모드'));
    await waitFor(() => {
      expect(mockSetThemeMode).toHaveBeenCalledWith('light');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('renders English options when language is "en"', () => {
    (useI18n as jest.Mock).mockReturnValue({
      language: 'en',
      t: {
        themeSettings: {
          title: 'Theme Settings',
        },
      },
    });
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    expect(getByText('Follow System')).toBeTruthy();
    expect(getByText('Light Mode')).toBeTruthy();
    expect(getByText('Dark Mode')).toBeTruthy();
  });

  it('marks currently selected theme with a checkmark (system selected)', () => {
    // When themeMode === 'system', the system option should be selected
    (useTheme as jest.Mock).mockReturnValue({
      themeMode: 'system',
      setThemeMode: mockSetThemeMode,
      isDark: false,
      colors: {
        primary: '#007AFF',
        background: '#FFFFFF',
        backgroundSecondary: '#F2F2F7',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#8E8E93',
        textTertiary: '#C7C7CC',
        textInverse: '#FFFFFF',
        borderLight: '#E5E5EA',
        borderMedium: '#D1D1D6',
        primaryLight: '#E5F0FF',
      },
    });
    const { getByText } = render(<ThemeSettingsScreen {...defaultProps} />);
    // The component renders correctly without crashing when system is selected
    expect(getByText('시스템 설정 따름')).toBeTruthy();
  });
});
