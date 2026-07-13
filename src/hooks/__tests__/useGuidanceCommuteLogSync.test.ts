/**
 * useGuidanceCommuteLogSync — starts a commute-log departure row for every
 * ACTIVE guidance session (both entry points + restored sessions).
 *
 * X1 focus: the start path must be gated on localCompletedAt. W1's local-
 * completion emit re-runs this effect; if commuteLogId hasn't attached yet
 * (transient Firestore failure), reaching isAtEnd would otherwise start a
 * duplicate / departure-only log while the screen concurrently completes.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { startGuidanceCommuteLog } from '@/services/guidance/guidanceCommuteLogService';
import { useGuidanceCommuteLogSync } from '../useGuidanceCommuteLogSync';
import { createRoute, type RouteSegment } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@/services/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useGuidanceSession', () => ({ useGuidanceSession: jest.fn() }));
jest.mock('@/services/guidance/guidanceCommuteLogService', () => ({
  startGuidanceCommuteLog: jest.fn(() => Promise.resolve()),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseSession = useGuidanceSession as jest.Mock;
const mockStart = startGuidanceCommuteLog as jest.Mock;

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

describe('useGuidanceCommuteLogSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
  });

  it('starts a departure log for an active session (regression: no marker)', () => {
    mockUseSession.mockReturnValue(makeSession());
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith('u1', expect.objectContaining({ startedAt: 1_000 }));
  });

  it('does not start a log for a session already marked locally completed (X1)', () => {
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseSession.mockReturnValue(makeSession());
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start when the log is already attached (commuteLogId)', () => {
    mockUseSession.mockReturnValue(makeSession({ commuteLogId: 'log-1' }));
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start when the session is already remotely completed', () => {
    mockUseSession.mockReturnValue(makeSession({ commuteLogCompletedAt: 9_999 }));
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start a DUPLICATE log when isAtEnd marks localCompletedAt before commuteLogId attaches (X1)', async () => {
    // 1) Active session; the first start fails transiently → no commuteLogId
    //    attaches and the in-flight guard is released (so the identity-key dedup
    //    alone would NOT block a second start — only the X1 gate does).
    mockStart.mockRejectedValueOnce(new Error('firestore unavailable'));
    mockUseSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());
    expect(mockStart).toHaveBeenCalledTimes(1);

    // Flush the rejected promise's catch/finally to clear the in-flight key.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 2) W1 emits localCompletedAt (still no commuteLogId). Without the gate the
    //    effect would re-run and start a duplicate departure-only log.
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    rerender(undefined);

    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});
