/**
 * guidanceDetectionMetrics — instrumentation for the board/transfer boarding
 * detection (soft-confirm) hit-rate.
 *
 * Each board/transfer platform hold ends in exactly one "confirm" episode. We
 * record how it resolved (auto-advance from a detected departure, the rider
 * accepting the soft prompt, a manual bottom-button tap, or a train-select
 * pick), whether the departure detection ever fired during the wait, and how
 * many times the rider dismissed a prompt ("아직 안 탔어요"). Summing these tells
 * us how often the automatic detection actually carried the rider vs. how often
 * they had to correct it — the real-world accuracy the design bet on.
 *
 * All persistence degrades silently (never throws): a metrics write must never
 * disrupt the live journey. Slot access is serialized through a module-level
 * promise chain so a rapid sequence of confirms can't lose an episode to a
 * read-modify-write race.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** How a board/transfer hold's boarding was ultimately confirmed. */
export type DetectionResolution = 'auto' | 'soft-accept' | 'manual' | 'train-select';

/** One completed board/transfer platform hold. */
export interface DetectionEpisode {
  readonly recordedAtMs: number;
  readonly sessionKey: string | null;
  readonly stepIndex: number;
  readonly stepKind: 'board' | 'transfer';
  readonly stationName: string;
  readonly lineId: string;
  readonly waitedSec: number;
  /** Whether the soft-confirm fired at least once during this hold. */
  readonly softFired: boolean;
  /** How many times the rider tapped "아직 안 탔어요" during this hold. */
  readonly dismissedCount: number;
  readonly resolution: DetectionResolution;
}

/** Aggregate view of a batch of episodes for the diagnostics screen. */
export interface DetectionMetricsSummary {
  readonly total: number;
  /** Count per resolution — all four keys always present (0 when absent). */
  readonly byResolution: Readonly<Record<DetectionResolution, number>>;
  readonly softFiredCount: number;
  /** softFiredCount / total, or null when there are no episodes. */
  readonly softFiredRate: number | null;
  readonly dismissedTotal: number;
  /** Mean waitedSec across episodes, or null when there are no episodes. */
  readonly avgWaitedSec: number | null;
}

/** AsyncStorage key for the persisted episode list. */
export const GUIDANCE_DETECTION_METRICS_KEY = '@livemetro:guidance_detection_metrics:v1';

/** Default cap on retained episodes — oldest are dropped past this. */
export const DETECTION_METRICS_CAP = 200;

/**
 * Physical retention window (90 days). Bounded to honor the privacy policy's
 * "로그 데이터: 최대 90일 동안 보존" promise (privacyPolicyContent.ts §5): this
 * device-local log carries station/line/timestamp (locational) data, so it must
 * not physically outlive that window even if the cap isn't reached.
 */
export const DETECTION_METRICS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const RESOLUTIONS: readonly DetectionResolution[] = [
  'auto',
  'soft-accept',
  'manual',
  'train-select',
];

/**
 * Append an episode immutably (new array, never mutates input), trimming the
 * oldest entries so the result never exceeds `cap`.
 *
 * Replace-by-key: only the FINAL confirmation of a hold is kept — a goPrev
 * re-confirm of the same hold REPLACES its previous record rather than adding a
 * second one, so a corrected wrong 'auto' can't linger alongside the new
 * episode (double-counting detection accuracy). The key is
 * `(sessionKey, stepIndex)`; when `sessionKey` is null the key is ambiguous
 * (can't tell holds apart) so it falls back to append-only (duplicates allowed).
 * Order: remove same-key → append → cap.
 */
export const appendEpisode = (
  existing: readonly DetectionEpisode[],
  episode: DetectionEpisode,
  cap: number = DETECTION_METRICS_CAP
): readonly DetectionEpisode[] => {
  const base =
    episode.sessionKey !== null
      ? existing.filter(
          (e) => !(e.sessionKey === episode.sessionKey && e.stepIndex === episode.stepIndex)
        )
      : existing;
  const next = [...base, episode];
  return next.length > cap ? next.slice(next.length - cap) : next;
};

/**
 * Drop episodes older than {@link DETECTION_METRICS_RETENTION_MS} (90 days) —
 * physical enforcement of the privacy policy's ≤90-day log retention. Pure
 * (returns a new array). An episode exactly at the cutoff is kept; older is
 * removed.
 */
export const pruneExpired = (
  episodes: readonly DetectionEpisode[],
  nowMs: number
): readonly DetectionEpisode[] => {
  const cutoff = nowMs - DETECTION_METRICS_RETENTION_MS;
  return episodes.filter((e) => e.recordedAtMs >= cutoff);
};

/** Aggregate a batch of episodes into the diagnostics summary. */
export const summarizeDetectionMetrics = (
  episodes: readonly DetectionEpisode[]
): DetectionMetricsSummary => {
  const byResolution: Record<DetectionResolution, number> = {
    auto: 0,
    'soft-accept': 0,
    manual: 0,
    'train-select': 0,
  };
  let softFiredCount = 0;
  let dismissedTotal = 0;
  let waitedTotal = 0;
  for (const e of episodes) {
    byResolution[e.resolution] += 1;
    if (e.softFired) softFiredCount += 1;
    dismissedTotal += e.dismissedCount;
    waitedTotal += e.waitedSec;
  }
  const total = episodes.length;
  return {
    total,
    byResolution,
    softFiredCount,
    softFiredRate: total === 0 ? null : softFiredCount / total,
    dismissedTotal,
    avgWaitedSec: total === 0 ? null : waitedTotal / total,
  };
};

/**
 * Locale-supplied labels for {@link formatDetectionSummary}. The service keeps
 * all numeric formatting; the caller (SettingsScreen, via i18n) injects the
 * prefixes and units so this module stays pure and language-agnostic. `empty`
 * is reused for both the no-episodes body and the inline null (rate / wait)
 * placeholder. `countUnit` is "회" (ko) or "" (en); `minute`/`second` are
 * "분"/"초" (ko) or "m"/"s" (en).
 */
export interface DetectionSummaryLabels {
  readonly empty: string;
  readonly total: string;
  readonly detectionRate: string;
  readonly auto: string;
  readonly manual: string;
  readonly softAccept: string;
  readonly trainSelect: string;
  readonly dismissed: string;
  readonly avgWait: string;
  readonly countUnit: string;
  readonly minute: string;
  readonly second: string;
}

const formatPercent = (rate: number): string => `${Math.round(rate * 100)}%`;

const formatWaited = (sec: number, labels: DetectionSummaryLabels): string => {
  const rounded = Math.round(sec);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return m > 0 ? `${m}${labels.minute} ${s}${labels.second}` : `${s}${labels.second}`;
};

/** Multi-line summary for an Alert, using caller-supplied labels. `empty` when no data. */
export const formatDetectionSummary = (
  summary: DetectionMetricsSummary,
  labels: DetectionSummaryLabels
): string => {
  if (summary.total === 0) return labels.empty;
  const rateText = summary.softFiredRate === null ? labels.empty : formatPercent(summary.softFiredRate);
  const waitText = summary.avgWaitedSec === null ? labels.empty : formatWaited(summary.avgWaitedSec, labels);
  const c = labels.countUnit;
  return [
    `${labels.total}: ${summary.total}${c}`,
    `${labels.detectionRate}: ${rateText}`,
    `${labels.auto}: ${summary.byResolution.auto}${c}`,
    `${labels.manual}: ${summary.byResolution.manual}${c}`,
    `${labels.softAccept}: ${summary.byResolution['soft-accept']}${c}`,
    `${labels.trainSelect}: ${summary.byResolution['train-select']}${c}`,
    `${labels.dismissed}: ${summary.dismissedTotal}${c}`,
    `${labels.avgWait}: ${waitText}`,
  ].join('\n');
};

const isEpisode = (value: unknown): value is DetectionEpisode => {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Partial<DetectionEpisode>;
  return (
    typeof e.recordedAtMs === 'number' &&
    (e.sessionKey === null || typeof e.sessionKey === 'string') &&
    typeof e.stepIndex === 'number' &&
    (e.stepKind === 'board' || e.stepKind === 'transfer') &&
    typeof e.stationName === 'string' &&
    typeof e.lineId === 'string' &&
    typeof e.waitedSec === 'number' &&
    typeof e.softFired === 'boolean' &&
    typeof e.dismissedCount === 'number' &&
    RESOLUTIONS.includes(e.resolution as DetectionResolution)
  );
};

// 슬롯 접근(읽기/수정/쓰기)을 도착 순서대로 직렬화한다 — 연속된 confirm이 동시에
// read-modify-write하다 에피소드를 유실하지 않게 한다(guidanceCompletionOutbox와 동일 패턴).
let opQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
  const run = opQueue.then(op, op);
  opQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Discriminated load result. `ok:false` means the READ itself failed (transient
 * storage error) — callers must NOT treat it as an empty history. `ok:true` with
 * `episodes:[]` means the slot is genuinely empty OR held corrupt data that was
 * cleared (a real data problem, not a transient fault).
 */
type LoadResult =
  | { readonly ok: true; readonly episodes: readonly DetectionEpisode[] }
  | { readonly ok: false };

const rawLoad = async (): Promise<LoadResult> => {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(GUIDANCE_DETECTION_METRICS_KEY);
  } catch (error) {
    // 일시적 읽기 실패 — 빈 이력과 구분(ok:false)해 호출자가 덮어쓰기/오표시하지 않게 한다.
    // eslint-disable-next-line no-console
    if (__DEV__) console.error('guidanceDetectionMetrics load failed:', error);
    return { ok: false };
  }
  if (raw === null) return { ok: true, episodes: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isEpisode)) {
      return { ok: true, episodes: parsed as readonly DetectionEpisode[] };
    }
  } catch {
    // Malformed JSON — fall through to clear the corrupt slot below.
  }
  // 손상 JSON / 형식 불일치 — 진짜 데이터 문제이므로 슬롯을 비우고 빈 이력(ok:true)으로 폴백한다.
  try {
    await AsyncStorage.removeItem(GUIDANCE_DETECTION_METRICS_KEY);
  } catch (error) {
    // eslint-disable-next-line no-console
    if (__DEV__) console.error('guidanceDetectionMetrics clear failed:', error);
  }
  return { ok: true, episodes: [] };
};

// Re-read → prune → persist, only writing when something actually expired. Runs
// as its own queued op (race-safe: re-reads the latest slot rather than writing a
// captured stale list), so a concurrent record between a load and this prune isn't
// clobbered. Never throws.
const prunePersistedIfNeeded = (): Promise<void> =>
  enqueue(async () => {
    const result = await rawLoad();
    if (!result.ok) return;
    const pruned = pruneExpired(result.episodes, Date.now());
    if (pruned.length === result.episodes.length) return;
    try {
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, JSON.stringify(pruned));
    } catch (error) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.error('guidanceDetectionMetrics prune-persist failed:', error);
    }
  });

/**
 * Load the persisted episodes, dropping any past the 90-day retention window.
 * Returns `null` when the READ failed (transient storage error — the caller
 * should surface a load error, NOT an empty summary) and `[]` when the slot is
 * genuinely empty (or held corrupt data that was cleared). Serialized.
 *
 * The pruned list is returned immediately (read is not blocked on the write);
 * when pruning removed anything, a fire-and-forget re-persist is queued so the
 * expired entries are physically deleted from storage too (R6-2).
 */
export const loadDetectionEpisodes = (): Promise<readonly DetectionEpisode[] | null> =>
  enqueue(async () => {
    const result = await rawLoad();
    if (!result.ok) return null;
    const pruned = pruneExpired(result.episodes, Date.now());
    if (pruned.length !== result.episodes.length) {
      void prunePersistedIfNeeded();
    }
    return pruned;
  });

/**
 * Append one episode and persist. Read-modify-write runs inside the queue so
 * concurrent records can't clobber each other. Never throws.
 *
 * On a failed READ the write is SKIPPED (this one episode is dropped) rather
 * than overwriting the existing history with a single-entry array — preserving
 * prior episodes is more important than capturing this one. Expired entries
 * (>90 days) are pruned before the append so the persisted list stays bounded
 * by the retention window (R6-2).
 */
export const recordDetectionEpisode = (episode: DetectionEpisode): Promise<void> =>
  enqueue(async () => {
    try {
      const result = await rawLoad();
      if (!result.ok) return;
      const next = appendEpisode(pruneExpired(result.episodes, Date.now()), episode);
      await AsyncStorage.setItem(GUIDANCE_DETECTION_METRICS_KEY, JSON.stringify(next));
    } catch (error) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.error('guidanceDetectionMetrics record failed:', error);
    }
  });

/** Clear all persisted metrics. Serialized; never throws. */
export const clearDetectionMetrics = (): Promise<void> =>
  enqueue(async () => {
    try {
      await AsyncStorage.removeItem(GUIDANCE_DETECTION_METRICS_KEY);
    } catch (error) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.error('guidanceDetectionMetrics clear failed:', error);
    }
  });
