/**
 * departureDetection — infer "the awaited train has departed" from successive
 * realtime snapshots, with no GPS.
 *
 * Departed trains (Seoul API `arvlCd === '2'`) are filtered out before they
 * reach `useRealtimeTrains`, so departure is not directly observable. Instead
 * we infer it: a train that was *arriving* (ETA within a small threshold) in
 * the previous snapshot and is *absent* from the next snapshot has left the
 * platform. `Train.id` is `btrainNo`-based and poll-stable, so id disappearance
 * is the signal.
 *
 * Governing principle: a false positive (auto-advancing a journey that did not
 * depart) is the costly error; a false negative just falls back to the manual
 * tap. The gate is deliberately conservative.
 *
 * Pure / timer-free / RN-free — unit-tested like guidanceSteps.ts.
 */
import type { Train } from '@/models/train';

/** ETA window (seconds) treated as "arriving / at the platform" (arvlCd '0'/'1'). */
export const ARRIVING_ETA_THRESHOLD_SEC = 30;

export interface AwaitedTrain {
  /** Line being waited on (board.lineId | transfer.toLineId). */
  readonly lineId: string;
  /** Best-effort travel-direction endpoint name ("OO 방면"), or null. */
  readonly directionName: string | null;
}

export interface DepartureDetectionInput {
  /** Previous successful snapshot, or null on the first poll for this step. */
  readonly prev: readonly Train[] | null;
  /** Current successful snapshot. */
  readonly next: readonly Train[];
  readonly awaited: AwaitedTrain;
  /** Shared 1Hz clock used to derive ETA from arrivalTime. */
  readonly nowMs: number;
  readonly thresholdSec?: number;
}

export interface DepartureDetectionResult {
  readonly departed: boolean;
  /** The id inferred as departed (for cooldown keying), or null. */
  readonly trainId: string | null;
}

const NOT_DEPARTED: DepartureDetectionResult = { departed: false, trainId: null };

const isNumberedLine = (lineId: string): boolean => /^[1-9]$/.test(lineId);

const etaSeconds = (train: Train, nowMs: number): number | null =>
  train.arrivalTime === null ? null : Math.floor((train.arrivalTime.getTime() - nowMs) / 1000);

/**
 * Returns whether the awaited train departed between `prev` and `next`, and
 * which train id it was. Returns not-departed for the first snapshot, empty
 * inputs, or any case that fails the conservative gate.
 */
export const detectDeparture = (input: DepartureDetectionInput): DepartureDetectionResult => {
  const { prev, next, awaited, nowMs, thresholdSec = ARRIVING_ETA_THRESHOLD_SEC } = input;

  if (prev === null || prev.length === 0) return NOT_DEPARTED;

  const numbered = isNumberedLine(awaited.lineId);

  // Extended (non-numbered) lines bypass the numeric line filter, so the
  // candidate pool mixes lines at a transfer station. Require a direction match
  // to disambiguate; without one, degrade to manual rather than risk a false advance.
  if (!numbered && awaited.directionName === null) return NOT_DEPARTED;

  const onLine = (train: Train): boolean => (numbered ? train.lineId === awaited.lineId : true);

  const directionMatches = (train: Train): boolean =>
    awaited.directionName === null ? true : train.finalDestination === awaited.directionName;

  // A candidate was "arriving" (0 ≤ ETA ≤ threshold) on the awaited line in `prev`.
  const qualifies = (train: Train): boolean => {
    if (!onLine(train)) return false;
    const eta = etaSeconds(train, nowMs);
    if (eta === null || eta < 0 || eta > thresholdSec) return false;
    // Extended lines demand a strong direction match; numbered lines rely on
    // the line filter (direction is applied as best-effort narrowing below).
    return numbered ? true : directionMatches(train);
  };

  const candidates = prev.filter(qualifies);
  if (candidates.length === 0) return NOT_DEPARTED;

  // Numbered-line best-effort narrowing: prefer the awaited direction when any
  // candidate matches, but don't drop everything when none do (endpoint name vs
  // short-turn terminus can legitimately differ).
  const preferred =
    numbered && awaited.directionName !== null ? candidates.filter(directionMatches) : candidates;
  const pool = preferred.length > 0 ? preferred : candidates;

  const nextIds = new Set(next.map(t => t.id));
  const departed = pool.find(t => !nextIds.has(t.id));

  return departed ? { departed: true, trainId: departed.id } : NOT_DEPARTED;
};
