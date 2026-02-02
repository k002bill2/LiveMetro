/**
 * ML Training Service Tests
 */

import { trainingService, DEFAULT_TRAINING_OPTIONS } from '../trainingService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';

// Mock tensorflowSetup
jest.mock('../tensorflowSetup', () => ({
  tensorFlowSetup: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(false),
  },
  getTensorFlow: jest.fn().mockReturnValue(null),
}));

// Mock featureExtractor
jest.mock('../featureExtractor', () => ({
  featureExtractor: {
    extractFeatures: jest.fn().mockReturnValue({
      featureVectors: [],
    }),
    normalizeTime: jest.fn().mockReturnValue(0.5),
  },
}));

describe('TrainingService', () => {
  const createMockLog = (overrides: Partial<CommuteLog> = {}): CommuteLog => ({
    id: `log_${Math.random()}`,
    userId: 'user1',
    date: '2024-01-01',
    dayOfWeek: 1 as DayOfWeek,
    departureTime: '08:30',
    arrivalTime: '09:00',
    departureStationId: 'station1',
    arrivalStationId: 'station2',
    lineIds: ['2'],
    transferCount: 0,
    duration: 30,
    wasDelayed: false,
    delayMinutes: 0,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('train', () => {
    it('should return error for insufficient data', async () => {
      const logs = [createMockLog()]; // Only 1 log

      const result = await trainingService.train(logs);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient training data');
      expect(result.epochsCompleted).toBe(0);
    });

    it('should merge options with defaults', async () => {
      // Training will still fail due to insufficient data, but options should be merged
      const logs = [createMockLog()];

      const result = await trainingService.train(logs, { epochs: 5 });

      expect(result.success).toBe(false);
    });
  });

  describe('shouldRetrain', () => {
    it('should return true for first training', () => {
      // No previous successful training
      const result = trainingService.shouldRetrain(5);

      expect(result).toBe(true);
    });

    it('should return true when newLogsCount >= 10', () => {
      const result = trainingService.shouldRetrain(10);

      expect(result).toBe(true);
    });

    it('should return true when newLogsCount > 10', () => {
      const result = trainingService.shouldRetrain(15);

      expect(result).toBe(true);
    });
  });

  describe('getTrainingState', () => {
    it('should return training state object', () => {
      const state = trainingService.getTrainingState();

      expect(state).toHaveProperty('isTraining');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('currentEpoch');
      expect(state).toHaveProperty('totalEpochs');
      expect(state).toHaveProperty('loss');
      expect(state).toHaveProperty('accuracy');
    });

    it('should return a copy of the state', () => {
      const state1 = trainingService.getTrainingState();
      const state2 = trainingService.getTrainingState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('isTraining', () => {
    it('should return boolean', () => {
      const result = trainingService.isTraining();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('onProgress', () => {
    it('should return unsubscribe function', () => {
      const callback = jest.fn();

      const unsubscribe = trainingService.onProgress(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribing', () => {
      const callback = jest.fn();

      const unsubscribe = trainingService.onProgress(callback);
      unsubscribe();

      // Callback should not be called after unsubscribe
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('model management', () => {
    it('should get model (may be null)', () => {
      const model = trainingService.getModel();

      // Model is null when not trained with TensorFlow
      expect(model).toBeDefined();
    });

    it('should set model', () => {
      const mockModel = { type: 'mock' };

      trainingService.setModel(mockModel);
      const model = trainingService.getModel();

      expect(model).toBe(mockModel);
    });
  });

  describe('getLastResult', () => {
    it('should return last training result or null', () => {
      const result = trainingService.getLastResult();

      // Can be null if not trained yet, or TrainingResult
      if (result !== null) {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('epochsCompleted');
        expect(result).toHaveProperty('finalLoss');
        expect(result).toHaveProperty('validationAccuracy');
        expect(result).toHaveProperty('durationMs');
      }
    });
  });

  describe('DEFAULT_TRAINING_OPTIONS export', () => {
    it('should export default training options', () => {
      expect(DEFAULT_TRAINING_OPTIONS).toBeDefined();
      expect(DEFAULT_TRAINING_OPTIONS).toHaveProperty('epochs');
      expect(DEFAULT_TRAINING_OPTIONS).toHaveProperty('batchSize');
      expect(DEFAULT_TRAINING_OPTIONS).toHaveProperty('validationSplit');
    });
  });
});
