/**
 * Model Architecture Tests
 */

import {
  DEFAULT_MODEL_CONFIG,
  FEATURE_NAMES,
  OUTPUT_NAMES,
  getModelLayers,
  flattenFeatureVector,
  createSequence,
  parseModelOutput,
  sigmoid,
  relu,
  denseForward,
  lstmCellForward,
  validateConfig,
  getModelSummary,
} from '../modelArchitecture';

jest.mock('@/models/ml', () => ({
  MODEL_INPUT_FEATURES: 7,
  MODEL_OUTPUT_COUNT: 3,
}));

describe('modelArchitecture', () => {
  describe('Constants', () => {
    it('should have default model config', () => {
      expect(DEFAULT_MODEL_CONFIG.inputFeatures).toBe(7);
      expect(DEFAULT_MODEL_CONFIG.outputCount).toBe(3);
      expect(DEFAULT_MODEL_CONFIG.lstmUnits).toBe(32);
      expect(DEFAULT_MODEL_CONFIG.dropoutRate).toBe(0.2);
      expect(DEFAULT_MODEL_CONFIG.denseUnits).toBe(16);
      expect(DEFAULT_MODEL_CONFIG.sequenceLength).toBe(7);
    });

    it('should have feature names', () => {
      expect(FEATURE_NAMES.length).toBeGreaterThan(0);
      expect(FEATURE_NAMES).toContain('dayOfWeekSin');
    });

    it('should have output names', () => {
      expect(OUTPUT_NAMES).toHaveLength(3);
      expect(OUTPUT_NAMES).toContain('delayProbability');
    });
  });

  describe('getModelLayers', () => {
    it('should return layer configurations', () => {
      const layers = getModelLayers();
      expect(layers.length).toBeGreaterThan(0);
    });

    it('should start with input layer', () => {
      const layers = getModelLayers();
      expect(layers[0]!.type).toBe('input');
    });

    it('should end with dense output layer', () => {
      const layers = getModelLayers();
      const last = layers[layers.length - 1]!;
      expect(last.type).toBe('dense');
      expect(last.name).toBe('output');
      expect(last.activation).toBe('sigmoid');
    });

    it('should include LSTM layers', () => {
      const layers = getModelLayers();
      const lstmLayers = layers.filter(l => l.type === 'lstm');
      expect(lstmLayers.length).toBe(2);
    });

    it('should include dropout layers', () => {
      const layers = getModelLayers();
      const dropoutLayers = layers.filter(l => l.type === 'dropout');
      expect(dropoutLayers.length).toBe(2);
    });

    it('should accept custom config', () => {
      const customConfig = {
        ...DEFAULT_MODEL_CONFIG,
        lstmUnits: 64,
        denseUnits: 32,
      };
      const layers = getModelLayers(customConfig);
      const lstmLayer = layers.find(l => l.type === 'lstm');
      expect(lstmLayer?.units).toBe(64);
    });
  });

  describe('flattenFeatureVector', () => {
    it('should flatten vector to array', () => {
      const vector = {
        dayOfWeekCyclic: [0.5, 0.8] as [number, number],
        departureTimeNormalized: 0.3,
        arrivalTimeNormalized: 0.6,
        routeEmbedding: [0.1, 0.2, 0.3, 0.4],
        historicalDelayRate: 0.1,
        recentDelayIndicator: 0,
        weatherFeature: 2,
        holidayFlag: 0,
      };

      const flat = flattenFeatureVector(vector);
      expect(Array.isArray(flat)).toBe(true);
      expect(flat[0]).toBe(0.5);
      expect(flat[1]).toBe(0.8);
      expect(flat[2]).toBe(0.3);
    });
  });

  describe('createSequence', () => {
    const mockVector = {
      dayOfWeekCyclic: [0.5, 0.8] as [number, number],
      departureTimeNormalized: 0.3,
      arrivalTimeNormalized: 0.6,
      routeEmbedding: [0.1, 0.2, 0.3, 0.4],
      historicalDelayRate: 0.1,
      recentDelayIndicator: 0,
      weatherFeature: 0,
      holidayFlag: 0,
    };

    it('should create padded sequence', () => {
      const sequence = createSequence([mockVector], 3);
      expect(sequence).toHaveLength(3);
    });

    it('should handle empty vectors', () => {
      const sequence = createSequence([], 3);
      expect(sequence).toHaveLength(3);
    });

    it('should truncate to sequence length', () => {
      const vectors = Array(10).fill(mockVector);
      const sequence = createSequence(vectors, 5);
      expect(sequence).toHaveLength(5);
    });
  });

  describe('parseModelOutput', () => {
    it('should parse output values', () => {
      const result = parseModelOutput([0.3, 0.6, 0.1]);
      expect(result.departureTime).toBe(0.3);
      expect(result.arrivalTime).toBe(0.6);
      expect(result.delayProbability).toBe(0.1);
    });

    it('should clamp values to 0-1', () => {
      const result = parseModelOutput([-0.5, 1.5, 0.5]);
      expect(result.departureTime).toBe(0);
      expect(result.arrivalTime).toBe(1);
      expect(result.delayProbability).toBe(0.5);
    });

    it('should handle empty output', () => {
      const result = parseModelOutput([]);
      expect(result.departureTime).toBe(0);
      expect(result.arrivalTime).toBe(0);
      expect(result.delayProbability).toBe(0);
    });
  });

  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(sigmoid(0)).toBe(0.5);
    });

    it('should return ~1 for large positive input', () => {
      expect(sigmoid(10)).toBeCloseTo(1, 3);
    });

    it('should return ~0 for large negative input', () => {
      expect(sigmoid(-10)).toBeCloseTo(0, 3);
    });
  });

  describe('relu', () => {
    it('should return 0 for negative input', () => {
      expect(relu(-5)).toBe(0);
    });

    it('should return input for positive input', () => {
      expect(relu(5)).toBe(5);
    });

    it('should return 0 for zero input', () => {
      expect(relu(0)).toBe(0);
    });
  });

  describe('denseForward', () => {
    it('should compute linear forward pass', () => {
      const input = [1, 2];
      const weights = [[0.5, 0.3], [0.1, 0.4]];
      const biases = [0.1, 0.2];

      const output = denseForward(input, weights, biases, 'linear');
      expect(output[0]).toBeCloseTo(0.8);
      expect(output[1]).toBeCloseTo(1.3);
    });

    it('should apply sigmoid activation', () => {
      const output = denseForward([0], [[1]], [0], 'sigmoid');
      expect(output[0]).toBeCloseTo(0.5);
    });

    it('should apply relu activation', () => {
      const output = denseForward([1], [[-2]], [0], 'relu');
      expect(output[0]).toBe(0);
    });
  });

  describe('lstmCellForward', () => {
    it('should compute LSTM cell forward pass', () => {
      const input = [0.5];
      const hiddenState = [0];
      const cellState = [0];
      const weights = {
        inputGate: { weights: [[0.5], [0.5]], biases: [0] },
        forgetGate: { weights: [[0.5], [0.5]], biases: [0] },
        cellGate: { weights: [[0.5], [0.5]], biases: [0] },
        outputGate: { weights: [[0.5], [0.5]], biases: [0] },
      };

      const result = lstmCellForward(input, hiddenState, cellState, weights);
      expect(result.hiddenState).toHaveLength(1);
      expect(result.cellState).toHaveLength(1);
      expect(typeof result.hiddenState[0]).toBe('number');
      expect(typeof result.cellState[0]).toBe('number');
    });
  });

  describe('validateConfig', () => {
    it('should validate default config as valid', () => {
      const result = validateConfig(DEFAULT_MODEL_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative inputFeatures', () => {
      const result = validateConfig({ ...DEFAULT_MODEL_CONFIG, inputFeatures: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('inputFeatures must be positive');
    });

    it('should reject zero outputCount', () => {
      const result = validateConfig({ ...DEFAULT_MODEL_CONFIG, outputCount: 0 });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid dropoutRate', () => {
      const result = validateConfig({ ...DEFAULT_MODEL_CONFIG, dropoutRate: 1.5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('dropoutRate must be between 0 and 1');
    });

    it('should reject negative sequenceLength', () => {
      const result = validateConfig({ ...DEFAULT_MODEL_CONFIG, sequenceLength: -1 });
      expect(result.valid).toBe(false);
    });

    it('should report multiple errors', () => {
      const result = validateConfig({
        inputFeatures: -1,
        outputCount: 0,
        lstmUnits: -1,
        dropoutRate: 2,
        denseUnits: 0,
        sequenceLength: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('getModelSummary', () => {
    it('should return summary string', () => {
      const summary = getModelSummary();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('Model Summary');
      expect(summary).toContain('Input Shape');
      expect(summary).toContain('Output Shape');
    });

    it('should include layer info', () => {
      const summary = getModelSummary();
      expect(summary).toContain('lstm');
      expect(summary).toContain('dense');
      expect(summary).toContain('dropout');
    });
  });
});
