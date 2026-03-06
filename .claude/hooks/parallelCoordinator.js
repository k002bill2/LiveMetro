/**
 * Parallel Coordinator Hook for LiveMetro
 * 병렬 에이전트 작업 조정 — 파일 락, stale 정리, completedAgents 이력
 *
 * @version 3.0.0-LiveMetro
 *
 * @hook-config
 * {"event": "PreToolUse", "matcher": "Task", "command": "node .claude/hooks/parallelCoordinator.js pre 2>/dev/null || true"}
 *
 * @hook-config
 * {"event": "PostToolUse", "matcher": "Task", "command": "node .claude/hooks/parallelCoordinator.js post 2>/dev/null || true"}
 */

const fs = require('fs');
const path = require('path');

// 병렬 작업 상태 파일
const PARALLEL_STATE_PATH = path.join(__dirname, '../coordination/parallel-state.json');
const STALE_MS = 10 * 60 * 1000; // 10분
const MAX_COMPLETED = 20;

/**
 * HITL (Human-In-The-Loop) 분류 체계
 * ACE Framework Layer 4 (Executive Function)에서 사용
 *
 * 각 레벨은 작업의 위험도에 따라 사용자 승인 필요 여부를 결정합니다.
 */
const HITL_LEVELS = {
  LOW: {
    level: 'LOW',
    approvalRequired: false,
    description: '자동 실행 — 읽기 전용, 테스트, 린트',
    examples: ['코드 분석', '테스트 실행', '린트 검사', '타입 체크']
  },
  MEDIUM: {
    level: 'MEDIUM',
    approvalRequired: false,
    description: '자동 실행 (로깅) — 워크스페이스 내 파일 생성/수정',
    examples: ['컴포넌트 생성', '테스트 작성', '워크스페이스 파일 수정']
  },
  HIGH: {
    level: 'HIGH',
    approvalRequired: true,
    description: '사용자 승인 필요 — src/ 직접 수정, 설정 변경',
    examples: ['src/ 파일 직접 수정', '패키지 설치', '설정 파일 변경']
  },
  CRITICAL: {
    level: 'CRITICAL',
    approvalRequired: true,
    description: '필수 승인 — 삭제, 배포, 데이터 마이그레이션',
    examples: ['파일 삭제', '데이터베이스 변경', '배포 실행', 'git push']
  }
};

/**
 * 작업 내용 기반 HITL 레벨 분류
 * @param {object} taskInput - Task tool_input
 * @returns {object} HITL 레벨 정보
 */
function classifyHITL(taskInput) {
  const prompt = (taskInput.prompt || '').toLowerCase();
  const desc = (taskInput.description || '').toLowerCase();
  const combined = `${prompt} ${desc}`;

  // CRITICAL: 삭제, 배포, 마이그레이션
  const criticalPatterns = /\b(delete|remove|drop|deploy|push|migration|rm\s+-rf|force)\b/;
  if (criticalPatterns.test(combined)) return HITL_LEVELS.CRITICAL;

  // HIGH: src/ 직접 수정, 설정 변경, 패키지 변경
  const highPatterns = /\b(modify src|edit src|install|uninstall|config change|settings)\b/;
  const srcWritePattern = /(?:write|edit|modify).*?src\//;
  if (highPatterns.test(combined) || srcWritePattern.test(combined)) return HITL_LEVELS.HIGH;

  // LOW: 읽기 전용, 분석, 검증
  const lowPatterns = /\b(read|analyze|review|check|lint|test|type.?check|scan|search|grep)\b/;
  if (lowPatterns.test(combined) && !/\b(write|create|modify|edit|update)\b/.test(combined)) {
    return HITL_LEVELS.LOW;
  }

  // 기본: MEDIUM
  return HITL_LEVELS.MEDIUM;
}

// file-lock-manager 로드 (실패 시 no-op)
let fileLockManager;
try {
  fileLockManager = require('../coordination/file-lock-manager');
} catch {
  fileLockManager = {
    acquireLock: () => ({ success: true, lockId: null }),
    releaseByAgent: () => ({ success: true, released: 0 })
  };
}

/**
 * 기본 병렬 상태
 */
const DEFAULT_STATE = {
  activeAgents: [],
  completedAgents: [],
  lastUpdated: null,
  sessionId: null
};

/**
 * 세션 ID 생성
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 병렬 상태 로드
 */
function loadParallelState() {
  try {
    if (fs.existsSync(PARALLEL_STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(PARALLEL_STATE_PATH, 'utf8'));
      if (!state.completedAgents) state.completedAgents = [];
      return state;
    }
  } catch (error) {
    console.error('[ParallelCoordinator] Load error:', error.message);
  }
  return { ...DEFAULT_STATE, sessionId: generateSessionId() };
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
    const tmpPath = PARALLEL_STATE_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, PARALLEL_STATE_PATH);
  } catch (error) {
    console.error('[ParallelCoordinator] Save error:', error.message);
  }
}

/**
 * Stale 에이전트 정리 (10분 이상 된 에이전트 제거 + 락 해제)
 */
function cleanupStaleAgents(state) {
  const now = Date.now();
  const stale = state.activeAgents.filter(a => (now - a.startTime) >= STALE_MS);
  if (stale.length > 0) {
    for (const agent of stale) {
      try {
        fileLockManager.releaseByAgent(agent.taskId);
      } catch {}
    }
    state.activeAgents = state.activeAgents.filter(a => (now - a.startTime) < STALE_MS);
  }
}

/**
 * 프롬프트에서 파일 경로 추출
 */
function extractTargetFiles(prompt) {
  const matches = prompt.match(/(?:src\/|\.\/|tests\/|infra\/|docs\/|\.claude\/)[^\s\n,)'"]+\.\w{1,5}/g) || [];
  const projectRoot = path.resolve(__dirname, '../..');
  return [...new Set(matches.map(f => path.resolve(projectRoot, f)))];
}

/**
 * Task 실행 전 조정
 */
async function onTaskPreExecute(event) {
  const tool_input = event.tool_input || {};
  if (!tool_input.description && !tool_input.prompt) {
    return { decision: 'allow' };
  }
  const state = loadParallelState();

  // Stale 에이전트 정리
  cleanupStaleAgents(state);

  // HITL 분류
  const hitlLevel = classifyHITL(tool_input);

  // CRITICAL/HIGH 레벨은 승인 필요 로그 출력
  if (hitlLevel.approvalRequired) {
    console.log(`[ParallelCoordinator] HITL ${hitlLevel.level}: "${tool_input.description}" — ${hitlLevel.description}`);
  }

  const taskInfo = {
    taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    subagentType: tool_input.subagent_type,
    description: tool_input.description,
    hitlLevel: hitlLevel.level,
    startTime: Date.now(),
    status: 'running'
  };

  // 대상 파일 추출 + 파일 락 획득
  const targetFiles = extractTargetFiles(tool_input.prompt || '');
  const lockIds = [];
  const failedLocks = [];

  for (const filePath of targetFiles) {
    try {
      const result = fileLockManager.acquireLock({
        agentId: taskInfo.taskId,
        filePath,
        operation: 'write'
      });
      if (result.success && result.lockId) {
        lockIds.push(result.lockId);
      } else if (!result.success) {
        failedLocks.push({ file: path.basename(filePath), heldBy: result.heldBy });
        console.log(`[ParallelCoordinator] File lock conflict: ${path.basename(filePath)} held by ${result.heldBy}`);
      }
    } catch {}
  }

  // 파일 레벨 충돌: 락 획득 실패한 파일이 있으면 차단
  if (failedLocks.length > 0) {
    for (const lockId of lockIds) {
      try { fileLockManager.releaseByAgent(taskInfo.taskId); } catch {}
    }
    return {
      decision: 'block',
      reason: `File lock conflict: ${failedLocks.map(f => `${f.file} (held by ${f.heldBy})`).join(', ')}`
    };
  }

  // 작업 등록
  state.activeAgents.push({
    ...taskInfo,
    targetFiles: targetFiles.map(f => path.relative(process.cwd(), f)),
    lockIds
  });

  saveParallelState(state);

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
 * Task 실행 후 정리
 */
async function onTaskPostExecute(event) {
  const { task_id, success } = event;
  const state = loadParallelState();

  cleanupStaleAgents(state);

  let agentIndex = state.activeAgents.findIndex(a => a.taskId === task_id);
  if (agentIndex < 0 && typeof task_id === 'string') {
    agentIndex = state.activeAgents.findIndex(a => a.description === task_id);
  }

  if (agentIndex >= 0) {
    const agent = state.activeAgents[agentIndex];

    try {
      fileLockManager.releaseByAgent(agent.taskId);
    } catch {}

    state.completedAgents.push({
      taskId: agent.taskId,
      subagentType: agent.subagentType,
      description: agent.description,
      startTime: agent.startTime,
      endTime: Date.now(),
      duration_ms: Date.now() - agent.startTime,
      status: success ? 'completed' : 'failed'
    });

    if (state.completedAgents.length > MAX_COMPLETED) {
      state.completedAgents = state.completedAgents.slice(-MAX_COMPLETED);
    }

    state.activeAgents.splice(agentIndex, 1);
  }

  saveParallelState(state);

  console.log(`${success ? '✅' : '❌'} Task ${task_id} ${success ? 'completed' : 'failed'}`);
}

function injectCoordinationContext(prompt, taskInfo) {
  const lines = [
    `[PARALLEL TASK: ${taskInfo.taskId}] [HITL: ${taskInfo.hitlLevel}]`,
    '',
    '다른 에이전트와 같은 파일 수정 시 충돌에 주의하세요.',
    '',
    prompt
  ];
  return lines.join('\n');
}

function getParallelStatus() {
  const state = loadParallelState();
  return {
    sessionId: state.sessionId,
    activeCount: state.activeAgents.length,
    agents: state.activeAgents,
    completedCount: state.completedAgents.length,
    lastUpdated: state.lastUpdated
  };
}

function clearAllTasks() {
  const state = { ...DEFAULT_STATE, sessionId: generateSessionId() };
  saveParallelState(state);
  console.log('All parallel tasks cleared');
}

module.exports = {
  onTaskPreExecute,
  onTaskPostExecute,
  getParallelStatus,
  clearAllTasks,
  injectCoordinationContext,
  classifyHITL,
  HITL_LEVELS
};

// CLI entry point for hook system
if (require.main === module) {
  const mode = process.argv[2];

  if (mode === 'status') {
    const status = getParallelStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }
  if (mode === 'clear') {
    clearAllTasks();
    const flm = require('../coordination/file-lock-manager');
    flm.clearAllLocks();
    console.log('All parallel tasks and locks cleared');
    process.exit(0);
  }

  let inputData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(inputData);
      if (mode === 'pre') {
        onTaskPreExecute({ tool_input: event.tool_input || {} });
      } else {
        onTaskPostExecute({ task_id: event.tool_input?.description, success: true });
      }
    } catch (e) { /* ignore */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}
