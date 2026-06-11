/**
 * Favorites Context
 * App-wide single source of truth for the user's favorite stations.
 * Logic moved verbatim from the former useFavorites hook so every screen
 * shares one state instance (add in one screen -> visible everywhere).
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  favoritesService,
  AddFavoriteParams,
  migrateFavoritesToNewFormat,
} from '@services/favorites/favoritesService';
import { FavoriteStation } from '@models/user';
import { Station } from '@models/train';
import { trainService } from '@services/train/trainService';
import { useAuth } from '@services/auth/AuthContext';

export interface FavoriteWithDetails extends FavoriteStation {
  station: Station | null;
}

interface FavoritesState {
  favorites: FavoriteStation[];
  loading: boolean;
  error: string | null;
  favoritesWithDetails: FavoriteWithDetails[];
}

export interface FavoritesContextValue {
  favorites: FavoriteStation[];
  favoritesWithDetails: FavoriteWithDetails[];
  loading: boolean;
  error: string | null;
  addFavorite: (
    station: Station,
    options?: { alias?: string; direction?: 'up' | 'down' | 'both'; isCommuteStation?: boolean }
  ) => Promise<void>;
  removeFavorite: (favoriteId: string) => Promise<void>;
  removeFavoriteByStationId: (stationId: string) => Promise<void>;
  updateFavorite: (
    favoriteId: string,
    updates: { alias?: string; direction?: 'up' | 'down' | 'both'; isCommuteStation?: boolean }
  ) => Promise<void>;
  setNotificationEnabled: (favoriteId: string, enabled: boolean) => Promise<void>;
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (station: Station) => Promise<void>;
  reorderFavorites: (reordered: FavoriteStation[]) => Promise<void>;
  getCommuteStations: () => FavoriteWithDetails[];
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<FavoritesState>({
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
   * Shared mutation pipeline: require auth, run the service call, then
   * reload favorites so every consumer sees the new state. Errors are
   * logged with the given label and rethrown for the caller's UI.
   * A task may return `false` to skip the reload (no-op mutation).
   */
  const runMutation = useCallback(
    async (
      label: string,
      task: (userId: string) => Promise<boolean | void>,
    ): Promise<void> => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      try {
        const changed = await task(user.id);
        if (changed !== false) {
          await loadFavorites();
        }
      } catch (error) {
        console.error(`Error ${label}:`, error);
        throw error;
      }
    },
    [user, loadFavorites],
  );

  /**
   * Lock key for a favoriteId-addressed mutation. Resolves the stationId
   * from cache so the key matches the one used by addFavorite/
   * removeFavoriteByStationId — without this, a UI that races
   * removeFavorite(favoriteId) against removeFavoriteByStationId (or
   * toggleFavorite) for the same record would slip through both guards
   * under different namespaces. Falls back to favoriteId when the cache
   * hasn't loaded yet (acceptable: the only caller paths that hit that
   * branch don't cross the toggle path).
   */
  const resolveLockKey = useCallback(
    (favoriteId: string): string => {
      const cached = state.favorites.find((f) => f.id === favoriteId);
      return cached ? `station:${cached.stationId}` : `favorite:${favoriteId}`;
    },
    [state.favorites],
  );

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
    ): Promise<void> =>
      runExclusive(`station:${station.id}`, () =>
        runMutation('adding favorite', async (userId) => {
          const params: AddFavoriteParams = {
            userId,
            station,
            alias: options?.alias,
            direction: options?.direction,
            isCommuteStation: options?.isCommuteStation,
          };
          await favoritesService.addFavorite(params);
        }),
      ),
    [runExclusive, runMutation]
  );

  /**
   * Remove a station from favorites
   */
  const removeFavorite = useCallback(
    async (favoriteId: string): Promise<void> =>
      runExclusive(resolveLockKey(favoriteId), () =>
        runMutation('removing favorite', async (userId) => {
          await favoritesService.removeFavorite(userId, favoriteId);
        }),
      ),
    [runExclusive, runMutation, resolveLockKey]
  );

  /**
   * Remove favorite by station ID
   */
  const removeFavoriteByStationId = useCallback(
    async (stationId: string): Promise<void> =>
      runExclusive(`station:${stationId}`, () =>
        runMutation('removing favorite', async (userId) => {
          const favorite = await favoritesService.getFavoriteByStationId(userId, stationId);
          if (!favorite) return false; // nothing to remove — skip the reload
          await favoritesService.removeFavorite(userId, favorite.id);
          return true;
        }),
      ),
    [runExclusive, runMutation]
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
    ): Promise<void> =>
      runMutation('updating favorite', async (userId) => {
        await favoritesService.updateFavorite({
          userId,
          favoriteId,
          ...updates,
        });
      }),
    [runMutation]
  );

  /**
   * Toggle per-favorite notification flag with in-flight protection.
   * Uses the same station-keyed lock as add/remove so a swipe-to-mute
   * cannot race the same record's removal.
   */
  const setNotificationEnabled = useCallback(
    async (favoriteId: string, enabled: boolean): Promise<void> =>
      runExclusive(resolveLockKey(favoriteId), () =>
        runMutation('toggling favorite notification', async (userId) => {
          await favoritesService.setNotificationEnabled(userId, favoriteId, enabled);
        }),
      ),
    [runExclusive, runMutation, resolveLockKey],
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
    async (reorderedFavorites: FavoriteStation[]): Promise<void> =>
      runMutation('reordering favorites', async (userId) => {
        await favoritesService.reorderFavorites(userId, reorderedFavorites);
      }),
    [runMutation]
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

  // Memoized so a provider re-render without a state change (e.g. a parent
  // update) doesn't hand every consumer a fresh object reference — Context
  // re-renders all consumers whenever the value reference changes.
  const value = useMemo<FavoritesContextValue>(
    () => ({
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
    }),
    [
      state,
      addFavorite,
      removeFavorite,
      removeFavoriteByStationId,
      updateFavorite,
      setNotificationEnabled,
      isFavorite,
      toggleFavorite,
      reorderFavorites,
      getCommuteStations,
      loadFavorites,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavoritesContext = (): FavoritesContextValue => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within <FavoritesProvider>');
  }
  return ctx;
};
