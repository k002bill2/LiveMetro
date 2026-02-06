/**
 * Heatmap Service Tests
 */

import {
  heatmapService,
  DEFAULT_HEATMAP_COLORS,
  DEFAULT_TIME_RANGE,
} from '../heatmapService';
import { CongestionLevel } from '@/models/congestion';

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
}));

jest.mock('../congestionPredictionService', () => ({
  congestionPredictionService: {
    getHourlyPattern: jest.fn().mockResolvedValue({
      stationId: '222',
      lineId: '2',
      direction: 'up',
      dayOfWeek: 1,
      hourlyStats: Array.from({ length: 24 }, (_, i) => ({
        timeSlot: `${String(i).padStart(2, '0')}:00`,
        avgCongestion: 2,
        sampleCount: 5,
      })),
    }),
  },
}));

describe('HeatmapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DEFAULT_HEATMAP_COLORS', () => {
    it('should have 4 color values', () => {
      expect(DEFAULT_HEATMAP_COLORS.low).toBeDefined();
      expect(DEFAULT_HEATMAP_COLORS.moderate).toBeDefined();
      expect(DEFAULT_HEATMAP_COLORS.high).toBeDefined();
      expect(DEFAULT_HEATMAP_COLORS.crowded).toBeDefined();
    });
  });

  describe('DEFAULT_TIME_RANGE', () => {
    it('should have start and end hours', () => {
      expect(DEFAULT_TIME_RANGE.startHour).toBe(5);
      expect(DEFAULT_TIME_RANGE.endHour).toBe(24);
    });
  });

  describe('generateHeatmap', () => {
    it('should generate heatmap data', async () => {
      const result = await heatmapService.generateHeatmap(
        '222', '역삼', '2', 'up'
      );
      expect(result).toBeDefined();
      expect(result.stationId).toBe('222');
      expect(result.stationName).toBe('역삼');
      expect(result.cells).toBeDefined();
    });
  });

  describe('getColor', () => {
    it('should return color for low value', () => {
      const color = heatmapService.getColor(0);
      expect(typeof color).toBe('string');
    });

    it('should return color for high value', () => {
      const color = heatmapService.getColor(4);
      expect(typeof color).toBe('string');
    });

    it('should use custom colors', () => {
      const customColors = {
        low: '#000',
        moderate: '#111',
        high: '#222',
        crowded: '#333',
      };
      const color = heatmapService.getColor(0, customColors);
      expect(typeof color).toBe('string');
    });
  });

  describe('getInterpolatedColor', () => {
    it('should return interpolated color', () => {
      const color = heatmapService.getInterpolatedColor(0.5);
      expect(typeof color).toBe('string');
    });
  });

  describe('getOpacity', () => {
    it('should return opacity based on confidence', () => {
      const opacity = heatmapService.getOpacity(0.8);
      expect(typeof opacity).toBe('number');
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('formatHour', () => {
    it('should format hour', () => {
      const formatted = heatmapService.formatHour(8);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatDay', () => {
    it('should format day of week', () => {
      const formatted = heatmapService.formatDay(1);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('getCellSummary', () => {
    it('should return cell summary text', () => {
      const summary = heatmapService.getCellSummary({
        hour: 8,
        dayOfWeek: 1,
        value: 2,
        level: CongestionLevel.MODERATE,
        sampleCount: 10,
        confidence: 0.8,
      });
      expect(typeof summary).toBe('string');
    });
  });

  describe('getLevelText', () => {
    it('should return level text', () => {
      const text = heatmapService.getLevelText(CongestionLevel.LOW);
      expect(typeof text).toBe('string');
    });
  });

  describe('exportToCsv', () => {
    it('should export heatmap to CSV', () => {
      const csv = heatmapService.exportToCsv({
        stationId: '222',
        stationName: '역삼',
        lineId: '2',
        direction: 'up' as const,
        cells: [
          { hour: 8, dayOfWeek: 1, value: 2, level: CongestionLevel.MODERATE, sampleCount: 10, confidence: 0.8 },
        ],
        maxValue: 4,
        minValue: 0,
        lastUpdated: new Date(),
      });
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
    });
  });

  describe('findPeakTimes', () => {
    it('should find peak times', () => {
      const peaks = heatmapService.findPeakTimes({
        stationId: '222',
        stationName: '역삼',
        lineId: '2',
        direction: 'up' as const,
        cells: [
          { hour: 8, dayOfWeek: 1, value: 4, level: CongestionLevel.CROWDED, sampleCount: 10, confidence: 0.9 },
          { hour: 9, dayOfWeek: 1, value: 3, level: CongestionLevel.HIGH, sampleCount: 10, confidence: 0.8 },
          { hour: 10, dayOfWeek: 1, value: 1, level: CongestionLevel.LOW, sampleCount: 10, confidence: 0.7 },
        ],
        maxValue: 4,
        minValue: 1,
        lastUpdated: new Date(),
      });
      expect(Array.isArray(peaks)).toBe(true);
    });
  });

  describe('findLowCongestionTimes', () => {
    it('should find low congestion times', () => {
      const lows = heatmapService.findLowCongestionTimes({
        stationId: '222',
        stationName: '역삼',
        lineId: '2',
        direction: 'up' as const,
        cells: [
          { hour: 8, dayOfWeek: 1, value: 4, level: CongestionLevel.CROWDED, sampleCount: 10, confidence: 0.9 },
          { hour: 14, dayOfWeek: 1, value: 1, level: CongestionLevel.LOW, sampleCount: 10, confidence: 0.7 },
        ],
        maxValue: 4,
        minValue: 1,
        lastUpdated: new Date(),
      });
      expect(Array.isArray(lows)).toBe(true);
    });
  });

  describe('getRecommendedTimes', () => {
    it('should return recommended times', () => {
      const recommended = heatmapService.getRecommendedTimes({
        stationId: '222',
        stationName: '역삼',
        lineId: '2',
        direction: 'up' as const,
        cells: [
          { hour: 8, dayOfWeek: 1, value: 4, level: CongestionLevel.CROWDED, sampleCount: 10, confidence: 0.9 },
          { hour: 14, dayOfWeek: 1, value: 1, level: CongestionLevel.LOW, sampleCount: 10, confidence: 0.7 },
        ],
        maxValue: 4,
        minValue: 1,
        lastUpdated: new Date(),
      });
      expect(recommended).toBeDefined();
    });
  });
});
