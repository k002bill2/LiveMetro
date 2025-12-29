/**
 * Favorites Hook
 * Custom hook for managing user's favorite stations
 */

import { useState, useEffect, useCallback } from 'react';
import { favoritesService, AddFavoriteParams } from '../services/favorites/favoritesService';
import { FavoriteStation } from '../models/user';
import { Station } from '../models/train';
import { trainService } from '../services/train/trainService';
import { useAuth } from '../services/auth/AuthContext';

interface UseFavoritesState {
  favorites: FavoriteStation[];
  loading: boolean;
  error: string | null;
  favoritesWithDetails: FavoriteWithDetails[];
}

export interface FavoriteWithDetails extends FavoriteStation {
  station: Station | null;
}

/**
 * Hook for managing user's favorite stations
 */
export const useFavorites = () => {
  const { user } = useAuth();
  const [state, setState] = useState<UseFavoritesState>({
    favorites: [],
    loading: true,
    error: null,
    favoritesWithDetails: [],
  });

  /**
   * Load favorites from Firestore
   */
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setState({
        favorites: [],
        loading: false,
        error: null,
        favoritesWithDetails: [],
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const favorites = await favoritesService.getFavorites(user.id);

      // Load station details for each favorite
      const favoritesWithDetails = await Promise.all(
        favorites.map(async (favorite) => {
          try {
            const station = await trainService.getStation(favorite.stationId);
            return {
              ...favorite,
              station,
            };
          } catch (error) {
            console.error(`Error loading station ${favorite.stationId}:`, error);
            return {
              ...favorite,
              station: null,
            };
          }
        })
      );

      setState({
        favorites,
        favoritesWithDetails,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error loading favorites:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: '즐겨찾기를 불러올 수 없습니다.',
      }));
    }
  }, [user]);

  /**
   * Add a station to favorites
   */
  const addFavorite = useCallback(
    async (
      station: Station,
      options?: {
        alias?: string;
        direction?: 'up' | 'down' | 'both';
        isCommuteStation?: boolean;
      }
    ): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        const params: AddFavoriteParams = {
          userId: user.id,
          station,
          alias: options?.alias,
          direction: options?.direction,
          isCommuteStation: options?.isCommuteStation,
        };

        await favoritesService.addFavorite(params);
        await loadFavorites();
      } catch (error) {
        console.error('Error adding favorite:', error);
        throw error;
      }
    },
    [user, loadFavorites]
  );

  /**
   * Remove a station from favorites
   */
  const removeFavorite = useCallback(
    async (favoriteId: string): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        await favoritesService.removeFavorite(user.id, favoriteId);
        await loadFavorites();
      } catch (error) {
        console.error('Error removing favorite:', error);
        throw error;
      }
    },
    [user, loadFavorites]
  );

  /**
   * Remove favorite by station ID
   */
  const removeFavoriteByStationId = useCallback(
    async (stationId: string): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        const favorite = await favoritesService.getFavoriteByStationId(user.id, stationId);
        if (favorite) {
          await favoritesService.removeFavorite(user.id, favorite.id);
          await loadFavorites();
        }
      } catch (error) {
        console.error('Error removing favorite:', error);
        throw error;
      }
    },
    [user, loadFavorites]
  );

  /**
   * Update favorite properties
   */
  const updateFavorite = useCallback(
    async (
      favoriteId: string,
      updates: {
        alias?: string;
        direction?: 'up' | 'down' | 'both';
        isCommuteStation?: boolean;
      }
    ): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        await favoritesService.updateFavorite({
          userId: user.id,
          favoriteId,
          ...updates,
        });
        await loadFavorites();
      } catch (error) {
        console.error('Error updating favorite:', error);
        throw error;
      }
    },
    [user, loadFavorites]
  );

  /**
   * Check if a station is favorited
   */
  const isFavorite = useCallback(
    (stationId: string): boolean => {
      return state.favorites.some(fav => fav.stationId === stationId);
    },
    [state.favorites]
  );

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (station: Station): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      const isCurrentlyFavorite = isFavorite(station.id);

      if (isCurrentlyFavorite) {
        await removeFavoriteByStationId(station.id);
      } else {
        await addFavorite(station);
      }
    },
    [user, isFavorite, removeFavoriteByStationId, addFavorite]
  );

  /**
   * Reorder favorites
   */
  const reorderFavorites = useCallback(
    async (reorderedFavorites: FavoriteStation[]): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        await favoritesService.reorderFavorites(user.id, reorderedFavorites);
        await loadFavorites();
      } catch (error) {
        console.error('Error reordering favorites:', error);
        throw error;
      }
    },
    [user, loadFavorites]
  );

  /**
   * Get commute stations (favorites marked as commute stations)
   */
  const getCommuteStations = useCallback((): FavoriteWithDetails[] => {
    return state.favoritesWithDetails.filter(fav => fav.isCommuteStation);
  }, [state.favoritesWithDetails]);

  // Load favorites on mount and when user changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favorites: state.favorites,
    favoritesWithDetails: state.favoritesWithDetails,
    loading: state.loading,
    error: state.error,
    addFavorite,
    removeFavorite,
    removeFavoriteByStationId,
    updateFavorite,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
    getCommuteStations,
    refresh: loadFavorites,
  };
};
