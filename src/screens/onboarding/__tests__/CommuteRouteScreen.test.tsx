/**
 * CommuteRouteScreen Test Suite — Wanted handoff redesign.
 *
 * Validates the redesigned step 2/4: stacked station card with departure/
 * arrival rows, transfer recommendation list (radio), and footer summary.
 * The legacy "이전" button + transfer-add modal pattern was retired.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteRouteScreen } from '../CommuteRouteScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  ArrowRight: 'ArrowRight',
  Building2: 'Building2',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Home: 'Home',
  Repeat: 'Repeat',
  Search: 'Search',
  Zap: 'Zap',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

// OnbHeader imports useTheme from the themeContext path directly — mocking
// only the index alias above would still bubble up ThemeProvider errors.
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

// LineBadge is exercised heavily by other tests; for this screen we just
// stub it so the recommendation list renders without pulling the real
// design-system barrel (atom cascade trap — see feedback memory).
jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

const mockOnSkip = jest.fn();
jest.mock('@/navigation/OnboardingNavigator', () => ({
  // CommuteRouteScreen now uses the optional variant so it can also host
  // the in-settings EditCommuteRoute flow (no provider). Tests live in
  // onboarding context, so both variants resolve the same callbacks.
  // Use implementation callbacks (not factory-time literals) so the
  // closure captures `mockOnSkip` after its TDZ resolves.
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
  useOnboardingCallbacksOptional: jest.fn(() => ({
    onComplete: jest.fn(),
    onSkip: mockOnSkip,
  })),
}));

// Phase: edit-mode-in-settings — CommuteRouteScreen now also hosts the
// SettingsStack.EditCommuteRoute route and calls useAuth() so save can
// target the current user. Onboarding tests don't exercise save, but the
// hook still runs on mount so it needs a stub provider.
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'test-uid' } })),
}));

// Same reason: the edit-mode save path calls saveCommuteRoutes. Onboarding
// tests never trigger it, but the module is imported at file scope.
jest.mock('@/services/commute/commuteService', () => ({
  saveCommuteRoutes: jest.fn(),
}));

// Keep the model module live so DEFAULT_COMMUTE_NOTIFICATIONS / TransferStation
// type-check at compile time. Importing for real is fine — it has no native deps.

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
  setParams: mockSetParams,
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
  mockSetParams.mockClear();
  mockCanGoBack.mockClear();
  mockCanGoBack.mockReturnValue(true);
  mockOnSkip.mockClear();
});

describe('CommuteRouteScreen (step 2/4 redesign)', () => {
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

  it('renders Wanted handoff eyebrow + 2-line title', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('commute-eyebrow').props.children).toContain('STEP 2');
    expect(getByTestId('commute-title').props.children).toContain('어디서 어디까지');
  });

  it('shows departure + arrival station rows with placeholders', () => {
    const { getByText, getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    expect(getByTestId('station-row-departure')).toBeTruthy();
    expect(getByTestId('station-row-arrival')).toBeTruthy();
    expect(getByText('출발역')).toBeTruthy();
    expect(getByText('도착역')).toBeTruthy();
    expect(getByText('출발역을 검색하세요')).toBeTruthy();
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

  it('does not navigate forward while stations are unselected (CTA disabled)', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('commute-next'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the OnboardingStationPicker when a station row is pressed', () => {
    const { getByTestId } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />,
    );
    fireEvent.press(getByTestId('station-row-departure'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'OnboardingStationPicker',
      expect.objectContaining({ selectionType: 'departure' }),
    );
  });
});
