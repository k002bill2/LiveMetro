# Claude Code 완벽 가이드북 2026
#claude-code #ai-coding #development #guide #livemetro

> 작성일: 2026-04-15 (최신 업데이트) (최신 업데이트) (최신 업데이트)
> 환경: macOS (VS Code/Cursor), Git, 단독 개발
> Claude Code 경험: 초보자 ~ 중급자용

---

## 개요

Claude Code는 Anthropic이 개발한 터미널 기반 AI 코딩 에이전트로, 2026년 현재 가장 진화된 형태의 AI 개발 도구입니다. 이 가이드는 **macOS 환경(VS Code 또는 Cursor)**에서 Claude Code를 활용하는 개발자를 위한 완벽한 설정 및 실전 가이드입니다.

**주요 변경 (2025 -> 2026)**:
- VS Code / Cursor 중심 개발 환경으로 전환
- Claude 4.6 모델 패밀리 도입 (Opus 4.6, Sonnet 4.6, Haiku 4.5)
- CLI v2.1.x 기반 (현재 v2.1.63+)
- Skills/Commands 통합, Agent Teams, 자동 메모리 등 신규 기능 다수 추가
- 설정 파일 체계 `.claudecode.json` -> `.claude/settings.json` 변경
- React Native Expo 모바일 개발 (LiveMetro) 기반 실전 예제

---

## 2026년 핵심 기능

### 1. Skills/Commands 통합 (v2.1.3)

2025년에는 Skills(`.claude/skills/`)와 Commands(`.claude/commands/`)가 별도로 존재했으나, 2026년부터 하나의 시스템으로 통합되었다.

**통합 전**:
- `commands/` - 사용자가 `/` 명령으로 직접 호출
- `skills/` - Claude가 필요시 자동 로드 (Progressive Disclosure)

**통합 후**:
- 하나의 마크다운 파일이 frontmatter 설정에 따라 두 역할을 동시 수행
- `user-invocable: true` 설정 시 사용자가 `/` 명령으로 호출 가능
- `disable-model-invocation: true` 설정 시 Claude 자동 호출 차단

**Skills frontmatter 신규 필드**:

```yaml
---
name: verify-app
description: 타입체크, 린트, 테스트를 순차 실행하여 앱 상태를 검증합니다
hooks: PostToolUse          # 특정 hook 이벤트에 연결
user-invocable: true        # /verify-app 으로 직접 호출 가능
disable-model-invocation: false  # Claude 자동 호출 허용
---
```

### 2. Agent Teams (실험적 멀티에이전트 협업)

여러 에이전트가 독립된 worktree에서 병렬 작업 후 결과를 병합하는 시스템이다. 메인 에이전트(Opus)가 서브에이전트를 스폰하고 조율한다.

**Agent frontmatter 신규 필드**:

```yaml
---
name: mobile-ui-specialist
description: React Native 컴포넌트 개발 및 UI 최적화 전문
model: sonnet
memory: .claude/agents/shared/quality-reference.md  # 공유 메모리 참조
hooks: PostToolUse                                    # hook 연결
skills: react-native-development, test-automation     # 사용 가능 skills
---
```

### 3. 자동 메모리 기능

Claude Code가 대화 중 학습한 내용을 자동으로 저장하고 다음 세션에서 불러온다.

- 저장 위치: `~/.claude/projects/<project-hash>/memory/`
- 프로젝트별 격리: 각 프로젝트마다 독립된 메모리 공간
- 내용 예시: 테스트 패턴, 자주 발생하는 오류와 해결법, 아키텍처 결정 사항
- 수동 확인: `MEMORY.md` 파일로 열람 및 편집 가능

### 4. HTTP Hooks 지원

기존 로컬 command hook 외에 HTTP endpoint를 hook 대상으로 지정할 수 있다.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "http",
          "url": "https://your-server.com/webhooks/claude-code",
          "method": "POST"
        }]
      }
    ]
  }
}
```

### 5. 신규 Hook 이벤트

기존 3개(PreToolUse, PostToolUse, Stop)에서 대폭 확장되었다.

| Hook 이벤트 | 설명 |
|-------------|------|
| PreToolUse | 도구 사용 전 (기존) |
| PostToolUse | 도구 사용 후 (기존) |
| Stop | 세션 종료 시 (기존) |
| TeammateIdle | Agent Team에서 팀원 에이전트가 유휴 상태일 때 |
| TaskCompleted | 위임된 태스크 완료 시 |
| WorktreeCreate | 새 worktree 생성 시 |
| Notification | 알림 발생 시 |
| UserPromptSubmit | 사용자 프롬프트 제출 시 |

### 6. 기타 주요 변경

- **/teleport**: 현재 터미널 세션을 claude.ai/code 웹 인터페이스로 전송
- **Wildcard 권한**: `Bash(*-h*)` 같은 패턴으로 유연한 권한 설정
- **Shift+Enter**: 터미널에서 줄바꿈 입력 (멀티라인 프롬프트)
- **Context auto-compaction**: 컨텍스트 한계 도달 시 자동 압축, 이미지 자동 보존

---

## 실전 핵심 인사이트

### 가장 중요한 3가지

1. **Plan 모드는 선택이 아닌 필수** - 복잡한 작업은 반드시 Plan 모드로 시작한다
2. **CLAUDE.md가 모든 것을 결정** - 프로젝트 규칙, 경로, 패턴을 여기에 명시해야 Claude가 따른다
3. **2-Strike Rule** - 같은 접근으로 2회 실패하면 즉시 멈추고 근본 원인을 분석한다

### 모델 선택 가이드

| 모델 | 출시일 | 용도 | 속도 | 비용 |
|------|--------|------|------|------|
| **Opus 4.6** | 2026.02.05 | 복잡한 설계, 아키텍처 결정, 오케스트레이션 | 느림 | 높음 |
| **Sonnet 4.6** | 2026.02.17 | 무료 기본 모델, UI/백엔드 구현, 일반 개발 | 보통 | 보통 |
| **Haiku 4.5** | - | 빠른 검증, 단순 작업, 코드 분석, 테스트 작성 | 빠름 | 낮음 |

### 흔한 실수와 대응

| 실수 | 대응 방법 |
|------|-----------|
| `any` 타입 사용 | `unknown` 또는 구체적 타입으로 대체 |
| useEffect 정리 함수 누락 | 모든 구독/타이머에 cleanup 추가 |
| 상대 경로 import | `@` 경로 별칭 사용 |
| console.log 잔존 | 프로덕션 코드에서 제거 |
| 테스트 없이 구현 | 구현과 동시에 테스트 작성 |
| 동일 수정 3회+ 반복 | 2회 실패 후 접근 방식 전환 |

---

## 필수 문서 체크리스트

### Level 1: 핵심 설정 문서

```
your-project/
├── CLAUDE.md                         # 프로젝트 가이드라인 (가장 중요)
├── .mcp.json                         # MCP 서버 연결 설정
└── .claude/
    ├── settings.json                 # 프로젝트 권한/훅 설정
    └── settings.local.json           # 로컬 전용 설정 (gitignore)
```

### 설정 파일 계층 구조 (우선순위 순)

| 파일 | 위치 | 용도 | Git 추적 |
|------|------|------|----------|
| `~/.claude/settings.json` | 글로벌 | 모든 프로젝트 공통 설정 | X |
| `.claude/settings.json` | 프로젝트 루트 | 팀 공유 프로젝트 설정 | O |
| `.claude/settings.local.json` | 프로젝트 루트 | 개인 로컬 설정 | X |

우선순위: local > project > global (하위 설정이 상위를 덮어쓴다)

### Level 2: Skills & Agents 문서

```
├── .claude/
│   ├── skills/                       # Skills (Commands 통합)
│   │   ├── verify-app.md
│   │   ├── commit-push-pr.md
│   │   ├── react-native-development/
│   │   │   └── SKILL.md
│   │   └── test-automation/
│   │       └── SKILL.md
│   ├── agents/                       # Sub-agents
│   │   ├── mobile-ui-specialist.md
│   │   ├── test-automation-specialist.md
│   │   ├── quality-validator.md
│   │   └── shared/
│   │       └── quality-reference.md  # 공유 품질 기준
│   └── coordination/                 # Agent 간 조율 (gitignore)
│       └── ...
```

### Level 3: Dev Docs (대규모 작업용)

```
├── docs/
│   └── claude/
│       ├── architecture.md           # 아키텍처 상세
│       ├── api-reference.md          # API 레퍼런스
│       ├── development-patterns.md   # 개발 패턴
│       └── testing.md                # 테스트 가이드
```

---

## 단계별 설정 가이드

### Phase 1: 기본 환경 구성 (macOS)

#### 1.1 필수 도구 설치

```bash
# Homebrew 설치 (macOS 패키지 매니저)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치 (필수 - v18 이상)
brew install node

# Git 설치 (macOS 기본 포함, 최신 버전 원할 경우)
brew install git

# IDE 설치
# VS Code: https://code.visualstudio.com/
# Cursor: https://cursor.sh/
```

#### 1.2 Claude Code CLI 설치

```bash
# npm을 통한 설치
npm install -g @anthropic-ai/claude-code

# 버전 확인 (v2.1.x 필요, 현재 최신: v2.1.63+)
claude --version

# 실행 및 로그인
claude
/login  # 브라우저 인증

# 또는 API 키 설정
export ANTHROPIC_API_KEY="your-api-key"
# 영구 설정: ~/.zshrc 에 추가
```

#### 1.3 VS Code / Cursor 연동

VS Code 마켓플레이스에서 "Claude Code" 확장 검색 후 설치한다. Cursor의 경우 터미널 패널에서 직접 `claude` 명령을 실행하여 사용한다. 여러 터미널 탭에서 동시 실행이 가능하다.

### Phase 2: Agent Skills 생성

#### 2.1 Skills/Commands 통합 파일 생성

```bash
# 디렉토리 생성
mkdir -p .claude/skills

# 단일 파일 skill/command
touch .claude/skills/verify-app.md
```

#### 2.2 Skill 파일 작성 예시

##### 앱 검증 Skill (user-invocable command 겸용)

```markdown
---
name: verify-app
description: TypeScript 타입체크, ESLint, Jest 테스트를 순차 실행하여 앱 전체 상태를 검증합니다
user-invocable: true
disable-model-invocation: false
---

# 앱 검증 워크플로우

## 실행 순서

1. TypeScript 타입체크: `npx tsc --noEmit`
2. ESLint 검사: `npm run lint`
3. Jest 테스트: `npm test -- --coverage`

## 통과 기준

- TypeScript 에러: 0개
- ESLint 에러: 0개
- 테스트 커버리지: statements 75%, functions 70%, branches 60%

## 실패 시

- 각 단계 실패 시 해당 에러를 수정한 후 해당 단계부터 재검증
- 같은 에러에 대해 2회 수정 시도 후에도 실패하면 근본 원인 분석으로 전환
```

##### React Native 개발 Skill (도메인 전문 skill)

```markdown
---
name: react-native-development
description: React Native Expo 컴포넌트 개발, 화면 구성, 네비게이션 설정에 사용합니다
hooks: PostToolUse
---

# React Native 개발 Skill

## 기술 스택

- React Native 0.72.10 + Expo SDK ~49
- TypeScript strict 모드
- React Navigation 6.x
- Firebase Auth / Firestore
- AsyncStorage 캐싱

## 경로 별칭 (필수)

| 별칭 | 경로 |
|------|------|
| `@` | `src/` |
| `@components` | `src/components` |
| `@screens` | `src/screens` |
| `@services` | `src/services` |
| `@hooks` | `src/hooks` |
| `@utils` | `src/utils` |
| `@models` | `src/models` |

상대 경로 import 금지. 반드시 경로 별칭을 사용한다.

## 컴포넌트 작성 규칙

- 함수형 컴포넌트 + TypeScript interface로 Props 정의
- `any` 타입 사용 금지
- useEffect에는 반드시 cleanup 함수 작성
- Seoul API 폴링 간격: 최소 30초
- 에러 처리: throw 대신 빈 배열/null 반환
```

### Phase 3: Sub-agents 설정

#### 3.1 Agent 파일 생성

```bash
mkdir -p .claude/agents/shared
```

#### 3.2 Agent 정의 예시

##### 모바일 UI 전문 에이전트

```markdown
---
name: mobile-ui-specialist
description: React Native 컴포넌트 개발, UI 최적화, 화면 레이아웃 구성
model: sonnet
memory: .claude/agents/shared/quality-reference.md
hooks: PostToolUse
skills: react-native-development
---

# Mobile UI Specialist

React Native Expo 앱의 UI 개발을 담당하는 전문 에이전트입니다.

## 핵심 역할

1. 화면(Screen) 컴포넌트 구현
2. 재사용 가능한 UI 컴포넌트 개발
3. React Navigation 네비게이션 구성
4. 반응형 레이아웃 및 스타일링
5. 접근성(Accessibility) 준수

## 개발 기준

- TypeScript strict 모드 준수
- 경로 별칭(@) 사용 필수
- 컴포넌트당 하나의 책임 원칙
- testID prop 필수 부여 (테스트 용이성)
```

##### 테스트 자동화 에이전트

```markdown
---
name: test-automation-specialist
description: Jest 테스트 작성, 커버리지 분석, 테스트 패턴 적용
model: haiku
memory: .claude/agents/shared/quality-reference.md
skills: test-automation
---

# Test Automation Specialist

Jest 기반 테스트 작성 및 커버리지 관리를 담당합니다.

## 핵심 역할

1. 단위 테스트 작성 (services, utils, hooks)
2. 컴포넌트 테스트 (React Testing Library)
3. 커버리지 분석 및 개선
4. Mock 전략 수립

## 테스트 규칙

- jest.mock()은 반드시 import 전에 선언
- useAuth mock은 AuthContextType의 모든 필드 포함
- getByTestId 우선 사용 (getByText 충돌 방지)
- 커버리지 기준: statements 75%, functions 70%, branches 60%
```

#### 3.3 에이전트 복잡도별 투입 기준

| 복잡도 | 에이전트 수 | 기준 |
|--------|-----------|------|
| Trivial | 0 | 단일 파일, 명확한 수정 |
| Simple | 1 | 2-3 파일, 한 영역 |
| Moderate | 2-3 | UI + 서비스 또는 크로스 영역 |
| Complex | 3+ | 풀스택, 아키텍처 변경 |

### Phase 4: Hooks & Automation

#### 4.1 .claude/settings.json 설정

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(*-h*)",
      "Bash(*--help*)"
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
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "if echo \"$TOOL_INPUT\" | grep -qE '\\.(ts|tsx)$' && ! echo \"$TOOL_INPUT\" | grep -qE '\\.(test|spec)\\.(ts|tsx)$'; then npx tsc --noEmit 2>&1 | head -20; fi"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "git status"
        }]
      }
    ]
  }
}
```

#### 4.2 로컬 전용 설정 (.claude/settings.local.json)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "npx tsc --noEmit 2>&1 | head -20"
        }]
      }
    ]
  }
}
```

이 파일은 `.gitignore`에 추가하여 개인 환경에서만 적용한다.

#### 4.3 Background Tasks 활용

```bash
# Expo 개발 서버 백그라운드 실행
Ctrl+B npx expo start

# 테스트 watch 모드
Ctrl+B npm test -- --watch

# 로그 모니터링
Ctrl+B tail -f logs/app.log
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
    }
  }
}
```

MCP(Model Context Protocol) 서버를 통해 Claude Code의 기능을 확장할 수 있다. 파일시스템 접근, 브라우저 자동화, 데이터베이스 연결 등을 지원한다.

---

## 프로젝트 타입별 Skills & Agents

### React Native / Expo 모바일 개발 (LiveMetro 기반)

이 프로젝트의 기술 스택:

| 기술 | 버전/설명 |
|------|-----------|
| React Native | 0.72 |
| Expo SDK | ~49 |
| TypeScript | 5.1+ (strict) |
| Firebase | Auth, Firestore |
| Navigation | React Navigation 6.x |
| 캐싱 | AsyncStorage |
| 상태 관리 | AuthContext + Custom Hooks (Redux 미사용) |

데이터 흐름: Seoul API -> Firebase -> AsyncStorage (Cache)

#### 권장 Skills 구성

| Skill | 용도 |
|-------|------|
| react-native-development | 컴포넌트, 화면, 네비게이션 구현 |
| firebase-integration | Auth, Firestore 연동 |
| test-automation | Jest 테스트 작성, 커버리지 관리 |
| verification-loop | 구현 완료 검증 (타입/린트/테스트) |
| parallel-coordinator | 3개 이상 병렬 태스크 조율 |

#### 권장 Agents 구성

| Agent | 모델 | 역할 |
|-------|------|------|
| mobile-ui-specialist | sonnet | UI 컴포넌트, 화면, 스타일링 |
| test-automation-specialist | haiku | 테스트 작성, mock 전략 |
| quality-validator | haiku | 린트, 타입체크, 커버리지 검증 |

#### Skill 호출 규칙

구현 전 반드시 해당 스킬을 호출한다:

| 작업 유형 | 호출 Skill |
|-----------|-----------|
| UI / 컴포넌트 / 화면 | react-native-development |
| Firebase / Auth / Firestore | firebase-integration |
| 테스트 / 커버리지 | test-automation |
| 병렬 에이전트 (3+ 작업) | parallel-coordinator |
| 구현 완료 검증 | verification-loop |

---

## Best Practices 2026

### Daily Workflow

```bash
# 1. 세션 시작
claude

# 2. 컨텍스트 확인
/clear  # 필요시 이전 컨텍스트 정리

# 3. 작업 계획 (Plan 모드)
# 복잡한 작업은 반드시 Plan 모드로 시작

# 4. 구현

# 5. 검증
/verify-app  # 타입, 린트, 테스트 검증

# 6. 커밋
/commit-push-pr  # 자동화된 커밋/푸시/PR
```

### Boris Cherny 워크플로우 (LiveMetro 적용)

| 시점 | 실행 커맨드 | 목적 |
|------|------------|------|
| 코드 변경 후 | `/verify-app` | 타입, 린트, 테스트, 빌드 검증 |
| PR 생성 전 | `/check-health` | 전체 상태 점검 |
| 커밋 전 | `/commit-push-pr` | 자동화된 커밋/푸시/PR |
| 리팩토링 시 | `/simplify-code` | 복잡도 분석 및 단순화 |

### 피드백 루프 규칙

1. **검증 후 커밋**: `/verify-app` 통과 후에만 커밋한다
2. **작은 단위**: 큰 변경을 작은 커밋으로 분리한다
3. **2-Strike Rule**: 같은 수정 2회 실패 시 접근 방식을 전환한다
4. **문서화**: 복잡한 로직에는 주석을 추가한다

### 컨텍스트 관리

- 긴 세션 후 `/clear` 사용
- Context auto-compaction이 자동으로 동작하지만, 이미지는 보존됨
- 작업 단위별로 세션을 분리하는 것이 효율적
- `/teleport`로 웹 인터페이스 전환 시 컨텍스트 유지

---

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `/clear` | 컨텍스트 초기화 |
| `/model` | 모델 변경 (opus, sonnet, haiku) |
| `/agents` | Sub-agents 관리 |
| `/teleport` | 세션을 claude.ai/code 웹으로 전송 |
| `/hooks` | Hooks 설정 |
| `/permissions` | 권한 관리 |
| `/statusline` | 상태 표시줄 설정 |
| `/help` | 도움말 |
| `/bug` | 버그 리포트 |
| `Ctrl+B` | 백그라운드 실행 |
| `Ctrl+R` | Transcript 모드 |
| `Shift+Enter` | 줄바꿈 (멀티라인 프롬프트) |

사용자 정의 명령어 (`user-invocable: true` 설정 시):

| 명령어 | 설명 |
|--------|------|
| `/verify-app` | 타입체크 + 린트 + 테스트 검증 |
| `/check-health` | 전체 프로젝트 상태 점검 |
| `/commit-push-pr` | 자동 커밋, 푸시, PR 생성 |
| `/simplify-code` | 복잡도 분석 및 단순화 |

---

## 보안 주의사항

### 필수 보안 규칙

- `--dangerously-skip-permissions`는 Docker 컨테이너 내에서만 사용한다
- Skills 파일에 API 키, 비밀번호 등 민감 정보를 하드코딩하지 않는다
- 출처 불명의 MCP 서버나 Skills 파일을 검증 없이 사용하지 않는다
- `.env` 파일은 반드시 `.gitignore`에 포함한다
- API 키는 환경 변수로 관리한다
- `.claude/settings.local.json`은 `.gitignore`에 포함한다 (개인 설정)
- 정기적으로 `permissions` 설정을 검토한다
- Wildcard 권한(`Bash(*-h*)`)은 필요한 패턴만 최소 범위로 설정한다

### 설정 파일별 보안 수준

| 파일 | Git 추적 | 민감 정보 포함 가능 |
|------|----------|-------------------|
| `.claude/settings.json` | O | 불가 (팀 공유) |
| `.claude/settings.local.json` | X | 제한적 허용 |
| `~/.claude/settings.json` | X | 제한적 허용 |
| `.env` | X | 허용 (gitignore 필수) |

---

## 추가 리소스

### 공식 문서

- [Claude Code Overview](https://code.claude.com/docs/overview)
- [Skills Documentation](https://code.claude.com/docs/skills)
- [Sub-agents Guide](https://code.claude.com/docs/sub-agents)
- [Hooks Reference](https://code.claude.com/docs/hooks)
- [Settings Reference](https://code.claude.com/docs/settings)
- [Best Practices](https://code.claude.com/docs/best-practices)

### 커뮤니티 리소스

- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [Claude Developers Discord](https://discord.gg/anthropic)

### 참고 블로그

- [Cooking with Claude Code: The Complete Guide](https://www.siddharthbharath.com/claude-code-the-complete-guide/)
- [Claude Skills are awesome](https://simonwillison.net/2025/Oct/16/claude-skills/)
- [How I use Claude Code](https://www.builder.io/blog/claude-code)

---

## CLAUDE.md 핵심 템플릿

```markdown
# CLAUDE.md

## Project Overview
- **Name**: [프로젝트 이름]
- **Purpose**: [프로젝트 목적]

| Technology | Version |
|------------|---------|
| [언어/프레임워크] | [버전] |
| TypeScript | [버전]+ (strict) |

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm start` | 개발 서버 시작 |
| `npm test` | 테스트 실행 |
| `npm run lint` | 린트 검사 |
| `npm run type-check` | 타입 검사 |

## Architecture
[데이터 흐름, 네비게이션 구조, 상태 관리 방식 간략 기술]

## Path Aliases

| Alias | Path |
|-------|------|
| `@` | `src/` |

## Critical Rules
1. TypeScript strict 모드 - `any` 금지
2. useEffect cleanup 필수
3. 커버리지 기준: [수치]
4. 에러 처리 - throw 대신 빈 배열/null 반환

## Skill Routing

| 작업 유형 | Skill |
|-----------|-------|
| [작업1] | [skill-name] |

## Deployment Validation
배포 전 필수 검증:
1. `npm run type-check` - TypeScript 에러 0개
2. `npm run lint` - ESLint 에러 0개
3. `npm test -- --coverage` - 커버리지 충족
```

---

## 학습 로드맵

### Week 1: 기초

- Claude Code CLI 설치 및 VS Code/Cursor 연동
- 기본 명령어 익히기 (/clear, /model, Shift+Enter)
- 첫 CLAUDE.md 작성
- 간단한 코드 생성 및 수정 테스트

### Week 2: Skills 마스터

- 첫 Skill 파일 작성 (frontmatter 포함)
- user-invocable command 생성
- 3개 이상의 도메인별 Skills 작성
- Skills 자동 호출과 수동 호출 차이 이해

### Week 3: Sub-agents 활용

- 첫 Sub-agent 정의 (memory, hooks, skills frontmatter)
- 복잡도별 에이전트 투입 기준 적용
- Agent Teams 실험
- 프로젝트별 최적 agent 구성

### Week 4: 고급 기능

- Hooks 설정 및 자동화 (settings.json 계층 구조)
- MCP 서버 연동
- Background tasks 활용
- /teleport 및 자동 메모리 활용
- HTTP hooks 설정 (필요시)

---

## 팁 & 트릭

### 성능 최적화

1. **컨텍스트 관리**: 작업별로 `/clear` 활용, auto-compaction에 의존하되 주기적 정리
2. **모델 선택**: 단순 작업은 Haiku, 일반 개발은 Sonnet, 설계는 Opus
3. **Skill 설계**: 하나의 Skill은 하나의 책임만 담당하도록 분리
4. **Agent 분할**: 큰 작업을 작은 전문 태스크로 분할하여 병렬 처리

### 일반적인 문제 해결

| 문제 | 해결 방법 |
|------|-----------|
| Skill이 로드되지 않음 | YAML frontmatter 형식 확인, CLI 재시작 |
| Agent가 호출되지 않음 | description 필드를 구체적으로 작성 |
| 권한 오류 | .claude/settings.json 권한 설정 확인 |
| 컨텍스트 오버플로우 | `/clear` 사용, 작업 분할 |
| Hook이 실행되지 않음 | matcher 패턴과 command 경로 확인 |
| settings.json 미적용 | 파일 계층 우선순위 확인 (local > project > global) |

### 멀티라인 입력

`Shift+Enter`로 터미널에서 줄바꿈을 입력할 수 있다. 긴 프롬프트나 코드 블록을 포함한 요청 시 유용하다.

### 세션 전환

`/teleport` 명령으로 현재 터미널 세션을 claude.ai/code 웹 인터페이스로 전송할 수 있다. 모바일이나 다른 기기에서 이어서 작업하거나, 웹 UI의 시각적 기능을 활용할 때 유용하다.

---

## 업데이트 내역

### 2026년 3월 기준 주요 변경사항

- **Claude Code CLI**: v2.1.x (현재 v2.1.63+)
- **Claude Opus 4.6**: 2026.02.05 출시 - 복잡한 설계, 아키텍처, 오케스트레이션
- **Claude Sonnet 4.6**: 2026.02.17 출시 - 무료 기본 모델, 일반 개발 작업
- **Claude Haiku 4.5**: 빠른 검증, 단순 작업, 테스트 작성
- **Skills/Commands 통합**: v2.1.3에서 하나의 시스템으로 병합
- **Agent Teams**: 실험적 멀티에이전트 협업 기능
- **자동 메모리**: 프로젝트별 학습 내용 자동 저장/불러오기
- **HTTP Hooks**: 외부 서버 webhook 연결 지원
- **설정 파일 체계 변경**: `.claudecode.json` -> `.claude/settings.json` (3단계 계층)
- **신규 Hook 이벤트**: TeammateIdle, TaskCompleted, WorktreeCreate, Notification, UserPromptSubmit
- **/teleport**: 터미널 세션을 웹 인터페이스로 전송
- **Wildcard 권한**: `Bash(*-h*)` 패턴 지원
- **Shift+Enter**: 멀티라인 프롬프트 입력
- **Context auto-compaction**: 자동 컨텍스트 압축, 이미지 보존
- **IDE 환경**: VS Code / Cursor 중심 (Antigravity IDE 참조 제거)
- **프로젝트 기반**: React Native Expo 모바일 개발 (LiveMetro)

---

*이 가이드는 지속적으로 업데이트됩니다. 최신 정보는 공식 문서(code.claude.com/docs)를 참고하세요.*
*마지막 업데이트: 2026-03-06 | 환경: macOS + VS Code/Cursor*

#claude-code #ai-development #2026-guide #macos-setup #livemetro
