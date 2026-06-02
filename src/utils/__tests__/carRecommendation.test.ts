import { recommendCar } from '../carRecommendation';
import { CongestionLevel } from '@/models/congestion';
import type { CarCongestion } from '@/models/congestion';

/**
 * carRecommendation — picks the least-congested car that has enough reports to
 * be trustworthy. Mirrors the design's "추천 N번 칸 / N번 칸이 가장 여유로워요".
 *
 * 신뢰도 게이트: reportCount >= MIN_REPORTS_FOR_RELIABILITY(3) 인 칸만 후보.
 * 데이터가 부실하면 null (UI는 추천을 숨김 — 메모리: design copy honesty over fidelity).
 */

const car = (
  carNumber: number,
  congestionLevel: CongestionLevel,
  reportCount: number
): CarCongestion => ({
  carNumber,
  congestionLevel,
  reportCount,
  lastUpdated: new Date('2026-06-02T00:00:00.000Z'),
});

describe('recommendCar', () => {
  it('returns null for an empty car list', () => {
    expect(recommendCar([])).toBeNull();
  });

  it('returns null when no car meets the reliability threshold', () => {
    // 모든 칸의 reportCount < 3 → 신뢰할 수 없어 추천 없음.
    const cars = [
      car(1, CongestionLevel.LOW, 2),
      car(2, CongestionLevel.LOW, 1),
      car(3, CongestionLevel.MODERATE, 0),
    ];
    expect(recommendCar(cars)).toBeNull();
  });

  it('picks the least-congested car among reliable cars', () => {
    const cars = [
      car(1, CongestionLevel.CROWDED, 5),
      car(2, CongestionLevel.HIGH, 5),
      car(7, CongestionLevel.LOW, 5),
      car(8, CongestionLevel.MODERATE, 5),
    ];
    const result = recommendCar(cars);
    expect(result?.carNumber).toBe(7);
    expect(result?.congestionLevel).toBe(CongestionLevel.LOW);
  });

  it('ignores a less-congested car that lacks enough reports', () => {
    // 1번 칸이 더 여유롭지만 reportCount 2 < 3 → 신뢰 가능한 5번 칸 추천.
    const cars = [
      car(1, CongestionLevel.LOW, 2),
      car(5, CongestionLevel.MODERATE, 4),
      car(6, CongestionLevel.HIGH, 7),
    ];
    const result = recommendCar(cars);
    expect(result?.carNumber).toBe(5);
  });

  it('breaks ties by the lower car number', () => {
    const cars = [
      car(9, CongestionLevel.LOW, 3),
      car(4, CongestionLevel.LOW, 3),
      car(6, CongestionLevel.LOW, 10),
    ];
    // 셋 다 LOW + 신뢰 → 가장 낮은 칸 번호(4) 선택. reportCount는 tie-break 아님.
    expect(recommendCar(cars)?.carNumber).toBe(4);
  });

  it('returns the single reliable car when only one qualifies', () => {
    const cars = [
      car(1, CongestionLevel.HIGH, 1),
      car(2, CongestionLevel.CROWDED, 3),
      car(3, CongestionLevel.LOW, 0),
    ];
    expect(recommendCar(cars)?.carNumber).toBe(2);
  });
});
