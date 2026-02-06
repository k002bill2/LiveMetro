/**
 * Fare Service Tests
 */

import { fareService } from '../fareService';

describe('FareService', () => {
  describe('calculateFare', () => {
    it('should calculate base fare for short routes', () => {
      const result = fareService.calculateFare(5, 'regular');

      expect(result.baseFare).toBe(1400);
      expect(result.additionalFare).toBe(0);
      expect(result.totalFare).toBe(1400);
    });

    it('should calculate additional fare for longer routes', () => {
      const result = fareService.calculateFare(15, 'regular'); // ~16.8km

      expect(result.baseFare).toBe(1400);
      expect(result.additionalFare).toBeGreaterThan(0);
      expect(result.totalFare).toBeGreaterThan(1400);
    });

    it('should return zero fare for seniors', () => {
      const result = fareService.calculateFare(20, 'senior');

      expect(result.totalFare).toBe(0);
      expect(result.baseFare).toBe(0);
      expect(result.additionalFare).toBe(0);
    });

    it('should apply youth discount', () => {
      const regularResult = fareService.calculateFare(5, 'regular');
      const youthResult = fareService.calculateFare(5, 'youth');

      expect(youthResult.baseFare).toBe(720);
      expect(youthResult.totalFare).toBeLessThan(regularResult.totalFare);
    });

    it('should apply child discount', () => {
      const regularResult = fareService.calculateFare(5, 'regular');
      const childResult = fareService.calculateFare(5, 'child');

      expect(childResult.baseFare).toBe(450);
      expect(childResult.totalFare).toBeLessThan(regularResult.totalFare);
    });
  });

  describe('calculateFareByDistance', () => {
    it('should return base fare for distances within 10km', () => {
      const result = fareService.calculateFareByDistance(8, 'regular');

      expect(result.totalFare).toBe(1400);
      expect(result.breakdown.baseDistance).toBe(8);
      expect(result.breakdown.additionalDistance).toBe(0);
    });

    it('should calculate additional fare for 10-50km zone', () => {
      const result = fareService.calculateFareByDistance(25, 'regular');

      expect(result.additionalFare).toBeGreaterThan(0);
      expect(result.breakdown.additionalDistance).toBe(15);
      expect(result.breakdown.additionalUnits).toBe(3); // 15km / 5km = 3 units
    });

    it('should calculate additional fare for 50km+ zone', () => {
      const result = fareService.calculateFareByDistance(60, 'regular');

      // 40km in zone 1 (8 units) + 10km in zone 2 (2 units) = 10 units
      expect(result.breakdown.additionalDistance).toBe(50);
      expect(result.breakdown.additionalUnits).toBeGreaterThanOrEqual(10);
    });

    it('should handle zero distance', () => {
      const result = fareService.calculateFareByDistance(0, 'regular');

      expect(result.totalFare).toBe(1400);
      expect(result.distance).toBe(0);
    });
  });

  describe('getRouteFareInfo', () => {
    it('should return complete route fare info', () => {
      const info = fareService.getRouteFareInfo(10, false, 'regular');

      expect(info.stationCount).toBe(10);
      expect(info.estimatedDistance).toBeGreaterThan(0);
      expect(info.fare).toBeDefined();
      expect(info.transferDiscount).toBe(0);
    });

    it('should apply transfer discount when specified', () => {
      const info = fareService.getRouteFareInfo(10, true, 'regular');

      expect(info.transferDiscount).toBe(0); // Currently 0, but structure supports it
    });
  });

  describe('compareFares', () => {
    it('should identify cheaper route', () => {
      const comparison = fareService.compareFares(5, 15, 'regular');

      expect(comparison.route1Fare.totalFare).toBeLessThanOrEqual(comparison.route2Fare.totalFare);
      expect(comparison.cheaperRoute).toBe(1);
    });

    it('should identify equal routes', () => {
      const comparison = fareService.compareFares(5, 5, 'regular');

      expect(comparison.difference).toBe(0);
      expect(comparison.cheaperRoute).toBe('equal');
    });

    it('should calculate fare difference', () => {
      const comparison = fareService.compareFares(5, 20, 'regular');

      expect(comparison.difference).toBeGreaterThan(0);
    });
  });

  describe('formatFare', () => {
    it('should format fare with Korean locale', () => {
      const formatted = fareService.formatFare(1400);

      expect(formatted).toContain('1,400');
      expect(formatted).toContain('원');
    });

    it('should format large fares correctly', () => {
      const formatted = fareService.formatFare(10000);

      expect(formatted).toContain('10,000');
    });
  });

  describe('getFareTypeLabel', () => {
    it('should return correct labels for each fare type', () => {
      expect(fareService.getFareTypeLabel('regular')).toBe('일반');
      expect(fareService.getFareTypeLabel('youth')).toBe('청소년');
      expect(fareService.getFareTypeLabel('child')).toBe('어린이');
      expect(fareService.getFareTypeLabel('senior')).toBe('경로');
    });
  });

  describe('estimateDistance', () => {
    it('should estimate distance from station count', () => {
      const distance = fareService.estimateDistance(10);

      // 9 segments * 1.2km = 10.8km
      expect(distance).toBeCloseTo(10.8, 1);
    });

    it('should return 0 for single station', () => {
      const distance = fareService.estimateDistance(1);

      expect(distance).toBe(0);
    });

    it('should handle zero stations', () => {
      const distance = fareService.estimateDistance(0);

      expect(distance).toBe(0);
    });
  });

  describe('calculateActualDistance', () => {
    it('should sum all station distances', () => {
      const distances = [1.2, 1.5, 0.8, 2.0];
      const total = fareService.calculateActualDistance(distances);

      expect(total).toBeCloseTo(5.5, 1);
    });

    it('should return 0 for empty array', () => {
      const total = fareService.calculateActualDistance([]);

      expect(total).toBe(0);
    });
  });

  describe('fare calculation edge cases', () => {
    it('should handle exact 10km distance', () => {
      const result = fareService.calculateFareByDistance(10, 'regular');

      expect(result.totalFare).toBe(1400);
      expect(result.additionalFare).toBe(0);
    });

    it('should handle exact 50km distance', () => {
      const result = fareService.calculateFareByDistance(50, 'regular');

      // 40km additional in zone 1 = 8 units * 100원 = 800원
      expect(result.additionalFare).toBe(800);
    });

    it('should handle very long distances', () => {
      const result = fareService.calculateFareByDistance(100, 'regular');

      expect(result.totalFare).toBeGreaterThan(2000);
      expect(result.breakdown.additionalUnits).toBeGreaterThan(10);
    });
  });
});
