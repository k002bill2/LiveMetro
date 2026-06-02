import {
  CONGESTION_LEVEL_TO_PERCENT,
  carsToPercentages,
} from '../congestionDisplay';
import { CongestionLevel } from '@/models/congestion';
import type { CarCongestion } from '@/models/congestion';

const car = (carNumber: number, level: CongestionLevel): CarCongestion => ({
  carNumber,
  congestionLevel: level,
  reportCount: 5,
  lastUpdated: new Date('2026-06-02T00:00:00.000Z'),
});

describe('congestionDisplay', () => {
  it('maps each congestion level to its center-of-band percent', () => {
    expect(CONGESTION_LEVEL_TO_PERCENT[CongestionLevel.LOW]).toBe(20);
    expect(CONGESTION_LEVEL_TO_PERCENT[CongestionLevel.MODERATE]).toBe(50);
    expect(CONGESTION_LEVEL_TO_PERCENT[CongestionLevel.HIGH]).toBe(80);
    expect(CONGESTION_LEVEL_TO_PERCENT[CongestionLevel.CROWDED]).toBe(95);
  });

  it('returns an empty array for no cars', () => {
    expect(carsToPercentages([])).toEqual([]);
  });

  it('converts cars to percentages preserving order', () => {
    const cars = [
      car(1, CongestionLevel.CROWDED),
      car(2, CongestionLevel.LOW),
      car(3, CongestionLevel.HIGH),
    ];
    expect(carsToPercentages(cars)).toEqual([95, 20, 80]);
  });
});
