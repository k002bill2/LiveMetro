/**
 * SettingsScreen Test Suite
 * Tests settings screen rendering and user interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
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
  FileText: 'FileText',
  ShieldCheck: 'ShieldCheck',
  Info: 'Info',
  LogOut: 'LogOut',
  FileCheck: 'FileCheck',
  MessageSquare: 'MessageSquare',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
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
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
  })),
}));

jest.mock('@/services/i18n', () => ({
  useI18n: () => ({
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
  }),
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
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
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: jest.fn(() => Promise.resolve(false)),
  isBiometricLoginEnabled: jest.fn(() => Promise.resolve(false)),
  getBiometricTypeName: jest.fn(() => Promise.resolve('생체인증')),
  disableBiometricLogin: jest.fn(() => Promise.resolve(true)),
  hasStoredCredentials: jest.fn(() => Promise.resolve(false)),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from '../SettingsScreen';
import { useAuth } from '@/services/auth/AuthContext';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

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
      signOut: jest.fn(),
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
});
