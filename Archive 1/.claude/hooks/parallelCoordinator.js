/**
 * Parallel Coordinator Hook for ACE Framework
 * Layer 5 (Cognitive Control) 병렬 작업 조정 Hook
 *
 * Task 도구 호출 시 락 획득, 충돌 감지, 진행 상태 추적을 담당합니다.
 *
 * @version 3.0.1-KiiPS
 * @layer Layer 5 (Cognitive Control)
 */

const fs = require('fs');
const path = require('path');

// ACE Framework 경로
const COORDINATION_DIR = path.join(__dirname, '../coordination');
const FILE_LOCK_MANAGER = path.join(COORDINATION_DIR, 'file-lock-manager.js');
const TASK_ALLOCATOR = path.join(COORDINATION_DIR, 'task-allocator.js');
const CHECKPOINT_MANAGER = path.join(COORDINATION_DIR, 'checkpoint-manager.js');

// 병렬 작업 상태 저장
const PARALLEL_STATE_PATH = path.join(__dirname, '../ace-framework/parallel-state.json');

/**
 * 병렬 작업 상태 구조
 */
const DEFAULT_PARALLEL_STATE = {
  activeAgents: [],
  taskQueue: [],
  activeLocks: [],
  lastUpdated: null,
  sessionId: null
};

/**
 * 병렬 상태 로드
 */
function loadParallelState() {
  try {
    if (fs.existsSync(PARALLEL_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(PARALLEL_STATE_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('[ParallelCoordinator] Error loading state:', error.message);
  }
  return { ...DEFAULT_PARALLEL_STATE, sessionId: generateSessionId() };
}

/**
 * 병렬 상태 저장
 */
function saveParallelState(state) {
  try {
    state.lastUpdated = new Date().toISOString();
    const dir = path.dirname(PARALLEL_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PARALLEL_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('[ParallelCoordinator] Error saving state:', error.message);
  }
}

/**
 * 세션 ID 생성
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Task 도구 호출 전 조정
 *
 * @param {object} event - Hook 이벤트
 * @returns {object} { decision: 'allow'|'block', modifiedInput?: object, message?: string }
 */
async function onTaskPreExecute(event) {
  const { tool_input } = event;
  const state = loadParallelState();

  const taskInfo = {
    taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    subagentType: tool_input.subagent_type,
    description: tool_input.description,
    prompt: tool_input.prompt,
    startTime: Date.now(),
    status: 'pending'
  };

  // 1. 대상 모듈 추출 (프롬프트에서)
  const targetModules = extractTargetModules(tool_input.prompt);

  // 2. 모듈별 락 획득 시도
  if (targetModules.length > 0) {
    const lockResult = await acquireModuleLocks(targetModules, taskInfo.taskId, tool_input.subagent_type);

    if (!lockResult.success) {
      return {
        decision: 'block',
        message: formatLockFailureMessage(lockResult)
      };
    }

    taskInfo.acquiredLocks = lockResult.acquiredLocks;
  }

  // 3. 충돌 감지
  const conflictCheck = detectPotentialConflicts(state, taskInfo);
  if (conflictCheck.hasConflict) {
    // 충돌이 있어도 경고만 표시하고 진행 (Primary가 나중에 병합)
    console.log(formatConflictWarning(conflictCheck));
  }

  // 4. 작업 큐에 추가
  state.activeAgents.push({
    taskId: taskInfo.taskId,
    agentType: tool_input.subagent_type,
    description: tool_input.description,
    startTime: taskInfo.startTime,
    targetModules,
    status: 'running'
  });

  saveParallelState(state);

  // 5. 수정된 입력 반환 (작업 ID 추가)
  const modifiedInput = {
    ...tool_input,
    prompt: injectCoordinationContext(tool_input.prompt, taskInfo)
  };

  return {
    decision: 'allow',
    modifiedInput,
    taskId: taskInfo.taskId
  };
}

/**
 * Task 도구 실행 후 정리
 *
 * @param {object} event - Hook 이벤트
 */
async function onTaskPostExecute(event) {
  const { task_id, success, result } = event;
  const state = loadParallelState();

  // 1. 작업 상태 업데이트
  const agentIndex = state.activeAgents.findIndex(a => a.taskId === task_id);
  if (agentIndex >= 0) {
    const agent = state.activeAgents[agentIndex];
    agent.status = success ? 'completed' : 'failed';
    agent.endTime = Date.now();
    agent.duration = agent.endTime - agent.startTime;

    // 완료된 작업은 제거
    state.activeAgents.splice(agentIndex, 1);
  }

  // 2. 락 해제
  await releaseModuleLocks(task_id);

  // 3. 진행 상태 로깅
  logTaskCompletion(task_id, success, result);

  // 4. 상태 저장
  saveParallelState(state);

  // 5. 체크포인트 생성 고려
  if (success) {
    await considerCheckpoint(event);
  }
}

/**
 * 프롬프트에서 대상 KiiPS 모듈 추출
 */
function extractTargetModules(prompt) {
  const modulePattern = /KiiPS-([A-Z]{2,10})/gi;
  const matches = prompt.match(modulePattern) || [];
  return [...new Set(matches.map(m => m.toUpperCase()))];
}

/**
 * 모듈 락 획득 시도
 */
async function acquireModuleLocks(modules, taskId, agentType) {
  const acquiredLocks = [];
  const failedLocks = [];

  try {
    // file-lock-manager 모듈 동적 로드
    if (fs.existsSync(FILE_LOCK_MANAGER)) {
      const lockManager = require(FILE_LOCK_MANAGER);

      for (const moduleName of modules) {
        const result = lockManager.acquireLock({
          agentId: agentType,
          module: moduleName,
          operation: 'write',
          estimatedDuration: 60000, // 1분
          purpose: `Task ${taskId}`
        });

        if (result.success) {
          acquiredLocks.push({
            module: moduleName,
            lockId: result.lockId
          });
        } else {
          failedLocks.push({
            module: moduleName,
            reason: result.error,
            heldBy: result.existingLock?.agentId,
            queuePosition: result.queuePosition
          });
        }
      }
    }
  } catch (error) {
    console.error('[ParallelCoordinator] Lock acquisition error:', error.message);
  }

  return {
    success: failedLocks.length === 0,
    acquiredLocks,
    failedLocks
  };
}

/**
 * 모듈 락 해제
 */
async function releaseModuleLocks(taskId) {
  try {
    if (fs.existsSync(FILE_LOCK_MANAGER)) {
      const lockManager = require(FILE_LOCK_MANAGER);
      const status = lockManager.getLockStatus();

      // 이 태스크가 보유한 락 찾기
      const tasksLocks = status.activeLocks.filter(lock =>
        lock.purpose && lock.purpose.includes(taskId)
      );

      for (const lock of tasksLocks) {
        lockManager.releaseLock({
          lockId: lock.lockId,
          agentId: lock.agentId
        });
      }
    }
  } catch (error) {
    console.error('[ParallelCoordinator] Lock release error:', error.message);
  }
}

/**
 * 잠재적 충돌 감지
 */
function detectPotentialConflicts(state, newTask) {
  const conflicts = [];

  for (const activeAgent of state.activeAgents) {
    // 같은 모듈을 대상으로 하는 작업 감지
    const overlappingModules = newTask.targetModules?.filter(m =>
      activeAgent.targetModules?.includes(m)
    ) || [];

    if (overlappingModules.length > 0) {
      conflicts.push({
        existingTask: activeAgent.taskId,
        existingAgent: activeAgent.agentType,
        overlappingModules,
        runningSince: Date.now() - activeAgent.startTime
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

/**
 * 조정 컨텍스트를 프롬프트에 주입
 */
function injectCoordinationContext(prompt, taskInfo) {
  const context = `
[PARALLEL COORDINATION CONTEXT]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task ID: ${taskInfo.taskId}
Start Time: ${new Date(taskInfo.startTime).toISOString()}
Target Modules: ${taskInfo.acquiredLocks?.map(l => l.module).join(', ') || 'None'}

**IMPORTANT**:
• 이 작업은 병렬 에이전트 중 하나입니다
• 다른 에이전트와 같은 파일을 수정하지 마세요
• 완료 시 결과를 명확히 보고하세요
• 충돌 발생 시 Primary Coordinator에게 알리세요
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
  return context + prompt;
}

/**
 * 락 실패 메시지 포맷
 */
function formatLockFailureMessage(lockResult) {
  let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '🔒 LOCK ACQUISITION FAILED\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const failed of lockResult.failedLocks) {
    message += `❌ ${failed.module}\n`;
    message += `   Reason: ${failed.reason}\n`;
    if (failed.heldBy) {
      message += `   Held by: ${failed.heldBy}\n`;
    }
    if (failed.queuePosition) {
      message += `   Queue position: ${failed.queuePosition}\n`;
    }
    message += '\n';
  }

  message += '**Options:**\n';
  message += '• 다른 모듈 작업을 먼저 진행하세요\n';
  message += '• 락 보유 에이전트 완료를 기다리세요\n';
  message += '• Primary Coordinator에게 강제 해제를 요청하세요\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  return message;
}

/**
 * 충돌 경고 메시지 포맷
 */
function formatConflictWarning(conflictCheck) {
  let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '⚠️  POTENTIAL CONFLICT DETECTED\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const conflict of conflictCheck.conflicts) {
    message += `Overlapping modules: ${conflict.overlappingModules.join(', ')}\n`;
    message += `Active task: ${conflict.existingTask} (${conflict.existingAgent})\n`;
    message += `Running for: ${Math.round(conflict.runningSince / 1000)}s\n\n`;
  }

  message += '**Note:** Primary Coordinator will merge conflicts if needed.\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  return message;
}

/**
 * 작업 완료 로깅
 */
function logTaskCompletion(taskId, success, result) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${success ? '✅' : '❌'} TASK ${success ? 'COMPLETED' : 'FAILED'}: ${taskId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * 체크포인트 생성 고려
 */
async function considerCheckpoint(event) {
  try {
    // 성공적인 빌드 후 체크포인트 생성
    if (event.tool_input?.prompt?.includes('빌드') ||
        event.tool_input?.prompt?.includes('build')) {
      if (fs.existsSync(CHECKPOINT_MANAGER)) {
        const cpManager = require(CHECKPOINT_MANAGER);
        cpManager.createCheckpoint({
          agentId: event.tool_input.subagent_type,
          trigger: 'after_successful_build',
          description: `Auto checkpoint after task: ${event.task_id}`
        });
      }
    }
  } catch (error) {
    console.error('[ParallelCoordinator] Checkpoint error:', error.message);
  }
}

/**
 * 병렬 작업 현황 조회
 */
function getParallelStatus() {
  const state = loadParallelState();

  return {
    sessionId: state.sessionId,
    activeAgentCount: state.activeAgents.length,
    activeAgents: state.activeAgents.map(a => ({
      taskId: a.taskId,
      agentType: a.agentType,
      description: a.description,
      runningFor: Date.now() - a.startTime,
      targetModules: a.targetModules
    })),
    lastUpdated: state.lastUpdated
  };
}

/**
 * 모든 작업 강제 중단 (Primary 전용)
 */
function forceStopAllTasks(reason) {
  const state = loadParallelState();

  // 모든 락 해제
  for (const agent of state.activeAgents) {
    releaseModuleLocks(agent.taskId);
  }

  // 상태 초기화
  state.activeAgents = [];
  state.taskQueue = [];
  saveParallelState(state);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🛑 ALL PARALLEL TASKS STOPPED');
  console.log(`Reason: ${reason}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { success: true, reason };
}

// Export for Claude Code Hook system
module.exports = {
  onTaskPreExecute,
  onTaskPostExecute,
  getParallelStatus,
  forceStopAllTasks,
  extractTargetModules,
  detectPotentialConflicts
};
