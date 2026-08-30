/**
 * departureDetection — infer "the awaited train has departed" from successive
 * realtime snapshots, with no GPS.
 *
 * Departed trains (Seoul API `arvlCd === '2'`) are filtered out before they
 * reach `useRealtimeTrains`, so departure is not directly observable. Instead
 * we infer it: a train that was *arriving* (ETA within a small threshold) in
 * the previous snapshot and is *absent* from the next snapshot has left the
 * platform. `Train.id` is `btrainNo`-based and poll-stable, so id disappearance
 * is the signal.
 *
 * Governing principle: a false positive (auto-advancing a journey that did not
 * depart) is the costly error; a false negative just falls back to the manual
 * tap. The gate is deliberately conservative.
 *
 * Pure / timer-free / RN-free — unit-tested like guidanceSteps.ts.
 */
import type { Train } from '@/models/train';
import { isOnCanonicalLine, resolveCanonicalLineId } from '@/utils/canonicalLine';

/** ETA window (seconds) treated as "arriving / at the platform" (arvlCd '0'/'1'). */
export const ARRIVING_ETA_THRESHOLD_SEC = 30;

export interface AwaitedTrain {
  /** Line being waited on (board.lineId | transfer.toLineId). */
  readonly lineId: string;
  /** Best-effort travel-direction endpoint name ("OO 방면"), or null. */
  readonly directionName: string | null;
  /** 사용자가 선택한 선호 종점행. 비어 있지 않으면 directionName 매칭을 대체하며,
   *  선호 밖 열차의 출발은 감지하지 않는다 (폴백 없음 — 자동 진행 방지). */
  readonly preferredDestinations?: readonly string[];
}

export interface DepartureDetectionInput {
  /** Previous successful snapshot, or null on the first poll for this step. */
  readonly prev: readonly Train[] | null;
  /** Current successful snapshot. */
  readonly next: readonly Train[];
  readonly awaited: AwaitedTrain;
  /** Shared 1Hz clock used to derive ETA from arrivalTime. */
  readonly nowMs: number;
  readonly thresholdSec?: number;
}

export interface DepartureDetectionResult {
  readonly departed: boolean;
  /** The id inferred as departed (for cooldown keying), or null. */
  readonly trainId: string | null;
}

const NOT_DEPARTED: DepartureDetectionResult = { departed: false, trainId: null };

/** Seoul 본선 1~9호선인지 — canonical id 기준. 확장 노선 추가 게이트 선택에만 쓴다. */
const isNumberedLine = (canonicalLineId: string): boolean => /^[1-9]$/.test(canonicalLineId);

const etaSeconds = (train: Train, nowMs: number): number | null =>
  train.arrivalTime === null ? null : Math.floor((train.arrivalTime.getTime() - nowMs) / 1000);

/**
 * Returns whether the awaited train departed between `prev` and `next`, and
 * which train id it was. Returns not-departed for the first snapshot, empty
 * inputs, or any case that fails the conservative gate.
 */
export const detectDeparture = (input: DepartureDetectionInput): DepartureDetectionResult => {
  const { prev, next, awaited, nowMs, thresholdSec = ARRIVING_ETA_THRESHOLD_SEC } = input;

  if (prev === null || prev.length === 0) return NOT_DEPARTED;

  // 노선 필터는 숫자·확장 노선에 동일하게 적용된다 (canonicalLine.ts). 미지의 노선은
  // 후보를 특정할 수 없으므로 수동으로 강등한다 — 자동 진행의 false positive 가 가장
  // 비싼 오류라는 이 파일의 지배 원칙 그대로. 위치 API 미지원 노선(인천2 등)은 도착
  // 스냅샷 기준으로 정상 판정되며, 확장 노선이므로 아래 방면/선호 게이트를 받는다.
  const canonicalLine = resolveCanonicalLineId(awaited.lineId);
  if (canonicalLine === null) return NOT_DEPARTED;

  const numbered = isNumberedLine(canonicalLine);
  const prefs = awaited.preferredDestinations ?? [];

  // 확장 노선은 노선 필터를 통과해도 방면/선호 매칭을 추가로 요구한다. 다노선 혼입은
  // 위 필터로 해소됐지만, 수인분당선·경의중앙선의 분기 종점(청량리/인천, 문산/지평)이라는
  // 독립적인 모호성이 남는다 — 그 상태로 자동 진행하느니 수동으로 강등한다.
  if (!numbered && awaited.directionName === null && prefs.length === 0) return NOT_DEPARTED;

  const onLine = (train: Train): boolean => isOnCanonicalLine(canonicalLine, train.lineId);

  const directionMatches = (train: Train): boolean =>
    awaited.directionName === null ? true : train.finalDestination === awaited.directionName;

  const preferMatches = (train: Train): boolean => prefs.includes(train.finalDestination);

  // A candidate was "arriving" (0 ≤ ETA ≤ threshold) on the awaited line in `prev`.
  const qualifies = (train: Train): boolean => {
    if (!onLine(train)) return false;
    const eta = etaSeconds(train, nowMs);
    if (eta === null || eta < 0 || eta > thresholdSec) return false;
    // Extended lines demand a strong direction match; numbered lines rely on
    // the line filter (direction is applied as best-effort narrowing below).
    if (numbered) return true;
    return prefs.length > 0 ? preferMatches(train) : directionMatches(train);
  };

  const candidates = prev.filter(qualifies);
  if (candidates.length === 0) return NOT_DEPARTED;

  // 선호 종점행이 지정되면 그것만이 "기다리는 열차"다 — 방면명 best-effort 폴백과
  // 달리 선호 밖 후보로 넓히지 않는다 (선호 밖 열차 출발 = 사용자가 보내는 열차).
  //
  // Numbered-line best-effort narrowing (선호 부재 시): prefer the awaited direction
  // when any candidate matches, but don't drop everything when none do (endpoint name
  // vs short-turn terminus can legitimately differ).
  const pool =
    prefs.length > 0
      ? candidates.filter(preferMatches)
      : (() => {
          const preferred =
            numbered && awaited.directionName !== null
              ? candidates.filter(directionMatches)
              : candidates;
          return preferred.length > 0 ? preferred : candidates;
        })();
  if (pool.length === 0) return NOT_DEPARTED;

  const nextIds = new Set(next.map(t => t.id));
  const departed = pool.find(t => !nextIds.has(t.id));

  return departed ? { departed: true, trainId: departed.id } : NOT_DEPARTED;
};
