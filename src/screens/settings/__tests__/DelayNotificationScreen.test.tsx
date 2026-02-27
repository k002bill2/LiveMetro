jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'user-1',
      displayName: 'Test User',
      preferences: {
        notificationSettings: {
          enabled: true,
          delayThresholdMinutes: 10,
          alertTypes: {
            delays: true,
            suspensions: true,
            congestion: false,
            alternativeRoutes: false,
            serviceUpdates: true,
          },
        },
      },
    },
    updateUserProfile: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    sendTestNotification: jest.fn(() => Promise.resolve(true)),
  })),
}));

jest.mock('@/components/settings/SettingSection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/settings/SettingToggle', () => {
  const React = require('react');
  const { View, Text, Switch } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      subtitle,
      value,
      onValueChange,
      disabled,
    }: {
      label: string;
      subtitle?: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, label),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        React.createElement(Switch, {
          value,
          onValueChange,
          disabled,
          testID: `toggle-${label}`,
        }),
      ),
  };
});

jest.mock('@/components/settings/SettingSlider', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      subtitle,
    }: {
      label: string;
      subtitle?: string;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, label),
        subtitle ? React.createElement(Text, null, subtitle) : null,
      ),
  };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Switch } from 'react-native';
import { DelayNotificationScreen } from '../DelayNotificationScreen';

jest.spyOn(Alert, 'alert');

describe('DelayNotificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the basic settings section', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText('기본 설정')).toBeTruthy();
  });

  it('renders the delay threshold section', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText('지연 기준')).toBeTruthy();
    expect(getByText('알림 기준 시간')).toBeTruthy();
  });

  it('renders all alert type toggles', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText('열차 지연')).toBeTruthy();
    expect(getByText('운행 중단')).toBeTruthy();
    expect(getByText('혼잡도 경고')).toBeTruthy();
    expect(getByText('대체 경로')).toBeTruthy();
    expect(getByText('서비스 업데이트')).toBeTruthy();
  });

  it('renders the test notification button', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText('테스트 알림 보내기')).toBeTruthy();
  });

  it('renders the info box', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(
      getByText(/알림은 즐겨찾기에 등록된 역과 자주 이용하는 노선을 기준으로/),
    ).toBeTruthy();
  });

  it('shows delay threshold subtitle with current value', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText(/10분 이상 지연 시 알림/)).toBeTruthy();
  });

  it('renders the delay notification enable toggle', () => {
    const { getByText } = render(<DelayNotificationScreen />);
    expect(getByText('지연 알림 받기')).toBeTruthy();
    expect(getByText('열차 지연 시 알림을 보냅니다')).toBeTruthy();
  });

  it('sends test notification when button is pressed', async () => {
    const mockSendTestNotification = jest.fn(() => Promise.resolve(true));
    const { useNotifications } = require('@/hooks/useNotifications');
    useNotifications.mockReturnValue({
      sendTestNotification: mockSendTestNotification,
    });

    const { getByText } = render(<DelayNotificationScreen />);
    fireEvent.press(getByText('테스트 알림 보내기'));

    await waitFor(() => {
      expect(mockSendTestNotification).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('성공', '테스트 알림이 전송되었습니다.');
    });
  });

  it('calls updateUserProfile when toggle is changed', async () => {
    const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
    const { useAuth } = require('@/services/auth/AuthContext');
    useAuth.mockReturnValue({
      user: {
        id: 'user-1',
        preferences: {
          notificationSettings: {
            enabled: false,
            delayThresholdMinutes: 5,
            alertTypes: {
              delays: false,
              suspensions: false,
              congestion: false,
              alternativeRoutes: false,
              serviceUpdates: false,
            },
          },
        },
      },
      updateUserProfile: mockUpdateUserProfile,
    });

    const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
    const switches = UNSAFE_getAllByType(Switch);
    // Toggle the first switch (enable notifications)
    fireEvent(switches[0], 'valueChange', true);

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalled();
    });
  });
});
