/**
 * LSTM Model Architecture
 * Defines neural network architecture for commute prediction
 */

import {
  MLFeatureVector,
  MODEL_INPUT_FEATURES,
  MODEL_OUTPUT_COUNT,
} from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

/**
 * Model configuration
 */
export interface ModelConfig {
  readonly inputFeatures: number;
  readonly outputCount: number;
  readonly lstmUnits: number;
  readonly dropoutRate: number;
  readonly denseUnits: number;
  readonly sequenceLength: number;
}

/**
 * Layer configuration for building model
 */
export interface LayerConfig {
  readonly name: string;
  readonly type: 'lstm' | 'dense' | 'dropout' | 'input';
  readonly units?: number;
  readonly rate?: number;
  readonly activation?: string;
  readonly returnSequences?: boolean;
  readonly inputShape?: readonly number[];
}

/**
 * Model weights for serialization
 */
export interface SerializedWeights {
  readonly version: string;
  readonly layers: readonly {
    name: string;
    weights: readonly number[][];
    biases: readonly number[];
  }[];
  readonly metadata: {
    createdAt: string;
    trainingDataCount: number;
    accuracy: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default model configuration */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  inputFeatures: MODEL_INPUT_FEATURES,
  outputCount: MODEL_OUTPUT_COUNT,
  lstmUnits: 32,
  dropoutRate: 0.2,
  denseUnits: 16,
  sequenceLength: 7, // 1 week of data
};

/** Feature names for debugging */
export const FEATURE_NAMES: readonly string[] = [
  'dayOfWeekSin',
  'dayOfWeekCos',
  'departureTimeNorm',
  'arrivalTimeNorm',
  'routeEmbed0',
  'routeEmbed1',
  'routeEmbed2',
  'routeEmbed3',
  'historicalDelayRate',
  'recentDelayIndicator',
  'weatherFeature',
  'holidayFlag',
];

/** Output names */
export const OUTPUT_NAMES: readonly string[] = [
  'predictedDepartureTime',
  'predictedArrivalTime',
  'delayProbability',
];

// ============================================================================
// Architecture Definition
// ============================================================================

/**
 * Get layer configuration for the model
 */
export function getModelLayers(config: ModelConfig = DEFAULT_MODEL_CONFIG): readonly LayerConfig[] {
  return [
    {
      name: 'input',
      type: 'input',
      inputShape: [config.sequenceLength, config.inputFeatures],
    },
    {
      name: 'lstm_1',
      type: 'lstm',
      units: config.lstmUnits,
      returnSequences: true,
    },
    {
      name: 'dropout_1',
      type: 'dropout',
      rate: config.dropoutRate,
    },
    {
      name: 'lstm_2',
      type: 'lstm',
      units: config.lstmUnits,
      returnSequences: false,
    },
    {
      name: 'dropout_2',
      type: 'dropout',
      rate: config.dropoutRate,
    },
    {
      name: 'dense_1',
      type: 'dense',
      units: config.denseUnits,
      activation: 'relu',
    },
    {
      name: 'output',
      type: 'dense',
      units: config.outputCount,
      activation: 'sigmoid', // Output range 0-1
    },
  ];
}

// ============================================================================
// Feature Vector Utilities
// ============================================================================

/**
 * Convert MLFeatureVector to flat array
 */
export function flattenFeatureVector(vector: MLFeatureVector): number[] {
  return [
    vector.dayOfWeekCyclic[0],
    vector.dayOfWeekCyclic[1],
    vector.departureTimeNormalized,
    vector.arrivalTimeNormalized,
    ...vector.routeEmbedding,
    vector.historicalDelayRate,
    vector.recentDelayIndicator,
    vector.weatherFeature / 4, // Normalize to 0-1
    vector.holidayFlag,
  ];
}

/**
 * Create sequence from feature vectors
 */
export function createSequence(
  vectors: readonly MLFeatureVector[],
  sequenceLength: number = DEFAULT_MODEL_CONFIG.sequenceLength
): number[][] {
  const flattened = vectors.map(flattenFeatureVector);

  // Pad if necessary
  while (flattened.length < sequenceLength) {
    // Pad with zeros
    flattened.unshift(new Array(MODEL_INPUT_FEATURES + 5).fill(0));
  }

  // Take last sequenceLength entries
  return flattened.slice(-sequenceLength);
}

/**
 * Parse model output to prediction values
 */
export function parseModelOutput(output: readonly number[]): {
  departureTime: number;
  arrivalTime: number;
  delayProbability: number;
} {
  const [departure = 0, arrival = 0, delay = 0] = output;

  return {
    departureTime: Math.max(0, Math.min(1, departure)),
    arrivalTime: Math.max(0, Math.min(1, arrival)),
    delayProbability: Math.max(0, Math.min(1, delay)),
  };
}

// ============================================================================
// Simple Neural Network Implementation (No TensorFlow fallback)
// ============================================================================

/**
 * Simple sigmoid activation
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Simple ReLU activation
 */
export function relu(x: number): number {
  return Math.max(0, x);
}

/**
 * Simple dense layer forward pass
 */
export function denseForward(
  input: readonly number[],
  weights: readonly number[][],
  biases: readonly number[],
  activation: 'sigmoid' | 'relu' | 'linear' = 'linear'
): number[] {
  const output: number[] = [];

  for (let i = 0; i < biases.length; i++) {
    let sum = biases[i] ?? 0;
    for (let j = 0; j < input.length; j++) {
      const w = weights[j]?.[i] ?? 0;
      sum += (input[j] ?? 0) * w;
    }

    // Apply activation
    if (activation === 'sigmoid') {
      output.push(sigmoid(sum));
    } else if (activation === 'relu') {
      output.push(relu(sum));
    } else {
      output.push(sum);
    }
  }

  return output;
}

/**
 * Simple LSTM cell (simplified version)
 * Uses tanh and sigmoid activations
 */
export function lstmCellForward(
  input: readonly number[],
  hiddenState: readonly number[],
  cellState: readonly number[],
  weights: {
    inputGate: { weights: readonly number[][]; biases: readonly number[] };
    forgetGate: { weights: readonly number[][]; biases: readonly number[] };
    cellGate: { weights: readonly number[][]; biases: readonly number[] };
    outputGate: { weights: readonly number[][]; biases: readonly number[] };
  }
): { hiddenState: number[]; cellState: number[] } {
  const inputSize = input.length;
  const hiddenSize = hiddenState.length;
  const combinedInput = [...input, ...hiddenState];

  // Input gate
  const inputGate = denseForward(
    combinedInput,
    weights.inputGate.weights,
    weights.inputGate.biases,
    'sigmoid'
  );

  // Forget gate
  const forgetGate = denseForward(
    combinedInput,
    weights.forgetGate.weights,
    weights.forgetGate.biases,
    'sigmoid'
  );

  // Cell gate (candidate)
  const cellGateRaw = denseForward(
    combinedInput,
    weights.cellGate.weights,
    weights.cellGate.biases,
    'linear'
  );
  const cellGate = cellGateRaw.map(x => Math.tanh(x));

  // Output gate
  const outputGate = denseForward(
    combinedInput,
    weights.outputGate.weights,
    weights.outputGate.biases,
    'sigmoid'
  );

  // New cell state
  const newCellState: number[] = [];
  for (let i = 0; i < hiddenSize; i++) {
    const forget = (forgetGate[i] ?? 0) * (cellState[i] ?? 0);
    const add = (inputGate[i] ?? 0) * (cellGate[i] ?? 0);
    newCellState.push(forget + add);
  }

  // New hidden state
  const newHiddenState: number[] = [];
  for (let i = 0; i < hiddenSize; i++) {
    newHiddenState.push((outputGate[i] ?? 0) * Math.tanh(newCellState[i] ?? 0));
  }

  return {
    hiddenState: newHiddenState,
    cellState: newCellState,
  };
}

// ============================================================================
// Model Validation
// ============================================================================

/**
 * Validate model configuration
 */
export function validateConfig(config: ModelConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.inputFeatures < 1) {
    errors.push('inputFeatures must be positive');
  }
  if (config.outputCount < 1) {
    errors.push('outputCount must be positive');
  }
  if (config.lstmUnits < 1) {
    errors.push('lstmUnits must be positive');
  }
  if (config.dropoutRate < 0 || config.dropoutRate >= 1) {
    errors.push('dropoutRate must be between 0 and 1');
  }
  if (config.denseUnits < 1) {
    errors.push('denseUnits must be positive');
  }
  if (config.sequenceLength < 1) {
    errors.push('sequenceLength must be positive');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get model summary for debugging
 */
export function getModelSummary(config: ModelConfig = DEFAULT_MODEL_CONFIG): string {
  const layers = getModelLayers(config);

  let summary = 'Model Summary\n';
  summary += '='.repeat(50) + '\n';
  summary += `Input Shape: (${config.sequenceLength}, ${config.inputFeatures})\n`;
  summary += '-'.repeat(50) + '\n';

  for (const layer of layers) {
    const units = layer.units ?? layer.rate ?? '';
    summary += `${layer.name.padEnd(15)} | ${layer.type.padEnd(10)} | ${String(units).padEnd(5)}\n`;
  }

  summary += '-'.repeat(50) + '\n';
  summary += `Output Shape: (${config.outputCount})\n`;

  return summary;
}

export default {
  DEFAULT_MODEL_CONFIG,
  getModelLayers,
  flattenFeatureVector,
  createSequence,
  parseModelOutput,
  validateConfig,
  getModelSummary,
};
