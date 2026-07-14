/**
 * useGuidanceCommuteLogSync — owns commute-log departure + arrival writes for
 * guidance sessions.
 *
 * Coverage:
 *   - departure start gate (X1) — no departure-only log once locally completed.
 *   - live completion (Z1/AB2) — writes arrival when localCompletedAt is set,
 *     CREATING a completed log even with no commuteLogId; start/complete share an
 *     in-flight key so they can't double-write.
 *   - orphan recovery (AB3) — a failed completion is persisted to a single-slot
 *     outbox and drained (mount/emit), orphan-only, with a 7-day discard.
 *
 * The service, session hook, store read, and outbox are mocked at their module
 * boundaries so each path is driven deterministically.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import {
  startGuidanceCommuteLog,
  completeGuidanceCommuteLog,
} from '@/services/guidance/guidanceCommuteLogService';
import {
  savePendingCompletion,
  readPendingCompletion,
  clearPendingCompletionForSession,
  isPendingCompletionExpired,
} from '@/services/guidance/guidanceCompletionOutbox';
import { useGuidanceCommuteLogSync } from '../useGuidanceCommuteLogSync';
import { createRoute, type RouteSegment } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@/services/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useGuidanceSession', () => ({ useGuidanceSession: jest.fn() }));
jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  getGuidanceSession: jest.fn(() => null),
}));
jest.mock('@/services/guidance/guidanceCommuteLogService', () => ({
  startGuidanceCommuteLog: jest.fn(() => Promise.resolve()),
  completeGuidanceCommuteLog: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/guidance/guidanceCompletionOutbox', () => ({
  savePendingCompletion: jest.fn(() => Promise.resolve()),
  readPendingCompletion: jest.fn(() => Promise.resolve(null)),
  clearPendingCompletionForSession: jest.fn(() => Promise.resolve()),
  isPendingCompletionExpired: jest.fn(() => false),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseSession = useGuidanceSession as jest.Mock;
const mockGetSession = getGuidanceSession as jest.Mock;
const mockStart = startGuidanceCommuteLog as jest.Mock;
const mockComplete = completeGuidanceCommuteLog as jest.Mock;
const mockSave = savePendingCompletion as jest.Mock;
const mockRead = readPendingCompletion as jest.Mock;
const mockClearForSession = clearPendingCompletionForSession as jest.Mock;
const mockExpired = isPendingCompletionExpired as jest.Mock;

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

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

describe('useGuidanceCommuteLogSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockComplete.mockResolvedValue(undefined);
    mockSave.mockResolvedValue(undefined);
    mockRead.mockResolvedValue(null);
    mockClearForSession.mockResolvedValue(undefined);
    mockExpired.mockReturnValue(false);
    mockGetSession.mockReturnValue(null);
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseSession.mockReturnValue(null);
  });

  // --- departure start ---

  it('starts a departure log for an active session (regression: no marker)', () => {
    mockUseSession.mockReturnValue(makeSession());
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith('u1', expect.objectContaining({ startedAt: 1_000 }));
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

  // --- live completion (Z1 / AB2) ---

  it('completes (updates) an existing log for a locally-completed session with commuteLogId (Z1)', () => {
    const session = makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1' });
    mockUseSession.mockReturnValue(session);
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledWith('u1', session, 9_999);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('creates a COMPLETED log when locally completed with NO commuteLogId — logged in (AB2)', () => {
    // AB2 reverses the old X1 "no complete without a logId": a departure write
    // that never landed must still yield a completed log, not a permanent skip.
    const session = makeSession({ localCompletedAt: 9_999 });
    mockUseSession.mockReturnValue(session);
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledWith('u1', session, 9_999);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not complete a no-commuteLogId locally-completed session when signed out (AB2)', () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not complete when the session is already remotely completed (Z1)', () => {
    mockUseSession.mockReturnValue(
      makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1', commuteLogCompletedAt: 10_000 })
    );
    renderHook(() => useGuidanceCommuteLogSync());

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('routes to completion (not another start) when localCompletedAt is set after the departure write failed (AB2)', async () => {
    mockStart.mockRejectedValueOnce(new Error('firestore unavailable'));
    mockUseSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());
    expect(mockStart).toHaveBeenCalledTimes(1);

    await flush();

    // localCompletedAt now set, still no commuteLogId → completed-log CREATE via
    // the completion branch, NOT a second departure start.
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    rerender(undefined);

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('completes again on the next emit after a failed completion (Z1)', async () => {
    mockComplete.mockRejectedValueOnce(new Error('firestore unavailable'));
    const stillIncomplete = (): GuidanceSession =>
      makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1' });
    mockUseSession.mockReturnValue(stillIncomplete());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());
    expect(mockComplete).toHaveBeenCalledTimes(1);

    await flush();

    mockUseSession.mockReturnValue(stillIncomplete()); // next store emit
    rerender(undefined);
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });

  it('does not double-complete while one completion is in flight (Z1)', () => {
    mockComplete.mockReturnValue(new Promise(() => undefined));
    const stillIncomplete = (): GuidanceSession =>
      makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1' });
    mockUseSession.mockReturnValue(stillIncomplete());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());
    expect(mockComplete).toHaveBeenCalledTimes(1);

    mockUseSession.mockReturnValue(stillIncomplete()); // new emit, completion still pending
    rerender(undefined);
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  // --- departure chaining (AC1) ---

  it('chains completion onto an in-flight departure and completes ONCE after it settles (AC1)', async () => {
    let settleStart: (value: unknown) => void = () => undefined;
    mockStart.mockReturnValue(
      new Promise((resolve) => {
        settleStart = resolve;
      })
    );

    // 1) Active session → departure starts and stays pending.
    mockUseSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());
    expect(mockStart).toHaveBeenCalledTimes(1);

    // 2) Local completion arrives while departure is pending → chained, not fired.
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    rerender(undefined);
    await flush();
    expect(mockComplete).not.toHaveBeenCalled();

    // 3) Departure settles → the chained completion runs exactly once.
    await act(async () => {
      settleStart(null);
      await Promise.resolve();
    });
    await flush();
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ localCompletedAt: 9_999 }),
      9_999
    );
  });

  it('still completes after the in-flight departure REJECTS (AB2 create path, AC1)', async () => {
    let rejectStart: (reason: unknown) => void = () => undefined;
    mockStart.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectStart = reject;
      })
    );

    mockUseSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());

    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    rerender(undefined);
    await flush();
    expect(mockComplete).not.toHaveBeenCalled();

    await act(async () => {
      rejectStart(new Error('offline'));
      await Promise.resolve();
    });
    await flush();
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('chains a SINGLE completion when localCompleted emits twice while the departure is pending (AC1)', async () => {
    let settleStart: (value: unknown) => void = () => undefined;
    mockStart.mockReturnValue(
      new Promise((resolve) => {
        settleStart = resolve;
      })
    );

    mockUseSession.mockReturnValue(makeSession());
    const { rerender } = renderHook(() => useGuidanceCommuteLogSync());

    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 }));
    rerender(undefined);
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999 })); // fresh emit, still pending
    rerender(undefined);
    await flush();
    expect(mockComplete).not.toHaveBeenCalled();

    await act(async () => {
      settleStart(null);
      await Promise.resolve();
    });
    await flush();
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  // --- outbox: live-write failure persistence (AB3) ---

  it('saves the completion to the outbox when the live write fails (AB3)', async () => {
    mockComplete.mockRejectedValueOnce(new Error('offline'));
    const session = makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1' });
    mockUseSession.mockReturnValue(session);
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        session,
        arrivalAtMs: 9_999,
        savedAt: expect.any(Number),
      })
    );
  });

  it('clears its own outbox slot (keyed by session) when the live completion succeeds (AB3)', async () => {
    mockUseSession.mockReturnValue(makeSession({ localCompletedAt: 9_999, commuteLogId: 'log-1' }));
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockClearForSession).toHaveBeenCalledWith(1_000);
    expect(mockSave).not.toHaveBeenCalled();
  });

  // --- outbox: orphan drain (AB3) ---

  it('drains an orphaned outbox entry on mount and clears it on success (AB3)', async () => {
    const orphan = {
      userId: 'u1',
      session: makeSession({ startedAt: 1_000 }),
      arrivalAtMs: 8_888,
      savedAt: Date.now(),
    };
    mockRead.mockResolvedValue(orphan);
    mockGetSession.mockReturnValue(null); // no active session → orphan
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockComplete).toHaveBeenCalledWith('u1', orphan.session, 8_888);
    expect(mockClearForSession).toHaveBeenCalledWith(1_000);
  });

  it('keeps the outbox entry when the orphan drain write fails (AB3)', async () => {
    mockComplete.mockRejectedValue(new Error('still offline'));
    mockRead.mockResolvedValue({
      userId: 'u1',
      session: makeSession({ startedAt: 1_000 }),
      arrivalAtMs: 8_888,
      savedAt: Date.now(),
    });
    mockGetSession.mockReturnValue(null);
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockClearForSession).not.toHaveBeenCalled();
  });

  it('discards an expired outbox entry without completing it (AB3)', async () => {
    mockExpired.mockReturnValue(true);
    mockRead.mockResolvedValue({
      userId: 'u1',
      session: makeSession({ startedAt: 1_000 }),
      arrivalAtMs: 8_888,
      savedAt: 1,
    });
    mockGetSession.mockReturnValue(null);
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockClearForSession).toHaveBeenCalledWith(1_000);
  });

  it('skips draining an outbox entry that matches the ACTIVE session (orphan-only, AB3)', async () => {
    // The live branch owns the active session; draining it too would double-write.
    mockUseSession.mockReturnValue(null); // isolate the drain (main branch inert)
    mockGetSession.mockReturnValue(makeSession({ startedAt: 1_000 })); // active === entry
    mockRead.mockResolvedValue({
      userId: 'u1',
      session: makeSession({ startedAt: 1_000 }),
      arrivalAtMs: 8_888,
      savedAt: Date.now(),
    });
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockClearForSession).not.toHaveBeenCalled();
  });

  it('does not drain another account\'s outbox entry (AB3)', async () => {
    mockRead.mockResolvedValue({
      userId: 'other-user',
      session: makeSession({ startedAt: 1_000 }),
      arrivalAtMs: 8_888,
      savedAt: Date.now(),
    });
    mockGetSession.mockReturnValue(null);
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockClearForSession).not.toHaveBeenCalled();
  });

  it('does not save or clear the outbox on the normal active-session path (AB3)', async () => {
    mockUseSession.mockReturnValue(makeSession());
    renderHook(() => useGuidanceCommuteLogSync());

    await flush();

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockClearForSession).not.toHaveBeenCalled();
  });
});
