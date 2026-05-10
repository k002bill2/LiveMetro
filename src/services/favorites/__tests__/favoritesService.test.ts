/**
 * Favorites Service Tests
 * Tests for user favorites management
 */

import { favoritesService, migrateFavoritesToNewFormat, DuplicateFavoriteError } from '../favoritesService';
import { Station } from '../../../models/train';
import { FavoriteStation } from '../../../models/user';

// Mock Firebase
jest.mock('../../firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockArrayUnion = jest.fn();
const mockArrayRemove = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...args),
}));

// Mock stationsDataService
const mockGetLocalStation = jest.fn();
const mockFindStationCdByNameAndLine = jest.fn();
const mockGetLocalStationsByLine = jest.fn();

jest.mock('../../data/stationsDataService', () => ({
  getLocalStation: (...args: unknown[]) => mockGetLocalStation(...args),
  findStationCdByNameAndLine: (...args: unknown[]) => mockFindStationCdByNameAndLine(...args),
  getLocalStationsByLine: (...args: unknown[]) => mockGetLocalStationsByLine(...args),
}));

describe('FavoritesService', () => {
  const mockStation: Station = {
    id: 'gangnam',
    name: '강남역',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.4979,
      longitude: 127.0276,
    },
    transfers: [],
  };

  const mockFavorite: FavoriteStation = {
    id: 'fav_123',
    stationId: 'gangnam',
    lineId: '2',
    alias: null,
    direction: 'both',
    isCommuteStation: false,
    addedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue('mockDocRef');
    mockArrayUnion.mockImplementation((data) => ({ _type: 'arrayUnion', data }));
    mockArrayRemove.mockImplementation((data) => ({ _type: 'arrayRemove', data }));
  });

  describe('getFavorites', () => {
    it('should return favorites for a user', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      const favorites = await favoritesService.getFavorites('user-123');

      expect(favorites).toHaveLength(1);
      expect(favorites[0]?.stationId).toBe('gangnam');
    });

    it('should return empty array if user does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const favorites = await favoritesService.getFavorites('nonexistent-user');

      expect(favorites).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const favorites = await favoritesService.getFavorites('user-123');

      expect(favorites).toEqual([]);
    });

    it('should return empty array if no favorites exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {},
        }),
      });

      const favorites = await favoritesService.getFavorites('user-123');

      expect(favorites).toEqual([]);
    });
  });

  describe('addFavorite', () => {
    it('should add a new favorite station', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await favoritesService.addFavorite({
        userId: 'user-123',
        station: mockStation,
      });

      expect(result.stationId).toBe('gangnam');
      expect(result.lineId).toBe('2');
      expect(result.direction).toBe('both');
      expect(result.isCommuteStation).toBe(false);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should add favorite with custom options', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await favoritesService.addFavorite({
        userId: 'user-123',
        station: mockStation,
        alias: '출근역',
        direction: 'up',
        isCommuteStation: true,
      });

      expect(result.alias).toBe('출근역');
      expect(result.direction).toBe('up');
      expect(result.isCommuteStation).toBe(true);
    });

    it('should throw error on failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        favoritesService.addFavorite({
          userId: 'user-123',
          station: mockStation,
        })
      ).rejects.toThrow('즐겨찾기 추가에 실패했습니다.');
    });

    it('should reject duplicate stationId without writing', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      await expect(
        favoritesService.addFavorite({
          userId: 'user-123',
          station: mockStation, // same stationId 'gangnam' as mockFavorite
        })
      ).rejects.toBeInstanceOf(DuplicateFavoriteError);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should allow adding a different station when others exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite], // gangnam
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await favoritesService.addFavorite({
        userId: 'user-123',
        station: { ...mockStation, id: 'seolleung', name: '선릉역' },
      });

      expect(result.stationId).toBe('seolleung');
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('should remove a favorite station', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.removeFavorite('user-123', 'fav_123');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error if favorite not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      await expect(
        favoritesService.removeFavorite('user-123', 'nonexistent-fav')
      ).rejects.toThrow('즐겨찾기 삭제에 실패했습니다.');
    });
  });

  describe('updateFavorite', () => {
    it('should update favorite properties', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.updateFavorite({
        userId: 'user-123',
        favoriteId: 'fav_123',
        alias: '퇴근역',
        direction: 'down',
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error if favorite not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      await expect(
        favoritesService.updateFavorite({
          userId: 'user-123',
          favoriteId: 'nonexistent-fav',
          alias: 'Test',
        })
      ).rejects.toThrow('즐겨찾기 업데이트에 실패했습니다.');
    });

    it('should persist notificationEnabled flag', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.updateFavorite({
        userId: 'user-123',
        favoriteId: 'fav_123',
        notificationEnabled: false,
      });

      const writePayload = mockUpdateDoc.mock.calls[0]?.[1] as
        | { 'preferences.favoriteStations': FavoriteStation[] }
        | undefined;
      expect(writePayload?.['preferences.favoriteStations']?.[0]?.notificationEnabled).toBe(false);
    });
  });

  describe('setNotificationEnabled', () => {
    it('should write the flipped flag through updateFavorite', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.setNotificationEnabled('user-123', 'fav_123', false);

      const writePayload = mockUpdateDoc.mock.calls[0]?.[1] as
        | { 'preferences.favoriteStations': FavoriteStation[] }
        | undefined;
      expect(writePayload?.['preferences.favoriteStations']?.[0]?.notificationEnabled).toBe(false);
    });

    it('should preserve other fields when toggling notification', async () => {
      const detailedFavorite: FavoriteStation = {
        ...mockFavorite,
        alias: '회사',
        direction: 'up',
        isCommuteStation: true,
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [detailedFavorite],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.setNotificationEnabled('user-123', 'fav_123', false);

      const writePayload = mockUpdateDoc.mock.calls[0]?.[1] as
        | { 'preferences.favoriteStations': FavoriteStation[] }
        | undefined;
      const updated = writePayload?.['preferences.favoriteStations']?.[0];
      expect(updated?.alias).toBe('회사');
      expect(updated?.direction).toBe('up');
      expect(updated?.isCommuteStation).toBe(true);
      expect(updated?.notificationEnabled).toBe(false);
    });
  });

  describe('isFavorite', () => {
    it('should return true if station is a favorite', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      const result = await favoritesService.isFavorite('user-123', 'gangnam');

      expect(result).toBe(true);
    });

    it('should return false if station is not a favorite', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      const result = await favoritesService.isFavorite('user-123', 'seolleung');

      expect(result).toBe(false);
    });
  });

  describe('reorderFavorites', () => {
    it('should reorder favorites', async () => {
      const favorite1: FavoriteStation = { ...mockFavorite, id: 'fav_1' };
      const favorite2: FavoriteStation = { ...mockFavorite, id: 'fav_2', stationId: 'seolleung' };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [favorite1, favorite2],
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await favoritesService.reorderFavorites('user-123', [favorite2, favorite1]);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error on reorder failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        favoritesService.reorderFavorites('user-123', [mockFavorite])
      ).rejects.toThrow('즐겨찾기 순서 변경에 실패했습니다.');
    });
  });

  describe('getFavoriteByStationId', () => {
    it('should return favorite for station', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      const result = await favoritesService.getFavoriteByStationId('user-123', 'gangnam');

      expect(result).not.toBeNull();
      expect(result?.stationId).toBe('gangnam');
    });

    it('should return null if station not favorited', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {
            favoriteStations: [mockFavorite],
          },
        }),
      });

      const result = await favoritesService.getFavoriteByStationId('user-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await favoritesService.getFavoriteByStationId('user-123', 'gangnam');

      expect(result).toBeNull();
    });
  });

  describe('isFavorite error handling', () => {
    it('should return false on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await favoritesService.isFavorite('user-123', 'gangnam');

      expect(result).toBe(false);
    });
  });
});

describe('migrateFavoritesToNewFormat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not change favorites already in station_cd format', () => {
    const favorite: FavoriteStation = {
      id: 'fav_1',
      stationId: '0222', // Already station_cd format
      lineId: '2',
      alias: null,
      direction: 'both',
      isCommuteStation: false,
      addedAt: new Date(),
    };

    // station_cd format (0222) should not be considered legacy
    mockGetLocalStation.mockReturnValue({ id: '0222', name: '강남' });

    const result = migrateFavoritesToNewFormat([favorite]);

    expect(result.hasChanges).toBe(false);
    expect(result.migrated[0]?.stationId).toBe('0222');
  });

  it('should migrate legacy stationId to station_cd', () => {
    const favorite: FavoriteStation = {
      id: 'fav_1',
      stationId: 'gangnam', // Legacy format
      lineId: '2',
      alias: null,
      direction: 'both',
      isCommuteStation: false,
      addedAt: new Date(),
    };

    // gangnam is not found as station_cd, so it's legacy
    mockGetLocalStation.mockReturnValue(null);
    mockGetLocalStationsByLine.mockReturnValue([
      { id: '0222', name: '강남', nameEn: 'Gangnam' },
      { id: '0223', name: '역삼', nameEn: 'Yeoksam' },
    ]);

    const result = migrateFavoritesToNewFormat([favorite]);

    expect(result.hasChanges).toBe(true);
    expect(result.migrated[0]?.stationId).toBe('0222');
  });

  it('should use findStationCdByNameAndLine as fallback', () => {
    const favorite: FavoriteStation = {
      id: 'fav_1',
      stationId: '시청역', // Korean name that doesn't match
      lineId: '1',
      alias: null,
      direction: 'both',
      isCommuteStation: false,
      addedAt: new Date(),
    };

    mockGetLocalStation.mockReturnValue(null);
    // Return stations that don't match '시청역'
    mockGetLocalStationsByLine.mockReturnValue([
      { id: '0150', name: '서울역', nameEn: 'Seoul' },
      { id: '0152', name: '종각', nameEn: 'Jonggak' },
    ]);
    mockFindStationCdByNameAndLine.mockReturnValue('0151');

    const result = migrateFavoritesToNewFormat([favorite]);

    expect(result.hasChanges).toBe(true);
    expect(result.migrated[0]?.stationId).toBe('0151');
  });

  it('should keep original ID if migration not possible', () => {
    const favorite: FavoriteStation = {
      id: 'fav_1',
      stationId: 'unknown_station',
      lineId: '2',
      alias: null,
      direction: 'both',
      isCommuteStation: false,
      addedAt: new Date(),
    };

    mockGetLocalStation.mockReturnValue(null);
    // Return some stations that don't match
    mockGetLocalStationsByLine.mockReturnValue([
      { id: '0222', name: '강남', nameEn: 'Gangnam' },
    ]);
    mockFindStationCdByNameAndLine.mockReturnValue(null);

    const result = migrateFavoritesToNewFormat([favorite]);

    expect(result.hasChanges).toBe(false);
    expect(result.migrated[0]?.stationId).toBe('unknown_station');
  });
});
