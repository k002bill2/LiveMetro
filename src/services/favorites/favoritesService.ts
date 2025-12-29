/**
 * Favorites Service
 * Manages user's favorite stations with Firebase Firestore integration
 */

import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { FavoriteStation } from '../../models/user';
import { Station } from '../../models/train';

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

    try {
      const userRef = doc(firestore, 'users', userId);

      // Create new favorite station
      const newFavorite: FavoriteStation = {
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stationId: station.id,
        lineId: station.lineId,
        alias,
        direction,
        isCommuteStation,
        addedAt: new Date(),
      };

      // Add to Firestore array
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
    const { userId, favoriteId, alias, direction, isCommuteStation } = params;

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

// Export singleton instance
export const favoritesService = new FavoritesService();
