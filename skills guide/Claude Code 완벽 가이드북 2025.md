# Claude Code 완벽 가이드북 2025
#claude-code #ai-coding #development #guide

> 작성일: 2025-01-03
> 환경: Windows, Git, 단독 개발
> Claude Code 경험: 초보자용

## 📌 개요

Claude Code는 Anthropic이 개발한 터미널 기반 AI 코딩 도구로, 2025년 현재 가장 강력한 AI 개발 어시스턴트 중 하나입니다. 이 가이드는 Windows 환경에서 Claude Code를 처음 시작하는 개발자를 위한 완벽한 설정 및 활용 가이드입니다.

## 🎯 2025년 핵심 기능

### 1. Agent Skills (에이전트 스킬) 🌟
- **정의**: 재사용 가능한 모듈형 기능 패키지
- **구성**: SKILL.md 파일로 정의되는 도메인별 전문 지식
- **작동**: Progressive Disclosure - Claude가 필요시 자동 로드 (이론)
- **현실**: Claude가 Skills를 잘 안 쓰는 문제 → **Hook 자동 활성화 시스템 필수!**
- **장점**: 컨텍스트 효율성, 재사용성, 팀 공유 가능

### 2. Sub-agents (서브 에이전트) 🤖
- **정의**: 특정 작업 전문 AI 어시스턴트
- **특징**: 독립된 컨텍스트 윈도우 보유
- **작동**: 자동 태스크 위임 시스템
- **모델 선택**: sonnet, opus, haiku, inherit

### 3. Personas & Frameworks 🎭
- **주요 프레임워크**:
  - SuperClaude: 메타 프로그래밍 설정 프레임워크
  - BMAD: 아키텍처 중심 개발 방법론
  - Claude Flow: 엔터프라이즈급 오케스트레이션
- **활용**: 특화된 개발 방법론 적용

### 4. Background Tasks & Hooks ⚙️
- **백그라운드**: Ctrl+B로 프로세스 실행
- **Hooks 종류**:
  - PreToolUse: 도구 사용 전
  - PostToolUse: 도구 사용 후
  - Stop: 세션 종료 시
- **활용**: CI/CD 통합, 자동화

## 🔥 실전 핵심 인사이트 (6개월 300k LOC 경험)

> "Claude는 극도로 자신감 넘치는 주니어 개발자 with 심각한 건망증" - Reddit u/JokeGold5455

### 가장 중요한 3가지
1. **Planning Mode는 선택이 아닌 필수** - 계획 없이 시작하면 망함
2. **Skills 자동 활성화 Hook 시스템** - Skills 만들기만 하면 안 씀
3. **Dev Docs 3-파일 시스템** - Claude가 길 잃는 것 방지

## 📋 필수 문서 체크리스트

### Level 1: 핵심 설정 문서
```
your-project/
├── CLAUDE.md                    # ⭐ 프로젝트 가이드라인 (가장 중요)
├── .mcp.json                    # MCP 서버 연결 설정
├── .claudecode.json             # 권한 및 훅 설정
└── PRD.md                       # 프로젝트 요구사항
```

### Level 2: Skills & Agents 문서
```
├── .claude/
│   ├── skills/                  # 🌟 Agent Skills
│   │   ├── code-reviewer/
│   │   │   └── SKILL.md
│   │   ├── test-runner/
│   │   │   └── SKILL.md
│   │   └── docs-generator/
│   │       └── SKILL.md
│   ├── agents/                  # 🤖 Sub-agents
│   │   ├── frontend-specialist.md
│   │   ├── backend-architect.md
│   │   └── test-engineer.md
│   └── commands/                # 커스텀 명령어
│       ├── review.md
│       ├── deploy.md
│       └── test.md
```

### Level 3: 프레임워크 문서 (선택)
```
├── .claude-plugin/              # 플러그인 설정
├── BMAD.md                      # BMAD 방법론
├── SUPERCLAUDE.md              # SuperClaude 설정
└── skill-rules.json            # Skills 자동 활성화 규칙 ⭐
```

### Level 4: Dev Docs (대규모 작업 필수)
```
├── dev/
│   └── active/                  # 진행 중인 작업
│       └── [task-name]/
│           ├── [task-name]-plan.md     # 승인된 계획
│           ├── [task-name]-context.md  # 핵심 결정사항
│           └── [task-name]-tasks.md    # 체크리스트
```

## 🚀 단계별 설정 가이드

### Phase 1: 기본 환경 구성

#### 1.1 필수 도구 설치
```bash
# Node.js 설치 (필수)
# https://nodejs.org 에서 LTS 버전 다운로드

# Git 설치
# https://git-scm.com/download/win

# VS Code 또는 Cursor 설치
# VS Code: https://code.visualstudio.com/
# Cursor: https://cursor.sh/

# Windows Terminal 설치 (추천)
# Microsoft Store에서 설치
```

#### 1.2 Claude Code CLI 설치
```bash
# npm을 통한 설치
npm install -g @anthropic/claude-code

# 버전 확인 (최소 v2.0.28 이상 권장)
claude --version

# 실행 및 로그인
claude
/login  # 브라우저 인증

# 또는 API 키 설정
export ANTHROPIC_API_KEY="your-api-key"
```

#### 1.3 VS Code Extension 설치
- VS Code 마켓플레이스에서 "Claude Code" 검색
- 설치 후 여러 pane에서 동시 실행 가능

### Phase 2: Agent Skills 생성 🌟

#### 2.1 Skill 생성 방법
```bash
# 방법 1: skill-creator 사용 (권장)
claude
"Use the skill-creator skill to help me create a new skill for [your task]"

# 방법 2: 수동 생성
mkdir -p .claude/skills/your-skill-name
```

#### 2.2 SKILL.md 템플릿 예시

##### Code Reviewer Skill
```markdown
---
name: code-reviewer
description: Comprehensive code review for quality, security, and maintainability. Use when reviewing pull requests, code changes, or when code quality checks are needed.
---

# Code Review Skill

## Purpose
Perform thorough code reviews focusing on:
- Code quality and readability
- Security vulnerabilities
- Performance optimization
- Test coverage
- Documentation completeness

## Instructions

### 1. Initial Analysis
- Read all changed files
- Identify the type of changes (feature, bugfix, refactor)
- Check for breaking changes

### 2. Quality Checks
\`\`\`python
def review_checklist():
    checks = {
        "error_handling": check_error_handling(),
        "input_validation": check_input_validation(),
        "sql_injection": check_sql_injection(),
        "memory_leaks": check_memory_management(),
        "test_coverage": check_test_coverage()
    }
    return checks
\`\`\`

### 3. Feedback Format
- 🟢 **Good**: Well-implemented features
- 🟡 **Suggestion**: Improvements
- 🔴 **Issue**: Must fix before merge

## Resources
- style-guide.md
- security-checklist.md
- performance-tips.md
```

### Phase 3: Sub-agents 설정 🤖

#### 3.1 Sub-agent 생성
```bash
# 인터랙티브 생성
/agents

# 옵션 선택:
# 1. Create new agent
# 2. Choose project-specific (.claude/agents/)
# 3. Define purpose and tools
# 4. Select color for visual identification
```

#### 3.2 Frontend Specialist Agent 예시
```markdown
---
name: frontend-specialist
description: React/Next.js component development, optimization, and testing
tools: edit, create, browser, analyze
model: sonnet  # 또는 'inherit', 'opus', 'haiku'
---

# Frontend Development Specialist

You are a senior frontend engineer specializing in React and Next.js applications.

## Core Responsibilities
1. Component architecture and development
2. Performance optimization
3. Accessibility compliance
4. Responsive design implementation
5. State management

## Development Standards

### Component Structure
\`\`\`tsx
interface ComponentProps {
  // Define all props with proper types
}

const Component: React.FC<ComponentProps> = ({ ...props }) => {
  // Hook usage at the top
  // Business logic
  // Return JSX
}
\`\`\`

### Performance Guidelines
- Use React.memo for expensive components
- Implement lazy loading for routes
- Optimize bundle size with code splitting
- Use Next.js Image component for images

## Testing Requirements
- Unit tests for all utilities
- Component testing with React Testing Library
- E2E tests for critical user flows
- Minimum 80% code coverage
```

### Phase 4: Hooks & Automation ⚙️

#### 4.1 .claudecode.json 설정
```json
{
  "permissions": {
    "allowedTools": [
      "Read",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm *)",
      "Bash(git *)"
    ],
    "deny": [
      "Read(.env*)",
      "Write(*.prod.*)",
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(*.py)",
        "hooks": [{
          "type": "command",
          "command": "python -m black \"$file\" && python -m pylint \"$file\""
        }]
      },
      {
        "matcher": "Edit(*test*)",
        "hooks": [{
          "type": "command",
          "command": "npm test -- --coverage"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "git status && echo 'Session completed'"
        }]
      }
    ]
  },
  "model": "claude-opus-4-1-20250805",
  "maxTokens": 4000
}
```

#### 4.2 Background Tasks 활용
```bash
# 개발 서버 백그라운드 실행
Ctrl+B npm run dev

# 로그 모니터링
Ctrl+B tail -f logs/app.log

# 테스트 watch 모드
Ctrl+B npm test -- --watch
```

### Phase 5: MCP 서버 통합

#### 5.1 .mcp.json 설정
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "./src,./tests,./docs"
      }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-puppeteer"]
    },
    "database": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

## 📦 프로젝트 타입별 Skills & Agents

### 웹 개발 프로젝트
| Type | Name | Purpose |
|------|------|---------|
| **Skills** | | |
| | component-generator | React/Vue 컴포넌트 생성 |
| | api-integrator | API 연동 코드 생성 |
| | style-system | CSS/Tailwind 스타일링 |
| **Agents** | | |
| | ui-designer | 디자인 시스템 적용 |
| | performance-optimizer | 번들 최적화 |
| | accessibility-auditor | A11y 검사 |

### 백엔드 프로젝트
| Type | Name | Purpose |
|------|------|---------|
| **Skills** | | |
| | api-designer | OpenAPI 스펙 생성 |
| | database-migrator | 스키마 마이그레이션 |
| | auth-implementer | 인증/인가 구현 |
| **Agents** | | |
| | api-architect | API 설계 전문가 |
| | security-auditor | 보안 검사 |
| | performance-tuner | 성능 최적화 |

### 데이터 분석/ML 프로젝트
| Type | Name | Purpose |
|------|------|---------|
| **Skills** | | |
| | data-processor | 데이터 전처리 |
| | model-trainer | 모델 학습 |
| | visualizer | 시각화 생성 |
| **Agents** | | |
| | data-scientist | 분석 전략 수립 |
| | ml-engineer | 모델 최적화 |
| | experiment-tracker | 실험 관리 |

## 🎯 Best Practices 2.0

### Daily Workflow
```bash
# 세션 시작
claude
/clear  # 이전 컨텍스트 정리

# Skills 확인
ls .claude/skills/

# Agents 상태 확인
/agents list

# 작업 시작
"Review my recent changes using the code-reviewer skill"
```

### 효율적인 사용 팁
1. **Context Management**: 긴 세션 후 `/clear` 사용
2. **Skill Chaining**: 여러 Skills를 순차적으로 활용
3. **Agent Delegation**: 복잡한 작업은 여러 agents로 분할
4. **Version Control**: Skills와 Agents를 Git으로 관리
5. **Team Sharing**: `.mcp.json`과 Skills를 팀과 공유

### 주요 명령어
| 명령어 | 설명 |
|--------|------|
| `/clear` | 컨텍스트 초기화 |
| `/agents` | Sub-agents 관리 |
| `/model` | 모델 변경 |
| `/statusline` | 상태 표시줄 설정 |
| `/hooks` | Hooks 설정 |
| `/permissions` | 권한 관리 |
| `/help` | 도움말 |
| `/bug` | 버그 리포트 |
| `Ctrl+B` | 백그라운드 실행 |
| `Ctrl+R` | Transcript 모드 |

## 🚨 보안 주의사항

### 필수 보안 규칙
- ❌ `--dangerously-skip-permissions`는 Docker 컨테이너에서만 사용
- ❌ 민감 정보는 Skills에 하드코딩하지 않기
- ❌ 알 수 없는 출처의 Executable Skills 사용 금지
- ✅ 정기적인 권한 검토
- ✅ `.env` 파일은 `.gitignore`에 포함
- ✅ API 키는 환경 변수로 관리

## 📚 추가 리소스

### 공식 문서
- [Claude Code Overview](https://docs.claude.com/en/docs/claude-code/overview)
- [Agent Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Sub-agents Guide](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### 커뮤니티 리소스
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [ClaudeLog Community](https://claudelog.com/)
- [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)
- [Claude Developers Discord](https://discord.gg/anthropic)

### 유용한 블로그 & 가이드
- [Cooking with Claude Code: The Complete Guide](https://www.siddharthbharath.com/claude-code-the-complete-guide/)
- [Claude Skills are awesome](https://simonwillison.net/2025/Oct/16/claude-skills/)
- [How I use Claude Code](https://www.builder.io/blog/claude-code)

## 📝 CLAUDE.md 핵심 템플릿

```markdown
# Project Context for Claude Code

## 🎯 Project Overview
- **Name**: [프로젝트 이름]
- **Purpose**: [프로젝트 목적]
- **Tech Stack**: [사용 기술]
- **Current Phase**: [현재 개발 단계]

## 📁 Project Structure
[디렉토리 구조와 각 폴더의 역할 설명]

## 🛠️ Development Guidelines

### Code Style
- Language: [JavaScript/Python/etc]
- Style Guide: [ESLint/Prettier 설정]
- Naming Conventions:
  - Functions: camelCase
  - Classes: PascalCase
  - Constants: UPPER_SNAKE_CASE

### Git Workflow
- Branch naming: feature/[feature-name]
- Commit format: [type]: [description]
  - feat: 새 기능
  - fix: 버그 수정
  - docs: 문서 수정
  - refactor: 코드 리팩토링

## ⚡ Common Tasks
[자주 수행하는 작업들의 단계별 가이드]

## 🔒 Security & Permissions
- Never modify: [보호된 파일들]
- Always test before: [중요 작업들]
- Require review for: [리뷰 필요 항목]

## 📝 Important Notes
- [프로젝트 특수 사항]
- [주의사항]
- [팀 규칙]
```

## 🎓 학습 로드맵

### Week 1: 기초
- [ ] Claude Code 설치 및 설정
- [ ] 기본 명령어 익히기
- [ ] 첫 CLAUDE.md 작성
- [ ] 간단한 코드 생성 테스트

### Week 2: Skills 마스터
- [ ] skill-creator로 첫 Skill 생성
- [ ] 3개 이상의 다양한 Skills 작성
- [ ] Skill chaining 연습
- [ ] 팀과 Skills 공유

### Week 3: Sub-agents 활용
- [ ] 첫 Sub-agent 생성
- [ ] Multi-agent 워크플로우 구성
- [ ] Agent delegation 패턴 익히기
- [ ] 프로젝트별 최적 agent 구성

### Week 4: 고급 기능
- [ ] Hooks 설정 및 자동화
- [ ] MCP 서버 연동
- [ ] Background tasks 활용
- [ ] CI/CD 통합

## 💡 팁 & 트릭

### 성능 최적화
1. **컨텍스트 관리**: 작업별로 `/clear` 활용
2. **모델 선택**: 가벼운 작업은 Haiku, 복잡한 작업은 Sonnet/Opus
3. **Skill 설계**: Progressive Disclosure 원칙 준수
4. **Agent 분할**: 큰 작업을 작은 전문 태스크로 분할

### 일반적인 문제 해결
| 문제 | 해결 방법 |
|------|-----------|
| Skill이 로드되지 않음 | YAML frontmatter 확인, 재시작 |
| Agent가 호출되지 않음 | description 필드 구체화 |
| 권한 오류 | .claudecode.json 권한 설정 확인 |
| 컨텍스트 오버플로우 | `/clear` 사용, 작업 분할 |

## 🔄 업데이트 내역

### 2025년 주요 업데이트
- **Agent Skills**: 모듈형 기능 패키지 도입
- **Sub-agents**: 자동 태스크 위임 시스템
- **Background Tasks**: Ctrl+B로 백그라운드 실행
- **Hooks System**: 라이프사이클 자동화
- **VS Code Extension**: GUI 인터페이스 제공
- **Model Updates**: Claude Sonnet 4.5, Haiku 4.5

---

*이 가이드는 지속적으로 업데이트됩니다. 최신 정보는 공식 문서를 참고하세요.*

#claude-code #ai-development #2025-guide #windows-setup