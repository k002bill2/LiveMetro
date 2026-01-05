/**
 * useFavorites Hook Tests
 * Tests for managing user's favorite stations
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFavorites } from '../useFavorites';
import { favoritesService } from '../../services/favorites/favoritesService';
import { trainService } from '../../services/train/trainService';
import { useAuth } from '../../services/auth/AuthContext';
import { FavoriteStation } from '../../models/user';
import { Station } from '../../models/train';

// Mock dependencies
jest.mock('../../services/favorites/favoritesService');
jest.mock('../../services/train/trainService');
jest.mock('../../services/auth/AuthContext');

const mockFavoritesService = favoritesService as jest.Mocked<typeof favoritesService>;
const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = { id: 'user-123', email: 'test@test.com' };

const createMockStation = (id: string, name: string): Station => ({
  id,
  name,
  nameEn: `${name} Station`,
  lineId: '2',
  lineName: '2호선',
  lineColor: '#00A86B',
  coordinates: { latitude: 37.5, longitude: 127.0 },
  transfers: [],
  address: `${name} 주소`,
  facilities: [],
});

const createMockFavorite = (id: string, stationId: string, stationName: string): FavoriteStation => ({
  id,
  stationId,
  stationName,
  lineId: '2',
  lineName: '2호선',
  order: 0,
  isCommuteStation: false,
  createdAt: new Date(),
});

describe('useFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      firebaseUser: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn(),
      resetPassword: jest.fn(),
    } as any);
    mockFavoritesService.getFavorites.mockResolvedValue([]);
    mockTrainService.getStation.mockResolvedValue(createMockStation('station-1', '강남역'));
  });

  describe('Without User', () => {
    it('should return empty favorites when no user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
    });

    it('should not call service methods when no user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      renderHook(() => useFavorites());

      expect(mockFavoritesService.getFavorites).not.toHaveBeenCalled();
    });
  });

  describe('Load Favorites', () => {
    it('should load favorites on mount', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1', '강남역')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(mockUser.id);
      expect(result.current.favorites).toEqual(mockFavorites);
    });

    it('should load station details for each favorite', async () => {
      const mockFavorites = [
        createMockFavorite('fav-1', 'station-1', '강남역'),
        createMockFavorite('fav-2', 'station-2', '역삼역'),
      ];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockTrainService.getStation).toHaveBeenCalledTimes(2);
    });

    it('should handle station load errors gracefully', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1', '강남역')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockTrainService.getStation.mockRejectedValue(new Error('Station not found'));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still have the favorite, just with null station
      expect(result.current.favoritesWithDetails[0]?.station).toBeNull();
    });

    it('should handle load favorites error', async () => {
      mockFavoritesService.getFavorites.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('즐겨찾기를 불러올 수 없습니다.');
    });
  });

  describe('Add Favorite', () => {
    it('addFavorite should call service with correct params', async () => {
      const station = createMockStation('station-1', '강남역');
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addFavorite(station, { alias: '출근역' });
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledWith({
        userId: mockUser.id,
        station,
        alias: '출근역',
        direction: undefined,
        isCommuteStation: undefined,
      });
    });

    it('addFavorite should reload favorites after', async () => {
      const station = createMockStation('station-1', '강남역');
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.addFavorite(station);
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalled();
    });

    it('addFavorite should throw without user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      const station = createMockStation('station-1', '강남역');
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.addFavorite(station);
        })
      ).rejects.toThrow('로그인이 필요합니다.');
    });
  });

  describe('Remove Favorite', () => {
    it('removeFavorite should call service', async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFavorite('fav-1');
      });

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(mockUser.id, 'fav-1');
    });

    it('removeFavoriteByStationId should find and remove', async () => {
      const mockFavorite = createMockFavorite('fav-1', 'station-1', '강남역');
      mockFavoritesService.getFavoriteByStationId.mockResolvedValue(mockFavorite);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFavoriteByStationId('station-1');
      });

      expect(mockFavoritesService.getFavoriteByStationId).toHaveBeenCalledWith(mockUser.id, 'station-1');
      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(mockUser.id, 'fav-1');
    });
  });

  describe('Update Favorite', () => {
    it('updateFavorite should call service with updates', async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateFavorite('fav-1', { alias: '새별칭' });
      });

      expect(mockFavoritesService.updateFavorite).toHaveBeenCalledWith({
        userId: mockUser.id,
        favoriteId: 'fav-1',
        alias: '새별칭',
      });
    });

    it('updateFavorite should reload after', async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.updateFavorite('fav-1', { isCommuteStation: true });
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalled();
    });
  });

  describe('Toggle and Check', () => {
    it('isFavorite should return true for favorited stations', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1', '강남역')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isFavorite('station-1')).toBe(true);
    });

    it('isFavorite should return false for non-favorited', async () => {
      mockFavoritesService.getFavorites.mockResolvedValue([]);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isFavorite('station-1')).toBe(false);
    });

    it('toggleFavorite should add when not favorited', async () => {
      mockFavoritesService.getFavorites.mockResolvedValue([]);
      const station = createMockStation('station-1', '강남역');

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(station);
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalled();
    });

    it('toggleFavorite should remove when favorited', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1', '강남역')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockFavoritesService.getFavoriteByStationId.mockResolvedValue(mockFavorites[0]);
      const station = createMockStation('station-1', '강남역');

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(station);
      });

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalled();
    });
  });

  describe('Reorder', () => {
    it('reorderFavorites should call service', async () => {
      const reordered = [
        createMockFavorite('fav-2', 'station-2', '역삼역'),
        createMockFavorite('fav-1', 'station-1', '강남역'),
      ];

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.reorderFavorites(reordered);
      });

      expect(mockFavoritesService.reorderFavorites).toHaveBeenCalledWith(mockUser.id, reordered);
    });

    it('reorderFavorites should reload after', async () => {
      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.reorderFavorites([]);
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalled();
    });
  });

  describe('Commute Stations', () => {
    it('getCommuteStations should filter by isCommuteStation', async () => {
      const mockFavorites = [
        { ...createMockFavorite('fav-1', 'station-1', '강남역'), isCommuteStation: true },
        { ...createMockFavorite('fav-2', 'station-2', '역삼역'), isCommuteStation: false },
      ];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useFavorites());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const commuteStations = result.current.getCommuteStations();
      expect(commuteStations).toHaveLength(1);
      expect(commuteStations[0]?.stationName).toBe('강남역');
    });
  });
});
