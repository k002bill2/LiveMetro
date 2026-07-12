/**
 * useFavorites Hook Tests
 * Tests for managing user's favorite stations
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFavorites } from '../useFavorites';
import { FavoritesProvider } from '../../contexts/FavoritesContext';
import { favoritesService, migrateFavoritesToNewFormat } from '../../services/favorites/favoritesService';
import { trainService } from '../../services/train/trainService';
import { useAuth } from '../../services/auth/AuthContext';
import { FavoriteStation } from '../../models/user';
import { Station } from '../../models/train';

// Mock dependencies
jest.mock('../../services/favorites/favoritesService', () => ({
  favoritesService: {
    getFavorites: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    removeFavorites: jest.fn(),
    updateFavorite: jest.fn(),
    reorderFavorites: jest.fn(),
    getFavoriteByStationId: jest.fn(),
    setNotificationEnabled: jest.fn(),
  },
  migrateFavoritesToNewFormat: jest.fn(() => ({ migrated: [], hasChanges: false })),
}));
jest.mock('../../services/train/trainService');
jest.mock('../../services/auth/AuthContext');

const mockFavoritesService = favoritesService as jest.Mocked<typeof favoritesService>;
const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockMigrateFavoritesToNewFormat = migrateFavoritesToNewFormat as jest.MockedFunction<typeof migrateFavoritesToNewFormat>;

const mockUser = { id: 'user-123', email: 'test@test.com' };

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(FavoritesProvider, null, children);

const createMockStation = (id: string, name: string): Station => ({
  id,
  name,
  nameEn: `${name} Station`,
  lineId: '2',
  coordinates: { latitude: 37.5, longitude: 127.0 },
  transfers: [],
});

const createMockFavorite = (id: string, stationId: string): FavoriteStation => ({
  id,
  stationId,
  lineId: '2',
  alias: null,
  direction: 'both',
  isCommuteStation: false,
  addedAt: new Date(),
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
    // Mock migration function to return unchanged data
    mockMigrateFavoritesToNewFormat.mockImplementation((favorites) => ({
      migrated: favorites,
      hasChanges: false,
    }));
  });

  describe('Without User', () => {
    it('should return empty favorites when no user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      const { result } = renderHook(() => useFavorites(), { wrapper });

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

      renderHook(() => useFavorites(), { wrapper });

      expect(mockFavoritesService.getFavorites).not.toHaveBeenCalled();
    });
  });

  describe('Load Favorites', () => {
    it('should load favorites on mount', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(mockUser.id);
      expect(result.current.favorites).toEqual(mockFavorites);
    });

    it('should load station details for each favorite', async () => {
      const mockFavorites = [
        createMockFavorite('fav-1', 'station-1'),
        createMockFavorite('fav-2', 'station-2'),
      ];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockTrainService.getStation
        .mockResolvedValueOnce(createMockStation('station-1', '강남역'))
        .mockResolvedValueOnce(createMockStation('station-2', '역삼역'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.favorites).toHaveLength(2);
      });

      expect(mockTrainService.getStation).toHaveBeenCalledTimes(2);
    });

    it('should handle station load errors gracefully', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockTrainService.getStation.mockRejectedValue(new Error('Station not found'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.favorites).toHaveLength(1);
      });

      // Should still have the favorite, just with null station
      expect(result.current.favoritesWithDetails[0]?.station).toBeNull();
    });

    it('should handle load favorites error', async () => {
      mockFavoritesService.getFavorites.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('즐겨찾기를 불러올 수 없습니다.');
    });
  });

  describe('Add Favorite', () => {
    it('addFavorite should call service with correct params', async () => {
      const station = createMockStation('station-1', '강남역');
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFavorite('fav-1');
      });

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(mockUser.id, 'fav-1');
    });

    it('removeFavoriteByStationId should find and remove', async () => {
      const mockFavorite = createMockFavorite('fav-1', 'station-1');
      mockFavoritesService.getFavoriteByStationId.mockResolvedValue(mockFavorite);

      const { result } = renderHook(() => useFavorites(), { wrapper });

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

  describe('removeFavorites', () => {
    it('서비스를 호출하고 목록을 다시 로드한다', async () => {
      mockFavoritesService.removeFavorites.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.removeFavorites(['fav_1', 'fav_2']);
      });

      expect(mockFavoritesService.removeFavorites).toHaveBeenCalledWith(mockUser.id, ['fav_1', 'fav_2']);
      // reload 발생: getFavorites가 (초기 로드 이후) 한 번 더 호출됨
      expect(mockFavoritesService.getFavorites).toHaveBeenCalledTimes(1);
    });

    it('빈 배열이면 서비스 호출·reload를 생략한다', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.removeFavorites([]);
      });

      expect(mockFavoritesService.removeFavorites).not.toHaveBeenCalled();
      expect(mockFavoritesService.getFavorites).not.toHaveBeenCalled();
    });

    it('미로그인 상태면 throw한다', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.removeFavorites(['fav_1']);
        }),
      ).rejects.toThrow('로그인이 필요합니다.');
    });

    it('서비스 에러를 rethrow한다', async () => {
      mockFavoritesService.removeFavorites.mockRejectedValue(
        new Error('즐겨찾기 삭제에 실패했습니다.'),
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.removeFavorites(['fav_1']);
        }),
      ).rejects.toThrow('즐겨찾기 삭제에 실패했습니다.');
    });
  });

  describe('mutation 직렬화 (순서 보장)', () => {
    it('진행 중 updateFavorite가 끝나기 전에는 removeFavorites 서비스가 호출되지 않는다', async () => {
      let resolveUpdate!: () => void;
      // Once (not persistent): jest.clearAllMocks() clears calls but not
      // implementations, so a persistent deferred would leak into later tests.
      mockFavoritesService.updateFavorite.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveUpdate = resolve; }),
      );
      mockFavoritesService.removeFavorites.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let updatePromise!: Promise<void>;
      let removePromise!: Promise<void>;
      await act(async () => {
        updatePromise = result.current.updateFavorite('fav_1', { alias: 'x' });
        removePromise = result.current.removeFavorites(['fav_1']);
      });

      // update is in flight (pending); remove must be queued behind it so its
      // whole-array write can never land after the (later) bulk delete.
      expect(mockFavoritesService.updateFavorite).toHaveBeenCalledTimes(1);
      expect(mockFavoritesService.removeFavorites).not.toHaveBeenCalled();

      await act(async () => {
        resolveUpdate();
        await updatePromise;
        await removePromise;
      });

      expect(mockFavoritesService.removeFavorites).toHaveBeenCalledWith('user-123', ['fav_1']);
    });

    it('한 mutation이 실패해도 이후 mutation이 정상 실행된다 (체인 유지)', async () => {
      mockFavoritesService.updateFavorite.mockRejectedValueOnce(new Error('boom'));
      mockFavoritesService.removeFavorites.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await expect(
          result.current.updateFavorite('fav_1', { alias: 'x' }),
        ).rejects.toThrow('boom');
      });

      await act(async () => {
        await result.current.removeFavorites(['fav_1']);
      });

      expect(mockFavoritesService.removeFavorites).toHaveBeenCalledWith('user-123', ['fav_1']);
    });

    it('큐잉된 mutation은 실행 직전 로그아웃되면 서비스를 호출하지 않고 reject된다', async () => {
      let resolveUpdate!: () => void;
      mockFavoritesService.updateFavorite.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveUpdate = resolve; }),
      );
      mockFavoritesService.removeFavorites.mockResolvedValueOnce(undefined);

      const { result, rerender } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let updatePromise!: Promise<void>;
      let removePromise!: Promise<void>;
      await act(async () => {
        updatePromise = result.current.updateFavorite('fav_1', { alias: 'x' });
        removePromise = result.current.removeFavorites(['fav_1']);
      });

      // A (update) is in flight; B (remove) is queued behind it.
      expect(mockFavoritesService.updateFavorite).toHaveBeenCalledTimes(1);
      expect(mockFavoritesService.removeFavorites).not.toHaveBeenCalled();

      // Log out before the queue drains to B.
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);
      await act(async () => {
        rerender(undefined);
      });

      await act(async () => {
        resolveUpdate();
        await updatePromise;
        await expect(removePromise).rejects.toThrow('로그인이 필요합니다.');
      });

      // B must never touch the previous account's document.
      expect(mockFavoritesService.removeFavorites).not.toHaveBeenCalled();
    });
  });

  describe('Notification toggle', () => {
    it('setNotificationEnabled forwards to service with correct args', async () => {
      const mockFavorite = createMockFavorite('fav-1', 'station-1');
      mockFavoritesService.getFavorites.mockResolvedValue([mockFavorite]);
      mockFavoritesService.setNotificationEnabled.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.setNotificationEnabled('fav-1', false);
      });

      expect(mockFavoritesService.setNotificationEnabled).toHaveBeenCalledWith(
        mockUser.id,
        'fav-1',
        false,
      );
    });

    it('setNotificationEnabled reloads favorites after success', async () => {
      const mockFavorite = createMockFavorite('fav-1', 'station-1');
      mockFavoritesService.getFavorites.mockResolvedValue([mockFavorite]);
      mockFavoritesService.setNotificationEnabled.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFavoritesService.getFavorites.mockClear();

      await act(async () => {
        await result.current.setNotificationEnabled('fav-1', true);
      });

      expect(mockFavoritesService.getFavorites).toHaveBeenCalled();
    });

    it('setNotificationEnabled throws without user', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
      } as any);

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.setNotificationEnabled('fav-1', false);
        }),
      ).rejects.toThrow('로그인이 필요합니다.');
    });
  });

  describe('Double-tap guard', () => {
    it('blocks concurrent addFavorite for same stationId', async () => {
      const station = createMockStation('station-1', '강남역');
      let resolveFirst!: (v: FavoriteStation) => void;
      mockFavoritesService.addFavorite.mockImplementation(
        () => new Promise<FavoriteStation>((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let p1!: Promise<void>;
      let p2!: Promise<void>;
      await act(async () => {
        p1 = result.current.addFavorite(station);
        p2 = result.current.addFavorite(station);
        await p2; // second call resolves immediately (silent skip)
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst(createMockFavorite('fav-1', 'station-1'));
        await p1;
      });
    });

    it('allows addFavorite again after first completes (lock released)', async () => {
      const station = createMockStation('station-1', '강남역');
      mockFavoritesService.addFavorite.mockResolvedValue(createMockFavorite('fav-1', 'station-1'));

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addFavorite(station);
      });
      await act(async () => {
        await result.current.addFavorite(station);
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledTimes(2);
    });

    it('blocks concurrent removeFavoriteByStationId for same stationId', async () => {
      let resolveLookup!: (v: FavoriteStation | null) => void;
      mockFavoritesService.getFavoriteByStationId.mockImplementation(
        () => new Promise<FavoriteStation | null>((resolve) => {
          resolveLookup = resolve;
        }),
      );

      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let p1!: Promise<void>;
      let p2!: Promise<void>;
      await act(async () => {
        p1 = result.current.removeFavoriteByStationId('station-1');
        p2 = result.current.removeFavoriteByStationId('station-1');
        await p2;
      });

      expect(mockFavoritesService.getFavoriteByStationId).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveLookup(null);
        await p1;
      });
    });
  });

  describe('Update Favorite', () => {
    it('updateFavorite should call service with updates', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
      const mockFavorites = [createMockFavorite('fav-1', 'station-1')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockTrainService.getStation.mockResolvedValue(createMockStation('station-1', '강남역'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.favorites).toHaveLength(1);
      });

      expect(result.current.isFavorite('station-1')).toBe(true);
    });

    it('isFavorite should return false for non-favorited', async () => {
      mockFavoritesService.getFavorites.mockResolvedValue([]);

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isFavorite('station-1')).toBe(false);
    });

    it('toggleFavorite should add when not favorited', async () => {
      mockFavoritesService.getFavorites.mockResolvedValue([]);
      const station = createMockStation('station-1', '강남역');

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(station);
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalled();
    });

    it('toggleFavorite should remove when favorited', async () => {
      const mockFavorites = [createMockFavorite('fav-1', 'station-1')];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockFavoritesService.getFavoriteByStationId.mockResolvedValue(mockFavorites[0] ?? null);
      mockTrainService.getStation.mockResolvedValue(createMockStation('station-1', '강남역'));
      const station = createMockStation('station-1', '강남역');

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.favorites).toHaveLength(1);
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
        createMockFavorite('fav-2', 'station-2'),
        createMockFavorite('fav-1', 'station-1'),
      ];

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.reorderFavorites(reordered);
      });

      expect(mockFavoritesService.reorderFavorites).toHaveBeenCalledWith(mockUser.id, reordered);
    });

    it('reorderFavorites should reload after', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

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
        { ...createMockFavorite('fav-1', 'station-1'), isCommuteStation: true },
        { ...createMockFavorite('fav-2', 'station-2'), isCommuteStation: false },
      ];
      mockFavoritesService.getFavorites.mockResolvedValue(mockFavorites);
      mockTrainService.getStation
        .mockResolvedValueOnce(createMockStation('station-1', '강남역'))
        .mockResolvedValueOnce(createMockStation('station-2', '역삼역'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.favorites).toHaveLength(2);
      });

      const commuteStations = result.current.getCommuteStations();
      expect(commuteStations).toHaveLength(1);
      expect(commuteStations[0]?.station?.name).toBe('강남역');
    });
  });

  describe('Context state sharing', () => {
    it('shares favorites between two consumers under one provider', async () => {
      const station = createMockStation('0208', '왕십리');
      mockFavoritesService.getFavorites.mockResolvedValue([]);
      mockFavoritesService.addFavorite.mockImplementation(async () => {
        mockFavoritesService.getFavorites.mockResolvedValue([
          createMockFavorite('fav-1', '0208'),
        ]);
        return createMockFavorite('fav-1', '0208');
      });

      const { result } = renderHook(
        () => ({ a: useFavorites(), b: useFavorites() }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.a.loading).toBe(false));

      await act(async () => {
        await result.current.a.addFavorite(station);
      });

      // consumer B sees the favorite added via consumer A (shared provider state)
      await waitFor(() => {
        expect(result.current.b.isFavorite('0208')).toBe(true);
      });
    });
  });
});
