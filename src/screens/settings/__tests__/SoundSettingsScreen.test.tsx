/**
 * SoundSettingsScreen Test Suite
 * Tests the Wanted "소리 설정" redesign: alert-mode grid, vibration row,
 * volume, inline sound radio list, per-event gates, email channel, footer,
 * and the sound/vibration gating (honesty: no push toggle, no test buttons).
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SoundSettingsScreen } from '../SoundSettingsScreen';

// Import actual React Testing Library utilities after mocks
import { fireEvent, waitFor } from '@testing-library/react-native';

// Proxy stubs every lucide icon name → its own string component. ALERT_MODES
// uses dynamic mode.Icon (BellRing / Volume2 / Smartphone / BellOff) so an
// explicit-only mock would render undefined.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target: object, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (typeof prop !== 'string') return undefined;
        return prop;
      },
    },
  ),
);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
}));

// Real 4-id shape so the legacy-soundId fallback ('default' → 'chime') is
// exercised correctly. Intentionally NO 'default' id here.
jest.mock('@/services/sound/soundService', () => ({
  soundService: {
    initialize: jest.fn(),
    cleanup: jest.fn(() => Promise.resolve()),
    previewSound: jest.fn(),
    previewVibration: jest.fn(),
  },
  NOTIFICATION_SOUNDS: [
    { id: 'chime', label: '차임', description: '부드러운 종소리' },
    { id: 'doorbell', label: '도어벨', description: '지하철 안내음' },
    { id: 'beep', label: '비프', description: '짧고 명료' },
    { id: 'wave', label: '웨이브', description: '잔잔한 파도' },
  ],
  VIBRATION_PATTERNS: [
    { id: 'default', label: '기본', description: '표준 진동', pattern: [0, 250] },
    { id: 'short', label: '짧게', description: '간단한 진동', pattern: [0, 100] },
  ],
}));

jest.mock('@/components/settings/SettingSection', () => {
  const ReactLocal = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, trailing, children }: { title?: string; trailing?: React.ReactNode; children: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: `section-${title}` },
        title && ReactLocal.createElement(Text, null, title),
        trailing,
        children,
      ),
  };
});

jest.mock('@/components/settings/SettingToggle', () => {
  const ReactLocal = require('react');
  const { View, Text, Switch } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, subtitle, value, onValueChange, disabled }: {
      label: string; subtitle?: string; value: boolean;
      onValueChange: (v: boolean) => void; disabled?: boolean;
    }) =>
      ReactLocal.createElement(View, { testID: `toggle-${label}` },
        ReactLocal.createElement(Text, null, label),
        subtitle && ReactLocal.createElement(Text, null, subtitle),
        ReactLocal.createElement(Switch, {
          testID: `switch-${label}`,
          value,
          onValueChange,
          disabled,
        }),
      ),
  };
});

// Exposes a pressable control so handleVolumeChange is exercised.
jest.mock('@/components/settings/VolumeSlider', () => {
  const ReactLocal = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onValueChange, disabled }: {
      value: number; onValueChange: (v: number) => void; disabled?: boolean;
    }) =>
      ReactLocal.createElement(View, { testID: 'volume-slider', accessibilityState: { disabled: !!disabled } },
        ReactLocal.createElement(Text, null, `${value}`),
        ReactLocal.createElement(TouchableOpacity, {
          testID: 'volume-set-40',
          disabled,
          onPress: () => onValueChange(40),
        }),
      ),
  };
});

// Renders one pressable row per sound option (label + onValueChange) so both
// the option labels (차임/도어벨/비프/웨이브) and selection writes are testable.
jest.mock('@/components/settings/SoundRadioList', () => {
  const ReactLocal = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ options, value, onValueChange, disabled }: {
      options: readonly { id: string; label: string }[];
      value: string; onValueChange: (id: string) => void; disabled?: boolean;
    }) =>
      ReactLocal.createElement(View, { testID: 'sound-radio-list', accessibilityState: { disabled: !!disabled } },
        ReactLocal.createElement(Text, { testID: 'sound-radio-value' }, value),
        ...options.map((option) =>
          ReactLocal.createElement(TouchableOpacity, {
            key: option.id,
            testID: `sound-option-${option.id}`,
            disabled,
            onPress: () => onValueChange(option.id),
          },
            ReactLocal.createElement(Text, { testID: `sound-option-label-${option.id}` }, option.label),
          ),
        ),
      ),
  };
});

// Exposes the selected option label (value), subtitle, and a pressable to fire onValueChange.
jest.mock('@/components/settings/VibrationPicker', () => {
  const ReactLocal = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, subtitle, options, value, onValueChange, disabled }: {
      label: string; subtitle?: string;
      options: readonly { id: string; label: string }[];
      value: string; onValueChange: (id: string) => void; disabled?: boolean;
    }) => {
      const selected = options.find((o) => o.id === value);
      return ReactLocal.createElement(View, { testID: 'vibration-picker', accessibilityState: { disabled: !!disabled } },
        ReactLocal.createElement(Text, { testID: 'vibration-label' }, label),
        subtitle && ReactLocal.createElement(Text, { testID: 'vibration-subtitle' }, subtitle),
        ReactLocal.createElement(Text, { testID: 'vibration-value' }, selected ? selected.label : ''),
        ReactLocal.createElement(TouchableOpacity, {
          testID: 'vibration-set-short',
          disabled,
          onPress: () => onValueChange('short'),
        }),
      );
    },
  };
});

const baseUser = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
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
        soundId: 'chime',
        volume: 70,
        vibrationEnabled: true,
        vibrationPattern: 'default',
      },
      perEventSound: {
        trainArrival: true,
        delayDetected: true,
        communityReport: false,
      },
      ...((overrides.notificationSettings as object) ?? {}),
    },
  },
  ...overrides,
});

describe('SoundSettingsScreen', () => {
  let mockUpdateUserPreferences: jest.Mock;
  let mockUseAuth: jest.Mock;

  const setUser = (user: unknown): void => {
    mockUseAuth.mockReturnValue({ user, updateUserPreferences: mockUpdateUserPreferences });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUpdateUserPreferences = jest.fn(() => Promise.resolve());
    mockUseAuth = require('@/services/auth/AuthContext').useAuth as jest.Mock;

    setUser(baseUser());
  });

  describe('Rendering — section structure', () => {
    it('renders all six titled sections in the redesign order', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      // Section containers aggregate title + trailing + children text, so a
      // regex (substring) assertion confirms each title is present.
      expect(getByTestId('section-알림 방식')).toHaveTextContent(/알림 방식/);
      expect(getByTestId('section-진동')).toHaveTextContent(/진동/);
      expect(getByTestId('section-알림 볼륨')).toHaveTextContent(/알림 볼륨/);
      expect(getByTestId('section-알림음')).toHaveTextContent(/알림음/);
      expect(getByTestId('section-이벤트별')).toHaveTextContent(/이벤트별/);
      expect(getByTestId('section-알림 채널')).toHaveTextContent(/알림 채널/);
    });

    it('renders the four alert-mode cards with their labels', () => {
      // Card labels are queried via accessibilityLabel because '무음' is also
      // a subtitle on the 진동만 card (duplicate-text collision otherwise).
      const { getByLabelText } = render(<SoundSettingsScreen />);

      expect(getByLabelText('소리 + 진동')).toHaveTextContent('소리 + 진동모든 채널');
      expect(getByLabelText('소리만')).toHaveTextContent('소리만진동 없음');
      expect(getByLabelText('진동만')).toHaveTextContent('진동만무음');
      expect(getByLabelText('무음')).toHaveTextContent('무음배지만');
    });

    it('renders the vibration picker row with its label and subtitle', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('vibration-label')).toHaveTextContent('진동 패턴');
      expect(getByTestId('vibration-subtitle')).toHaveTextContent('알림이 울릴 때의 진동 세기');
    });

    it('renders the vibration picker with the current pattern value (기본)', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('vibration-value')).toHaveTextContent('기본');
    });

    it('renders the volume slider with the current volume value', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('volume-slider')).toHaveTextContent('70');
    });

    it('renders the volume percentage in the section header trailing slot', () => {
      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('70%')).toHaveTextContent('70%');
    });

    it('renders the inline sound radio list with all four sound options', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('sound-option-label-chime')).toHaveTextContent('차임');
      expect(getByTestId('sound-option-label-doorbell')).toHaveTextContent('도어벨');
      expect(getByTestId('sound-option-label-beep')).toHaveTextContent('비프');
      expect(getByTestId('sound-option-label-wave')).toHaveTextContent('웨이브');
    });

    it('renders the three per-event toggles with their labels', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('toggle-열차 도착')).toHaveTextContent('열차 도착3분 전 알림');
      expect(getByTestId('toggle-지연 발생')).toHaveTextContent('지연 발생실시간 지연');
      expect(getByTestId('toggle-실시간 제보')).toHaveTextContent('실시간 제보검증된 제보 도착 시');
    });

    it('renders the email channel toggle with its label', () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      expect(getByTestId('toggle-이메일 알림')).toHaveTextContent('이메일 알림중요 업데이트 이메일로 수신');
    });

    it('renders the footer copy', () => {
      const { getByText } = render(<SoundSettingsScreen />);

      expect(getByText('개별 이벤트마다 소리를 끄거나 켤 수 있어요.')).toHaveTextContent('개별 이벤트마다 소리를 끄거나 켤 수 있어요.');
    });
  });

  describe('Honesty — removed UI must NOT exist', () => {
    it('does not render a push notifications toggle', () => {
      const { queryByTestId } = render(<SoundSettingsScreen />);
      expect(queryByTestId('toggle-푸시 알림')).toBeNull();
    });

    it('does not render any test buttons', () => {
      const { queryByText } = render(<SoundSettingsScreen />);
      expect(queryByText('테스트 알림 보내기')).toBeNull();
      expect(queryByText('테스트 이메일 보내기')).toBeNull();
    });

    it('does not render the push-notification info box', () => {
      const { queryByText } = render(<SoundSettingsScreen />);
      expect(queryByText(/푸시 알림이 켜져 있어야/)).toBeNull();
    });
  });

  describe('Legacy soundId fallback', () => {
    it('falls back to chime when the stored soundId is not a known sound', () => {
      setUser(baseUser({
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: true,
            soundId: 'default',
            volume: 70,
            vibrationEnabled: true,
            vibrationPattern: 'default',
          },
        },
      }));

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('sound-radio-value')).toHaveTextContent('chime');
    });

    it('keeps a valid stored soundId unchanged', () => {
      setUser(baseUser({
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: true,
            soundId: 'beep',
            volume: 70,
            vibrationEnabled: true,
            vibrationPattern: 'default',
          },
        },
      }));

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('sound-radio-value')).toHaveTextContent('beep');
    });
  });

  describe('Sound selection', () => {
    it('selecting a sound writes the new soundId (doorbell ≠ current chime)', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('sound-option-doorbell'));

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              soundSettings: expect.objectContaining({ soundId: 'doorbell' }),
            }),
          }),
        );
      });
    });

    it('shows an error alert when the sound write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('sound-option-wave'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Volume change', () => {
    it('changing the volume writes the new volume value', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('volume-set-40'));

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              soundSettings: expect.objectContaining({ volume: 40 }),
            }),
          }),
        );
      });
    });

    it('shows an error alert when the volume write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('volume-set-40'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Vibration pattern change', () => {
    it('changing the vibration pattern writes the new pattern id', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('vibration-set-short'));

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              soundSettings: expect.objectContaining({ vibrationPattern: 'short' }),
            }),
          }),
        );
      });
    });

    it('shows an error alert when the vibration pattern write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent.press(getByTestId('vibration-set-short'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Gating — sound off / vibration off', () => {
    it('disables volume + sound list when sound is off (진동만 mode)', () => {
      setUser(baseUser({
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: false,
            soundId: 'chime',
            volume: 70,
            vibrationEnabled: true,
            vibrationPattern: 'default',
          },
        },
      }));

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('volume-slider').props.accessibilityState.disabled).toBe(true);
      expect(getByTestId('sound-radio-list').props.accessibilityState.disabled).toBe(true);
      // Vibration stays enabled.
      expect(getByTestId('vibration-picker').props.accessibilityState.disabled).toBe(false);
    });

    it('disables the vibration row when vibration is off (소리만 mode)', () => {
      setUser(baseUser({
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: true,
            soundId: 'chime',
            volume: 70,
            vibrationEnabled: false,
            vibrationPattern: 'default',
          },
        },
      }));

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('vibration-picker').props.accessibilityState.disabled).toBe(true);
      // Sound side stays enabled.
      expect(getByTestId('volume-slider').props.accessibilityState.disabled).toBe(false);
      expect(getByTestId('sound-radio-list').props.accessibilityState.disabled).toBe(false);
    });

    it('disables both sides in 무음 mode', () => {
      setUser(baseUser({
        notificationSettings: {
          pushNotifications: true,
          emailNotifications: false,
          soundSettings: {
            soundEnabled: false,
            soundId: 'chime',
            volume: 70,
            vibrationEnabled: false,
            vibrationPattern: 'default',
          },
        },
      }));

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('volume-slider').props.accessibilityState.disabled).toBe(true);
      expect(getByTestId('sound-radio-list').props.accessibilityState.disabled).toBe(true);
      expect(getByTestId('vibration-picker').props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('Alert mode grid interactions', () => {
    it('selects 소리만 mode → writes soundEnabled true / vibrationEnabled false', async () => {
      const { getByLabelText } = render(<SoundSettingsScreen />);

      fireEvent.press(getByLabelText('소리만'));

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              soundSettings: expect.objectContaining({
                soundEnabled: true,
                vibrationEnabled: false,
              }),
            }),
          }),
        );
      });
    });

    it('selects 무음 mode → writes both false', async () => {
      const { getByLabelText } = render(<SoundSettingsScreen />);

      fireEvent.press(getByLabelText('무음'));

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              soundSettings: expect.objectContaining({
                soundEnabled: false,
                vibrationEnabled: false,
              }),
            }),
          }),
        );
      });
    });

    it('shows an error alert when the alert-mode write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByLabelText } = render(<SoundSettingsScreen />);

      fireEvent.press(getByLabelText('진동만'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Per-event toggle interactions', () => {
    it('toggles 열차 도착 off → writes perEventSound.trainArrival false', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent(getByTestId('switch-열차 도착'), 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              perEventSound: expect.objectContaining({ trainArrival: false }),
            }),
          }),
        );
      });
    });

    it('shows an error alert when a per-event write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent(getByTestId('switch-지연 발생'), 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Email channel', () => {
    it('toggles email notifications for a signed-in user with email', async () => {
      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent(getByTestId('switch-이메일 알림'), 'valueChange', true);

      await waitFor(() => {
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({ emailNotifications: true }),
          }),
        );
      });
    });

    it('disables the email toggle and shows login subtitle for anonymous users', () => {
      setUser(baseUser({ email: null, isAnonymous: true }));

      const { getByTestId, getByText } = render(<SoundSettingsScreen />);

      expect(getByText('이메일 로그인 필요')).toHaveTextContent('이메일 로그인 필요');
      expect(getByTestId('switch-이메일 알림').props.disabled).toBe(true);
    });

    it('disables the email toggle when a signed-in user has no email', () => {
      setUser(baseUser({ email: null }));

      const { getByTestId, getByText } = render(<SoundSettingsScreen />);

      expect(getByText('이메일 로그인 필요')).toHaveTextContent('이메일 로그인 필요');
      expect(getByTestId('switch-이메일 알림').props.disabled).toBe(true);
    });

    it('shows an error alert when the email write fails', async () => {
      mockUpdateUserPreferences.mockRejectedValueOnce(new Error('Update failed'));

      const { getByTestId } = render(<SoundSettingsScreen />);

      fireEvent(getByTestId('switch-이메일 알림'), 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '설정 저장에 실패했습니다.');
      });
    });
  });

  describe('Service lifecycle', () => {
    it('initializes and cleans up the sound service', () => {
      const { soundService } = require('@/services/sound/soundService');
      const { unmount } = render(<SoundSettingsScreen />);

      expect(soundService.initialize).toHaveBeenCalled();

      unmount();
      expect(soundService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('renders with default settings when the user is null', () => {
      setUser(null);

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('section-알림 방식')).toHaveTextContent(/알림 방식/);
    });

    it('renders with default settings when notification settings are missing', () => {
      setUser({
        uid: 'test-uid',
        email: 'test@example.com',
        isAnonymous: false,
        preferences: { notificationSettings: undefined },
      });

      const { getByTestId } = render(<SoundSettingsScreen />);
      expect(getByTestId('section-알림음')).toHaveTextContent(/알림음/);
      // Defaults flow through: default soundId 'chime' renders in the radio list.
      expect(getByTestId('sound-radio-value')).toHaveTextContent('chime');
    });

    it('renders with default settings when sound settings are missing', () => {
      setUser({
        uid: 'test-uid',
        email: 'test@example.com',
        isAnonymous: false,
        preferences: {
          notificationSettings: {
            pushNotifications: true,
            emailNotifications: false,
            soundSettings: undefined,
            perEventSound: undefined,
          },
        },
      });

      const { getByTestId } = render(<SoundSettingsScreen />);
      // DEFAULT_SOUND_SETTINGS: soundId 'chime', volume 80.
      expect(getByTestId('sound-radio-value')).toHaveTextContent('chime');
      expect(getByTestId('volume-slider')).toHaveTextContent('80');
    });

    it('does not write when the user is null', async () => {
      setUser(null);

      const { getByLabelText } = render(<SoundSettingsScreen />);
      fireEvent.press(getByLabelText('무음'));

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    });
  });
});
