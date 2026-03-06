/**
 * CommuteTimeScreen Test Suite
 * Tests commute time selection screen rendering and interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteTimeScreen } from '../CommuteTimeScreen';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('lucide-react-native', () => ({
  Sun: 'Sun',
  Moon: 'Moon',
  Info: 'Info',
  ArrowRight: 'ArrowRight',
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: jest.fn(),
  })),
}));

jest.mock('@/components/settings/SettingTimePicker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    SettingTimePicker: ({ label, value }: { label: string; value: string }) =>
      React.createElement(View, { testID: `time-picker-${label}` },
        React.createElement(Text, null, label),
        React.createElement(Text, null, value),
      ),
  };
});

jest.mock('@/styles/modernTheme', () => ({
  COLORS: {
    white: '#FFFFFF',
    black: '#000000',
    secondary: { yellow: '#FFD700', blue: '#007AFF' },
    text: { primary: '#1A1A1A', secondary: '#666', tertiary: '#999' },
    surface: { background: '#F5F5F5' },
    border: { light: '#E5E5E5', medium: '#CCC' },
    gray: { 400: '#999' },
  },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 28 },
    fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
    lineHeight: { tight: 1.2, relaxed: 1.5 },
  },
  RADIUS: { base: 8, lg: 12 },
  SHADOWS: { sm: { shadowColor: '#000', shadowOpacity: 0.1 } },
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown;

const mockMorningRoute = {
  key: 'CommuteTime',
  name: 'CommuteTime',
  params: {
    commuteType: 'morning' as const,
    onTimeSet: jest.fn(),
    initialTime: undefined,
    morningRoute: undefined,
  },
};

const mockEveningRoute = {
  key: 'CommuteTime',
  name: 'CommuteTime',
  params: {
    commuteType: 'evening' as const,
    onTimeSet: jest.fn(),
    initialTime: '18:30',
    morningRoute: {
      departureTime: '08:30',
      departureStation: { stationId: 's1', stationName: '강남', lineId: '2', lineName: '2호선' },
      arrivalStation: { stationId: 's2', stationName: '시청', lineId: '1', lineName: '1호선' },
      transferStations: [],
    },
  },
};

describe('CommuteTimeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOnboardingCallbacks as jest.Mock).mockReturnValue({
      onComplete: jest.fn(),
      onSkip: jest.fn(),
    });
  });

  it('renders morning commute title and subtitle', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    expect(getByText('출근 시간 설정')).toBeTruthy();
    expect(getByText('평일 출근하는 시간을 알려주세요')).toBeTruthy();
  });

  it('renders evening commute title and subtitle', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockEveningRoute as never}
      />
    );

    expect(getByText('퇴근 시간 설정')).toBeTruthy();
    expect(getByText('평일 퇴근하는 시간을 알려주세요')).toBeTruthy();
  });

  it('renders the next button', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    expect(getByText('다음')).toBeTruthy();
  });

  it('shows skip button only in morning mode', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    expect(getByText('나중에 설정')).toBeTruthy();
  });

  it('does not show skip button in evening mode', () => {
    const { queryByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockEveningRoute as never}
      />
    );

    expect(queryByText('나중에 설정')).toBeNull();
  });

  it('renders info text about notification timing', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    expect(getByText(/설정한 시간 기준으로 출발 알림을 보내드립니다/)).toBeTruthy();
  });

  it('renders time picker with morning label', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    expect(getByText('출근 시간')).toBeTruthy();
  });

  it('renders time picker with evening label', () => {
    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockEveningRoute as never}
      />
    );

    expect(getByText('퇴근 시간')).toBeTruthy();
  });

  it('calls onTimeSet and navigates on next button press', () => {
    const mockOnTimeSet = jest.fn();
    const routeWithCallback = {
      ...mockMorningRoute,
      params: {
        ...mockMorningRoute.params,
        onTimeSet: mockOnTimeSet,
      },
    };

    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={routeWithCallback as never}
      />
    );

    fireEvent.press(getByText('다음'));

    expect(mockOnTimeSet).toHaveBeenCalledWith('08:00');
    expect(mockNavigate).toHaveBeenCalledWith('CommuteRoute', expect.objectContaining({
      commuteType: 'morning',
      departureTime: '08:00',
    }));
  });

  it('calls onSkip when skip button is pressed', () => {
    const mockOnSkip = jest.fn();
    (useOnboardingCallbacks as jest.Mock).mockReturnValueOnce({
      onComplete: jest.fn(),
      onSkip: mockOnSkip,
    });

    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );

    fireEvent.press(getByText('나중에 설정'));

    expect(mockOnSkip).toHaveBeenCalled();
  });

  it('uses initialTime when provided', () => {
    const routeWithInitialTime = {
      ...mockMorningRoute,
      params: {
        ...mockMorningRoute.params,
        initialTime: '09:30',
      },
    };

    const { getByText } = render(
      <CommuteTimeScreen
        navigation={mockNavigation as never}
        route={routeWithInitialTime as never}
      />
    );

    // The time picker mock renders the value text
    expect(getByText('09:30')).toBeTruthy();
  });
});
