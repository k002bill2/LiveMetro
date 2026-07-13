/**
 * useGuidanceAlertCleanupSync — cancels guidance alerts on session END (not
 * screen unmount) + a hydration-gated one-shot orphan sweep.
 *
 * The store, session hook, and both alert services are mocked at their module
 * boundaries so each trigger can be driven deterministically. `subscribe` is
 * given a capturing implementation so a boot-hydration emit can be simulated.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useGuidanceAlertCleanupSync } from '../useGuidanceAlertCleanupSync';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  getGuidanceSession,
  subscribe,
  isGuidanceSessionHydrated,
} from '@/services/guidance/guidanceSessionStore';
import { cancelBoardingAlert } from '@/services/notification/boardingAlertService';
import { cancelAlightAlert } from '@/services/notification/alightAlertService';
import { createRoute, type RouteSegment } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@/hooks/useGuidanceSession', () => ({
  useGuidanceSession: jest.fn(),
}));

jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  getGuidanceSession: jest.fn(),
  subscribe: jest.fn(),
  isGuidanceSessionHydrated: jest.fn(),
}));

jest.mock('@/services/notification/boardingAlertService', () => ({
  cancelBoardingAlert: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/notification/alightAlertService', () => ({
  cancelAlightAlert: jest.fn(() => Promise.resolve()),
}));

const mockUseGuidanceSession = useGuidanceSession as jest.Mock;
const mockGetGuidanceSession = getGuidanceSession as jest.Mock;
const mockSubscribe = subscribe as jest.Mock;
const mockIsHydrated = isGuidanceSessionHydrated as jest.Mock;
const mockCancelBoarding = cancelBoardingAlert as jest.Mock;
const mockCancelAlight = cancelAlightAlert as jest.Mock;

const seg: RouteSegment = {
  fromStationId: 's1',
  fromStationName: 'A',
  toStationId: 's2',
  toStationName: 'B',
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes: 2,
  isTransfer: false,
};

const makeSession = (extra: Partial<GuidanceSession> = {}): GuidanceSession => ({
  route: createRoute([seg]),
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_000,
  ...extra,
});

describe('useGuidanceAlertCleanupSync', () => {
  let listeners: (() => void)[] = [];
  const emit = (): void => {
    listeners.forEach((l) => l());
  };

  beforeEach(() => {
    jest.clearAllMocks();
    listeners = [];
    mockSubscribe.mockImplementation((cb: () => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    });
    // Defaults: nothing hydrated, no session — each test overrides as needed.
    mockIsHydrated.mockReturnValue(false);
    mockGetGuidanceSession.mockReturnValue(null);
    mockUseGuidanceSession.mockReturnValue(null);
  });

  describe('transition cleanup (active true→false)', () => {
    it('cancels both alerts when an active session goes to null', () => {
      mockUseGuidanceSession.mockReturnValue(makeSession());
      const { rerender } = renderHook(() => useGuidanceAlertCleanupSync());
      // Active on mount → no transition yet.
      expect(mockCancelBoarding).not.toHaveBeenCalled();
      expect(mockCancelAlight).not.toHaveBeenCalled();

      mockUseGuidanceSession.mockReturnValue(null);
      rerender(undefined);

      // End (→null) = full cancel, no keepSessionKey.
      expect(mockCancelBoarding).toHaveBeenCalledWith(undefined);
      expect(mockCancelAlight).toHaveBeenCalledWith(undefined);
      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);
    });

    it('cancels both alerts when commuteLogCompletedAt is set (active→completed)', () => {
      mockUseGuidanceSession.mockReturnValue(makeSession());
      const { rerender } = renderHook(() => useGuidanceAlertCleanupSync());

      mockUseGuidanceSession.mockReturnValue(makeSession({ commuteLogCompletedAt: 9_999 }));
      rerender(undefined);

      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);
    });

    it('does not cancel while the session stays active (identity churn from anchor persistence)', () => {
      mockUseGuidanceSession.mockReturnValue(makeSession({ startedAt: 1_000 }));
      const { rerender } = renderHook(() => useGuidanceAlertCleanupSync());

      // A new object with the same active status (progress anchor persisted).
      mockUseGuidanceSession.mockReturnValue(
        makeSession({ startedAt: 1_000, progressAnchor: { stepIndex: 1, atMs: 2 } })
      );
      rerender(undefined);

      expect(mockCancelBoarding).not.toHaveBeenCalled();
      expect(mockCancelAlight).not.toHaveBeenCalled();
    });

    it('cancels with keepSessionKey (new key) when one active session replaces another', () => {
      mockUseGuidanceSession.mockReturnValue(makeSession({ startedAt: 1_000 }));
      const { rerender } = renderHook(() => useGuidanceAlertCleanupSync());

      // A different journey (new startedAt) starts without ending the old one —
      // the new session's just-scheduled alerts must be preserved.
      mockUseGuidanceSession.mockReturnValue(makeSession({ startedAt: 2_000 }));
      rerender(undefined);

      expect(mockCancelBoarding).toHaveBeenCalledWith({ keepSessionKey: '2000' });
      expect(mockCancelAlight).toHaveBeenCalledWith({ keepSessionKey: '2000' });
    });
  });

  describe('orphan cleanup (hydration-gated one-shot)', () => {
    it('does not clean up when mounted before hydration completes', () => {
      mockIsHydrated.mockReturnValue(false);
      mockGetGuidanceSession.mockReturnValue(null);
      renderHook(() => useGuidanceAlertCleanupSync());

      expect(mockCancelBoarding).not.toHaveBeenCalled();
      expect(mockCancelAlight).not.toHaveBeenCalled();
      // The hook subscribed so it can react once hydration finishes.
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it('sweeps orphans exactly once when hydration completes with no session', () => {
      renderHook(() => useGuidanceAlertCleanupSync());
      expect(mockCancelBoarding).not.toHaveBeenCalled();

      // Hydration finished, nothing restored.
      mockIsHydrated.mockReturnValue(true);
      mockGetGuidanceSession.mockReturnValue(null);
      act(() => emit());

      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);

      // Later emits must not re-sweep.
      act(() => emit());
      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);
    });

    it('does not sweep when hydration restores an active session', () => {
      renderHook(() => useGuidanceAlertCleanupSync());

      mockIsHydrated.mockReturnValue(true);
      mockGetGuidanceSession.mockReturnValue(makeSession());
      act(() => emit());

      expect(mockCancelBoarding).not.toHaveBeenCalled();
      expect(mockCancelAlight).not.toHaveBeenCalled();
    });

    it('sweeps once when mounted after hydration already completed with no session', () => {
      mockIsHydrated.mockReturnValue(true);
      mockGetGuidanceSession.mockReturnValue(null);
      renderHook(() => useGuidanceAlertCleanupSync());

      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);
    });

    it('sweeps when a restored session is already completed (inactive)', () => {
      mockIsHydrated.mockReturnValue(true);
      mockGetGuidanceSession.mockReturnValue(makeSession({ commuteLogCompletedAt: 5 }));
      renderHook(() => useGuidanceAlertCleanupSync());

      expect(mockCancelBoarding).toHaveBeenCalledTimes(1);
      expect(mockCancelAlight).toHaveBeenCalledTimes(1);
    });
  });

  it('unsubscribes on unmount (subscription-cleanup rule)', () => {
    const { unmount } = renderHook(() => useGuidanceAlertCleanupSync());
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
