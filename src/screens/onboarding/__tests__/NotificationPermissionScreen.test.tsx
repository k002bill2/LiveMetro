/**
 * NotificationPermissionScreen — RTL smoke tests covering the toggle defaults,
 * "알림 받기" / "다음에" navigation, and notification service wiring.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NotificationPermissionScreen } from '../NotificationPermissionScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOnSkip = jest.fn();
const mockRequestPermissions = jest.fn();

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  AlertTriangle: 'AlertTriangle',
  ArrowRight: 'ArrowRight',
  ChevronLeft: 'ChevronLeft',
  Clock: 'Clock',
  Megaphone: 'Megaphone',
  TrainFront: 'TrainFront',
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style, testID }: { children?: React.ReactNode; style?: unknown; testID?: string }) =>
      React.createElement(View, { style, testID }, children),
  };
});

jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
}));

jest.mock('@/services/notification/notificationService', () => ({
  notificationService: {
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
  },
}));

jest.mock('@/models/commute', () => ({
  DEFAULT_COMMUTE_NOTIFICATIONS: {
    transferAlert: true,
    arrivalAlert: false,
    delayAlert: true,
    incidentAlert: true,
    alertMinutesBefore: 5,
    departureTimeAlert: true,
    communityAlert: false,
  },
}));

const baseRouteData = {
  departureTime: '08:30',
  departureStation: { stationId: 'stn-1', stationName: '강남', lineId: '2', lineName: '2호선' },
  arrivalStation: { stationId: 'stn-2', stationName: '시청', lineId: '1', lineName: '1호선' },
  transferStations: [],
};

const baseNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: jest.fn(() => true),
} as unknown as React.ComponentProps<typeof NotificationPermissionScreen>['navigation'];

const baseRoute = {
  key: 'permission',
  name: 'NotificationPermission',
  params: { route: baseRouteData },
} as unknown as React.ComponentProps<typeof NotificationPermissionScreen>['route'];

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockOnSkip.mockClear();
  mockRequestPermissions.mockReset();
});

describe('NotificationPermissionScreen (step 3/4)', () => {
  it('renders the OnbHeader, preview card, and 3 toggle cards with Wanted defaults', () => {
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    expect(getByTestId('onb-header')).toBeTruthy();
    expect(getByTestId('notification-preview')).toBeTruthy();
    expect(getByTestId('toggle-departureTimeAlert')).toBeTruthy();
    expect(getByTestId('toggle-delayAlert')).toBeTruthy();
    expect(getByTestId('toggle-communityAlert')).toBeTruthy();
    expect(getByTestId('switch-departureTimeAlert').props.value).toBe(true);
    expect(getByTestId('switch-delayAlert').props.value).toBe(true);
    // 실시간 제보 알림은 디자인 기본값 OFF
    expect(getByTestId('switch-communityAlert').props.value).toBe(false);
  });

  it('"알림 받기" requests permissions and navigates with the granted result', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('notification-allow'));

    await waitFor(() => {
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('FavoritesOnboarding', expect.objectContaining({
        route: baseRouteData,
        notificationGranted: true,
      }));
    });
  });

  it('still navigates forward (notificationGranted=false) when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('notification-allow'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('FavoritesOnboarding', expect.objectContaining({
        notificationGranted: false,
      }));
    });
  });

  it('"다음에" skips the permission request and navigates forward', () => {
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('notification-later'));

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('FavoritesOnboarding', expect.objectContaining({
      notificationGranted: false,
    }));
  });

  it('OnbHeader skip link fires onSkip from OnboardingNavigator context', () => {
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('onb-header-skip'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('toggling a switch updates its value', () => {
    const { getByTestId } = render(
      <NotificationPermissionScreen navigation={baseNavigation} route={baseRoute} />,
    );
    const communitySwitch = getByTestId('switch-communityAlert');
    expect(communitySwitch.props.value).toBe(false);
    fireEvent(communitySwitch, 'valueChange', true);
    expect(communitySwitch.props.value).toBe(true);
  });
});
