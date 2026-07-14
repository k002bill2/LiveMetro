/**
 * guidanceCompletionOutbox — a single-slot AsyncStorage outbox for a commute-log
 * ARRIVAL completion whose Firestore write failed (AB3).
 *
 * If the completion write rejects (e.g. underground / transient outage) and the
 * user then exits guidance, the session is cleared and `localCompletedAt` is
 * lost — a transient failure would become a permanent log loss. This outbox
 * persists just enough to retry the completion independently of the session:
 * the full session snapshot (already JSON-persisted by the store, and needed to
 * rebuild the create-input for a no-logId completion), the arrival time, the
 * user, and when it was saved. Only the latest failure is kept (single slot).
 *
 * Ownership: the outbox holds ORPHANED completions only — an entry whose session
 * is no longer the active one. The live-session completion is owned by
 * useGuidanceCommuteLogSync's main branch; the drain skips an entry that matches
 * the active session to avoid a concurrent double write. Entries older than the
 * TTL are discarded on drain (a stale journey is not worth logging).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GuidanceSession } from '@/models/guidance';

export const PENDING_COMMUTE_COMPLETION_KEY = '@livemetro/pending_commute_completion';

/** Entries older than 7 days are discarded rather than retried. */
export const PENDING_COMMUTE_COMPLETION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingCommuteCompletion {
  readonly userId: string;
  readonly session: GuidanceSession;
  readonly arrivalAtMs: number;
  readonly savedAt: number;
}

const isValid = (value: unknown): value is PendingCommuteCompletion => {
  if (value === null || typeof value !== 'object') return false;
  const entry = value as Partial<PendingCommuteCompletion>;
  return (
    typeof entry.userId === 'string' &&
    entry.userId.length > 0 &&
    typeof entry.arrivalAtMs === 'number' &&
    typeof entry.savedAt === 'number' &&
    entry.session != null &&
    typeof entry.session.startedAt === 'number'
  );
};

/** Persist (overwrite) the pending completion. Failures degrade silently. */
export const savePendingCompletion = async (
  entry: PendingCommuteCompletion
): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_COMMUTE_COMPLETION_KEY, JSON.stringify(entry));
  } catch {
    // 저장 실패해도 다음 실패 시 재저장을 시도한다.
  }
};

/** Read the pending completion, or null when empty / malformed. */
export const readPendingCompletion = async (): Promise<PendingCommuteCompletion | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_COMMUTE_COMPLETION_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** Remove the pending completion slot. Failures degrade silently. */
export const clearPendingCompletion = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_COMMUTE_COMPLETION_KEY);
  } catch {
    // 다음 drain에서 재시도된다.
  }
};

/**
 * Clear the slot only when it belongs to the given session (startedAt). Used by
 * the live-session completion so a success clears its own orphan slot without
 * clobbering a different session's pending recovery.
 */
export const clearPendingCompletionForSession = async (
  startedAt: number
): Promise<void> => {
  const entry = await readPendingCompletion();
  if (entry !== null && entry.session.startedAt === startedAt) {
    await clearPendingCompletion();
  }
};

export const isPendingCompletionExpired = (
  entry: PendingCommuteCompletion,
  nowMs: number
): boolean => nowMs - entry.savedAt > PENDING_COMMUTE_COMPLETION_TTL_MS;
