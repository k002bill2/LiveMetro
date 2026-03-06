# Claude Code Quick Reference
#claude-code #reference #cheatsheet

## 빠른 시작 체크리스트

### 설치 (macOS)
```bash
# 1. Node.js 설치 확인 (v18+)
node --version

# 2. Claude Code CLI 설치
npm install -g @anthropic-ai/claude-code

# 3. 버전 확인 (2026년 3월 기준: v2.1.63+)
claude --version

# 4. 로그인
claude
/login
```

### 프로젝트 초기 설정
```bash
# 1. 프로젝트 디렉토리로 이동
cd my-project

# 2. 필수 디렉토리 구조 생성
mkdir -p .claude/skills .claude/agents .claude/commands

# 3. CLAUDE.md 생성 (가장 중요!)
touch CLAUDE.md

# 4. 설정 파일 생성
touch .claude/settings.json .mcp.json

# 5. Git 초기화
git init
echo ".env" >> .gitignore
```

## 필수 파일 구조

```
my-project/
├── CLAUDE.md                    # 프로젝트 가이드 (필수)
├── .mcp.json                    # MCP 서버 설정
├── .claude/
│   ├── settings.json            # 프로젝트 설정 (권한, Hooks)
│   ├── settings.local.json      # 로컬 설정 (gitignore 대상)
│   ├── skills/                  # Skills (= 구 Commands 통합)
│   │   └── [skill-name]/
│   │       └── SKILL.md
│   ├── agents/                  # Sub-agents
│   │   └── [agent-name].md
│   └── commands/                # 커스텀 슬래시 명령어
│       └── [command].md
└── docs/                        # 참조 문서
```

### 설정 파일 계층 (우선순위: local > project > global)

| 파일 | 위치 | 용도 |
|------|------|------|
| `~/.claude/settings.json` | 전역 | 모든 프로젝트 공통 설정 |
| `.claude/settings.json` | 프로젝트 | 팀 공유 설정 (Git 추적) |
| `.claude/settings.local.json` | 로컬 | 개인 설정 (Git 제외) |

## 주요 명령어

### 기본 명령어
| 명령어 | 설명 |
|--------|------|
| `double-esc` | 이전 프롬프트 분기 (다른 결과 시도) |
| `Shift+Enter` | 줄바꿈 (프롬프트 내 개행) |
| `Planning Mode` | 계획 모드 시작 |
| `/clear` | 컨텍스트 초기화 |
| `/model` | 모델 변경 (opus/sonnet/haiku) |
| `/agents` | Sub-agents 관리 |
| `/help` | 도움말 |
| `/bug` | 버그 리포트 |

### 고급 명령어
| 명령어 | 설명 |
|--------|------|
| `/teleport` | 현재 세션을 claude.ai/code로 전송 |
| `/statusline` | 상태 표시줄 설정 (토큰/비용 표시) |
| `/hooks` | Hooks 설정 |
| `/permissions` | 권한 관리 |
| `/rewind` | 이전 상태로 복원 |
| `Ctrl+B` | 백그라운드 실행 |
| `Ctrl+R` | Transcript 모드 |

## 실전 핵심 워크플로우

### 1. Planning Mode (복잡한 작업 시 필수)
```
"이 기능을 구현해야 합니다. Plan 모드로 시작합니다."
```

### 2. LiveMetro 개발 워크플로우
```bash
# 검증 루프 (코드 변경 후)
npx tsc --noEmit        # TypeScript 검증
npm run lint             # ESLint 검증
npm test -- --coverage   # 테스트 + 커버리지

# Expo 개발 서버
npm start                # Expo dev server (Ctrl+B로 백그라운드 가능)

# 커밋 전 전체 검증
/verify-app
```

### 3. React Native/Expo 작업 예시
```
"HomeScreen에 실시간 도착 정보 새로고침 기능을 추가합니다.
react-native-development 스킬을 사용합니다."
```

### 4. Skills 강제 활성화
```
# Skill을 명시적으로 호출
"react-native-development 스킬을 사용하여 컴포넌트를 구현합니다."
"verification-loop 스킬로 검증합니다."
```

## Agent Skills 빠른 생성

### SKILL.md 템플릿
```markdown
# .claude/skills/my-skill/SKILL.md
---
name: my-skill
description: 이 스킬의 용도와 호출 시점
user-invocable: true
disable-model-invocation: false
hooks:
  PostToolUse:
    - matcher: "Write(src/**/*.tsx)"
      command: "npx tsc --noEmit"
---

# My Skill

## 실행 조건
- 사용자가 [작업]을 요청할 때

## 절차
1. 단계 1
2. 단계 2
3. 단계 3

## 예시
사용 예시 기술
```

### Skills frontmatter 옵션

| 키 | 타입 | 설명 |
|----|------|------|
| `name` | string | 스킬 이름 |
| `description` | string | 용도 설명 |
| `user-invocable` | boolean | 사용자가 직접 호출 가능 여부 |
| `disable-model-invocation` | boolean | 모델의 자동 호출 차단 |
| `hooks` | object | 스킬 전용 Hook 이벤트 |

## Sub-agent 빠른 생성

### Agent 파일 템플릿
```markdown
# .claude/agents/mobile-ui-specialist.md
---
name: mobile-ui-specialist
description: React Native UI 컴포넌트 전문가
model: sonnet
memory: true
hooks:
  PostToolUse:
    - matcher: "Write(src/components/**)"
      command: "npx tsc --noEmit"
skills:
  - react-native-development
---

당신은 React Native/Expo UI 전문가입니다.

## 규칙
- TypeScript strict mode 준수
- 경로 별칭(@components, @screens 등) 사용
- 컴포넌트마다 테스트 작성
```

### Agent frontmatter 옵션

| 키 | 타입 | 설명 |
|----|------|------|
| `name` | string | 에이전트 이름 |
| `description` | string | 역할 설명 |
| `model` | string | 사용 모델 (opus/sonnet/haiku) |
| `memory` | boolean | 자동 메모리 활성화 |
| `hooks` | object | 에이전트 전용 Hook |
| `skills` | list | 사용할 스킬 목록 |

## Hooks 설정

### .claude/settings.json 형식
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(src/**/*.ts,src/**/*.tsx)",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsc --noEmit --pretty 2>&1 | head -20"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Bash command intercepted'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Task completed'"
          }
        ]
      }
    ]
  }
}
```

### Hook 이벤트 종류

| 이벤트 | 시점 | 용도 |
|--------|------|------|
| `PreToolUse` | 도구 실행 전 | 입력 검증, 차단 |
| `PostToolUse` | 도구 실행 후 | 포맷팅, 타입 체크 |
| `Stop` | 응답 완료 시 | 최종 검증 |
| `Notification` | 알림 발생 시 | 외부 알림 연동 |
| `UserPromptSubmit` | 사용자 입력 시 | 컨텍스트 주입 |
| `TeammateIdle` | 팀원 에이전트 유휴 시 | Agent Teams 조율 |
| `TaskCompleted` | 작업 완료 시 | 후처리 |
| `WorktreeCreate` | Worktree 생성 시 | 환경 초기화 |

## 권한 설정

### .claude/settings.json
```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write(src/**)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(*-h*)"
    ],
    "deny": [
      "Read(.env*)",
      "Bash(sudo *)",
      "Bash(rm -rf *)"
    ]
  }
}
```

### Wildcard 권한 예시

| 패턴 | 설명 |
|------|------|
| `Bash(npm *)` | npm 관련 모든 명령 허용 |
| `Bash(*-h*)` | 도움말 플래그 포함 명령 허용 |
| `Write(src/**)` | src 하위 모든 파일 쓰기 허용 |
| `Read(.env*)` | 환경변수 파일 읽기 차단 (deny) |

## 모델 선택 가이드 (2026.03 기준)

| 모델 | 출시일 | 용도 | 속도 | 비용 |
|------|--------|------|------|------|
| **Opus 4.6** | 2026.02.05 | 복잡한 설계, 아키텍처, 오케스트레이션 | 느림 | 높음 |
| **Sonnet 4.6** | 2026.02.17 | UI/백엔드 구현, 일반 개발 | 보통 | 중간 |
| **Haiku 4.5** | 2025.03 | 빠른 검증, 테스트, 린트 수정 | 빠름 | 낮음 |

### LiveMetro 프로젝트 모델 배정

| 작업 | 모델 | 예시 |
|------|------|------|
| 아키텍처 설계, 대규모 리팩토링 | Opus 4.6 | 새 기능 설계, 멀티에이전트 조율 |
| 컴포넌트 구현, 서비스 작성 | Sonnet 4.6 | 화면 구현, API 연동 |
| 테스트 작성, 버그 수정 | Haiku 4.5 | 린트 수정, 단순 타입 에러 |

## 새 기능 요약 (v2.1.x)

| 기능 | 설명 |
|------|------|
| **자동 메모리** | 대화 내용을 자동으로 기억하여 다음 세션에 활용 |
| **Agent Teams** | 여러 에이전트가 협업하여 병렬 작업 수행 |
| **HTTP Hooks** | 외부 서비스와 webhook 연동 |
| **/teleport** | 터미널 세션을 claude.ai/code 웹으로 전송 |
| **Shift+Enter** | 프롬프트 내 줄바꿈 |

## 실전 Pro Tips

1. **Planning 먼저** - 복잡한 작업은 반드시 Plan 모드로 시작
2. **Skills 호출 명시** - 구현 전 해당 Skill을 명시적으로 지정
3. **2-Strike Rule** - 같은 수정 2회 실패 시 접근 방법 전환
4. **작은 단위 커밋** - 큰 변경을 작은 커밋으로 분리
5. **매일 /clear** - 새 작업 시작 시 깨끗한 컨텍스트 확보
6. **백그라운드 활용** - `Ctrl+B`로 dev server 실행
7. **검증 후 커밋** - `/verify-app` 통과 후에만 커밋

## 문제 해결

| 증상 | 해결 |
|------|------|
| Skill 미작동 | Hook 시스템 확인, SKILL.md frontmatter 점검 |
| Agent 미호출 | description 구체화, skills 목록 확인 |
| 권한 오류 | `.claude/settings.json` 권한 설정 확인 |
| 컨텍스트 오버플로 | `/clear` 사용, 작업 분할 |
| 느린 응답 | 모델을 haiku로 변경 |
| 타입 에러 반복 | `npx tsc --noEmit` 결과 확인 후 근본 원인 분석 |
| Hook 미실행 | 이벤트명, matcher 패턴, command 경로 점검 |

## 필수 링크

- [공식 문서](https://docs.anthropic.com/en/docs/claude-code)
- [Skills 문서](https://docs.anthropic.com/en/docs/claude-code/skills)
- [Sub-agents 가이드](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Hooks 문서](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [커뮤니티 Discord](https://discord.gg/anthropic)

---

*빠른 참조를 위한 체크리스트. 마지막 업데이트: 2026-03-06*
*환경: macOS (VS Code / Cursor 호환) | CLI v2.1.x | Claude 4.6 family*

#quick-reference #cheatsheet #claude-code
