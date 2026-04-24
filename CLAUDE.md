# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**LiveMetro**: React Native Expo app for Seoul subway real-time arrivals.

| Technology | Version |
|------------|---------|
| React Native | 0.72 |
| Expo SDK | ~49 |
| TypeScript | 5.1+ (strict) |
| Firebase | Auth, Firestore |
| Navigation | React Navigation 6.x |

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start Expo dev server |
| `npm test` | Run Jest tests |
| `npm run lint` | ESLint with auto-fix |
| `npm run type-check` | TypeScript check |
| `npm run build:production` | Production build |

## Architecture

```
Data Flow: Seoul API → Firebase → AsyncStorage (Cache)

Navigation:
RootNavigator → Main (BottomTabs) → Home | Map | Favorites | Alerts | Settings

State: AuthContext + Custom Hooks (no Redux)
```

## Path Aliases

| Alias | Path |
|-------|------|
| `@` | `src/` |
| `@components` | `src/components` |
| `@screens` | `src/screens` |
| `@services` | `src/services` |
| `@models` | `src/models` |
| `@utils` | `src/utils` |
| `@hooks` | `src/hooks` |

**Use path aliases, not relative imports.**

## Project Rules (`.claude/rules/`)

프로젝트 전용 규칙 7개가 항상 로드됩니다:

| 규칙 파일 | 내용 |
|-----------|------|
| `typescript-strict.md` | `any` 금지, 명시적 반환 타입, strict mode |
| `path-aliases.md` | `@/` alias 필수, 상대 경로 금지 |
| `subscription-cleanup.md` | useEffect cleanup, onSnapshot 해제, 타이머 정리 |
| `seoul-api-limits.md` | 30초 최소 폴링, 타임아웃 10초, 캐시 폴백 |
| `error-handling.md` | 빈 배열/null 반환, throw 지양, ErrorBoundary |
| `react-native-patterns.md` | StyleSheet.create, memo, FlatList, 접근성 |
| `coverage-thresholds.md` | Stmt 75%, Fn 70%, Branch 60% |

> 글로벌 규칙(`~/.claude/rules/`)도 함께 적용: surgical changes, DRY/KISS/YAGNI, 보안, 검증

## Claude Code System Architecture

Claude Code 네이티브 기능(Agent 툴, Skill 툴, Hook)만 사용합니다. 커스텀 오케스트레이션 계층은 두지 않습니다.

### Hook System (자동화 파이프라인)

보안·생산성을 위한 최소 훅만 유지합니다.

| 훅 | 이벤트 | 기능 |
|----|--------|------|
| `ethicalValidator.js` | PreToolUse/Bash | 위험 명령 차단 (rm -rf, force push, 하드코딩 키, Seoul API 30초 폴링 검증) |
| `geminiAutoTrigger.js` | PostToolUse/Edit\|Write | 30초 debounce 후 Gemini 크로스 리뷰 큐잉 |
| `userPromptSubmit.js` | UserPromptSubmit | 스킬/에이전트 자동 활성화, Gemini 리뷰 결과 주입 |
| `outputSecretFilter.sh` | PostToolUse/Bash | Bash 출력에서 API키/토큰/시크릿 자동 마스킹 |
| TypeScript 체크 | PostToolUse/Edit\|Write | .ts/.tsx 편집 시 자동 `npx tsc --noEmit` |

**설정**: `.claude/settings.json`, `.claude/settings.local.json`

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

## Boris Cherny 워크플로우

### 피드백 루프 규칙 (필수)

| 시점 | 실행 커맨드 | 목적 |
|------|------------|------|
| 코드 변경 후 | `/verify-app` | 타입, 린트, 테스트, 빌드 검증 |
| PR 생성 전 | `/check-health` | 전체 상태 점검 |
| 커밋 전 | `/commit-push-pr` | 자동화된 커밋/푸시/PR |
| 리팩토링 시 | `/simplify-code` | 복잡도 분석 및 단순화 |

### 모델 선택 가이드

| 모델 | 용도 | 예시 |
|------|------|------|
| **Opus** | 복잡한 설계, 오케스트레이션, 아키텍처 결정 | 새 기능 설계, 대규모 리팩토링 |
| **Sonnet** | UI/백엔드 구현, 일반 개발 작업 | 컴포넌트 구현, 서비스 작성 |
| **Haiku** | 빠른 검증, 단순 작업, 코드 분석 | 테스트 작성, 린트 수정, 버그 수정 |

### 잘못된 행동 기록 (팀 공유)

| 날짜 | 문제 | 해결 방법 |
|------|------|----------|
| 2024-01-05 | `any` 타입 사용 | `unknown` 또는 구체적 타입으로 대체 |
| 2024-01-05 | useEffect 정리 함수 누락 | 모든 구독/타이머에 cleanup 추가 |
| 2024-01-05 | 상대 경로 import 사용 | `@` 경로 별칭 사용 |
| 2024-01-05 | console.log 남김 | 프로덕션 코드에서 제거 |
| 2024-01-05 | 테스트 없이 구현 | 구현과 함께 테스트 작성 |
| 2026-02-06 | 동일 수정 3회+ 반복 | 2회 실패 후 접근 전환 (2-Strike Rule) |
| 2026-02-06 | 배포 전 환경 점검 누락 | Pre-validation 단계 필수 실행 |
| 2026-02-06 | 단순 요약만 제공 | 원인/영향/해결책 분석 포함 |

### 워크플로우 권장사항

1. **Plan 모드 먼저**: 복잡한 작업은 Plan 모드로 시작
2. **검증 후 커밋**: `/verify-app` 통과 후에만 커밋
3. **작은 단위**: 큰 변경을 작은 커밋으로 분리
4. **문서화**: 복잡한 로직에 주석 추가

## Deployment Validation

**배포 전 반드시 전체 검증을 통과해야 합니다.**

```bash
# 필수 사전 검증 순서
npm run type-check    # 1. TypeScript 에러 0개
npm run lint          # 2. ESLint 에러 0개
npm test -- --coverage # 3. 테스트 통과 + 커버리지 충족
```

| 단계 | 실패 시 조치 |
|------|-------------|
| type-check 실패 | 타입 에러 수정 후 재검증 |
| lint 실패 | `npm run lint -- --fix` 후 수동 수정 |
| 테스트 실패 | 테스트 또는 코드 수정 후 재검증 |
| 커버리지 미달 | 테스트 추가 후 재검증 |

**Production 빌드는 반드시 `/deploy-with-tests` 커맨드를 사용합니다.**

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

## Skills 2.0 Three-Tier Architecture

### Commands (`.claude/commands/`) — 21개, 사용자 `/` 호출

| 커맨드 | 용도 |
|--------|------|
| `/verify-app` | 타입체크 + 린트 + 테스트 + 빌드 검증 |
| `/check-health` | 프로젝트 전체 상태 점검 |
| `/commit-push-pr` | 커밋 → 푸시 → PR 자동화 |
| `/deploy-with-tests` | 검증 후 배포 |
| `/review` | 코드 리뷰 (보안/성능/타입 체크리스트) |
| `/test-coverage` | 커버리지 분석 |
| `/simplify-code` | 복잡도 분석 및 단순화 |
| `/draft-commits` | Conventional Commits 초안 |
| `/start-dev` | Expo dev 서버 시작 |
| `/gemini-review` | Gemini 크로스 리뷰 |
| `/gemini-scan` | Gemini 대규모 분석 |
| `/run-eval` | 평가 태스크 실행 |
| `/eval-dashboard` | 평가 결과 대시보드 |
| `/config-backup` | 설정 백업/복원 |
| `/save-and-compact` | 컨텍스트 저장 + compact |
| `/session-wrap` | 세션 종료 정리 |
| `/resume` | 이전 세션 재개 |
| `/dev-docs` | Dev Docs 시스템 생성 |
| `/update-dev-docs` | Dev Docs 업데이트 |
| `/sync-registry` | 레지스트리 동기화 |
| `/run-workflow` | 워크플로우 실행 |

### Skills (`.claude/skills/`) — 18개, 컨텍스트 기반 on-demand 로드

구현 전 반드시 해당 스킬을 Skill 도구로 호출할 것:

| 작업 유형 | 스킬 |
|-----------|------|
| React Native/UI/컴포넌트/화면 | `react-native-development` |
| Firebase/Auth/Firestore | `firebase-integration` |
| 테스트/커버리지/TDD | `test-automation` |
| 서울 지하철 API 통합 | `api-integration` |
| 지하철 데이터 정규화/파싱 | `subway-data-processor` |
| 위치 권한/주변역 검색 | `location-services` |
| 푸시 알림/도착 알림 | `notification-system` |
| 구현 완료 검증 | `verification-loop` |
| 기능 계획/페이즈 설계 | `cc-feature-implementer-main` |
| 장기 작업 컨텍스트 보존 | `external-memory` |
| 에이전트 성능 추적 | `agent-observability` |
| 역정보 조회/역 검색/주변역 | `station-info` |
| 혼잡도/크라우드소싱/히트맵 | `crowdsourced-congestion` |
| 경로 탐색/요금 계산/환승 | `route-fare-calculation` |
| 통계/분석/차트/대시보드 | `statistics-analytics` |
| 테마/다크모드/다국어/i18n | `theme-i18n-system` |
| TTS/사운드/진동/접근성 | `audio-accessibility` |
| 신뢰도/평판/뱃지/사기탐지 | `user-trust-reputation` |
| 성능 모니터링/헬스체크/크래시 | `monitoring-observability` |

### Rules (`.claude/rules/`) — 7개, 항상 로드

위 "Project Rules" 섹션 참조.

## Coding Guidelines

- 배포 전 검증: `npx tsc --noEmit` + `npm test` 실행 후 에러 0 확인
- 타입 안전성: TypeScript 타입 힌트 일관 사용
- 디버깅 규칙: 같은 수정을 2회 시도 후 실패하면 멈추고 근본 원인 분석

## Reference Documentation

For detailed information, see:

- [Architecture Details](docs/claude/architecture.md) - Data flow, navigation, state management
- [API Reference](docs/claude/api-reference.md) - Seoul Metro API, Firebase collections
- [Development Patterns](docs/claude/development-patterns.md) - Adding screens, hooks, services
- [Testing Guide](docs/claude/testing.md) - Jest config, coverage, test patterns
