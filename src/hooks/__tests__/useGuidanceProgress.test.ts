/**
 * useGuidanceProgress — 1Hz tick + anchor-rebase progress tracking.
 * Modern fake timers drive both Date.now and the interval.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useGuidanceProgress } from '../useGuidanceProgress';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import { createRoute, type RouteSegment } from '@/models/route';

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

// [board, ride(5m: B 2m + C 3m), alight] on line 2
const steps = routeToGuidanceSteps(
  createRoute([hop('s1', 'A', 's2', 'B', '2', 2), hop('s2', 'B', 's3', 'C', '2', 3)])
);

// [board, ride(10m: B 4m + C 6m), alight] — long enough that 5min elapsed lands
// mid-ride (proves a past anchor took effect without reaching alight).
const longRideSteps = routeToGuidanceSteps(
  createRoute([hop('s1', 'A', 's2', 'B', '2', 4), hop('s2', 'B', 's3', 'C', '2', 6)])
);

// [board, ride(5m), transfer(4m), ride(4m), alight] — line 2 → transfer at C → line 7
const transferSteps = routeToGuidanceSteps(
  createRoute([
    hop('s1', 'A', 's2', 'B', '2', 2),
    hop('s2', 'B', 's3', 'C', '2', 3),
    transferSeg('s3', 'C', '7', 4),
    hop('s3', 'C', 't2', 'D', '7', 2),
    hop('t2', 'D', 't3', 'E', '7', 2),
  ])
);

const T0 = 1_700_000_000_000;

describe('useGuidanceProgress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts holding on the board step and stays there as time passes', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isHolding).toBe(true);

    act(() => {
      jest.advanceTimersByTime(120_000); // 2 minutes on the platform
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isHolding).toBe(true);
  });

  it('goNext rebases onto the ride and time then auto-advances to alight', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    act(() => {
      result.current.goNext(); // 탑승했어요 → ride
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isHolding).toBe(false);

    act(() => {
      jest.advanceTimersByTime(5 * 60_000 + 1_000); // ride is 5 minutes
    });
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isAtEnd).toBe(true);
  });

  it('holds on a transfer step until goNext (does not auto-advance through it)', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(transferSteps, { startedAt: T0, enabled: true })
    );
    act(() => {
      result.current.goNext(); // 탑승했어요 → ride
    });
    expect(result.current.currentIndex).toBe(1);

    // Advance well past the 5min ride AND the 4min transfer walk.
    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });
    // Parked (holds) on the transfer (index 2), never carried into the line-7 ride.
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isHolding).toBe(true);

    // Only a manual / soft confirm advances past it.
    act(() => {
      result.current.goNext();
    });
    expect(result.current.currentIndex).toBe(3);
    expect(result.current.isHolding).toBe(false);
  });

  it('counts down remainingSeconds inside the active ride', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    act(() => {
      result.current.goNext();
    });
    expect(result.current.remainingSeconds).toBe(5 * 60);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.remainingSeconds).toBe(4 * 60);
    expect(result.current.etaMs).toBe(T0 + 60_000 + 4 * 60_000);
  });

  it('goPrev clamps at the first step', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    act(() => {
      result.current.goPrev();
    });
    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goPrev();
    });
    expect(result.current.currentIndex).toBe(0);
  });

  it('goNext clamps at the terminal step', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goNext(); // beyond the end — must clamp
    });
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isAtEnd).toBe(true);
  });

  it('does not create a timer when disabled', () => {
    renderHook(() => useGuidanceProgress(steps, { startedAt: T0, enabled: false }));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() =>
      useGuidanceProgress(steps, { startedAt: T0, enabled: true })
    );
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns a safe snapshot for empty steps', () => {
    const { result } = renderHook(() =>
      useGuidanceProgress([], { startedAt: T0, enabled: true })
    );
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isAtEnd).toBe(false);
  });

  describe('goNextAt / rebaseAt (past-anchor rebase)', () => {
    it('goNextAt(now - 5min) advances into the ride and reflects 5min elapsed', () => {
      const { result } = renderHook(() =>
        useGuidanceProgress(longRideSteps, { startedAt: T0, enabled: true })
      );
      act(() => {
        result.current.goNextAt(T0 - 5 * 60_000); // boarded 5min ago
      });
      expect(result.current.currentIndex).toBe(1); // still in the 10min ride, not alight
      expect(result.current.isHolding).toBe(false);
      expect(Math.round(result.current.elapsedInStepSec)).toBe(300);
    });

    it('goNextAt(now - 30min) does not punch through a transfer hold', () => {
      const { result } = renderHook(() =>
        useGuidanceProgress(transferSteps, { startedAt: T0, enabled: true })
      );
      act(() => {
        result.current.goNextAt(T0 - 30 * 60_000); // far past the 5min ride
      });
      // Carried through the ride but PARKED on the transfer (index 2).
      expect(result.current.currentIndex).toBe(2);
      expect(result.current.isHolding).toBe(true);
    });

    it('goNextAt(now + 10min) clamps a future anchor to now (no jump)', () => {
      const { result } = renderHook(() =>
        useGuidanceProgress(longRideSteps, { startedAt: T0, enabled: true })
      );
      act(() => {
        result.current.goNextAt(T0 + 10 * 60_000);
      });
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.elapsedInStepSec).toBeLessThan(5);
    });

    it('rebaseAt(now - 3min) keeps the current index and sets elapsed to ~180s', () => {
      const { result } = renderHook(() =>
        useGuidanceProgress(longRideSteps, { startedAt: T0, enabled: true })
      );
      act(() => {
        result.current.goNext(); // board → ride
      });
      expect(result.current.currentIndex).toBe(1);
      act(() => {
        result.current.rebaseAt(T0 - 3 * 60_000);
      });
      expect(result.current.currentIndex).toBe(1); // index unchanged
      expect(Math.round(result.current.elapsedInStepSec)).toBe(180);
    });
  });
});
