/**
 * LanguageSettingsScreen Test Suite
 * Tests language selection rendering and interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/services/i18n', () => ({
  useI18n: jest.fn(() => ({
    language: 'ko',
    setLanguage: jest.fn(() => Promise.resolve()),
    t: {
      languageSettings: {
        title: '언어 설정',
        korean: '한국어',
        english: 'English',
        changeConfirm: '언어 변경',
        changeMessage: '언어를 변경하시겠습니까?',
      },
    },
    isLoading: false,
  })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000',
      surface: '#FFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666',
      textTertiary: '#999',
      textInverse: '#FFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCC',
      primaryLight: '#E5E5E5',
    },
  })),
  ThemeColors: {},
}));

jest.mock('@/components/settings/SettingSection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, { testID: `section-${title}` },
        React.createElement(Text, null, title),
        children,
      ),
  };
});

jest.mock('@/styles/modernTheme', () => ({
  SPACING: { sm: 8, md: 12, lg: 16, xl: 20 },
  TYPOGRAPHY: {
    fontSize: { sm: 12, base: 16, lg: 18 },
    fontWeight: { bold: '700', semibold: '600' },
    lineHeight: { relaxed: 1.5 },
  },
  RADIUS: { base: 8, lg: 12 },
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LanguageSettingsScreen } from '../LanguageSettingsScreen';
import { useI18n } from '@/services/i18n';

const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: mockGoBack,
} as unknown;

const createRoute = () => ({
  key: 'LanguageSettings',
  name: 'LanguageSettings',
  params: undefined,
}) as unknown;

describe('LanguageSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the language options', () => {
    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    expect(getByText('한국어')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
  });

  it('renders section with language settings title', () => {
    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    expect(getByText('언어 설정')).toBeTruthy();
  });

  it('shows info text in Korean when language is ko', () => {
    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    expect(getByText(/언어를 변경하면 앱 전체에 즉시 적용됩니다/)).toBeTruthy();
  });

  it('calls navigation.goBack when a language is selected', async () => {
    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    fireEvent.press(getByText('한국어'));

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('calls setLanguage when a different language is selected', async () => {
    const mockSetLanguage = jest.fn(() => Promise.resolve());
    (useI18n as jest.Mock).mockReturnValueOnce({
      language: 'ko',
      setLanguage: mockSetLanguage,
      t: {
        languageSettings: {
          title: '언어 설정',
          korean: '한국어',
          english: 'English',
          changeConfirm: '언어 변경',
          changeMessage: '언어를 변경하시겠습니까?',
        },
      },
      isLoading: false,
    });

    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    fireEvent.press(getByText('English'));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith('en');
    });
  });

  it('does not call setLanguage when same language is selected', async () => {
    const mockSetLanguage = jest.fn(() => Promise.resolve());
    (useI18n as jest.Mock).mockReturnValueOnce({
      language: 'ko',
      setLanguage: mockSetLanguage,
      t: {
        languageSettings: {
          title: '언어 설정',
          korean: '한국어',
          english: 'English',
          changeConfirm: '언어 변경',
          changeMessage: '언어를 변경하시겠습니까?',
        },
      },
      isLoading: false,
    });

    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    // Korean is already selected (language === 'ko'), so setLanguage should NOT be called
    fireEvent.press(getByText('한국어'));

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
    expect(mockSetLanguage).not.toHaveBeenCalled();
  });

  it('shows info text in English when language is en', () => {
    (useI18n as jest.Mock).mockReturnValueOnce({
      language: 'en',
      setLanguage: jest.fn(() => Promise.resolve()),
      t: {
        languageSettings: {
          title: 'Language Settings',
          korean: '한국어',
          english: 'English',
          changeConfirm: 'Change Language',
          changeMessage: 'Change language?',
        },
      },
      isLoading: false,
    });

    const { getByText } = render(
      <LanguageSettingsScreen
        navigation={mockNavigation as never}
        route={createRoute() as never}
      />
    );

    expect(getByText(/Language changes will be applied immediately/)).toBeTruthy();
  });
});
