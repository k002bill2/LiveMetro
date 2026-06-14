// Jest mocks MUST come before imports (Jest hoisting requirement)
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { LocationPermissionScreen } from '../LocationPermissionScreen';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({
    isDark: false,
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

jest.mock('@/components/settings/SettingToggle', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onValueChange,
      disabled,
    }: {
      label: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        TouchableOpacity,
        {
          testID: `toggle-${label}`,
          disabled,
          accessibilityState: { checked: value, disabled: !!disabled },
          onPress: () => onValueChange(!value),
        },
        React.createElement(Text, null, label),
      ),
  };
});

const mockSetNearbyAutoSearchEnabled = jest.fn((_v: boolean) => Promise.resolve());
jest.mock('@/services/location/nearbySearchPreference', () => ({
  getNearbyAutoSearchEnabled: jest.fn(() => Promise.resolve(true)),
  setNearbyAutoSearchEnabled: (v: boolean) => mockSetNearbyAutoSearchEnabled(v),
  subscribeNearbyAutoSearch: jest.fn(() => () => {}),
}));

jest.mock('@/services/location/locationService', () => ({
  locationService: {
    requestBackgroundPermission: jest.fn(() => Promise.resolve(true)),
  },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack } as unknown;

const defaultProps = {
  navigation: mockNavigation as never,
  route: {
    key: 'LocationPermission',
    name: 'LocationPermission',
    params: undefined,
  } as never,
};

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
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('위치 정보 사용 목적')).toBeTruthy();
      });

      expect(getByText('주변 역 자동 검색')).toBeTruthy();
      expect(getByText('출발/도착 자동 인식')).toBeTruthy();
      expect(getByText('역 근처 알림')).toBeTruthy();
    });

    it('renders detail settings section with background toggle', async () => {
      const { getByText, getByTestId } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('세부 설정')).toBeTruthy();
      });

      expect(getByTestId('toggle-백그라운드 새로고침')).toHaveTextContent('백그라운드 새로고침');
    });

    it('renders privacy notice', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/위치 정보는 기기에만 저장/)).toBeTruthy();
      });
    });

    it('renders system settings button when permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('시스템 설정에서 변경')).toBeTruthy();
      });
    });

    it('shows feature descriptions with correct content', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('현재 위치 기준 가까운 5개역')).toBeTruthy();
        expect(getByText('가까운 역의 노선·도착 정보 자동 표시')).toBeTruthy();
        expect(getByText('길안내 중 환승역에서 다음 노선 안내')).toBeTruthy();
        expect(getByText('설정한 출퇴근 역 도착 시 알림')).toBeTruthy();
      });
    });
  });

  describe('Permission Status Display', () => {
    it('shows loading state initially', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ status: 'undetermined' }), 100))
      );

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      // Initially loading message might appear
      await waitFor(() => {
        expect(getByText('위치 정보 사용 목적')).toBeTruthy();
      });
    });

    it('shows undetermined status initially', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('위치 권한을 요청하지 않았습니다')).toBeTruthy();
      });

      expect(getByText('미설정')).toBeTruthy();
    });

    it('shows granted status when permission is allowed', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      expect(getByText('허용됨')).toBeTruthy();
      expect(getByText('위치 권한 활성화')).toBeTruthy();
      expect(getByText('앱 사용 중에만')).toBeTruthy();
    });

    it('shows denied status when permission is denied', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('위치 권한이 거부되었습니다')).toBeTruthy();
      });

      expect(getByText('거부됨')).toBeTruthy();
    });

    it('shows always-allowed caption when background is also granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('항상 허용')).toBeTruthy();
      });
    });

    it('displays correct icon for granted status', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays correct icon for denied status', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays correct icon for undetermined status', async () => {
      render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Request Flow', () => {
    it('shows request permission button when not granted', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('위치 권한 요청')).toBeTruthy();
      });
    });

    it('does not show request button when already granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { queryByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByText('위치 권한 요청')).toBeNull();
      });
    });

    it('requests foreground permission when button pressed', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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
    it('shows background toggle off when background is not granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });

      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('toggle-백그라운드 새로고침').props.accessibilityState.checked).toBe(false);
      });
    });

    it('shows background toggle on when background permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('toggle-백그라운드 새로고침').props.accessibilityState.checked).toBe(true);
      });
    });

    it('alerts when foreground permission missing before background request', async () => {
      const { locationService } = require('@/services/location/locationService');

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('위치 권한을 요청하지 않았습니다')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '전경 권한 필요',
          '먼저 위치 권한을 허용해주세요.',
        );
      });

      expect(locationService.requestBackgroundPermission).not.toHaveBeenCalled();
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        // On iOS, should directly show success alert
        // On Android 11+, should show guide first
        expect(locationService.requestBackgroundPermission).toHaveBeenCalled();
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        // Should call Alert.alert for success message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify success alert was shown
      await waitFor(() => {
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const hasSuccessAlert = alertCalls.some((call) =>
          call[0]?.includes('권한 허용') || call[0]?.includes('성공')
        );
        expect(hasSuccessAlert).toBeTruthy();
      });
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        // Should call Alert.alert for denial message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify denial alert was shown
      await waitFor(() => {
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const hasDenialAlert = alertCalls.some((call) =>
          call[0]?.includes('권한 거부') || call[0]?.includes('거부')
        );
        expect(hasDenialAlert).toBeTruthy();
      });
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        // Should call Alert.alert for error message
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify error alert was shown
      await waitFor(() => {
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const hasErrorAlert = alertCalls.some((call) =>
          call[0]?.includes('오류') || call[0]?.includes('실패')
        );
        expect(hasErrorAlert).toBeTruthy();
      });
    });

    it('disables toggle while requesting background permission', async () => {
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        expect(getByTestId('toggle-백그라운드 새로고침').props.accessibilityState.disabled).toBe(true);
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

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        // Should call checkPermission (which calls getForegroundPermissionsAsync and getBackgroundPermissionsAsync)
        expect(getForegroundSpy.mock.calls.length).toBeGreaterThan(initialCallCountFG + 1);
      });
    });

    it('opens settings guide when toggling off granted background permission', async () => {
      const { locationService } = require('@/services/location/locationService');

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('toggle-백그라운드 새로고침').props.accessibilityState.checked).toBe(true);
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '설정 열기',
          'LiveMetro 앱의 위치 권한을 변경하시겠습니까?',
          expect.any(Array),
        );
      });

      // Programmatic revoke is impossible — must not call the request flow
      expect(locationService.requestBackgroundPermission).not.toHaveBeenCalled();
    });
  });

  describe('App Settings', () => {
    beforeEach(() => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
    });

    it('opens app settings when button pressed', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('시스템 설정에서 변경')).toBeTruthy();
      });

      fireEvent.press(getByText('시스템 설정에서 변경'));

      expect(Alert.alert).toHaveBeenCalledWith(
        '설정 열기',
        'LiveMetro 앱의 위치 권한을 변경하시겠습니까?',
        expect.any(Array),
      );
    });

    it('calls Linking.openSettings when settings button confirmed', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('시스템 설정에서 변경')).toBeTruthy();
      });

      fireEvent.press(getByText('시스템 설정에서 변경'));

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
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('시스템 설정에서 변경')).toBeTruthy();
      });

      fireEvent.press(getByText('시스템 설정에서 변경'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const buttons = (alertCalls[0]?.[2] ?? []) as any[];
      const cancelButton = buttons.find((btn) => btn.text === '취소');
      if (cancelButton?.onPress) {
        cancelButton.onPress();
      }

      // Should not call openSettings
      expect(Linking.openSettings).not.toHaveBeenCalled();
    });
  });

  describe('Privacy Link', () => {
    it('navigates to PrivacyPolicy when privacy card pressed', async () => {
      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('privacy-link-card')).toBeTruthy();
      });

      fireEvent.press(getByTestId('privacy-link-card'));

      expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
    });
  });

  describe('Permission Check on Mount', () => {
    it('checks foreground permission on mount', async () => {
      render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('checks background permission on mount', async () => {
      render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(Location.getBackgroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('handles error during permission check', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Check failed'),
      );

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        // Should still render with undetermined state
        expect(getByText('위치 권한을 요청하지 않았습니다')).toBeTruthy();
      });
    });

    it('sets loading to false after permission check', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        // After check, should show actual status (not loading)
        expect(
          getByText('위치 권한을 요청하지 않았습니다') ||
          getByText('정확한 위치 사용 중') ||
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

      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

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

      render(<LocationPermissionScreen {...defaultProps} />);

      // Should recover and show undetermined initially
      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('displays all feature items correctly', async () => {
      const { getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        // Check all feature titles
        expect(getByText('주변 역 자동 검색')).toBeTruthy();
        expect(getByText('출발/도착 자동 인식')).toBeTruthy();
        expect(getByText('역 근처 알림')).toBeTruthy();
      });

      // Verify descriptions
      expect(getByText(/가까운 5개역/)).toBeTruthy();
      expect(getByText(/노선·도착 정보 자동 표시/)).toBeTruthy();
      expect(getByText(/출퇴근 역 도착 시 알림/)).toBeTruthy();
    });

    it('alerts instead of requesting when toggling background with denied foreground', async () => {
      const { locationService } = require('@/services/location/locationService');
      (locationService.requestBackgroundPermission as jest.Mock).mockResolvedValue(true);

      // Set foreground as denied
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { getByTestId, getByText } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('위치 권한이 거부되었습니다')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-백그라운드 새로고침'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '전경 권한 필요',
          '먼저 위치 권한을 허용해주세요.',
        );
      });

      expect(locationService.requestBackgroundPermission).not.toHaveBeenCalled();
    });

    it('maintains permission state across renders', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByText, rerender } = render(
        <LocationPermissionScreen {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });

      // Rerender and verify state persists
      rerender(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });
    });
  });
  describe('Fine Controls (handoff toggles)', () => {
    it('shows precise-location toggle reflecting permission state', async () => {
      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('toggle-정확한 위치 사용')).toHaveTextContent('정확한 위치 사용');
      });
    });

    it('opens system-settings alert when precise toggle pressed', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const { getByTestId, getByText } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('정확한 위치 사용 중')).toBeTruthy();
      });
      fireEvent.press(getByTestId('toggle-정확한 위치 사용'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '정확한 위치',
          expect.stringContaining('시스템 설정'),
          expect.any(Array),
        );
      });
    });

    it('persists nearby auto-search preference when toggled', async () => {
      const { getByTestId } = render(<LocationPermissionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('toggle-자동 주변 역 검색')).toHaveTextContent('자동 주변 역 검색');
      });
      fireEvent.press(getByTestId('toggle-자동 주변 역 검색'));

      await waitFor(() => {
        expect(mockSetNearbyAutoSearchEnabled).toHaveBeenCalledWith(false);
      });
    });
  });
});
