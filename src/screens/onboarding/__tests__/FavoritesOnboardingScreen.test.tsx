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
const mockContextAddFavorite = jest.fn();

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  ChevronLeft: 'ChevronLeft',
  Star: 'Star',
  Check: 'Check',
  ArrowRight: 'ArrowRight',
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

// Favorites writes must go through FavoritesContext (app-wide SSOT) — a
// direct favoritesService call would leave the context state stale until
// the next context mutation (the "favorites invisible until next add" bug).
jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({
    addFavorite: (...args: unknown[]) => mockContextAddFavorite(...args),
  }),
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

// Full-DB station search is delegated to the app-wide StationSearchModal
// (the same component the post-signup Favorites screen uses). Mock it with
// two select buttons so we can drive both branches of the onboarding
// onSelect handler without loading the real station dataset:
//  - 신논현 (0925): a brand-new station not already in the list
//  - 강남 (0222): collides BY NAME with the pre-selected route arrival
//    station (stn-arr / 강남) — exercises the name-based duplicate guard.
jest.mock('@/components/commute/StationSearchModal', () => ({
  StationSearchModal: ({ visible, onSelect }: { visible: boolean; onSelect: (s: unknown) => void }) => {
    const ReactLocal = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return ReactLocal.createElement(
      View,
      { testID: 'mock-station-search-modal' },
      ReactLocal.createElement(
        TouchableOpacity,
        {
          testID: 'mock-select-new',
          onPress: () =>
            onSelect({ stationId: '0925', stationName: '신논현', lineId: '신분당선', lineName: '신분당선' }),
        },
        ReactLocal.createElement(Text, null, '신논현 선택'),
      ),
      ReactLocal.createElement(
        TouchableOpacity,
        {
          testID: 'mock-select-dup',
          onPress: () => onSelect({ stationId: '0222', stationName: '강남', lineId: '2', lineName: '2호선' }),
        },
        ReactLocal.createElement(Text, null, '강남 선택'),
      ),
      ReactLocal.createElement(
        TouchableOpacity,
        {
          testID: 'mock-select-rec',
          // 사당 (station_cd 0433) — name collides with the UNSELECTED
          // recommendation 사당 (slug stn-sadang), which the modal does not
          // exclude (slug ≠ station_cd). Picking it must select the existing
          // recommendation row, not silently drop the pick.
          onPress: () => onSelect({ stationId: '0433', stationName: '사당', lineId: '4', lineName: '4호선' }),
        },
        ReactLocal.createElement(Text, null, '사당 선택'),
      ),
    );
  },
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
  mockContextAddFavorite.mockReset();
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

  it('"완료" runs save → context addFavorite (per selected) → onComplete', async () => {
    mockSaveCommuteRoutes.mockResolvedValue({ success: true });
    mockContextAddFavorite.mockResolvedValue(undefined);

    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('favorites-cta'));

    await waitFor(() => {
      expect(mockSaveCommuteRoutes).toHaveBeenCalledTimes(1);
      // 2 pre-selected stations → 2 context addFavorite calls
      expect(mockContextAddFavorite).toHaveBeenCalledTimes(2);
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    // Route stations are commute stations — flag must flow through the
    // context options (Station object, options) signature.
    expect(mockContextAddFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stn-dep', name: '서울역' }),
      { isCommuteStation: true },
    );
    expect(mockContextAddFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stn-arr', name: '강남' }),
      { isCommuteStation: true },
    );
  });

  it('still calls onComplete when a favorite add fails (partial favorites are recoverable)', async () => {
    mockSaveCommuteRoutes.mockResolvedValue({ success: true });
    mockContextAddFavorite
      .mockRejectedValueOnce(new Error('firestore unavailable'))
      .mockResolvedValueOnce(undefined);

    const { getByTestId } = render(
      <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
    );
    fireEvent.press(getByTestId('favorites-cta'));

    await waitFor(() => {
      expect(mockContextAddFavorite).toHaveBeenCalledTimes(2);
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
    expect(mockContextAddFavorite).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  describe('full station search', () => {
    it('search modal is hidden until the search bar is tapped', () => {
      const { queryByTestId, getByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      expect(queryByTestId('mock-station-search-modal')).toBeNull();
      fireEvent.press(getByTestId('favorites-search'));
      expect(getByTestId('mock-station-search-modal')).toBeTruthy();
    });

    it('adds a searched station to the list, pre-selected, and counts it', () => {
      const { getByTestId, queryByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      // No 신논현 row before searching.
      expect(queryByTestId('favorite-row-0925')).toBeNull();

      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-new'));

      // Modal closes, the searched station appears as a checked row, and the
      // selected count rises from 2 (dep+arr) to 3.
      expect(queryByTestId('mock-station-search-modal')).toBeNull();
      const newRow = getByTestId('favorite-row-0925');
      expect(newRow.props.accessibilityState.checked).toBe(true);
      expect(getByTestId('favorites-selected-count')).toHaveTextContent('3개 선택됨');
    });

    it('saves a searched station as a favorite on complete (station_cd id)', async () => {
      mockSaveCommuteRoutes.mockResolvedValue({ success: true });
      mockContextAddFavorite.mockResolvedValue(undefined);

      const { getByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-new'));
      fireEvent.press(getByTestId('favorites-cta'));

      await waitFor(() => {
        // 2 pre-selected route stations + 1 searched station.
        expect(mockContextAddFavorite).toHaveBeenCalledTimes(3);
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
      expect(mockContextAddFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ id: '0925', name: '신논현', lineId: '신분당선' }),
        { isCommuteStation: false },
      );
    });

    it('name-based duplicate guard: re-adding an already-listed station does not create a second row', async () => {
      mockSaveCommuteRoutes.mockResolvedValue({ success: true });
      mockContextAddFavorite.mockResolvedValue(undefined);

      const { getByTestId, queryByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      // 강남 is already present as the route arrival (stn-arr). Selecting the
      // search result 강남 (0222) must NOT add a separate 0222 row.
      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-dup'));

      expect(queryByTestId('favorite-row-0222')).toBeNull();
      expect(getByTestId('favorites-selected-count')).toHaveTextContent('2개 선택됨');

      fireEvent.press(getByTestId('favorites-cta'));
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
      // Still only the 2 route stations — no duplicate 강남.
      expect(mockContextAddFavorite).toHaveBeenCalledTimes(2);
    });

    it('picking a search result whose name matches an UNSELECTED recommendation selects that recommendation (no silent drop)', async () => {
      mockSaveCommuteRoutes.mockResolvedValue({ success: true });
      mockContextAddFavorite.mockResolvedValue(undefined);

      const { getByTestId, queryByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      // 사당 is a recommendation but NOT pre-selected.
      expect(getByTestId('favorite-row-stn-sadang').props.accessibilityState.checked).toBe(false);

      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-rec'));

      // The user's intent is honored: the existing 사당 recommendation row
      // becomes checked, the count rises to 3, and no duplicate 0433 row is
      // created.
      expect(getByTestId('favorite-row-stn-sadang').props.accessibilityState.checked).toBe(true);
      expect(queryByTestId('favorite-row-0433')).toBeNull();
      expect(getByTestId('favorites-selected-count')).toHaveTextContent('3개 선택됨');

      fireEvent.press(getByTestId('favorites-cta'));
      await waitFor(() => {
        expect(mockContextAddFavorite).toHaveBeenCalledTimes(3);
      });
      // The recommendation (slug id) is persisted — the pick was not dropped.
      expect(mockContextAddFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'stn-sadang', name: '사당' }),
        { isCommuteStation: false },
      );
    });

    it('re-picking a previously deselected search-added station re-selects it instead of dropping', () => {
      const { getByTestId } = render(
        <FavoritesOnboardingScreen navigation={baseNavigation} route={baseRoute} />,
      );
      // Add 신논현 via search → checked, count 3.
      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-new'));
      expect(getByTestId('favorite-row-0925').props.accessibilityState.checked).toBe(true);

      // Deselect it → still rendered, count back to 2.
      fireEvent.press(getByTestId('favorite-row-0925'));
      expect(getByTestId('favorite-row-0925').props.accessibilityState.checked).toBe(false);
      expect(getByTestId('favorites-selected-count')).toHaveTextContent('2개 선택됨');

      // Re-pick it via search → re-selected, no duplicate row, count 3 again.
      fireEvent.press(getByTestId('favorites-search'));
      fireEvent.press(getByTestId('mock-select-new'));
      expect(getByTestId('favorite-row-0925').props.accessibilityState.checked).toBe(true);
      expect(getByTestId('favorites-selected-count')).toHaveTextContent('3개 선택됨');
    });
  });
});
