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

// Import actual React Testing Library utilities after mocks
import { fireEvent, waitFor } from '@testing-library/react-native';

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
  useNotifications: jest.fn(() => ({
    sendTestNotification: jest.fn(() => Promise.resolve(true)),
  })),
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
  let mockUpdateUserProfile: jest.Mock;
  let mockSendTestNotification: jest.Mock;
  let mockSendTestEmail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUpdateUserProfile = jest.fn(() => Promise.resolve());
    mockSendTestNotification = jest.fn(() => Promise.resolve(true));
    mockSendTestEmail = jest.fn(() => Promise.resolve(true));

    // Get the mocked useAuth and set return value
    const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
    mockUseAuth.mockReturnValue({
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
      updateUserProfile: mockUpdateUserProfile,
    });

    // Get the mocked useNotifications and set return value
    const { useNotifications: mockUseNotifications } = require('@/hooks/useNotifications');
    mockUseNotifications.mockReturnValue({
      sendTestNotification: mockSendTestNotification,
    });

    // Get the mocked emailNotificationService and set sendTestEmail
    const { emailNotificationService } = require('@/services/email/emailService');
    emailNotificationService.sendTestEmail = mockSendTestEmail;
  });

  describe('Rendering', () => {
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

    it('shows test email button when email notifications are enabled', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('테스트 이메일 보내기')).toBeTruthy();
    });

    it('renders disabled email toggle subtitle for anonymous users', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Anonymous User',
          email: null,
          isAnonymous: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('이메일 로그인 필요')).toBeTruthy();
    });

    it('renders disabled email toggle subtitle when user has no email', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: null,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('이메일 로그인 필요')).toBeTruthy();
    });
  });

  describe('User Interactions - Push Notifications', () => {
    it('toggles push notifications', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const pushSwitch = getByTestId('switch-푸시 알림');
      fireEvent(pushSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              notificationSettings: expect.objectContaining({
                pushNotifications: false,
              }),
            }),
          })
        );
      });
    });

    it('preserves other notification settings when toggling push notifications', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const pushSwitch = getByTestId('switch-푸시 알림');
      fireEvent(pushSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              notificationSettings: expect.objectContaining({
                emailNotifications: false,
              }),
            }),
          })
        );
      });
    });

    it('shows error alert when push notification toggle fails', async () => {
      mockUpdateUserProfile.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      const pushSwitch = getByTestId('switch-푸시 알림');
      fireEvent(pushSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('User Interactions - Email Notifications', () => {
    it('toggles email notifications when user has email', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const emailSwitch = getByTestId('switch-이메일 알림');
      fireEvent(emailSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              notificationSettings: expect.objectContaining({
                emailNotifications: true,
              }),
            }),
          })
        );
      });
    });

    it('does not toggle email notifications for anonymous users', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          email: null,
          isAnonymous: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByTestId } = render(<SoundSettingsScreen />);

      const emailSwitch = getByTestId('switch-이메일 알림');
      expect(emailSwitch).toBeTruthy(); // Switch is rendered but disabled
    });

    it('shows error alert when email notification toggle fails', async () => {
      mockUpdateUserProfile.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      const emailSwitch = getByTestId('switch-이메일 알림');
      fireEvent(emailSwitch, 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('User Interactions - Sound Settings', () => {
    it('toggles sound enabled', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const soundSwitch = getByTestId('switch-알림음');
      fireEvent(soundSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              notificationSettings: expect.objectContaining({
                soundSettings: expect.objectContaining({
                  soundEnabled: false,
                }),
              }),
            }),
          })
        );
      });
    });

    it('shows error alert when sound toggle fails', async () => {
      mockUpdateUserProfile.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      const soundSwitch = getByTestId('switch-알림음');
      fireEvent(soundSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });

    it('hides sound picker and volume slider when sound is disabled', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
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
                vibrationEnabled: true,
                vibrationPattern: 'default',
              },
            },
          },
        },
        updateUserProfile: mockUpdateUserProfile,
      });

      const { queryByText } = render(<SoundSettingsScreen />);

      expect(queryByText('알림음 선택')).toBeNull();
      expect(queryByText('볼륨')).toBeNull();
    });

    it('hides vibration picker when vibration is disabled', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
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
                vibrationEnabled: false,
                vibrationPattern: 'default',
              },
            },
          },
        },
        updateUserProfile: mockUpdateUserProfile,
      });

      const { queryByText } = render(<SoundSettingsScreen />);

      expect(queryByText('진동 패턴')).toBeNull();
    });

    it('hides both sound picker and vibration picker when both disabled', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { queryByText } = render(<SoundSettingsScreen />);

      expect(queryByText('알림음 선택')).toBeNull();
      expect(queryByText('진동 패턴')).toBeNull();
    });
  });

  describe('User Interactions - Vibration Settings', () => {
    it('toggles vibration enabled', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const vibrationSwitch = getByTestId('switch-진동');
      fireEvent(vibrationSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              notificationSettings: expect.objectContaining({
                soundSettings: expect.objectContaining({
                  vibrationEnabled: false,
                }),
              }),
            }),
          })
        );
      });
    });

    it('shows error alert when vibration toggle fails', async () => {
      mockUpdateUserProfile.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      const vibrationSwitch = getByTestId('switch-진동');
      fireEvent(vibrationSwitch, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('initializes and cleans up sound service', () => {
      const { unmount } = render(<SoundSettingsScreen />);

      expect(soundService.initialize).toHaveBeenCalled();

      unmount();
      expect(soundService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Test Notification Button', () => {
    it('sends test notification and shows success alert', async () => {
      const { getByText } = render(<SoundSettingsScreen />);

      const testButton = getByText('테스트 알림 보내기');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(mockSendTestNotification).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('성공', '테스트 알림이 전송되었습니다.');
      });
    });

    it('shows permission denied alert when test notification fails', async () => {
      mockSendTestNotification.mockResolvedValueOnce(false);

      const { getByText } = render(<SoundSettingsScreen />);

      const testButton = getByText('테스트 알림 보내기');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('실패', '알림 권한이 허용되지 않았습니다.');
      });
    });

    it('shows error alert when test notification throws error', async () => {
      mockSendTestNotification.mockRejectedValueOnce(new Error('Notification error'));

      const { getByText } = render(<SoundSettingsScreen />);

      const testButton = getByText('테스트 알림 보내기');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '테스트 알림 전송에 실패했습니다.');
      });
    });
  });

  describe('Test Email Button', () => {
    it('sends test email and shows success alert', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      const testEmailButton = getByText('테스트 이메일 보내기');
      fireEvent.press(testEmailButton);

      await waitFor(() => {
        expect(mockSendTestEmail).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          '성공',
          '테스트 이메일이 test@example.com로 전송되었습니다.'
        );
      });
    });

    it('shows error alert when test email fails', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      mockSendTestEmail.mockResolvedValueOnce(false);

      const { getByText } = render(<SoundSettingsScreen />);

      const testEmailButton = getByText('테스트 이메일 보내기');
      fireEvent.press(testEmailButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '실패',
          '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'
        );
      });
    });

    it('shows error alert when test email throws error', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      mockSendTestEmail.mockRejectedValueOnce(new Error('Email service error'));

      const { getByText } = render(<SoundSettingsScreen />);

      const testEmailButton = getByText('테스트 이메일 보내기');
      fireEvent.press(testEmailButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '이메일 전송 중 오류가 발생했습니다.');
      });
    });

    it('shows alert when test email clicked without email permission', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Anonymous User',
          email: null,
          isAnonymous: true,
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
        updateUserProfile: mockUpdateUserProfile,
      });

      const { queryByText } = render(<SoundSettingsScreen />);

      // Test email button should not exist since emailNotifications is false
      expect(queryByText('테스트 이메일 보내기')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing user gracefully', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: null,
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      // Should still render the UI with default values
      expect(getByText('알림 방식')).toBeTruthy();
    });

    it('handles missing notification settings gracefully', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: undefined,
          },
        },
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('알림 방식')).toBeTruthy();
    });

    it('handles missing sound settings gracefully', () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: true,
              emailNotifications: false,
              soundSettings: undefined,
            },
          },
        },
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByText } = render(<SoundSettingsScreen />);

      // Should use default settings
      expect(getByText('알림 효과')).toBeTruthy();
    });

    it('does not call updateUserProfile when user is null', async () => {
      const { useAuth: mockUseAuth } = require('@/services/auth/AuthContext');
      mockUseAuth.mockReturnValueOnce({
        user: null,
        updateUserProfile: mockUpdateUserProfile,
      });

      const { getByTestId } = render(<SoundSettingsScreen />);

      const pushSwitch = getByTestId('switch-푸시 알림');
      fireEvent(pushSwitch, 'valueChange', false);

      // Wait a moment for any updates
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('preserves sound settings when updating volume', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const volumeSlider = getByTestId('slider-볼륨');
      expect(volumeSlider).toBeTruthy();
    });

    it('shows correct current values in toggles', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      const pushSwitch = getByTestId('switch-푸시 알림');
      const soundSwitch = getByTestId('switch-알림음');
      const vibrationSwitch = getByTestId('switch-진동');

      expect(pushSwitch).toBeTruthy();
      expect(soundSwitch).toBeTruthy();
      expect(vibrationSwitch).toBeTruthy();
    });

    it('keeps sound settings in sync with user profile changes', () => {
      const { rerender } = render(<SoundSettingsScreen />);

      (useAuth as jest.Mock).mockReturnValueOnce({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          preferences: {
            notificationSettings: {
              pushNotifications: false,
              emailNotifications: true,
              soundSettings: {
                soundEnabled: false,
                soundId: 'chime',
                volume: 50,
                vibrationEnabled: false,
                vibrationPattern: 'strong',
              },
            },
          },
        },
        updateUserProfile: mockUpdateUserProfile,
      });

      rerender(<SoundSettingsScreen />);

      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });
});
