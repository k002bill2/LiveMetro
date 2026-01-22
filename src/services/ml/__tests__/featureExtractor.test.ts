/**
 * Feature Extractor Service Tests
 */

import { featureExtractor } from '../featureExtractor';
import { CommuteLog, DayOfWeek } from '@/models/pattern';

// Mock tensorflowSetup
jest.mock('../tensorflowSetup', () => ({
  normalize: jest.requireActual('../tensorflowSetup').normalize,
  denormalize: jest.requireActual('../tensorflowSetup').denormalize,
}));

// Day of week constants (0 = Sunday)
const MONDAY: DayOfWeek = 1;
const TUESDAY: DayOfWeek = 2;
const FRIDAY: DayOfWeek = 5;
const SUNDAY: DayOfWeek = 0;

describe('FeatureExtractorService', () => {
  const mockCommuteLog: CommuteLog = {
    id: 'log-1',
    userId: 'user-1',
    date: '2024-01-15',
    dayOfWeek: MONDAY,
    departureStationId: 'gangnam',
    departureStationName: '강남',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    departureTime: '08:30',
    arrivalTime: '09:00',
    lineIds: ['2'],
    wasDelayed: false,
    isManual: false,
    createdAt: new Date('2024-01-15'),
  };

  describe('extractSingleFeature', () => {
    it('should extract features from a commute log', () => {
      const features = featureExtractor.extractSingleFeature(mockCommuteLog);

      expect(features.dayOfWeekCyclic).toHaveLength(2);
      expect(features.departureTimeNormalized).toBeGreaterThanOrEqual(0);
      expect(features.departureTimeNormalized).toBeLessThanOrEqual(1);
      expect(features.arrivalTimeNormalized).toBeGreaterThan(features.departureTimeNormalized);
      expect(features.routeEmbedding).toHaveLength(4);
      expect(features.historicalDelayRate).toBe(0);
      expect(features.recentDelayIndicator).toBe(0);
      expect(features.holidayFlag).toBe(0);
    });

    it('should handle custom options', () => {
      const features = featureExtractor.extractSingleFeature(
        mockCommuteLog,
        0.3,
        true,
        'rain',
        true
      );

      expect(features.historicalDelayRate).toBe(0.3);
      expect(features.recentDelayIndicator).toBe(1);
      expect(features.weatherFeature).toBe(1); // rain = 1
      expect(features.holidayFlag).toBe(1);
    });

    it('should clamp historicalDelayRate between 0 and 1', () => {
      const features1 = featureExtractor.extractSingleFeature(mockCommuteLog, 1.5);
      expect(features1.historicalDelayRate).toBe(1);

      const features2 = featureExtractor.extractSingleFeature(mockCommuteLog, -0.5);
      expect(features2.historicalDelayRate).toBe(0);
    });
  });

  describe('extractFeatures', () => {
    it('should extract features from multiple logs', () => {
      const logs: CommuteLog[] = [
        mockCommuteLog,
        {
          ...mockCommuteLog,
          id: 'log-2',
          date: '2024-01-16',
          dayOfWeek: TUESDAY,
          wasDelayed: true,
        },
      ];

      const result = featureExtractor.extractFeatures(logs);

      expect(result.features).toBeNull();
      expect(result.labels).toBeNull();
      expect(result.featureVectors).toHaveLength(2);
    });

    it('should calculate recent delay from previous log', () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-1', wasDelayed: true },
        { ...mockCommuteLog, id: 'log-2' },
      ];

      const result = featureExtractor.extractFeatures(logs);

      expect(result.featureVectors[0]?.recentDelayIndicator).toBe(0);
      expect(result.featureVectors[1]?.recentDelayIndicator).toBe(1);
    });

    it('should handle empty logs array', () => {
      const result = featureExtractor.extractFeatures([]);

      expect(result.featureVectors).toHaveLength(0);
    });
  });

  describe('createInputTensor', () => {
    it('should return null', () => {
      const features = featureExtractor.extractSingleFeature(mockCommuteLog);
      expect(featureExtractor.createInputTensor(features)).toBeNull();
    });
  });

  describe('normalizeTime', () => {
    it('should normalize time string to 0-1 range', () => {
      expect(featureExtractor.normalizeTime('00:00')).toBe(0);
      expect(featureExtractor.normalizeTime('12:00')).toBe(0.5);
      expect(featureExtractor.normalizeTime('23:59')).toBeCloseTo(0.999, 2);
    });

    it('should handle morning commute times', () => {
      const time = featureExtractor.normalizeTime('08:30');
      expect(time).toBeGreaterThan(0.3);
      expect(time).toBeLessThan(0.4);
    });
  });

  describe('denormalizeTime', () => {
    it('should denormalize from 0-1 to time string', () => {
      expect(featureExtractor.denormalizeTime(0)).toBe('00:00');
      expect(featureExtractor.denormalizeTime(0.5)).toBe('12:00');
    });

    it('should clamp values between 0 and 1', () => {
      expect(featureExtractor.denormalizeTime(-0.5)).toBe('00:00');
      expect(featureExtractor.denormalizeTime(1.5)).toBe('00:00'); // overflow wraps
    });

    it('should round to nearest minute', () => {
      const time = featureExtractor.denormalizeTime(0.354);
      expect(time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('encodeDayOfWeek', () => {
    it('should encode day using sin/cos', () => {
      const [sin, cos] = featureExtractor.encodeDayOfWeek(MONDAY);

      expect(sin).toBeGreaterThan(0);
      expect(cos).toBeLessThan(1);
    });

    it('should produce different encodings for different days', () => {
      const monday = featureExtractor.encodeDayOfWeek(MONDAY);
      const friday = featureExtractor.encodeDayOfWeek(FRIDAY);

      expect(monday[0]).not.toBe(friday[0]);
      expect(monday[1]).not.toBe(friday[1]);
    });

    it('should produce cyclic encodings', () => {
      const sunday = featureExtractor.encodeDayOfWeek(SUNDAY);

      expect(sunday[0]).toBeCloseTo(0, 5);
      expect(sunday[1]).toBeCloseTo(1, 5);
    });
  });

  describe('embedRoute', () => {
    it('should create 4-dimensional embedding', () => {
      const embedding = featureExtractor.embedRoute({
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      });

      expect(embedding).toHaveLength(4);
      embedding.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });

    it('should produce consistent embeddings for same route', () => {
      const route = {
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      };

      const embedding1 = featureExtractor.embedRoute(route);
      const embedding2 = featureExtractor.embedRoute(route);

      expect(embedding1).toEqual(embedding2);
    });

    it('should produce different embeddings for different routes', () => {
      const embedding1 = featureExtractor.embedRoute({
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      });

      const embedding2 = featureExtractor.embedRoute({
        departureStationId: 'seoul',
        departureStationName: '서울',
        arrivalStationId: 'hongdae',
        arrivalStationName: '홍대입구',
        lineIds: ['1', '2'],
      });

      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('calculateDelayRate', () => {
    it('should calculate delay rate from logs', () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-1', wasDelayed: true },
        { ...mockCommuteLog, id: 'log-2', wasDelayed: false },
        { ...mockCommuteLog, id: 'log-3', wasDelayed: true },
        { ...mockCommuteLog, id: 'log-4', wasDelayed: false },
      ];

      expect(featureExtractor.calculateDelayRate(logs)).toBe(0.5);
    });

    it('should return 0 for empty logs', () => {
      expect(featureExtractor.calculateDelayRate([])).toBe(0);
    });

    it('should return 1 for all delayed logs', () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-1', wasDelayed: true },
        { ...mockCommuteLog, id: 'log-2', wasDelayed: true },
      ];

      expect(featureExtractor.calculateDelayRate(logs)).toBe(1);
    });
  });
});
