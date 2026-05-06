/**
 * SettingsScreen Test Suite
 * Tests settings screen rendering and user interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from '../SettingsScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';

jest.mock('lucide-react-native', () => ({
  ChevronRight: 'ChevronRight',
  User: 'User',
  Pencil: 'Pencil',
  TrainFront: 'TrainFront',
  Bell: 'Bell',
  Clock: 'Clock',
  Volume2: 'Volume2',
  Globe: 'Globe',
  Moon: 'Moon',
  MapPin: 'MapPin',
  LogIn: 'LogIn',
  ScanFace: 'ScanFace',
  Fingerprint: 'Fingerprint',
  HelpCircle: 'HelpCircle',
  Shield: 'Shield',
  ShieldCheck: 'ShieldCheck',
  Info: 'Info',
  LogOut: 'LogOut',
  FileCheck: 'FileCheck',
  MessageSquare: 'MessageSquare',
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackScreenProps: {},
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      isAnonymous: false,
      preferences: {
        favoriteStations: [],
        notificationSettings: {
          pushNotifications: true,
          quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
        },
        commuteSchedule: {
          weekdays: { morningCommute: null, eveningCommute: null },
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
  })),
}));

jest.mock('@/services/i18n', () => ({
  useI18n: jest.fn(() => ({
    language: 'ko',
    t: {
      common: { cancel: '취소', error: '오류' },
      settings: {
        title: '설정',
        profile: '프로필',
        anonymousUser: '익명 사용자',
        notificationSettings: '알림 설정',
        commuteSettings: '출퇴근 설정',
        commuteSettingsDesc: '출퇴근 경로 및 알림 설정',
        delayAlert: '지연 알림',
        delayAlertDesc: '열차 지연 시 알림 받기',
        notificationTime: '알림 시간대',
        notificationTimeDesc: '출퇴근 시간 설정',
        soundSettings: '소리 설정',
        soundSettingsDesc: '알림음 및 진동 설정',
        appSettings: '앱 설정',
        language: '언어',
        theme: '테마',
        themeSystem: '시스템 설정 따름',
        themeLight: '라이트 모드',
        themeDark: '다크 모드',
        locationPermission: '위치 권한',
        locationPermissionDesc: '주변 역 검색을 위해 필요',
        security: '보안',
        biometricLogin: '생체인증 로그인',
        biometricLoginDesc: '생체인증으로 빠르게 로그인',
        biometricUnavailable: '이 기기에서 사용할 수 없음',
        info: '정보',
        help: '도움말',
        helpDesc: '앱 사용법 및 FAQ',
        privacyPolicy: '개인정보처리방침',
        termsOfService: '서비스 이용약관',
        appInfo: '앱 정보',
        version: '버전',
        signOut: '로그아웃',
        signOutConfirm: '정말 로그아웃하시겠습니까?',
      },
    },
  })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    themeMode: 'system',
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      textDisabled: '#D1D1D6',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      white: '#FFFFFF',
    },
  })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: jest.fn(),
  isBiometricLoginEnabled: jest.fn(),
  getBiometricTypeName: jest.fn(),
  disableBiometricLogin: jest.fn(),
  hasStoredCredentials: jest.fn(),
}));

const defaultProps = {
  navigation: {
    navigate: mockNavigate,
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
  } as unknown as Parameters<typeof SettingsScreen>[0]['navigation'],
  route: {
    key: 'SettingsHome',
    name: 'SettingsHome' as const,
    params: undefined,
  },
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Default biometric mock values
    const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName, disableBiometricLogin, hasStoredCredentials } = require('@/services/auth/biometricService');
    isBiometricAvailable.mockResolvedValue(false);
    isBiometricLoginEnabled.mockResolvedValue(false);
    getBiometricTypeName.mockResolvedValue('생체인증');
    disableBiometricLogin.mockResolvedValue(true);
    hasStoredCredentials.mockResolvedValue(false);

    // Default AsyncStorage mock values
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders correctly with user information', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    expect(getByText('Test User')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders anonymous user when no displayName', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: {
        uid: 'anon-uid',
        displayName: null,
        email: null,
        isAnonymous: true,
        preferences: {
          favoriteStations: [],
          notificationSettings: { pushNotifications: true, quietHours: { enabled: false } },
          commuteSchedule: { weekdays: { morningCommute: null, eveningCommute: null } },
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

    const { getByText } = render(<SettingsScreen {...defaultProps} />);
    expect(getByText('익명 사용자')).toBeTruthy();
    expect(getByText('anonymous@livemetro.app')).toBeTruthy();
  });

  it('renders all settings sections', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    expect(getByText('알림 설정')).toBeTruthy();
    expect(getByText('앱 설정')).toBeTruthy();
    expect(getByText('보안')).toBeTruthy();
    expect(getByText('정보')).toBeTruthy();
  });

  it('renders notification setting items', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    expect(getByText('출퇴근 설정')).toBeTruthy();
    expect(getByText('지연 알림')).toBeTruthy();
    expect(getByText('알림 시간대')).toBeTruthy();
    expect(getByText('소리 설정')).toBeTruthy();
  });

  it('navigates to EditProfile when profile card is pressed', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    fireEvent.press(getByText('Test User'));
    expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
  });

  it('navigates to CommuteSettings when pressed', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    fireEvent.press(getByText('출퇴근 설정'));
    expect(mockNavigate).toHaveBeenCalledWith('CommuteSettings');
  });

  it('shows sign out confirmation alert', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    fireEvent.press(getByText('로그아웃'));
    expect(Alert.alert).toHaveBeenCalledWith(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      expect.any(Array),
    );
  });

  it('displays language and theme values', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    expect(getByText('한국어')).toBeTruthy();
    expect(getByText('시스템 설정 따름')).toBeTruthy();
  });

  it('renders version info', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);

    expect(getByText('버전 1.0.0')).toBeTruthy();
  });

  describe('Navigation', () => {
    it('navigates to edit profile when edit button is pressed', () => {
      const { getAllByText } = render(<SettingsScreen {...defaultProps} />);
      const editButtons = getAllByText('Test User');

      fireEvent.press(editButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
    });

    it('navigates to CommuteSettings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('출퇴근 설정'));
      expect(mockNavigate).toHaveBeenCalledWith('CommuteSettings');
    });

    it('navigates to DelayNotification', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('지연 알림'));
      expect(mockNavigate).toHaveBeenCalledWith('DelayNotification');
    });

    it('navigates to NotificationTime', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('알림 시간대'));
      expect(mockNavigate).toHaveBeenCalledWith('NotificationTime');
    });

    it('navigates to SoundSettings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('소리 설정'));
      expect(mockNavigate).toHaveBeenCalledWith('SoundSettings');
    });

    it('navigates to LanguageSettings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('언어'));
      expect(mockNavigate).toHaveBeenCalledWith('LanguageSettings');
    });

    it('navigates to ThemeSettings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('테마'));
      expect(mockNavigate).toHaveBeenCalledWith('ThemeSettings');
    });

    it('navigates to LocationPermission', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('위치 권한'));
      expect(mockNavigate).toHaveBeenCalledWith('LocationPermission');
    });

    it('navigates to Help', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('도움말'));
      expect(mockNavigate).toHaveBeenCalledWith('Help');
    });

    it('navigates to PrivacyPolicy', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('개인정보처리방침'));
      expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
    });

    it('navigates to DelayFeed via root navigation', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('실시간 제보'));
      expect(mockNavigate).toHaveBeenCalledWith('DelayFeed');
    });

    it('navigates to DelayCertificate via root navigation', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      fireEvent.press(getByText('지연증명서'));
      expect(mockNavigate).toHaveBeenCalledWith('DelayCertificate');
    });
  });

  describe('Auto Login Toggle', () => {
    it('loads auto login state from storage when enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@livemetro_auto_login_enabled');
      });

      expect(getByText('자동로그인')).toBeTruthy();
    });

    it('loads auto login state from storage when disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@livemetro_auto_login_enabled');
      });

      expect(getByText('자동로그인')).toBeTruthy();
    });
  });

  describe('Biometric Toggle', () => {
    it('shows unavailable message when biometric is not available', async () => {
      const { isBiometricAvailable } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(false);

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(isBiometricAvailable).toHaveBeenCalled();
      });

      // Should render biometric unavailable message
      expect(getByText('이 기기에서 사용할 수 없음')).toBeTruthy();
    });

    it('checks biometric availability on mount', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('Face ID');

      render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(isBiometricAvailable).toHaveBeenCalled();
        expect(isBiometricLoginEnabled).toHaveBeenCalled();
        expect(getBiometricTypeName).toHaveBeenCalled();
      });
    });

    it('renders Face ID when biometric type is Face ID', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('Face ID');

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Face ID 로그인')).toBeTruthy();
      });
    });

    it('renders Fingerprint when biometric type is Fingerprint', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('Fingerprint');

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Fingerprint 로그인')).toBeTruthy();
      });
    });
  });

  describe('Sign Out', () => {
    it('calls signOut when confirmed', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockSignOut = jest.fn().mockResolvedValue(undefined);
      useAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: mockSignOut,
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByText('로그아웃'));

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const signOutButton = buttons.find((btn: any) => btn.style === 'destructive');

      await waitFor(() => {
        signOutButton.onPress();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('handles sign out error', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const mockSignOut = jest.fn().mockRejectedValue(new Error('Sign out failed'));
      useAuth.mockReturnValue({
        user: {
          uid: 'test-uid',
          displayName: 'Test User',
          email: 'test@example.com',
          isAnonymous: false,
        },
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: mockSignOut,
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByText('로그아웃'));

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const signOutButton = buttons.find((btn: any) => btn.style === 'destructive');

      await waitFor(() => {
        signOutButton.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith('오류', '로그아웃에 실패했습니다.');
    });

    it('shows sign out alert with cancel option', async () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      fireEvent.press(getByText('로그아웃'));

      expect(Alert.alert).toHaveBeenCalledWith(
        '로그아웃',
        expect.stringContaining('정말'),
        expect.any(Array)
      );
    });
  });

  describe('Language Support', () => {
    it('displays language setting value from i18n', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      // Should display the current language setting
      expect(getByText('한국어')).toBeTruthy();
      expect(getByText('언어')).toBeTruthy();
    });
  });

  describe('Theme Support', () => {
    it('renders dark theme values', () => {
      (useTheme as jest.Mock).mockReturnValueOnce({
        themeMode: 'dark',
        colors: {
          primary: '#007AFF',
          background: '#000000',
          backgroundSecondary: '#1C1C1E',
          surface: '#2C2C2E',
          textPrimary: '#FFFFFF',
          textSecondary: '#8E8E93',
          textTertiary: '#C7C7CC',
          textDisabled: '#D1D1D6',
          textInverse: '#000000',
          borderLight: '#E5E5EA',
          borderMedium: '#D1D1D6',
          error: '#FF3B30',
          success: '#34C759',
          warning: '#FF9500',
          white: '#FFFFFF',
        },
      });

      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      expect(getByText('다크 모드')).toBeTruthy();
    });

    it('renders light theme values', () => {
      (useTheme as jest.Mock).mockReturnValueOnce({
        themeMode: 'light',
        colors: {
          primary: '#007AFF',
          background: '#FFFFFF',
          backgroundSecondary: '#F2F2F7',
          surface: '#FFFFFF',
          textPrimary: '#000000',
          textSecondary: '#8E8E93',
          textTertiary: '#C7C7CC',
          textDisabled: '#D1D1D6',
          textInverse: '#FFFFFF',
          borderLight: '#E5E5EA',
          borderMedium: '#D1D1D6',
          error: '#FF3B30',
          success: '#34C759',
          warning: '#FF9500',
          white: '#FFFFFF',
        },
      });

      const { getByText } = render(<SettingsScreen {...defaultProps} />);
      expect(getByText('라이트 모드')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles biometric initialization error gracefully', async () => {
      const { isBiometricAvailable } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockRejectedValue(new Error('Biometric check failed'));

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(isBiometricAvailable).toHaveBeenCalled();
      });

      // Should still render without crashing
      expect(getByText('Test User')).toBeTruthy();
    });

    it('handles AsyncStorage initialization error gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalled();
      });

      // Should still render without crashing
      expect(getByText('Test User')).toBeTruthy();
    });

    it('handles biometric status update', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('생체인증');

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(isBiometricAvailable).toHaveBeenCalled();
      });

      expect(getByText('생체인증 로그인')).toBeTruthy();
    });

    it('renders all section titles', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('알림 설정')).toBeTruthy();
      expect(getByText('지연 정보')).toBeTruthy();
      expect(getByText('앱 설정')).toBeTruthy();
      expect(getByText('보안')).toBeTruthy();
      expect(getByText('정보')).toBeTruthy();
    });

    it('renders delay info section with Live Reports and Delay Certificate', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('실시간 제보')).toBeTruthy();
      expect(getByText('지연증명서')).toBeTruthy();
    });
  });

  describe('Settings Items Rendering', () => {
    it('renders help icon and text', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('도움말')).toBeTruthy();
      expect(getByText('앱 사용법 및 FAQ')).toBeTruthy();
    });

    it('renders privacy policy item', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('개인정보처리방침')).toBeTruthy();
    });

    it('renders terms of service item', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('서비스 이용약관')).toBeTruthy();
    });

    it('renders location permission item', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('위치 권한')).toBeTruthy();
      expect(getByText('주변 역 검색을 위해 필요')).toBeTruthy();
    });
  });

  describe('Profile Section', () => {
    it('displays user profile with name and email', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('Test User')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('renders user profile section with correct structure', () => {
      const { getAllByText } = render(<SettingsScreen {...defaultProps} />);

      // Should have profile card
      const profileNames = getAllByText('Test User');
      expect(profileNames.length).toBeGreaterThan(0);
    });
  });

  describe('Sign Out Button', () => {
    it('displays sign out button', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('로그아웃')).toBeTruthy();
    });

    it('sign out button is pressable', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      const signOutButtons = getByText('로그아웃');
      expect(signOutButtons).toBeTruthy();
    });
  });

  describe('Settings Navigation Items', () => {
    it('navigates to all notification settings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      const commuteItem = getByText('출퇴근 설정');
      fireEvent.press(commuteItem);
      expect(mockNavigate).toHaveBeenCalledWith('CommuteSettings');

      mockNavigate.mockClear();

      const delayAlertItem = getByText('지연 알림');
      fireEvent.press(delayAlertItem);
      expect(mockNavigate).toHaveBeenCalledWith('DelayNotification');
    });

    it('navigates to all app preference settings', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      const languageItem = getByText('언어');
      fireEvent.press(languageItem);
      expect(mockNavigate).toHaveBeenCalledWith('LanguageSettings');

      mockNavigate.mockClear();

      const themeItem = getByText('테마');
      fireEvent.press(themeItem);
      expect(mockNavigate).toHaveBeenCalledWith('ThemeSettings');
    });

    it('renders all app info items without navigation', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('서비스 이용약관')).toBeTruthy();
      expect(getByText('버전 1.0.0')).toBeTruthy();
    });
  });

  describe('Biometric Rendering', () => {
    it('displays biometric setting with correct type', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('Face ID');

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Face ID 로그인')).toBeTruthy();
      });
    });

    it('renders biometric description when available', async () => {
      const { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName } = require('@/services/auth/biometricService');
      isBiometricAvailable.mockResolvedValue(true);
      isBiometricLoginEnabled.mockResolvedValue(false);
      getBiometricTypeName.mockResolvedValue('Fingerprint');

      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Fingerprint 로그인')).toBeTruthy();
      });
    });
  });

  describe('i18n Integration', () => {
    it('displays localized text from i18n', () => {
      const { getByText, queryByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('알림 설정')).toBeTruthy();
      expect(queryByText('취소')).toBeFalsy(); // Only in alerts
    });

    it('handles Korean language content correctly', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('출퇴근 설정')).toBeTruthy();
      expect(getByText('지연 알림')).toBeTruthy();
      expect(getByText('소리 설정')).toBeTruthy();
    });
  });

  describe('Theme Application', () => {
    it('applies colors from theme correctly', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      // Just verify rendering works with theme colors
      expect(getByText('Test User')).toBeTruthy();
    });

    it('renders with system theme mode', () => {
      const { getByText } = render(<SettingsScreen {...defaultProps} />);

      expect(getByText('시스템 설정 따름')).toBeTruthy();
    });
  });
});
