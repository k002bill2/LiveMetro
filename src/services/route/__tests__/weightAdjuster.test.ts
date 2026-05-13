/**
 * weightAdjuster — Phase A: 시간대 × 혼잡도 가중치 부스트
 *
 * 매트릭스 (12조합):
 *                 LOW   MODERATE  HIGH   CROWDED
 *  morning-rush   1.0   1.15      1.3    1.5
 *  evening-rush   1.0   1.15      1.3    1.5
 *  normal         1.0   1.0       1.1    1.2
 */

import { getCongestionMultiplier } from '../weightAdjuster';
import { CongestionLevel } from '@models/train';

// 평일 기준 시각 (2026-05-13 Wed 확인됨, 2026-05-09 Sat)
const morningRush = new Date(2026, 4, 13, 8, 30);
const eveningRush = new Date(2026, 4, 13, 18, 30);
const normalNoon = new Date(2026, 4, 13, 12, 0);
const weekendRushHour = new Date(2026, 4, 9, 8, 30); // Sat 08:30 → normal

describe('getCongestionMultiplier', () => {
  describe('morning-rush', () => {
    it('LOW → 1.0', () => {
      expect(getCongestionMultiplier(morningRush, CongestionLevel.LOW)).toBe(1.0);
    });
    it('MODERATE → 1.15', () => {
      expect(getCongestionMultiplier(morningRush, CongestionLevel.MODERATE)).toBe(1.15);
    });
    it('HIGH → 1.3', () => {
      expect(getCongestionMultiplier(morningRush, CongestionLevel.HIGH)).toBe(1.3);
    });
    it('CROWDED → 1.5', () => {
      expect(getCongestionMultiplier(morningRush, CongestionLevel.CROWDED)).toBe(1.5);
    });
  });

  describe('evening-rush', () => {
    it('LOW → 1.0', () => {
      expect(getCongestionMultiplier(eveningRush, CongestionLevel.LOW)).toBe(1.0);
    });
    it('MODERATE → 1.15', () => {
      expect(getCongestionMultiplier(eveningRush, CongestionLevel.MODERATE)).toBe(1.15);
    });
    it('HIGH → 1.3', () => {
      expect(getCongestionMultiplier(eveningRush, CongestionLevel.HIGH)).toBe(1.3);
    });
    it('CROWDED → 1.5', () => {
      expect(getCongestionMultiplier(eveningRush, CongestionLevel.CROWDED)).toBe(1.5);
    });
  });

  describe('normal', () => {
    it('LOW → 1.0', () => {
      expect(getCongestionMultiplier(normalNoon, CongestionLevel.LOW)).toBe(1.0);
    });
    it('MODERATE → 1.0 (no boost off-peak)', () => {
      expect(getCongestionMultiplier(normalNoon, CongestionLevel.MODERATE)).toBe(1.0);
    });
    it('HIGH → 1.1', () => {
      expect(getCongestionMultiplier(normalNoon, CongestionLevel.HIGH)).toBe(1.1);
    });
    it('CROWDED → 1.2', () => {
      expect(getCongestionMultiplier(normalNoon, CongestionLevel.CROWDED)).toBe(1.2);
    });
  });

  describe('weekend', () => {
    it('Saturday rush hour treated as normal — HIGH → 1.1 not 1.3', () => {
      expect(getCongestionMultiplier(weekendRushHour, CongestionLevel.HIGH)).toBe(1.1);
    });
  });

  describe('graceful defaults', () => {
    it('undefined congestion → 1.0', () => {
      expect(getCongestionMultiplier(morningRush, undefined)).toBe(1.0);
    });
  });

  describe('invariants', () => {
    it('all 12 + undefined results stay within [1.0, 1.5]', () => {
      const times = [morningRush, eveningRush, normalNoon];
      const levels: (CongestionLevel | undefined)[] = [
        CongestionLevel.LOW,
        CongestionLevel.MODERATE,
        CongestionLevel.HIGH,
        CongestionLevel.CROWDED,
        undefined,
      ];
      for (const t of times) {
        for (const l of levels) {
          const m = getCongestionMultiplier(t, l);
          expect(m).toBeGreaterThanOrEqual(1.0);
          expect(m).toBeLessThanOrEqual(1.5);
        }
      }
    });

    it('same input yields same output (deterministic)', () => {
      const a = getCongestionMultiplier(morningRush, CongestionLevel.HIGH);
      const b = getCongestionMultiplier(morningRush, CongestionLevel.HIGH);
      expect(a).toBe(b);
    });
  });
});
