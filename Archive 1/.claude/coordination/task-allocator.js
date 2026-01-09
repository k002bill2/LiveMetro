/**
 * Task Allocator for ACE Framework
 * 작업 분배, 동적 재할당, 진행 모니터링, Manager Agent Routing
 *
 * @version 4.0.0-KiiPS (Manager Agents 지원)
 * @layer Layer 4 (Executive Function) & Layer 4.5 (Manager Orchestration)
 */

const fs = require('fs');
const path = require('path');

// 설정 경로
const ALLOCATION_STATE_PATH = path.join(__dirname, '../ace-framework/allocation-state.json');
const AGENT_MODEL_PATH = path.join(__dirname, '../ace-framework/layer3-agent-model.json');
const ACE_CONFIG_PATH = path.join(__dirname, '../ace-framework/ace-config.json');

// 기본 설정
const CONFIG = {
  monitoringInterval: 30000, // 30초
  deviationThreshold: 0.3, // 30%
  maxConcurrentAgents: 3,
  taskTimeout: 600000, // 10분
  enableManagerAgents: true, // featureFlags에서 로드
  managerRoutingMode: 'domain-first' // featureFlags에서 로드
};

/**
 * ACE Framework 설정 로드
 */
function loadAceConfig() {
  try {
    if (fs.existsSync(ACE_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(ACE_CONFIG_PATH, 'utf8'));

      // featureFlags를 CONFIG에 병합
      if (config.featureFlags) {
        CONFIG.enableManagerAgents = config.featureFlags.enableManagerAgents !== false;
        CONFIG.managerRoutingMode = config.featureFlags.managerRoutingMode || 'domain-first';
      }

      return config;
    }
  } catch (error) {
    console.error('[TaskAllocator] Error loading ACE config:', error.message);
  }
  return null;
}

/**
 * 에이전트 모델 로드
 */
function loadAgentModel() {
  try {
    if (fs.existsSync(AGENT_MODEL_PATH)) {
      return JSON.parse(fs.readFileSync(AGENT_MODEL_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('[TaskAllocator] Error loading agent model:', error.message);
  }
  return null;
}

/**
 * 할당 상태 로드
 */
function loadAllocationState() {
  try {
    if (fs.existsSync(ALLOCATION_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(ALLOCATION_STATE_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('[TaskAllocator] Error loading allocation state:', error.message);
  }
  return {
    executions: [],
    currentExecution: null,
    history: []
  };
}

/**
 * 할당 상태 저장
 */
function saveAllocationState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(ALLOCATION_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Manager Agent 라우팅 (Layer 4.5)
 *
 * taskType을 분석하여 적절한 Manager Agent에 라우팅
 *
 * @param {string} taskType 작업 유형
 * @returns {string|null} Manager ID 또는 null (Manager 미사용)
 */
function routeToManager(taskType) {
  // featureFlags 확인
  if (!CONFIG.enableManagerAgents) {
    return null;
  }

  // taskType → Manager 매핑
  const managerRouting = {
    // Build Manager
    'service_build': 'build-manager',
    'multi_service_build': 'build-manager',

    // Deployment Manager
    'service_deploy': 'deployment-manager',
    'api_testing': 'deployment-manager',
    'log_analysis': 'deployment-manager',

    // Feature Manager
    'feature_development': 'feature-manager',

    // UI Manager
    'ui_component_creation': 'ui-manager',
    'ui_validation': 'ui-manager',
    'responsive_validation': 'ui-manager',
    'accessibility_check': 'ui-manager'
  };

  return managerRouting[taskType] || null;
}

/**
 * 작업 분해 (Task Decomposition)
 *
 * @param {Object} request 작업 요청
 * @param {string} request.taskType 작업 유형
 * @param {Object} request.parameters 작업 파라미터
 * @param {string} request.initiatedBy 요청자 (user/agent)
 * @returns {Object} 분해된 작업 목록
 */
function decomposeTask(request) {
  const { taskType, parameters = {}, initiatedBy = 'user' } = request;

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const timestamp = Date.now();

  let subtasks = [];

  // 작업 유형별 분해 템플릿
  switch (taskType) {
    case 'service_build':
      subtasks = generateServiceBuildTasks(parameters);
      break;

    case 'multi_service_build':
      subtasks = generateMultiServiceBuildTasks(parameters);
      break;

    case 'service_deploy':
      subtasks = generateServiceDeployTasks(parameters);
      break;

    case 'feature_development':
      subtasks = generateFeatureDevelopmentTasks(parameters);
      break;

    case 'api_testing':
      subtasks = generateApiTestingTasks(parameters);
      break;

    case 'log_analysis':
      subtasks = generateLogAnalysisTasks(parameters);
      break;

    default:
      subtasks = [{
        taskId: `t_${timestamp}_1`,
        name: 'Generic Task',
        type: 'generic',
        status: 'pending',
        agent: null,
        dependencies: [],
        estimatedTime: 60000
      }];
  }

  // Manager Agent 라우팅 (Layer 4.5)
  const manager = routeToManager(taskType);

  // 실행 계획 생성
  const execution = {
    executionId,
    taskType,
    parameters,
    initiatedBy,
    timestamp,
    status: 'planned',
    subtasks,
    progress: 0,
    estimatedTotalTime: subtasks.reduce((sum, t) => sum + (t.estimatedTime || 60000), 0),
    parallelGroups: identifyParallelGroups(subtasks),
    // Manager routing 정보 (Layer 4.5)
    manager: manager,
    delegationDepth: manager ? 'primary->manager->worker' : 'primary->worker',
    managerRoutingMode: CONFIG.managerRoutingMode
  };

  // 상태 저장
  const state = loadAllocationState();
  state.currentExecution = execution;
  saveAllocationState(state);

  return {
    success: true,
    execution: {
      executionId,
      taskType,
      subtaskCount: subtasks.length,
      parallelGroupCount: execution.parallelGroups.length,
      estimatedTotalTime: execution.estimatedTotalTime,
      // Manager routing 정보 (Layer 4.5)
      manager: execution.manager,
      delegationDepth: execution.delegationDepth,
      managerRoutingMode: execution.managerRoutingMode,
      subtasks: subtasks.map(t => ({
        taskId: t.taskId,
        name: t.name,
        agent: t.agent,
        dependencies: t.dependencies,
        estimatedTime: t.estimatedTime
      }))
    }
  };
}

/**
 * 서비스 빌드 작업 분해
 */
function generateServiceBuildTasks(params) {
  const { serviceName, skipTests = true } = params;
  const timestamp = Date.now();

  return [
    {
      taskId: `t_${timestamp}_1`,
      name: 'SVN Update',
      type: 'vcs_update',
      agent: 'kiips-developer',
      skill: null,
      command: 'svn up',
      dependencies: [],
      status: 'pending',
      estimatedTime: 30000
    },
    {
      taskId: `t_${timestamp}_2`,
      name: `Build ${serviceName}`,
      type: 'maven_build',
      agent: 'kiips-developer',
      skill: 'kiips-maven-builder',
      command: `cd KiiPS-HUB && mvn clean package -pl :${serviceName} -am ${skipTests ? '-DskipTests=true' : ''}`,
      dependencies: [`t_${timestamp}_1`],
      status: 'pending',
      estimatedTime: 180000
    },
    {
      taskId: `t_${timestamp}_3`,
      name: 'Verify Build Artifacts',
      type: 'verification',
      agent: 'checklist-generator',
      skill: null,
      dependencies: [`t_${timestamp}_2`],
      status: 'pending',
      estimatedTime: 30000
    }
  ];
}

/**
 * 다중 서비스 빌드 작업 분해 (병렬)
 */
function generateMultiServiceBuildTasks(params) {
  const { services = [], skipTests = true } = params;
  const timestamp = Date.now();

  const tasks = [
    {
      taskId: `t_${timestamp}_0`,
      name: 'Build Common Modules',
      type: 'maven_build',
      agent: 'primary-coordinator',
      skill: 'kiips-maven-builder',
      command: 'cd KiiPS-HUB && mvn clean install -pl :KiiPS-COMMON,:KiiPS-UTILS -am',
      dependencies: [],
      status: 'pending',
      estimatedTime: 120000,
      priority: 'critical'
    }
  ];

  // 각 서비스별 빌드 (병렬 가능)
  services.forEach((serviceName, index) => {
    tasks.push({
      taskId: `t_${timestamp}_${index + 1}`,
      name: `Build ${serviceName}`,
      type: 'maven_build',
      agent: `secondary_${String.fromCharCode(97 + (index % 3))}`, // secondary_a, b, c
      skill: 'kiips-maven-builder',
      command: `cd KiiPS-HUB && mvn clean package -pl :${serviceName} ${skipTests ? '-DskipTests=true' : ''}`,
      dependencies: [`t_${timestamp}_0`],
      parallelGroup: 'services',
      status: 'pending',
      estimatedTime: 120000
    });
  });

  // 통합 검증
  tasks.push({
    taskId: `t_${timestamp}_${services.length + 1}`,
    name: 'Integration Verification',
    type: 'verification',
    agent: 'primary-coordinator',
    skill: null,
    dependencies: services.map((_, i) => `t_${timestamp}_${i + 1}`),
    status: 'pending',
    estimatedTime: 60000
  });

  return tasks;
}

/**
 * 서비스 배포 작업 분해
 */
function generateServiceDeployTasks(params) {
  const { serviceName, environment = 'staging' } = params;
  const timestamp = Date.now();

  return [
    {
      taskId: `t_${timestamp}_1`,
      name: 'Pre-deployment Check',
      type: 'verification',
      agent: 'checklist-generator',
      dependencies: [],
      status: 'pending',
      estimatedTime: 30000
    },
    {
      taskId: `t_${timestamp}_2`,
      name: `Stop ${serviceName}`,
      type: 'service_stop',
      agent: 'primary-coordinator',
      skill: 'kiips-service-deployer',
      command: `cd ${serviceName} && ./stop.sh`,
      dependencies: [`t_${timestamp}_1`],
      status: 'pending',
      estimatedTime: 15000
    },
    {
      taskId: `t_${timestamp}_3`,
      name: `Start ${serviceName}`,
      type: 'service_start',
      agent: 'primary-coordinator',
      skill: 'kiips-service-deployer',
      command: `cd ${serviceName} && ./start.sh`,
      dependencies: [`t_${timestamp}_2`],
      status: 'pending',
      estimatedTime: 30000
    },
    {
      taskId: `t_${timestamp}_4`,
      name: 'Health Check',
      type: 'api_test',
      agent: 'kiips-developer',
      skill: 'kiips-api-tester',
      dependencies: [`t_${timestamp}_3`],
      status: 'pending',
      estimatedTime: 30000
    },
    {
      taskId: `t_${timestamp}_5`,
      name: 'Log Verification',
      type: 'log_analysis',
      agent: 'kiips-developer',
      skill: 'kiips-log-analyzer',
      dependencies: [`t_${timestamp}_4`],
      parallelWith: `t_${timestamp}_6`,
      status: 'pending',
      estimatedTime: 30000
    },
    {
      taskId: `t_${timestamp}_6`,
      name: 'Deployment Checklist',
      type: 'checklist',
      agent: 'checklist-generator',
      dependencies: [`t_${timestamp}_4`],
      parallelWith: `t_${timestamp}_5`,
      status: 'pending',
      estimatedTime: 30000
    }
  ];
}

/**
 * 기능 개발 작업 분해
 */
function generateFeatureDevelopmentTasks(params) {
  const { featureName, targetModule } = params;
  const timestamp = Date.now();

  return [
    {
      taskId: `t_${timestamp}_1`,
      name: 'Requirements Analysis',
      type: 'analysis',
      agent: 'primary-coordinator',
      skill: 'kiips-feature-planner',
      dependencies: [],
      status: 'pending',
      estimatedTime: 180000
    },
    {
      taskId: `t_${timestamp}_2`,
      name: 'Architecture Review',
      type: 'review',
      agent: 'kiips-architect',
      dependencies: [`t_${timestamp}_1`],
      status: 'pending',
      estimatedTime: 300000
    },
    {
      taskId: `t_${timestamp}_3`,
      name: 'Implementation',
      type: 'development',
      agent: 'kiips-developer',
      dependencies: [`t_${timestamp}_2`],
      status: 'pending',
      estimatedTime: 'varies'
    },
    {
      taskId: `t_${timestamp}_4`,
      name: 'Code Review',
      type: 'review',
      agent: 'checklist-generator',
      dependencies: [`t_${timestamp}_3`],
      parallelWith: `t_${timestamp}_5`,
      status: 'pending',
      estimatedTime: 120000
    },
    {
      taskId: `t_${timestamp}_5`,
      name: 'Testing',
      type: 'testing',
      agent: 'kiips-developer',
      skill: 'kiips-api-tester',
      dependencies: [`t_${timestamp}_3`],
      parallelWith: `t_${timestamp}_4`,
      status: 'pending',
      estimatedTime: 180000
    },
    {
      taskId: `t_${timestamp}_6`,
      name: 'Integration',
      type: 'integration',
      agent: 'primary-coordinator',
      skill: 'kiips-service-deployer',
      dependencies: [`t_${timestamp}_4`, `t_${timestamp}_5`],
      status: 'pending',
      estimatedTime: 120000
    }
  ];
}

/**
 * API 테스트 작업 분해
 */
function generateApiTestingTasks(params) {
  const { serviceName, endpoints = [] } = params;
  const timestamp = Date.now();

  return [
    {
      taskId: `t_${timestamp}_1`,
      name: `Test ${serviceName} APIs`,
      type: 'api_test',
      agent: 'kiips-developer',
      skill: 'kiips-api-tester',
      testEndpoints: endpoints,
      dependencies: [],
      status: 'pending',
      estimatedTime: 120000
    },
    {
      taskId: `t_${timestamp}_2`,
      name: 'Generate Test Report',
      type: 'reporting',
      agent: 'checklist-generator',
      dependencies: [`t_${timestamp}_1`],
      status: 'pending',
      estimatedTime: 30000
    }
  ];
}

/**
 * 로그 분석 작업 분해
 */
function generateLogAnalysisTasks(params) {
  const { serviceName, patterns = ['ERROR', 'Exception'] } = params;
  const timestamp = Date.now();

  return [
    {
      taskId: `t_${timestamp}_1`,
      name: `Analyze ${serviceName} Logs`,
      type: 'log_analysis',
      agent: 'kiips-developer',
      skill: 'kiips-log-analyzer',
      patterns,
      dependencies: [],
      status: 'pending',
      estimatedTime: 60000
    },
    {
      taskId: `t_${timestamp}_2`,
      name: 'Generate Analysis Report',
      type: 'reporting',
      agent: 'checklist-generator',
      dependencies: [`t_${timestamp}_1`],
      status: 'pending',
      estimatedTime: 30000
    }
  ];
}

/**
 * 병렬 그룹 식별
 */
function identifyParallelGroups(tasks) {
  const groups = [];
  const grouped = new Set();

  for (const task of tasks) {
    if (grouped.has(task.taskId)) continue;

    if (task.parallelGroup) {
      const groupTasks = tasks.filter(t => t.parallelGroup === task.parallelGroup);
      groups.push({
        name: task.parallelGroup,
        taskIds: groupTasks.map(t => t.taskId)
      });
      groupTasks.forEach(t => grouped.add(t.taskId));
    } else if (task.parallelWith) {
      const parallelTask = tasks.find(t => t.taskId === task.parallelWith);
      if (parallelTask && !grouped.has(parallelTask.taskId)) {
        groups.push({
          name: 'parallel',
          taskIds: [task.taskId, parallelTask.taskId]
        });
        grouped.add(task.taskId);
        grouped.add(parallelTask.taskId);
      }
    }
  }

  return groups;
}

/**
 * 에이전트 할당 (Capability Matching)
 */
function assignAgent(task) {
  const agentModel = loadAgentModel();
  if (!agentModel) {
    return { success: false, error: 'Agent model not loaded' };
  }

  // 이미 할당된 경우
  if (task.agent) {
    return { success: true, agent: task.agent, source: 'predefined' };
  }

  // 작업 유형별 최적 에이전트 매칭
  const taskTypeMapping = agentModel.capability_matching?.task_types || {};
  const taskConfig = taskTypeMapping[task.type];

  if (taskConfig) {
    return {
      success: true,
      agent: taskConfig.primary_agent,
      skill: taskConfig.required_skill,
      capabilityMatch: taskConfig.min_capability_match,
      source: 'capability_matching'
    };
  }

  // 기본값
  return {
    success: true,
    agent: 'kiips-developer',
    source: 'default'
  };
}

/**
 * 진행 상태 업데이트
 */
function updateTaskProgress(taskId, update) {
  const state = loadAllocationState();

  if (!state.currentExecution) {
    return { success: false, error: 'No active execution' };
  }

  const task = state.currentExecution.subtasks.find(t => t.taskId === taskId);
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // 업데이트 적용
  Object.assign(task, {
    ...update,
    lastUpdated: Date.now()
  });

  // 전체 진행률 계산
  const completed = state.currentExecution.subtasks.filter(t => t.status === 'completed').length;
  const total = state.currentExecution.subtasks.length;
  state.currentExecution.progress = Math.round((completed / total) * 100);

  // 전체 상태 업데이트
  if (state.currentExecution.subtasks.every(t => t.status === 'completed')) {
    state.currentExecution.status = 'completed';
    state.currentExecution.completedAt = Date.now();
  } else if (state.currentExecution.subtasks.some(t => t.status === 'failed')) {
    state.currentExecution.status = 'failed';
  } else if (state.currentExecution.subtasks.some(t => t.status === 'in_progress')) {
    state.currentExecution.status = 'in_progress';
  }

  saveAllocationState(state);

  return {
    success: true,
    task: {
      taskId: task.taskId,
      status: task.status,
      progress: task.progress
    },
    executionProgress: state.currentExecution.progress,
    executionStatus: state.currentExecution.status
  };
}

/**
 * 동적 재할당 검사
 */
function checkForReallocation() {
  const state = loadAllocationState();

  if (!state.currentExecution || state.currentExecution.status !== 'in_progress') {
    return { needsReallocation: false };
  }

  const now = Date.now();
  const reallocationCandidates = [];

  for (const task of state.currentExecution.subtasks) {
    if (task.status !== 'in_progress') continue;

    // 시간 초과 검사
    const elapsed = now - (task.startedAt || now);
    const expectedTime = task.estimatedTime || 60000;
    const deviation = (elapsed - expectedTime) / expectedTime;

    if (deviation > CONFIG.deviationThreshold) {
      reallocationCandidates.push({
        taskId: task.taskId,
        currentAgent: task.agent,
        deviation: Math.round(deviation * 100),
        reason: 'time_deviation',
        elapsed,
        expected: expectedTime
      });
    }

    // 차단 상태 검사
    if (task.blocked) {
      reallocationCandidates.push({
        taskId: task.taskId,
        currentAgent: task.agent,
        reason: 'blocked',
        blockedReason: task.blockedReason
      });
    }
  }

  return {
    needsReallocation: reallocationCandidates.length > 0,
    candidates: reallocationCandidates
  };
}

/**
 * 현재 실행 상태 조회
 */
function getExecutionStatus() {
  const state = loadAllocationState();

  if (!state.currentExecution) {
    return { hasExecution: false };
  }

  const exec = state.currentExecution;

  return {
    hasExecution: true,
    execution: {
      executionId: exec.executionId,
      taskType: exec.taskType,
      status: exec.status,
      progress: exec.progress,
      startedAt: exec.startedAt,
      estimatedTotalTime: exec.estimatedTotalTime,
      manager: exec.manager,
      delegationDepth: exec.delegationDepth,
      subtasks: exec.subtasks.map(t => ({
        taskId: t.taskId,
        name: t.name,
        agent: t.agent,
        status: t.status,
        progress: t.progress || 0
      }))
    }
  };
}

/**
 * Manager 진행 상황 업데이트 (Layer 4.5)
 *
 * 여러 Worker의 진행 상황을 집계하여 Manager의 전체 진행률을 계산
 *
 * @param {string} managerId Manager Agent ID
 * @param {Array} workerUpdates Worker 업데이트 배열 [{workerId, taskId, status, progress}]
 * @returns {Object} 집계된 Manager 진행 상황
 */
function updateManagerProgress(managerId, workerUpdates) {
  const state = loadAllocationState();

  if (!state.currentExecution) {
    return { success: false, error: 'No active execution' };
  }

  if (state.currentExecution.manager !== managerId) {
    return {
      success: false,
      error: `Manager mismatch: expected ${state.currentExecution.manager}, got ${managerId}`
    };
  }

  // Worker 업데이트를 subtask에 반영
  let updatedCount = 0;
  for (const update of workerUpdates) {
    const task = state.currentExecution.subtasks.find(t => t.taskId === update.taskId);
    if (task) {
      Object.assign(task, {
        status: update.status,
        progress: update.progress,
        workerId: update.workerId,
        lastUpdated: Date.now()
      });
      updatedCount++;
    }
  }

  // Manager 전체 진행률 계산 (집계)
  const totalTasks = state.currentExecution.subtasks.length;
  const completedTasks = state.currentExecution.subtasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = state.currentExecution.subtasks.filter(t => t.status === 'in_progress');

  // 가중 평균으로 진행률 계산
  let totalProgress = completedTasks * 100; // 완료된 작업은 100%
  for (const task of inProgressTasks) {
    totalProgress += (task.progress || 0);
  }

  const managerProgress = Math.round(totalProgress / totalTasks);

  // 전체 실행 상태 업데이트
  state.currentExecution.progress = managerProgress;

  if (completedTasks === totalTasks) {
    state.currentExecution.status = 'completed';
    state.currentExecution.completedAt = Date.now();
  } else if (state.currentExecution.subtasks.some(t => t.status === 'failed')) {
    state.currentExecution.status = 'failed';
  } else if (inProgressTasks.length > 0) {
    state.currentExecution.status = 'in_progress';
  }

  // 상태 저장
  saveAllocationState(state);

  return {
    success: true,
    managerId,
    managerProgress,
    executionStatus: state.currentExecution.status,
    updatedTasksCount: updatedCount,
    breakdown: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks.length,
      pending: state.currentExecution.subtasks.filter(t => t.status === 'pending').length,
      failed: state.currentExecution.subtasks.filter(t => t.status === 'failed').length
    }
  };
}

// 초기화 시 ACE config 로드
loadAceConfig();

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  let result;

  switch (command) {
    case 'decompose':
      const decomposeRequest = JSON.parse(args[1] || '{}');
      result = decomposeTask(decomposeRequest);
      break;

    case 'assign':
      const task = JSON.parse(args[1] || '{}');
      result = assignAgent(task);
      break;

    case 'update':
      const taskId = args[1];
      const update = JSON.parse(args[2] || '{}');
      result = updateTaskProgress(taskId, update);
      break;

    case 'manager-progress':
      const managerId = args[1];
      const workerUpdates = JSON.parse(args[2] || '[]');
      result = updateManagerProgress(managerId, workerUpdates);
      break;

    case 'check-reallocation':
      result = checkForReallocation();
      break;

    case 'status':
      result = getExecutionStatus();
      break;

    case 'route':
      const taskTypeToRoute = args[1];
      const manager = routeToManager(taskTypeToRoute);
      result = {
        taskType: taskTypeToRoute,
        manager: manager || 'none (direct to secondary)',
        delegationDepth: manager ? 'primary->manager->worker' : 'primary->worker'
      };
      break;

    default:
      result = {
        usage: 'node task-allocator.js <command> [args]',
        commands: [
          'decompose <json-request>',
          'assign <json-task>',
          'update <task-id> <json-update>',
          'manager-progress <manager-id> <json-worker-updates>',
          'check-reallocation',
          'status',
          'route <task-type>'
        ],
        taskTypes: [
          'service_build',
          'multi_service_build',
          'service_deploy',
          'feature_development',
          'ui_component_creation',
          'ui_validation',
          'api_testing',
          'log_analysis'
        ],
        managerAgents: [
          'build-manager',
          'deployment-manager',
          'feature-manager',
          'ui-manager'
        ]
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

/**
 * 작업 할당 (allocateTask)
 * decomposeTask의 별칭 - 테스트 및 외부 호출용
 *
 * @param {Object} request 작업 요청
 * @returns {Object} 할당 결과
 */
function allocateTask(request) {
  return decomposeTask(request);
}

// 모듈 내보내기
module.exports = {
  allocateTask,
  decomposeTask,
  assignAgent,
  updateTaskProgress,
  updateManagerProgress, // Layer 4.5
  checkForReallocation,
  getExecutionStatus,
  routeToManager, // Layer 4.5
  loadAceConfig,
  CONFIG
};
