/**
 * NotificationTimeScreen Test Suite
 * Tests notification time settings rendering and interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
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
      preferences: {
        favoriteStations: [],
        notificationSettings: {
          pushNotifications: true,
          weekdaysOnly: false,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '07:00',
          },
        },
        commuteSchedule: {
          weekdays: {
            morningCommute: {
              departureTime: '08:00',
              stationId: 'station-1',
              destinationStationId: 'station-2',
              bufferMinutes: 10,
            },
            eveningCommute: {
              departureTime: '18:00',
              stationId: 'station-2',
              destinationStationId: 'station-1',
              bufferMinutes: 10,
            },
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

jest.mock('@/components/settings/SettingTimePicker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) =>
      React.createElement(View, { testID: `time-${label}` },
        React.createElement(Text, null, label),
        React.createElement(Text, null, value),
      ),
  };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NotificationTimeScreen } from '../NotificationTimeScreen';
import { useAuth } from '@/services/auth/AuthContext';

describe('NotificationTimeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders commute schedule section', () => {
    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText('출퇴근 시간')).toBeTruthy();
    expect(getByText('아침 출근')).toBeTruthy();
    expect(getByText('저녁 퇴근')).toBeTruthy();
  });

  it('displays current commute times', () => {
    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText('08:00')).toBeTruthy();
    expect(getByText('18:00')).toBeTruthy();
  });

  it('renders quiet hours section', () => {
    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText('방해 금지 모드')).toBeTruthy();
    expect(getByText('조용한 시간대 사용')).toBeTruthy();
  });

  it('renders weekdays only toggle', () => {
    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText('추가 설정')).toBeTruthy();
    expect(getByText('평일만 알림 받기')).toBeTruthy();
  });

  it('renders info box text', () => {
    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText(/출퇴근 시간을 설정하면/)).toBeTruthy();
  });

  it('shows station info messages when stations are set', () => {
    const { getAllByText } = render(<NotificationTimeScreen />);

    expect(getAllByText('출발역에서 출발').length).toBe(2);
  });

  it('shows placeholder when no stations are set', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: {
        uid: 'test-uid',
        preferences: {
          notificationSettings: {
            pushNotifications: true,
            weekdaysOnly: false,
            quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
          },
          commuteSchedule: {
            weekdays: {
              morningCommute: { departureTime: '08:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
              eveningCommute: { departureTime: '18:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
            },
          },
        },
      },
      updateUserProfile: jest.fn(),
    });

    const { getAllByText } = render(<NotificationTimeScreen />);
    expect(getAllByText('즐겨찾기에서 출발역을 설정하세요').length).toBe(2);
  });

  it('shows quiet hours time pickers when enabled', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: {
        uid: 'test-uid',
        preferences: {
          notificationSettings: {
            pushNotifications: true,
            weekdaysOnly: false,
            quietHours: { enabled: true, startTime: '22:00', endTime: '07:00' },
          },
          commuteSchedule: {
            weekdays: {
              morningCommute: { departureTime: '08:00', stationId: 'st-1', destinationStationId: 'st-2', bufferMinutes: 10 },
              eveningCommute: null,
            },
          },
        },
      },
      updateUserProfile: jest.fn(),
    });

    const { getByText } = render(<NotificationTimeScreen />);

    expect(getByText('시작 시간')).toBeTruthy();
    expect(getByText('종료 시간')).toBeTruthy();
  });
});
