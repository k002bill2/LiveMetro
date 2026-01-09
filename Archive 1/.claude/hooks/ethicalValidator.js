/**
 * Ethical Validator Hook for ACE Framework
 * Layer 1 (Aspirational) 윤리적 검증 Hook
 *
 * PreToolUse 이벤트에서 실행되어 위험 작업을 사전 차단합니다.
 *
 * @version 3.0.1-KiiPS
 * @layer Layer 1 (Aspirational)
 */

const fs = require('fs');
const path = require('path');

// ACE Framework 설정 경로
const ACE_CONFIG_PATH = path.join(__dirname, '../ace-framework/ace-config.json');
const LAYER1_PATH = path.join(__dirname, '../ace-framework/layer1-aspirational.md');
const TELEMETRY_DIR = path.join(__dirname, '../ace-framework/telemetry');

/**
 * 차단된 작업 패턴 (Layer 1 기반)
 */
const BLOCKED_OPERATIONS = {
  database: {
    patterns: [
      /DROP\s+(TABLE|DATABASE|INDEX)/i,
      /TRUNCATE\s+TABLE/i,
      /DELETE\s+FROM\s+\w+\s*(?:WHERE\s+1\s*=\s*1)?$/i, // DELETE without proper WHERE
      /ALTER\s+TABLE.*DROP/i,
      /--\s*production|prod\s*database/i
    ],
    message: '데이터베이스 구조 변경 또는 대량 삭제는 차단됩니다.',
    severity: 'CRITICAL'
  },
  filesystem: {
    patterns: [
      /rm\s+-rf\s+[\/~]/,
      /rmdir\s+\/s\s+\/q/i,
      /del\s+\/f\s+\/s\s+\/q/i,
      /\>\s*\/dev\/null\s*2>&1/
    ],
    message: '시스템 전체 파일 삭제는 차단됩니다.',
    severity: 'CRITICAL'
  },
  deployment: {
    patterns: [
      /--force\s+push.*main|master/i,
      /git\s+push\s+--force\s+origin\s+(main|master)/i,
      /kubectl\s+delete\s+--all/i,
      /docker\s+system\s+prune\s+-a\s+-f/i
    ],
    message: '강제 배포 또는 전체 삭제 작업은 차단됩니다.',
    severity: 'HIGH'
  },
  credentials: {
    patterns: [
      /password\s*=\s*["'][^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i,
      /bearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/i
    ],
    message: '하드코딩된 자격 증명은 차단됩니다.',
    severity: 'HIGH'
  }
};

/**
 * 경고 수준 작업 패턴 (사용자 확인 필요)
 */
const WARNING_OPERATIONS = {
  production: {
    patterns: [
      /app-kiips\.properties/i,
      /production|prod/i,
      /--env\s*(=\s*)?prod/i
    ],
    message: '프로덕션 환경 변경이 감지되었습니다. 계속하시겠습니까?'
  },
  bulkData: {
    patterns: [
      /UPDATE\s+\w+\s+SET\s+.*WHERE/i,
      /INSERT\s+INTO\s+.*SELECT/i,
      /BATCH\s+INSERT/i
    ],
    message: '대량 데이터 작업이 감지되었습니다. 백업을 확인하셨습니까?'
  },
  schema: {
    patterns: [
      /ALTER\s+TABLE/i,
      /CREATE\s+INDEX/i,
      /ADD\s+COLUMN/i
    ],
    message: '스키마 변경 작업입니다. DBA 승인이 필요할 수 있습니다.'
  }
};

/**
 * KiiPS 서비스 모듈 보호 패턴
 */
const PROTECTED_MODULES = [
  'KiiPS-HUB',
  'KiiPS-COMMON',
  'KiiPS-UTILS',
  'KiiPS-APIGateway',
  'KiiPS-Login'
];

/**
 * 윤리적 검증 수행
 *
 * @param {string} toolName - 실행할 도구 이름
 * @param {object} toolInput - 도구 입력 파라미터
 * @param {object} context - 실행 컨텍스트
 * @returns {object} 검증 결과 { allowed: boolean, message?: string, warnings?: string[] }
 */
function validateEthically(toolName, toolInput, context) {
  const result = {
    allowed: true,
    warnings: [],
    blockedReasons: [],
    layer: 'Layer 1 (Aspirational)',
    timestamp: new Date().toISOString()
  };

  // 입력 내용 추출
  const content = extractContent(toolName, toolInput);
  if (!content) {
    return result;
  }

  // 1. 차단 패턴 검사 (CRITICAL)
  for (const [category, config] of Object.entries(BLOCKED_OPERATIONS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(content)) {
        result.allowed = false;
        result.blockedReasons.push({
          category,
          severity: config.severity,
          message: config.message,
          pattern: pattern.toString()
        });
      }
    }
  }

  // 2. 경고 패턴 검사 (WARNING)
  for (const [category, config] of Object.entries(WARNING_OPERATIONS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(content)) {
        result.warnings.push({
          category,
          message: config.message
        });
      }
    }
  }

  // 3. 보호된 모듈 접근 검사
  const moduleAccess = checkProtectedModuleAccess(toolName, toolInput, context);
  if (moduleAccess.restricted) {
    result.warnings.push({
      category: 'protected_module',
      message: moduleAccess.message
    });
  }

  // 4. 텔레메트리 기록
  recordEthicalValidation(result, toolName, toolInput);

  return result;
}

/**
 * 도구 입력에서 검증할 내용 추출
 */
function extractContent(toolName, toolInput) {
  switch (toolName.toLowerCase()) {
    case 'bash':
      return toolInput.command || '';
    case 'edit':
    case 'write':
      return (toolInput.content || '') + ' ' + (toolInput.file_path || '');
    case 'read':
    case 'glob':
    case 'grep':
      return toolInput.file_path || toolInput.pattern || '';
    default:
      return JSON.stringify(toolInput);
  }
}

/**
 * 보호된 모듈 접근 검사
 */
function checkProtectedModuleAccess(toolName, toolInput, context) {
  const agentId = context.agentId || 'unknown';
  const isPrimary = agentId === 'primary-coordinator';

  // 편집/쓰기 작업에서만 검사
  if (!['edit', 'write'].includes(toolName.toLowerCase())) {
    return { restricted: false };
  }

  const filePath = toolInput.file_path || '';

  for (const moduleName of PROTECTED_MODULES) {
    if (filePath.includes(moduleName)) {
      if (!isPrimary) {
        return {
          restricted: true,
          message: `${moduleName}은 Primary Coordinator만 수정할 수 있습니다. 제안 형태로 변경해주세요.`
        };
      }
    }
  }

  return { restricted: false };
}

/**
 * 윤리 검증 결과 텔레메트리 기록
 */
function recordEthicalValidation(result, toolName, toolInput) {
  try {
    if (!fs.existsSync(TELEMETRY_DIR)) {
      fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    }

    const logFile = path.join(TELEMETRY_DIR, `ethical-${new Date().toISOString().split('T')[0]}.jsonl`);
    const logEntry = {
      timestamp: result.timestamp,
      layer: result.layer,
      tool: toolName,
      allowed: result.allowed,
      warningCount: result.warnings.length,
      blockedCount: result.blockedReasons.length
    };

    // 차단된 경우만 상세 기록
    if (!result.allowed) {
      logEntry.blockedReasons = result.blockedReasons;
    }

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (error) {
    // 텔레메트리 실패해도 검증은 계속
    console.error('[EthicalValidator] Telemetry error:', error.message);
  }
}

/**
 * 검증 결과를 사용자 메시지로 포맷
 */
function formatValidationResult(result) {
  if (result.allowed && result.warnings.length === 0) {
    return null; // 문제 없음
  }

  let message = '';

  if (!result.allowed) {
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🛑 ETHICAL VETO - Layer 1 Violation\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const reason of result.blockedReasons) {
      message += `❌ [${reason.severity}] ${reason.category}\n`;
      message += `   ${reason.message}\n\n`;
    }

    message += '**대안:**\n';
    message += '• 스테이징 환경에서 먼저 테스트\n';
    message += '• 백업 후 진행\n';
    message += '• DBA/관리자 승인 후 수동 실행\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  }

  if (result.warnings.length > 0) {
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '⚠️  ETHICAL WARNING - Review Required\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const warning of result.warnings) {
      message += `⚠️  [${warning.category}] ${warning.message}\n`;
    }

    message += '\n진행하시겠습니까? (Y/N)\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  }

  return message;
}

/**
 * PreToolUse Hook Entry Point
 *
 * @param {object} event - Hook 이벤트 객체
 * @returns {object} { decision: 'allow'|'block', message?: string }
 */
async function onPreToolUse(event) {
  try {
    const { tool_name, tool_input } = event;
    const context = {
      agentId: event.agent_id || process.env.CLAUDE_AGENT_ID || 'primary-coordinator',
      workspaceRoot: event.workspace_root || process.cwd()
    };

    const validationResult = validateEthically(tool_name, tool_input, context);

    if (!validationResult.allowed) {
      return {
        decision: 'block',
        message: formatValidationResult(validationResult)
      };
    }

    if (validationResult.warnings.length > 0) {
      // 경고가 있어도 일단 허용, 메시지만 표시
      console.log(formatValidationResult(validationResult));
    }

    return { decision: 'allow' };

  } catch (error) {
    console.error('[EthicalValidator] Error:', error.message);
    // 에러 발생 시 안전하게 허용 (fail-open)
    return { decision: 'allow' };
  }
}

/**
 * ACE Framework Layer 1 원칙 로드
 */
function loadAspirationPrinciples() {
  try {
    if (fs.existsSync(LAYER1_PATH)) {
      return fs.readFileSync(LAYER1_PATH, 'utf8');
    }
  } catch (error) {
    console.error('[EthicalValidator] Cannot load Layer 1:', error.message);
  }
  return null;
}

// Export for Claude Code Hook system
module.exports = {
  onPreToolUse,
  validateEthically,
  formatValidationResult,
  BLOCKED_OPERATIONS,
  WARNING_OPERATIONS,
  PROTECTED_MODULES
};
