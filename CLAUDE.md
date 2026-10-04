# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**LiveMetro**: React Native Expo app for Seoul subway real-time arrivals.

| Technology | Version |
|------------|---------|
| React Native | 0.83 (New Architecture) |
| Expo SDK | ~55 |
| React | 19 |
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

`@/` = `src/` (+ `@components`/`@screens`/`@services`/`@models`/`@utils`/`@hooks`). 상대 경로 import 금지 — 전체 매핑표 SSOT는 항상-로드 규칙 [`path-aliases.md`](.claude/rules/path-aliases.md) (L53 원칙대로 여기엔 복붙하지 않음).

## Project Rules (`.claude/rules/`)

프로젝트 전용 규칙 8개(핵심 6개 + 추가 2개)가 항상 로드됩니다. 각 규칙의 상세·함정 표는 해당 파일이 SSOT (여기엔 복붙하지 않음):

| 규칙 파일 | 내용 |
|-----------|------|
| `typescript-strict.md` | `any` 금지, 명시적 반환 타입 (lint 미강제 — 규칙이 유일 게이트) |
| `path-aliases.md` | `@/` alias 필수, 상대 경로 금지 |
| `subscription-cleanup.md` | useEffect cleanup, onSnapshot 해제, 타이머 정리 |
| `seoul-api-limits.md` | 30초 최소 폴링, 타임아웃 10초, 캐시 폴백 |
| `error-handling.md` | 서비스는 빈 배열/null 반환(throw 금지), ErrorBoundary |
| `react-native-patterns.md` | 접근성 필수, 테마 색상, Pretendard fontWeight 함정 |

추가 컨텍스트 규칙: `mandatory-docs.md`(영역별 필수 Read 문서), `livemetro-workflow.md`(skill routing·에이전트 수·배포 검증). 테스트·커버리지 규칙은 `test-automation` 스킬로 이관 — 테스트 작업 시에만 로드. 도달 경로는 3중: `livemetro-workflow.md`의 Skill Routing(항상 로드)이 호출을 지시하고, superpowers 스킬-필수 규칙이 강제하며, skillGateGuard가 누락 시 경고. 커버리지 실게이트는 CI의 `jest --coverage`(SSOT=`jest.config.js`). Firebase Functions 규칙은 `functions/CLAUDE.md`로 분리 — functions/ 작업 시에만 자동 로드(항상-로드 비용 제거).

> 글로벌 규칙(`~/.claude/rules/`)도 함께 적용: surgical changes, DRY/KISS/YAGNI, 보안, 검증

## Workflow

- **구현 전 스킬 호출 (필수)**: 작업 유형별 Skill 라우팅 SSOT는 `.claude/rules/livemetro-workflow.md`. 전체 커맨드·스킬 인벤토리는 [Commands & Skills](docs/claude/commands-and-skills.md).
- **피드백 루프**: 코드 변경 후 `/verify-app` → PR 전 `/check-health` → 커밋 `/commit-push-pr` → 리팩토링 `/simplify-code`.
- **검증 후 커밋**: `/verify-app`(tsc + lint + test) 통과 후에만 커밋. 빌드 깨진 채 커밋 금지.
- **2-Strike Rule**: 같은 수정을 2회 시도 후 실패하면 멈추고 근본 원인 분석.
- **작은 단위 + Plan 먼저**: 범위가 불확실하면 Plan 모드로 시작, 큰 변경은 작은 커밋으로 분리. (파일 수 기준 HARD-GATE는 2026-08-09 폐지 — 기준은 파일 개수가 아니라 불확실성)
- **복잡도별 에이전트 수**: 라우팅은 `.claude/rules/livemetro-workflow.md`, 상세 effort scaling은 [Automation](docs/claude/automation.md).
- **병렬 에이전트 파일 충돌**: 편집 파일이 겹치면 순차, 안 겹치면 병렬 + `isolation: "worktree"`. 상세 File Lock 표는 [Automation](docs/claude/automation.md).
- **위임 판단**: 위임은 기본값이 아니다. 서로 독립인 작업 2건 이상 병렬, 워크트리 격리가 필요한 동시 파일 변경, 또는 메인 창을 실제로 위협하는 대량 원문일 때만 `worker`(Opus)에게 맡긴다 — 위임 비용은 창 크기가 아니라 컨텍스트 재적재와 요약 과정의 정보 손실이다(서브에이전트도 부모의 1M 창을 상속). 위임할 땐 파일 범위와 완료 기준을 명시하고, 메인이 설계·통합·최종 검토를 유지한다. 기준 SSOT는 `~/.claude/CLAUDE.md` "위임 판단".
- **배포**: 배포 전 검증 체크리스트는 `.claude/rules/livemetro-workflow.md` + [Development Guide](docs/DEVELOPMENT.md). Production 빌드는 `/deploy-with-tests` 사용.

## Automation & Orchestration

Claude Code 네이티브 훅으로 모든 자동화를 구현 (외부 데몬 없음): 민감 경로 보호, 파일락, 시크릿 필터, 스킬 자동 활성화. 멀티 에이전트는 네이티브 Agent 툴로 스폰.

상세(훅 목록·MCP·Quality Gates·effort scaling·에이전트 구성·File Lock·모델 선택): [Automation & Orchestration](docs/claude/automation.md)

## Reference Documentation

- [Architecture](docs/claude/architecture.md) — Data flow, navigation, state management
- [API Reference](docs/claude/api-reference.md) — Seoul Metro API, Firebase collections
- [Development Patterns](docs/claude/development-patterns.md) — Adding screens/hooks/services, 성능 패턴, anti-patterns
- [Testing Guide](docs/claude/testing.md) — Jest config, coverage, test patterns
- [Automation & Orchestration](docs/claude/automation.md) — Hooks, MCP, multi-agent, 모델 선택
- [Commands & Skills](docs/claude/commands-and-skills.md) — 전체 커맨드·스킬 인벤토리
- [Development Guide](docs/DEVELOPMENT.md) — Workflows, validation gates, deploy
