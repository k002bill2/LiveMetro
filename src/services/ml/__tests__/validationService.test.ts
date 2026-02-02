/**
 * ML Validation Service Tests
 */

import {
  validationService,
  MIN_VALIDATION_SAMPLES,
} from '../validationService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';
import { MLPrediction } from '@/models/ml';

describe('ValidationService', () => {
  const createMockLog = (overrides: Partial<CommuteLog> = {}): CommuteLog => ({
    id: `log_${Math.random()}`,
    userId: 'user1',
    date: new Date(),
    dayOfWeek: 1 as DayOfWeek,
    departureTime: '08:30',
    arrivalTime: '09:00',
    departureStationId: 'station1',
    arrivalStationId: 'station2',
    lineIds: ['line1'],
    transferCount: 0,
    duration: 30,
    wasDelayed: false,
    ...overrides,
  });

  const createMockPrediction = (overrides: Partial<MLPrediction> = {}): MLPrediction => ({
    predictedDepartureTime: '08:30',
    predictedArrivalTime: '09:00',
    confidence: 0.85,
    delayProbability: 0.1,
    factors: [],
    modelVersion: '1.0',
    generatedAt: new Date(),
    ...overrides,
  });

  describe('validatePrediction', () => {
    it('should validate accurate prediction', () => {
      const prediction = createMockPrediction({
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:00',
      });
      const actual = createMockLog({
        departureTime: '08:35',
        arrivalTime: '09:05',
      });

      const result = validationService.validatePrediction(prediction, actual);

      expect(result.isValid).toBe(true);
      expect(result.departureError).toBe(5);
      expect(result.arrivalError).toBe(5);
    });

    it('should invalidate inaccurate prediction', () => {
      const prediction = createMockPrediction({
        predictedDepartureTime: '08:00',
      });
      const actual = createMockLog({
        departureTime: '09:00',
      });

      const result = validationService.validatePrediction(prediction, actual);

      expect(result.isValid).toBe(false);
      expect(result.departureError).toBe(60);
    });

    it('should correctly assess delay prediction', () => {
      const prediction = createMockPrediction({
        delayProbability: 0.8,
      });
      const actual = createMockLog({
        wasDelayed: true,
      });

      const result = validationService.validatePrediction(prediction, actual);

      expect(result.delayPredicted).toBe(true);
      expect(result.actualDelay).toBe(true);
      expect(result.delayPredictionCorrect).toBe(true);
    });

    it('should handle missing arrival time', () => {
      const prediction = createMockPrediction();
      const actual = createMockLog({
        arrivalTime: undefined,
      });

      const result = validationService.validatePrediction(prediction, actual);

      expect(result.arrivalError).toBeUndefined();
    });
  });

  describe('calculateMetrics', () => {
    it('should return empty metrics for empty arrays', () => {
      const metrics = validationService.calculateMetrics([], []);

      expect(metrics.sampleCount).toBe(0);
      expect(metrics.meanAbsoluteError).toBe(0);
    });

    it('should return empty metrics for mismatched arrays', () => {
      const predictions = [createMockPrediction()];
      const actuals = [createMockLog(), createMockLog()];

      const metrics = validationService.calculateMetrics(predictions, actuals);

      expect(metrics.sampleCount).toBe(0);
    });

    it('should calculate correct MAE', () => {
      const predictions = [
        createMockPrediction({ predictedDepartureTime: '08:30' }),
        createMockPrediction({ predictedDepartureTime: '09:00' }),
      ];
      const actuals = [
        createMockLog({ departureTime: '08:40' }), // 10 min error
        createMockLog({ departureTime: '09:20' }), // 20 min error
      ];

      const metrics = validationService.calculateMetrics(predictions, actuals);

      expect(metrics.meanAbsoluteError).toBe(15); // (10 + 20) / 2
      expect(metrics.sampleCount).toBe(2);
    });

    it('should calculate RMSE correctly', () => {
      const predictions = [
        createMockPrediction({ predictedDepartureTime: '08:30' }),
        createMockPrediction({ predictedDepartureTime: '09:00' }),
      ];
      const actuals = [
        createMockLog({ departureTime: '08:40' }), // 10 min error
        createMockLog({ departureTime: '09:20' }), // 20 min error
      ];

      const metrics = validationService.calculateMetrics(predictions, actuals);

      // RMSE = sqrt((10^2 + 20^2) / 2) = sqrt(250) ≈ 15.81
      expect(metrics.rootMeanSquaredError).toBeCloseTo(15.81, 1);
    });

    it('should calculate delay precision and recall', () => {
      const predictions = [
        createMockPrediction({ delayProbability: 0.8 }), // Predicts delay
        createMockPrediction({ delayProbability: 0.8 }), // Predicts delay
        createMockPrediction({ delayProbability: 0.2 }), // Predicts no delay
        createMockPrediction({ delayProbability: 0.2 }), // Predicts no delay
      ];
      const actuals = [
        createMockLog({ wasDelayed: true }),  // TP
        createMockLog({ wasDelayed: false }), // FP
        createMockLog({ wasDelayed: true }),  // FN
        createMockLog({ wasDelayed: false }), // TN
      ];

      const metrics = validationService.calculateMetrics(predictions, actuals);

      // Precision = TP / (TP + FP) = 1 / 2 = 0.5
      expect(metrics.delayPrecision).toBe(0.5);
      // Recall = TP / (TP + FN) = 1 / 2 = 0.5
      expect(metrics.delayRecall).toBe(0.5);
      // F1 = 2 * (0.5 * 0.5) / (0.5 + 0.5) = 0.5
      expect(metrics.delayF1Score).toBe(0.5);
    });
  });

  describe('crossValidate', () => {
    it('should perform k-fold cross validation', () => {
      const logs = Array.from({ length: 20 }, (_, i) =>
        createMockLog({
          id: `log_${i}`,
          departureTime: `08:${30 + (i % 30)}`,
        })
      );

      const predictor = (trainData: readonly CommuteLog[], testLog: CommuteLog) =>
        createMockPrediction({
          predictedDepartureTime: testLog.departureTime,
        });

      const result = validationService.crossValidate(logs, predictor, 5);

      expect(result.folds.length).toBe(5);
      expect(result.averageMetrics).toBeDefined();
      expect(result.stdDevMetrics).toBeDefined();
    });
  });

  describe('assessDataQuality', () => {
    it('should assess empty data', () => {
      const report = validationService.assessDataQuality([]);

      expect(report.totalLogs).toBe(0);
      expect(report.validLogs).toBe(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect missing data', () => {
      const logs = [
        createMockLog({ departureTime: '' }),
        createMockLog({ arrivalTime: undefined }),
        createMockLog(),
      ];

      const report = validationService.assessDataQuality(logs);

      expect(report.missingDepartureTime).toBe(1);
      expect(report.missingArrivalTime).toBe(1);
    });

    it('should calculate day distribution', () => {
      const logs = [
        createMockLog({ dayOfWeek: 1 as DayOfWeek }),
        createMockLog({ dayOfWeek: 1 as DayOfWeek }),
        createMockLog({ dayOfWeek: 2 as DayOfWeek }),
      ];

      const report = validationService.assessDataQuality(logs);

      expect(report.dayDistribution[1]).toBe(2);
      expect(report.dayDistribution[2]).toBe(1);
    });

    it('should calculate delay rate', () => {
      const logs = [
        createMockLog({ wasDelayed: true }),
        createMockLog({ wasDelayed: true }),
        createMockLog({ wasDelayed: false }),
        createMockLog({ wasDelayed: false }),
      ];

      const report = validationService.assessDataQuality(logs);

      expect(report.averageDelayRate).toBe(0.5);
    });

    it('should recommend more data when insufficient', () => {
      const logs = [createMockLog()];

      const report = validationService.assessDataQuality(logs);

      expect(report.recommendations.some(r => r.includes('더 많은'))).toBe(true);
    });
  });

  describe('validateTrainingResult', () => {
    it('should accept good training result', () => {
      const result = {
        success: true,
        modelVersion: '1.0',
        epochsCompleted: 10,
        finalLoss: 0.1,
        validationAccuracy: 0.85,
        trainingTime: 5000,
        samplesUsed: 100,
      };

      const validation = validationService.validateTrainingResult(result);

      expect(validation.isAcceptable).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should reject failed training', () => {
      const result = {
        success: false,
        modelVersion: '1.0',
        epochsCompleted: 0,
        finalLoss: 1,
        validationAccuracy: 0,
        trainingTime: 100,
        samplesUsed: 10,
        error: 'Training failed',
      };

      const validation = validationService.validateTrainingResult(result);

      expect(validation.isAcceptable).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should flag high loss', () => {
      const result = {
        success: true,
        modelVersion: '1.0',
        epochsCompleted: 10,
        finalLoss: 0.8, // High loss
        validationAccuracy: 0.7,
        trainingTime: 5000,
        samplesUsed: 100,
      };

      const validation = validationService.validateTrainingResult(result);

      expect(validation.issues.some(i => i.includes('loss'))).toBe(true);
    });

    it('should flag low accuracy', () => {
      const result = {
        success: true,
        modelVersion: '1.0',
        epochsCompleted: 10,
        finalLoss: 0.2,
        validationAccuracy: 0.4, // Low accuracy
        trainingTime: 5000,
        samplesUsed: 100,
      };

      const validation = validationService.validateTrainingResult(result);

      expect(validation.issues.some(i => i.includes('accuracy'))).toBe(true);
    });
  });

  describe('MIN_VALIDATION_SAMPLES', () => {
    it('should be exported and have correct value', () => {
      expect(MIN_VALIDATION_SAMPLES).toBe(5);
    });
  });
});
