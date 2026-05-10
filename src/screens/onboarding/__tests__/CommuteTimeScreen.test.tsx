/**
 * CommuteTimeScreen — RTL smoke tests covering the chip-based time
 * picker and the forward navigation contract.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CommuteTimeScreen } from '../CommuteTimeScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOnSkip = jest.fn();

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  ArrowRight: 'ArrowRight',
  ChevronLeft: 'ChevronLeft',
}));

jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
}));

const baseRouteData = {
  departureTime: '08:00',
  departureStation: { stationId: 'stn-1', stationName: '강남', lineId: '2', lineName: '2호선' },
  arrivalStation: { stationId: 'stn-2', stationName: '시청', lineId: '1', lineName: '1호선' },
  transferStations: [],
};

const baseNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: jest.fn(() => true),
} as unknown as React.ComponentProps<typeof CommuteTimeScreen>['navigation'];

const baseRoute = {
  key: 'time',
  name: 'CommuteTime',
  params: { route: baseRouteData },
} as unknown as React.ComponentProps<typeof CommuteTimeScreen>['route'];

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockOnSkip.mockClear();
});

describe('CommuteTimeScreen (step 3/5)', () => {
  it('renders the OnbHeader, eyebrow, title and both time pickers', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    expect(getByTestId('commute-time')).toBeTruthy();
    expect(getByTestId('onb-header')).toBeTruthy();
    expect(getByTestId('commute-time-eyebrow').props.children).toContain('STEP 3');
    expect(getByTestId('commute-time-title').props.children).toContain('출근 시간');
    expect(getByTestId('commute-time-picker')).toBeTruthy();
    expect(getByTestId('commute-time-picker-evening')).toBeTruthy();
  });

  it('initializes with the departureTime from route params', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    expect(getByTestId('commute-time-picker-hh').props.children).toBe('08');
    expect(getByTestId('commute-time-picker-mm').props.children).toBe('00');
  });

  it('updates display when a chip is pressed', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('commute-time-picker-chip-09:00'));
    expect(getByTestId('commute-time-picker-hh').props.children).toBe('09');
    expect(getByTestId('commute-time-picker-mm').props.children).toBe('00');
  });

  it('forwards updated morning + evening times to NotificationPermission on CTA', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('commute-time-picker-chip-09:30'));
    fireEvent.press(getByTestId('commute-time-picker-evening-chip-19:00'));
    fireEvent.press(getByTestId('commute-time-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('NotificationPermission', {
      route: expect.objectContaining({
        departureTime: '09:30',
        eveningDepartureTime: '19:00',
        departureStation: baseRouteData.departureStation,
        arrivalStation: baseRouteData.arrivalStation,
      }),
    });
  });

  it('falls back to default evening time (18:30) when route param omits it', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    // baseRouteData has no eveningDepartureTime → component should default
    expect(getByTestId('commute-time-picker-evening-hh').props.children).toBe('18');
    expect(getByTestId('commute-time-picker-evening-mm').props.children).toBe('30');
  });

  it('OnbHeader skip link fires onSkip from OnboardingNavigator context', () => {
    const { getByTestId } = render(
      <CommuteTimeScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('onb-header-skip'));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });
});
