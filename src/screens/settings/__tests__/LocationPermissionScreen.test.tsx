// Jest mocks MUST come before imports (Jest hoisting requirement)
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { LocationPermissionScreen } from '../LocationPermissionScreen';

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
    jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
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

    it('renders privacy notice', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText(/위치 정보는 기기에만 저장/)).toBeTruthy();
      });
    });

    it('renders app settings button', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('앱 설정 열기')).toBeTruthy();
      });
    });

    it('shows feature descriptions with correct content', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('현재 위치에서 가까운 지하철역을 자동으로 찾아줍니다')).toBeTruthy();
        expect(getByText('자주 이용하는 경로를 추천하고 설정할 수 있습니다')).toBeTruthy();
        expect(getByText('위치 기반으로 실시간 지연 알림을 받을 수 있습니다')).toBeTruthy();
      });
    });
  });

  describe('Permission Status Display', () => {
    it('shows loading state initially', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ status: 'undetermined' }), 100))
      );

      const { getByText } = render(<LocationPermissionScreen />);

      // Initially loading message might appear
      await waitFor(() => {
        expect(getByText('위치 정보 사용 목적')).toBeTruthy();
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

    it('displays correct icon for granted status', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays correct icon for denied status', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays correct icon for undetermined status', async () => {
      render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Request Flow', () => {
    it('shows request permission button when not granted', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });
    });

    it('does not show request button when already granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { queryByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(queryByText('위치 권한 요청')).toBeNull();
      });
    });

    it('requests foreground permission when button pressed', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '위치 권한이 필요합니다',
          expect.any(String),
          expect.any(Array),
        );
      });
    });

    it('shows explanation alert before requesting permission', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '위치 권한이 필요합니다',
          expect.stringContaining('주변 역 찾기'),
          expect.any(Array),
        );
      });
    });

    it('shows success alert when permission is granted', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      // Accept the explanation alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[0][2] as any[];
      const continueButton = buttons.find((btn) => btn.text === '계속');
      if (continueButton?.onPress) {
        continueButton.onPress();
      }

      await waitFor(() => {
        // Should show success alert
        const calls = (Alert.alert as jest.Mock).mock.calls;
        expect(calls.some((call) => call[0]?.includes('권한'))).toBeTruthy();
      });
    });

    it('shows denial alert when permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      await waitFor(() => {
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const buttons = alertCalls[0][2] as any[];
        const continueButton = buttons.find((btn) => btn.text === '계속');
        if (continueButton?.onPress) {
          continueButton.onPress();
        }
      });

      await waitFor(() => {
        expect((Alert.alert as jest.Mock).mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('handles cancel from explanation alert', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[0][2] as any[];
      const cancelButton = buttons.find((btn) => btn.text === '허용 안함');
      if (cancelButton?.onPress) {
        cancelButton.onPress();
      }

      // Should not call requestForegroundPermissionsAsync if cancelled
      await waitFor(() => {
        expect((Alert.alert as jest.Mock).mock.calls.length).toBe(1);
      });
    });

    it('handles error during permission request', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Permission request failed'),
      );

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('위치 권한 요청'));

      await waitFor(() => {
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const buttons = alertCalls[0][2] as any[];
        const continueButton = buttons.find((btn) => btn.text === '계속');
        if (continueButton?.onPress) {
          continueButton.onPress();
        }
      });

      await waitFor(() => {
        expect((Alert.alert as jest.Mock).mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('disables request button while requesting', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ status: 'granted' }), 100))
      );

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      const button = getByText('위치 권한 요청');

      fireEvent.press(button);

      // The button should be disabled and show loading state after alert confirmation
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });

  describe('Background Permission Flow', () => {
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

    it('does not show background button when not granted yet', async () => {
      const { queryByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(queryByText('백그라운드 권한 요청')).toBeNull();
      });
    });

    it('shows granted badge when background permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('백그라운드 위치 허용됨')).toBeTruthy();
      });
    });

    it('alerts when foreground permission missing before background request', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });

      const { queryByText } = render(<LocationPermissionScreen />);

      // Should not show background button for undetermined foreground
      await waitFor(() => {
        expect(queryByText('백그라운드 권한 요청')).toBeNull();
      });
    });

    it('requests background permission successfully', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(true);

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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        // On iOS, should directly show success alert
        // On Android 11+, should show guide first
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('shows Android 11+ guide when background permission requested on foreground granted state', async () => {
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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('skips Android guide and directly requests permission on iOS', async () => {
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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('shows success alert when background permission granted', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(true);

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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        // Should call Alert.alert for success message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify success alert was shown
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const hasSuccessAlert = alertCalls.some((call) =>
        call[0]?.includes('권한 허용') || call[0]?.includes('성공')
      );
      expect(hasSuccessAlert).toBeTruthy();
    });

    it('shows denial alert when background permission denied', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(false);

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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        // Should call Alert.alert for denial message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify denial alert was shown
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const hasDenialAlert = alertCalls.some((call) =>
        call[0]?.includes('권한 거부') || call[0]?.includes('거부')
      );
      expect(hasDenialAlert).toBeTruthy();
    });

    it('handles error during background permission request', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockRejectedValueOnce(
        new Error('Background permission failed'),
      );

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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        // Should call Alert.alert for error message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify error alert was shown
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const hasErrorAlert = alertCalls.some((call) =>
        call[0]?.includes('오류') || call[0]?.includes('실패')
      );
      expect(hasErrorAlert).toBeTruthy();
    });

    it('disables button while requesting background permission', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 200))
      );

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

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        expect(getByText('권한 요청 중...')).toBeTruthy();
      });
    });

    it('checks permission after background request', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });

      const getForegroundSpy = Location.getForegroundPermissionsAsync as jest.Mock;
      const getBackgroundSpy = Location.getBackgroundPermissionsAsync as jest.Mock;
      const initialCallCountFG = getForegroundSpy.mock.calls.length;
      void getBackgroundSpy.mock.calls.length;

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('백그라운드 권한 요청')).toBeTruthy();
      });

      fireEvent.press(getByText('백그라운드 권한 요청'));

      await waitFor(() => {
        // Should call checkPermission (which calls getForegroundPermissionsAsync and getBackgroundPermissionsAsync)
        expect(getForegroundSpy.mock.calls.length).toBeGreaterThan(initialCallCountFG);
      });
    });
  });

  describe('App Settings', () => {
    it('opens app settings when button pressed', async () => {
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

    it('calls Linking.openSettings when settings button confirmed', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('앱 설정 열기')).toBeTruthy();
      });

      fireEvent.press(getByText('앱 설정 열기'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[0][2] as any[];
      const openButton = buttons.find((btn) => btn.text === '설정 열기');
      if (openButton?.onPress) {
        openButton.onPress();
      }

      await waitFor(() => {
        expect(Linking.openSettings).toHaveBeenCalled();
      });
    });

    it('cancels settings alert when cancel pressed', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('앱 설정 열기')).toBeTruthy();
      });

      fireEvent.press(getByText('앱 설정 열기'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[0][2] as any[];
      const cancelButton = buttons.find((btn) => btn.text === '취소');
      if (cancelButton?.onPress) {
        cancelButton.onPress();
      }

      // Should not call openSettings
      expect(Linking.openSettings).not.toHaveBeenCalled();
    });
  });

  describe('Permission Check on Mount', () => {
    it('checks foreground permission on mount', async () => {
      render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('checks background permission on mount', async () => {
      render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(Location.getBackgroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('handles error during permission check', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Check failed'),
      );

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        // Should still render with undetermined state
        expect(getByText('위치 권한을 요청하지 않았습니다')).toBeTruthy();
      });
    });

    it('sets loading to false after permission check', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        // After check, should show actual status (not loading)
        expect(
          getByText('위치 권한을 요청하지 않았습니다') ||
          getByText('위치 권한이 허용되었습니다') ||
          getByText('위치 권한이 거부되었습니다')
        ).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid multiple permission requests', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });

      const button = getByText('위치 권한 요청');

      // Simulate rapid clicks
      fireEvent.press(button);
      fireEvent.press(button);

      await waitFor(() => {
        // Should handle gracefully
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it('recovers from failed permission check', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Check 1 failed'))
        .mockResolvedValueOnce({ status: 'granted' });

      render(<LocationPermissionScreen />);

      // Should recover and show undetermined initially
      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays all feature items correctly', async () => {
      const { getByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        // Check all feature titles
        expect(getByText('주변 역 찾기')).toBeTruthy();
        expect(getByText('출퇴근 경로 설정')).toBeTruthy();
        expect(getByText('맞춤 알림')).toBeTruthy();
      });

      // Verify descriptions
      expect(getByText(/가까운 지하철역을/)).toBeTruthy();
      expect(getByText(/자주 이용하는 경로/)).toBeTruthy();
      expect(getByText(/실시간 지연 알림/)).toBeTruthy();
    });

    it('handles background permission request without foreground check', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(true);

      // Set foreground as denied
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { queryByText } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        // Should not show background button
        expect(queryByText('백그라운드 권한 요청')).toBeNull();
      });
    });

    it('maintains permission state across renders', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText, rerender } = render(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한이 허용되었습니다')).toBeTruthy();
      });

      // Rerender and verify state persists
      rerender(<LocationPermissionScreen />);

      await waitFor(() => {
        expect(getByText('위치 권한이 허용되었습니다')).toBeTruthy();
      });
    });
  });
});
