/**
 * boardingSelectionStore — in-memory (JS-heap) singleton holding the train the
 * user chose to board on the "탑승 열차 선택" screen.
 *
 * Why a module store (mirrors the `pendingBiometricSetup` handoff pattern)
 * instead of navigation params: the selection must survive a back-navigation
 * to StationDetail (already mounted, only re-focused) without remounting it.
 *
 * Why we do NOT store `trainId`: Seoul realtime `Train.id` is regenerated every
 * 30s polling cycle, so by the time the user returns to StationDetail the chosen
 * train's id is likely gone. We instead key on the stable tuple
 * (station + line + direction + finalDestination) and re-resolve the live train
 * by destination, degrading gracefully when no live train matches.
 *
 * Ephemeral by design: not persisted to AsyncStorage. A boarding intent is only
 * meaningful for the current session at the platform.
 */

export interface BoardingSelection {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly finalDestination: string;
  /** 1-based car number the user tapped, or null when none chosen. */
  readonly selectedCar: number | null;
}

let current: BoardingSelection | null = null;

/** Current boarding selection, or null when none is active. */
export const getBoardingSelection = (): BoardingSelection | null => current;

/** Record the boarding selection (stored as a copy to defend against mutation). */
export const setBoardingSelection = (selection: BoardingSelection): void => {
  current = { ...selection };
};

/** Clear any active boarding selection. */
export const clearBoardingSelection = (): void => {
  current = null;
};

/**
 * Whether `selection` belongs to the given station + line. Acts as a type guard
 * so callers narrow `BoardingSelection | null` to `BoardingSelection`.
 *
 * Prefers exact `stationId` equality; falls back to `stationName` when the
 * target carries no id (some navigation paths pass only a name).
 */
export const boardingSelectionMatches = (
  selection: BoardingSelection | null,
  target: { stationId?: string; stationName?: string; lineId: string }
): selection is BoardingSelection => {
  if (!selection) return false;
  if (selection.lineId !== target.lineId) return false;
  if (target.stationId && selection.stationId) {
    return selection.stationId === target.stationId;
  }
  return !!target.stationName && selection.stationName === target.stationName;
};
