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

// [board, ride(5m: B 2m + C 3m), alight] on line 2
const steps = routeToGuidanceSteps(
  createRoute([hop('s1', 'A', 's2', 'B', '2', 2), hop('s2', 'B', 's3', 'C', '2', 3)])
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
});
