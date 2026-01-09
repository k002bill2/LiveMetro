/**
 * Manager Coordinator for ACE Framework
 * Manager Agent가 Worker를 조정하기 위한 유틸리티 함수
 *
 * @version 1.0.0-KiiPS
 * @layer Layer 4.5 (Manager Orchestration)
 */

const fs = require('fs');
const path = require('path');

// 설정 경로
const MANAGER_STATE_PATH = path.join(__dirname, '../ace-framework/manager-state.json');
const ALLOCATION_STATE_PATH = path.join(__dirname, '../ace-framework/allocation-state.json');

/**
 * Manager 상태 로드
 */
function loadManagerState() {
  try {
    if (fs.existsSync(MANAGER_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(MANAGER_STATE_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('[ManagerCoordinator] Error loading manager state:', error.message);
  }
  return {
    activeManagers: {},
    workerAssignments: {},
    escalationHistory: []
  };
}

/**
 * Manager 상태 저장
 */
function saveManagerState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MANAGER_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Worker 할당 (Manager → Workers)
 *
 * Manager가 subtasks를 분석하여 적절한 Worker에게 할당
 *
 * @param {string} managerId Manager Agent ID
 * @param {Array} subtasks Subtask 목록
 * @returns {Object} Worker 할당 결과
 */
function assignWorkers(managerId, subtasks) {
  const state = loadManagerState();

  if (!state.activeManagers[managerId]) {
    state.activeManagers[managerId] = {
      managerId,
      startedAt: Date.now(),
      assignedWorkers: [],
      subtaskCount: 0
    };
  }

  const assignments = [];

  for (const subtask of subtasks) {
    // Subtask에 이미 agent가 지정된 경우 해당 agent 사용
    const workerId = subtask.agent || 'kiips-developer'; // 기본값

    // Worker 할당 기록
    const assignment = {
      managerId,
      workerId,
      taskId: subtask.taskId,
      taskName: subtask.name,
      assignedAt: Date.now(),
      status: 'assigned'
    };

    assignments.push(assignment);

    // Manager 상태 업데이트
    if (!state.activeManagers[managerId].assignedWorkers.includes(workerId)) {
      state.activeManagers[managerId].assignedWorkers.push(workerId);
    }

    // Worker 할당 추적
    if (!state.workerAssignments[workerId]) {
      state.workerAssignments[workerId] = [];
    }

    state.workerAssignments[workerId].push({
      managerId,
      taskId: subtask.taskId,
      taskName: subtask.name,
      assignedAt: Date.now()
    });
  }

  state.activeManagers[managerId].subtaskCount = subtasks.length;
  saveManagerState(state);

  return {
    success: true,
    managerId,
    assignmentCount: assignments.length,
    uniqueWorkers: state.activeManagers[managerId].assignedWorkers.length,
    assignments: assignments.map(a => ({
      taskId: a.taskId,
      workerId: a.workerId,
      taskName: a.taskName
    }))
  };
}

/**
 * Worker에게 메시지 브로드캐스트
 *
 * Manager가 여러 Worker에게 동시에 메시지를 전송
 *
 * @param {string} managerId Manager Agent ID
 * @param {Array<string>} workerIds Worker ID 목록
 * @param {string} message 전송할 메시지
 * @returns {Object} 브로드캐스트 결과
 */
function broadcastToWorkers(managerId, workerIds, message) {
  const timestamp = Date.now();

  // 실제 구현에서는 메시지를 각 Worker에게 전송
  // 여기서는 브로드캐스트 기록만 저장
  const broadcast = {
    managerId,
    workerIds,
    message,
    timestamp,
    status: 'sent'
  };

  return {
    success: true,
    broadcast: {
      managerId,
      recipientCount: workerIds.length,
      recipients: workerIds,
      message: message.substring(0, 100), // 메시지 요약
      timestamp
    }
  };
}

/**
 * Worker 결과 집계
 *
 * 여러 Worker의 작업 결과를 집계하여 Manager 레벨 결과 생성
 *
 * @param {string} managerId Manager Agent ID
 * @param {Array} workerResults Worker 결과 배열 [{workerId, taskId, status, result, error}]
 * @returns {Object} 집계된 결과
 */
function aggregateWorkerResults(managerId, workerResults) {
  const aggregation = {
    managerId,
    totalTasks: workerResults.length,
    completedTasks: 0,
    failedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    overallStatus: 'unknown',
    results: [],
    errors: []
  };

  // 상태별 카운트
  for (const workerResult of workerResults) {
    switch (workerResult.status) {
      case 'completed':
        aggregation.completedTasks++;
        if (workerResult.result) {
          aggregation.results.push({
            workerId: workerResult.workerId,
            taskId: workerResult.taskId,
            result: workerResult.result
          });
        }
        break;

      case 'failed':
        aggregation.failedTasks++;
        if (workerResult.error) {
          aggregation.errors.push({
            workerId: workerResult.workerId,
            taskId: workerResult.taskId,
            error: workerResult.error
          });
        }
        break;

      case 'in_progress':
        aggregation.inProgressTasks++;
        break;

      case 'pending':
        aggregation.pendingTasks++;
        break;
    }
  }

  // 전체 상태 결정
  if (aggregation.failedTasks > 0) {
    aggregation.overallStatus = 'failed';
  } else if (aggregation.completedTasks === aggregation.totalTasks) {
    aggregation.overallStatus = 'completed';
  } else if (aggregation.inProgressTasks > 0) {
    aggregation.overallStatus = 'in_progress';
  } else {
    aggregation.overallStatus = 'pending';
  }

  // 진행률 계산
  aggregation.progressPercentage = aggregation.totalTasks > 0
    ? Math.round((aggregation.completedTasks / aggregation.totalTasks) * 100)
    : 0;

  return {
    success: true,
    aggregation
  };
}

/**
 * Worker 실패 처리
 *
 * Worker가 실패했을 때 Manager가 취할 조치 결정
 *
 * @param {string} managerId Manager Agent ID
 * @param {string} workerId Worker Agent ID
 * @param {Object} error 에러 정보
 * @returns {Object} 처리 결과
 */
function handleWorkerFailure(managerId, workerId, error) {
  const state = loadManagerState();
  const timestamp = Date.now();

  // Worker 실패 기록
  const failureRecord = {
    managerId,
    workerId,
    error: error.message || error,
    timestamp,
    action: 'retry' // 기본 액션: 재시도
  };

  // Worker의 이전 실패 횟수 확인
  const workerAssignments = state.workerAssignments[workerId] || [];
  const failureCount = workerAssignments.filter(a => a.status === 'failed').length;

  if (failureCount >= 2) {
    // 2회 이상 실패 시 다른 Worker에게 재할당
    failureRecord.action = 'reassign';
    failureRecord.recommendation = `Worker ${workerId} failed ${failureCount + 1} times. Recommend reassigning to different worker.`;
  } else {
    // 첫 실패는 재시도
    failureRecord.action = 'retry';
    failureRecord.recommendation = `Retry with same worker. Failure count: ${failureCount + 1}`;
  }

  // 치명적 에러인 경우 Primary에게 에스컬레이션
  if (error.critical || error.severity === 'critical') {
    failureRecord.action = 'escalate';
    failureRecord.recommendation = 'Critical error detected. Escalate to Primary Coordinator.';
  }

  saveManagerState(state);

  return {
    success: true,
    managerId,
    workerId,
    failureRecord,
    action: failureRecord.action,
    shouldEscalate: failureRecord.action === 'escalate'
  };
}

/**
 * Primary Coordinator에게 에스컬레이션
 *
 * Manager가 처리할 수 없는 상황을 Primary에게 보고
 *
 * @param {string} managerId Manager Agent ID
 * @param {string} reason 에스컬레이션 이유
 * @param {Object} context 컨텍스트 정보
 * @returns {Object} 에스컬레이션 결과
 */
function escalateToPrimary(managerId, reason, context = {}) {
  const state = loadManagerState();
  const timestamp = Date.now();

  // 에스컬레이션 기록
  const escalation = {
    escalationId: `esc_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
    managerId,
    reason,
    context,
    timestamp,
    status: 'escalated'
  };

  state.escalationHistory.push(escalation);

  // 에스컬레이션 히스토리는 최대 50개까지 유지
  if (state.escalationHistory.length > 50) {
    state.escalationHistory = state.escalationHistory.slice(-50);
  }

  saveManagerState(state);

  // 실제 구현에서는 Primary Coordinator에게 메시지 전송
  // 여기서는 에스컬레이션 객체 반환

  return {
    success: true,
    escalation: {
      escalationId: escalation.escalationId,
      managerId,
      reason,
      timestamp,
      message: `Manager ${managerId} escalated to Primary: ${reason}`,
      context: {
        ...context,
        managerState: state.activeManagers[managerId] || null
      }
    }
  };
}

/**
 * Manager 작업 완료 처리
 *
 * Manager의 작업이 완료되면 상태를 정리
 *
 * @param {string} managerId Manager Agent ID
 * @returns {Object} 완료 처리 결과
 */
function completeManagerWorkflow(managerId) {
  const state = loadManagerState();

  if (!state.activeManagers[managerId]) {
    return {
      success: false,
      error: 'MANAGER_NOT_FOUND',
      message: `Manager ${managerId} not found in active managers`
    };
  }

  const managerInfo = state.activeManagers[managerId];
  const duration = Date.now() - managerInfo.startedAt;

  // Manager 상태 제거
  delete state.activeManagers[managerId];

  // Worker 할당 정리
  for (const workerId of managerInfo.assignedWorkers || []) {
    if (state.workerAssignments[workerId]) {
      state.workerAssignments[workerId] = state.workerAssignments[workerId].filter(
        a => a.managerId !== managerId
      );

      // Worker 할당이 비어있으면 제거
      if (state.workerAssignments[workerId].length === 0) {
        delete state.workerAssignments[workerId];
      }
    }
  }

  saveManagerState(state);

  return {
    success: true,
    managerId,
    duration,
    subtaskCount: managerInfo.subtaskCount,
    workerCount: managerInfo.assignedWorkers?.length || 0,
    message: `Manager ${managerId} workflow completed in ${Math.round(duration / 1000)}s`
  };
}

/**
 * 현재 Manager 상태 조회
 *
 * @returns {Object} 현재 Manager 상태
 */
function getManagerStatus() {
  const state = loadManagerState();

  return {
    timestamp: Date.now(),
    activeManagerCount: Object.keys(state.activeManagers).length,
    activeManagers: Object.keys(state.activeManagers).map(managerId => ({
      managerId,
      workerCount: state.activeManagers[managerId].assignedWorkers?.length || 0,
      subtaskCount: state.activeManagers[managerId].subtaskCount || 0,
      age: Date.now() - state.activeManagers[managerId].startedAt
    })),
    activeWorkerCount: Object.keys(state.workerAssignments).length,
    activeWorkers: Object.keys(state.workerAssignments).map(workerId => ({
      workerId,
      assignmentCount: state.workerAssignments[workerId].length,
      managers: [...new Set(state.workerAssignments[workerId].map(a => a.managerId))]
    })),
    recentEscalations: state.escalationHistory.slice(-10).reverse()
  };
}

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  let result;

  switch (command) {
    case 'assign':
      const assignRequest = JSON.parse(args[1] || '{}');
      result = assignWorkers(assignRequest.managerId, assignRequest.subtasks || []);
      break;

    case 'broadcast':
      const broadcastRequest = JSON.parse(args[1] || '{}');
      result = broadcastToWorkers(
        broadcastRequest.managerId,
        broadcastRequest.workerIds || [],
        broadcastRequest.message || ''
      );
      break;

    case 'aggregate':
      const aggregateRequest = JSON.parse(args[1] || '{}');
      result = aggregateWorkerResults(
        aggregateRequest.managerId,
        aggregateRequest.workerResults || []
      );
      break;

    case 'handle-failure':
      const failureRequest = JSON.parse(args[1] || '{}');
      result = handleWorkerFailure(
        failureRequest.managerId,
        failureRequest.workerId,
        failureRequest.error || {}
      );
      break;

    case 'escalate':
      const escalateRequest = JSON.parse(args[1] || '{}');
      result = escalateToPrimary(
        escalateRequest.managerId,
        escalateRequest.reason || 'unspecified',
        escalateRequest.context || {}
      );
      break;

    case 'complete':
      const managerId = args[1];
      result = completeManagerWorkflow(managerId);
      break;

    case 'status':
      result = getManagerStatus();
      break;

    default:
      result = {
        usage: 'node manager-coordinator.js <command> [json-args]',
        commands: [
          'assign <json-request>',
          'broadcast <json-request>',
          'aggregate <json-request>',
          'handle-failure <json-request>',
          'escalate <json-request>',
          'complete <manager-id>',
          'status'
        ],
        examples: [
          'assign \'{"managerId": "build-manager", "subtasks": [...]}\'',
          'broadcast \'{"managerId": "deployment-manager", "workerIds": ["kiips-developer"], "message": "Start deployment"}\'',
          'aggregate \'{"managerId": "feature-manager", "workerResults": [...]}\'',
          'handle-failure \'{"managerId": "ui-manager", "workerId": "kiips-ui-designer", "error": {...}}\'',
          'escalate \'{"managerId": "deployment-manager", "reason": "health_check_failure", "context": {...}}\'',
          'complete build-manager',
          'status'
        ]
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

// 모듈 내보내기
module.exports = {
  assignWorkers,
  broadcastToWorkers,
  aggregateWorkerResults,
  handleWorkerFailure,
  escalateToPrimary,
  completeManagerWorkflow,
  getManagerStatus
};
