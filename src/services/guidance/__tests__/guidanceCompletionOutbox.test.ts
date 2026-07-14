/**
 * guidanceCompletionOutbox tests — single-slot AsyncStorage outbox for a failed
 * commute-log arrival completion (AB3). AsyncStorage is mocked at the module
 * boundary; each case drives getItem/setItem/removeItem directly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_COMMUTE_COMPLETION_KEY,
  PENDING_COMMUTE_COMPLETION_TTL_MS,
  savePendingCompletion,
  readPendingCompletion,
  clearPendingCompletionForSession,
  isPendingCompletionExpired,
  type PendingCommuteCompletion,
} from '../guidanceCompletionOutbox';
import { createRoute } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const session = (startedAt = 1_000): GuidanceSession => ({
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
  startedAt,
});

const entry = (overrides: Partial<PendingCommuteCompletion> = {}): PendingCommuteCompletion => ({
  userId: 'u1',
  session: session(),
  arrivalAtMs: 9_999,
  savedAt: 1_700_000_000_000,
  ...overrides,
});

describe('guidanceCompletionOutbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  it('persists the entry as JSON under the storage key', async () => {
    const e = entry();
    await savePendingCompletion(e);
    expect(mockSetItem).toHaveBeenCalledWith(PENDING_COMMUTE_COMPLETION_KEY, JSON.stringify(e));
  });

  it('does not throw when the setItem write fails', async () => {
    mockSetItem.mockRejectedValue(new Error('disk full'));
    await expect(savePendingCompletion(entry())).resolves.toBeUndefined();
  });

  it('reads back a valid persisted entry', async () => {
    const e = entry();
    mockGetItem.mockResolvedValue(JSON.stringify(e));
    await expect(readPendingCompletion()).resolves.toEqual(e);
  });

  it('returns null when the slot is empty', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(readPendingCompletion()).resolves.toBeNull();
  });

  it('returns null (does not throw) on malformed JSON', async () => {
    mockGetItem.mockResolvedValue('{ not valid json');
    await expect(readPendingCompletion()).resolves.toBeNull();
  });

  it('returns null when the parsed entry is missing required fields', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ userId: 'u1' }));
    await expect(readPendingCompletion()).resolves.toBeNull();
  });

  it('compare-and-clears the slot when it still belongs to the given session (match)', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(entry({ session: session(1_000) })));
    await clearPendingCompletionForSession(1_000);
    expect(mockRemoveItem).toHaveBeenCalledWith(PENDING_COMMUTE_COMPLETION_KEY);
  });

  it('preserves a slot that belongs to a DIFFERENT session — a raced-in save survives (AC2)', async () => {
    // Session A drained; meanwhile session B's failure overwrote the slot. A's
    // clear must not clobber B's only recovery record.
    mockGetItem.mockResolvedValue(JSON.stringify(entry({ session: session(2_000) })));
    await clearPendingCompletionForSession(1_000);
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('serializes concurrent slot operations in FIFO order (AC2)', async () => {
    // The queue must not interleave: two saves fired without awaiting still write
    // in dispatch order, so the last writer wins deterministically.
    const a = entry({ session: session(1_000), arrivalAtMs: 111 });
    const b = entry({ session: session(2_000), arrivalAtMs: 222 });
    await Promise.all([savePendingCompletion(a), savePendingCompletion(b)]);
    expect(mockSetItem).toHaveBeenNthCalledWith(1, PENDING_COMMUTE_COMPLETION_KEY, JSON.stringify(a));
    expect(mockSetItem).toHaveBeenNthCalledWith(2, PENDING_COMMUTE_COMPLETION_KEY, JSON.stringify(b));
  });

  it('does not remove when the read finds an empty slot (nothing to clear)', async () => {
    mockGetItem.mockResolvedValue(null);
    await clearPendingCompletionForSession(1_000);
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('flags an entry older than the TTL as expired', () => {
    const e = entry({ savedAt: 1_000 });
    expect(isPendingCompletionExpired(e, 1_000 + PENDING_COMMUTE_COMPLETION_TTL_MS + 1)).toBe(true);
  });

  it('does not flag an entry at exactly the TTL boundary', () => {
    const e = entry({ savedAt: 1_000 });
    expect(isPendingCompletionExpired(e, 1_000 + PENDING_COMMUTE_COMPLETION_TTL_MS)).toBe(false);
  });
});
