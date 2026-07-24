/**
 * guidanceDetectionMetrics tests — pure aggregation (appendEpisode / summarize /
 * format) plus the AsyncStorage-backed persistence (record / load / clear).
 * The in-memory async-storage mock from src/__tests__/setup.ts is used for a
 * faithful round-trip; each case resets the store in beforeEach (clearMocks does
 * not wipe the mock's internal cache).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendEpisode,
  summarizeDetectionMetrics,
  formatDetectionSummary,
  recordDetectionEpisode,
  loadDetectionEpisodes,
  clearDetectionMetrics,
  pruneExpired,
  GUIDANCE_DETECTION_METRICS_KEY,
  DETECTION_METRICS_CAP,
  DETECTION_METRICS_RETENTION_MS,
  type DetectionEpisode,
  type DetectionSummaryLabels,
} from '../guidanceDetectionMetrics';

// Label fixtures mirror translations.ts (ko / en) — the service is label-injected.
const koLabels: DetectionSummaryLabels = {
  empty: '기록 없음',
  total: '총 대기 횟수',
  detectionRate: '감지 발화율',
  auto: '자동 진행',
  manual: '수동 확인',
  softAccept: '프롬프트 수락',
  trainSelect: '열차 시트 선택',
  dismissed: '기각 횟수',
  avgWait: '평균 대기시간',
  countUnit: '회',
  minute: '분',
  second: '초',
};

const enLabels: DetectionSummaryLabels = {
  empty: 'No records',
  total: 'Total waits',
  detectionRate: 'Detection rate',
  auto: 'Auto-advanced',
  manual: 'Manual confirm',
  softAccept: 'Prompt accepted',
  trainSelect: 'Train picked',
  dismissed: 'Dismissals',
  avgWait: 'Avg wait',
  countUnit: '',
  minute: 'm',
  second: 's',
};

const episode = (overrides: Partial<DetectionEpisode> = {}): DetectionEpisode => ({
  // Recent by default so the 90-day retention prune (R6-2) doesn't drop it in
  // persistence round-trips; retention tests override recordedAtMs explicitly.
  recordedAtMs: Date.now(),
  sessionKey: 'sess-1',
  stepIndex: 0,
  stepKind: 'board',
  stationName: '을지로3가',
  lineId: '2',
  waitedSec: 60,
  softFired: false,
  dismissedCount: 0,
  resolution: 'manual',
  ...overrides,
});

describe('guidanceDetectionMetrics', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('appendEpisode (pure)', () => {
    it('returns a new array and does not mutate the input', () => {
      const existing: readonly DetectionEpisode[] = [episode({ stepIndex: 0 })];
      const added = episode({ stepIndex: 1 });
      const result = appendEpisode(existing, added);
      expect(result).toHaveLength(2);
      expect(result[1]!.stepIndex).toBe(1);
      // Input array untouched (immutability).
      expect(existing).toHaveLength(1);
      expect(result).not.toBe(existing);
    });

    it('drops the oldest entries when the cap is exceeded', () => {
      const existing = Array.from({ length: 5 }, (_, i) => episode({ stepIndex: i }));
      const added = episode({ stepIndex: 99 });
      const result = appendEpisode(existing, added, 3);
      // Cap 3 keeps the 3 newest: stepIndex 3, 4, 99.
      expect(result.map((e) => e.stepIndex)).toEqual([3, 4, 99]);
    });

    it('defaults to DETECTION_METRICS_CAP when no cap is given', () => {
      const existing = Array.from({ length: DETECTION_METRICS_CAP }, (_, i) =>
        episode({ stepIndex: i })
      );
      const result = appendEpisode(existing, episode({ stepIndex: 999 }));
      expect(result).toHaveLength(DETECTION_METRICS_CAP);
      expect(result[result.length - 1]!.stepIndex).toBe(999);
      // The very first (oldest) entry was dropped.
      expect(result[0]!.stepIndex).toBe(1);
    });

    // R3-1: replace-by-key so a goPrev re-confirm of the same hold overwrites its
    // prior record (only the final confirmation of a hold survives).
    it('replaces the same (sessionKey, stepIndex) hold instead of appending', () => {
      const existing: readonly DetectionEpisode[] = [
        episode({ sessionKey: 's1', stepIndex: 0, resolution: 'auto', softFired: true }),
      ];
      const result = appendEpisode(
        existing,
        episode({ sessionKey: 's1', stepIndex: 0, resolution: 'manual', softFired: false })
      );
      // Total unchanged (replace, not add); the latest confirmation wins.
      expect(result).toHaveLength(1);
      expect(result[0]!.resolution).toBe('manual');
      expect(result[0]!.softFired).toBe(false);
    });

    it('keeps a different stepIndex hold in the same session (distinct keys coexist)', () => {
      const existing: readonly DetectionEpisode[] = [
        episode({ sessionKey: 's1', stepIndex: 0, resolution: 'auto' }),
      ];
      const result = appendEpisode(existing, episode({ sessionKey: 's1', stepIndex: 2, resolution: 'manual' }));
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.stepIndex)).toEqual([0, 2]);
    });

    it('allows duplicates when sessionKey is null (key is ambiguous)', () => {
      const existing: readonly DetectionEpisode[] = [
        episode({ sessionKey: null, stepIndex: 0, resolution: 'auto' }),
      ];
      const result = appendEpisode(existing, episode({ sessionKey: null, stepIndex: 0, resolution: 'manual' }));
      // No key to dedup on → both retained.
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.resolution)).toEqual(['auto', 'manual']);
    });

    it('replaces in place at cap without trimming a different hold (총수 불변)', () => {
      // Full to cap=3 with distinct holds in the same session.
      const existing = Array.from({ length: 3 }, (_, i) =>
        episode({ sessionKey: 's1', stepIndex: i })
      );
      // Re-confirm stepIndex 1 — a NON-oldest hold — at cap. Replace-by-key removes
      // it first (remove 1 + add 1 = 3), so NO trim fires and every hold survives.
      // A regression to append-only would push to length 4 then trim the OLDEST
      // (stepIndex 0), losing a different hold — this asserts that never happens.
      const result = appendEpisode(
        existing,
        episode({ sessionKey: 's1', stepIndex: 1, resolution: 'manual' }),
        3
      );
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.stepIndex).sort((a, b) => a - b)).toEqual([0, 1, 2]);
      expect(result.find((e) => e.stepIndex === 1)!.resolution).toBe('manual');
    });
  });

  describe('pruneExpired (pure, 90-day retention — R6-2)', () => {
    const NOW = 1_800_000_000_000;
    const DAY = 24 * 60 * 60 * 1000;

    it('drops episodes older than 90 days, keeps newer, keeps the exact boundary', () => {
      const episodes = [
        episode({ stepIndex: 0, recordedAtMs: NOW - 91 * DAY }), // expired
        episode({ stepIndex: 1, recordedAtMs: NOW - 90 * DAY }), // exactly at cutoff — kept
        episode({ stepIndex: 2, recordedAtMs: NOW - 89 * DAY }), // fresh
      ];
      const result = pruneExpired(episodes, NOW);
      expect(result.map((e) => e.stepIndex)).toEqual([1, 2]);
    });

    it('is pure — returns a new array, does not mutate input', () => {
      const episodes = [episode({ recordedAtMs: NOW })];
      const result = pruneExpired(episodes, NOW);
      expect(result).not.toBe(episodes);
      expect(episodes).toHaveLength(1);
    });

    it('RETENTION constant is 90 days', () => {
      expect(DETECTION_METRICS_RETENTION_MS).toBe(90 * DAY);
    });
  });

  describe('summarizeDetectionMetrics (pure)', () => {
    it('returns null rates and all-zero counts for an empty batch', () => {
      const summary = summarizeDetectionMetrics([]);
      expect(summary.total).toBe(0);
      expect(summary.byResolution).toEqual({
        auto: 0,
        'soft-accept': 0,
        manual: 0,
        'train-select': 0,
      });
      expect(summary.softFiredCount).toBe(0);
      expect(summary.softFiredRate).toBeNull();
      expect(summary.dismissedTotal).toBe(0);
      expect(summary.avgWaitedSec).toBeNull();
    });

    it('aggregates a mixed batch with all four resolutions', () => {
      const episodes = [
        episode({ resolution: 'auto', softFired: true, waitedSec: 30, dismissedCount: 0 }),
        episode({ resolution: 'soft-accept', softFired: true, waitedSec: 60, dismissedCount: 1 }),
        episode({ resolution: 'manual', softFired: false, waitedSec: 90, dismissedCount: 2 }),
        episode({ resolution: 'train-select', softFired: false, waitedSec: 120, dismissedCount: 0 }),
      ];
      const summary = summarizeDetectionMetrics(episodes);
      expect(summary.total).toBe(4);
      expect(summary.byResolution).toEqual({
        auto: 1,
        'soft-accept': 1,
        manual: 1,
        'train-select': 1,
      });
      expect(summary.softFiredCount).toBe(2);
      expect(summary.softFiredRate).toBe(0.5);
      expect(summary.dismissedTotal).toBe(3);
      expect(summary.avgWaitedSec).toBe(75);
    });

    it('computes softFiredRate as a fraction of total', () => {
      const episodes = [
        episode({ softFired: true }),
        episode({ softFired: true }),
        episode({ softFired: true }),
        episode({ softFired: false }),
      ];
      const summary = summarizeDetectionMetrics(episodes);
      expect(summary.softFiredRate).toBe(0.75);
    });
  });

  describe('formatDetectionSummary (pure, label-injected)', () => {
    it('returns the empty label for an empty summary (ko)', () => {
      expect(formatDetectionSummary(summarizeDetectionMetrics([]), koLabels)).toBe('기록 없음');
    });

    it('includes the key figures in the multi-line string (ko)', () => {
      const episodes = [
        episode({ resolution: 'auto', softFired: true, waitedSec: 60 }),
        episode({ resolution: 'manual', softFired: false, waitedSec: 120, dismissedCount: 1 }),
      ];
      const text = formatDetectionSummary(summarizeDetectionMetrics(episodes), koLabels);
      expect(text).toContain('총 대기 횟수: 2회');
      expect(text).toContain('감지 발화율: 50%');
      expect(text).toContain('자동 진행: 1회');
      expect(text).toContain('수동 확인: 1회');
      expect(text).toContain('기각 횟수: 1회');
      expect(text).toContain('평균 대기시간: 1분 30초');
    });

    it('formats with the en labels (units and count suffix swap)', () => {
      const episodes = [
        episode({ resolution: 'auto', softFired: true, waitedSec: 60 }),
        episode({ resolution: 'manual', softFired: false, waitedSec: 120, dismissedCount: 1 }),
      ];
      const text = formatDetectionSummary(summarizeDetectionMetrics(episodes), enLabels);
      expect(text).toContain('Total waits: 2');
      expect(text).toContain('Detection rate: 50%');
      expect(text).toContain('Auto-advanced: 1');
      expect(text).toContain('Dismissals: 1');
      // en avg wait uses "m"/"s" units and no count suffix.
      expect(text).toContain('Avg wait: 1m 30s');
    });

    it('returns the empty label for an empty summary (en)', () => {
      expect(formatDetectionSummary(summarizeDetectionMetrics([]), enLabels)).toBe('No records');
    });

    it('formats a sub-minute average wait as seconds only (ko)', () => {
      const episodes = [episode({ resolution: 'manual', softFired: false, waitedSec: 30 })];
      const text = formatDetectionSummary(summarizeDetectionMetrics(episodes), koLabels);
      expect(text).toContain('평균 대기시간: 30초');
    });
  });

  describe('persistence (record / load / clear)', () => {
    it('round-trips a recorded episode through storage', async () => {
      const e = episode({ resolution: 'auto', softFired: true });
      await recordDetectionEpisode(e);
      const loaded = await loadDetectionEpisodes();
      expect(loaded).not.toBeNull();
      expect(loaded).toHaveLength(1);
      expect(loaded![0]).toEqual(e);
    });

    it('appends across successive awaited records', async () => {
      await recordDetectionEpisode(episode({ stepIndex: 0 }));
      await recordDetectionEpisode(episode({ stepIndex: 1 }));
      const loaded = await loadDetectionEpisodes();
      expect(loaded).not.toBeNull();
      expect(loaded!.map((e) => e.stepIndex)).toEqual([0, 1]);
    });

    it('preserves both episodes when two records fire concurrently (serialized)', async () => {
      // Fire without awaiting — the module-level opQueue must serialize the two
      // read-modify-write cycles so neither clobbers the other.
      await Promise.all([
        recordDetectionEpisode(episode({ stepIndex: 10, resolution: 'auto' })),
        recordDetectionEpisode(episode({ stepIndex: 20, resolution: 'manual' })),
      ]);
      const loaded = await loadDetectionEpisodes();
      expect(loaded).not.toBeNull();
      expect(loaded).toHaveLength(2);
      expect(loaded!.map((e) => e.stepIndex).sort((a, b) => a - b)).toEqual([10, 20]);
    });

    it('returns [] and clears the slot on corrupt JSON', async () => {
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, '{ not valid json');
      const removeSpy = jest.spyOn(AsyncStorage, 'removeItem');
      const loaded = await loadDetectionEpisodes();
      expect(loaded).toEqual([]);
      expect(removeSpy).toHaveBeenCalledWith(GUIDANCE_DETECTION_METRICS_KEY);
      // Do NOT mockRestore an AsyncStorage method — restoring the spied community
      // mock wipes its in-memory store for later tests. The call-through spy is benign.
    });

    it('returns [] when a persisted array contains an invalid entry', async () => {
      await AsyncStorage.setItem(
        GUIDANCE_DETECTION_METRICS_KEY,
        JSON.stringify([{ resolution: 'not-a-resolution' }])
      );
      const loaded = await loadDetectionEpisodes();
      expect(loaded).toEqual([]);
    });

    it('returns [] when the slot is empty', async () => {
      await expect(loadDetectionEpisodes()).resolves.toEqual([]);
    });

    it('does not throw when the underlying setItem rejects', async () => {
      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
      // Silence the __DEV__ console.error the record catch emits (keeps output clean).
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(recordDetectionEpisode(episode())).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
      // Do NOT setSpy.mockRestore() — restoring a spied AsyncStorage method wipes
      // the community mock's store. The `...Once` reverts to call-through on its own.
      errorSpy.mockRestore();
    });

    it('clears all persisted metrics', async () => {
      await recordDetectionEpisode(episode());
      await clearDetectionMetrics();
      await expect(loadDetectionEpisodes()).resolves.toEqual([]);
    });

    // R6-2: physical 90-day retention. Do NOT restore AsyncStorage spies (wipes the mock store).
    const DAY = 24 * 60 * 60 * 1000;

    it('record prunes expired (>90d) entries before appending (physical bound)', async () => {
      const now = Date.now();
      const old = episode({ stepIndex: 0, recordedAtMs: now - 91 * DAY });
      const fresh = episode({ stepIndex: 1, recordedAtMs: now });
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, JSON.stringify([old]));
      const setSpy = jest.spyOn(AsyncStorage, 'setItem');
      await recordDetectionEpisode(fresh);
      // Persisted list must contain ONLY the fresh episode — the expired one is pruned.
      expect(setSpy).toHaveBeenLastCalledWith(
        GUIDANCE_DETECTION_METRICS_KEY,
        JSON.stringify([fresh]),
      );
    });

    it('load filters expired and fire-and-forget re-persists the pruned list', async () => {
      const now = Date.now();
      const old = episode({ stepIndex: 0, recordedAtMs: now - 91 * DAY });
      const fresh = episode({ stepIndex: 1, recordedAtMs: now });
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, JSON.stringify([old, fresh]));
      const setSpy = jest.spyOn(AsyncStorage, 'setItem');
      const first = await loadDetectionEpisodes();
      expect(first).not.toBeNull();
      // Read returns the pruned list immediately (expired filtered out).
      expect(first!.map((e) => e.stepIndex)).toEqual([1]);
      // Flush the queued fire-and-forget re-persist (enqueued after this call).
      await loadDetectionEpisodes();
      // Physical deletion: the store was rewritten without the expired entry.
      expect(setSpy).toHaveBeenCalledWith(
        GUIDANCE_DETECTION_METRICS_KEY,
        JSON.stringify([fresh]),
      );
    });

    it('keeps an 89-day-old entry across load (within retention, not pruned)', async () => {
      const now = Date.now();
      const fresh = episode({ stepIndex: 1, recordedAtMs: now - 89 * DAY });
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, JSON.stringify([fresh]));
      const loaded = await loadDetectionEpisodes();
      expect(loaded).not.toBeNull();
      expect(loaded!.map((e) => e.stepIndex)).toEqual([1]);
      // Still present on a subsequent load — a 89-day entry is never physically removed.
      const again = await loadDetectionEpisodes();
      expect(again!.map((e) => e.stepIndex)).toEqual([1]);
    });

    // R4: a transient READ failure must be distinguished from an empty history.
    // NOTE: never mockRestore() a getItem spy here — restoring the spied community
    // async-storage mock wipes its in-memory store. A consumed `...Once` auto-reverts
    // to call-through with the store intact, which the read-backs rely on.
    it('skips the write (preserves history) when the read fails during record', async () => {
      // Seed one episode via a healthy read/write.
      await recordDetectionEpisode(episode({ stepIndex: 0 }));
      const setSpy = jest.spyOn(AsyncStorage, 'setItem');
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('transient'));
      setSpy.mockClear();
      // Read fails → the new episode is dropped rather than overwriting history.
      await recordDetectionEpisode(episode({ stepIndex: 1 }));
      expect(setSpy).not.toHaveBeenCalled();
      // Do NOT restore the setItem/getItem spies (would wipe the mock store); the
      // setItem call-through spy is harmless and the getItem `...Once` is consumed.
      errorSpy.mockRestore();
      // The originally seeded episode survives (read via the now call-through getItem).
      const loaded = await loadDetectionEpisodes();
      expect(loaded).not.toBeNull();
      expect(loaded!.map((e) => e.stepIndex)).toEqual([0]);
    });

    it('returns null (not []) when the read fails — distinct from empty', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('transient'));
      await expect(loadDetectionEpisodes()).resolves.toBeNull();
      errorSpy.mockRestore();
    });
  });
});
