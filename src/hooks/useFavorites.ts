/**
 * Favorites Hook
 * Thin consumer of FavoritesContext. Kept for import-path stability —
 * all existing call sites (`useFavorites()`) keep working unchanged.
 */
import {
  useFavoritesContext,
  FavoritesContextValue,
  FavoriteWithDetails,
} from '../contexts/FavoritesContext';

export type { FavoriteWithDetails };

export const useFavorites = (): FavoritesContextValue => useFavoritesContext();
