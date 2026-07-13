/**
 * guidanceSessionStore tests — v2 observable + AsyncStorage-persistent store
 * with a TTL expiry guard. Extends the original v1 handoff-singleton cases
 * (copy-on-set, session-only) with subscribe/persist/hydrate/TTL coverage.
 *
 * The store is a module singleton, so beforeEach wires the AsyncStorage mocks
 * to resolve (so the fire-and-forget `.catch()` has a real promise), resets
 * `current` via clearGuidanceSession(), then clears the bookkeeping removeItem
 * call. hydrate takes an explicit `nowMs` so TTL boundaries are deterministic
 * without mocking Date.now().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGuidanceSession,
  setGuidanceSession,
  clearGuidanceSession,
  updateGuidanceProgressAnchor,
  subscribe,
  hydrateGuidanceSession,
  isGuidanceSessionHydrated,
  isSessionExpired,
  GUIDANCE_SESSION_TTL_MS,
} from '../guidanceSessionStore';
import {
  appendDepartedTrains,
  getDepartedTrainLog,
  clearDepartedTrainLog,
  type DepartedTrainEntry,
} from '../departedTrainLog';
import { createRoute } from '@/models/route';
import type { GuidanceSession } from '@/models/guidance';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const STORAGE_KEY = '@livemetro/guidance_session';
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const makeSession = (startedAt = 1_700_000_000_000): GuidanceSession => ({
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

describe('guidanceSessionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    clearGuidanceSession();
    clearDepartedTrainLog();
    mockRemoveItem.mockClear();
  });

  afterEach(() => {
    clearDepartedTrainLog();
  });

  // --- v1 handoff behavior (preserved) ---

  it('returns null when no session is active', () => {
    expect(getGuidanceSession()).toBeNull();
  });

  it('stores and returns the session', () => {
    const session = makeSession();
    setGuidanceSession(session);
    expect(getGuidanceSession()).toEqual(session);
  });

  it('stores a copy — later mutation of the input does not leak in', () => {
    const session = makeSession();
    setGuidanceSession(session);
    (session as { toStationName: string }).toStationName = 'MUTATED';
    expect(getGuidanceSession()?.toStationName).toBe('B');
  });

  it('clears the session', () => {
    setGuidanceSession(makeSession());
    clearGuidanceSession();
    expect(getGuidanceSession()).toBeNull();
  });

  it('overwrites a previous session on set', () => {
    setGuidanceSession(makeSession());
    setGuidanceSession({ ...makeSession(), toStationName: 'C' });
    expect(getGuidanceSession()?.toStationName).toBe('C');
  });

  // --- departed-train log isolation across sessions ---

  const departedEntry: DepartedTrainEntry = {
    trainId: 'T1',
    finalDestination: '성수',
    lineId: '2',
    stationName: 'A',
    departedAtMs: 1_700_000_000_000,
    confidence: 'observed',
  };

  it('clears the departed-train log when a new session (different startedAt) starts', () => {
    setGuidanceSession(makeSession(1_700_000_000_000));
    appendDepartedTrains([departedEntry], 1_700_000_000_000);
    expect(getDepartedTrainLog()).toHaveLength(1);
    setGuidanceSession(makeSession(1_700_000_000_000 + 1000)); // fresh startedAt
    expect(getDepartedTrainLog()).toEqual([]);
  });

  it('keeps the departed-train log when the same session is updated (same startedAt)', () => {
    setGuidanceSession(makeSession(1_700_000_000_000));
    appendDepartedTrains([departedEntry], 1_700_000_000_000);
    // Session-update call (e.g. attaching commuteLogId) — same startedAt.
    setGuidanceSession({ ...makeSession(1_700_000_000_000), commuteLogId: 'log-1' });
    expect(getDepartedTrainLog()).toHaveLength(1);
  });

  // --- v2 persistence ---

  it('persists the session to AsyncStorage under the storage key', () => {
    const session = makeSession();
    setGuidanceSession(session);
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(session));
  });

  it('removes the persisted session from AsyncStorage on clear', () => {
    setGuidanceSession(makeSession());
    clearGuidanceSession();
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  // --- v2 observability ---

  it('notifies listeners on set and clear', () => {
    const listener = jest.fn();
    const unsub = subscribe(listener);
    setGuidanceSession(makeSession());
    expect(listener).toHaveBeenCalledTimes(1);
    clearGuidanceSession();
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsub = subscribe(listener);
    unsub();
    setGuidanceSession(makeSession());
    expect(listener).not.toHaveBeenCalled();
  });

  // --- v2 TTL ---

  it('isSessionExpired is false at exactly the TTL boundary', () => {
    const started = 1_000_000;
    expect(isSessionExpired(makeSession(started), started + GUIDANCE_SESSION_TTL_MS)).toBe(false);
  });

  it('isSessionExpired is true one millisecond past the TTL', () => {
    const started = 1_000_000;
    expect(isSessionExpired(makeSession(started), started + GUIDANCE_SESSION_TTL_MS + 1)).toBe(true);
  });

  // --- v2 hydrate ---

  it('restores a non-expired persisted session and notifies listeners', async () => {
    const started = 5_000_000;
    const session = makeSession(started);
    mockGetItem.mockResolvedValue(JSON.stringify(session));
    const listener = jest.fn();
    const unsub = subscribe(listener);

    await hydrateGuidanceSession(started + 1000);

    expect(getGuidanceSession()).toEqual(session);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('discards an expired persisted session and clears storage (zombie guard)', async () => {
    const started = 5_000_000;
    mockGetItem.mockResolvedValue(JSON.stringify(makeSession(started)));

    await hydrateGuidanceSession(started + GUIDANCE_SESSION_TTL_MS + 1);

    expect(getGuidanceSession()).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('stays empty when there is no persisted session', async () => {
    mockGetItem.mockResolvedValue(null);
    await hydrateGuidanceSession(1000);
    expect(getGuidanceSession()).toBeNull();
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('stays empty and does not throw on malformed JSON', async () => {
    mockGetItem.mockResolvedValue('{ not valid json');
    await expect(hydrateGuidanceSession(1000)).resolves.toBeUndefined();
    expect(getGuidanceSession()).toBeNull();
  });

  // --- v2 hydration flag (alert orphan-cleanup gate) ---

  it('marks the session hydrated after hydrate completes with nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    await hydrateGuidanceSession(1000);
    expect(isGuidanceSessionHydrated()).toBe(true);
  });

  it('marks the session hydrated after restoring a session', async () => {
    const started = 5_000_000;
    mockGetItem.mockResolvedValue(JSON.stringify(makeSession(started)));
    await hydrateGuidanceSession(started + 1000);
    expect(isGuidanceSessionHydrated()).toBe(true);
    expect(getGuidanceSession()).toEqual(makeSession(started));
  });

  // G1: hydrated must gate on SUCCESSFUL completion, not merely "finished".
  // `hydrated` is monotonic module state, so each case runs in an isolated
  // module registry to observe the false→(maybe)true transition cleanly.
  describe('hydration success gating (G1)', () => {
    it('does not mark hydrated when the read fails (guards against false orphan sweep)', async () => {
      await jest.isolateModulesAsync(async () => {
        const store = require('../guidanceSessionStore') as typeof import('../guidanceSessionStore');
        const storage = require('@react-native-async-storage/async-storage') as {
          getItem: jest.Mock;
        };
        storage.getItem.mockRejectedValue(new Error('storage unavailable'));
        await store.hydrateGuidanceSession(1000);
        expect(store.isGuidanceSessionHydrated()).toBe(false);
      });
    });

    it('marks hydrated on a clean empty result (sweep may run)', async () => {
      await jest.isolateModulesAsync(async () => {
        const store = require('../guidanceSessionStore') as typeof import('../guidanceSessionStore');
        const storage = require('@react-native-async-storage/async-storage') as {
          getItem: jest.Mock;
        };
        storage.getItem.mockResolvedValue(null);
        await store.hydrateGuidanceSession(1000);
        expect(store.isGuidanceSessionHydrated()).toBe(true);
      });
    });

    // H3: corrupt JSON is a RESOLVED outcome ("no valid session"), not a transient
    // failure — it must be removed and hydration marked complete, never wedged.
    it('clears corrupt stored JSON and marks hydrated (never permanently sealed)', async () => {
      await jest.isolateModulesAsync(async () => {
        const store = require('../guidanceSessionStore') as typeof import('../guidanceSessionStore');
        const storage = require('@react-native-async-storage/async-storage') as {
          getItem: jest.Mock;
          removeItem: jest.Mock;
        };
        storage.getItem.mockResolvedValue('{ corrupt json');
        storage.removeItem.mockResolvedValue(undefined);
        await store.hydrateGuidanceSession(1000);
        expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
        expect(store.isGuidanceSessionHydrated()).toBe(true);
        expect(store.getGuidanceSession()).toBeNull();
      });
    });
  });

  // --- progress anchor (re-mount / app-restart restore) ---

  describe('updateGuidanceProgressAnchor', () => {
    it('is a no-op when no session is active', () => {
      updateGuidanceProgressAnchor({ stepIndex: 2, atMs: 1_700_000_000_500 }, 1_700_000_000_000);
      expect(getGuidanceSession()).toBeNull();
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('is a no-op when expectedStartedAt does not match the current session (Q1 scope)', () => {
      setGuidanceSession(makeSession(1_700_000_000_000)); // 세션 B
      mockSetItem.mockClear();

      // 이전 경로(세션 A)의 startedAt으로 쓰기 시도 — B를 오염시키면 안 된다.
      updateGuidanceProgressAnchor({ stepIndex: 3, atMs: 1_700_000_050_000 }, 999);

      expect(getGuidanceSession()?.progressAnchor).toBeUndefined();
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('records the anchor on the active session and persists it', () => {
      setGuidanceSession(makeSession(1_700_000_000_000));
      mockSetItem.mockClear();
      const anchor = { stepIndex: 3, atMs: 1_700_000_050_000 };

      updateGuidanceProgressAnchor(anchor, 1_700_000_000_000);

      expect(getGuidanceSession()?.progressAnchor).toEqual(anchor);
      expect(mockSetItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(getGuidanceSession())
      );
    });

    it('keeps the same startedAt so the departed-train log is preserved', () => {
      setGuidanceSession(makeSession(1_700_000_000_000));
      appendDepartedTrains([departedEntry], 1_700_000_000_000);
      expect(getDepartedTrainLog()).toHaveLength(1);

      updateGuidanceProgressAnchor({ stepIndex: 1, atMs: 1_700_000_010_000 }, 1_700_000_000_000);

      expect(getGuidanceSession()?.startedAt).toBe(1_700_000_000_000);
      expect(getDepartedTrainLog()).toHaveLength(1);
    });

    it('overwrites a previous anchor on the same session', () => {
      setGuidanceSession(makeSession(1_700_000_000_000));
      updateGuidanceProgressAnchor({ stepIndex: 1, atMs: 1_700_000_010_000 }, 1_700_000_000_000);
      updateGuidanceProgressAnchor({ stepIndex: 2, atMs: 1_700_000_020_000 }, 1_700_000_000_000);
      expect(getGuidanceSession()?.progressAnchor).toEqual({
        stepIndex: 2,
        atMs: 1_700_000_020_000,
      });
    });
  });
});
