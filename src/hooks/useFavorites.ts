/**
 * Favorites Hook
 * Custom hook for managing user's favorite stations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  favoritesService,
  AddFavoriteParams,
  migrateFavoritesToNewFormat,
} from '../services/favorites/favoritesService';
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

  // Track if migration has been performed to avoid duplicate updates
  const migrationPerformedRef = useRef<string | null>(null);

  // Per-key in-flight guard. Blocks double-tap from firing the same mutation
  // twice before the first request completes. Synchronous (useRef, not state)
  // so the second tap sees the first tap's lock without waiting for a render.
  const inFlightRef = useRef<Set<string>>(new Set());

  const runExclusive = useCallback(
    async (key: string, task: () => Promise<void>): Promise<void> => {
      if (inFlightRef.current.has(key)) {
        return;
      }
      inFlightRef.current.add(key);
      try {
        await task();
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [],
  );

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

      let favorites = await favoritesService.getFavorites(user.id);

      // Migrate legacy stationIds to station_cd format (one-time per session)
      if (favorites.length > 0 && migrationPerformedRef.current !== user.id) {
        const { migrated, hasChanges } = migrateFavoritesToNewFormat(favorites);

        if (hasChanges) {
          console.log('📦 Migrating favorites to new station_cd format...');
          // Update Firebase with migrated data
          await favoritesService.reorderFavorites(user.id, migrated);
          favorites = migrated;
        }

        migrationPerformedRef.current = user.id;
      }

      // Load station details for each favorite
      const favoritesWithDetails = await Promise.all(
        favorites.map(async (favorite) => {
          try {
            const station = await trainService.getStation(favorite.stationId);
            return {
              ...favorite,
              // 저장된 lineId를 사용하여 환승역에서 올바른 호선 표시
              station: station ? {
                ...station,
                lineId: favorite.lineId,
              } : null,
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

      await runExclusive(`station:${station.id}`, async () => {
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
      });
    },
    [user, loadFavorites, runExclusive]
  );

  /**
   * Remove a station from favorites
   */
  const removeFavorite = useCallback(
    async (favoriteId: string): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      // Resolve stationId from cache so this lock key matches the one used
      // by addFavorite/removeFavoriteByStationId. Without this, a UI that
      // races removeFavorite(favoriteId) against removeFavoriteByStationId
      // (or toggleFavorite) for the same record would slip through both
      // guards under different namespaces. Falls back to favoriteId when
      // the cache hasn't loaded yet (acceptable: the only caller paths
      // that hit that branch don't cross the toggle path).
      const cached = state.favorites.find((f) => f.id === favoriteId);
      const lockKey = cached ? `station:${cached.stationId}` : `favorite:${favoriteId}`;

      await runExclusive(lockKey, async () => {
        try {
          await favoritesService.removeFavorite(user.id, favoriteId);
          await loadFavorites();
        } catch (error) {
          console.error('Error removing favorite:', error);
          throw error;
        }
      });
    },
    [user, loadFavorites, runExclusive, state.favorites]
  );

  /**
   * Remove favorite by station ID
   */
  const removeFavoriteByStationId = useCallback(
    async (stationId: string): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      await runExclusive(`station:${stationId}`, async () => {
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
      });
    },
    [user, loadFavorites, runExclusive]
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
   * Toggle per-favorite notification flag with in-flight protection.
   * Uses the same station-keyed lock as add/remove so a swipe-to-mute
   * cannot race the same record's removal.
   */
  const setNotificationEnabled = useCallback(
    async (favoriteId: string, enabled: boolean): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      const cached = state.favorites.find((f) => f.id === favoriteId);
      const lockKey = cached
        ? `station:${cached.stationId}`
        : `favorite:${favoriteId}`;

      await runExclusive(lockKey, async () => {
        try {
          await favoritesService.setNotificationEnabled(user.id, favoriteId, enabled);
          await loadFavorites();
        } catch (error) {
          console.error('Error toggling favorite notification:', error);
          throw error;
        }
      });
    },
    [user, loadFavorites, runExclusive, state.favorites],
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
    setNotificationEnabled,
    isFavorite,
    toggleFavorite,
    reorderFavorites,
    getCommuteStations,
    refresh: loadFavorites,
  };
};
