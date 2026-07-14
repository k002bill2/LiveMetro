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
 *
 * Concurrency (AC2): every slot read/write/delete runs through a module-level
 * serialization queue, so a drain's read and a concurrent failure's save can't
 * interleave. Deletion is compare-and-clear by `startedAt` (sessionKey): the
 * slot is removed only while it still belongs to the session being cleared, so a
 * different journey's save that landed in between is preserved for the next
 * drain. (Comparing by startedAt only — not savedAt — is deliberate: a re-save
 * of the SAME journey must still be cleared once that journey is logged, or a
 * second drain would create a duplicate completed doc.)
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

// 슬롯 접근(읽기/쓰기/삭제)을 도착 순서대로 직렬화한다(AC2) — drain의 read와 다른
// 실패의 save가 인터리브해 단일 슬롯을 오염/오삭제하지 않게 한다. 네트워크 호출
// (completeGuidanceCommuteLog)은 이 큐 밖에서 돈다(슬롯 op이 아니다).
let opQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
  const run = opQueue.then(op, op);
  opQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

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

const rawRead = async (): Promise<PendingCommuteCompletion | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_COMMUTE_COMPLETION_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const rawWrite = async (entry: PendingCommuteCompletion): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_COMMUTE_COMPLETION_KEY, JSON.stringify(entry));
  } catch {
    // 저장 실패해도 다음 실패 시 재저장을 시도한다.
  }
};

/** Persist (overwrite) the pending completion. Serialized; degrades silently. */
export const savePendingCompletion = (entry: PendingCommuteCompletion): Promise<void> =>
  enqueue(() => rawWrite(entry));

/** Read the pending completion, or null when empty / malformed. Serialized. */
export const readPendingCompletion = (): Promise<PendingCommuteCompletion | null> =>
  enqueue(rawRead);

/**
 * Atomically clear the slot only when it still belongs to the given session
 * (startedAt). Used by both the live-session completion and the orphan drain so
 * a success clears its own slot without clobbering a different journey's pending
 * recovery that raced in between. Read-compare-remove runs as one queued op.
 */
export const clearPendingCompletionForSession = (startedAt: number): Promise<void> =>
  enqueue(async () => {
    const entry = await rawRead();
    if (entry !== null && entry.session.startedAt === startedAt) {
      try {
        await AsyncStorage.removeItem(PENDING_COMMUTE_COMPLETION_KEY);
      } catch {
        // 다음 drain에서 재시도된다.
      }
    }
  });

export const isPendingCompletionExpired = (
  entry: PendingCommuteCompletion,
  nowMs: number
): boolean => nowMs - entry.savedAt > PENDING_COMMUTE_COMPLETION_TTL_MS;
