/**
 * Real-time train position model (Seoul `realtimePosition` API).
 *
 * Distinct from arrival info (`Train`): a position row describes where a
 * train currently is along the whole line, not when it reaches one station.
 */
import type { Direction } from '@/models/route';

/**
 * Train status at/near its current station, from `trainSttus`:
 * '0' 진입, '1' 도착, '2' 출발, '3' 전역출발. Unknown codes map to 'unknown'.
 */
export type TrainPositionStatus =
  | 'entering'
  | 'arrived'
  | 'departed'
  | 'departed_prev'
  | 'unknown';

export interface TrainPosition {
  /** Train number (e.g. '2445') */
  readonly trainNo: string;
  /** Seoul subwayId as-is (e.g. '1002') */
  readonly subwayId: string;
  /** Seoul statnId of the current station as-is */
  readonly stationId: string;
  /** Normalized current station name (역 suffix stripped) */
  readonly stationName: string;
  /** Canonical direction — position API code '0' → up, '1' → down */
  readonly direction: Direction;
  /** Normalized terminal station name */
  readonly terminalName: string;
  readonly status: TrainPositionStatus;
  readonly isExpress: boolean;
  readonly isLastTrain: boolean;
  /** Server snapshot time (UTC ms) for staleness checks; null if unparsable */
  readonly receivedAt: number | null;
}

/** Localize a {@link TrainPositionStatus} for UI badges. */
export const positionStatusToDisplay = (status: TrainPositionStatus): string => {
  switch (status) {
    case 'entering':
      return '진입';
    case 'arrived':
      return '도착';
    case 'departed':
      return '출발';
    case 'departed_prev':
      return '전역 출발';
    default:
      return '운행중';
  }
};
