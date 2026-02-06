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

## Debugging Guidelines

### 재시도 제한 규칙

| 시도 | 행동 |
|------|------|
| 1차 | 에러 분석 후 수정 시도 |
| 2차 | 다른 접근 방식으로 수정 시도 |
| 3차 이후 | **중단 → 근본 원인 분석 → 접근 전환** |

**동일한 수정을 3번 이상 반복하지 않습니다.** 2회 실패 시:
1. 현재까지 시도한 방법 정리
2. 에러의 근본 원인 재분석
3. 완전히 다른 접근 방식 탐색
4. 필요 시 사용자에게 컨텍스트 공유

### 디버깅 원칙
- **증상이 아닌 원인을 수정** - 에러 메시지를 억제하는 것이 아닌 근본 원인 해결
- **변경 범위 최소화** - 한 번에 하나의 변경만 적용하고 검증
- **가설 기반 디버깅** - 추측이 아닌 로그/증거 기반 접근

## Communication Style

### 응답 원칙
- **분석 > 요약**: 단순 나열이 아닌 원인/영향/해결책 분석 제공
- **구체적 예시**: 추상적 설명보다 코드 예시와 파일 위치 명시
- **왜(Why) 설명**: 무엇(What)을 했는지보다 왜(Why) 그렇게 했는지 설명
- **트레이드오프 명시**: 선택지가 있을 때 각각의 장단점 제시

### 에러 보고 형식
```
[문제] 무엇이 잘못되었는지
[원인] 왜 발생했는지
[시도] 어떤 해결을 시도했는지
[결과] 현재 상태
[다음] 권장 조치
```

## Tech Stack

| 영역 | 기술 | 비고 |
|------|------|------|
| Primary Language | TypeScript (strict) | `any` 금지 |
| Secondary | Python 3.x | 스크립트/도구용 |
| Framework | React Native + Expo | SDK ~49 |
| State | Context API + Custom Hooks | Redux 미사용 |
| Backend | Firebase (Auth + Firestore) | |
| API | Seoul Open Data API | 30s 폴링 제한 |
| Testing | Jest + RNTL | 커버리지 75%+ |
| CI/CD | EAS Build | expo-cli |

## Reference Documentation

For detailed information, see:

- [Architecture Details](docs/claude/architecture.md) - Data flow, navigation, state management
- [API Reference](docs/claude/api-reference.md) - Seoul Metro API, Firebase collections
- [Development Patterns](docs/claude/development-patterns.md) - Adding screens, hooks, services
- [Testing Guide](docs/claude/testing.md) - Jest config, coverage, test patterns
