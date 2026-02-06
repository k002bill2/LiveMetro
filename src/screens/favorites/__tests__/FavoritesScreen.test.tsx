/**
 * FavoritesScreen Test Suite
 * Tests favorites screen rendering and favorite management
 */

// Mock modules BEFORE imports (Jest hoisting)
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
  };
});
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
    },
    isAuthenticated: true,
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
jest.mock('@/components/favorites/FavoritesSearchBar', () => ({
  FavoritesSearchBar: () => null,
}));
jest.mock('@/components/favorites/DraggableFavoriteItem', () => ({
  DraggableFavoriteItem: () => null,
}));
jest.mock('@/components/commute/StationSearchModal', () => ({
  StationSearchModal: () => null,
}));

describe('FavoritesScreen', () => {
  const mockRemoveFavorite = jest.fn();
  const mockUpdateFavorite = jest.fn();
  const mockAddFavorite = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFavorites as jest.Mock).mockReturnValue({
      favoritesWithDetails: [],
      loading: false,
      error: null,
      removeFavorite: mockRemoveFavorite,
      updateFavorite: mockUpdateFavorite,
      addFavorite: mockAddFavorite,
      refresh: mockRefresh,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<FavoritesScreen />);
    expect(getByText('즐겨찾기')).toBeTruthy();
  });

  it('displays header with title and count', () => {
    const { getByText } = render(<FavoritesScreen />);
    expect(getByText('즐겨찾기')).toBeTruthy();
    expect(getByText('0개의 역')).toBeTruthy();
  });

  it('shows empty state when no favorites', () => {
    const { getByText } = render(<FavoritesScreen />);
    expect(getByText('즐겨찾기가 없습니다')).toBeTruthy();
    expect(getByText('자주 이용하는 역을 즐겨찾기에 추가해보세요')).toBeTruthy();
  });

  it('displays favorites count when favorites exist', () => {
    (useFavorites as jest.Mock).mockReturnValue({
      favoritesWithDetails: [
        {
          id: 'fav1',
          stationId: 'station1',
          lineId: '2',
          direction: 'both',
          isCommuteStation: false,
          station: {
            id: 'station1',
            name: '강남',
            nameEn: 'Gangnam',
            lineId: '2',
            coordinates: { latitude: 0, longitude: 0 },
            transfers: [],
          },
        },
      ],
      loading: false,
      error: null,
      removeFavorite: mockRemoveFavorite,
      updateFavorite: mockUpdateFavorite,
      addFavorite: mockAddFavorite,
      refresh: mockRefresh,
    });

    const { getByText } = render(<FavoritesScreen />);
    expect(getByText('1개의 역')).toBeTruthy();
  });

  it('shows loading state', () => {
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

  it('shows error state', () => {
    (useFavorites as jest.Mock).mockReturnValue({
      favoritesWithDetails: [],
      loading: false,
      error: '즐겨찾기를 불러오는데 실패했습니다',
      removeFavorite: mockRemoveFavorite,
      updateFavorite: mockUpdateFavorite,
      addFavorite: mockAddFavorite,
      refresh: mockRefresh,
    });

    const { getByText } = render(<FavoritesScreen />);
    expect(getByText('즐겨찾기를 불러오는데 실패했습니다')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('handles retry on error', () => {
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
});
