/**
 * UserPromptSubmit Hook for LiveMetro
 * React Native + Firebase 개발 환경에 맞춤화된 스킬/에이전트 자동 활성화
 *
 * 사용자 프롬프트를 분석하여:
 * 1. React Native 패턴 감지 및 가이드 활성화
 * 2. Firebase 패턴 감지
 * 3. skill-rules.json 기반 스킬 활성화
 * 4. 에이전트 자동 추천 (agent-skill 연계)
 * 5. 중요 파일 감지
 *
 * @version 3.0.0-LiveMetro
 *
 * @hook-config
 * {"event": "UserPromptSubmit", "matcher": "", "command": "node .claude/hooks/userPromptSubmit.js 2>/dev/null || true"}
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RULES_PATH = path.join(PROJECT_ROOT, '.claude', 'skill-rules.json');
const AGENTS_REGISTRY_PATH = path.join(PROJECT_ROOT, '.claude', 'agents-registry.json');

// --- stdin에서 이벤트 데이터 읽기 ---
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const prompt = event?.prompt || event?.content || '';

    if (!prompt || prompt.trim().length === 0) {
      process.exit(0);
      return;
    }

    const messages = [];

    // 0. Gemini 크로스 리뷰 결과 확인
    const geminiMsg = checkPendingGeminiReviews();
    if (geminiMsg) messages.push(geminiMsg);

    // 1. React Native 패턴 감지
    const reactMsg = detectReactNativePatterns(prompt);
    if (reactMsg) messages.push(reactMsg);

    // 2. Firebase 패턴 감지
    const firebaseMsg = detectFirebasePatterns(prompt);
    if (firebaseMsg) messages.push(firebaseMsg);

    // 3. skill-rules.json 기반 스킬 활성화
    const skillMsg = activateSkills(prompt);
    if (skillMsg) messages.push(skillMsg);

    // 4. 에이전트 자동 추천
    const agentMsg = recommendAgents(prompt);
    if (agentMsg) messages.push(agentMsg);

    // 5. 중요 파일 감지
    const criticalMsg = detectCriticalFiles(prompt);
    if (criticalMsg) messages.push(criticalMsg);

    if (messages.length > 0) {
      console.log(messages.join('\n\n'));
    }

  } catch (error) {
    process.exit(0);
  }
});

// --- React Native 패턴 감지 ---
function detectReactNativePatterns(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const detectedPatterns = [];

  const patterns = [
    { keywords: ['useeffect', 'cleanup', '구독', 'subscription'], pattern: 'useEffect Cleanup' },
    { keywords: ['stylesheet', 'nativewind', '스타일'], pattern: 'StyleSheet/NativeWind' },
    { keywords: ['navigation', 'react navigation', 'navigate', '네비게이션'], pattern: 'React Navigation' },
    { keywords: ['component', 'tsx', 'jsx', '컴포넌트'], pattern: 'React Native Component' },
    { keywords: ['hook', 'custom hook', '커스텀 훅', 'usememo', 'usecallback'], pattern: 'Custom Hooks' },
    { keywords: ['expo', 'eas', '빌드'], pattern: 'Expo Build' },
    { keywords: ['jest', 'test', '테스트', 'coverage'], pattern: 'Jest Testing' },
    { keywords: ['screen', '화면', 'route'], pattern: 'Screen/Route' },
    { keywords: ['asyncstorage', 'storage', '캐시'], pattern: 'AsyncStorage Cache' }
  ];

  for (const { keywords, pattern } of patterns) {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      detectedPatterns.push(pattern);
    }
  }

  if (detectedPatterns.length === 0) return null;

  let msg = '[REACT NATIVE] Detected: ' + detectedPatterns.join(', ');

  const reminders = [];
  if (detectedPatterns.includes('useEffect Cleanup')) {
    reminders.push('useEffect cleanup 함수 필수');
  }
  if (detectedPatterns.includes('React Navigation')) {
    reminders.push('React Navigation 6.x 패턴 사용');
  }
  if (detectedPatterns.includes('StyleSheet/NativeWind')) {
    reminders.push('StyleSheet.create() 사용, 인라인 스타일 지양');
  }
  if (detectedPatterns.includes('Jest Testing')) {
    reminders.push('커버리지 75%+ 목표');
  }

  if (reminders.length > 0) {
    msg += ' | Reminders: ' + reminders.join('; ');
  }
  return msg;
}

// --- Firebase 패턴 감지 ---
function detectFirebasePatterns(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const detectedPatterns = [];

  const patterns = [
    { keywords: ['firebase', 'firebase auth', '인증'], pattern: 'Firebase Auth' },
    { keywords: ['firestore', 'collection', 'document', '컬렉션'], pattern: 'Firestore' },
    { keywords: ['cloud functions', 'functions'], pattern: 'Cloud Functions' },
    { keywords: ['firebase config', 'google-services'], pattern: 'Firebase Config' }
  ];

  for (const { keywords, pattern } of patterns) {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      detectedPatterns.push(pattern);
    }
  }

  if (detectedPatterns.length === 0) return null;

  let msg = '[FIREBASE] Detected: ' + detectedPatterns.join(', ');

  const reminders = [];
  if (detectedPatterns.includes('Firebase Auth')) {
    reminders.push('AuthContext 패턴 사용');
  }
  if (detectedPatterns.includes('Firestore')) {
    reminders.push('onSnapshot cleanup 필수, 에러 핸들링');
  }

  if (reminders.length > 0) {
    msg += ' | Reminders: ' + reminders.join('; ');
  }
  return msg;
}

// --- 중요 파일 감지 ---
function detectCriticalFiles(prompt) {
  const criticalPatterns = [
    { pattern: /app\.json|app\.config/i, file: 'App Config' },
    { pattern: /package\.json/i, file: 'Dependencies' },
    { pattern: /google-services\.json/i, file: 'Firebase Config (Android)' },
    { pattern: /firebase/i, file: 'Firebase' },
    { pattern: /\.env|config/i, file: 'Configuration' },
    { pattern: /navigation/i, file: 'Navigation' }
  ];

  const detected = [];
  for (const { pattern, file } of criticalPatterns) {
    if (pattern.test(prompt)) detected.push(file);
  }

  if (detected.length === 0) return null;
  return '[CRITICAL FILE] ' + detected.join(', ') + ' - 변경 전 테스트/백업 권장';
}

// --- skill-rules.json 기반 스킬 활성화 ---
function activateSkills(prompt) {
  if (!fs.existsSync(RULES_PATH)) return null;

  try {
    const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
    const activated = [];

    for (const [skillName, rule] of Object.entries(rules)) {
      if (shouldActivateSkill(prompt, rule)) {
        activated.push({
          name: skillName,
          priority: rule.priority || 'normal',
          enforcement: rule.enforcement || 'suggest',
          type: rule.type || 'skill'
        });
      }
    }

    const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
    activated.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    if (activated.length === 0) return null;

    const critical = activated.filter(s => s.priority === 'critical');
    const high = activated.filter(s => s.priority === 'high');
    const other = activated.filter(s => !['critical', 'high'].includes(s.priority));

    let msg = '[SKILLS ACTIVATED]';
    if (critical.length > 0) {
      msg += '\n  CRITICAL: ' + critical.map(s => s.name).join(', ');
      for (const s of critical) {
        const sf = getSkillFile(rules, s.name);
        if (sf) msg += `\n  -> Invoke: Skill tool "${s.name}" before implementing`;
      }
    }
    if (high.length > 0) {
      msg += '\n  HIGH: ' + high.map(s => s.name).join(', ');
      for (const s of high) {
        const sf = getSkillFile(rules, s.name);
        if (sf) msg += `\n  -> Invoke: Skill tool "${s.name}" before implementing`;
      }
    }
    if (other.length > 0) {
      msg += '\n  SUGGESTED: ' + other.map(s => s.name).join(', ');
    }
    return msg;
  } catch {
    return null;
  }
}

function getSkillFile(rules, skillName) {
  return rules[skillName]?.skillFile || null;
}

function shouldActivateSkill(prompt, rule) {
  const lowerPrompt = prompt.toLowerCase();

  if (rule.promptTriggers?.keywords) {
    if (rule.promptTriggers.keywords.some(kw => lowerPrompt.includes(kw.toLowerCase()))) {
      return true;
    }
  }

  if (rule.promptTriggers?.intentPatterns) {
    if (rule.promptTriggers.intentPatterns.some(pattern => {
      try { return new RegExp(pattern, 'i').test(prompt); }
      catch { return false; }
    })) {
      return true;
    }
  }

  return false;
}

// --- Gemini 크로스 리뷰 결과 확인 ---
function checkPendingGeminiReviews() {
  try {
    const stateFile = path.join(PROJECT_ROOT, '.claude', 'gemini-bridge', 'state.json');
    if (!fs.existsSync(stateFile)) return null;

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const pending = (state.pendingReviews || []).filter(r => r.status === 'completed');

    if (pending.length === 0) return null;

    const reviewsDir = path.join(PROJECT_ROOT, '.claude', 'gemini-bridge', 'reviews');
    const reviewBlocks = [];
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;

    for (const review of pending) {
      const reviewTime = new Date(review.timestamp).getTime();
      if (reviewTime < thirtyMinAgo) {
        review.status = 'stale';
        continue;
      }

      const reviewFile = path.join(reviewsDir, `${review.id}.json`);
      if (!fs.existsSync(reviewFile)) {
        review.status = 'missing';
        continue;
      }

      try {
        const reviewData = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
        if (reviewData.review) {
          const extracted = extractReviewSummary(reviewData.review);
          reviewBlocks.push(extracted);
        }
        review.status = 'shown';
      } catch (_) {
        review.status = 'read_error';
      }
    }

    state.pendingReviews = state.pendingReviews.filter(r => {
      if (['shown', 'stale', 'missing', 'read_error'].includes(r.status)) {
        const age = Date.now() - new Date(r.timestamp).getTime();
        return age < 30 * 60 * 1000;
      }
      return true;
    });

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');

    if (reviewBlocks.length === 0) return null;

    const allText = reviewBlocks.join('\n');
    const hasCritical = /severity:critical/i.test(allText);
    const hasWarning = /severity:warning/i.test(allText);
    const needsAttention = /needs-attention/i.test(allText);

    let msg = '[GEMINI REVIEW - Cross-verification by Gemini CLI]';
    for (const block of reviewBlocks) {
      msg += '\n' + block;
    }
    msg += '\n[/GEMINI REVIEW]';

    if (hasCritical) {
      msg += '\n!! Gemini가 critical 이슈를 발견했습니다. 커밋 전에 반드시 확인하세요.';
    } else if (hasWarning || needsAttention) {
      msg += '\n* Gemini가 warning 이슈를 제기했습니다. 관련 작업 시 참고하세요.';
    }

    return msg;
  } catch (_) {
    return null;
  }
}

function extractReviewSummary(reviewText) {
  const lines = reviewText.split('\n');

  let lastIssuesIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^ISSUES:/i.test(lines[i].trim())) {
      lastIssuesIdx = i;
      break;
    }
  }

  if (lastIssuesIdx >= 0) {
    const block = lines.slice(lastIssuesIdx);
    const hasVerdict = block.some(l => /^VERDICT:/i.test(l.trim()));
    const hasSummary = block.some(l => /^SUMMARY:/i.test(l.trim()));

    if (hasVerdict) {
      if (hasSummary) {
        const summaryIdx = block.findIndex(l => /^SUMMARY:/i.test(l.trim()));
        return block.slice(0, summaryIdx + 1).join('\n').trim();
      }
      const verdictIdx = block.findIndex(l => /^VERDICT:/i.test(l.trim()));
      return block.slice(0, verdictIdx + 1).join('\n').trim();
    }
  }

  const verdictIdx = lines.findIndex(l => /^VERDICT:/i.test(l.trim()));
  if (verdictIdx >= 0) {
    const start = Math.max(0, verdictIdx - 5);
    const end = Math.min(lines.length, verdictIdx + 3);
    return lines.slice(start, end).join('\n').trim();
  }

  if (reviewText.length > 500) {
    return '...' + reviewText.slice(-500).trim();
  }
  return reviewText.trim();
}

// --- 에이전트 자동 추천 ---
function recommendAgents(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const recommended = [];

  // /resume 커맨드는 commands/resume.md가 자체적으로 context를 로드함

  if (fs.existsSync(RULES_PATH)) {
    try {
      const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
      for (const [name, rule] of Object.entries(rules)) {
        if (rule.agentFile && shouldActivateSkill(prompt, rule)) {
          recommended.push({
            agent: path.basename(rule.agentFile, '.md'),
            reason: `skill:${name}`,
            model: rule.model || 'haiku'
          });
        }
      }
    } catch {}
  }

  if (recommended.length === 0) return null;

  const unique = [...new Map(recommended.map(r => [r.agent, r])).values()];

  let msg = '[AGENT RECOMMENDATION]';
  for (const r of unique) {
    msg += `\n  -> ${r.agent} (${r.model}) [${r.reason}]`;
  }
  return msg;
}
