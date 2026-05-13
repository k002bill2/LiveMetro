/**
 * transferTime — Phase D: 환승 시간 역별 lookup
 *
 * 주요 환승역의 실측/추정 환승 시간을 테이블로 관리. 미등록 역은 DEFAULT_TRANSFER_TIME (4분).
 *
 * 초기 데이터는 16개 주요 환승역 (시청, 충무로, 동대문역사문화공원, 왕십리, 잠실 등)을
 * 포함하며, 양방향 환승은 대칭으로 간주합니다 (Phase D 첫 cut).
 *
 * 향후 확장:
 *  - per-line-pair 비대칭 시간 (계단 vs 에스컬레이터)
 *  - 시간대별 가변 (Phase A의 multiplier와 합성 가능)
 */

import transferTimesJson from '@/data/transferTimes.json';

/**
 * Default transfer time when station not in lookup table.
 * Matches the historical `AVG_TRANSFER_TIME` constant (4 minutes).
 */
export const DEFAULT_TRANSFER_TIME = 4;

const TRANSFER_TIME_TABLE = transferTimesJson as Record<string, number>;

export function getTransferTime(stationId: string): number {
  return TRANSFER_TIME_TABLE[stationId] ?? DEFAULT_TRANSFER_TIME;
}
