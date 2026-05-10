/**
 * Favorites Service
 * Manages user's favorite stations with Firebase Firestore integration
 */

import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { FavoriteStation } from '../../models/user';
import { Station } from '../../models/train';
import {
  getLocalStation,
  findStationCdByNameAndLine,
  getLocalStationsByLine,
} from '../data/stationsDataService';

export interface AddFavoriteParams {
  userId: string;
  station: Station;
  alias?: string;
  direction?: 'up' | 'down' | 'both';
  isCommuteStation?: boolean;
}

export interface UpdateFavoriteParams {
  userId: string;
  favoriteId: string;
  alias?: string;
  direction?: 'up' | 'down' | 'both';
  isCommuteStation?: boolean;
  notificationEnabled?: boolean;
}

export class DuplicateFavoriteError extends Error {
  constructor(message = '이미 즐겨찾기에 등록된 역입니다.') {
    super(message);
    this.name = 'DuplicateFavoriteError';
  }
}

class FavoritesService {
  /**
   * Get all favorite stations for a user
   */
  async getFavorites(userId: string): Promise<FavoriteStation[]> {
    try {
      const userRef = doc(firestore, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return [];
      }

      const userData = userDoc.data();
      return userData.preferences?.favoriteStations || [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Add a station to favorites
   */
  async addFavorite(params: AddFavoriteParams): Promise<FavoriteStation> {
    const { userId, station, alias = null, direction = 'both', isCommuteStation = false } = params;

    // Reject duplicates against fresh Firestore state so cached/state-stale
    // callers and parallel taps cannot insert two records for the same station.
    const existing = await this.getFavorites(userId);
    if (existing.some(fav => fav.stationId === station.id)) {
      throw new DuplicateFavoriteError();
    }

    try {
      const userRef = doc(firestore, 'users', userId);

      const newFavorite: FavoriteStation = {
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stationId: station.id,
        lineId: station.lineId,
        alias,
        direction,
        isCommuteStation,
        addedAt: new Date(),
      };

      await updateDoc(userRef, {
        'preferences.favoriteStations': arrayUnion(newFavorite),
        lastActiveAt: new Date(),
      });

      return newFavorite;
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw new Error('즐겨찾기 추가에 실패했습니다.');
    }
  }

  /**
   * Remove a station from favorites
   */
  async removeFavorite(userId: string, favoriteId: string): Promise<void> {
    try {
      const userRef = doc(firestore, 'users', userId);
      const favorites = await this.getFavorites(userId);

      const favoriteToRemove = favorites.find(fav => fav.id === favoriteId);

      if (!favoriteToRemove) {
        throw new Error('즐겨찾기를 찾을 수 없습니다.');
      }

      await updateDoc(userRef, {
        'preferences.favoriteStations': arrayRemove(favoriteToRemove),
        lastActiveAt: new Date(),
      });
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw new Error('즐겨찾기 삭제에 실패했습니다.');
    }
  }

  /**
   * Update favorite station properties
   */
  async updateFavorite(params: UpdateFavoriteParams): Promise<void> {
    const { userId, favoriteId, alias, direction, isCommuteStation, notificationEnabled } = params;

    try {
      const userRef = doc(firestore, 'users', userId);
      const favorites = await this.getFavorites(userId);

      const favoriteIndex = favorites.findIndex(fav => fav.id === favoriteId);

      if (favoriteIndex === -1) {
        throw new Error('즐겨찾기를 찾을 수 없습니다.');
      }

      // Update fields explicitly
      const currentFavorite = favorites[favoriteIndex]!; // Safe because we checked above
      const updatedFavorite: FavoriteStation = {
        id: currentFavorite.id,
        stationId: currentFavorite.stationId,
        lineId: currentFavorite.lineId,
        alias: alias !== undefined ? alias : currentFavorite.alias,
        direction: direction !== undefined ? direction : currentFavorite.direction,
        isCommuteStation: isCommuteStation !== undefined ? isCommuteStation : currentFavorite.isCommuteStation,
        addedAt: currentFavorite.addedAt,
        notificationEnabled:
          notificationEnabled !== undefined
            ? notificationEnabled
            : currentFavorite.notificationEnabled,
      };

      // Replace entire array with updated version
      const updatedFavorites = [...favorites];
      updatedFavorites[favoriteIndex] = updatedFavorite;

      await updateDoc(userRef, {
        'preferences.favoriteStations': updatedFavorites,
        lastActiveAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating favorite:', error);
      throw new Error('즐겨찾기 업데이트에 실패했습니다.');
    }
  }

  /**
   * Toggle the per-favorite notification flag. Thin wrapper over
   * `updateFavorite` — exists so callers express intent ("mute this
   * station") instead of constructing an UpdateFavoriteParams object,
   * and so the swipe action site doesn't depend on the broader update
   * surface area.
   */
  async setNotificationEnabled(
    userId: string,
    favoriteId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.updateFavorite({
      userId,
      favoriteId,
      notificationEnabled: enabled,
    });
  }

  /**
   * Check if a station is favorited
   */
  async isFavorite(userId: string, stationId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites(userId);
      return favorites.some(fav => fav.stationId === stationId);
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
  }

  /**
   * Get favorite by station ID
   */
  async getFavoriteByStationId(userId: string, stationId: string): Promise<FavoriteStation | null> {
    try {
      const favorites = await this.getFavorites(userId);
      return favorites.find(fav => fav.stationId === stationId) || null;
    } catch (error) {
      console.error('Error getting favorite:', error);
      return null;
    }
  }

  /**
   * Reorder favorites
   */
  async reorderFavorites(userId: string, reorderedFavorites: FavoriteStation[]): Promise<void> {
    try {
      const userRef = doc(firestore, 'users', userId);

      await updateDoc(userRef, {
        'preferences.favoriteStations': reorderedFavorites,
        lastActiveAt: new Date(),
      });
    } catch (error) {
      console.error('Error reordering favorites:', error);
      throw new Error('즐겨찾기 순서 변경에 실패했습니다.');
    }
  }
}

/**
 * Check if a stationId is in the legacy format (stations.json)
 * Legacy IDs are like "city_hall_1", "gangnam", "jongno3ga_5"
 * New IDs (station_cd) are like "0151", "0222", "0340"
 */
const isLegacyStationId = (stationId: string): boolean => {
  // station_cd is typically 4 digits starting with 0
  const isStationCd = /^0\d{3}$/.test(stationId);
  if (isStationCd) return false;

  // Also check if it matches any station in our data
  const station = getLocalStation(stationId);
  return station === null;
};

/**
 * Migrate a legacy stationId to station_cd format
 * @param stationId Legacy ID (e.g., "city_hall_1", "gangnam") or Korean name
 * @param lineId Line ID to find the correct station_cd for transfer stations
 * @returns station_cd or original ID if migration not possible
 */
const migrateStationId = (stationId: string, lineId: string): string => {
  // Already in station_cd format
  if (!isLegacyStationId(stationId)) {
    return stationId;
  }

  // Try to find station_cd by name match
  const stations = getLocalStationsByLine(lineId);
  if (stations.length === 0) {
    return stationId;
  }

  // Normalize for comparison
  const normalizedId = stationId.toLowerCase().replace(/[\s\-_().]/g, '');
  const cleanedId = stationId.replace(/_\d+$/, ''); // Remove "_1", "_5" suffix
  const normalizedCleanedId = cleanedId.toLowerCase().replace(/[\s\-_().]/g, '');

  // Find matching station
  const matchedStation = stations.find(s => {
    const normalizedName = s.name.toLowerCase().replace(/[\s\-_().]/g, '');
    const normalizedNameEn = (s.nameEn || '').toLowerCase().replace(/[\s\-_().]/g, '');

    return normalizedName === normalizedId ||
           normalizedNameEn === normalizedId ||
           normalizedName === normalizedCleanedId ||
           normalizedNameEn === normalizedCleanedId ||
           normalizedNameEn.includes(normalizedCleanedId) ||
           normalizedCleanedId.includes(normalizedNameEn);
  });

  if (matchedStation) {
    console.log(`✅ Migrated stationId: ${stationId} → ${matchedStation.id} (${matchedStation.name})`);
    return matchedStation.id;
  }

  // Fallback: try findStationCdByNameAndLine with the original ID as name
  const stationCd = findStationCdByNameAndLine(stationId, lineId);
  if (stationCd) {
    console.log(`✅ Migrated stationId by name: ${stationId} → ${stationCd}`);
    return stationCd;
  }

  console.warn(`⚠️ Could not migrate stationId: ${stationId} for line ${lineId}`);
  return stationId;
};

/**
 * Migrate favorites array to use station_cd format
 * Returns migrated array and whether any changes were made
 */
export const migrateFavoritesToNewFormat = (
  favorites: FavoriteStation[]
): { migrated: FavoriteStation[]; hasChanges: boolean } => {
  let hasChanges = false;

  const migrated = favorites.map(fav => {
    const newStationId = migrateStationId(fav.stationId, fav.lineId);

    if (newStationId !== fav.stationId) {
      hasChanges = true;
      return {
        ...fav,
        stationId: newStationId,
      };
    }

    return fav;
  });

  return { migrated, hasChanges };
};

// Export singleton instance
export const favoritesService = new FavoritesService();
