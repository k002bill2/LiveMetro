# Claude Code Automation & Orchestration

LiveMetro의 Claude Code 자동화 파이프라인과 멀티 에이전트 오케스트레이션 상세.
CLAUDE.md에서 분리된 SSOT 문서 — 행동 규칙은 100% 보존, 상세 표만 여기에 둔다.

## System Architecture

Claude Code 네이티브 이벤트(UserPromptSubmit / PreToolUse / PostToolUse / Notification)만 사용합니다. 외부 데몬·서비스 없이 self-contained Node.js 훅으로 모든 자동화를 구현하며, Gemini 크로스 리뷰·registry 동기화 등 부수 로직도 동일 훅 안에서 동작합니다.

### Hook System (자동화 파이프라인)

`.claude/settings.json`에 wire된 훅 (전역):

| 훅 | 이벤트 | 기능 |
|----|--------|------|
| `pathProtection.js` | PreToolUse/Edit\|Write | `.env*`, `google-services.json`, `.ssh/`, 키 파일 등 민감 경로 편집 차단 |
| `fileLock.js acquire` | PreToolUse/Edit\|Write | 동일 파일 다중 에이전트 편집 advisory lock (60초 TTL) |
| `ethicalValidator.js` | PreToolUse/Bash | 위험 명령 차단 (rm -rf, force push, 하드코딩 키, Seoul API 30초 폴링 검증) |
| `fileLock.js release` | PostToolUse/Edit\|Write | acquire 짝 해제 |
| `geminiAutoTrigger.js` | PostToolUse/Edit\|Write | 30초 debounce 후 Gemini 크로스 리뷰 큐잉 (atomic trigger write) |
| `outputSecretFilter.js` | PostToolUse/Bash | Bash 출력의 API키/토큰/시크릿 사후 감지 및 stderr 경고 (마스킹은 미수행) |
| `userPromptSubmit.js` | UserPromptSubmit | 스킬/에이전트 자동 활성화, Gemini 리뷰 결과 주입 |
| Notification | Notification | macOS `osascript` 알림 (jq → display notification) |

`.claude/settings.local.json`에 wire되는 선택 훅:

| 훅 | 이벤트 | 기능 |
|----|--------|------|
| `typeCheckHook.sh` | PostToolUse/Edit\|Write | .ts/.tsx 편집 후 자동 `npx tsc --noEmit` (개인 환경에서만 활성) |

**설정**: `.claude/settings.json` (팀 공유), `.claude/settings.local.json` (개인, gitignore됨)

### Gemini CLI Integration (크로스 검증)

Claude Code와 Gemini CLI가 자동 연동됩니다:

- **자동 리뷰**: 코드 변경 시 30초 debounce 후 Gemini 크로스 리뷰
- **UserPromptSubmit**: 매 프롬프트에 Gemini 리뷰 결과 자동 주입
- **모드**: review (변경 검증), scan (대규모 분석), parallel (독립 태스크)
- **제약**: 읽기 전용, 일일 900회 제한

**커맨드**: `/gemini-review`, `/gemini-scan`

### MCP Server Integration

외부 MCP 서버를 통한 기능 확장 (`.mcp.json`):

| 서버 | 용도 |
|------|------|
| `context7` | React Native, Expo, Firebase 등 실시간 라이브러리 문서 조회 |
| `memory` | 영구 지식 그래프 - 프로젝트 인사이트/결정사항 세션 간 보존 |

### Quality Gates (품질 게이트)

모든 에이전트가 준수하는 품질 기준:

**보안 체크**:
- API 키 하드코딩 금지
- Seoul API 30초 미만 폴링 금지 (차단 위험)
- 사용자 데이터 수정 전 백업 확인
- 무한 루프 가능성 차단

**Technical Gates**:
- TypeScript strict (no `any`) + ESLint 0 에러
- 커버리지 75%/70%/60%
- Firebase 구독 cleanup 필수
- React Native: StyleSheet, memo, accessibility labels

## Multi-Agent Orchestration

Claude Code 네이티브 Agent 툴로 서브에이전트를 스폰합니다. 커스텀 오케스트레이션 계층은 사용하지 않습니다.

### Effort Scaling (복잡도별 에이전트 할당)

| 복잡도 | 에이전트 수 | 기준 | 예상 토큰 |
|--------|-----------|------|----------|
| Trivial | 0 | 단일 파일, 명확한 수정 | ~1K |
| Simple | 1 | 2-3 파일, 한 영역 | ~5K |
| Moderate | 2-3 | UI+서비스 또는 크로스 영역 | ~50K |
| Complex | 3+ | 풀스택, 아키텍처 변경 | ~150K |

### 에이전트 구성

| 에이전트 | 모델 | 역할 |
|----------|------|------|
| mobile-ui-specialist | Sonnet | React Native UI/UX, Firebase, Seoul API |
| test-automation-specialist | Haiku | Jest, RNTL, 커버리지 분석 |
| quality-validator | Haiku | 최종 품질 검증 (TypeScript, ESLint, 커버리지) |
| eval-task-runner | Inherit | 평가 태스크 오케스트레이션, pass@k 계산 |
| eval-grader | Inherit | 코드/LLM 기반 평가 채점 |

### Parallel Execution Safety

병렬 에이전트 실행 시 Claude Code 네이티브 기능만 사용:
- **워크스페이스 격리**: Agent 툴의 `isolation: "worktree"` 활용
- **승인 절차**: 파괴적/되돌리기 어려운 작업은 사용자 확인 필수
- **Fan-Out/Fan-In**: 단일 메시지에서 다수 Agent 호출 → 결과 통합

### File Lock (병렬 충돌 방지)

여러 에이전트가 동시 작업 시 파일 충돌을 막기 위한 규칙:

| 시나리오 | 규칙 |
|---------|------|
| 같은 파일 타깃 (예: 2 에이전트가 `src/services/firebase.ts` 편집) | **순차 실행** — Fan-Out 금지, 한 에이전트 완료 후 다음 호출 |
| 같은 디렉토리, 다른 파일 (A는 `firebase.ts`, B는 `firebase.test.ts`) | **병렬 허용** — 결과를 main에서 diff로 검증 |
| 크로스 영역 (UI + 테스트 에이전트) | **병렬 권장** — `isolation: "worktree"`로 격리 |
| 같은 파일 + 다른 worktree | **머지 책임은 main 에이전트** — 충돌 시 수동 해결 |

**판단 기준**: Agent를 spawn하기 전에 "두 에이전트가 편집할 파일 목록이 겹치는가?" 체크. 겹치면 순차, 안 겹치면 병렬 + worktree.

**Anti-pattern**: "작은 변경이니까 병렬로 충분" — 작은 변경도 같은 줄을 동시에 수정하면 last-write-wins로 데이터 손실 발생.

## 모델 선택 가이드

| 모델 | 용도 | 예시 |
|------|------|------|
| **Opus** | 복잡한 설계, 오케스트레이션, 아키텍처 결정 | 새 기능 설계, 대규모 리팩토링 |
| **Sonnet** | UI/백엔드 구현, 일반 개발 작업 | 컴포넌트 구현, 서비스 작성 |
| **Haiku** | 빠른 검증, 단순 작업, 코드 분석 | 테스트 작성, 린트 수정, 버그 수정 |
