/**
 * Feedback Loop for ACE Framework
 * 텔레메트리 수집, 학습 이벤트 기록, 프로토콜 개선 제안
 *
 * @version 3.0.1-KiiPS
 * @layer Feedback Loops (Cross-Layer)
 */

const fs = require('fs');
const path = require('path');

// 설정 경로
const TELEMETRY_DIR = path.join(__dirname, '../ace-framework/telemetry');
const LEARNING_EVENTS_PATH = path.join(TELEMETRY_DIR, 'learning-events.json');
const EXECUTION_METRICS_PATH = path.join(TELEMETRY_DIR, 'execution-metrics.json');
const IMPROVEMENT_SUGGESTIONS_PATH = path.join(TELEMETRY_DIR, 'improvement-suggestions.json');

// 설정
const CONFIG = {
  retentionDays: 30,
  maxEventsPerFile: 1000,
  aggregationInterval: 86400000, // 24시간
  minSamplesForImprovement: 3
};

/**
 * 디렉토리 존재 확인 및 생성
 */
function ensureTelemetryDir() {
  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }
}

/**
 * JSON 파일 로드 (기본값 반환)
 */
function loadJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error(`[FeedbackLoop] Error loading ${filePath}:`, error.message);
  }
  return defaultValue;
}

/**
 * JSON 파일 저장
 */
function saveJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================
// 텔레메트리 수집
// ============================================

/**
 * 실행 메트릭 기록
 *
 * @param {Object} metrics 메트릭 데이터
 */
function recordExecutionMetrics(metrics) {
  ensureTelemetryDir();

  const {
    executionId,
    taskType,
    layer,
    agentId,
    success,
    duration,
    errorCount = 0,
    conflictCount = 0,
    ethicalConcerns = 0,
    parallelAgents = 1
  } = metrics;

  const timestamp = Date.now();

  const record = {
    recordId: `metric_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp,
    executionId,
    taskType,
    layer,
    agentId,
    success,
    duration,
    errorCount,
    conflictCount,
    ethicalConcerns,
    parallelAgents,
    efficiency: calculateEfficiency(metrics)
  };

  const data = loadJsonFile(EXECUTION_METRICS_PATH, { metrics: [], aggregated: {} });

  // 메트릭 추가
  data.metrics.unshift(record);

  // 오래된 데이터 정리
  const cutoffTime = timestamp - (CONFIG.retentionDays * 86400000);
  data.metrics = data.metrics
    .filter(m => m.timestamp > cutoffTime)
    .slice(0, CONFIG.maxEventsPerFile);

  // 집계 업데이트
  updateAggregations(data, record);

  saveJsonFile(EXECUTION_METRICS_PATH, data);

  return {
    success: true,
    recordId: record.recordId,
    efficiency: record.efficiency
  };
}

/**
 * 효율성 계산
 */
function calculateEfficiency(metrics) {
  const { success, duration, errorCount, conflictCount, parallelAgents } = metrics;

  let efficiency = 1.0;

  // 성공 여부
  if (!success) efficiency *= 0.5;

  // 에러/충돌 페널티
  efficiency *= Math.max(0.5, 1 - (errorCount * 0.1));
  efficiency *= Math.max(0.5, 1 - (conflictCount * 0.15));

  // 병렬화 보너스
  if (parallelAgents > 1) {
    efficiency *= Math.min(1.5, 1 + (parallelAgents - 1) * 0.2);
  }

  return Math.round(efficiency * 100) / 100;
}

/**
 * 집계 업데이트
 */
function updateAggregations(data, record) {
  const dateKey = new Date(record.timestamp).toISOString().split('T')[0];

  if (!data.aggregated[dateKey]) {
    data.aggregated[dateKey] = {
      totalExecutions: 0,
      successCount: 0,
      totalDuration: 0,
      totalErrors: 0,
      totalConflicts: 0,
      avgEfficiency: 0,
      byTaskType: {},
      byAgent: {},
      byLayer: {}
    };
  }

  const agg = data.aggregated[dateKey];
  agg.totalExecutions++;
  if (record.success) agg.successCount++;
  agg.totalDuration += record.duration || 0;
  agg.totalErrors += record.errorCount;
  agg.totalConflicts += record.conflictCount;

  // 평균 효율성 (이동 평균)
  agg.avgEfficiency = (agg.avgEfficiency * (agg.totalExecutions - 1) + record.efficiency) / agg.totalExecutions;

  // TaskType별 집계
  if (record.taskType) {
    if (!agg.byTaskType[record.taskType]) {
      agg.byTaskType[record.taskType] = { count: 0, successCount: 0 };
    }
    agg.byTaskType[record.taskType].count++;
    if (record.success) agg.byTaskType[record.taskType].successCount++;
  }

  // Agent별 집계
  if (record.agentId) {
    if (!agg.byAgent[record.agentId]) {
      agg.byAgent[record.agentId] = { count: 0, successCount: 0, totalEfficiency: 0 };
    }
    agg.byAgent[record.agentId].count++;
    if (record.success) agg.byAgent[record.agentId].successCount++;
    agg.byAgent[record.agentId].totalEfficiency += record.efficiency;
  }

  // Layer별 집계
  if (record.layer) {
    if (!agg.byLayer[record.layer]) {
      agg.byLayer[record.layer] = { count: 0, successCount: 0 };
    }
    agg.byLayer[record.layer].count++;
    if (record.success) agg.byLayer[record.layer].successCount++;
  }
}

// ============================================
// 학습 이벤트
// ============================================

/**
 * 학습 이벤트 유형
 */
const LEARNING_EVENT_TYPES = [
  'task_completion_success',
  'task_completion_failure',
  'capability_overestimation',
  'capability_underestimation',
  'new_pattern_discovered',
  'ethical_concern_raised',
  'conflict_resolution',
  'dynamic_reallocation',
  'checkpoint_rollback',
  'performance_improvement'
];

/**
 * 학습 이벤트 기록
 *
 * @param {Object} event 학습 이벤트
 */
function recordLearningEvent(event) {
  ensureTelemetryDir();

  const {
    eventType,
    agentId,
    context,
    insight,
    confidence = 0.5,
    sampleSize = 1
  } = event;

  if (!LEARNING_EVENT_TYPES.includes(eventType)) {
    return {
      success: false,
      error: 'INVALID_EVENT_TYPE',
      validTypes: LEARNING_EVENT_TYPES
    };
  }

  const timestamp = Date.now();

  const record = {
    eventId: `learn_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp,
    eventType,
    agentId,
    context,
    insight,
    confidence,
    sampleSize,
    validated: false,
    validators: []
  };

  const data = loadJsonFile(LEARNING_EVENTS_PATH, { events: [], validated: [] });

  // 이벤트 추가
  data.events.unshift(record);

  // 오래된 데이터 정리
  const cutoffTime = timestamp - (CONFIG.retentionDays * 86400000);
  data.events = data.events
    .filter(e => e.timestamp > cutoffTime)
    .slice(0, CONFIG.maxEventsPerFile);

  saveJsonFile(LEARNING_EVENTS_PATH, data);

  return {
    success: true,
    eventId: record.eventId,
    message: 'Learning event recorded'
  };
}

/**
 * 학습 이벤트 검증 (다른 에이전트에 의해)
 */
function validateLearningEvent(eventId, validation) {
  const { validatorAgentId, agrees, notes } = validation;

  const data = loadJsonFile(LEARNING_EVENTS_PATH, { events: [], validated: [] });

  const event = data.events.find(e => e.eventId === eventId);
  if (!event) {
    return { success: false, error: 'EVENT_NOT_FOUND' };
  }

  // 검증 추가
  event.validators.push({
    agentId: validatorAgentId,
    agrees,
    notes,
    timestamp: Date.now()
  });

  // 동의 비율 계산
  const agreeCount = event.validators.filter(v => v.agrees).length;
  const totalValidators = event.validators.length;

  // 검증 완료 조건 (3명 이상, 과반수 동의)
  if (totalValidators >= CONFIG.minSamplesForImprovement && agreeCount / totalValidators > 0.5) {
    event.validated = true;
    event.confidence = Math.min(0.95, event.confidence + (agreeCount * 0.1));

    // validated 목록으로 이동
    data.validated.push({
      ...event,
      validatedAt: Date.now()
    });
  }

  saveJsonFile(LEARNING_EVENTS_PATH, data);

  return {
    success: true,
    eventId,
    validated: event.validated,
    confidence: event.confidence,
    validatorCount: totalValidators
  };
}

// ============================================
// 개선 제안
// ============================================

/**
 * 개선 제안 생성
 */
function generateImprovementSuggestions() {
  ensureTelemetryDir();

  const metricsData = loadJsonFile(EXECUTION_METRICS_PATH, { metrics: [], aggregated: {} });
  const learningData = loadJsonFile(LEARNING_EVENTS_PATH, { events: [], validated: [] });

  const suggestions = [];

  // 1. 에러 패턴 분석
  const recentMetrics = metricsData.metrics.slice(0, 100);
  const errorTasks = recentMetrics.filter(m => m.errorCount > 0);

  if (errorTasks.length > 5) {
    const errorByType = {};
    for (const task of errorTasks) {
      errorByType[task.taskType] = (errorByType[task.taskType] || 0) + 1;
    }

    const mostErrorProne = Object.entries(errorByType)
      .sort((a, b) => b[1] - a[1])[0];

    if (mostErrorProne && mostErrorProne[1] > 3) {
      suggestions.push({
        type: 'error_pattern',
        priority: 'high',
        layer: 'layer6_task_prosecution',
        taskType: mostErrorProne[0],
        observation: `${mostErrorProne[0]} tasks have ${mostErrorProne[1]} errors in recent executions`,
        recommendation: `Review and improve error handling for ${mostErrorProne[0]} task type`,
        confidence: 0.8
      });
    }
  }

  // 2. 충돌 패턴 분석
  const conflictTasks = recentMetrics.filter(m => m.conflictCount > 0);

  if (conflictTasks.length > 3) {
    suggestions.push({
      type: 'conflict_pattern',
      priority: 'medium',
      layer: 'layer5_cognitive_control',
      observation: `${conflictTasks.length} tasks experienced conflicts`,
      recommendation: 'Review lock ordering and resource allocation strategy',
      confidence: 0.7
    });
  }

  // 3. 효율성 분석
  const avgEfficiency = recentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / recentMetrics.length;

  if (avgEfficiency < 0.7) {
    suggestions.push({
      type: 'efficiency',
      priority: 'medium',
      layer: 'layer4_executive_function',
      observation: `Average efficiency is ${Math.round(avgEfficiency * 100)}%`,
      recommendation: 'Consider increasing parallelization or optimizing task decomposition',
      confidence: 0.75
    });
  }

  // 4. 검증된 학습 이벤트 기반 제안
  for (const event of learningData.validated.slice(0, 10)) {
    if (event.eventType === 'capability_overestimation') {
      suggestions.push({
        type: 'capability_adjustment',
        priority: 'high',
        layer: 'layer3_agent_model',
        observation: `Agent ${event.agentId} overestimated capability for: ${event.context}`,
        recommendation: `Update capability score for ${event.agentId} in layer3-agent-model.json`,
        sourceEvent: event.eventId,
        confidence: event.confidence
      });
    }

    if (event.eventType === 'ethical_concern_raised') {
      suggestions.push({
        type: 'ethical_protocol',
        priority: 'critical',
        layer: 'layer1_aspirational',
        observation: `Ethical concern raised: ${event.insight}`,
        recommendation: 'Review and update ethical constraints in layer1-aspirational.md',
        sourceEvent: event.eventId,
        confidence: event.confidence
      });
    }
  }

  // 저장
  const suggestionsData = {
    generatedAt: Date.now(),
    basedOnMetrics: recentMetrics.length,
    basedOnLearningEvents: learningData.validated.length,
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
  };

  saveJsonFile(IMPROVEMENT_SUGGESTIONS_PATH, suggestionsData);

  return {
    success: true,
    suggestionCount: suggestions.length,
    suggestions
  };
}

/**
 * 개선 제안 조회
 */
function getImprovementSuggestions() {
  return loadJsonFile(IMPROVEMENT_SUGGESTIONS_PATH, {
    generatedAt: null,
    suggestions: []
  });
}

// ============================================
// 보고서 생성
// ============================================

/**
 * 요약 보고서 생성
 */
function generateSummaryReport(options = {}) {
  const { days = 7 } = options;

  const metricsData = loadJsonFile(EXECUTION_METRICS_PATH, { metrics: [], aggregated: {} });
  const learningData = loadJsonFile(LEARNING_EVENTS_PATH, { events: [], validated: [] });
  const suggestionsData = loadJsonFile(IMPROVEMENT_SUGGESTIONS_PATH, { suggestions: [] });

  const cutoffTime = Date.now() - (days * 86400000);
  const recentMetrics = metricsData.metrics.filter(m => m.timestamp > cutoffTime);
  const recentLearning = learningData.events.filter(e => e.timestamp > cutoffTime);

  // 레이어별 통계
  const layerStats = {};
  for (const metric of recentMetrics) {
    const layer = metric.layer || 'unknown';
    if (!layerStats[layer]) {
      layerStats[layer] = { count: 0, successCount: 0, totalEfficiency: 0 };
    }
    layerStats[layer].count++;
    if (metric.success) layerStats[layer].successCount++;
    layerStats[layer].totalEfficiency += metric.efficiency;
  }

  const report = {
    period: `Last ${days} days`,
    generatedAt: new Date().toISOString(),

    summary: {
      totalExecutions: recentMetrics.length,
      successRate: recentMetrics.length > 0
        ? Math.round((recentMetrics.filter(m => m.success).length / recentMetrics.length) * 100)
        : 0,
      avgEfficiency: recentMetrics.length > 0
        ? Math.round(recentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / recentMetrics.length * 100)
        : 0,
      totalErrors: recentMetrics.reduce((sum, m) => sum + m.errorCount, 0),
      totalConflicts: recentMetrics.reduce((sum, m) => sum + m.conflictCount, 0)
    },

    layerPerformance: Object.entries(layerStats).map(([layer, stats]) => ({
      layer,
      executions: stats.count,
      successRate: Math.round((stats.successCount / stats.count) * 100),
      avgEfficiency: Math.round((stats.totalEfficiency / stats.count) * 100)
    })),

    learningEvents: {
      total: recentLearning.length,
      validated: learningData.validated.length,
      byType: LEARNING_EVENT_TYPES.reduce((acc, type) => {
        acc[type] = recentLearning.filter(e => e.eventType === type).length;
        return acc;
      }, {})
    },

    topSuggestions: suggestionsData.suggestions.slice(0, 5)
  };

  return report;
}

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  let result;

  switch (command) {
    case 'record-metric':
      const metrics = JSON.parse(args[1] || '{}');
      result = recordExecutionMetrics(metrics);
      break;

    case 'record-learning':
      const event = JSON.parse(args[1] || '{}');
      result = recordLearningEvent(event);
      break;

    case 'validate-learning':
      const eventId = args[1];
      const validation = JSON.parse(args[2] || '{}');
      result = validateLearningEvent(eventId, validation);
      break;

    case 'generate-suggestions':
      result = generateImprovementSuggestions();
      break;

    case 'get-suggestions':
      result = getImprovementSuggestions();
      break;

    case 'report':
      const reportOptions = JSON.parse(args[1] || '{}');
      result = generateSummaryReport(reportOptions);
      break;

    default:
      result = {
        usage: 'node feedback-loop.js <command> [args]',
        commands: [
          'record-metric <json-metrics>',
          'record-learning <json-event>',
          'validate-learning <event-id> <json-validation>',
          'generate-suggestions',
          'get-suggestions',
          'report [json-options]'
        ],
        learningEventTypes: LEARNING_EVENT_TYPES
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

// 모듈 내보내기
module.exports = {
  recordExecutionMetrics,
  recordLearningEvent,
  validateLearningEvent,
  generateImprovementSuggestions,
  getImprovementSuggestions,
  generateSummaryReport,
  LEARNING_EVENT_TYPES
};
