/**
 * UserPromptSubmit Hook
 * ACE Framework Layer 2 (Global Strategy) & Layer 3 (Agent Model) & Layer 4.5 (Manager Orchestration) 통합
 *
 * Claude가 사용자 프롬프트를 보기 전에 실행되어:
 * 1. ACE Framework 컨텍스트 주입 (Layer 1-6)
 * 2. Agent 능력 매칭 (Layer 3)
 * 3. 작업 분해 제안 (Layer 4)
 * 4. Manager Agent 감지 및 라우팅 (Layer 4.5) ★ NEW
 * 5. skill-rules.json 기반 Skill 강제 활성화
 * 6. KiiPS 모듈 보호 경고
 *
 * @version 4.0.0-KiiPS (Manager Agents 지원)
 * @layer Layer 2 (Global Strategy), Layer 3 (Agent Model), Layer 4.5 (Manager Orchestration)
 */

const fs = require('fs');
const path = require('path');

// ACE Framework 경로
const ACE_CONFIG_PATH = path.join(__dirname, '../ace-framework/ace-config.json');
const LAYER3_PATH = path.join(__dirname, '../ace-framework/layer3-agent-model.json');
const LAYER4_PATH = path.join(__dirname, '../ace-framework/layer4-executive.md');

/**
 * Hook entry point
 * @param {string} prompt - 사용자의 원본 프롬프트
 * @param {object} context - Hook 실행 컨텍스트
 * @returns {string} - 수정된 프롬프트 (Skills 활성화 메시지 포함)
 */
async function onUserPromptSubmit(prompt, context) {
  try {
    const projectRoot = context.workspaceRoot || process.cwd();
    const messages = [];

    // 1. ACE Framework 컨텍스트 주입
    const aceContext = loadAceContext(projectRoot);
    if (aceContext) {
      messages.push(aceContext);
    }

    // 2. 에이전트 능력 확인 (Layer 3)
    const agentCapabilities = checkAgentCapabilities(prompt);
    if (agentCapabilities) {
      messages.push(agentCapabilities);
    }

    // 3. 작업 분해 힌트 (Layer 4)
    const taskDecomposition = suggestTaskDecomposition(prompt);
    if (taskDecomposition) {
      messages.push(taskDecomposition);
    }

    // 4. Manager Agent 감지 (Layer 4.5)
    const managerRouting = await detectManagerAgent(prompt, projectRoot);
    if (managerRouting) {
      messages.push(managerRouting);
    }

    // 5. skill-rules.json 기반 스킬 활성화
    const skillActivation = await activateSkills(prompt, projectRoot);
    if (skillActivation) {
      messages.push(skillActivation);
    }

    // 6. KiiPS 모듈 감지
    const moduleContext = detectKiipsModules(prompt);
    if (moduleContext) {
      messages.push(moduleContext);
    }

    // 메시지가 있으면 프롬프트 앞에 추가
    if (messages.length > 0) {
      return messages.join('\n\n') + '\n\n' + prompt;
    }

    return prompt;

  } catch (error) {
    console.error('[UserPromptSubmit] Error:', error.message);
    // 에러가 발생해도 원본 프롬프트는 반환하여 작업 중단 방지
    return prompt;
  }
}

/**
 * ACE Framework 컨텍스트 로드
 */
function loadAceContext(projectRoot) {
  try {
    if (!fs.existsSync(ACE_CONFIG_PATH)) {
      return null;
    }

    const aceConfig = JSON.parse(fs.readFileSync(ACE_CONFIG_PATH, 'utf8'));

    // ACE가 비활성화된 경우
    if (!aceConfig.aceFramework?.enabled) {
      return null;
    }

    // Primary Coordinator 역할 확인
    const isPrimary = aceConfig.agentHierarchy?.primary?.id === 'primary-coordinator';

    let context = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    context += '🔷 ACE FRAMEWORK ACTIVE\n';
    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    context += `**Version**: ${aceConfig.version}\n`;
    context += `**Agent Role**: ${isPrimary ? 'Primary Coordinator' : 'Agent'}\n`;
    context += `**Active Layers**: ${aceConfig.aceFramework.layers.filter(l => l.enabled).map(l => l.name).join(', ')}\n\n`;

    context += '**Layer Responsibilities:**\n';
    context += '• L1 Aspirational: 윤리적 검증 (자동)\n';
    context += '• L2 Global Strategy: 목표 정의 ← 현재\n';
    context += '• L3 Agent Model: 능력 매칭\n';
    context += '• L4 Executive: 작업 분해\n';
    context += '• L5 Cognitive Control: 실행 제어\n';
    context += '• L6 Task Prosecution: 실제 실행\n';
    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return context;

  } catch (error) {
    console.error('[UserPromptSubmit] ACE context error:', error.message);
    return null;
  }
}

/**
 * 에이전트 능력 확인 (Layer 3)
 */
function checkAgentCapabilities(prompt) {
  try {
    if (!fs.existsSync(LAYER3_PATH)) {
      return null;
    }

    const layer3 = JSON.parse(fs.readFileSync(LAYER3_PATH, 'utf8'));
    const taskTypes = layer3.capability_matching?.task_types || {};

    // 프롬프트에서 작업 유형 감지
    const detectedTasks = [];
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('빌드') || lowerPrompt.includes('build') || lowerPrompt.includes('maven')) {
      detectedTasks.push('build');
    }
    if (lowerPrompt.includes('배포') || lowerPrompt.includes('deploy') || lowerPrompt.includes('start')) {
      detectedTasks.push('deploy');
    }
    if (lowerPrompt.includes('테스트') || lowerPrompt.includes('test') || lowerPrompt.includes('api')) {
      detectedTasks.push('api_test');
    }
    if (lowerPrompt.includes('아키텍처') || lowerPrompt.includes('설계') || lowerPrompt.includes('architecture')) {
      detectedTasks.push('architecture_review');
    }
    if (lowerPrompt.includes('로그') || lowerPrompt.includes('log') || lowerPrompt.includes('디버그')) {
      detectedTasks.push('log_analysis');
    }

    if (detectedTasks.length === 0) {
      return null;
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎯 LAYER 3: AGENT CAPABILITY MATCH\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    message += '**Detected Task Types:**\n';
    for (const task of detectedTasks) {
      const agents = taskTypes[task] || [];
      message += `• ${task}: ${agents.join(', ') || 'No specific agent'}\n`;
    }

    message += '\n**Recommendation:**\n';
    if (detectedTasks.includes('build') || detectedTasks.includes('deploy')) {
      message += '→ Use kiips-developer agent with appropriate skills\n';
    }
    if (detectedTasks.includes('architecture_review')) {
      message += '→ Consult kiips-architect for design decisions\n';
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return message;

  } catch (error) {
    console.error('[UserPromptSubmit] Layer 3 error:', error.message);
    return null;
  }
}

/**
 * 작업 분해 제안 (Layer 4)
 */
function suggestTaskDecomposition(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // 복잡한 작업 패턴 감지
  const complexPatterns = [
    { pattern: /전체.*빌드|all.*build|모든.*서비스/i, type: 'multi_service_build' },
    { pattern: /배포.*실행|deploy.*and.*run/i, type: 'build_and_deploy' },
    { pattern: /새.*기능|new.*feature|feature.*개발/i, type: 'feature_development' },
    { pattern: /리팩토링|refactor|코드.*개선/i, type: 'code_refactoring' }
  ];

  let matchedType = null;
  for (const { pattern, type } of complexPatterns) {
    if (pattern.test(prompt)) {
      matchedType = type;
      break;
    }
  }

  if (!matchedType) {
    return null;
  }

  let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '📋 LAYER 4: TASK DECOMPOSITION HINT\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += `**Detected Complex Task**: ${matchedType}\n\n`;
  message += '**Suggested Decomposition:**\n';

  switch (matchedType) {
    case 'multi_service_build':
      message += '① SVN 업데이트 (모든 모듈)\n';
      message += '② 의존성 빌드 (COMMON → UTILS)\n';
      message += '③ 서비스 병렬 빌드 (Task tool 병렬 호출)\n';
      message += '④ 빌드 결과 통합 검증\n';
      break;
    case 'build_and_deploy':
      message += '① 현재 서비스 상태 확인\n';
      message += '② SVN 업데이트 및 빌드\n';
      message += '③ 기존 서비스 중지\n';
      message += '④ 새 버전 배포 및 시작\n';
      message += '⑤ 헬스체크 검증\n';
      break;
    case 'feature_development':
      message += '① 요구사항 분석 (kiips-architect 협의)\n';
      message += '② 설계 검토 및 승인\n';
      message += '③ 구현 (kiips-developer)\n';
      message += '④ 테스트 (kiips-api-tester)\n';
      message += '⑤ 코드 리뷰 및 체크리스트 (checklist-generator)\n';
      break;
    case 'code_refactoring':
      message += '① 현재 코드 분석\n';
      message += '② 리팩토링 계획 수립\n';
      message += '③ 테스트 커버리지 확인\n';
      message += '④ 점진적 변경 적용\n';
      message += '⑤ 회귀 테스트\n';
      break;
  }

  message += '\n**Note:** Primary Coordinator가 작업을 조정합니다.\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

/**
 * Manager Agent 감지 (Layer 4.5)
 */
async function detectManagerAgent(prompt, projectRoot) {
  try {
    const rulesPath = path.join(projectRoot, 'skill-rules.json');
    const aceConfigPath = path.join(projectRoot, '.claude/ace-framework/ace-config.json');

    // skill-rules.json과 ace-config.json 존재 확인
    if (!fs.existsSync(rulesPath) || !fs.existsSync(aceConfigPath)) {
      return null;
    }

    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const aceConfig = JSON.parse(fs.readFileSync(aceConfigPath, 'utf8'));

    // Manager Agents 기능이 비활성화된 경우
    if (!aceConfig.featureFlags?.enableManagerAgents) {
      return null;
    }

    const lowerPrompt = prompt.toLowerCase();

    // Manager 도메인 감지 규칙
    const managerDetectionRules = [
      {
        manager: 'build-manager',
        keywords: ['빌드', 'build', 'maven', 'compile', 'package', 'mvn'],
        patterns: [
          /빌드.*?(해|해줘|해주세요|하자)/,
          /(build|compile|package).*?(service|module|project)/i,
          /KiiPS-(FD|IL|PG|AC|SY|LP|EL|RT|BATCH|MOBILE|KSD|AI).*?(빌드|build)/i,
          /(전체|모든|all).*?(빌드|build)/i
        ],
        skills: ['kiips-maven-builder']
      },
      {
        manager: 'deployment-manager',
        keywords: ['배포', 'deploy', 'start', 'stop', 'restart', '시작', '중지', '재시작'],
        patterns: [
          /(배포|deploy|start|stop|restart).*?(해|해줘|해주세요)/,
          /(서비스|service).*?(시작|중지|재시작|start|stop|restart)/i,
          /health.*?check/i,
          /(로그|log).*?(확인|분석|check|analyze)/i
        ],
        skills: ['kiips-service-deployer', 'kiips-api-tester', 'kiips-log-analyzer']
      },
      {
        manager: 'feature-manager',
        keywords: ['기능', 'feature', '개발', '구현', 'implement'],
        patterns: [
          /(새로운|new).*?(기능|feature)/i,
          /(기능|feature).*?(개발|개발해|추가|구현)/i,
          /(feature|기능).*?(plan|계획)/i
        ],
        skills: ['kiips-feature-planner']
      },
      {
        manager: 'ui-manager',
        keywords: ['UI', '화면', '페이지', '그리드', '차트', 'JSP', 'RealGrid', 'ApexCharts', '반응형', '접근성'],
        patterns: [
          /(UI|화면|페이지|컴포넌트).*?(만들|생성|개발|create)/i,
          /(그리드|grid).*?(만들|생성|설정)/i,
          /(차트|chart).*?(추가|생성)/i,
          /RealGrid.*?(설정|config|setup)/i,
          /(반응형|responsive|접근성|WCAG|a11y).*?(검증|테스트|check)/i
        ],
        skills: ['kiips-ui-component-builder', 'kiips-realgrid-builder', 'kiips-responsive-validator', 'kiips-a11y-checker', 'kiips-scss-theme-manager']
      }
    ];

    // 프롬프트에서 Manager 감지
    let detectedManager = null;
    let matchedSkills = [];
    let complexity = 'simple'; // simple | complex | multi_service

    for (const rule of managerDetectionRules) {
      // 키워드 매칭
      const hasKeyword = rule.keywords.some(kw => lowerPrompt.includes(kw));

      // 패턴 매칭
      const hasPattern = rule.patterns.some(pattern => pattern.test(prompt));

      if (hasKeyword || hasPattern) {
        detectedManager = rule.manager;
        matchedSkills = rule.skills;
        break;
      }
    }

    // Manager가 감지되지 않으면 종료
    if (!detectedManager) {
      return null;
    }

    // 복잡도 판단
    if (/(전체|모든|all|multi|multiple|여러)/.test(lowerPrompt)) {
      complexity = 'multi_service';
    } else if (/(FD.*IL|FD.*PG|IL.*PG)/.test(prompt)) {
      complexity = 'multi_service'; // 여러 서비스 언급
    } else if (/(배포.*테스트|build.*deploy|빌드.*배포)/.test(lowerPrompt)) {
      complexity = 'complex'; // 멀티 단계
    }

    // Manager 라우팅 메시지 생성
    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎛️  LAYER 4.5: MANAGER AGENT ROUTING\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    message += `**Detected Manager**: ${detectedManager}\n`;
    message += `**Task Complexity**: ${complexity}\n`;
    message += `**Managed Skills**: ${matchedSkills.join(', ')}\n\n`;

    // Manager별 역할 설명
    const managerRoles = {
      'build-manager': {
        role: 'Maven Multi-Module 빌드 조정',
        capabilities: [
          '의존성 해결 (COMMON → UTILS → services)',
          '병렬 빌드 그룹 식별 및 조정',
          '빌드 실패 자동 복구',
          'Worker 진행 상황 집계'
        ],
        delegatesTo: 'kiips-developer (Maven 실행)',
        keyValue: '병렬 빌드로 2.6배 속도 향상'
      },
      'deployment-manager': {
        role: '서비스 배포 파이프라인 조정',
        capabilities: [
          '6단계 배포 파이프라인 (pre-check → stop → start → health → log → post-check)',
          '헬스체크 검증 조정',
          '로그 분석 감독',
          '자동 롤백 관리 (3회 재시도 후)'
        ],
        delegatesTo: 'Primary (service control), kiips-developer (testing)',
        keyValue: '자동 롤백으로 무중단 배포 실현'
      },
      'feature-manager': {
        role: '기능 개발 라이프사이클 조정',
        capabilities: [
          '5단계 체크포인트 강제 (Requirements → Architecture → Implementation → Testing → Integration)',
          '단계별 handoff (architect → developer → QA)',
          'dev docs 관리 (plan.md, context.md, tasks.md)',
          'Backend + Frontend 병렬 개발 조정'
        ],
        delegatesTo: 'kiips-architect, kiips-developer, kiips-ui-designer, checklist-generator',
        keyValue: '구조화된 라이프사이클, 품질 체크포인트 강제'
      },
      'ui-manager': {
        role: 'UI/UX 개발 워크플로우 및 검증 파이프라인 조정',
        capabilities: [
          '5단계 검증 파이프라인 (구현 → 반응형 → 접근성 → 크로스브라우저 → 성능)',
          'RealGrid 2.6.3 전문 설정 감독',
          'WCAG 2.1 AA 준수 강제',
          '템플릿 기반 컴포넌트 생성 조정'
        ],
        delegatesTo: 'kiips-ui-designer, kiips-developer, checklist-generator',
        keyValue: 'Production-ready UI with automated validation'
      }
    };

    const managerInfo = managerRoles[detectedManager];
    if (managerInfo) {
      message += `**Manager Role**: ${managerInfo.role}\n\n`;
      message += '**Capabilities**:\n';
      managerInfo.capabilities.forEach(cap => {
        message += `  • ${cap}\n`;
      });
      message += `\n**Delegates To**: ${managerInfo.delegatesTo}\n`;
      message += `**Key Value**: ${managerInfo.keyValue}\n\n`;
    }

    // 복잡도별 권장사항
    message += '**Recommendation**:\n';
    switch (complexity) {
      case 'multi_service':
        message += '→ Manager가 병렬 또는 순차 조정으로 시간 최적화\n';
        message += '→ 워커들의 진행 상황 집계 및 Primary 보고\n';
        break;
      case 'complex':
        message += '→ Manager가 멀티 단계 워크플로우 조정\n';
        message += '→ 각 단계별 체크포인트 강제\n';
        break;
      default:
        message += `→ Manager가 ${detectedManager}의 도메인 전문성으로 작업 조정\n`;
    }

    message += '\n**IMPORTANT**: Manager는 워크플로우를 조정하며, 실제 실행은 Worker에게 위임합니다.\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return message;

  } catch (error) {
    console.error('[UserPromptSubmit] Manager detection error:', error.message);
    return null;
  }
}

/**
 * KiiPS 모듈 감지
 */
function detectKiipsModules(prompt) {
  const modulePattern = /KiiPS-([A-Z]{2,10})/gi;
  const matches = prompt.match(modulePattern) || [];
  const uniqueModules = [...new Set(matches.map(m => m.toUpperCase()))];

  if (uniqueModules.length === 0) {
    return null;
  }

  let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '📦 KIIPS MODULE DETECTED\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += `**Target Modules**: ${uniqueModules.join(', ')}\n\n`;

  // 보호된 모듈 경고
  const protectedModules = ['KIIPS-HUB', 'KIIPS-COMMON', 'KIIPS-UTILS', 'KIIPS-APIGATEWAY', 'KIIPS-LOGIN'];
  const targetProtected = uniqueModules.filter(m => protectedModules.includes(m));

  if (targetProtected.length > 0) {
    message += `⚠️  **Protected Modules**: ${targetProtected.join(', ')}\n`;
    message += '   Primary Coordinator만 직접 수정 가능합니다.\n';
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

/**
 * 스킬 활성화 (기존 로직 유지)
 */
async function activateSkills(prompt, projectRoot) {
  const rulesPath = path.join(projectRoot, 'skill-rules.json');

  if (!fs.existsSync(rulesPath)) {
    console.log('[UserPromptSubmit] skill-rules.json not found, skipping skill activation');
    return null;
  }

  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  const rules = JSON.parse(rulesContent);

  // 활성화할 스킬 목록
  const activatedSkills = [];

  // 각 스킬 규칙 검사
  for (const [skillName, rule] of Object.entries(rules)) {
    if (shouldActivateSkill(prompt, rule)) {
      activatedSkills.push({
        name: skillName,
        priority: rule.priority,
        enforcement: rule.enforcement
      });
    }
  }

  // 우선순위별 정렬 (critical > high > normal > low)
  const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
  activatedSkills.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Skills 활성화 메시지 생성
  if (activatedSkills.length > 0) {
    return generateActivationMessage(activatedSkills);
  }

  return null;
}

/**
 * 스킬 활성화 여부 판단
 */
function shouldActivateSkill(prompt, rule) {
  const lowerPrompt = prompt.toLowerCase();

  // 키워드 체크
  if (rule.promptTriggers && rule.promptTriggers.keywords) {
    const hasKeyword = rule.promptTriggers.keywords.some(keyword =>
      lowerPrompt.includes(keyword.toLowerCase())
    );
    if (hasKeyword) return true;
  }

  // 의도 패턴 체크 (정규식)
  if (rule.promptTriggers && rule.promptTriggers.intentPatterns) {
    const hasIntent = rule.promptTriggers.intentPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(prompt);
      } catch (e) {
        console.error(`[UserPromptSubmit] Invalid regex pattern: ${pattern}`);
        return false;
      }
    });
    if (hasIntent) return true;
  }

  return false;
}

/**
 * 스킬 활성화 메시지 생성
 */
function generateActivationMessage(skills) {
  const criticalSkills = skills.filter(s => s.priority === 'critical');
  const highSkills = skills.filter(s => s.priority === 'high');
  const otherSkills = skills.filter(s => s.priority !== 'critical' && s.priority !== 'high');

  let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '🎯 SKILL ACTIVATION CHECK (Layer 6)\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  if (criticalSkills.length > 0) {
    message += '🔴 **CRITICAL** - Must follow:\n';
    criticalSkills.forEach(skill => {
      const icon = skill.enforcement === 'block' ? '🚫' : '⚠️';
      message += `${icon} ${skill.name}\n`;
    });
    message += '\n';
  }

  if (highSkills.length > 0) {
    message += '🟡 **HIGH PRIORITY** - Strongly recommended:\n';
    highSkills.forEach(skill => {
      message += `✓ ${skill.name}\n`;
    });
    message += '\n';
  }

  if (otherSkills.length > 0) {
    message += '🟢 **SUGGESTED**:\n';
    otherSkills.forEach(skill => {
      message += `• ${skill.name}\n`;
    });
    message += '\n';
  }

  message += '**IMPORTANT**: Load and follow the guidelines from these skills.\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

// Export for Claude Code Hook system
module.exports = { onUserPromptSubmit };
