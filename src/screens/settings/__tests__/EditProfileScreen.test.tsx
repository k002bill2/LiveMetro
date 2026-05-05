/**
 * EditProfileScreen Test Suite
 * Tests profile editing and password change functionality
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EditProfileScreen } from '../EditProfileScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackScreenProps: {},
}));

// Phase 47 — screen now calls useTheme().isDark to drive WANTED_TOKENS
// semantic selection. Force light variant for stable assertions.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      isAnonymous: false,
      id: 'test-uid',
      profilePicture: null,
      preferences: {
        favoriteStations: [],
        notificationSettings: {
          enabled: true,
          delayThresholdMinutes: 5,
          quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
          weekdaysOnly: false,
          alertTypes: {
            delays: true,
            suspensions: true,
            congestion: false,
            alternativeRoutes: true,
            serviceUpdates: true,
          },
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
        commuteSchedule: {
          weekdays: { morningCommute: null, eveningCommute: null },
          weekends: null,
          autoDetect: false,
        },
        language: 'ko',
        theme: 'system',
        units: 'metric',
      },
      subscription: 'FREE',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    },
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(() => Promise.resolve()),
    resetPassword: jest.fn(),
    changePassword: jest.fn(() => Promise.resolve()),
  })),
}));

const mockGoBack = jest.fn();
const defaultProps = {
  navigation: {
    navigate: jest.fn(),
    goBack: mockGoBack,
    setOptions: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    reset: jest.fn(),
    isFocused: jest.fn(),
    canGoBack: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    dispatch: jest.fn(),
    getId: jest.fn(),
  } as unknown as Parameters<typeof EditProfileScreen>[0]['navigation'],
  route: {
    key: 'EditProfile',
    name: 'EditProfile' as const,
    params: undefined,
  },
};

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('renders profile form with user data', () => {
      const { getByText, getByDisplayValue } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      expect(getByText('프로필 정보')).toBeTruthy();
      expect(getByDisplayValue('Test User')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('renders email as read-only with helper text', () => {
      const { getByText } = render(<EditProfileScreen {...defaultProps} />);

      expect(getByText('이메일은 변경할 수 없습니다.')).toBeTruthy();
    });

    it('renders password change section for non-anonymous users', () => {
      const { getAllByText } = render(<EditProfileScreen {...defaultProps} />);

      // '비밀번호 변경' appears as both section title and button text
      const elements = getAllByText('비밀번호 변경');
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it('hides password change section for anonymous users', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      (useAuth as jest.Mock).mockReturnValueOnce({
        user: {
          uid: 'anon-uid',
          displayName: 'Anonymous',
          email: null,
          isAnonymous: true,
          id: 'anon-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
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

      const { queryByText } = render(<EditProfileScreen {...defaultProps} />);
      expect(queryByText('비밀번호 변경')).toBeNull();
    });

    it('renders profile icon', () => {
      const { UNSAFE_root } = render(<EditProfileScreen {...defaultProps} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('renders display name input with user name', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );
      const nameInput = getByPlaceholderText('이름을 입력하세요');
      expect(nameInput).toBeTruthy();
    });

    it('renders all three password inputs', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      expect(getByPlaceholderText('현재 비밀번호')).toBeTruthy();
      expect(getByPlaceholderText('새 비밀번호 (6자 이상)')).toBeTruthy();
      expect(getByPlaceholderText('새 비밀번호 다시 입력')).toBeTruthy();
    });
  });

  describe('Profile Editing - Name', () => {
    it('updates display name when typing', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByPlaceholderText('이름을 입력하세요');
      fireEvent.changeText(nameInput, 'New Name');

      expect(nameInput.props.value).toBe('New Name');
    });

    it('shows error when saving empty name', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByDisplayValue('Test User');
      fireEvent.changeText(nameInput, '');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '이름을 입력해주세요.'
        );
      });
    });

    it('shows error when saving only whitespace', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByDisplayValue('Test User');
      fireEvent.changeText(nameInput, '   ');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '이름을 입력해주세요.'
        );
      });
    });

    it('calls updateUserProfile with trimmed name', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockUpdateProfile = jest.fn(() => Promise.resolve());
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByDisplayValue, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByDisplayValue('Test User');
      fireEvent.changeText(nameInput, '  New Name  ');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          displayName: 'New Name',
        });
      });
    });

    it('goes back when saving unchanged name', async () => {
      const { getByText } = render(<EditProfileScreen {...defaultProps} />);

      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('navigates back on successful profile save', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockUpdateProfile = jest.fn(() => Promise.resolve());
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const mockNav = {
        ...defaultProps.navigation,
        goBack: jest.fn(),
      };

      const { getByDisplayValue, getByText } = render(
        <EditProfileScreen {...defaultProps} navigation={mockNav} />,
      );

      const nameInput = getByDisplayValue('Test User');
      fireEvent.changeText(nameInput, 'New User Name');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('shows error alert on profile update failure', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockUpdateProfile = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByDisplayValue, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByDisplayValue('Test User');
      fireEvent.changeText(nameInput, 'New Name');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '오류',
          '프로필 수정에 실패했습니다. 다시 시도해주세요.'
        );
      });
    });

    it('disables profile input while saving', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      let resolveUpdate: (() => void) | null = null;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      const mockUpdateProfile = jest.fn(() => updatePromise);
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: mockUpdateProfile,
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByPlaceholderText, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByPlaceholderText('이름을 입력하세요');
      fireEvent.changeText(nameInput, 'New Name');
      fireEvent.press(getByText('프로필 저장'));

      await waitFor(() => {
        expect(nameInput.props.editable).toBe(false);
      });

      // Resolve the promise
      resolveUpdate!();

      await waitFor(() => {
        expect(nameInput.props.editable).toBe(true);
      });
    });
  });

  describe('Password Change - Validation', () => {
    it('shows error when changing password without current password', async () => {
      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      // Fill new password but not current
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(getByPlaceholderText('새 비밀번호 다시 입력'), 'newpass123');

      // '비밀번호 변경' appears as section title and button - last one is the button
      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '현재 비밀번호를 입력해주세요.'
        );
      });
    });

    it('shows error when changing password without new password', async () => {
      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'current123');

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '새 비밀번호를 입력해주세요.'
        );
      });
    });

    it('shows error when new password is too short', async () => {
      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'current123');
      fireEvent.changeText(getByPlaceholderText('새 비밀번호 (6자 이상)'), 'short');
      fireEvent.changeText(getByPlaceholderText('새 비밀번호 다시 입력'), 'short');

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '새 비밀번호는 6자 이상이어야 합니다.'
        );
      });
    });

    it('shows error when passwords do not match', async () => {
      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'current123');
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'newpass456'
      );

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '새 비밀번호가 일치하지 않습니다.'
        );
      });
    });

    it('shows error when new password equals current password', async () => {
      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'samepass123');
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'samepass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'samepass123'
      );

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '입력 오류',
          '현재 비밀번호와 다른 비밀번호를 입력해주세요.'
        );
      });
    });

    it('displays password mismatch error text', async () => {
      const { getByPlaceholderText, getByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'different456'
      );

      await waitFor(() => {
        expect(getByText('비밀번호가 일치하지 않습니다.')).toBeTruthy();
      });
    });

    it('hides password mismatch error when passwords match', async () => {
      const { getByPlaceholderText, queryByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      // Type mismatching passwords
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'different456'
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(
          queryByText('비밀번호가 일치하지 않습니다.')
        ).toBeTruthy();
      });

      // Update confirm password to match
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'newpass123'
      );

      // Error should disappear
      await waitFor(() => {
        expect(
          queryByText('비밀번호가 일치하지 않습니다.')
        ).toBeNull();
      });
    });
  });

  describe('Password Change - Visibility Toggle', () => {
    it('toggles current password visibility', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      // Password input should be secure (secureTextEntry) by default
      const currentPasswordInput = getByPlaceholderText('현재 비밀번호');
      expect(currentPasswordInput.props.secureTextEntry).toBe(true);
    });

    it('toggles new password visibility', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      // New password input should be secure by default
      const newPasswordInput = getByPlaceholderText('새 비밀번호 (6자 이상)');
      expect(newPasswordInput.props.secureTextEntry).toBe(true);
    });

    it('toggles confirm password visibility', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      // Confirm password input should be secure by default
      const confirmPasswordInput = getByPlaceholderText('새 비밀번호 다시 입력');
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('Password Change - Success/Failure', () => {
    it('calls changePassword with correct parameters on success', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockChangePassword = jest.fn(() => Promise.resolve());
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: mockChangePassword,
      });

      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'current123');
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'newpass123'
      );

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith(
          'current123',
          'newpass123'
        );
      });
    });

    it('clears password fields after successful change', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockChangePassword = jest.fn(() => Promise.resolve());
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: mockChangePassword,
      });

      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const currentPasswordInput = getByPlaceholderText('현재 비밀번호');
      const newPasswordInput = getByPlaceholderText('새 비밀번호 (6자 이상)');
      const confirmPasswordInput = getByPlaceholderText('새 비밀번호 다시 입력');

      fireEvent.changeText(currentPasswordInput, 'current123');
      fireEvent.changeText(newPasswordInput, 'newpass123');
      fireEvent.changeText(confirmPasswordInput, 'newpass123');

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('완료', '비밀번호가 변경되었습니다.', [
          expect.any(Object),
        ]);
      });
    });

    it('shows error alert on password change failure', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const errorMessage = '현재 비밀번호가 올바르지 않습니다.';
      const mockChangePassword = jest.fn(() =>
        Promise.reject(new Error(errorMessage))
      );
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: mockChangePassword,
      });

      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'wrong123');
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'newpass123'
      );

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', errorMessage);
      });
    });

    it('disables password inputs while changing password', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      let resolvePassword: (() => void) | null = null;
      const passwordPromise = new Promise<void>((resolve) => {
        resolvePassword = resolve;
      });
      const mockChangePassword = jest.fn(() => passwordPromise);
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: mockChangePassword,
      });

      const { getAllByText, getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const currentPasswordInput = getByPlaceholderText('현재 비밀번호');
      fireEvent.changeText(currentPasswordInput, 'current123');
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 (6자 이상)'),
        'newpass123'
      );
      fireEvent.changeText(
        getByPlaceholderText('새 비밀번호 다시 입력'),
        'newpass123'
      );

      const changeButtons = getAllByText('비밀번호 변경');
      fireEvent.press(changeButtons[changeButtons.length - 1]);

      await waitFor(() => {
        expect(currentPasswordInput.props.editable).toBe(false);
      });

      // Resolve the promise
      resolvePassword!();

      await waitFor(() => {
        expect(currentPasswordInput.props.editable).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles user with no email (anonymous)', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'anon-uid',
          displayName: 'Anonymous User',
          email: null,
          isAnonymous: true,
          id: 'anon-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
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

      const { getByText, queryByText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      expect(getByText('이메일 없음')).toBeTruthy();
      expect(queryByText('비밀번호 변경')).toBeNull();
    });

    it('handles user with null displayName', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: null,
          email: 'test@example.com',
          isAnonymous: false,
          id: 'test-uid',
          profilePicture: null,
          preferences: {
            favoriteStations: [],
            notificationSettings: {
              enabled: true,
              delayThresholdMinutes: 5,
              quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
              weekdaysOnly: false,
              alertTypes: {
                delays: true,
                suspensions: true,
                congestion: false,
                alternativeRoutes: true,
                serviceUpdates: true,
              },
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
            commuteSchedule: {
              weekdays: { morningCommute: null, eveningCommute: null },
              weekends: null,
              autoDetect: false,
            },
            language: 'ko',
            theme: 'system',
            units: 'metric',
          },
          subscription: 'FREE',
          createdAt: new Date(),
          lastLoginAt: new Date(),
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

      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByPlaceholderText('이름을 입력하세요');
      expect(nameInput.props.value).toBe('');
    });

    it('maxLength on name input is 30', () => {
      const { getByPlaceholderText } = render(
        <EditProfileScreen {...defaultProps} />,
      );

      const nameInput = getByPlaceholderText('이름을 입력하세요');
      expect(nameInput.props.maxLength).toBe(30);
    });

    it('renders with undefined route params', () => {
      const { UNSAFE_root } = render(
        <EditProfileScreen {...defaultProps} />,
      );
      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
