import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
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

const mockTtsService = ttsService as unknown as {
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
    jest.clearAllMocks();
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
    mockTtsService.enable.mockResolvedValue(undefined);
    mockTtsService.disable.mockResolvedValue(undefined);
    mockTtsService.updateSettings.mockResolvedValue(undefined);
    mockTtsService.test.mockResolvedValue(undefined);
    mockTtsService.announceArrival.mockResolvedValue(undefined);
  });

  it('shows loading indicator when initialize is pending', () => {
    mockTtsService.initialize.mockReturnValue(new Promise(() => {}));
    const { UNSAFE_getByType, unmount } = render(<VoiceSettingsScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    unmount();
  });

  it('calls initialize on mount', async () => {
    render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(mockTtsService.initialize).toHaveBeenCalled();
    });
  });

  it('loads available voices on mount', async () => {
    render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(mockTtsService.loadAvailableVoices).toHaveBeenCalled();
    });
  });

  it('renders the enable toggle', async () => {
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음성 안내')).toBeTruthy();
      expect(getByText('알림을 음성으로 읽어줍니다')).toBeTruthy();
    });
  });

  it('renders header with title and subtitle', async () => {
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/음성 설정/)).toBeTruthy();
      expect(getByText('열차 도착 및 알림을 음성으로 안내받을 수 있습니다')).toBeTruthy();
    });
  });

  it('renders info section with instructions', async () => {
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/음성 안내는 다음 상황에서 작동합니다/)).toBeTruthy();
      expect(getByText(/열차 도착 알림/)).toBeTruthy();
      expect(getByText(/기기가 무음 모드일 경우/)).toBeTruthy();
    });
  });

  it('does not show voice selection when disabled', async () => {
    const { queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(queryByText('음성 선택')).toBeNull();
    });
  });

  it('does not show voice settings when disabled', async () => {
    const { queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(queryByText('음성 조절')).toBeNull();
    });
  });

  it('does not show test buttons when disabled', async () => {
    const { queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(queryByText(/음성 테스트/)).toBeNull();
      expect(queryByText(/도착 안내 테스트/)).toBeNull();
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

  it('displays only korean voices', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText, queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('Korean Female')).toBeTruthy();
      expect(getByText('Korean Male')).toBeTruthy();
      expect(queryByText('English Female')).toBeNull();
    });
  });

  it('displays voice quality labels', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/고품질/)).toBeTruthy();
      expect(getByText(/기본/)).toBeTruthy();
    });
  });

  it('displays checkmark on selected voice', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { queryAllByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      const checkmarks = queryAllByText('✓');
      expect(checkmarks.length).toBeGreaterThan(0);
    });
  });

  it('does not show voice selection when voices are empty', async () => {
    mockTtsService.loadAvailableVoices.mockResolvedValue([]);
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-default',
    });
    const { queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(queryByText('음성 선택')).toBeNull();
    });
  });

  it('calls updateSettings when voice is pressed', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('Korean Female')).toBeTruthy();
    });

    const voiceButton = getByText('Korean Female').parent;
    fireEvent.press(voiceButton!);

    await waitFor(() => {
      expect(mockTtsService.updateSettings).toHaveBeenCalledWith({ voiceId: 'ko-KR-1' });
    });
  });

  it('calls updateSettings for different voice', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-2',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('Korean Male')).toBeTruthy();
    });

    const voiceButton = getByText('Korean Male').parent;
    fireEvent.press(voiceButton!);

    await waitFor(() => {
      expect(mockTtsService.updateSettings).toHaveBeenCalledWith({ voiceId: 'ko-KR-2' });
    });
  });

  it('shows voice settings section when enabled', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.2,
      rate: 1.5,
      volume: 0.7,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음성 조절')).toBeTruthy();
    });
  });

  it('displays pitch slider', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.2,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText, getAllByTestId } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음높이')).toBeTruthy();
      const sliders = getAllByTestId('slider');
      expect(sliders.length).toBeGreaterThan(0);
    });
  });

  it('displays rate slider', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.5,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('속도')).toBeTruthy();
    });
  });

  it('displays volume slider', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.7,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음량')).toBeTruthy();
    });
  });

  it('displays pitch value as fixed decimal', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.2,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('1.2')).toBeTruthy();
    });
  });

  it('displays rate value as fixed decimal', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.5,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('1.5')).toBeTruthy();
    });
  });

  it('displays volume as percentage', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.7,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('70%')).toBeTruthy();
    });
  });

  it('calls enable when toggling from disabled to enabled', async () => {
    const { UNSAFE_getByType } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(mockTtsService.getSettings).toHaveBeenCalled();
    });

    const { Switch } = require('react-native');
    const switchComponent = UNSAFE_getByType(Switch);
    fireEvent(switchComponent, 'valueChange', true);

    await waitFor(() => {
      expect(mockTtsService.enable).toHaveBeenCalled();
    });
  });

  it('calls disable when toggling from enabled to disabled', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { UNSAFE_getByType } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(mockTtsService.getSettings).toHaveBeenCalled();
    });

    const { Switch } = require('react-native');
    const switchComponent = UNSAFE_getByType(Switch);
    fireEvent(switchComponent, 'valueChange', false);

    await waitFor(() => {
      expect(mockTtsService.disable).toHaveBeenCalled();
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

  it('shows test section with title', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('테스트')).toBeTruthy();
    });
  });

  it('calls test method when test button is pressed', async () => {
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
    });

    const testButton = getByText(/음성 테스트/);
    fireEvent.press(testButton);

    await waitFor(() => {
      expect(mockTtsService.test).toHaveBeenCalled();
    });
  });

  it('calls announceArrival when arrival test is pressed', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText(/도착 안내 테스트/)).toBeTruthy();
    });

    const arrivalButton = getByText(/도착 안내 테스트/);
    fireEvent.press(arrivalButton);

    await waitFor(() => {
      expect(mockTtsService.announceArrival).toHaveBeenCalledWith({
        lineName: '2호선',
        stationName: '강남',
        direction: '외선순환',
        minutes: 3,
      });
    });
  });

  it('handles volume at 0%', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('0%')).toBeTruthy();
    });
  });

  it('handles volume at 100%', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 1.0,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('100%')).toBeTruthy();
    });
  });

  it('handles minimum pitch value', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 0.5,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('0.5')).toBeTruthy();
    });
  });

  it('handles maximum pitch value', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 2.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('2.0')).toBeTruthy();
    });
  });

  it('renders all sections in correct order when enabled', async () => {
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'ko-KR-1',
    });
    const { getByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(getByText('음성 안내')).toBeTruthy();
      expect(getByText('음성 선택')).toBeTruthy();
      expect(getByText('음성 조절')).toBeTruthy();
      expect(getByText('테스트')).toBeTruthy();
    });
  });

  it('handles all non-korean voices', async () => {
    mockTtsService.loadAvailableVoices.mockResolvedValue([
      { id: 'en-US-1', name: 'English Female', language: 'en-US', quality: 'default' },
      { id: 'ja-JP-1', name: 'Japanese Female', language: 'ja-JP', quality: 'default' },
    ]);
    mockTtsService.getSettings.mockReturnValue({
      enabled: true,
      pitch: 1.0,
      rate: 1.0,
      volume: 0.8,
      voiceId: 'en-US-1',
    });
    const { queryByText } = render(<VoiceSettingsScreen />);
    await waitFor(() => {
      expect(queryByText('음성 선택')).toBeNull();
    });
  });
});
