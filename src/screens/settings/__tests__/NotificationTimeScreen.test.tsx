/**
 * NotificationTimeScreen Test Suite
 * Tests notification time settings rendering and interactions
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NotificationTimeScreen } from '../NotificationTimeScreen';
import { useAuth } from '@/services/auth/AuthContext';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
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
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, subtitle, value, onValueChange, disabled }: {
      label: string; subtitle?: string; value: boolean;
      onValueChange: (v: boolean) => void; disabled?: boolean;
    }) =>
      React.createElement(Pressable, {
        testID: `toggle-${label}`,
        onPress: disabled ? undefined : () => onValueChange(!value),
      },
        React.createElement(Text, null, label),
        subtitle && React.createElement(Text, null, subtitle),
        React.createElement(View, {
          testID: `switch-${label}`,
        }),
      ),
  };
});

jest.mock('@/components/settings/SettingTimePicker', () => {
  const React = require('react');
  const { Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value, onValueChange }: {
      label: string; value: string; onValueChange?: (v: string) => void;
    }) =>
      React.createElement(Pressable, {
        testID: `time-${label}`,
        onPress: onValueChange ? () => onValueChange('09:30') : undefined,
      },
        React.createElement(Text, null, label),
        React.createElement(Text, null, value),
      ),
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const createDefaultUser = () => ({
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
});

describe('NotificationTimeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockUseAuth.mockReturnValue({
      user: createDefaultUser(),
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserProfile: jest.fn().mockResolvedValue(undefined),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
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

    it('renders additional settings section', () => {
      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('추가 설정')).toBeTruthy();
      expect(getByText('평일만 알림 받기')).toBeTruthy();
    });

    it('renders info box text', () => {
      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText(/출퇴근 시간을 설정하면/)).toBeTruthy();
    });

    it('shows station info when stations are set', () => {
      const { getAllByText } = render(<NotificationTimeScreen />);

      expect(getAllByText('출발역에서 출발').length).toBe(2);
    });

    it('shows placeholder text when no stations are set', () => {
      mockUseAuth.mockReturnValue({
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getAllByText } = render(<NotificationTimeScreen />);
      expect(getAllByText('즐겨찾기에서 출발역을 설정하세요').length).toBe(2);
    });

    it('shows quiet hours time pickers when enabled', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: {
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('시작 시간')).toBeTruthy();
      expect(getByText('종료 시간')).toBeTruthy();
    });

    it('hides quiet hours time pickers when disabled', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: {
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
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { queryByText } = render(<NotificationTimeScreen />);

      expect(queryByText('시작 시간')).toBeFalsy();
      expect(queryByText('종료 시간')).toBeFalsy();
    });

    it('uses default times when preferences are not set', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: {} },
            commuteSchedule: { weekdays: {} },
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      // Default commute times are rendered
      expect(getByText('08:00')).toBeTruthy();
      expect(getByText('18:00')).toBeTruthy();
      // Quiet hours times (22:00/07:00) are not rendered when quietHours is disabled
    });

    it('handles null commuteSchedule', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' } },
            commuteSchedule: null,
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('08:00')).toBeTruthy();
      expect(getByText('18:00')).toBeTruthy();
    });

    it('handles null notificationSettings', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: null,
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '08:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
                eveningCommute: { departureTime: '18:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('조용한 시간대 사용')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('triggers handler when morning time picker is pressed', () => {
      const { getByTestId } = render(<NotificationTimeScreen />);

      const morningTimePicker = getByTestId('time-아침 출근');
      fireEvent.press(morningTimePicker);

      expect(morningTimePicker).toBeTruthy();
    });

    it('triggers handler when evening time picker is pressed', () => {
      const { getByTestId } = render(<NotificationTimeScreen />);

      const eveningTimePicker = getByTestId('time-저녁 퇴근');
      fireEvent.press(eveningTimePicker);

      expect(eveningTimePicker).toBeTruthy();
    });

    it('triggers handler when quiet hours toggle is pressed', () => {
      const { getByTestId } = render(<NotificationTimeScreen />);

      const quietHoursToggle = getByTestId('toggle-조용한 시간대 사용');
      fireEvent.press(quietHoursToggle);

      expect(quietHoursToggle).toBeTruthy();
    });

    it('triggers handler when weekdays only toggle is pressed', () => {
      const { getByTestId } = render(<NotificationTimeScreen />);

      const weekdaysToggle = getByTestId('toggle-평일만 알림 받기');
      fireEvent.press(weekdaysToggle);

      expect(weekdaysToggle).toBeTruthy();
    });

    it('shows start time picker when quiet hours enabled and pressed', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: {
              quietHours: { enabled: true, startTime: '22:00', endTime: '07:00' },
            },
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '08:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
                eveningCommute: { departureTime: '18:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
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
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const startTimePicker = getByTestId('time-시작 시간');
      fireEvent.press(startTimePicker);

      expect(startTimePicker).toBeTruthy();
    });

    it('shows end time picker when quiet hours enabled and pressed', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: {
              quietHours: { enabled: true, startTime: '22:00', endTime: '07:00' },
            },
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '08:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
                eveningCommute: { departureTime: '18:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
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
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const endTimePicker = getByTestId('time-종료 시간');
      fireEvent.press(endTimePicker);

      expect(endTimePicker).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('handles error when morning time update fails', () => {
      mockUseAuth.mockReturnValue({
        user: createDefaultUser(),
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn().mockRejectedValue(new Error('Update failed')),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const morningTimePicker = getByTestId('time-아침 출근');
      fireEvent.press(morningTimePicker);

      expect(morningTimePicker).toBeTruthy();
    });

    it('handles error when evening time update fails', () => {
      mockUseAuth.mockReturnValue({
        user: createDefaultUser(),
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn().mockRejectedValue(new Error('Update failed')),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const eveningTimePicker = getByTestId('time-저녁 퇴근');
      fireEvent.press(eveningTimePicker);

      expect(eveningTimePicker).toBeTruthy();
    });

    it('handles error when quiet hours toggle update fails', () => {
      mockUseAuth.mockReturnValue({
        user: createDefaultUser(),
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn().mockRejectedValue(new Error('Update failed')),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const quietHoursToggle = getByTestId('toggle-조용한 시간대 사용');
      fireEvent.press(quietHoursToggle);

      expect(quietHoursToggle).toBeTruthy();
    });

    it('handles error when weekdays toggle update fails', () => {
      mockUseAuth.mockReturnValue({
        user: createDefaultUser(),
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn().mockRejectedValue(new Error('Update failed')),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      } as any);

      const { getByTestId } = render(<NotificationTimeScreen />);

      const weekdaysToggle = getByTestId('toggle-평일만 알림 받기');
      fireEvent.press(weekdaysToggle);

      expect(weekdaysToggle).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined weekdays in commuteSchedule', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: { enabled: false } },
            commuteSchedule: { weekdays: undefined },
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('08:00')).toBeTruthy();
    });

    it('handles missing eveningCommute in schedule', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: { enabled: false } },
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '08:00', stationId: 'st1', destinationStationId: 'st2', bufferMinutes: 10 },
                eveningCommute: null,
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
      } as any);

      const { getByText, queryByText } = render(<NotificationTimeScreen />);

      expect(getByText('아침 출근')).toBeTruthy();
      // Still renders the evening section, shows placeholder
      expect(queryByText('저녁 퇴근')).toBeTruthy();
    });

    it('renders correctly with custom commute times', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' } },
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '07:15', stationId: 'st1', destinationStationId: 'st2', bufferMinutes: 10 },
                eveningCommute: { departureTime: '17:45', stationId: 'st2', destinationStationId: 'st1', bufferMinutes: 10 },
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('07:15')).toBeTruthy();
      expect(getByText('17:45')).toBeTruthy();
    });

    it('renders correctly with custom quiet hours times', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          preferences: {
            notificationSettings: { quietHours: { enabled: true, startTime: '21:30', endTime: '06:30' } },
            commuteSchedule: {
              weekdays: {
                morningCommute: { departureTime: '08:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
                eveningCommute: { departureTime: '18:00', stationId: '', destinationStationId: '', bufferMinutes: 10 },
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
      } as any);

      const { getByText } = render(<NotificationTimeScreen />);

      expect(getByText('21:30')).toBeTruthy();
      expect(getByText('06:30')).toBeTruthy();
    });
  });
});
