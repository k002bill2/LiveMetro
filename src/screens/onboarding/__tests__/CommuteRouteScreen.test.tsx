/**
 * CommuteRouteScreen Test Suite — single-route flow.
 *
 * Tests the simplified onboarding step 2/4: OnbHeader presence, station
 * selection placeholders, navigation guards. The morning/evening text
 * branching was removed when the wizard was redefined as
 * Welcome → CommuteRoute → NotificationPermission → Favorites.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteRouteScreen } from '../CommuteRouteScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  GitBranch: 'GitBranch',
  MapPin: 'MapPin',
  Flag: 'Flag',
  ChevronRight: 'ChevronRight',
  Search: 'Search',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ChevronLeft: 'ChevronLeft',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/components/commute/StationSearchModal', () => ({
  StationSearchModal: 'StationSearchModal',
}));

jest.mock('@/components/commute/TransferStationList', () => ({
  TransferStationList: 'TransferStationList',
}));

jest.mock('@/components/commute/RoutePreview', () => ({
  RoutePreview: 'RoutePreview',
}));

const mockOnSkip = jest.fn();
jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
}));

jest.mock('@/models/commute', () => ({
  MAX_TRANSFER_STATIONS: 3,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
} as unknown;

const mockRoute = {
  params: {
    commuteType: 'morning' as const,
    departureTime: '08:30',
  },
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockCanGoBack.mockClear();
  mockCanGoBack.mockReturnValue(true);
  mockOnSkip.mockClear();
});

describe('CommuteRouteScreen (step 2/4)', () => {
  it('renders the OnbHeader with back + skip controls', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('onb-header')).toBeTruthy();
    expect(getByTestId('onb-header-back')).toBeTruthy();
    expect(getByTestId('onb-header-skip')).toBeTruthy();
  });

  it('renders the single-route title (no morning/evening branch)', () => {
    const { getByText, queryByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByText('출퇴근 경로 설정')).toBeTruthy();
    expect(queryByText('출근 경로 설정')).toBeNull();
    expect(queryByText('퇴근 경로 설정')).toBeNull();
  });

  it('shows station placeholders + labels', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByText('승차역')).toBeTruthy();
    expect(getByText('도착역')).toBeTruthy();
    expect(getByText('승차역을 검색하세요')).toBeTruthy();
    expect(getByText('도착역을 검색하세요')).toBeTruthy();
  });

  it('OnbHeader back button calls navigation.goBack', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('onb-header-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('OnbHeader skip link fires onSkip from OnboardingNavigator context', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('onb-header-skip'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('does not navigate forward while stations are unselected', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByText('다음'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('legacy 이전 button still calls goBack', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByText('이전'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
