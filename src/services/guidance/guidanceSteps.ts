/**
 * guidanceSteps — pure transforms powering the live navigation screen.
 *
 * `routeToGuidanceSteps` reshapes a per-hop {@link Route} into actionable
 * steps (board → ride → (transfer → ride)* → alight), keeping each ride's
 * per-hop breakdown so the NOW card can count down to the next stop.
 *
 * Progress over those steps is computed from a manual anchor (the step the
 * user last confirmed) plus elapsed wall-clock seconds — subway GPS is
 * unreliable underground, so time-based estimation with manual correction is
 * the tracking model. All functions here are pure; the hook layer stays thin.
 */
import { getLegDirection } from '@/services/route/routeMeta';
import type { Route, RouteSegment } from '@/models/route';
import type { GuidanceHop, GuidanceStep, RideStep } from '@/models/guidance';

interface RidePart {
  readonly kind: 'ride';
  readonly lineId: string;
  readonly lineName: string;
  readonly fromStationId: string;
  readonly fromStationName: string;
  toStationId: string;
  toStationName: string;
  readonly hops: GuidanceHop[];
}

interface TransferPart {
  readonly kind: 'transfer';
  readonly seg: RouteSegment;
}

type RoutePart = RidePart | TransferPart;

/** Coalesce per-hop segments into ride legs split by transfer markers. */
const segmentsToParts = (segments: readonly RouteSegment[]): RoutePart[] => {
  const parts: RoutePart[] = [];
  for (const seg of segments) {
    if (seg.isTransfer) {
      parts.push({ kind: 'transfer', seg });
      continue;
    }
    const last = parts[parts.length - 1];
    const hopEntry: GuidanceHop = {
      toStationId: seg.toStationId,
      toStationName: seg.toStationName,
      minutes: seg.estimatedMinutes,
    };
    if (last && last.kind === 'ride' && last.lineId === seg.lineId) {
      last.hops.push(hopEntry);
      last.toStationId = seg.toStationId;
      last.toStationName = seg.toStationName;
    } else {
      parts.push({
        kind: 'ride',
        lineId: seg.lineId,
        lineName: seg.lineName,
        fromStationId: seg.fromStationId,
        fromStationName: seg.fromStationName,
        toStationId: seg.toStationId,
        toStationName: seg.toStationName,
        hops: [hopEntry],
      });
    }
  }
  return parts;
};

const ridePartDuration = (part: RidePart): number =>
  part.hops.reduce((acc, h) => acc + h.minutes, 0);

/**
 * Convert a routed {@link Route} into the guidance step sequence.
 * Returns [] for empty or malformed input (no throw — project error policy).
 */
export const routeToGuidanceSteps = (route: Route): GuidanceStep[] => {
  const parts = segmentsToParts(route.segments);
  if (!parts.some(p => p.kind === 'ride')) return [];

  const steps: GuidanceStep[] = [];
  let prevRide: RidePart | null = null;

  parts.forEach((part, i) => {
    if (part.kind === 'ride') {
      const direction = getLegDirection(part.lineId, part.fromStationId, part.toStationId);
      if (!prevRide) {
        steps.push({
          kind: 'board',
          id: `board-${steps.length}`,
          stationId: part.fromStationId,
          stationName: part.fromStationName,
          lineId: part.lineId,
          lineName: part.lineName,
          direction,
          durationMinutes: 0,
        });
      }
      steps.push({
        kind: 'ride',
        id: `ride-${steps.length}`,
        lineId: part.lineId,
        lineName: part.lineName,
        fromStationId: part.fromStationId,
        fromStationName: part.fromStationName,
        toStationId: part.toStationId,
        toStationName: part.toStationName,
        hops: [...part.hops],
        direction,
        durationMinutes: ridePartDuration(part),
      });
      prevRide = part;
      return;
    }
    // Transfer: meaningful only between two ride legs.
    if (!prevRide) return;
    const nextRide = parts.slice(i + 1).find((p): p is RidePart => p.kind === 'ride');
    if (!nextRide) return;
    steps.push({
      kind: 'transfer',
      id: `transfer-${steps.length}`,
      stationId: part.seg.fromStationId,
      stationName: part.seg.fromStationName,
      fromLineId: prevRide.lineId,
      toLineId: part.seg.lineId,
      toLineName: part.seg.lineName,
      direction: getLegDirection(nextRide.lineId, nextRide.fromStationId, nextRide.toStationId),
      durationMinutes: part.seg.estimatedMinutes,
    });
  });

  const lastRide = prevRide as RidePart | null;
  if (!lastRide) return [];
  steps.push({
    kind: 'alight',
    id: `alight-${steps.length}`,
    stationId: lastRide.toStationId,
    stationName: lastRide.toStationName,
    lineId: lastRide.lineId,
    durationMinutes: 0,
  });

  return steps;
};

/** Snapshot of where the rider is within the step sequence. */
export interface GuidanceProgress {
  readonly currentIndex: number;
  /** True while parked on a board OR transfer step (auto-progress can't pass it). */
  readonly isHolding: boolean;
  /** Seconds spent inside the current step (waiting seconds while holding). */
  readonly elapsedInStepSec: number;
}

/**
 * Resolve the active step from a manual anchor + elapsed seconds since it.
 * Board AND transfer steps block auto-progress: waiting for the first/transfer
 * train is realtime, not estimable, so time can never carry the rider past
 * them (only a manual/soft confirm rebases the anchor). The known transfer-walk
 * minutes still tick down in `computeRemainingSeconds`; only the unknown
 * platform wait is excluded. The terminal alight step absorbs any overrun.
 */
export const computeProgress = (
  steps: readonly GuidanceStep[],
  anchorIndex: number,
  elapsedSec: number
): GuidanceProgress => {
  if (steps.length === 0) {
    return { currentIndex: 0, isHolding: false, elapsedInStepSec: 0 };
  }
  let i = Math.min(Math.max(anchorIndex, 0), steps.length - 1);
  let remaining = Math.max(0, elapsedSec);
  for (; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.kind === 'board' || step.kind === 'transfer') {
      return { currentIndex: i, isHolding: true, elapsedInStepSec: remaining };
    }
    if (step.kind === 'alight') {
      return { currentIndex: i, isHolding: false, elapsedInStepSec: remaining };
    }
    const durationSec = step.durationMinutes * 60;
    if (remaining < durationSec) {
      return { currentIndex: i, isHolding: false, elapsedInStepSec: remaining };
    }
    remaining -= durationSec;
  }
  return { currentIndex: steps.length - 1, isHolding: false, elapsedInStepSec: 0 };
};

/**
 * Seconds left to the destination. Platform wait while holding on a board
 * step is unknown (realtime), so it is excluded — the screen shows the live
 * train ETA separately instead of faking it here.
 */
export const computeRemainingSeconds = (
  steps: readonly GuidanceStep[],
  progress: GuidanceProgress
): number => {
  let total = 0;
  steps.forEach((step, i) => {
    if (i < progress.currentIndex) return;
    const durationSec = step.durationMinutes * 60;
    if (i === progress.currentIndex) {
      if (step.kind === 'board') return;
      total += Math.max(0, durationSec - progress.elapsedInStepSec);
      return;
    }
    total += durationSec;
  });
  return Math.round(total);
};

/** Position within an active ride: which stop is next and seconds until it. */
export interface RideProgress {
  readonly nextHopIndex: number;
  readonly secToNextStop: number;
}

export const computeRideProgress = (step: RideStep, elapsedInStepSec: number): RideProgress => {
  let boundary = 0;
  for (let i = 0; i < step.hops.length; i++) {
    boundary += step.hops[i]!.minutes * 60;
    if (elapsedInStepSec < boundary) {
      return { nextHopIndex: i, secToNextStop: Math.ceil(boundary - elapsedInStepSec) };
    }
  }
  return { nextHopIndex: Math.max(0, step.hops.length - 1), secToNextStop: 0 };
};
