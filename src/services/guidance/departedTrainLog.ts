/**
 * departedTrainLog — remember trains that have *left* the platform so the rider
 * can retroactively pick "the train I actually boarded" and rebase guidance to
 * its departure time. Seoul's arrival API is station-scoped (departed trains are
 * filtered out upstream), so departure is never directly observable — we infer
 * and estimate it from the board/transfer polling snapshots.
 *
 * - **observed**: an "arriving" train (ETA ≤ threshold, mirrors
 *   `departureDetection.ts`) that disappears in the next snapshot. Unlike
 *   soft-confirm's single conservative verdict, we log *every* such candidate;
 *   direction filtering happens at the display layer.
 * - **estimated**: at the moment boarding is confirmed, polling stops, so later
 *   departures can't be observed. The last snapshot's still-approaching trains
 *   are kept with an estimated departure time (arrival + dwell) to cover the
 *   ride-time "change train" case.
 *
 * Storage is a JS-heap module store (mirrors `boardingSelectionStore` — no
 * AsyncStorage persistence; the "방금 출발" fallback absorbs a lost log). Pure
 * functions do the collection/merge; the store is a thin wrapper. 15-min
 * retention, trainId dedup (observed wins), newest-first.
 */
import type { Train } from '@/models/train';
import { ARRIVING_ETA_THRESHOLD_SEC } from '@/services/guidance/departureDetection';

export interface DepartedTrainEntry {
  readonly trainId: string;
  readonly finalDestination: string;
  readonly lineId: string;
  /** 관측된 대기 역 이름 — 표시/필터 키 */
  readonly stationName: string;
  readonly departedAtMs: number;
  readonly confidence: 'observed' | 'estimated';
}

export const DEPARTED_LOG_RETENTION_MS = 15 * 60 * 1000;
/** 추정 항목의 도착→출발 정차 가산치 */
export const ESTIMATED_DWELL_MS = 30 * 1000;
/**
 * prev 스냅샷 촬영 시점과 판정 시점(nowMs) 사이의 폴링 간격 보정. 30초 폴링에서
 * prev의 ETA≈0 열차는 nowMs엔 ETA가 음수가 되므로, 이 구간(직전 주기 30s + 여유)
 * 안의 "이미 도착이 지난" 열차도 관측 출발 후보로 살린다.
 */
export const OBSERVED_ETA_LOOKBACK_SEC = 60;

const isNumberedLine = (lineId: string): boolean => /^[1-9]$/.test(lineId);

const etaSeconds = (train: Train, nowMs: number): number | null =>
  train.arrivalTime === null ? null : Math.floor((train.arrivalTime.getTime() - nowMs) / 1000);

export interface CollectDeparturesInput {
  readonly prev: readonly Train[] | null;
  readonly next: readonly Train[];
  readonly lineId: string;
  readonly stationName: string;
  readonly nowMs: number;
  readonly thresholdSec?: number;
}

/**
 * Every train that was "arriving" (0 ≤ ETA ≤ threshold) on the awaited line in
 * `prev` and is absent from `next`. Numbered lines apply the line filter;
 * extended lines pass all trains (the rider disambiguates by destination).
 */
export const collectDepartures = (input: CollectDeparturesInput): DepartedTrainEntry[] => {
  const { prev, next, lineId, stationName, nowMs, thresholdSec = ARRIVING_ETA_THRESHOLD_SEC } = input;
  if (prev === null || prev.length === 0) return [];

  const numbered = isNumberedLine(lineId);
  const nextIds = new Set(next.map(t => t.id));
  const result: DepartedTrainEntry[] = [];

  for (const t of prev) {
    if (numbered && t.lineId !== lineId) continue;
    const eta = etaSeconds(t, nowMs);
    // Lookback keeps trains that arrived within the last poll interval — their
    // ETA has gone negative by nowMs but they only just left the platform.
    if (eta === null || eta < -OBSERVED_ETA_LOOKBACK_SEC || eta > thresholdSec) continue;
    if (nextIds.has(t.id)) continue;
    // Refine the departure time for already-arrived trains (arrival + dwell),
    // but never allow a future departedAtMs (invariant: ≤ nowMs).
    const departedAtMs =
      eta <= 0 && t.arrivalTime !== null
        ? Math.min(t.arrivalTime.getTime() + ESTIMATED_DWELL_MS, nowMs)
        : nowMs;
    result.push({
      trainId: t.id,
      finalDestination: t.finalDestination,
      lineId: t.lineId,
      stationName,
      departedAtMs,
      confidence: 'observed',
    });
  }

  return result;
};

export interface CollectEstimatesInput {
  readonly trains: readonly Train[];
  readonly lineId: string;
  readonly stationName: string;
  readonly nowMs: number;
}

/**
 * The last snapshot's still-approaching trains (ETA ≥ 0), kept with an estimated
 * departure time (arrival + dwell) for the ride-time "change train" scenario.
 */
export const collectEstimates = (input: CollectEstimatesInput): DepartedTrainEntry[] => {
  const { trains, lineId, stationName, nowMs } = input;
  const numbered = isNumberedLine(lineId);
  const result: DepartedTrainEntry[] = [];

  for (const t of trains) {
    if (numbered && t.lineId !== lineId) continue;
    if (t.arrivalTime === null) continue;
    const eta = etaSeconds(t, nowMs);
    if (eta === null || eta < 0) continue;
    result.push({
      trainId: t.id,
      finalDestination: t.finalDestination,
      lineId: t.lineId,
      stationName,
      departedAtMs: t.arrivalTime.getTime() + ESTIMATED_DWELL_MS,
      confidence: 'estimated',
    });
  }

  return result;
};

/** observed beats estimated; same confidence → the later departure wins. */
const pickWinner = (a: DepartedTrainEntry, b: DepartedTrainEntry): DepartedTrainEntry => {
  if (a.confidence !== b.confidence) return a.confidence === 'observed' ? a : b;
  return b.departedAtMs > a.departedAtMs ? b : a;
};

/**
 * Merge `incoming` into `log`: trainId+station dedup (see {@link pickWinner}),
 * prune entries older than the retention window, sort newest-first. Inputs are
 * never mutated (new array returned).
 */
export const mergeLog = (
  log: readonly DepartedTrainEntry[],
  incoming: readonly DepartedTrainEntry[],
  nowMs: number
): DepartedTrainEntry[] => {
  // Dedup key includes the station so the same train logged at two stations
  // (e.g. board station vs a later stop) doesn't push out a valid candidate.
  const byKey = new Map<string, DepartedTrainEntry>();
  for (const e of [...log, ...incoming]) {
    const key = `${e.trainId}|${e.stationName}`;
    const existing = byKey.get(key);
    byKey.set(key, existing === undefined ? e : pickWinner(existing, e));
  }

  const cutoff = nowMs - DEPARTED_LOG_RETENTION_MS;
  return Array.from(byKey.values())
    .filter(e => e.departedAtMs >= cutoff)
    .sort((a, b) => b.departedAtMs - a.departedAtMs);
};

// ── Module heap store (mirrors boardingSelectionStore — no AsyncStorage) ──
let log: readonly DepartedTrainEntry[] = [];

export const getDepartedTrainLog = (): readonly DepartedTrainEntry[] => log;

export const appendDepartedTrains = (
  entries: readonly DepartedTrainEntry[],
  nowMs: number
): void => {
  if (entries.length === 0) return;
  log = mergeLog(log, entries, nowMs);
};

export const clearDepartedTrainLog = (): void => {
  log = [];
};
