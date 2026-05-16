#!/usr/bin/env node
// docEnforcer.js — 조건부 필수 문서 참조 강제
// UserPromptSubmit 훅: 프롬프트 키워드 감지 → 필수 Read 지시 주입

const fs = require('fs');

let input;
try {
  input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
} catch {
  process.exit(0);
}

const prompt = (input.prompt || input.message || '').toLowerCase();

if (!prompt) {
  process.exit(0);
}

// LiveMetro 도메인 키워드 → 실제 존재 문서 매핑.
// 이전 버전은 다른 프로젝트(LangGraph 백엔드)의 fastapi/sqlalchemy/ontology
// 등을 가리키고 있어 모든 doc이 미존재 + 키워드도 무관. (G5 follow-up)
//
// 매 규칙의 `doc` 경로는 git tracked file이어야 함 — 미존재 시 docEnforcer가
// 잘못된 안내를 노출.
const rules = [
  {
    keywords: ['firebase', 'firestore', 'auth', '인증', 'cloud functions',
               '클라우드 함수', 'firestore.rules', 'firebase auth'],
    doc: 'docs/FIREBASE_SETUP.md',
    label: 'FIREBASE',
    desc: 'Firebase Auth / Firestore / Cloud Functions 설정'
  },
  {
    keywords: ['아키텍처', 'architecture', 'navigation', '네비게이션',
               '상태 관리', 'state management', 'authcontext', 'data flow',
               '데이터 흐름'],
    doc: 'docs/claude/architecture.md',
    label: 'ARCHITECTURE',
    desc: '데이터 흐름, 네비게이션, 상태 관리'
  },
  {
    keywords: ['seoul api', '서울 api', 'rate limit', '폴링', 'polling',
               'realtimearrival', 'firestore collection', 'arrivalservice',
               'datamanager'],
    doc: 'docs/claude/api-reference.md',
    label: 'API',
    desc: 'Seoul Metro API + Firebase collections + arrivalService 계약'
  },
  {
    keywords: ['새 화면', 'new screen', '새 hook', 'new hook', 'new service',
               '커스텀 hook', 'custom hook', '서비스 추가', 'service 추가',
               'add screen', 'add hook', 'add service'],
    doc: 'docs/claude/development-patterns.md',
    label: 'PATTERNS',
    desc: '화면/훅/서비스 추가 패턴 + 경로 별칭'
  },
  {
    keywords: ['jest 설정', 'rntl', 'coverage 임계값', 'coverage threshold',
               'mock pattern', '테스트 환경', 'test setup', 'test config'],
    doc: 'docs/claude/testing.md',
    label: 'TESTING',
    desc: 'Jest 설정, 커버리지 임계값, RNTL 테스트 패턴'
  },
  {
    keywords: ['expo build', 'eas build', 'deployment', '배포', 'production build',
               'release', 'sdk upgrade'],
    doc: 'docs/DEVELOPMENT.md',
    label: 'BUILD',
    desc: 'Expo / EAS Build / 배포 가이드'
  }
];

const matched = rules.filter(rule =>
  rule.keywords.some(kw => prompt.includes(kw))
);

if (matched.length > 0) {
  const lines = [
    '## 필수 문서 참조 (docEnforcer 감지)',
    '아래 문서를 코드 수정 전 반드시 Read 도구로 읽으세요:',
    ''
  ];
  matched.forEach(m => {
    lines.push(`- **[${m.label}]** \`${m.doc}\` — ${m.desc}`);
  });
  lines.push('');
  lines.push('문서를 읽지 않고 코드를 수정하면 기존 패턴/구조와 충돌할 수 있습니다.');
  console.log(lines.join('\n'));
}
