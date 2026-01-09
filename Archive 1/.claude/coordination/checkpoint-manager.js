/**
 * Checkpoint Manager for ACE Framework
 * 체크포인트 생성, 복원, 롤백 관리 + Manager State Capture
 *
 * @version 4.0.0-KiiPS (Manager Agents 지원)
 * @layer Layer 4 (Executive Function) & Layer 4.5 (Manager Orchestration) & Layer 5 (Cognitive Control)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// 설정 경로
const CHECKPOINTS_DIR = path.join(__dirname, '../ace-framework/checkpoints');
const CHECKPOINT_INDEX_PATH = path.join(CHECKPOINTS_DIR, 'index.json');
const ALLOCATION_STATE_PATH = path.join(__dirname, '../ace-framework/allocation-state.json');
const LOCK_FILE_PATH = path.join(__dirname, '../ace-framework/locks.json');
const MAX_CHECKPOINTS = 10;

/**
 * 자동 체크포인트 트리거
 */
const AUTO_CHECKPOINT_TRIGGERS = [
  'before_critical_operation',
  'after_successful_build',
  'before_deployment',
  'after_merge_operation',
  'before_database_change',
  'after_test_pass'
];

/**
 * 디렉토리 존재 확인 및 생성
 */
function ensureCheckpointDir() {
  if (!fs.existsSync(CHECKPOINTS_DIR)) {
    fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  }
}

/**
 * 체크포인트 인덱스 로드
 */
function loadCheckpointIndex() {
  try {
    if (fs.existsSync(CHECKPOINT_INDEX_PATH)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_INDEX_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('[CheckpointManager] Error loading index:', error.message);
  }
  return { checkpoints: [], lastUpdated: null };
}

/**
 * 체크포인트 인덱스 저장
 */
function saveCheckpointIndex(index) {
  index.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * 파일 해시 계산
 */
function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch (error) {
    return null;
  }
}

/**
 * 디렉토리 내 파일 목록 및 해시 수집
 */
function collectFileHashes(baseDir, relativePath = '') {
  const files = [];
  const fullPath = path.join(baseDir, relativePath);

  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      const entryFullPath = path.join(fullPath, entry.name);

      // 제외할 디렉토리/파일
      if (entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.svn' ||
          entry.name === 'target' ||
          entry.name === 'checkpoints') {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...collectFileHashes(baseDir, entryRelativePath));
      } else if (entry.isFile()) {
        const hash = calculateFileHash(entryFullPath);
        if (hash) {
          files.push({
            path: entryRelativePath,
            hash,
            size: fs.statSync(entryFullPath).size
          });
        }
      }
    }
  } catch (error) {
    console.error(`[CheckpointManager] Error reading directory ${fullPath}:`, error.message);
  }

  return files;
}

/**
 * 체크포인트 생성
 *
 * @param {Object} options 체크포인트 옵션
 * @param {string} options.agentId 에이전트 ID
 * @param {string} options.trigger 트리거 유형
 * @param {string} options.description 설명
 * @param {string[]} options.modules 포함할 KiiPS 모듈 목록
 * @param {boolean} options.ethicalClearance 윤리 검증 통과 여부
 * @returns {Object} 체크포인트 생성 결과
 */
function createCheckpoint(options) {
  const {
    agentId = 'primary-coordinator',
    trigger = 'manual',
    description = '',
    modules = [],
    ethicalClearance = true
  } = options;

  ensureCheckpointDir();

  const timestamp = Date.now();
  const checkpointId = `cp_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;

  // KiiPS 프로젝트 루트 (상대 경로 기준)
  const projectRoot = path.resolve(__dirname, '../../../');

  // 체크포인트 데이터 수집
  const checkpointData = {
    checkpointId,
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
    agentId,
    trigger,
    description,
    ethicalClearance,
    modules: modules.length > 0 ? modules : ['KiiPS-COMMON', 'KiiPS-UTILS'],
    state: {
      layer: 'initialization',
      progress: 0
    }
  };

  // .claude 디렉토리 파일 해시 수집 (설정 파일 상태)
  const claudeDir = path.join(projectRoot, '.claude');
  if (fs.existsSync(claudeDir)) {
    checkpointData.claudeConfigHashes = collectFileHashes(claudeDir)
      .filter(f => f.path.endsWith('.json') || f.path.endsWith('.md') || f.path.endsWith('.js'))
      .slice(0, 50); // 최대 50개
  }

  // 모듈별 주요 파일 해시 수집
  checkpointData.moduleHashes = {};
  for (const moduleName of checkpointData.modules) {
    const moduleDir = path.join(projectRoot, moduleName);
    if (fs.existsSync(moduleDir)) {
      // pom.xml 및 주요 설정 파일만
      const pomPath = path.join(moduleDir, 'pom.xml');
      const propsPath = path.join(moduleDir, 'src/main/resources/application.yml');

      checkpointData.moduleHashes[moduleName] = {
        pom: calculateFileHash(pomPath),
        properties: fs.existsSync(propsPath) ? calculateFileHash(propsPath) : null
      };
    }
  }

  // Git/SVN 상태 (있는 경우)
  try {
    const gitStatus = execSync('git rev-parse HEAD 2>/dev/null || echo "not-git"', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim();

    if (gitStatus !== 'not-git') {
      checkpointData.vcsInfo = {
        type: 'git',
        commit: gitStatus.substring(0, 12)
      };
    }
  } catch (error) {
    // VCS 정보 없음
  }

  // Manager 상태 캡처 (Layer 4.5)
  checkpointData.managerStates = captureManagerStates();

  // 체크포인트 파일 저장
  const checkpointFilePath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`);
  fs.writeFileSync(checkpointFilePath, JSON.stringify(checkpointData, null, 2), 'utf8');

  // 인덱스 업데이트
  const index = loadCheckpointIndex();
  index.checkpoints.unshift({
    checkpointId,
    timestamp,
    trigger,
    agentId,
    description: description.substring(0, 100)
  });

  // 오래된 체크포인트 정리
  if (index.checkpoints.length > MAX_CHECKPOINTS) {
    const toRemove = index.checkpoints.splice(MAX_CHECKPOINTS);
    for (const old of toRemove) {
      const oldFilePath = path.join(CHECKPOINTS_DIR, `${old.checkpointId}.json`);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
  }

  saveCheckpointIndex(index);

  return {
    success: true,
    checkpointId,
    timestamp,
    filePath: checkpointFilePath,
    message: `Checkpoint ${checkpointId} created successfully`
  };
}

/**
 * 체크포인트 목록 조회
 */
function listCheckpoints() {
  const index = loadCheckpointIndex();

  return {
    total: index.checkpoints.length,
    maxAllowed: MAX_CHECKPOINTS,
    lastUpdated: index.lastUpdated,
    checkpoints: index.checkpoints.map(cp => ({
      ...cp,
      age: Date.now() - cp.timestamp,
      ageHuman: formatDuration(Date.now() - cp.timestamp)
    }))
  };
}

/**
 * 특정 체크포인트 상세 조회
 */
function getCheckpoint(checkpointId) {
  const filePath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`);

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: 'CHECKPOINT_NOT_FOUND',
      message: `Checkpoint ${checkpointId} not found`
    };
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  return {
    success: true,
    checkpoint: data
  };
}

/**
 * 마지막 검증된 체크포인트 조회
 */
function getLastValidatedCheckpoint() {
  const index = loadCheckpointIndex();

  for (const cp of index.checkpoints) {
    const result = getCheckpoint(cp.checkpointId);
    if (result.success && result.checkpoint.ethicalClearance) {
      return result;
    }
  }

  return {
    success: false,
    error: 'NO_VALIDATED_CHECKPOINT',
    message: 'No validated checkpoint found'
  };
}

/**
 * 체크포인트 비교 (현재 상태와)
 */
function compareWithCheckpoint(checkpointId) {
  const result = getCheckpoint(checkpointId);

  if (!result.success) {
    return result;
  }

  const checkpoint = result.checkpoint;
  const projectRoot = path.resolve(__dirname, '../../../');
  const changes = [];

  // Claude 설정 파일 변경 확인
  if (checkpoint.claudeConfigHashes) {
    for (const file of checkpoint.claudeConfigHashes) {
      const currentHash = calculateFileHash(path.join(projectRoot, '.claude', file.path));
      if (currentHash !== file.hash) {
        changes.push({
          type: 'config_changed',
          path: `.claude/${file.path}`,
          checkpointHash: file.hash,
          currentHash
        });
      }
    }
  }

  // 모듈 해시 변경 확인
  if (checkpoint.moduleHashes) {
    for (const [moduleName, hashes] of Object.entries(checkpoint.moduleHashes)) {
      const pomPath = path.join(projectRoot, moduleName, 'pom.xml');
      const currentPomHash = calculateFileHash(pomPath);

      if (currentPomHash !== hashes.pom) {
        changes.push({
          type: 'module_pom_changed',
          module: moduleName,
          checkpointHash: hashes.pom,
          currentHash: currentPomHash
        });
      }
    }
  }

  return {
    success: true,
    checkpointId,
    checkpointTimestamp: checkpoint.timestamp,
    changeCount: changes.length,
    hasChanges: changes.length > 0,
    changes
  };
}

/**
 * 롤백 준비 (실제 롤백은 사용자 승인 필요)
 */
function prepareRollback(checkpointId) {
  const comparison = compareWithCheckpoint(checkpointId);

  if (!comparison.success) {
    return comparison;
  }

  const result = getCheckpoint(checkpointId);

  return {
    success: true,
    rollbackPlan: {
      targetCheckpoint: checkpointId,
      targetTimestamp: result.checkpoint.timestamp,
      targetDescription: result.checkpoint.description,
      changestoRevert: comparison.changes.length,
      changes: comparison.changes,
      warnings: [
        'This will revert files to the checkpoint state',
        'Any uncommitted changes will be lost',
        'Manual verification recommended after rollback'
      ],
      requiresApproval: true
    }
  };
}

/**
 * 체크포인트 삭제
 */
function deleteCheckpoint(checkpointId) {
  const filePath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`);

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: 'CHECKPOINT_NOT_FOUND',
      message: `Checkpoint ${checkpointId} not found`
    };
  }

  fs.unlinkSync(filePath);

  const index = loadCheckpointIndex();
  index.checkpoints = index.checkpoints.filter(cp => cp.checkpointId !== checkpointId);
  saveCheckpointIndex(index);

  return {
    success: true,
    message: `Checkpoint ${checkpointId} deleted`
  };
}

/**
 * Manager 상태 캡처 (Layer 4.5)
 *
 * 현재 활성 Manager 및 작업 상태를 캡처
 *
 * @returns {Object} Manager 상태
 */
function captureManagerStates() {
  const managerStates = {
    timestamp: Date.now(),
    activeManagers: [],
    managerWorkflows: [],
    workerAssignments: [],
    domainLocks: []
  };

  // Task Allocation State에서 Manager 정보 추출
  try {
    if (fs.existsSync(ALLOCATION_STATE_PATH)) {
      const allocationState = JSON.parse(fs.readFileSync(ALLOCATION_STATE_PATH, 'utf8'));

      if (allocationState.currentExecution && allocationState.currentExecution.manager) {
        const execution = allocationState.currentExecution;

        // 활성 Manager
        managerStates.activeManagers.push({
          managerId: execution.manager,
          executionId: execution.executionId,
          taskType: execution.taskType,
          status: execution.status,
          progress: execution.progress,
          delegationDepth: execution.delegationDepth
        });

        // Manager Workflow (subtasks)
        managerStates.managerWorkflows.push({
          managerId: execution.manager,
          executionId: execution.executionId,
          subtaskCount: execution.subtasks?.length || 0,
          completedTasks: execution.subtasks?.filter(t => t.status === 'completed').length || 0,
          failedTasks: execution.subtasks?.filter(t => t.status === 'failed').length || 0
        });

        // Worker Assignments
        if (execution.subtasks) {
          for (const task of execution.subtasks) {
            if (task.agent && task.agent !== 'primary-coordinator') {
              managerStates.workerAssignments.push({
                managerId: execution.manager,
                workerId: task.agent,
                taskId: task.taskId,
                taskName: task.name,
                status: task.status,
                progress: task.progress || 0
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[CheckpointManager] Error capturing allocation state:', error.message);
  }

  // Lock State에서 Domain Locks 정보 추출
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockState = JSON.parse(fs.readFileSync(LOCK_FILE_PATH, 'utf8'));

      if (lockState.domainLocks && lockState.domainLocks.length > 0) {
        managerStates.domainLocks = lockState.domainLocks.map(lock => ({
          lockId: lock.lockId,
          managerId: lock.managerId,
          domain: lock.domain,
          timestamp: lock.timestamp,
          age: Date.now() - lock.timestamp
        }));
      }
    }
  } catch (error) {
    console.error('[CheckpointManager] Error capturing lock state:', error.message);
  }

  return managerStates;
}

/**
 * 시간 형식화
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  let result;

  switch (command) {
    case 'create':
      const createOptions = JSON.parse(args[1] || '{}');
      result = createCheckpoint(createOptions);
      break;

    case 'list':
      result = listCheckpoints();
      break;

    case 'get':
      result = getCheckpoint(args[1]);
      break;

    case 'last-validated':
      result = getLastValidatedCheckpoint();
      break;

    case 'compare':
      result = compareWithCheckpoint(args[1]);
      break;

    case 'prepare-rollback':
      result = prepareRollback(args[1]);
      break;

    case 'delete':
      result = deleteCheckpoint(args[1]);
      break;

    default:
      result = {
        usage: 'node checkpoint-manager.js <command> [args]',
        commands: [
          'create [json-options]',
          'list',
          'get <checkpoint-id>',
          'last-validated',
          'compare <checkpoint-id>',
          'prepare-rollback <checkpoint-id>',
          'delete <checkpoint-id>'
        ]
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

// 모듈 내보내기
module.exports = {
  createCheckpoint,
  listCheckpoints,
  getCheckpoint,
  getLastValidatedCheckpoint,
  compareWithCheckpoint,
  prepareRollback,
  deleteCheckpoint,
  captureManagerStates, // Layer 4.5
  AUTO_CHECKPOINT_TRIGGERS
};
