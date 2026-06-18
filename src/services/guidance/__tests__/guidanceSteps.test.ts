/**
 * guidanceSteps — Route → GuidanceStep[] 변환기 + 진행 계산 순수 함수.
 *
 * subwayMapData는 mock — 방면(direction) 계산이 결정적이도록 작은 가상
 * 네트워크를 쓴다: 2호선 [s1 A, s2 B, s3 C], 7호선 [s3 C, t2 D, t3 E].
 * s3(C)가 환승역.
 */
import {
  routeToGuidanceSteps,
  computeProgress,
  computeRemainingSeconds,
  computeRideProgress,
} from '../guidanceSteps';
import { getLegDirection, getRouteDirection } from '@/services/route/routeMeta';
import { createRoute, type RouteSegment } from '@/models/route';
import type { GuidanceStep, RideStep } from '@/models/guidance';

jest.mock('@/utils/subwayMapData', () => ({
  LINE_STATIONS: {
    '2': [['s1', 's2', 's3']],
    '7': [['s3', 't2', 't3']],
  },
  STATIONS: {
    s1: { name: 'A' },
    s2: { name: 'B' },
    s3: { name: 'C' },
    t2: { name: 'D' },
    t3: { name: 'E' },
  },
}));

const hop = (
  fromId: string,
  fromName: string,
  toId: string,
  toName: string,
  lineId: string,
  minutes: number
): RouteSegment => ({
  fromStationId: fromId,
  fromStationName: fromName,
  toStationId: toId,
  toStationName: toName,
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: minutes,
  isTransfer: false,
});

const transferSeg = (
  stationId: string,
  stationName: string,
  toLineId: string,
  minutes: number
): RouteSegment => ({
  fromStationId: stationId,
  fromStationName: stationName,
  toStationId: stationId,
  toStationName: stationName,
  lineId: toLineId,
  lineName: `${toLineId}호선`,
  estimatedMinutes: minutes,
  isTransfer: true,
});

/** A(s1) → C(s3) on line 2 — 2 hops, no transfer. */
const directRoute = createRoute([
  hop('s1', 'A', 's2', 'B', '2', 2),
  hop('s2', 'B', 's3', 'C', '2', 3),
]);

/** A(s1) → C(s3) on line 2, transfer at C, C(s3) → E(t3) on line 7. */
const transferRoute = createRoute([
  hop('s1', 'A', 's2', 'B', '2', 2),
  hop('s2', 'B', 's3', 'C', '2', 3),
  transferSeg('s3', 'C', '7', 4),
  hop('s3', 'C', 't2', 'D', '7', 2),
  hop('t2', 'D', 't3', 'E', '7', 2),
]);

describe('routeToGuidanceSteps', () => {
  it('converts a no-transfer route into [board, ride, alight]', () => {
    const steps = routeToGuidanceSteps(directRoute);
    expect(steps.map(s => s.kind)).toEqual(['board', 'ride', 'alight']);

    const board = steps[0]!;
    expect(board).toMatchObject({
      kind: 'board',
      stationId: 's1',
      stationName: 'A',
      lineId: '2',
      direction: 'C', // line 2 endpoint in travel direction
      durationMinutes: 0,
    });

    const ride = steps[1] as RideStep;
    expect(ride.fromStationName).toBe('A');
    expect(ride.toStationName).toBe('C');
    expect(ride.durationMinutes).toBe(5);
    expect(ride.hops).toEqual([
      { toStationId: 's2', toStationName: 'B', minutes: 2 },
      { toStationId: 's3', toStationName: 'C', minutes: 3 },
    ]);

    expect(steps[2]).toMatchObject({ kind: 'alight', stationId: 's3', stationName: 'C' });
  });

  it('converts a 1-transfer route into [board, ride, transfer, ride, alight]', () => {
    const steps = routeToGuidanceSteps(transferRoute);
    expect(steps.map(s => s.kind)).toEqual(['board', 'ride', 'transfer', 'ride', 'alight']);

    expect(steps[2]).toMatchObject({
      kind: 'transfer',
      stationId: 's3',
      stationName: 'C',
      fromLineId: '2',
      toLineId: '7',
      direction: 'E', // line 7 endpoint in travel direction
      durationMinutes: 4,
    });

    const secondRide = steps[3] as RideStep;
    expect(secondRide.lineId).toBe('7');
    expect(secondRide.hops.map(h => h.toStationName)).toEqual(['D', 'E']);
  });

  it('preserves invariants: durations sum to totalMinutes, transfer steps match transferCount', () => {
    for (const route of [directRoute, transferRoute]) {
      const steps = routeToGuidanceSteps(route);
      const sum = steps.reduce((acc, s) => acc + s.durationMinutes, 0);
      expect(sum).toBe(route.totalMinutes);
      expect(steps.filter(s => s.kind === 'transfer')).toHaveLength(route.transferCount);
    }
  });

  it('assigns unique stable ids', () => {
    const steps = routeToGuidanceSteps(transferRoute);
    const ids = steps.map(s => s.id);
    expect(new Set(ids).size).toBe(steps.length);
  });

  it('returns [] for an empty route', () => {
    expect(routeToGuidanceSteps(createRoute([]))).toEqual([]);
  });

  it('returns [] for a malformed route with only transfer segments', () => {
    expect(routeToGuidanceSteps(createRoute([transferSeg('s3', 'C', '7', 4)]))).toEqual([]);
  });
});

describe('computeProgress', () => {
  const steps: readonly GuidanceStep[] = routeToGuidanceSteps(transferRoute);
  const directSteps: readonly GuidanceStep[] = routeToGuidanceSteps(directRoute);
  // kinds:    [board, ride(5m), transfer(4m), ride(4m), alight]
  // indices:  [0,     1,        2,            3,        4]

  it('holds on a board step regardless of elapsed time', () => {
    const p = computeProgress(steps, 0, 10_000);
    expect(p.currentIndex).toBe(0);
    expect(p.isHolding).toBe(true);
  });

  it('stays within the active ride while elapsed < duration', () => {
    const p = computeProgress(steps, 1, 120); // 2min into a 5min ride
    expect(p.currentIndex).toBe(1);
    expect(p.isHolding).toBe(false);
    expect(p.elapsedInStepSec).toBe(120);
  });

  it('holds on a transfer step instead of auto-advancing through it', () => {
    // 5min ride consumed (300s) + 300s more; parks (holds) at the transfer
    // (index 2), never carrying time past it — board-hold honesty for the
    // unestimable transfer-train wait.
    const p = computeProgress(steps, 1, 600);
    expect(p.currentIndex).toBe(2);
    expect(p.isHolding).toBe(true);
    expect(p.elapsedInStepSec).toBe(300);
  });

  it('holds at a transfer with the walk partially elapsed', () => {
    // anchor directly on the transfer (index 2), 120s into the 240s walk
    const p = computeProgress(steps, 2, 120);
    expect(p.currentIndex).toBe(2);
    expect(p.isHolding).toBe(true);
    expect(p.elapsedInStepSec).toBe(120);
  });

  it('stops at the terminal alight step when elapsed exceeds everything (no-transfer route)', () => {
    const p = computeProgress(directSteps, 1, 99_999);
    expect(p.currentIndex).toBe(2);
  });

  it('clamps an out-of-range anchor index', () => {
    expect(computeProgress(steps, -3, 0).currentIndex).toBe(0);
    expect(computeProgress(steps, 99, 0).currentIndex).toBe(4);
  });

  it('returns a safe zero snapshot for empty steps', () => {
    expect(computeProgress([], 0, 100)).toEqual({
      currentIndex: 0,
      isHolding: false,
      elapsedInStepSec: 0,
    });
  });
});

describe('computeRemainingSeconds', () => {
  const steps: readonly GuidanceStep[] = routeToGuidanceSteps(transferRoute);
  const directSteps: readonly GuidanceStep[] = routeToGuidanceSteps(directRoute);

  it('excludes unknown platform wait while holding on board', () => {
    const p = computeProgress(steps, 0, 300);
    // board(0) + ride 5m + transfer 4m + ride 4m + alight(0) = 13m
    expect(computeRemainingSeconds(steps, p)).toBe(13 * 60);
  });

  it('subtracts elapsed time inside the active ride', () => {
    const p = computeProgress(steps, 1, 120);
    // (5m - 2m) + 4m + 4m = 11m
    expect(computeRemainingSeconds(steps, p)).toBe(11 * 60);
  });

  it('counts the known transfer walk while holding, then downstream', () => {
    // held at the transfer (index 2), 120s into the 240s walk
    const p = computeProgress(steps, 2, 120);
    // (4m - 2m) walk + 4m ride + alight(0) = 6m
    expect(computeRemainingSeconds(steps, p)).toBe(6 * 60);
  });

  it('floors the transfer walk to zero once it fully elapses (unknown train wait excluded)', () => {
    const p = computeProgress(steps, 2, 600); // 600s > 240s walk
    // walk floored to 0 + 4m downstream ride = 4m
    expect(computeRemainingSeconds(steps, p)).toBe(4 * 60);
  });

  it('returns 0 at the terminal step (no-transfer route)', () => {
    const p = computeProgress(directSteps, 1, 99_999);
    expect(computeRemainingSeconds(directSteps, p)).toBe(0);
  });
});

describe('computeRideProgress', () => {
  const steps = routeToGuidanceSteps(transferRoute);
  const ride = steps[1] as RideStep; // hops: B(2m), C(3m)

  it('counts down to the first stop', () => {
    expect(computeRideProgress(ride, 60)).toEqual({ nextHopIndex: 0, secToNextStop: 60 });
  });

  it('moves to the next hop after passing a stop', () => {
    // 2m(120s) passed B; 30s into the 3m hop to C → 150s left
    expect(computeRideProgress(ride, 150)).toEqual({ nextHopIndex: 1, secToNextStop: 150 });
  });

  it('clamps to the last hop with 0 seconds when elapsed overruns', () => {
    expect(computeRideProgress(ride, 9_999)).toEqual({ nextHopIndex: 1, secToNextStop: 0 });
  });
});

describe('getLegDirection (routeMeta)', () => {
  it('returns the forward endpoint name for a forward leg', () => {
    expect(getLegDirection('2', 's1', 's3')).toBe('C');
  });

  it('returns the backward endpoint name for a backward leg', () => {
    expect(getLegDirection('7', 't3', 's3')).toBe('C');
  });

  it('returns null for an unknown line', () => {
    expect(getLegDirection('99', 's1', 's3')).toBeNull();
  });

  it('returns null when a station is not on the line', () => {
    expect(getLegDirection('2', 's1', 't3')).toBeNull();
  });
});

describe('getRouteDirection regression (delegates to getLegDirection)', () => {
  it('still resolves direction for a single-leg route', () => {
    expect(getRouteDirection(directRoute)).toBe('C');
  });

  it('still returns null for transfer routes', () => {
    expect(getRouteDirection(transferRoute)).toBeNull();
  });
});
