/**
 * ML Services Module
 * TensorFlow.js based machine learning for commute pattern prediction
 */

// Services
export { tensorFlowSetup, getTensorFlow, isTensorFlowAvailable } from './tensorflowSetup';
export { featureExtractor } from './featureExtractor';
export { modelService } from './modelService';
export { trainingService } from './trainingService';
export { validationService } from './validationService';

// Model Architecture
export {
  DEFAULT_MODEL_CONFIG,
  getModelLayers,
  flattenFeatureVector,
  createSequence,
  parseModelOutput,
  validateConfig,
  getModelSummary,
} from './modelArchitecture';

// Types from tensorflowSetup
export type { TensorFlowStatus, TensorLike } from './tensorflowSetup';

// Types from featureExtractor
export type { FeatureExtractionResult, ExtractedFeatures } from './featureExtractor';

// Types from modelArchitecture
export type {
  ModelConfig,
  LayerConfig,
  SerializedWeights,
} from './modelArchitecture';

// Types from validationService
export type {
  PredictionValidation,
  ModelMetrics,
  CrossValidationResult,
  DataQualityReport,
} from './validationService';

// Utility functions
export {
  createTensor,
  createTensor2d,
  createTensor3d,
  disposeTensor,
  tidyOperation,
  normalize,
  denormalize,
} from './tensorflowSetup';
