/**
 * Congestion Services Module
 * Crowdsourced and predictive congestion data services
 */

// Core congestion service
export { congestionService } from './congestionService';

// Prediction service
export {
  congestionPredictionService,
  type CongestionPrediction,
  type TimeSlotStats,
  type HourlyCongestionPattern,
} from './congestionPredictionService';

// Historical analysis
export {
  historicalAnalysisService,
  type CongestionTrendAnalysis,
  type StationComparison,
  type TimePattern,
  type CongestionAnomaly,
} from './historicalAnalysis';

// Data quality
export {
  dataQualityService,
  type DataQualityReport,
  type DataQualityIssue,
  type IssueType,
  type OutlierResult,
  type ReporterReliability,
} from './dataQualityService';

// Heatmap visualization
export {
  heatmapService,
  type HeatmapCell,
  type HeatmapData,
  type HeatmapColors,
  type TimeRange,
  DEFAULT_HEATMAP_COLORS,
  DEFAULT_TIME_RANGE,
} from './heatmapService';
