/**
 * ML Services Module
 * TensorFlow.js based machine learning for commute pattern prediction
 */

// Services
export { tensorFlowSetup, getTensorFlow } from './tensorflowSetup';
export { featureExtractor } from './featureExtractor';
export { modelService } from './modelService';
export { trainingService } from './trainingService';

// Types from tensorflowSetup
export type { TensorFlowStatus } from './tensorflowSetup';

// Types from featureExtractor
export type { FeatureExtractionResult, ExtractedFeatures } from './featureExtractor';

// Utility functions
export {
  createTensor,
  disposeTensor,
  tidyOperation,
  normalize,
  denormalize,
} from './tensorflowSetup';
