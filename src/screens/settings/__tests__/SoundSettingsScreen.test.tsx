/**
 * SoundSettingsScreen Test Suite
 * Tests sound settings rendering and notification toggles
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SoundSettingsScreen } from '../SoundSettingsScreen';
import { useAuth } from '@/services/auth/AuthContext';
import { soundService } from '@/services/sound/soundService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('lucide-react-native', () => ({
  Clock: 'Clock',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      isAnonymous: false,
      preferences: {
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: true,
            soundId: 'default',
            volume: 80,
            vibrationEnabled: true,
            vibrationPattern: 'default',
          },
        },
      },
    },
    updateUserProfile: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
    },
  }),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    sendTestNotification: jest.fn(() => Promise.resolve(true)),
  }),
}));

jest.mock('@/services/sound/soundService', () => ({
  soundService: {
    initialize: jest.fn(),
    cleanup: jest.fn(),
    playSound: jest.fn(),
  },
  NOTIFICATION_SOUNDS: [
    { id: 'default', name: '기본', file: 'default.mp3' },
    { id: 'chime', name: '차임', file: 'chime.mp3' },
  ],
  VIBRATION_PATTERNS: [
    { id: 'default', name: '기본', pattern: [0, 250] },
    { id: 'strong', name: '강하게', pattern: [0, 500] },
  ],
}));

jest.mock('@/services/email/emailService', () => ({
  emailNotificationService: {
    sendTestEmail: jest.fn(() => Promise.resolve(true)),
  },
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

jest.mock('@/components/settings/SettingToggle', () => {
  const React = require('react');
  const { View, Text, Switch } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, subtitle, value, onValueChange, disabled }: {
      label: string; subtitle?: string; value: boolean;
      onValueChange: (v: boolean) => void; disabled?: boolean;
    }) =>
      React.createElement(View, { testID: `toggle-${label}` },
        React.createElement(Text, null, label),
        subtitle && React.createElement(Text, null, subtitle),
        React.createElement(Switch, {
          testID: `switch-${label}`,
          value,
          onValueChange,
          disabled,
        }),
      ),
  };
});

jest.mock('@/components/settings/SettingSlider', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: number }) =>
      React.createElement(View, { testID: `slider-${label}` },
        React.createElement(Text, null, label),
        React.createElement(Text, null, `${value}`),
      ),
  };
});

jest.mock('@/components/settings/SoundPicker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label }: { label: string }) =>
      React.createElement(View, { testID: `sound-picker-${label}` },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock('@/components/settings/VibrationPicker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label }: { label: string }) =>
      React.createElement(View, { testID: `vibration-picker-${label}` },
        React.createElement(Text, null, label),
      ),
  };
});

describe('SoundSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders notification methods section', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText('알림 방식')).toBeTruthy();
    expect(getByText('푸시 알림')).toBeTruthy();
    expect(getByText('이메일 알림')).toBeTruthy();
  });

  it('renders sound effects section', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText('알림 효과')).toBeTruthy();
    expect(getByText('알림음')).toBeTruthy();
    expect(getByText('진동')).toBeTruthy();
  });

  it('shows sound picker and volume slider when sound is enabled', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText('알림음 선택')).toBeTruthy();
    expect(getByText('볼륨')).toBeTruthy();
  });

  it('shows vibration picker when vibration is enabled', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText('진동 패턴')).toBeTruthy();
  });

  it('renders test notification button', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText('테스트 알림 보내기')).toBeTruthy();
  });

  it('renders info box about push notifications', () => {
    const { getByText } = render(<SoundSettingsScreen />);

    expect(getByText(/푸시 알림이 켜져 있어야/)).toBeTruthy();
  });

  it('initializes and cleans up sound service', () => {
    const { unmount } = render(<SoundSettingsScreen />);

    expect(soundService.initialize).toHaveBeenCalled();

    unmount();
    expect(soundService.cleanup).toHaveBeenCalled();
  });

  it('hides sound picker when sound is disabled', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: {
        uid: 'test-uid',
        email: 'test@example.com',
        isAnonymous: false,
        preferences: {
          notificationSettings: {
            pushNotifications: true,
            emailNotifications: false,
            soundSettings: {
              soundEnabled: false,
              soundId: 'default',
              volume: 80,
              vibrationEnabled: false,
              vibrationPattern: 'default',
            },
          },
        },
      },
      updateUserProfile: jest.fn(),
    });

    const { queryByText } = render(<SoundSettingsScreen />);

    expect(queryByText('알림음 선택')).toBeNull();
    expect(queryByText('볼륨')).toBeNull();
    expect(queryByText('진동 패턴')).toBeNull();
  });
});
