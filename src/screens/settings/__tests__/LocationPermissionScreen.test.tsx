/**
 * LocationPermissionScreen Test Suite
 * Tests location permission status display and permission requests
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { LocationPermissionScreen } from '../LocationPermissionScreen';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      primaryLight: '#E5F0FF',
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
    },
  }),
  ThemeColors: {},
}));

jest.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'undetermined' }),
  ),
  getBackgroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'undetermined' }),
  ),
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' }),
  ),
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

jest.mock('@/services/location/locationService', () => ({
  locationService: {
    requestBackgroundPermission: jest.fn(() => Promise.resolve(true)),
  },
}));

describe('LocationPermissionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
  });

  it('renders location uses section', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('위치 정보 사용 목적')).toBeTruthy();
    });

    expect(getByText('주변 역 찾기')).toBeTruthy();
    expect(getByText('출퇴근 경로 설정')).toBeTruthy();
    expect(getByText('맞춤 알림')).toBeTruthy();
  });

  it('renders permission management section', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('권한 관리')).toBeTruthy();
    });
  });

  it('shows undetermined status initially', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('위치 권한을 요청하지 않았습니다')).toBeTruthy();
    });
  });

  it('shows granted status when permission is allowed', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('위치 권한이 허용되었습니다')).toBeTruthy();
    });
  });

  it('shows denied status when permission is denied', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('위치 권한이 거부되었습니다')).toBeTruthy();
    });
  });

  it('shows request permission button when not granted', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('위치 권한 요청')).toBeTruthy();
    });
  });

  it('shows app settings button', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('앱 설정 열기')).toBeTruthy();
    });
  });

  it('opens settings alert when app settings button pressed', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('앱 설정 열기')).toBeTruthy();
    });

    fireEvent.press(getByText('앱 설정 열기'));

    expect(Alert.alert).toHaveBeenCalledWith(
      '설정 열기',
      'LiveMetro 앱의 위치 권한을 변경하시겠습니까?',
      expect.any(Array),
    );
  });

  it('renders privacy notice', async () => {
    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText(/위치 정보는 기기에만 저장/)).toBeTruthy();
    });
  });

  it('shows background permission button when foreground is granted', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });

    const { getByText } = render(<LocationPermissionScreen />);

    await waitFor(() => {
      expect(getByText('백그라운드 권한 요청')).toBeTruthy();
    });
  });
});
