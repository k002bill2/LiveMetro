/**
 * FavoritesOnboardingScreen — RTL smoke tests covering the recommendation
 * pre-selection, CTA gating, and the save → addFavorite → onComplete chain.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FavoritesOnboardingScreen } from '../FavoritesOnboardingScreen';

const mockGoBack = jest.fn();
const mockOnComplete = jest.fn(() => Promise.resolve());
const mockOnSkip = jest.fn();
const mockSaveCommuteRoutes = jest.fn();
const mockAddFavorite = jest.fn();

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  ChevronLeft: 'ChevronLeft',
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'uid-1' } })),
}));

jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: mockOnComplete,
    onSkip: mockOnSkip,
  })),
}));

jest.mock('@/services/commute/commuteService', () => ({
  saveCommuteRoutes: (...args: unknown[]) => mockSaveCommuteRoutes(...args),
}));

jest.mock('@/services/favorites/favoritesService', () => ({
  favoritesService: {
    addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  },
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

const baseRouteData = {
  departureTime: '08:00',
  departureStation: { stationId: 'stn-dep', stationName: '서울역', lineId: '1', lineName: '1호선' },
  arrivalStation: { stationId: 'stn-arr', stationName: '강남', lineId: '2', lineName: '2호선' },
  transferStations: [],
};

const baseNotifications = {
  transferAlert: true,
  arrivalAlert: false,
  delayAlert: true,
  incidentAlert: true,
  alertMinutesBefore: 5,
};

const baseNavigation = {
  navigate: jest.fn(),
  goBack: mockGoBack,
  canGoBack: jest.fn(() => true),
} as unknown as React.ComponentProps<typeof FavoritesOnboardingScreen>['navigation'];

const baseRoute = {
  key: 'fav',
  name: 'FavoritesOnboarding',
  params: {
    route: baseRouteData,
    notificationGranted: true,
    notifications: baseNotifications,
  },
} as unknown as React.ComponentProps<typeof FavoritesOnboardingScreen>['route'];

beforeEach(() => {
  mockGoBack.mockClear();
  mockOnComplete.mockClear();
  mockOnSkip.mockClear();
  mockSaveCommuteRoutes.mockReset();
  mockAddFavorite.mockReset();
});

describe('FavoritesOnboardingScreen (step 4/4)', () => {
  it('pre-selects departure + arrival stations from the route param', () => {
    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    const dep = getByTestId('favorite-row-stn-dep');
    const arr = getByTestId('favorite-row-stn-arr');
    expect(dep.props.accessibilityState.checked).toBe(true);
    expect(arr.props.accessibilityState.checked).toBe(true);
  });

  it('shows the recommendation list including unrelated picks', () => {
    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    expect(getByTestId('favorite-row-stn-hongik')).toBeTruthy();
    expect(getByTestId('favorite-row-stn-jamsil')).toBeTruthy();
  });

  it('toggles selection on row press', () => {
    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    const dep = getByTestId('favorite-row-stn-dep');
    expect(dep.props.accessibilityState.checked).toBe(true);
    fireEvent.press(dep);
    expect(dep.props.accessibilityState.checked).toBe(false);
  });

  it('CTA disabled when zero stations selected; enabled with at least one', () => {
    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    // Deselect both pre-selected
    fireEvent.press(getByTestId('favorite-row-stn-dep'));
    fireEvent.press(getByTestId('favorite-row-stn-arr'));
    const cta = getByTestId('favorites-cta');
    expect(cta.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('favorite-row-stn-hongik'));
    expect(cta.props.accessibilityState?.disabled).toBe(false);
  });

  it('"완료" runs save → addFavorite (per selected) → onComplete', async () => {
    mockSaveCommuteRoutes.mockResolvedValue({ success: true });
    mockAddFavorite.mockResolvedValue({ id: 'fav-1' });

    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('favorites-cta'));

    await waitFor(() => {
      expect(mockSaveCommuteRoutes).toHaveBeenCalledTimes(1);
      // 2 pre-selected stations → 2 addFavorite calls
      expect(mockAddFavorite).toHaveBeenCalledTimes(2);
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onComplete when saveCommuteRoutes returns success=false', async () => {
    mockSaveCommuteRoutes.mockResolvedValue({ success: false, error: 'rules' });

    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('favorites-cta'));

    await waitFor(() => {
      expect(mockSaveCommuteRoutes).toHaveBeenCalledTimes(1);
    });
    expect(mockAddFavorite).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});
