import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ttsService } from '@/services/speech/ttsService';
import VoiceSettingsScreen from '../VoiceSettingsScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, props, children as React.ReactNode);
  },
  SafeAreaProvider: ({ children }: Record<string, unknown>) => children,
}));

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: 'slider', ...props }),
  };
});

jest.mock('@/services/speech/ttsService', () => ({
  ttsService: {
    initialize: jest.fn(() => Promise.resolve()),
    getSettings: jest.fn(() => ({
      enabled: false,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-default',
    })),
    loadAvailableVoices: jest.fn(() =>
      Promise.resolve([
        { id: 'ko-KR-1', name: 'Korean Female', language: 'ko-KR', quality: 'enhanced' },
        { id: 'ko-KR-2', name: 'Korean Male', language: 'ko-KR', quality: 'default' },
        { id: 'en-US-1', name: 'English Female', language: 'en-US', quality: 'default' },
      ]),
    ),
    enable: jest.fn(() => Promise.resolve()),
    disable: jest.fn(() => Promise.resolve()),
    updateSettings: jest.fn(() => Promise.resolve()),
    test: jest.fn(() => Promise.resolve()),
    announceArrival: jest.fn(() => Promise.resolve()),
  },
}));

const mockTtsService = ttsService as {
  initialize: jest.Mock;
  getSettings: jest.Mock;
  loadAvailableVoices: jest.Mock;
  enable: jest.Mock;
  disable: jest.Mock;
  updateSettings: jest.Mock;
  test: jest.Mock;
  announceArrival: jest.Mock;
};

describe('VoiceSettingsScreen', () => {
  beforeEach(() => {
    mockTtsService.initialize.mockResolvedValue(undefined);
    mockTtsService.getSettings.mockReturnValue({
      enabled: false,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-default',
    });
    mockTtsService.loadAvailableVoices.mockResolvedValue([
      { id: 'ko-KR-1', name: 'Korean Female', language: 'ko-KR', quality: 'enhanced' },
      { id: 'ko-KR-2', name: 'Korean Male', language: 'ko-KR', quality: 'default' },
      { id: 'en-US-1', name: 'English Female', language: 'en-US', quality: 'default' },
    ]);
  });

  it('shows loading indicator when initialize is pending', () => {
    mockTtsService.initialize.mockReturnValue(new Promise(() => {}));
    const { UNSAFE_getByType, unmount } = render(<VoiceSettingsScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    unmount();
  });

  it('renders the enable toggle', async () => {
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음성 안내')).toBeTruthy();
      expect(getByText('알림을 음성으로 읽어줍니다')).toBeTruthy();
    });
  });

  it('shows voice selection when enabled', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음성 선택')).toBeTruthy();
    });
  });

  it('shows test buttons when enabled', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/음성 테스트/)).toBeTruthy();
      expect(getByText(/도착 안내 테스트/)).toBeTruthy();
    });
  });

  it('renders info section', async () => {
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/음성 안내는 다음 상황에서 작동합니다/)).toBeTruthy();
    });
  });
});
