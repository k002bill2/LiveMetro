/**
 * ML Validation Service
 * Validates predictions and model performance
 */

import { CommuteLog, parseTimeToMinutes, formatMinutesToTime } from '@/models/pattern';
import { MLPrediction, TrainingResult } from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation result for a single prediction
 */
export interface PredictionValidation {
  readonly isValid: boolean;
  readonly actualDeparture: string;
  readonly predictedDeparture: string;
  readonly departureError: number; // In minutes
  readonly actualArrival?: string;
  readonly predictedArrival: string;
  readonly arrivalError?: number; // In minutes
  readonly delayPredicted: boolean;
  readonly actualDelay: boolean;
  readonly delayPredictionCorrect: boolean;
}

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  readonly meanAbsoluteError: number; // Minutes
  readonly rootMeanSquaredError: number; // Minutes
  readonly delayPrecision: number; // 0-1
  readonly delayRecall: number; // 0-1
  readonly delayF1Score: number; // 0-1
  readonly r2Score: number; // Coefficient of determination
  readonly sampleCount: number;
}

/**
 * Cross-validation result
 */
export interface CrossValidationResult {
  readonly folds: readonly {
    foldIndex: number;
    trainSize: number;
    testSize: number;
    metrics: ModelMetrics;
  }[];
  readonly averageMetrics: ModelMetrics;
  readonly stdDevMetrics: Partial<ModelMetrics>;
}

/**
 * Data quality assessment
 */
export interface DataQualityReport {
  readonly totalLogs: number;
  readonly validLogs: number;
  readonly invalidLogs: number;
  readonly missingDepartureTime: number;
  readonly missingArrivalTime: number;
  readonly outlierCount: number;
  readonly dayDistribution: Record<number, number>;
  readonly timeRangeStart: string;
  readonly timeRangeEnd: string;
  readonly averageDelayRate: number;
  readonly recommendations: readonly string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Threshold for outlier detection (standard deviations) */
const OUTLIER_THRESHOLD = 3;

/** Minimum samples for reliable validation - exported for configuration */
export const MIN_VALIDATION_SAMPLES = 5;

/** Threshold for delay classification */
const DELAY_PROBABILITY_THRESHOLD = 0.5;

// ============================================================================
// Validation Service
// ============================================================================

class ValidationService {
  /**
   * Validate a single prediction against actual data
   */
  validatePrediction(
    prediction: MLPrediction,
    actual: CommuteLog
  ): PredictionValidation {
    const predictedDepartureMin = parseTimeToMinutes(prediction.predictedDepartureTime);
    const actualDepartureMin = parseTimeToMinutes(actual.departureTime);
    const departureError = Math.abs(predictedDepartureMin - actualDepartureMin);

    let arrivalError: number | undefined;
    if (actual.arrivalTime) {
      const predictedArrivalMin = parseTimeToMinutes(prediction.predictedArrivalTime);
      const actualArrivalMin = parseTimeToMinutes(actual.arrivalTime);
      arrivalError = Math.abs(predictedArrivalMin - actualArrivalMin);
    }

    const delayPredicted = prediction.delayProbability >= DELAY_PROBABILITY_THRESHOLD;
    const delayPredictionCorrect = delayPredicted === actual.wasDelayed;

    return {
      isValid: departureError <= 30, // Valid if within 30 minutes
      actualDeparture: actual.departureTime,
      predictedDeparture: prediction.predictedDepartureTime,
      departureError,
      actualArrival: actual.arrivalTime,
      predictedArrival: prediction.predictedArrivalTime,
      arrivalError,
      delayPredicted,
      actualDelay: actual.wasDelayed,
      delayPredictionCorrect,
    };
  }

  /**
   * Calculate model performance metrics
   */
  calculateMetrics(
    predictions: readonly MLPrediction[],
    actuals: readonly CommuteLog[]
  ): ModelMetrics {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return this.getEmptyMetrics();
    }

    const validations = predictions.map((pred, i) =>
      this.validatePrediction(pred, actuals[i]!)
    );

    // Calculate MAE
    const departureErrors = validations.map(v => v.departureError);
    const meanAbsoluteError =
      departureErrors.reduce((sum, e) => sum + e, 0) / departureErrors.length;

    // Calculate RMSE
    const squaredErrors = departureErrors.map(e => e * e);
    const rootMeanSquaredError = Math.sqrt(
      squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length
    );

    // Calculate delay prediction metrics
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let trueNegatives = 0;

    for (const v of validations) {
      if (v.delayPredicted && v.actualDelay) truePositives++;
      else if (v.delayPredicted && !v.actualDelay) falsePositives++;
      else if (!v.delayPredicted && v.actualDelay) falseNegatives++;
      else trueNegatives++;
    }

    const delayPrecision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;
    const delayRecall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 0;
    const delayF1Score =
      delayPrecision + delayRecall > 0
        ? (2 * delayPrecision * delayRecall) / (delayPrecision + delayRecall)
        : 0;

    // Calculate R² score for departure times
    const actualDepartures = actuals.map(a => parseTimeToMinutes(a.departureTime));
    const predictedDepartures = predictions.map(p =>
      parseTimeToMinutes(p.predictedDepartureTime)
    );
    const r2Score = this.calculateR2(actualDepartures, predictedDepartures);

    return {
      meanAbsoluteError,
      rootMeanSquaredError,
      delayPrecision,
      delayRecall,
      delayF1Score,
      r2Score,
      sampleCount: validations.length,
    };
  }

  /**
   * Perform k-fold cross validation
   */
  crossValidate(
    logs: readonly CommuteLog[],
    predictor: (trainData: readonly CommuteLog[], testLog: CommuteLog) => MLPrediction,
    k: number = 5
  ): CrossValidationResult {
    const folds: CrossValidationResult['folds'][number][] = [];
    const shuffled = [...logs].sort(() => Math.random() - 0.5);
    const foldSize = Math.floor(shuffled.length / k);

    for (let i = 0; i < k; i++) {
      const testStart = i * foldSize;
      const testEnd = i === k - 1 ? shuffled.length : (i + 1) * foldSize;

      const testData = shuffled.slice(testStart, testEnd);
      const trainData = [
        ...shuffled.slice(0, testStart),
        ...shuffled.slice(testEnd),
      ];

      const predictions: MLPrediction[] = [];
      for (const testLog of testData) {
        predictions.push(predictor(trainData, testLog));
      }

      const metrics = this.calculateMetrics(predictions, testData);

      folds.push({
        foldIndex: i,
        trainSize: trainData.length,
        testSize: testData.length,
        metrics,
      });
    }

    // Calculate average metrics
    const averageMetrics = this.averageMetrics(folds.map(f => f.metrics));
    const stdDevMetrics = this.stdDevMetrics(folds.map(f => f.metrics));

    return { folds, averageMetrics, stdDevMetrics };
  }

  /**
   * Assess data quality
   */
  assessDataQuality(logs: readonly CommuteLog[]): DataQualityReport {
    let validLogs = 0;
    let missingDepartureTime = 0;
    let missingArrivalTime = 0;
    const dayDistribution: Record<number, number> = {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
    };

    // Collect departure times for outlier detection
    const departureTimes: number[] = [];

    for (const log of logs) {
      if (!log.departureTime) {
        missingDepartureTime++;
        continue;
      }
      if (!log.arrivalTime) {
        missingArrivalTime++;
      }

      const dayKey = log.dayOfWeek as number;
      if (Object.prototype.hasOwnProperty.call(dayDistribution, dayKey)) {
        dayDistribution[dayKey] = (dayDistribution[dayKey] ?? 0) + 1;
      }
      departureTimes.push(parseTimeToMinutes(log.departureTime));
      validLogs++;
    }

    // Detect outliers
    const outlierCount = this.countOutliers(departureTimes);

    // Calculate time range
    const sortedTimes = [...departureTimes].sort((a, b) => a - b);
    const timeRangeStart = formatMinutesToTime(sortedTimes[0] ?? 0);
    const timeRangeEnd = formatMinutesToTime(sortedTimes[sortedTimes.length - 1] ?? 0);

    // Calculate average delay rate
    const delayedLogs = logs.filter(l => l.wasDelayed).length;
    const averageDelayRate = logs.length > 0 ? delayedLogs / logs.length : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      totalLogs: logs.length,
      validLogs,
      missingArrivalTime,
      outlierCount,
      dayDistribution,
      averageDelayRate,
    });

    return {
      totalLogs: logs.length,
      validLogs,
      invalidLogs: logs.length - validLogs,
      missingDepartureTime,
      missingArrivalTime,
      outlierCount,
      dayDistribution,
      timeRangeStart,
      timeRangeEnd,
      averageDelayRate,
      recommendations,
    };
  }

  /**
   * Validate training result
   */
  validateTrainingResult(result: TrainingResult): {
    isAcceptable: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!result.success) {
      issues.push(`Training failed: ${result.error || 'Unknown error'}`);
      suggestions.push('Check data quality and try again');
      return { isAcceptable: false, issues, suggestions };
    }

    // Check loss
    if (result.finalLoss > 0.5) {
      issues.push(`High loss value: ${result.finalLoss.toFixed(4)}`);
      suggestions.push('Consider more training epochs or data augmentation');
    }

    // Check accuracy
    if (result.validationAccuracy < 0.6) {
      issues.push(`Low validation accuracy: ${(result.validationAccuracy * 100).toFixed(1)}%`);
      suggestions.push('Consider collecting more training data');
    }

    // Check epochs
    if (result.epochsCompleted < 5) {
      issues.push(`Few epochs completed: ${result.epochsCompleted}`);
      suggestions.push('Training may have stopped early due to data issues');
    }

    return {
      isAcceptable: issues.length === 0,
      issues,
      suggestions,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate R² score
   */
  private calculateR2(actual: readonly number[], predicted: readonly number[]): number {
    if (actual.length === 0) return 0;

    const mean = actual.reduce((sum, v) => sum + v, 0) / actual.length;
    const ssTotal = actual.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    const ssResidual = actual.reduce(
      (sum, v, i) => sum + Math.pow(v - (predicted[i] ?? 0), 2),
      0
    );

    if (ssTotal === 0) return 0;
    return 1 - ssResidual / ssTotal;
  }

  /**
   * Count outliers using z-score method
   */
  private countOutliers(values: readonly number[]): number {
    if (values.length < 3) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return values.filter(v => Math.abs(v - mean) / stdDev > OUTLIER_THRESHOLD).length;
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): ModelMetrics {
    return {
      meanAbsoluteError: 0,
      rootMeanSquaredError: 0,
      delayPrecision: 0,
      delayRecall: 0,
      delayF1Score: 0,
      r2Score: 0,
      sampleCount: 0,
    };
  }

  /**
   * Calculate average of metrics
   */
  private averageMetrics(metrics: readonly ModelMetrics[]): ModelMetrics {
    if (metrics.length === 0) return this.getEmptyMetrics();

    const sum = metrics.reduce(
      (acc, m) => ({
        meanAbsoluteError: acc.meanAbsoluteError + m.meanAbsoluteError,
        rootMeanSquaredError: acc.rootMeanSquaredError + m.rootMeanSquaredError,
        delayPrecision: acc.delayPrecision + m.delayPrecision,
        delayRecall: acc.delayRecall + m.delayRecall,
        delayF1Score: acc.delayF1Score + m.delayF1Score,
        r2Score: acc.r2Score + m.r2Score,
        sampleCount: acc.sampleCount + m.sampleCount,
      }),
      this.getEmptyMetrics()
    );

    return {
      meanAbsoluteError: sum.meanAbsoluteError / metrics.length,
      rootMeanSquaredError: sum.rootMeanSquaredError / metrics.length,
      delayPrecision: sum.delayPrecision / metrics.length,
      delayRecall: sum.delayRecall / metrics.length,
      delayF1Score: sum.delayF1Score / metrics.length,
      r2Score: sum.r2Score / metrics.length,
      sampleCount: sum.sampleCount,
    };
  }

  /**
   * Calculate standard deviation of metrics
   */
  private stdDevMetrics(metrics: readonly ModelMetrics[]): Partial<ModelMetrics> {
    if (metrics.length < 2) return {};

    const avg = this.averageMetrics(metrics);
    const variance = metrics.reduce(
      (acc, m) => ({
        meanAbsoluteError:
          acc.meanAbsoluteError + Math.pow(m.meanAbsoluteError - avg.meanAbsoluteError, 2),
        rootMeanSquaredError:
          acc.rootMeanSquaredError +
          Math.pow(m.rootMeanSquaredError - avg.rootMeanSquaredError, 2),
        r2Score: acc.r2Score + Math.pow(m.r2Score - avg.r2Score, 2),
      }),
      { meanAbsoluteError: 0, rootMeanSquaredError: 0, r2Score: 0 }
    );

    return {
      meanAbsoluteError: Math.sqrt(variance.meanAbsoluteError / metrics.length),
      rootMeanSquaredError: Math.sqrt(variance.rootMeanSquaredError / metrics.length),
      r2Score: Math.sqrt(variance.r2Score / metrics.length),
    };
  }

  /**
   * Generate recommendations based on data quality
   */
  private generateRecommendations(data: {
    totalLogs: number;
    validLogs: number;
    missingArrivalTime: number;
    outlierCount: number;
    dayDistribution: Record<number, number>;
    averageDelayRate: number;
  }): string[] {
    const recommendations: string[] = [];

    if (data.totalLogs < 10) {
      recommendations.push('더 많은 출퇴근 기록이 필요합니다 (최소 10개 권장)');
    }

    if (data.validLogs / data.totalLogs < 0.9) {
      recommendations.push('일부 기록에 필수 데이터가 누락되었습니다');
    }

    if (data.missingArrivalTime > data.totalLogs * 0.3) {
      recommendations.push('도착 시간 데이터가 부족합니다. 정확한 예측을 위해 도착 시간을 기록해주세요');
    }

    if (data.outlierCount > 0) {
      recommendations.push(
        `${data.outlierCount}개의 이상치가 발견되었습니다. 데이터를 확인해주세요`
      );
    }

    // Check day distribution imbalance
    const dayValues = Object.values(data.dayDistribution);
    const maxDay = Math.max(...dayValues);
    const minDay = Math.min(...dayValues);
    if (maxDay > minDay * 3 && minDay < 2) {
      recommendations.push('특정 요일의 데이터가 부족합니다');
    }

    if (recommendations.length === 0) {
      recommendations.push('데이터 품질이 양호합니다');
    }

    return recommendations;
  }
}

// ============================================================================
// Export
// ============================================================================

export const validationService = new ValidationService();
export default validationService;
