/**
 * useWatchedLineIds — the subway line ids the user cares about, for the
 * foreground delay monitor to watch.
 *
 * Derived from favorited stations' line ids (commute stations are typically
 * favorited). Unique + sorted for a stable reference so consumers' effects
 * don't churn on identity changes.
 */
import { useMemo } from 'react';
import { useFavorites } from '@hooks/useFavorites';

export function useWatchedLineIds(): readonly string[] {
  const { favoritesWithDetails } = useFavorites();
  return useMemo(() => {
    const ids = new Set<string>();
    for (const fav of favoritesWithDetails) {
      if (fav.lineId) ids.add(fav.lineId);
    }
    return Array.from(ids).sort();
  }, [favoritesWithDetails]);
}

export default useWatchedLineIds;
