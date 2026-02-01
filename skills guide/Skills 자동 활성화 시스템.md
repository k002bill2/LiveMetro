# Skills 자동 활성화 시스템 구축 가이드
#claude-code #skills #hooks #실전팁

> 💡 **문제**: Claude가 Skills를 만들어놔도 실제로 사용하지 않음
> 
> ✅ **해결**: Hook 시스템으로 강제 활성화!

## 🎯 개요

Reddit의 u/JokeGold5455가 6개월간 300k LOC 프로젝트를 진행하면서 발견한 가장 큰 문제:
- Skills 열심히 만들어도 Claude가 **전혀 사용하지 않음**
- 키워드를 정확히 써도 무시
- 관련 파일 작업해도 Skills 로드 안 함

## 🚀 자동 활성화 시스템 구조

### 1. UserPromptSubmit Hook (프롬프트 전처리)
Claude가 메시지를 보기 **전**에 실행되어 Skills 체크 강제

### 2. Stop Event Hook (응답 후처리)
Claude 응답 **후** 실행되어 자가 검증

### 3. skill-rules.json (중앙 설정)
모든 Skill 트리거 규칙 정의

## 📝 구현 방법

### Step 1: skill-rules.json 생성

```json
{
  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": ["backend", "controller", "service", "API", "endpoint"],
      "intentPatterns": [
        "(create|add).*?(route|endpoint|controller)",
        "(how to|best practice).*?(backend|API)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["backend/src/**/*.ts"],
      "contentPatterns": ["router\\.", "export.*Controller"]
    }
  },
  
  "frontend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": ["react", "component", "hooks", "state", "UI"],
      "intentPatterns": [
        "(create|build|make).*?(component|page|screen)",
        "(fix|update).*?(UI|style|layout)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["src/components/**", "src/pages/**"],
      "contentPatterns": ["import.*React", "export.*Component"]
    }
  },
  
  "database-verification": {
    "type": "guardrail",
    "enforcement": "block",
    "priority": "critical",
    "promptTriggers": {
      "keywords": ["database", "prisma", "migration", "schema"],
      "intentPatterns": [
        ".*?(alter|modify|change).*?table",
        ".*?migration.*?"
      ]
    }
  }
}
```

### Step 2: UserPromptSubmit Hook 구현

```typescript
// .claude/hooks/userPromptSubmit.ts
import * as fs from 'fs';
import * as path from 'path';

interface SkillRule {
  type: string;
  enforcement: 'suggest' | 'require' | 'block';
  priority: string;
  promptTriggers: {
    keywords: string[];
    intentPatterns: string[];
  };
  fileTriggers?: {
    pathPatterns: string[];
    contentPatterns: string[];
  };
}

export async function onUserPromptSubmit(prompt: string, context: any) {
  const rulesPath = path.join(process.cwd(), 'skill-rules.json');
  const rules: Record<string, SkillRule> = JSON.parse(
    fs.readFileSync(rulesPath, 'utf-8')
  );
  
  const activatedSkills: string[] = [];
  
  // 프롬프트 분석
  for (const [skillName, rule] of Object.entries(rules)) {
    // 키워드 체크
    const hasKeyword = rule.promptTriggers.keywords.some(keyword => 
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // 의도 패턴 체크
    const hasIntent = rule.promptTriggers.intentPatterns.some(pattern => 
      new RegExp(pattern, 'i').test(prompt)
    );
    
    if (hasKeyword || hasIntent) {
      activatedSkills.push(skillName);
    }
  }
  
  // Skills 활성화 메시지 삽입
  if (activatedSkills.length > 0) {
    const skillMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Relevant skills for this task:
${activatedSkills.map(s => `✓ ${s}`).join('\n')}

IMPORTANT: Load and follow the guidelines from these skills.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
    
    // Claude가 보는 프롬프트 수정
    return skillMessage + '\n\n' + prompt;
  }
  
  return prompt;
}
```

### Step 3: Stop Event Hook 구현

```typescript
// .claude/hooks/stopEvent.ts
export async function onStopEvent(context: any) {
  const editedFiles = context.getEditedFiles();
  
  if (editedFiles.length === 0) return;
  
  // 리스크 패턴 검사
  const riskyPatterns = [
    { pattern: /try\s*{/, message: "Did you add error handling?" },
    { pattern: /async\s+/, message: "Are async operations properly handled?" },
    { pattern: /prisma\./, message: "Are Prisma operations wrapped in repository pattern?" },
    { pattern: /throw\s+/, message: "Is Sentry.captureException configured?" }
  ];
  
  const reminders = [];
  
  for (const file of editedFiles) {
    const content = await readFile(file);
    for (const {pattern, message} of riskyPatterns) {
      if (pattern.test(content)) {
        reminders.push(message);
      }
    }
  }
  
  if (reminders.length > 0) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ERROR HANDLING SELF-CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Changes detected in ${editedFiles.length} file(s)

Self-check questions:
${reminders.map(r => `❓ ${r}`).join('\n')}

💡 Remember: All errors should be properly handled and logged
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }
}
```

### Step 4: Build Checker Hook

```typescript
// .claude/hooks/buildChecker.ts
export async function onStopEvent(context: any) {
  const editedRepos = new Set<string>();
  
  // 수정된 레포 확인
  for (const file of context.editedFiles) {
    const repo = getRepoFromPath(file);
    if (repo) editedRepos.add(repo);
  }
  
  // 각 레포에서 빌드 실행
  for (const repo of editedRepos) {
    console.log(`🔨 Running build in ${repo}...`);
    
    const buildResult = await runCommand(`cd ${repo} && npm run build`);
    
    if (buildResult.errors.length > 0) {
      if (buildResult.errors.length < 5) {
        console.log(`
❌ TypeScript Errors Found:
${buildResult.errors.join('\n')}

Please fix these errors before continuing.
        `);
      } else {
        console.log(`
⚠️ ${buildResult.errors.length} TypeScript errors found!
Consider using the auto-error-resolver agent.
        `);
      }
    } else {
      console.log(`✅ Build successful in ${repo}`);
    }
  }
}
```

## 🎨 Skills 재구성 (500줄 제한)

### 잘못된 예 (1,500줄 단일 파일)
```
frontend-dev-guidelines/
└── SKILL.md (1,500 lines) ❌
```

### 올바른 예 (Progressive Disclosure)
```
frontend-dev-guidelines/
├── SKILL.md (398 lines)           # 메인 파일
└── resources/
    ├── react-patterns.md
    ├── hooks-guidelines.md
    ├── performance.md
    ├── accessibility.md
    ├── testing.md
    ├── state-management.md
    ├── routing.md
    ├── styling.md
    ├── error-handling.md
    └── deployment.md
```

### SKILL.md 메인 파일 구조
```markdown
---
name: frontend-dev-guidelines
description: react 19.2.4, Next.js 14, TypeScript guidelines
---

# Frontend Development Guidelines

## Quick Reference
- Component patterns → resources/react-patterns.md
- Hooks best practices → resources/hooks-guidelines.md
- Performance optimization → resources/performance.md
- Accessibility (a11y) → resources/accessibility.md
- Testing strategies → resources/testing.md

## Core Principles
1. Function components only (no class components)
2. TypeScript strict mode always
3. Suspense boundaries for async operations
4. Error boundaries for fault tolerance
5. Server Components by default (Next.js)

## Component Structure
\`\`\`tsx
// Standard component template
interface ComponentProps {
  // Props with JSDoc comments
}

export const Component: React.FC<ComponentProps> = memo(({ 
  ...props 
}) => {
  // 1. Hooks
  // 2. Derived state
  // 3. Effects
  // 4. Handlers
  // 5. Return JSX
});

Component.displayName = 'Component';
\`\`\`

[Main content under 500 lines...]
```

## 📊 실제 효과

### Before (Skills 미사용)
- Claude가 옛날 패턴 사용
- 매번 "BEST_PRACTICES.md 확인해" 반복
- 300k+ LOC에서 일관성 없는 코드
- Claude의 "창의적 해석" 수정에 시간 낭비

### After (자동 활성화)
- 일관된 패턴 자동 적용
- Claude가 코드 작성 전 자가 수정
- 가이드라인 자동 준수
- 리뷰와 수정 시간 대폭 감소

## 🛠️ 설치 및 설정

### 1. 디렉토리 구조 생성
```bash
mkdir -p .claude/hooks .claude/skills
```

### 2. Hooks 설정 (.claudecode.json)
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "script": ".claude/hooks/userPromptSubmit.ts"
      }
    ],
    "Stop": [
      {
        "script": ".claude/hooks/stopEvent.ts"
      },
      {
        "script": ".claude/hooks/buildChecker.ts"
      }
    ]
  }
}
```

### 3. TypeScript 컴파일 설정
```bash
# tsconfig.json for hooks
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true
  },
  "include": [".claude/hooks/**/*"]
}
```

## 💡 Pro Tips

### 1. Skills 우선순위 설정
```json
{
  "priority": "critical",  // 항상 체크
  "priority": "high",      // 대부분 체크
  "priority": "normal",    // 관련시만 체크
  "priority": "low"        // 명시적 요청시만
}
```

### 2. Enforcement 레벨
```json
{
  "enforcement": "block",    // 작업 차단 (DB 스키마 등)
  "enforcement": "require",  // 필수 적용
  "enforcement": "suggest"   // 권장 사항
}
```

### 3. 디버깅
```bash
# Hook 로그 확인
tail -f .claude/logs/hooks.log

# Skills 로딩 상태 확인
claude --debug-skills
```

## 🎉 결과

이 시스템을 구현한 후:
- **Skills 사용률**: 0% → 95%+
- **코드 일관성**: 40% → 90%+
- **에러 감소**: 60% 감소
- **리뷰 시간**: 70% 단축

---

*"만드는 것보다 사용하게 만드는 것이 중요하다"*

#skills-activation #hooks #automation #claude-code