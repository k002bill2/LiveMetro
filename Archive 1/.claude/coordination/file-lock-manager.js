/**
 * File Lock Manager for ACE Framework
 * KiiPS 서비스 모듈 단위 락킹 시스템 + Manager Domain Locks
 *
 * @version 4.0.0-KiiPS (Manager Agents 지원)
 * @layer Layer 5 (Cognitive Control) & Layer 4.5 (Manager Orchestration)
 */

const fs = require('fs');
const path = require('path');

// 설정 경로
const ACE_CONFIG_PATH = path.join(__dirname, '../ace-framework/ace-config.json');
const LOCK_FILE_PATH = path.join(__dirname, '../ace-framework/locks.json');

// 기본 설정
const DEFAULT_CONFIG = {
  lockTimeout: 30000, // 30초
  deadlockDetection: true,
  maxRetries: 3,
  retryDelay: 1000, // 1초
  domainLockTimeout: 60000 // 도메인 락 타임아웃 (1분)
};

/**
 * Manager 도메인 정의 (Layer 4.5)
 */
const MANAGER_DOMAINS = {
  'build': {
    managers: ['build-manager'],
    description: 'Maven builds, dependency resolution'
  },
  'deployment': {
    managers: ['deployment-manager'],
    description: 'Service deployment, health checks, rollback'
  },
  'feature': {
    managers: ['feature-manager'],
    description: 'Feature development lifecycle'
  },
  'ui': {
    managers: ['ui-manager'],
    description: 'UI/UX workflows, validation pipelines'
  }
};

/**
 * KiiPS 서비스 모듈 목록 (락킹 대상)
 */
const KIIPS_MODULES = {
  // Core 모듈 (Primary Only)
  'KiiPS-HUB': { type: 'parent-pom', primaryOnly: true },
  'KiiPS-COMMON': { type: 'shared-services', primaryOnly: true },
  'KiiPS-UTILS': { type: 'shared-daos', primaryOnly: true },
  'KiiPS-APIGateway': { type: 'gateway', primaryOnly: true },
  'KiiPS-Login': { type: 'authentication', primaryOnly: true },
  'KiiPS-UI': { type: 'web-interface', primaryOnly: true },

  // 비즈니스 모듈 (Secondary 허용)
  'KiiPS-FD': { type: 'business-service', primaryOnly: false },
  'KiiPS-IL': { type: 'business-service', primaryOnly: false },
  'KiiPS-PG': { type: 'business-service', primaryOnly: false },
  'KiiPS-AC': { type: 'business-service', primaryOnly: false },
  'KiiPS-SY': { type: 'business-service', primaryOnly: false },
  'KiiPS-LP': { type: 'business-service', primaryOnly: false },
  'KiiPS-EL': { type: 'business-service', primaryOnly: false },
  'KiiPS-RT': { type: 'business-service', primaryOnly: false },
  'KiiPS-BATCH': { type: 'batch-service', primaryOnly: false },
  'KiiPS-MOBILE': { type: 'mobile-service', primaryOnly: false },
  'KiiPS-KSD': { type: 'external-integration', primaryOnly: false },
  'KiiPS-AI': { type: 'ai-service', primaryOnly: false }
};

/**
 * 락 순서 (데드락 방지)
 * 여러 모듈 락 필요 시 이 순서대로 획득해야 함
 */
const LOCK_ORDER = [
  'KiiPS-HUB',
  'KiiPS-COMMON',
  'KiiPS-UTILS',
  'KiiPS-APIGateway',
  'KiiPS-Login',
  'KiiPS-UI',
  'KiiPS-AC',
  'KiiPS-AI',
  'KiiPS-BATCH',
  'KiiPS-EL',
  'KiiPS-FD',
  'KiiPS-IL',
  'KiiPS-KSD',
  'KiiPS-LP',
  'KiiPS-MOBILE',
  'KiiPS-PG',
  'KiiPS-RT',
  'KiiPS-SY'
];

/**
 * 현재 락 상태 로드
 */
function loadLocks() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const data = fs.readFileSync(LOCK_FILE_PATH, 'utf8');
      const state = JSON.parse(data);
      // domainLocks 필드 초기화 (하위 호환성)
      if (!state.domainLocks) {
        state.domainLocks = [];
      }
      return state;
    }
  } catch (error) {
    console.error('[FileLockManager] Error loading locks:', error.message);
  }
  return { locks: [], queue: [], domainLocks: [] };
}

/**
 * 락 상태 저장
 */
function saveLocks(lockState) {
  try {
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(lockState, null, 2), 'utf8');
  } catch (error) {
    console.error('[FileLockManager] Error saving locks:', error.message);
  }
}

/**
 * 모듈명 추출 (파일 경로에서)
 */
function extractModuleName(filePath) {
  // 안전 검사: filePath가 문자열이 아니면 null 반환
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  for (const moduleName of Object.keys(KIIPS_MODULES)) {
    if (filePath.includes(moduleName) || filePath.includes(moduleName.toLowerCase())) {
      return moduleName;
    }
  }
  return null;
}

/**
 * Manager 도메인 락 획득 (Layer 4.5)
 *
 * Manager가 도메인 전체에 대한 락을 획득하여 동시 실행 방지
 *
 * @param {string} managerId Manager Agent ID (예: 'build-manager')
 * @param {string} domain 도메인 (예: 'build', 'deployment')
 * @returns {Object} 락 획득 결과
 */
function acquireManagerLock(managerId, domain) {
  // 도메인 유효성 검사
  if (!MANAGER_DOMAINS[domain]) {
    return {
      success: false,
      error: 'INVALID_DOMAIN',
      message: `Unknown domain: ${domain}`,
      validDomains: Object.keys(MANAGER_DOMAINS)
    };
  }

  // Manager 권한 검사
  if (!MANAGER_DOMAINS[domain].managers.includes(managerId)) {
    return {
      success: false,
      error: 'UNAUTHORIZED_MANAGER',
      message: `Manager ${managerId} is not authorized for domain ${domain}`,
      authorizedManagers: MANAGER_DOMAINS[domain].managers
    };
  }

  const lockState = loadLocks();
  const now = Date.now();

  // 만료된 도메인 락 정리
  lockState.domainLocks = lockState.domainLocks.filter(lock => {
    const expiryTime = lock.timestamp + lock.estimatedDuration + DEFAULT_CONFIG.domainLockTimeout;
    return expiryTime > now;
  });

  // 현재 도메인 락 확인
  const existingDomainLock = lockState.domainLocks.find(lock => lock.domain === domain);

  if (existingDomainLock) {
    // 같은 Manager가 이미 락을 가지고 있음
    if (existingDomainLock.managerId === managerId) {
      return {
        success: true,
        type: 'EXISTING',
        lockId: existingDomainLock.lockId,
        message: `Already holding domain lock on ${domain}`
      };
    }

    // 다른 Manager가 락을 가지고 있음
    return {
      success: false,
      error: 'DOMAIN_LOCKED',
      message: `Domain ${domain} is locked by ${existingDomainLock.managerId}`,
      existingLock: {
        managerId: existingDomainLock.managerId,
        since: existingDomainLock.timestamp,
        estimatedRelease: existingDomainLock.timestamp + existingDomainLock.estimatedDuration
      }
    };
  }

  // 새 도메인 락 생성
  const newDomainLock = {
    lockId: `domain_lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    managerId,
    domain,
    timestamp: now,
    estimatedDuration: DEFAULT_CONFIG.domainLockTimeout
  };

  lockState.domainLocks.push(newDomainLock);
  saveLocks(lockState);

  return {
    success: true,
    type: 'ACQUIRED',
    lockId: newDomainLock.lockId,
    domain,
    message: `Domain lock acquired on ${domain} by ${managerId}`,
    expiresAt: now + DEFAULT_CONFIG.domainLockTimeout
  };
}

/**
 * Manager 도메인 락 해제 (Layer 4.5)
 *
 * @param {string} managerId Manager Agent ID
 * @param {string} domain 도메인
 * @returns {Object} 락 해제 결과
 */
function releaseManagerLock(managerId, domain) {
  const lockState = loadLocks();

  const lockIndex = lockState.domainLocks.findIndex(
    lock => lock.domain === domain && lock.managerId === managerId
  );

  if (lockIndex === -1) {
    return {
      success: false,
      error: 'LOCK_NOT_FOUND',
      message: `No domain lock found for ${managerId} on ${domain}`
    };
  }

  const releasedLock = lockState.domainLocks[lockIndex];
  lockState.domainLocks.splice(lockIndex, 1);
  saveLocks(lockState);

  return {
    success: true,
    releasedLock: {
      lockId: releasedLock.lockId,
      domain: releasedLock.domain,
      duration: Date.now() - releasedLock.timestamp
    }
  };
}

/**
 * Manager 권한 확인 (Layer 4.5)
 *
 * Manager가 특정 모듈을 잠글 수 있는지 확인
 *
 * @param {string} managerId Manager Agent ID
 * @param {string} moduleName 모듈명
 * @returns {boolean} 권한 여부
 */
function isManagerAuthorized(managerId, moduleName) {
  const module = KIIPS_MODULES[moduleName];

  if (!module) {
    return false; // 알 수 없는 모듈
  }

  // Shared modules (primaryOnly)는 Manager가 잠글 수 없음
  // Only Primary Coordinator can lock shared modules
  if (module.primaryOnly) {
    return false;
  }

  // Business modules can be locked by Managers
  return true;
}

/**
 * Manager가 Worker 대신 락 획득 (Layer 4.5)
 *
 * Manager가 Worker를 대신하여 모듈 락을 획득
 *
 * @param {string} managerId Manager Agent ID
 * @param {string} workerId Worker Agent ID
 * @param {string} moduleName 모듈명
 * @param {Object} options 추가 옵션
 * @returns {Object} 락 획득 결과
 */
function acquireLockForWorker(managerId, workerId, moduleName, options = {}) {
  // Manager 권한 확인
  if (!isManagerAuthorized(managerId, moduleName)) {
    return {
      success: false,
      error: 'MANAGER_NOT_AUTHORIZED',
      message: `Manager ${managerId} cannot lock module ${moduleName}`,
      reason: KIIPS_MODULES[moduleName]?.primaryOnly ? 'primary_only_module' : 'unknown_module'
    };
  }

  // Manager ID를 통해 Worker 대신 락 획득
  const lockRequest = {
    agentId: workerId,
    module: moduleName,
    operation: options.operation || 'write',
    estimatedDuration: options.estimatedDuration || 30000,
    purpose: options.purpose || `Managed by ${managerId}`
  };

  const result = acquireLock(lockRequest);

  // Manager tracking 정보 추가
  if (result.success) {
    const lockState = loadLocks();
    const lock = lockState.locks.find(l => l.lockId === result.lockId);
    if (lock) {
      lock.managedBy = managerId; // Manager 추적
      saveLocks(lockState);
    }
  }

  return result;
}

/**
 * 락 획득 요청
 *
 * @param {Object} request 락 요청 정보
 * @param {string} request.agentId 에이전트 ID
 * @param {string} request.module 모듈명 (또는 파일 경로)
 * @param {string} request.operation 작업 유형 (read/write)
 * @param {number} request.estimatedDuration 예상 소요 시간 (ms)
 * @param {string} request.purpose 작업 목적
 * @returns {Object} 락 획득 결과
 */
function acquireLock(request) {
  const { agentId, module, operation, estimatedDuration, purpose } = request;

  // 모듈명 확인
  const moduleName = KIIPS_MODULES[module] ? module : extractModuleName(module);

  if (!moduleName) {
    return {
      success: false,
      error: 'UNKNOWN_MODULE',
      message: `Unknown module: ${module}. Lock is module-based in KiiPS.`
    };
  }

  const moduleConfig = KIIPS_MODULES[moduleName];

  // Primary Only 모듈 체크
  if (moduleConfig.primaryOnly && agentId !== 'primary-coordinator') {
    return {
      success: false,
      error: 'PRIMARY_ONLY',
      message: `Module ${moduleName} can only be modified by primary-coordinator.`,
      moduleType: moduleConfig.type
    };
  }

  const lockState = loadLocks();
  const now = Date.now();

  // 만료된 락 정리
  lockState.locks = lockState.locks.filter(lock => {
    const expiryTime = lock.timestamp + lock.estimatedDuration + DEFAULT_CONFIG.lockTimeout;
    return expiryTime > now;
  });

  // 현재 모듈에 대한 락 확인
  const existingLock = lockState.locks.find(lock => lock.module === moduleName);

  if (existingLock) {
    // 같은 에이전트가 이미 락을 가지고 있음
    if (existingLock.agentId === agentId) {
      return {
        success: true,
        type: 'EXISTING',
        lockId: existingLock.lockId,
        message: `Already holding lock on ${moduleName}`
      };
    }

    // 다른 에이전트가 락을 가지고 있음
    // 큐에 추가
    const queueEntry = {
      queueId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      module: moduleName,
      operation,
      purpose,
      timestamp: now,
      waitingSince: now
    };

    lockState.queue.push(queueEntry);
    saveLocks(lockState);

    return {
      success: false,
      error: 'LOCK_HELD',
      message: `Module ${moduleName} is locked by ${existingLock.agentId}`,
      existingLock: {
        agentId: existingLock.agentId,
        operation: existingLock.operation,
        since: existingLock.timestamp,
        estimatedRelease: existingLock.timestamp + existingLock.estimatedDuration
      },
      queuePosition: lockState.queue.filter(q => q.module === moduleName).length,
      queueId: queueEntry.queueId
    };
  }

  // 새 락 생성
  const newLock = {
    lockId: `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    module: moduleName,
    moduleType: moduleConfig.type,
    operation,
    purpose,
    timestamp: now,
    estimatedDuration: estimatedDuration || 30000
  };

  lockState.locks.push(newLock);

  // 큐에서 이 에이전트의 대기 항목 제거
  lockState.queue = lockState.queue.filter(
    q => !(q.agentId === agentId && q.module === moduleName)
  );

  saveLocks(lockState);

  return {
    success: true,
    type: 'ACQUIRED',
    lockId: newLock.lockId,
    module: moduleName,
    message: `Lock acquired on ${moduleName}`,
    expiresAt: now + estimatedDuration + DEFAULT_CONFIG.lockTimeout
  };
}

/**
 * 락 해제
 */
function releaseLock(request) {
  const { agentId, module, lockId } = request;

  const moduleName = KIIPS_MODULES[module] ? module : extractModuleName(module);
  const lockState = loadLocks();

  // lockId로 찾기
  let lockIndex = -1;
  if (lockId) {
    lockIndex = lockState.locks.findIndex(lock => lock.lockId === lockId);
  } else if (moduleName && agentId) {
    lockIndex = lockState.locks.findIndex(
      lock => lock.module === moduleName && lock.agentId === agentId
    );
  }

  if (lockIndex === -1) {
    return {
      success: false,
      error: 'LOCK_NOT_FOUND',
      message: 'No matching lock found to release'
    };
  }

  const releasedLock = lockState.locks[lockIndex];

  // 권한 확인
  if (releasedLock.agentId !== agentId && agentId !== 'primary-coordinator') {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: `Cannot release lock owned by ${releasedLock.agentId}`
    };
  }

  // 락 제거
  lockState.locks.splice(lockIndex, 1);

  // 큐에서 다음 대기자 처리
  const nextInQueue = lockState.queue.find(q => q.module === releasedLock.module);

  saveLocks(lockState);

  return {
    success: true,
    releasedLock: {
      lockId: releasedLock.lockId,
      module: releasedLock.module,
      duration: Date.now() - releasedLock.timestamp
    },
    nextInQueue: nextInQueue ? {
      agentId: nextInQueue.agentId,
      queueId: nextInQueue.queueId
    } : null
  };
}

/**
 * 현재 락 상태 조회
 */
function getLockStatus() {
  const lockState = loadLocks();
  const now = Date.now();

  return {
    timestamp: now,
    activeLocks: lockState.locks.map(lock => ({
      ...lock,
      age: now - lock.timestamp,
      remainingTime: Math.max(0, lock.estimatedDuration - (now - lock.timestamp))
    })),
    queuedRequests: lockState.queue.map(q => ({
      ...q,
      waitTime: now - q.waitingSince
    })),
    // Manager Domain Locks (Layer 4.5)
    domainLocks: lockState.domainLocks.map(lock => ({
      ...lock,
      age: now - lock.timestamp,
      remainingTime: Math.max(0, lock.estimatedDuration - (now - lock.timestamp))
    })),
    moduleStatus: Object.keys(KIIPS_MODULES).reduce((acc, module) => {
      const lock = lockState.locks.find(l => l.module === module);
      const queueCount = lockState.queue.filter(q => q.module === module).length;
      acc[module] = {
        locked: !!lock,
        lockedBy: lock ? lock.agentId : null,
        managedBy: lock?.managedBy || null, // Manager tracking
        queueLength: queueCount
      };
      return acc;
    }, {}),
    domainStatus: Object.keys(MANAGER_DOMAINS).reduce((acc, domain) => {
      const lock = lockState.domainLocks.find(l => l.domain === domain);
      acc[domain] = {
        locked: !!lock,
        lockedBy: lock ? lock.managerId : null,
        description: MANAGER_DOMAINS[domain].description
      };
      return acc;
    }, {})
  };
}

/**
 * 데드락 감지
 */
function detectDeadlock() {
  const lockState = loadLocks();

  // 순환 대기 감지를 위한 그래프 구성
  const waitGraph = {};

  for (const queueItem of lockState.queue) {
    const lock = lockState.locks.find(l => l.module === queueItem.module);
    if (lock) {
      if (!waitGraph[queueItem.agentId]) {
        waitGraph[queueItem.agentId] = [];
      }
      waitGraph[queueItem.agentId].push(lock.agentId);
    }
  }

  // DFS로 순환 감지
  function hasCycle(node, visited, recStack) {
    visited[node] = true;
    recStack[node] = true;

    for (const neighbor of (waitGraph[node] || [])) {
      if (!visited[neighbor] && hasCycle(neighbor, visited, recStack)) {
        return true;
      } else if (recStack[neighbor]) {
        return true;
      }
    }

    recStack[node] = false;
    return false;
  }

  const visited = {};
  const recStack = {};

  for (const node of Object.keys(waitGraph)) {
    if (!visited[node] && hasCycle(node, visited, recStack)) {
      return {
        detected: true,
        message: 'Circular wait detected - potential deadlock',
        involvedAgents: Object.keys(waitGraph)
      };
    }
  }

  return { detected: false };
}

/**
 * 강제 락 해제 (Primary 전용, 데드락 해결용)
 */
function forceReleaseLock(request) {
  const { agentId, targetLockId, reason } = request;

  // Primary만 강제 해제 가능
  if (agentId !== 'primary-coordinator') {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: 'Only primary-coordinator can force release locks'
    };
  }

  const lockState = loadLocks();
  const lockIndex = lockState.locks.findIndex(lock => lock.lockId === targetLockId);

  if (lockIndex === -1) {
    return {
      success: false,
      error: 'LOCK_NOT_FOUND',
      message: `Lock ${targetLockId} not found`
    };
  }

  const forcedLock = lockState.locks[lockIndex];
  lockState.locks.splice(lockIndex, 1);

  // 강제 해제 로그
  const forceReleaseLog = {
    timestamp: Date.now(),
    lockId: targetLockId,
    originalAgent: forcedLock.agentId,
    module: forcedLock.module,
    reason,
    forcedBy: agentId
  };

  saveLocks(lockState);

  return {
    success: true,
    forceRelease: forceReleaseLog,
    message: `Lock ${targetLockId} forcefully released`
  };
}

/**
 * 모든 락 해제 (긴급 상황용)
 */
function releaseAllLocks(request) {
  const { agentId, reason } = request;

  if (agentId !== 'primary-coordinator') {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: 'Only primary-coordinator can release all locks'
    };
  }

  const lockState = loadLocks();
  const releasedCount = lockState.locks.length;

  lockState.locks = [];
  lockState.queue = [];

  saveLocks(lockState);

  return {
    success: true,
    releasedCount,
    reason,
    timestamp: Date.now()
  };
}

// 메인 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  let result;

  switch (command) {
    case 'acquire':
      const acquireRequest = JSON.parse(args[1] || '{}');
      result = acquireLock(acquireRequest);
      break;

    case 'release':
      const releaseRequest = JSON.parse(args[1] || '{}');
      result = releaseLock(releaseRequest);
      break;

    case 'acquire-manager':
      const managerId = args[1];
      const domain = args[2];
      result = acquireManagerLock(managerId, domain);
      break;

    case 'release-manager':
      const relManagerId = args[1];
      const relDomain = args[2];
      result = releaseManagerLock(relManagerId, relDomain);
      break;

    case 'acquire-for-worker':
      const lockForWorkerReq = JSON.parse(args[1] || '{}');
      const { managerId: mId, workerId, moduleName, options } = lockForWorkerReq;
      result = acquireLockForWorker(mId, workerId, moduleName, options);
      break;

    case 'check-manager-auth':
      const checkManagerId = args[1];
      const checkModuleName = args[2];
      const authorized = isManagerAuthorized(checkManagerId, checkModuleName);
      result = {
        managerId: checkManagerId,
        moduleName: checkModuleName,
        authorized,
        reason: !authorized ? (KIIPS_MODULES[checkModuleName]?.primaryOnly ? 'primary_only_module' : 'unknown_module') : null
      };
      break;

    case 'status':
      result = getLockStatus();
      break;

    case 'deadlock':
      result = detectDeadlock();
      break;

    case 'force-release':
      const forceRequest = JSON.parse(args[1] || '{}');
      result = forceReleaseLock(forceRequest);
      break;

    case 'release-all':
      const releaseAllRequest = JSON.parse(args[1] || '{}');
      result = releaseAllLocks(releaseAllRequest);
      break;

    default:
      result = {
        usage: 'node file-lock-manager.js <command> [json-args]',
        commands: [
          'acquire <json-request>',
          'release <json-request>',
          'acquire-manager <manager-id> <domain>',
          'release-manager <manager-id> <domain>',
          'acquire-for-worker <json-request>',
          'check-manager-auth <manager-id> <module-name>',
          'status',
          'deadlock',
          'force-release <json-request>',
          'release-all <json-request>'
        ],
        managerDomains: Object.keys(MANAGER_DOMAINS)
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

// 모듈 내보내기
module.exports = {
  acquireLock,
  releaseLock,
  getLockStatus,
  detectDeadlock,
  forceReleaseLock,
  releaseAllLocks,
  extractModuleName,
  // Manager Lock Functions (Layer 4.5)
  acquireManagerLock,
  releaseManagerLock,
  isManagerAuthorized,
  acquireLockForWorker,
  // Constants
  KIIPS_MODULES,
  LOCK_ORDER,
  MANAGER_DOMAINS
};
