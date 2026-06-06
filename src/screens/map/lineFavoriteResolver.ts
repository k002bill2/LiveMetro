/**
 * Pure helpers for line-by-line favorite selection on the subway map.
 * A transfer station has a distinct station_cd per line, so the favorite
 * identity is the station_cd — no composite key needed.
 */
import { findStationCdByNameAndLine } from '@services/data/stationsDataService';

export interface LineFavoriteOption {
  readonly lineId: string;
  readonly stationCd: string;
  readonly isFavorite: boolean;
}

export interface FavoriteDiff {
  readonly toAdd: string[]; // lineIds to add
  readonly toRemove: string[]; // station_cds to remove
}

/**
 * Resolve each lineId to its station_cd at the given station name,
 * dropping lines that cannot be resolved. `isFavoriteCd` marks current state.
 */
export const resolveLineFavorites = (
  stationName: string,
  lineIds: readonly string[],
  isFavoriteCd: (stationCd: string) => boolean,
): LineFavoriteOption[] => {
  const options: LineFavoriteOption[] = [];
  for (const lineId of lineIds) {
    const stationCd = findStationCdByNameAndLine(stationName, lineId);
    if (!stationCd) continue;
    options.push({ lineId, stationCd, isFavorite: isFavoriteCd(stationCd) });
  }
  return options;
};

/**
 * Diff the user's current selection (set of selected lineIds) against the
 * initial favorited state captured in `options`.
 */
export const computeFavoriteDiff = (
  options: readonly LineFavoriteOption[],
  selectedLineIds: ReadonlySet<string>,
): FavoriteDiff => {
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const opt of options) {
    const nowSelected = selectedLineIds.has(opt.lineId);
    if (nowSelected && !opt.isFavorite) toAdd.push(opt.lineId);
    if (!nowSelected && opt.isFavorite) toRemove.push(opt.stationCd);
  }
  return { toAdd, toRemove };
};
