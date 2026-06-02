/**
 * Car recommendation — picks the least-congested train car worth recommending.
 *
 * 디자인 핸드오프의 "추천 N번 칸 / N번 칸이 가장 여유로워요"를 구동한다.
 * 크라우드소싱 혼잡도는 제보 수가 적으면 신뢰할 수 없으므로, 신뢰도 게이트
 * (reportCount >= MIN_REPORTS_FOR_RELIABILITY)를 통과한 칸만 후보로 삼는다.
 * 신뢰할 데이터가 없으면 `null`을 반환해 UI가 추천을 숨기도록 한다
 * (없는 정보를 지어내지 않음 — design copy honesty over fidelity).
 */
import {
  CongestionLevel,
  MIN_REPORTS_FOR_RELIABILITY,
  type CarCongestion,
} from '@/models/congestion';

/**
 * Lower rank = more comfortable. Drives "가장 여유로운 칸" selection.
 * 모델 enum은 문자열이라 직접 비교가 불가능하므로 명시적 순위 맵을 둔다.
 */
const LEVEL_RANK: Record<CongestionLevel, number> = {
  [CongestionLevel.LOW]: 0,
  [CongestionLevel.MODERATE]: 1,
  [CongestionLevel.HIGH]: 2,
  [CongestionLevel.CROWDED]: 3,
};

/**
 * Recommend the least-congested car that has enough reports to be trustworthy.
 *
 * @param cars per-car crowdsourced congestion summary
 * @returns the recommended car, or `null` when no car has reliable data
 */
export const recommendCar = (
  cars: readonly CarCongestion[]
): CarCongestion | null => {
  let best: CarCongestion | null = null;

  for (const car of cars) {
    // 신뢰도 게이트 — 제보가 충분치 않은 칸은 추천 후보에서 제외.
    if (car.reportCount < MIN_REPORTS_FOR_RELIABILITY) continue;

    if (best === null) {
      best = car;
      continue;
    }

    const rankDelta = LEVEL_RANK[car.congestionLevel] - LEVEL_RANK[best.congestionLevel];
    // 더 여유롭거나(낮은 rank), 동률이면 낮은 칸 번호를 우선.
    if (rankDelta < 0 || (rankDelta === 0 && car.carNumber < best.carNumber)) {
      best = car;
    }
  }

  return best;
};
