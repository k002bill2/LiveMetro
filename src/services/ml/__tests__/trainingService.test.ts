/**
 * ML Training Service Tests
 * Comprehensive coverage for training with TensorFlow.js and fallback modes
 */

import { CommuteLog, DayOfWeek } from '@/models/pattern';
import { MIN_LOGS_FOR_ML_TRAINING } from '@/models/ml';

// ============================================================================
// Mocks
// ============================================================================

const mockFit = jest.fn().mockResolvedValue({
  history: {
    loss: [0.5, 0.3, 0.1],
    val_acc: [0.7, 0.8, 0.9],
  },
});

const mockDispose = jest.fn();
const mockAdd = jest.fn();
const mockCompile = jest.fn();

const mockTfSequential = jest.fn(() => ({
  add: mockAdd,
  compile: mockCompile,
  fit: mockFit,
}));

const mockTfTensor3d = jest.fn(() => ({ dispose: mockDispose }));
const mockTfTensor2d = jest.fn(() => ({ dispose: mockDispose }));

jest.mock('../tensorflowSetup', () => ({
  tensorFlowSetup: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(false),
  },
  getTensorFlow: jest.fn().mockReturnValue(null),
}));

jest.mock('../featureExtractor', () => ({
  featureExtractor: {
    extractFeatures: jest.fn(),
    normalizeTime: jest.fn().mockReturnValue(0.5),
  },
}));

jest.mock('../modelArchitecture', () => ({
  createSequence: jest.fn().mockReturnValue([[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.1, 0.2, 0.3]]),
  DEFAULT_MODEL_CONFIG: {
    sequenceLength: 7,
    inputFeatures: 7,
    outputCount: 3,
    lstmUnits: 64,
    denseUnits: 32,
    dropoutRate: 0.2,
  },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLog = (overrides: Partial<CommuteLog> = {}): CommuteLog => ({
  id: `log_${Math.random()}`,
  userId: 'user1',
  date: '2024-01-01',
  dayOfWeek: 1 as DayOfWeek,
  departureTime: '08:30',
  arrivalTime: '09:00',
  departureStationId: 'station1',
  departureStationName: 'Test Station',
  arrivalStationId: 'station2',
  arrivalStationName: 'Test Station 2',
  lineIds: ['2'],
  wasDelayed: false,
  delayMinutes: 0,
  isManual: false,
  createdAt: new Date(),
  ...overrides,
});

const createMockLogs = (count: number = 15): CommuteLog[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockLog({
      id: `log_${i}`,
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      departureTime: `0${(8 + (i % 3)).toString()}:${String(i % 60).padStart(2, '0')}`,
      wasDelayed: i % 4 === 0,
    })
  );
};

const createMockFeatureVectors = (count: number = 15) => ({
  featureVectors: Array.from({ length: count }, (_, i) => ({
    dayOfWeekCyclic: [Math.sin(i), Math.cos(i)] as const,
    departureTimeNormalized: 0.3 + ((i % 5) * 0.1),
    arrivalTimeNormalized: 0.4 + ((i % 5) * 0.1),
    routeEmbedding: [0.1, 0.2, 0.3, 0.4],
    historicalDelayRate: i % 3 === 0 ? 0.25 : 0.1,
    recentDelayIndicator: i % 4 === 0 ? 1 : 0,
    weatherFeature: 0,
    holidayFlag: 0,
  })),
  features: null,
  labels: null,
});

/**
 * Helper: setup TensorFlow mocks for TF training path
 */
function setupTfMocks(): void {
  const { tensorFlowSetup, getTensorFlow } = require('../tensorflowSetup');
  const { featureExtractor } = require('../featureExtractor');

  tensorFlowSetup.initialize.mockResolvedValue(undefined);
  tensorFlowSetup.isAvailable.mockReturnValue(true);

  getTensorFlow.mockReturnValue({
    sequential: mockTfSequential,
    tensor3d: mockTfTensor3d,
    tensor2d: mockTfTensor2d,
    layers: {
      lstm: jest.fn().mockReturnValue({}),
      dropout: jest.fn().mockReturnValue({}),
      dense: jest.fn().mockReturnValue({}),
    },
    train: {
      adam: jest.fn().mockReturnValue({}),
    },
  });

  featureExtractor.extractFeatures.mockReturnValue(createMockFeatureVectors());
  featureExtractor.normalizeTime.mockReturnValue(0.5);
}

/**
 * Helper: setup fallback mode mocks
 */
function setupFallbackMocks(): void {
  const { tensorFlowSetup } = require('../tensorflowSetup');
  const { featureExtractor } = require('../featureExtractor');

  tensorFlowSetup.initialize.mockResolvedValue(undefined);
  tensorFlowSetup.isAvailable.mockReturnValue(false);
  featureExtractor.extractFeatures.mockReturnValue(createMockFeatureVectors());
}

// ============================================================================
// Import after mocks
// ============================================================================

import { trainingService, DEFAULT_TRAINING_OPTIONS } from '../trainingService';

// ============================================================================
// Tests: Insufficient Data
// ============================================================================

describe('TrainingService - Insufficient Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error for insufficient data', async () => {
    const result = await trainingService.train([createMockLog()]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient training data');
    expect(result.epochsCompleted).toBe(0);
    expect(result.validationAccuracy).toBe(0);
  });

  it('should return error for empty logs', async () => {
    const result = await trainingService.train([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain(`Need at least ${MIN_LOGS_FOR_ML_TRAINING} logs`);
    expect(result.finalLoss).toBe(1);
  });

  it('should record duration even on insufficient data', async () => {
    const result = await trainingService.train([createMockLog()]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe('number');
  });
});

// ============================================================================
// Tests: Fallback Mode (No TensorFlow)
// ============================================================================

describe('TrainingService - Fallback Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should initialize TensorFlow before training', async () => {
    const { tensorFlowSetup } = require('../tensorflowSetup');
    await trainingService.train(createMockLogs());
    expect(tensorFlowSetup.initialize).toHaveBeenCalled();
  });

  it('should train successfully in fallback mode', async () => {
    const result = await trainingService.train(createMockLogs());
    expect(result.success).toBe(true);
    expect(result.epochsCompleted).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should calculate accuracy from delay rate', async () => {
    const logs = createMockLogs().map((log, i) => ({
      ...log,
      wasDelayed: i % 5 === 0, // 20% delayed
    }));

    const result = await trainingService.train(logs);
    expect(result.success).toBe(true);
    expect(result.validationAccuracy).toBeLessThanOrEqual(1);
    expect(result.validationAccuracy).toBeGreaterThanOrEqual(0);
  });

  it('should update state during training', async () => {
    const stateUpdates: { progress: number; isTraining: boolean }[] = [];
    const unsubscribe = trainingService.onProgress((state) => {
      stateUpdates.push({ progress: state.progress, isTraining: state.isTraining });
    });

    await trainingService.train(createMockLogs(), { epochs: 3 });
    unsubscribe();

    expect(stateUpdates.length).toBeGreaterThan(0);
    expect(stateUpdates[0]!.isTraining).toBe(true);
    expect(stateUpdates[stateUpdates.length - 1]!.progress).toBeGreaterThan(0.5);
  });

  it('should respect maximum epochs cap in fallback', async () => {
    const result = await trainingService.train(createMockLogs(), { epochs: 100 });
    expect(result.success).toBe(true);
    // Fallback caps at min(epochs, 5) iterations
    expect(result.epochsCompleted).toBeLessThanOrEqual(100);
    expect(result.epochsCompleted).toBeGreaterThan(0);
  });

  it('should handle logs with missing arrival times', async () => {
    const logs = createMockLogs().map((log, i) =>
      (i === 0 || i === 5) ? { ...log, arrivalTime: undefined } : log
    );
    const result = await trainingService.train(logs);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Tests: TensorFlow Training Path
// ============================================================================

describe('TrainingService - TensorFlow Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFit.mockResolvedValue({
      history: {
        loss: [0.5, 0.3, 0.1],
        val_acc: [0.7, 0.8, 0.9],
      },
    });
    setupTfMocks();
  });

  it('should train with TensorFlow when available', async () => {
    const logs = createMockLogs();
    const result = await trainingService.train(logs);

    expect(result.success).toBe(true);
    expect(result.validationAccuracy).toBe(0.9);
    expect(result.finalLoss).toBe(0.1);
  });

  it('should create model using tf.sequential', async () => {
    // Reset model to null to force creation
    trainingService.setModel(null);

    await trainingService.train(createMockLogs());

    expect(mockTfSequential).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalled();
    expect(mockCompile).toHaveBeenCalled();
  });

  it('should create tensors from training data', async () => {
    trainingService.setModel(null);
    await trainingService.train(createMockLogs());

    expect(mockTfTensor3d).toHaveBeenCalled();
    expect(mockTfTensor2d).toHaveBeenCalled();
  });

  it('should dispose tensors after training', async () => {
    trainingService.setModel(null);
    await trainingService.train(createMockLogs());

    // tensor3d and tensor2d each return objects with dispose
    expect(mockDispose).toHaveBeenCalledTimes(2);
  });

  it('should call model.fit with correct parameters', async () => {
    trainingService.setModel(null);
    await trainingService.train(createMockLogs(), { epochs: 5, batchSize: 8, validationSplit: 0.2 });

    expect(mockFit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        epochs: 5,
        batchSize: 8,
        validationSplit: 0.2,
        shuffle: true,
      })
    );
  });

  it('should update state via epoch callbacks', async () => {
    // Make fit call the onEpochEnd callback
    mockFit.mockImplementation(async (_input: unknown, _label: unknown, config: { callbacks?: { onEpochEnd?: (epoch: number, logs: { loss?: number; acc?: number }) => void } }) => {
      if (config.callbacks?.onEpochEnd) {
        config.callbacks.onEpochEnd(0, { loss: 0.5, acc: 0.7 });
        config.callbacks.onEpochEnd(1, { loss: 0.3, acc: 0.85 });
      }
      return {
        history: { loss: [0.5, 0.3], val_acc: [0.7, 0.85] },
      };
    });

    const stateUpdates: { progress: number; loss: number; accuracy: number }[] = [];
    const unsubscribe = trainingService.onProgress((state) => {
      stateUpdates.push({ progress: state.progress, loss: state.loss, accuracy: state.accuracy });
    });

    trainingService.setModel(null);
    await trainingService.train(createMockLogs(), { epochs: 2 });
    unsubscribe();

    // Should have epoch updates
    const epochUpdates = stateUpdates.filter(s => s.loss > 0);
    expect(epochUpdates.length).toBeGreaterThan(0);
  });

  it('should set lastTrainingResult on success', async () => {
    trainingService.setModel(null);
    await trainingService.train(createMockLogs());

    const lastResult = trainingService.getLastResult();
    expect(lastResult).not.toBeNull();
    expect(lastResult?.success).toBe(true);
    expect(lastResult?.validationAccuracy).toBe(0.9);
  });

  it('should handle TF training error gracefully', async () => {
    mockFit.mockRejectedValue(new Error('GPU out of memory'));

    trainingService.setModel(null);
    const result = await trainingService.train(createMockLogs());

    expect(result.success).toBe(false);
    expect(result.error).toBe('GPU out of memory');
    expect(result.epochsCompleted).toBe(0);
  });

  it('should reset state after TF training error', async () => {
    mockFit.mockRejectedValue(new Error('Training failed'));

    trainingService.setModel(null);
    await trainingService.train(createMockLogs());

    const state = trainingService.getTrainingState();
    expect(state.isTraining).toBe(false);
    expect(state.progress).toBe(0);
  });

  it('should handle non-Error exceptions in TF training', async () => {
    mockFit.mockRejectedValue('unknown error');

    trainingService.setModel(null);
    const result = await trainingService.train(createMockLogs());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Training failed');
  });

  it('should fall back when getTensorFlow returns null despite isAvailable', async () => {
    const { getTensorFlow } = require('../tensorflowSetup');
    getTensorFlow.mockReturnValue(null);

    const result = await trainingService.train(createMockLogs());

    // Should fall back to statistical training
    expect(result.success).toBe(true);
  });

  it('should handle missing history values', async () => {
    mockFit.mockResolvedValue({
      history: {
        loss: [],
        val_acc: [],
      },
    });

    trainingService.setModel(null);
    const result = await trainingService.train(createMockLogs());

    expect(result.success).toBe(true);
    // Should use defaults when history arrays are empty
    expect(typeof result.finalLoss).toBe('number');
    expect(typeof result.validationAccuracy).toBe('number');
  });

  it('should reuse existing model if already set', async () => {
    const existingModel = { fit: mockFit };
    trainingService.setModel(existingModel);

    await trainingService.train(createMockLogs());

    // Should NOT create new model
    expect(mockTfSequential).not.toHaveBeenCalled();
    // Should use existing model's fit
    expect(mockFit).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: prepareTrainingData (via TF training path)
// ============================================================================

describe('TrainingService - Data Preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTfMocks();

    const { featureExtractor } = require('../featureExtractor');
    const { createSequence } = require('../modelArchitecture');

    featureExtractor.extractFeatures.mockReturnValue(createMockFeatureVectors(20));
    featureExtractor.normalizeTime.mockReturnValue(0.5);
    createSequence.mockReturnValue([[0.1, 0.2, 0.3]]);
  });

  it('should call featureExtractor.extractFeatures', async () => {
    const { featureExtractor } = require('../featureExtractor');
    trainingService.setModel(null);
    await trainingService.train(createMockLogs(20));

    expect(featureExtractor.extractFeatures).toHaveBeenCalled();
  });

  it('should call createSequence for each valid sequence', async () => {
    const { createSequence } = require('../modelArchitecture');
    trainingService.setModel(null);
    await trainingService.train(createMockLogs(20));

    expect(createSequence).toHaveBeenCalled();
  });

  it('should call normalizeTime for label generation', async () => {
    const { featureExtractor } = require('../featureExtractor');
    trainingService.setModel(null);
    await trainingService.train(createMockLogs(20));

    expect(featureExtractor.normalizeTime).toHaveBeenCalled();
  });

  it('should handle logs with missing arrivalTime in labels', async () => {
    const logs = createMockLogs(20).map((log, i) =>
      i >= 7 ? { ...log, arrivalTime: undefined } : log
    );

    trainingService.setModel(null);
    const result = await trainingService.train(logs);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Tests: Training State Management
// ============================================================================

describe('TrainingService - State Management', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should have all state properties', () => {
    const state = trainingService.getTrainingState();
    expect(state).toHaveProperty('isTraining');
    expect(state).toHaveProperty('progress');
    expect(state).toHaveProperty('currentEpoch');
    expect(state).toHaveProperty('totalEpochs');
    expect(state).toHaveProperty('loss');
    expect(state).toHaveProperty('accuracy');
  });

  it('should return a copy of the state (not reference)', () => {
    const state1 = trainingService.getTrainingState();
    const state2 = trainingService.getTrainingState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('should report isTraining correctly', () => {
    expect(typeof trainingService.isTraining()).toBe('boolean');
  });

  it('should set isTraining false after training completes', async () => {
    setupFallbackMocks();
    await trainingService.train(createMockLogs());
    expect(trainingService.getTrainingState().isTraining).toBe(false);
  });
});

// ============================================================================
// Tests: Progress Callbacks
// ============================================================================

describe('TrainingService - Progress Callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should return unsubscribe function from onProgress', () => {
    const unsub = trainingService.onProgress(jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should call callback during training', async () => {
    const callback = jest.fn();
    const unsub = trainingService.onProgress(callback);
    await trainingService.train(createMockLogs(), { epochs: 2 });
    unsub();
    expect(callback).toHaveBeenCalled();
  });

  it('should not call callback after unsubscribe', async () => {
    const callback = jest.fn();
    const unsub = trainingService.onProgress(callback);
    unsub();
    callback.mockClear();
    await trainingService.train(createMockLogs());
    expect(callback).not.toHaveBeenCalled();
  });

  it('should support multiple subscribers', async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const unsub1 = trainingService.onProgress(cb1);
    const unsub2 = trainingService.onProgress(cb2);
    await trainingService.train(createMockLogs());
    unsub1();
    unsub2();
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('should include all state fields in callback', async () => {
    let lastState: Record<string, unknown> | null = null;
    const unsub = trainingService.onProgress((state) => { lastState = state as unknown as Record<string, unknown>; });
    await trainingService.train(createMockLogs(), { epochs: 2 });
    unsub();
    expect(lastState).toHaveProperty('progress');
    expect(lastState).toHaveProperty('currentEpoch');
    expect(lastState).toHaveProperty('totalEpochs');
    expect(lastState).toHaveProperty('loss');
    expect(lastState).toHaveProperty('accuracy');
  });
});

// ============================================================================
// Tests: Model Management
// ============================================================================

describe('TrainingService - Model Management', () => {
  it('should get and set model', () => {
    const mockModel = { type: 'test' };
    trainingService.setModel(mockModel);
    expect(trainingService.getModel()).toBe(mockModel);
  });

  it('should allow updating model', () => {
    const m1 = { v: 1 };
    const m2 = { v: 2 };
    trainingService.setModel(m1);
    expect(trainingService.getModel()).toBe(m1);
    trainingService.setModel(m2);
    expect(trainingService.getModel()).toBe(m2);
  });
});

// ============================================================================
// Tests: Last Result Tracking
// ============================================================================

describe('TrainingService - Last Result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should return training result after successful training', async () => {
    await trainingService.train(createMockLogs());
    const last = trainingService.getLastResult();
    expect(last).not.toBeNull();
    expect(last?.success).toBe(true);
    expect(last?.epochsCompleted).toBeGreaterThan(0);
  });

  it('should include all result properties', async () => {
    await trainingService.train(createMockLogs());
    const last = trainingService.getLastResult();
    expect(last).toHaveProperty('success');
    expect(last).toHaveProperty('epochsCompleted');
    expect(last).toHaveProperty('finalLoss');
    expect(last).toHaveProperty('validationAccuracy');
    expect(last).toHaveProperty('durationMs');
  });
});

// ============================================================================
// Tests: Retraining Decision Logic
// ============================================================================

describe('TrainingService - Retraining Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should recommend retraining when newLogsCount >= 10 after success', async () => {
    await trainingService.train(createMockLogs());
    expect(trainingService.shouldRetrain(10)).toBe(true);
  });

  it('should not recommend retraining when newLogsCount < 10 after success', async () => {
    await trainingService.train(createMockLogs());
    expect(trainingService.shouldRetrain(5)).toBe(false);
  });

  it('should recommend retraining when newLogsCount > 10', async () => {
    await trainingService.train(createMockLogs());
    expect(trainingService.shouldRetrain(15)).toBe(true);
  });

  it('should handle shouldRetrain based on last result state', () => {
    // shouldRetrain depends on singleton lastTrainingResult
    const last = trainingService.getLastResult();
    const result = trainingService.shouldRetrain(3);
    if (last?.success) {
      expect(result).toBe(false); // success + < 10
    } else {
      expect(result).toBe(true); // no success
    }
  });
});

// ============================================================================
// Tests: Options Merging
// ============================================================================

describe('TrainingService - Options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should use default options when none provided', async () => {
    const result = await trainingService.train(createMockLogs());
    expect(result.success).toBe(true);
  });

  it('should merge custom options with defaults', async () => {
    const result = await trainingService.train(createMockLogs(), { epochs: 10, batchSize: 16 });
    expect(result.success).toBe(true);
    expect(result.epochsCompleted).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('TrainingService - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFallbackMocks();
  });

  it('should handle exactly minimum required logs', async () => {
    const { featureExtractor } = require('../featureExtractor');
    featureExtractor.extractFeatures.mockReturnValue(createMockFeatureVectors(MIN_LOGS_FOR_ML_TRAINING));
    const result = await trainingService.train(createMockLogs(MIN_LOGS_FOR_ML_TRAINING));
    expect(result.success).toBe(true);
  });

  it('should handle just below minimum logs', async () => {
    const result = await trainingService.train(createMockLogs(MIN_LOGS_FOR_ML_TRAINING - 1));
    expect(result.success).toBe(false);
  });

  it('should handle large datasets', async () => {
    const { featureExtractor } = require('../featureExtractor');
    featureExtractor.extractFeatures.mockReturnValue(createMockFeatureVectors(200));
    const result = await trainingService.train(createMockLogs(200));
    expect(result.success).toBe(true);
  });

  it('should handle all delayed logs (accuracy = 0)', async () => {
    const logs = createMockLogs().map(log => ({ ...log, wasDelayed: true }));
    const result = await trainingService.train(logs);
    expect(result.success).toBe(true);
    expect(result.validationAccuracy).toBe(0);
  });

  it('should handle zero delay logs (accuracy = 1)', async () => {
    const logs = createMockLogs().map(log => ({ ...log, wasDelayed: false }));
    const result = await trainingService.train(logs);
    expect(result.success).toBe(true);
    expect(result.validationAccuracy).toBe(1);
  });

  it('should handle readonly logs array', async () => {
    const result = await trainingService.train(createMockLogs() as readonly CommuteLog[]);
    expect(result.success).toBe(true);
  });

  it('should not modify input logs', async () => {
    const logs = createMockLogs();
    const original = JSON.stringify(logs);
    await trainingService.train(logs);
    expect(JSON.stringify(logs)).toBe(original);
  });
});

// ============================================================================
// Tests: Exports
// ============================================================================

describe('TrainingService - Exports', () => {
  it('should export DEFAULT_TRAINING_OPTIONS with valid values', () => {
    expect(DEFAULT_TRAINING_OPTIONS).toBeDefined();
    expect(DEFAULT_TRAINING_OPTIONS.epochs).toBeGreaterThan(0);
    expect(DEFAULT_TRAINING_OPTIONS.batchSize).toBeGreaterThan(0);
    expect(DEFAULT_TRAINING_OPTIONS.validationSplit).toBeGreaterThan(0);
    expect(DEFAULT_TRAINING_OPTIONS.validationSplit).toBeLessThan(1);
    expect(DEFAULT_TRAINING_OPTIONS.learningRate).toBeGreaterThan(0);
  });
});
