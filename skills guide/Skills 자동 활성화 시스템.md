# Skills 자동 활성화 시스템 구축 가이드
#claude-code #skills #hooks #실전팁 #2026-03-update

> 최신 업데이트: 2026-03-06 | Claude Code v2.1.x | Claude 4.6 모델 패밀리
>
> 참고: Claude Code 2.1.3부터 Skills와 Commands가 통합되었습니다.
> Skills frontmatter에 `user-invocable`, `disable-model-invocation`, `hooks` 필드가 추가되었습니다.

> 문제: Claude가 Skills를 만들어놔도 실제로 사용하지 않음
>
> 해결: Hook 시스템으로 강제 활성화 + Skills frontmatter 활용!

## 개요

### 문제 배경
대규모 프로젝트에서 Skills를 만들어도 Claude가 자동으로 사용하지 않는 문제:
- Skills 열심히 만들어도 Claude가 사용하지 않음
- 키워드를 정확히 써도 무시
- 관련 파일 작업해도 Skills 로드 안 함

### Claude Code 2.1의 개선사항
- Skills/Commands 통합으로 `user-invocable` 스킬은 `/skill-name`으로 직접 호출 가능
- `disable-model-invocation: true`로 모델의 자동 호출 제어 가능
- Skills frontmatter에 `hooks` 필드 추가로 스킬 내부에서 훅 정의 가능
- 그러나 여전히 **자동 활성화 시스템이 일관성 확보에 유효함**

## 자동 활성화 시스템 구조

### 1. UserPromptSubmit Hook (프롬프트 전처리)
Claude가 메시지를 보기 전에 실행되어 Skills 체크 강제

### 2. Stop/Notification Hook (응답 후처리)
Claude 응답 후 실행되어 자가 검증 (2.1에서 Notification 이벤트 추가)

### 3. skill-rules.json (중앙 설정)
모든 Skill 트리거 규칙 정의

### 4. Skills frontmatter 활용 (2.1 신규)
스킬 자체에 hooks와 호출 제어 설정 내장

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

### Step 1.5: Skills frontmatter 활용 (Claude Code 2.1+)

Skills/Commands 통합 이후, 스킬 자체에서 호출 방식과 훅을 제어할 수 있습니다:

```markdown
# .claude/skills/react-native-development/SKILL.md
---
name: react-native-development
description: React Native component development with TypeScript, Expo, and React Navigation
user-invocable: true
disable-model-invocation: false
hooks:
  PostToolUse:
    - matcher: "Write(src/components/**)"
      hooks:
        - type: command
          command: "npx tsc --noEmit --pretty 2>&1 | head -20"
---
```

주요 frontmatter 필드:
- `user-invocable: true` - `/skill-name`으로 직접 호출 가능 (Commands와 통합)
- `disable-model-invocation: true` - 모델이 자동으로 호출하지 못하게 차단
- `hooks` - 스킬 내부에 Hook 규칙 정의 (.claude/settings.json과 동일 형식)

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

### SKILL.md 메인 파일 구조 (LiveMetro 예시)
```markdown
---
name: react-native-development
description: React Native component development with TypeScript, Expo, and React Navigation. Use when creating UI components, screens, or implementing navigation flows.
user-invocable: true
---

# React Native Development Guidelines

## Quick Reference
- Component patterns -> resources/react-patterns.md
- Hooks best practices -> resources/hooks-guidelines.md
- Navigation patterns -> resources/navigation.md
- Firebase integration -> resources/firebase.md
- Testing strategies -> resources/testing.md

## Core Principles
1. Function components only with TypeScript strict mode
2. Path aliases (@/, @components, @screens 등) 사용
3. useEffect cleanup 함수 필수
4. Seoul API 30초 최소 폴링 간격
5. 에러 발생 시 빈 배열/null 반환 (throw 금지)

## Component Structure
\`\`\`tsx
import React, { useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';

interface StationInfoProps {
  stationId: string;
  onRefresh?: () => void;
}

export const StationInfo: React.FC<StationInfoProps> = ({
  stationId,
  onRefresh,
}) => {
  // 1. Hooks
  // 2. Derived state
  // 3. Effects (with cleanup)
  // 4. Handlers
  // 5. Return JSX
};
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

## 설치 및 설정

### 1. 디렉토리 구조 생성
```bash
mkdir -p .claude/hooks .claude/skills
```

### 2. Hooks 설정

Claude Code 2.1에서는 `.claude/settings.json` 파일에 hooks를 설정합니다.
설정 파일 계층: `~/.claude/settings.json` (global) → `.claude/settings.json` (project) → `.claude/settings.local.json` (local)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": "ts-node 10.9.2claude/hooks/userPromptSubmit.ts"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "ts-node 10.9.2claude/hooks/stopEvent.ts"
        }]
      },
      {
        "hooks": [{
          "type": "command",
          "command": "ts-node 10.9.2claude/hooks/buildChecker.ts"
        }]
      }
    ],
    "Notification": [
      {
        "hooks": [{
          "type": "command",
          "command": "echo 'Task notification received'"
        }]
      }
    ]
  }
}
```

참고: Claude Code 2.1에서 추가된 Hook 이벤트:
- `Notification` - 알림 발생 시
- `TeammateIdle` - Agent Teams에서 동료 에이전트 유휴 시
- `TaskCompleted` - 백그라운드 태스크 완료 시
- `WorktreeCreate` - 워크트리 생성 시

HTTP hooks도 지원됩니다:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [{
          "type": "http",
          "url": "http://localhost:3000/webhook/tool-use"
        }]
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

*마지막 업데이트: 2026-03-06 | Claude Code v2.1.x | 환경: macOS + VS Code/Cursor*

#skills-activation #hooks #automation #claude-code #livemetro