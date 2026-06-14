/**
 * AccessibilitySettingsScreen Test Suite
 * Tests accessibility settings rendering and toggle interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AccessibilitySettingsScreen from '../AccessibilitySettingsScreen';
import { useAccessibility } from '@/contexts/AccessibilityContext';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, {
        testID: props.accessibilityLabel as string,
        accessibilityLabel: props.accessibilityLabel,
      }),
  };
});

jest.mock('@/contexts/AccessibilityContext', () => ({
  useAccessibility: jest.fn(() => ({
    settings: {
      screenReaderEnabled: false,
      reduceMotionEnabled: false,
      highContrastEnabled: false,
      largeTextEnabled: false,
      textScale: 1.0,
      boldTextEnabled: false,
      voiceAnnouncementsEnabled: false,
      hapticFeedbackEnabled: true,
      autoplayAnimations: true,
      useSystemTheme: true,
      forceDarkMode: false,
      increasedSpacing: false,
    },
    updateSettings: jest.fn(() => Promise.resolve()),
    resetSettings: jest.fn(() => Promise.resolve()),
    isDarkMode: false,
    effectiveTextScale: 1.0,
    getContrastColor: jest.fn((color: string) => color),
    shouldReduceMotion: false,
    shouldUseHaptics: true,
  })),
}));

describe('AccessibilitySettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the screen header with title', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('♿ 접근성 설정')).toBeTruthy();
    expect(getByText('앱을 더 편하게 사용할 수 있도록 설정을 조정하세요')).toBeTruthy();
  });

  it('renders system detection section', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('시스템 감지')).toBeTruthy();
    expect(getByText('화면 읽기 프로그램')).toBeTruthy();
    expect(getByText('동작 줄이기')).toBeTruthy();
  });

  it('renders the visual settings section with the high-contrast toggle', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('시각')).toBeTruthy();
    expect(getByText('고대비 모드')).toBeTruthy();
  });

  it('renders the motion settings section with the auto-animation toggle', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('동작')).toBeTruthy();
    expect(getByText('자동 애니메이션')).toBeTruthy();
  });

  it('does not render toggles for settings that are not yet wired up', () => {
    const { queryByText } = render(<AccessibilitySettingsScreen />);

    // These settings had no effect on the app, so their toggles were removed
    // rather than showing the user a control that does nothing.
    expect(queryByText('큰 텍스트')).toBeNull();
    expect(queryByText('텍스트 크기')).toBeNull();
    expect(queryByText('굵은 텍스트')).toBeNull();
    expect(queryByText('여백 늘리기')).toBeNull();
    expect(queryByText('햅틱 피드백')).toBeNull();
    expect(queryByText('음성 안내')).toBeNull();
    expect(queryByText('시스템 테마 사용')).toBeNull();
  });

  it('renders reset button', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('설정 초기화')).toBeTruthy();
  });

  it('calls resetSettings when reset button is pressed', async () => {
    const mockResetSettings = jest.fn(() => Promise.resolve());
    (useAccessibility as jest.Mock).mockReturnValueOnce({
      settings: {
        screenReaderEnabled: false,
        reduceMotionEnabled: false,
        highContrastEnabled: false,
        largeTextEnabled: false,
        textScale: 1.0,
        boldTextEnabled: false,
        voiceAnnouncementsEnabled: false,
        hapticFeedbackEnabled: true,
        autoplayAnimations: true,
        useSystemTheme: true,
        forceDarkMode: false,
        increasedSpacing: false,
      },
      updateSettings: jest.fn(() => Promise.resolve()),
      resetSettings: mockResetSettings,
      isDarkMode: false,
      effectiveTextScale: 1.0,
      getContrastColor: jest.fn((c: string) => c),
      shouldReduceMotion: false,
      shouldUseHaptics: true,
    });

    const { getByText } = render(<AccessibilitySettingsScreen />);

    fireEvent.press(getByText('설정 초기화'));

    await waitFor(() => {
      expect(mockResetSettings).toHaveBeenCalled();
    });
  });

  it('renders help info section', () => {
    const { getByText } = render(<AccessibilitySettingsScreen />);

    expect(getByText('💡 도움말')).toBeTruthy();
  });

  it('calls updateSettings when a Switch is toggled', async () => {
    const mockUpdateSettings = jest.fn(() => Promise.resolve());
    (useAccessibility as jest.Mock).mockReturnValueOnce({
      settings: {
        screenReaderEnabled: false,
        reduceMotionEnabled: false,
        highContrastEnabled: false,
        largeTextEnabled: false,
        textScale: 1.0,
        boldTextEnabled: false,
        voiceAnnouncementsEnabled: false,
        hapticFeedbackEnabled: true,
        autoplayAnimations: true,
        useSystemTheme: true,
        forceDarkMode: false,
        increasedSpacing: false,
      },
      updateSettings: mockUpdateSettings,
      resetSettings: jest.fn(() => Promise.resolve()),
      isDarkMode: false,
      effectiveTextScale: 1.0,
      getContrastColor: jest.fn((c: string) => c),
      shouldReduceMotion: false,
      shouldUseHaptics: true,
    });

    const { getByLabelText } = render(<AccessibilitySettingsScreen />);

    fireEvent(getByLabelText('고대비 모드'), 'valueChange', true);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ highContrastEnabled: true });
    });
  });
});
