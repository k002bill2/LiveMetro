import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Switch } from 'react-native';
import { DelayNotificationScreen } from '../DelayNotificationScreen';

// Phase 46 — screen now calls useTheme().isDark to drive WANTED_TOKENS
// semantic selection. Force light variant for stable assertions.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Hero master card renders a gradient when enabled — View pass-through mock
// (same pattern as other screens using expo-linear-gradient).
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

interface NotificationCallArgs {
  preferences: {
    notificationSettings: {
      enabled: boolean;
      delayThresholdMinutes: number;
      alertTypes: {
        delays: boolean;
        suspensions: boolean;
        congestion: boolean;
        alternativeRoutes: boolean;
        serviceUpdates: boolean;
      };
      lineFilter?: string[];
      alertSources?: {
        official: boolean;
        community: boolean;
        urgent: boolean;
      };
    };
  };
}

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
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(() => Promise.resolve()),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
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

jest.spyOn(Alert, 'alert');

describe('DelayNotificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the master hero card with title and enabled subtitle', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('지연 알림')).toBeTruthy();
      expect(getByText('내 노선의 지연을 실시간으로 알려드려요')).toBeTruthy();
    });

    it('renders the delay threshold section with step labels and footer', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('알림 기준')).toBeTruthy();
      expect(getByText('3분')).toBeTruthy();
      expect(getByText('5분')).toBeTruthy();
      expect(getByText('10분')).toBeTruthy();
      expect(getByText('15분')).toBeTruthy();
      expect(
        getByText('설정한 시간보다 짧은 지연은 알림이 오지 않아요.'),
      ).toBeTruthy();
    });

    it('renders the line filter section with badge pills', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('알림 받을 노선')).toBeTruthy();
      expect(getByText('1호선')).toBeTruthy();
      expect(getByText('9호선')).toBeTruthy();
      expect(getByText('경의중앙선')).toBeTruthy();
    });

    it('shows 전체 노선 hint when no lines are filtered', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('전체 노선')).toBeTruthy();
    });

    it('renders the alert source rows', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('알림 종류')).toBeTruthy();
      expect(getByText('공식 운영기관 발표')).toBeTruthy();
      expect(getByText('서울교통공사 · 코레일 공지')).toBeTruthy();
      expect(getByText('실시간 제보')).toBeTruthy();
      expect(getByText('검증된 사용자 제보 3건 이상')).toBeTruthy();
      expect(getByText('긴급 푸시')).toBeTruthy();
      expect(getByText('10분 이상 심각한 지연만 진동/소리')).toBeTruthy();
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

    it('shows delay threshold hint with current value', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('10분 이상 지연')).toBeTruthy();
    });

    it('renders the delay notification master toggle', () => {
      const { getByTestId } = render(<DelayNotificationScreen />);
      expect(getByTestId('delay-master-toggle').props.value).toBe(true);
    });

    it('renders alert type subtitles', () => {
      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('정상 운행 시간보다 지연될 때')).toBeTruthy();
      expect(getByText('열차 운행이 일시 중단될 때')).toBeTruthy();
      expect(getByText('열차 혼잡도가 높을 때')).toBeTruthy();
      expect(getByText('지연 시 대체 경로 추천')).toBeTruthy();
      expect(getByText('노선 변경 및 공지사항')).toBeTruthy();
    });

    it('displays default threshold value when not set', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: false,
              delayThresholdMinutes: undefined,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('5분 이상 지연')).toBeTruthy();
    });

    it('displays enabled toggle state correctly', () => {
      const { getByText, UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      expect(getByText('지연 알림')).toBeTruthy();
      const switches = UNSAFE_getAllByType(Switch);
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  describe('User Interactions - Toggle Enabled', () => {
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

    it('calls updateUserProfile when enabled toggle is changed to true', async () => {
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.enabled).toBe(true);
      });
    });

    it('calls updateUserProfile when enabled toggle is changed to false', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.enabled).toBe(false);
      });
    });

    it('shows saving state during enabled toggle update', async () => {
      const mockUpdateUserProfile = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
      });
    });
  });

  describe('User Interactions - Threshold Change', () => {
    it('updates threshold when slider value changes', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByTestId } = render(<DelayNotificationScreen />);

      fireEvent.press(getByTestId('threshold-step-15'));

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.delayThresholdMinutes).toBe(15);
      });
    });

    it('shows error alert when threshold update fails', async () => {
      const mockUpdateUserProfile = jest.fn(() =>
        Promise.reject(new Error('Update failed'))
      );
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByTestId } = render(<DelayNotificationScreen />);

      fireEvent.press(getByTestId('threshold-step-3'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });

    it('handles null user gracefully for threshold change', () => {
      const mockUpdateUserProfile = jest.fn();
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      render(<DelayNotificationScreen />);

      // When user is null, screen may show different content
      // updateUserProfile should not have been called
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions - Alert Types', () => {
    it('toggles delays alert type', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
              alertTypes: {
                delays: true,
                suspensions: false,
                congestion: false,
                alternativeRoutes: false,
                serviceUpdates: false,
              },
            },
          },
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Index map after Wanted handoff redesign:
      // [0]=enabled, [1]=alertSources.official, [2]=community, [3]=urgent,
      // [4]=alertTypes.delays, [5]=suspensions, [6]=congestion,
      // [7]=alternativeRoutes, [8]=serviceUpdates.
      fireEvent(switches[4], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertTypes.delays).toBe(false);
      });
    });

    it('toggles suspensions alert type', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Third switch should be suspensions toggle
      fireEvent(switches[5], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertTypes.suspensions).toBe(true);
      });
    });

    it('toggles congestion alert type', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Fourth switch should be congestion toggle
      fireEvent(switches[6], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertTypes.congestion).toBe(true);
      });
    });

    it('toggles alternativeRoutes alert type', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Fifth switch should be alternativeRoutes toggle
      fireEvent(switches[7], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertTypes.alternativeRoutes).toBe(true);
      });
    });

    it('toggles serviceUpdates alert type', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Sixth switch should be serviceUpdates toggle
      fireEvent(switches[8], 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertTypes.serviceUpdates).toBe(true);
      });
    });
  });

  describe('Error Handling - Toggle Enabled', () => {
    it('shows error alert when enabled toggle fails', async () => {
      const mockUpdateUserProfile = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Error Handling - Alert Types', () => {
    it('shows error alert when alert type toggle fails', async () => {
      const mockUpdateUserProfile = jest.fn(() =>
        Promise.reject(new Error('Database error'))
      );
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[1], 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Error Handling - Threshold', () => {
    // Threshold error handling is tested in User Interactions - Threshold Change section
  });

  describe('Error Handling - Test Notification', () => {
    it('shows permission error alert when test notification fails (permissions)', async () => {
      const mockSendTestNotification = jest.fn(() => Promise.resolve(false));
      const { useNotifications } = require('@/hooks/useNotifications');
      useNotifications.mockReturnValue({
        sendTestNotification: mockSendTestNotification,
      });

      const { getByText } = render(<DelayNotificationScreen />);
      fireEvent.press(getByText('테스트 알림 보내기'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('실패', '알림 권한이 허용되지 않았습니다.');
      });
    });

    it('shows error alert when test notification throws error', async () => {
      const mockSendTestNotification = jest.fn(() =>
        Promise.reject(new Error('Notification service error'))
      );
      const { useNotifications } = require('@/hooks/useNotifications');
      useNotifications.mockReturnValue({
        sendTestNotification: mockSendTestNotification,
      });

      const { getByText } = render(<DelayNotificationScreen />);
      fireEvent.press(getByText('테스트 알림 보내기'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '테스트 알림 전송에 실패했습니다.');
      });
    });
  });

  describe('Edge Cases - User Null', () => {
    it('handles null user gracefully for enabled toggle', async () => {
      const mockUpdateUserProfile = jest.fn();
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', true);

      // Should not call updateUserProfile when user is null
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    it('handles null user gracefully for alert type toggle', async () => {
      const mockUpdateUserProfile = jest.fn();
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[1], 'valueChange', true);

      // Should not call updateUserProfile when user is null
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    it('displays default enabled state when user is null', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      // null user → enabled=false → hero renders the off-state subtitle
      expect(getByText('지연 알림이 꺼져 있어요')).toBeTruthy();
    });
  });

  describe('Edge Cases - Empty Preferences', () => {
    it('handles undefined notification settings', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: undefined,
          },
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      // undefined settings → enabled=false → off-state hero still renders
      expect(getByText('지연 알림이 꺼져 있어요')).toBeTruthy();
    });

    it('handles partially defined alert types', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
              alertTypes: {
                delays: true,
                suspensions: undefined,
                congestion: false,
                alternativeRoutes: undefined,
                serviceUpdates: true,
              },
            },
          },
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('열차 지연')).toBeTruthy();
    });
  });

  describe('User Interactions - Line Filter', () => {
    it('adds a line when an unselected pill is pressed', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      fireEvent.press(getByText('2호선'));

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.lineFilter).toEqual(['2']);
      });
    });

    it('removes a line when a selected pill is pressed and shows the count hint', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              lineFilter: ['2', '9'],
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      expect(getByText('2개 선택됨')).toBeTruthy();

      fireEvent.press(getByText('2호선'));

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.lineFilter).toEqual(['9']);
      });
    });

    it('does not call updateUserProfile for line pills when user is null', () => {
      const mockUpdateUserProfile = jest.fn();
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<DelayNotificationScreen />);
      fireEvent.press(getByText('2호선'));

      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions - Alert Sources', () => {
    it('toggles the community alert source off', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              alertSources: { official: true, community: true, urgent: true },
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByTestId } = render(<DelayNotificationScreen />);
      fireEvent(getByTestId('source-toggle-community'), 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        const callArgs = (mockUpdateUserProfile.mock.calls as unknown[][])[0]![0] as NotificationCallArgs;
        expect(callArgs.preferences.notificationSettings.alertSources).toEqual({
          official: true,
          community: false,
          urgent: true,
        });
      });
    });
  });

  describe('State Management', () => {
    it('maintains separate state for multiple toggling operations', async () => {
      const mockUpdateUserProfile = jest.fn(() => Promise.resolve());
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: {
          id: 'user-1',
          preferences: {
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 10,
              alertTypes: {
                delays: true,
                suspensions: false,
                congestion: false,
                alternativeRoutes: false,
                serviceUpdates: false,
              },
            },
          },
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateUserProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { UNSAFE_getAllByType, rerender } = render(<DelayNotificationScreen />);
      const switches = UNSAFE_getAllByType(Switch);

      // Toggle enabled
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
      });

      mockUpdateUserProfile.mockClear();

      // Re-render to simulate state update
      rerender(<DelayNotificationScreen />);

      // Toggle delays alert type
      const updatedSwitches = UNSAFE_getAllByType(Switch);
      fireEvent(updatedSwitches[1], 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
      });
    });
  });
});
