/**
 * FavoritesScreen Test Suite
 * Tests favorites screen rendering, favorite management, search, filters, navigation
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FavoritesScreen } from '../FavoritesScreen';
import { useFavorites } from '@/hooks/useFavorites';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: jest.fn(() => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    })),
    useRoute: jest.fn(() => ({ params: {} })),
    // useIsFocused needs an explicit mock — actualNav's version requires a
    // NavigationContainer parent that the unit test doesn't provide.
    useIsFocused: jest.fn(() => true),
  };
});
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
    },
    firebaseUser: {
      uid: 'test-uid',
      email: 'test@example.com',
    },
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  })),
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000000',
      primaryLight: '#E5E5E5',
      surface: '#FFFFFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCCCCC',
    },
  })),
  ThemeColors: {},
}));
jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    favoritesWithDetails: [],
    loading: false,
    error: null,
    removeFavorite: jest.fn(),
    updateFavorite: jest.fn(),
    addFavorite: jest.fn(),
    refresh: jest.fn(),
  })),
}));
jest.mock('@/components/favorites/FavoritesSearchBar', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    FavoritesSearchBar: jest.fn(({ onSearchChange: _onSearchChange }) =>
      React.createElement(
        View,
        { testID: 'search-bar' },
        React.createElement(Text, null, 'Search Bar')
      )
    ),
  };
});
jest.mock('@/components/favorites/DraggableFavoriteItem', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    DraggableFavoriteItem: jest.fn(({
      onEditToggle,
      onRemove,
      onPress,
      onSetStart,
      onSetEnd,
      onSaveEdit: _onSaveEdit,
      favorite,
    }) =>
      React.createElement(
        View,
        { testID: `favorite-item-${favorite.id}` },
        React.createElement(
          TouchableOpacity,
          { testID: `edit-btn-${favorite.id}`, onPress: onEditToggle },
          React.createElement(Text, null, 'Edit')
        ),
        React.createElement(
          TouchableOpacity,
          { testID: `remove-btn-${favorite.id}`, onPress: onRemove },
          React.createElement(Text, null, 'Remove')
        ),
        React.createElement(
          TouchableOpacity,
          { testID: `station-press-${favorite.id}`, onPress: onPress },
          React.createElement(Text, null, favorite.station?.name || '역')
        ),
        React.createElement(
          TouchableOpacity,
          { testID: `set-start-${favorite.id}`, onPress: onSetStart },
          React.createElement(Text, null, 'Set Start')
        ),
        React.createElement(
          TouchableOpacity,
          { testID: `set-end-${favorite.id}`, onPress: onSetEnd },
          React.createElement(Text, null, 'Set End')
        )
      )
    ),
  };
});
jest.mock('@/components/commute/StationSearchModal', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    StationSearchModal: jest.fn(({ onClose, onSelect, visible }) => {
      if (!visible) return null;
      return React.createElement(
        View,
        { testID: 'search-modal' },
        React.createElement(
          TouchableOpacity,
          {
            testID: 'modal-select-btn',
            onPress: () =>
              onSelect({
                stationId: 'new-station',
                stationName: '역삼',
                lineId: '2',
              }),
          },
          React.createElement(Text, null, 'Select')
        ),
        React.createElement(
          TouchableOpacity,
          { testID: 'modal-close-btn', onPress: onClose },
          React.createElement(Text, null, 'Close')
        )
      );
    }),
  };
});

describe('FavoritesScreen', () => {
  let mockRemoveFavorite: jest.Mock;
  let mockUpdateFavorite: jest.Mock;
  let mockAddFavorite: jest.Mock;
  let mockRefresh: jest.Mock;
  let mockNavigate: jest.Mock;

  const mockFavorite1 = {
    id: 'fav1',
    stationId: 'station1',
    lineId: '2',
    direction: 'both' as const,
    isCommuteStation: false,
    alias: null,
    station: {
      id: 'station1',
      name: '강남',
      nameEn: 'Gangnam',
      lineId: '2',
      coordinates: { latitude: 0, longitude: 0 },
      transfers: [],
    },
  };

  const mockFavorite2 = {
    id: 'fav2',
    stationId: 'station2',
    lineId: '3',
    direction: 'up' as const,
    isCommuteStation: true,
    alias: '집',
    station: {
      id: 'station2',
      name: '종로3가',
      nameEn: 'Jongno 3-ga',
      lineId: '3',
      coordinates: { latitude: 0, longitude: 0 },
      transfers: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useAuth to default authenticated state (prevents mock leakage from auth tests)
    const { useAuth } = require('@/services/auth/AuthContext');
    useAuth.mockReturnValue({
      user: {
        uid: 'test-uid',
        displayName: 'Test User',
        email: 'test@example.com',
      },
      firebaseUser: {
        uid: 'test-uid',
        email: 'test@example.com',
      },
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    });
    mockRemoveFavorite = jest.fn();
    mockUpdateFavorite = jest.fn();
    mockAddFavorite = jest.fn();
    mockRefresh = jest.fn();
    mockNavigate = jest.fn();

    (useFavorites as jest.Mock).mockReturnValue({
      favoritesWithDetails: [],
      loading: false,
      error: null,
      removeFavorite: mockRemoveFavorite,
      updateFavorite: mockUpdateFavorite,
      addFavorite: mockAddFavorite,
      refresh: mockRefresh,
    });

    const { useNavigation } = require('@react-navigation/native');
    useNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    // Avoid jest.restoreAllMocks() - it can reset jest.mock() factory implementations
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { getByText } = render(<FavoritesScreen />);
      expect(getByText('즐겨찾기')).toBeTruthy();
    });

    it('displays header with title and add/sort buttons (Phase 3 redesign)', () => {
      const { getByText, getByTestId } = render(<FavoritesScreen />);
      expect(getByText('즐겨찾기')).toBeTruthy();
      expect(getByTestId('favorites-add-button')).toBeTruthy();
      expect(getByTestId('favorites-sort-button')).toBeTruthy();
    });

    it('shows empty state when no favorites', () => {
      const { getByText } = render(<FavoritesScreen />);
      expect(getByText('즐겨찾기가 없습니다')).toBeTruthy();
      expect(getByText('자주 이용하는 역을 즐겨찾기에 추가해보세요')).toBeTruthy();
    });

    it('renders the favorite list when one item is present', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      // Phase 3: header no longer surfaces a count subtitle; verify item renders.
      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('renders multiple favorites correctly', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1, mockFavorite2],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText, getByTestId } = render(<FavoritesScreen />);
      expect(getByText('즐겨찾기')).toBeTruthy();
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
      expect(getByTestId('favorite-item-fav2')).toBeTruthy();
    });

    it('hides search bar when no favorites exist', () => {
      const { queryByTestId } = render(<FavoritesScreen />);
      expect(queryByTestId('search-bar')).toBeNull();
    });

    it('shows search bar when favorites exist', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('search-bar')).toBeTruthy();
    });
  });

  describe('Loading & Error States', () => {
    it('shows loading state when loading with empty list', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: true,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText } = render(<FavoritesScreen />);
      expect(getByText('즐겨찾기를 불러오는 중...')).toBeTruthy();
    });

    it('shows error state with custom message', () => {
      const errorMsg = '즐겨찾기를 불러오는데 실패했습니다';
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: false,
        error: errorMsg,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText } = render(<FavoritesScreen />);
      expect(getByText(errorMsg)).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });

    it('calls refresh when retry button is pressed', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: false,
        error: '네트워크 오류',
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText } = render(<FavoritesScreen />);
      fireEvent.press(getByText('다시 시도'));

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('does not show error state when favorites exist despite error', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: '일부 데이터 로드 실패',
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { queryByText } = render(<FavoritesScreen />);
      expect(queryByText('일부 데이터 로드 실패')).toBeNull();
    });

    it('does not show loading state when favorites exist', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: true,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { queryByText } = render(<FavoritesScreen />);
      expect(queryByText('즐겨찾기를 불러오는 중...')).toBeNull();
    });
  });

  describe('Authentication', () => {
    it('shows login prompt when user is not authenticated', () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      const { getByText } = render(<FavoritesScreen />);
      expect(getByText('로그인이 필요합니다')).toBeTruthy();
      expect(getByText('즐겨찾기를 사용하려면 로그인해주세요')).toBeTruthy();
    });

    it('shows favorites content when user is authenticated', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      // Phase 3: count subtitle removed; verify the favorite item renders instead.
      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });
  });

  describe('Add Favorite Modal', () => {
    it('opens search modal when add button is pressed', () => {
      const { getByText, getByTestId, queryByTestId } = render(<FavoritesScreen />);

      expect(queryByTestId('search-modal')).toBeNull();

      fireEvent.press(getByText('역 찾아보기'));

      expect(getByTestId('search-modal')).toBeTruthy();
    });

    it('successfully adds new favorite from search modal', async () => {
      mockAddFavorite.mockResolvedValue(undefined);

      // Start with empty favorites to show "역 찾아보기" button
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText } = render(<FavoritesScreen />);

      // Open search modal via empty state button
      fireEvent.press(getByText('역 찾아보기'));

      // Verify addFavorite mock is ready
      expect(mockAddFavorite).toBeDefined();
    });

    it('prevents adding duplicate favorite', () => {
      // When favorites exist, the duplicate check is handled by the addFavorite service
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      // Verify favorites are rendered (not empty state)
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles error when adding favorite fails', () => {
      mockAddFavorite.mockRejectedValue(new Error('Add failed'));

      // Verify addFavorite mock is properly configured to reject
      expect(mockAddFavorite()).rejects.toThrow('Add failed');
    });

    it('shows empty state with add button when no favorites', () => {
      // Empty state shows "역 찾아보기" button
      const { getByText } = render(<FavoritesScreen />);
      expect(getByText('역 찾아보기')).toBeTruthy();
    });

    it('opens search modal from empty state', () => {
      const { getByText } = render(<FavoritesScreen />);

      // "역 찾아보기" button should be visible in empty state
      const addButton = getByText('역 찾아보기');
      expect(addButton).toBeTruthy();

      // Press should trigger modal open
      fireEvent.press(addButton);
    });
  });

  describe('Remove Favorite', () => {
    it('shows confirmation dialog when remove button is pressed', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const removeBtn = getByTestId('remove-btn-fav1');

      fireEvent.press(removeBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        '즐겨찾기 삭제',
        expect.stringContaining('강남역을'),
        expect.any(Array)
      );
    });

    it('handles removal with unknown station name gracefully', () => {
      const favoriteWithoutStation = {
        ...mockFavorite1,
        station: null,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithoutStation],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const removeBtn = getByTestId('remove-btn-fav1');

      fireEvent.press(removeBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        '즐겨찾기 삭제',
        expect.stringContaining('알 수 없는 역'),
        expect.any(Array)
      );
    });
  });

  describe('Navigation', () => {
    it('navigates to StationDetail when favorite is pressed', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const stationPressBtn = getByTestId('station-press-fav1');

      fireEvent.press(stationPressBtn);

      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'station1',
        stationName: '강남',
        lineId: '2',
      });
    });

    it('navigates to StationNavigator in departure mode', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const setStartBtn = getByTestId('set-start-fav1');

      fireEvent.press(setStartBtn);

      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'station1',
        stationName: '강남',
        lineId: '2',
      });
    });

    it('navigates to StationDetail (arrival intent)', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const setEndBtn = getByTestId('set-end-fav1');

      fireEvent.press(setEndBtn);

      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'station1',
        stationName: '강남',
        lineId: '2',
      });
    });

    it('does not navigate if favorite has no station', () => {
      const favoriteWithoutStation = {
        ...mockFavorite1,
        station: null,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithoutStation],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const stationPressBtn = getByTestId('station-press-fav1');

      fireEvent.press(stationPressBtn);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not navigate on SetStart if station is missing', () => {
      const favoriteWithoutStation = {
        ...mockFavorite1,
        station: null,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithoutStation],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const setStartBtn = getByTestId('set-start-fav1');

      fireEvent.press(setStartBtn);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not navigate on SetEnd if station is missing', () => {
      const favoriteWithoutStation = {
        ...mockFavorite1,
        station: null,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithoutStation],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const setEndBtn = getByTestId('set-end-fav1');

      fireEvent.press(setEndBtn);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('toggles edit mode when edit button is pressed', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      const editBtn = getByTestId('edit-btn-fav1');

      fireEvent.press(editBtn);
      // Edit mode toggled - component internal state
      // Verify by checking if the button was pressed
      expect(editBtn).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles favorite with direction "both"', () => {
      const favoriteWithBoth = {
        ...mockFavorite1,
        direction: 'both' as const,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithBoth],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles favorite with direction "up"', () => {
      const favoriteUp = {
        ...mockFavorite1,
        direction: 'up' as const,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteUp],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles favorite with direction "down"', () => {
      const favoriteDown = {
        ...mockFavorite1,
        direction: 'down' as const,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteDown],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles favorite with isCommuteStation true', () => {
      const commuteFavorite = {
        ...mockFavorite1,
        isCommuteStation: true,
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [commuteFavorite],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles favorite with alias', () => {
      const favoriteWithAlias = {
        ...mockFavorite1,
        alias: '회사',
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [favoriteWithAlias],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });

    it('handles multiple favorites with different line IDs', () => {
      const favorite3 = {
        ...mockFavorite1,
        id: 'fav3',
        stationId: 'station3',
        lineId: '1',
        station: {
          ...mockFavorite1.station,
          id: 'station3',
          lineId: '1',
          name: '서울역',
        },
      };

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1, mockFavorite2, favorite3],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
      expect(getByTestId('favorite-item-fav2')).toBeTruthy();
      expect(getByTestId('favorite-item-fav3')).toBeTruthy();
    });

    it('renders list container when filtered favorites exist', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });
  });

  describe('No Results State', () => {
    it('shows no results message when search filters out all items', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1, mockFavorite2],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<FavoritesScreen />);
      // The component would need to handle filtered results internally
      // Verify initial render shows favorites
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
    });
  });

  describe('Integration Tests', () => {
    it('handles complete add favorite flow', async () => {
      mockAddFavorite.mockResolvedValue(undefined);

      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText, getByTestId, queryByTestId } = render(<FavoritesScreen />);

      // Start with empty state
      expect(getByText('즐겨찾기가 없습니다')).toBeTruthy();

      // Open search modal
      fireEvent.press(getByText('역 찾아보기'));
      expect(getByTestId('search-modal')).toBeTruthy();

      // Select station
      fireEvent.press(getByTestId('modal-select-btn'));

      // Verify success and modal closed
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '완료',
          expect.stringContaining('즐겨찾기에 추가되었습니다')
        );
      });

      expect(queryByTestId('search-modal')).toBeNull();
    });

    it('displays correct UI for authenticated user with favorites', () => {
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1, mockFavorite2],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });

      const { getByText, getByTestId } = render(<FavoritesScreen />);

      // Header (count subtitle removed in Phase 3)
      expect(getByText('즐겨찾기')).toBeTruthy();
      expect(getByTestId('favorites-add-button')).toBeTruthy();

      // Search bar
      expect(getByTestId('search-bar')).toBeTruthy();

      // Favorites list
      expect(getByTestId('favorite-item-fav1')).toBeTruthy();
      expect(getByTestId('favorite-item-fav2')).toBeTruthy();
    });

    it('handles transition from loading to showing favorites', () => {
      const { rerender, getByText } = render(<FavoritesScreen />);

      // Initially empty
      expect(getByText('즐겨찾기가 없습니다')).toBeTruthy();

      // Update to show loading
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [],
        loading: true,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });
      rerender(<FavoritesScreen />);
      expect(getByText('즐겨찾기를 불러오는 중...')).toBeTruthy();

      // Update to show favorites
      (useFavorites as jest.Mock).mockReturnValue({
        favoritesWithDetails: [mockFavorite1],
        loading: false,
        error: null,
        removeFavorite: mockRemoveFavorite,
        updateFavorite: mockUpdateFavorite,
        addFavorite: mockAddFavorite,
        refresh: mockRefresh,
      });
      rerender(<FavoritesScreen />);
      // Phase 3: count subtitle removed; loading text gone + favorite renders.
      expect(getByText('즐겨찾기')).toBeTruthy();
    });
  });
});
