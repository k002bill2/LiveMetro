/**
 * useGuidanceSession tests — reactive read of the guidance session singleton
 * via useSyncExternalStore. Uses the REAL store (not a mock) so the
 * subscribe/getSnapshot wiring is exercised end-to-end; AsyncStorage is mocked
 * by jest-expo so set/clear's fire-and-forget persistence is harmless here.
 */
import { renderHook, act } from '@testing-library/react-native';
import {
  setGuidanceSession,
  clearGuidanceSession,
} from '@services/guidance/guidanceSessionStore';
import { createRoute } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';
import { useGuidanceSession } from '../useGuidanceSession';

const makeSession = (): GuidanceSession => ({
  route: createRoute([
    {
      fromStationId: 's1',
      fromStationName: 'A',
      toStationId: 's2',
      toStationName: 'B',
      lineId: '2',
      lineName: '2호선',
      estimatedMinutes: 2,
      isTransfer: false,
    },
  ]),
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_700_000_000_000,
});

describe('useGuidanceSession', () => {
  beforeEach(() => {
    clearGuidanceSession();
  });
  afterEach(() => {
    clearGuidanceSession();
  });

  it('returns null when no session is active', () => {
    const { result } = renderHook(() => useGuidanceSession());
    expect(result.current).toBeNull();
  });

  it('reactively reflects a session set after mount', () => {
    const { result } = renderHook(() => useGuidanceSession());
    const session = makeSession();
    act(() => {
      setGuidanceSession(session);
    });
    expect(result.current).toEqual(session);
  });

  it('reactively returns to null after the session is cleared', () => {
    const { result } = renderHook(() => useGuidanceSession());
    act(() => {
      setGuidanceSession(makeSession());
    });
    act(() => {
      clearGuidanceSession();
    });
    expect(result.current).toBeNull();
  });
});
