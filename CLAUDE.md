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
RootNavigator → Main (BottomTabs) → Home | Favorites | Alerts | Settings

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

## Critical Rules

1. **TypeScript strict mode** - no `any`, explicit return types
2. **Cleanup subscriptions** in useEffect return functions
3. **Seoul API** - 30s minimum polling interval
4. **Coverage thresholds**: 75% statements, 70% functions, 60% branches
5. **Error handling** - return empty arrays/null instead of throwing

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
| **Opus 4.5** | 복잡한 설계, 오케스트레이션, 아키텍처 결정 | 새 기능 설계, 대규모 리팩토링 |
| **Sonnet** | UI/백엔드 구현, 일반 개발 작업 | 컴포넌트 구현, 서비스 작성 |
| **Haiku** | 빠른 검증, 단순 작업, 코드 분석 | 테스트 작성, 린트 수정, 버그 수정 |

### 잘못된 행동 기록 (팀 공유)

Claude가 잘못된 행동을 할 때마다 여기에 기록하여 같은 실수를 방지합니다.

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

메인 에이전트(Opus)가 직접 서브에이전트를 스폰합니다.

| 복잡도 | 에이전트 수 | 기준 |
|--------|-----------|------|
| Trivial | 0 | 단일 파일, 명확한 수정 |
| Simple | 1 | 2-3 파일, 한 영역 |
| Moderate | 2-3 | UI+서비스 또는 크로스 영역 |
| Complex | 3+ | 풀스택, 아키텍처 변경 |

**에이전트**: mobile-ui-specialist(inherit), backend-integration-specialist(inherit),
test-automation-specialist(haiku), performance-optimizer(haiku), quality-validator(haiku)
**평가**: eval-task-runner(inherit), eval-grader(inherit)
**품질 기준**: `.claude/agents/shared/quality-reference.md`

## Skill Routing (필수)

구현 전 반드시 해당 스킬을 Skill 도구로 호출할 것:

| 작업 유형 | 스킬 |
|-----------|------|
| React Native/UI/컴포넌트/화면 | `react-native-development` |
| Firebase/Auth/Firestore | `firebase-integration` |
| 테스트/커버리지 | `test-automation` |
| 병렬 에이전트 (3+ 작업) | `parallel-coordinator` |
| 구현 완료 검증 | `verification-loop` |

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
