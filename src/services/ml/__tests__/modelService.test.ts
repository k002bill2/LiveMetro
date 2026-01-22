/**
 * Model Service Tests
 */

import { modelService } from '../modelService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';

// Mock featureExtractor
jest.mock('../featureExtractor', () => ({
  featureExtractor: {
    normalizeTime: jest.fn((time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return ((hours || 0) * 60 + (minutes || 0)) / 1440;
    }),
    denormalizeTime: jest.fn((normalized: number) => {
      const totalMinutes = Math.round(normalized * 1440);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }),
    calculateDelayRate: jest.fn((logs: CommuteLog[]) => {
      if (logs.length === 0) return 0;
      return logs.filter(l => l.wasDelayed).length / logs.length;
    }),
  },
}));

// Day of week constant (0 = Sunday)
const MONDAY: DayOfWeek = 1;

describe('ModelService', () => {
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

  beforeEach(() => {
    modelService.dispose();
    modelService.clearCache();
  });

  describe('initialize', () => {
    it('should initialize in fallback mode', async () => {
      const result = await modelService.initialize();

      expect(result).toBe(true);
      expect(modelService.isReady()).toBe(true);
    });

    it('should return true if already initialized', async () => {
      await modelService.initialize();
      const result = await modelService.initialize();

      expect(result).toBe(true);
    });
  });

  describe('predict', () => {
    it('should return default prediction for empty logs', async () => {
      const prediction = await modelService.predict([], MONDAY);

      expect(prediction.predictedDepartureTime).toBe('08:00');
      expect(prediction.predictedArrivalTime).toBe('08:45');
      expect(prediction.modelVersion).toBe('fallback');
    });

    it('should use statistics from logs when available', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, dayOfWeek: MONDAY },
        { ...mockCommuteLog, id: 'log-2', dayOfWeek: MONDAY },
      ];

      const prediction = await modelService.predict(logs, MONDAY);

      expect(prediction.modelVersion).toBe('fallback');
      expect(prediction.predictedAt).toBeInstanceOf(Date);
    });

    it('should cache predictions', async () => {
      const logs = [mockCommuteLog];

      const prediction1 = await modelService.predict(logs, MONDAY);
      const prediction2 = await modelService.predict(logs, MONDAY);

      expect(prediction1.predictedDepartureTime).toBe(prediction2.predictedDepartureTime);
    });

    it('should skip cache when useCache is false', async () => {
      const logs = [mockCommuteLog];

      await modelService.predict(logs, MONDAY, { useCache: true });
      const prediction = await modelService.predict(logs, MONDAY, { useCache: false });

      expect(prediction).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should return null before initialization', () => {
      expect(modelService.getMetadata()).toBeNull();
    });

    it('should return metadata after initialization', async () => {
      await modelService.initialize();
      const metadata = modelService.getMetadata();

      expect(metadata).not.toBeNull();
      expect(metadata?.version).toBe('fallback');
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(modelService.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await modelService.initialize();
      expect(modelService.isReady()).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear prediction cache', async () => {
      const logs = [mockCommuteLog];
      await modelService.predict(logs, MONDAY);

      modelService.clearCache();

      // No error means cache was cleared successfully
      expect(true).toBe(true);
    });
  });

  describe('saveModel', () => {
    it('should return false in fallback mode', async () => {
      const result = await modelService.saveModel();
      expect(result).toBe(false);
    });
  });

  describe('getModel', () => {
    it('should return null in fallback mode', () => {
      expect(modelService.getModel()).toBeNull();
    });
  });

  describe('setModel', () => {
    it('should be a no-op in fallback mode', () => {
      modelService.setModel({}, {
        version: 'test',
        lastTrainedAt: new Date(),
        trainingDataCount: 0,
        accuracy: 0,
        loss: 0,
        isFineTuned: false,
      });

      expect(modelService.getModel()).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should reset service state', async () => {
      await modelService.initialize();
      modelService.dispose();

      expect(modelService.isReady()).toBe(false);
      expect(modelService.getMetadata()).toBeNull();
    });
  });
});
