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
Data Flow:  Seoul API → Firebase → AsyncStorage (Cache)
Navigation: RootNavigator → Main (BottomTabs) → Home | Map | Favorites | Alerts | Settings
State:      AuthContext + Custom Hooks (no Redux)
```

상세(데이터 흐름·네비게이션·상태 관리): [Architecture](docs/claude/architecture.md)

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

프로젝트 전용 규칙 7개가 항상 로드됩니다. 각 규칙의 BANNED 표·상세는 해당 파일이 SSOT (여기엔 복붙하지 않음):

| 규칙 파일 | 내용 |
|-----------|------|
| `typescript-strict.md` | `any` 금지, 명시적 반환 타입, strict mode |
| `path-aliases.md` | `@/` alias 필수, 상대 경로 금지 |
| `subscription-cleanup.md` | useEffect cleanup, onSnapshot 해제, 타이머 정리 |
| `seoul-api-limits.md` | 30초 최소 폴링, 타임아웃 10초, 캐시 폴백 |
| `error-handling.md` | 빈 배열/null 반환, throw 지양, ErrorBoundary |
| `react-native-patterns.md` | StyleSheet.create, memo, FlatList, 접근성 |
| `coverage-thresholds.md` | Stmt 75%, Fn 70%, Branch 60% |

추가 컨텍스트 규칙: `mandatory-docs.md`(영역별 필수 Read 문서), `livemetro-workflow.md`(skill routing·에이전트 수·배포 검증), `livemetro-functions.md`(Firebase Functions).

> 글로벌 규칙(`~/.claude/rules/`)도 함께 적용: surgical changes, DRY/KISS/YAGNI, 보안, 검증

## Workflow

- **구현 전 스킬 호출 (필수)**: 작업 유형별 Skill 라우팅 SSOT는 `.claude/rules/livemetro-workflow.md`. 전체 커맨드(21)·스킬(22) 인벤토리는 [Commands & Skills](docs/claude/commands-and-skills.md).
- **피드백 루프**: 코드 변경 후 `/verify-app` → PR 전 `/check-health` → 커밋 `/commit-push-pr` → 리팩토링 `/simplify-code`.
- **검증 후 커밋**: `/verify-app`(tsc + lint + test) 통과 후에만 커밋. 빌드 깨진 채 커밋 금지.
- **2-Strike Rule**: 같은 수정을 2회 시도 후 실패하면 멈추고 근본 원인 분석.
- **작은 단위 + Plan 먼저**: 복잡/3+파일 변경은 Plan 모드로 시작, 큰 변경은 작은 커밋으로 분리.
- **복잡도별 에이전트 수**: 라우팅은 `.claude/rules/livemetro-workflow.md`, 상세 effort scaling은 [Automation](docs/claude/automation.md).
- **병렬 에이전트 파일 충돌**: 편집 파일이 겹치면 순차, 안 겹치면 병렬 + `isolation: "worktree"`. 상세 File Lock 표는 [Automation](docs/claude/automation.md).
- **배포**: 배포 전 검증 체크리스트는 `.claude/rules/livemetro-workflow.md` + [Development Guide](docs/DEVELOPMENT.md). Production 빌드는 `/deploy-with-tests` 사용.

## Automation & Orchestration

Claude Code 네이티브 훅으로 모든 자동화를 구현 (외부 데몬 없음): 민감 경로 보호, 파일락, Gemini 크로스 리뷰, 시크릿 필터, 스킬 자동 활성화. 멀티 에이전트는 네이티브 Agent 툴로 스폰.

상세(훅 목록·Gemini·MCP·Quality Gates·effort scaling·에이전트 구성·File Lock·모델 선택): [Automation & Orchestration](docs/claude/automation.md)

## Reference Documentation

- [Architecture](docs/claude/architecture.md) — Data flow, navigation, state management
- [API Reference](docs/claude/api-reference.md) — Seoul Metro API, Firebase collections
- [Development Patterns](docs/claude/development-patterns.md) — Adding screens/hooks/services, 성능 패턴, anti-patterns
- [Testing Guide](docs/claude/testing.md) — Jest config, coverage, test patterns
- [Automation & Orchestration](docs/claude/automation.md) — Hooks, Gemini, MCP, multi-agent, 모델 선택
- [Commands & Skills](docs/claude/commands-and-skills.md) — 전체 커맨드·스킬 인벤토리
- [Development Guide](docs/DEVELOPMENT.md) — Workflows, validation gates, deploy
