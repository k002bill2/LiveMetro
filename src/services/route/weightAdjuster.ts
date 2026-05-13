/**
 * weightAdjuster — Phase A: 시간대 × 혼잡도 가중치 부스트
 *
 * 경로 탐색 시 에지 가중치에 곱하는 multiplier를 반환합니다.
 * 출퇴근 시간대의 혼잡 노선은 1.0보다 큰 값으로 부스트되어,
 * 약간 돌아가더라도 덜 혼잡한 경로가 선택될 가능성을 높입니다.
 *
 * Invariants:
 *  - 결과는 항상 [1.0, 1.5] 범위
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - congestion 정보 부재 시 1.0 (no-op)
 */

import { CongestionLevel } from '@models/train';
import { getCommuteTimeCategory } from '@utils/dateUtils';

type TimeCategory = 'morning-rush' | 'evening-rush' | 'normal';

const MULTIPLIER_MATRIX: Record<TimeCategory, Record<CongestionLevel, number>> = {
  'morning-rush': {
    [CongestionLevel.LOW]: 1.0,
    [CongestionLevel.MODERATE]: 1.15,
    [CongestionLevel.HIGH]: 1.3,
    [CongestionLevel.CROWDED]: 1.5,
  },
  'evening-rush': {
    [CongestionLevel.LOW]: 1.0,
    [CongestionLevel.MODERATE]: 1.15,
    [CongestionLevel.HIGH]: 1.3,
    [CongestionLevel.CROWDED]: 1.5,
  },
  'normal': {
    [CongestionLevel.LOW]: 1.0,
    [CongestionLevel.MODERATE]: 1.0,
    [CongestionLevel.HIGH]: 1.1,
    [CongestionLevel.CROWDED]: 1.2,
  },
};

export function getCongestionMultiplier(
  now: Date,
  congestionLevel: CongestionLevel | undefined
): number {
  if (congestionLevel === undefined) return 1.0;
  const category = getCommuteTimeCategory(now);
  return MULTIPLIER_MATRIX[category][congestionLevel];
}
