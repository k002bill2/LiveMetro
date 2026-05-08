/**
 * WelcomeOnboardingScreen — RTL smoke tests covering value-prop render +
 * "시작하기" CTA navigation.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WelcomeOnboardingScreen } from '../WelcomeOnboardingScreen';

const mockNavigate = jest.fn();

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  BellRing: 'BellRing',
  ChevronLeft: 'ChevronLeft',
  MapPin: 'MapPin',
  ShieldCheck: 'ShieldCheck',
  Sparkles: 'Sparkles',
}));

const baseNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  canGoBack: jest.fn(() => false),
} as unknown as React.ComponentProps<typeof WelcomeOnboardingScreen>['navigation'];

const baseRoute = {
  key: 'welcome',
  name: 'WelcomeOnboarding',
  params: undefined,
} as unknown as React.ComponentProps<typeof WelcomeOnboardingScreen>['route'];

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('WelcomeOnboardingScreen', () => {
  it('renders the brand hero, title, subtitle, and 3 value-prop cards', () => {
    const { getByTestId } = render(
      <WelcomeOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    expect(getByTestId('welcome-onboarding')).toBeTruthy();
    expect(getByTestId('welcome-hero')).toBeTruthy();
    expect(getByTestId('welcome-title')).toBeTruthy();
    expect(getByTestId('welcome-card-nearby')).toBeTruthy();
    expect(getByTestId('welcome-card-ml')).toBeTruthy();
    expect(getByTestId('welcome-card-alerts')).toBeTruthy();
  });

  it('navigates to CommuteRoute when "시작하기" is pressed', () => {
    const { getByTestId } = render(
      <WelcomeOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('welcome-cta'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toBe('CommuteRoute');
  });
});
