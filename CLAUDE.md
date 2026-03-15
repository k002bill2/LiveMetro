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

## Critical Rules

1. **TypeScript strict mode** - no `any`, explicit return types
2. **Cleanup subscriptions** in useEffect return functions
3. **Seoul API** - 30s minimum polling interval
4. **Coverage thresholds**: 75% statements, 70% functions, 60% branches
5. **Error handling** - return empty arrays/null instead of throwing
6. **Surgical Changes** - 요청한 것만 변경. 관련 없는 파일을 리팩토링하거나, 요청하지 않은 "개선"을 하지 않음. 부수 변경이 필요하면 명시적으로 사용자에게 확인

## Claude Code System Architecture

### ACE Framework (Autonomous Cognitive Entity)

프로젝트 전체에 ACE 6-Layer 아키텍처가 적용됩니다:

| Layer | 역할 | 구현 | 강제 수준 |
|-------|------|------|-----------|
| 1. Aspirational | 보안/윤리 필터 + Veto Protocol | `ethicalValidator.js` (fail-closed) | **Hook 강제** — 위험 명령 차단, 30s 폴링 검증, Veto 기록 |
| 2. Global Strategy | 전략 가이드라인 | `effort-scaling.md` (문서) | **프롬프트 의존** — LLM이 문서 참조하여 판단 |
| 3. Agent Model | 에이전트 학습/진화 | `agentMemory.js` + 에이전트 `.md` | **자동 기록** — agentTracer가 완료 시 agent-memory에 기록 |
| 4. Executive Function | 태스크 분해, HITL 차단 | `task-allocator.js` + `parallelCoordinator.js` | **Hook 강제** — CRITICAL/HIGH 작업 차단, 에이전트 추천 |
| 5. Cognitive Control | 충돌 방지, 파일 락 (뮤텍스) | `parallelCoordinator.js` + `file-lock-manager.js` | **Hook 강제** — 파일 락, stale 정리, 체크포인트 |
| 6. Task Prosecution | 42개 스킬 실행 + 피드백 루프 | 개별 에이전트 → feedback-loop → agent-memory | **양방향** — L6→L4(메트릭), L6→L3(학습), L1→L3(Veto) |

**상세**: `.claude/agents/shared/ace-framework.md`

### Hook System (자동화 파이프라인)

| 훅 | 이벤트 | 기능 |
|----|--------|------|
| `ethicalValidator.js` | PreToolUse/Bash | 위험 명령 차단 (rm -rf, force push, 하드코딩 키) |
| `parallelCoordinator.js` | Pre/PostToolUse/Task | 파일 락, 병렬 에이전트 조정, stale 정리 |
| `geminiAutoTrigger.js` | PostToolUse/Edit\|Write | 30초 debounce 후 Gemini 크로스 리뷰 큐잉 |
| `aceMatrixSync.js` | PostToolUse/Edit\|Write | ACE enforcement matrix 동기화 검사 |
| `agentTracer.js` | PostToolUse/Task | 에이전트 활동 추적 (JSONL 이벤트 로그) |
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

### Agent Self-Evolution (자기 진화)

에이전트가 태스크 수행 중 학습한 패턴/실패/성공을 `.claude/agents/agent-memory/`에 JSONL로 기록합니다.

- **자동 기록**: `agentTracer.js` PostToolUse:Task 훅이 에이전트 완료 시 `agentMemory.recordLearning()` 자동 호출
- **Veto 기록**: `ethicalValidator.js`가 차단 시 agent-memory에 failure 학습 기록
- **조회**: `agentMemory.queryLearnings({ agentId, tags, minConfidence })` → 프롬프트에 포함 가능
- **정리**: `agentMemory.pruneOldEntries()` — confidence 0.3 이하 + 30일 이상 항목 제거
- **공유**: confidence 0.8 이상은 `shared-learnings.jsonl`에도 기록
- **피드백 경로**: L6(스킬 실행) → agentTracer → agent-memory(L3) + feedback-loop(L4)

### Quality Gates (품질 게이트)

모든 에이전트가 준수하는 품질 기준 (`quality-gates.md`):

**Ethical Gate** (Layer 1):
- API 키 하드코딩 금지 → Ethical Veto
- Seoul API 30초 미만 폴링 → Ethical Veto
- 백업 없이 사용자 데이터 수정 → Ethical Veto
- 무한 루프 가능성 → Ethical Veto

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

메인 에이전트(Opus)가 ACE Framework 기반으로 서브에이전트를 스폰합니다.

### Effort Scaling (복잡도별 에이전트 할당)

| 복잡도 | 에이전트 수 | 기준 | 예상 토큰 |
|--------|-----------|------|----------|
| Trivial | 0 | 단일 파일, 명확한 수정 | ~1K |
| Simple | 1 | 2-3 파일, 한 영역 | ~5K |
| Moderate | 2-3 | UI+서비스 또는 크로스 영역 | ~50K |
| Complex | 3+ | 풀스택, 아키텍처 변경 | ~150K |

**상세**: `.claude/agents/shared/effort-scaling.md`

### 에이전트 구성

| 에이전트 | 모델 | 역할 |
|----------|------|------|
| mobile-ui-specialist | Sonnet | React Native UI/UX, Firebase, Seoul API |
| test-automation-specialist | Haiku | Jest, RNTL, 커버리지 분석 |
| quality-validator | Haiku | 최종 품질 검증 (TypeScript, ESLint, 커버리지) |
| eval-task-runner | Inherit | 평가 태스크 오케스트레이션, pass@k 계산 |
| eval-grader | Inherit | 코드/LLM 기반 평가 채점 |

### Parallel Execution Safety

병렬 에이전트 실행 시 안전 프로토콜 적용:
- **파일 락**: `parallelCoordinator.js`가 파일 레벨 충돌 방지
- **워크스페이스 격리**: Agent tool의 `isolation: "worktree"` 활용
- **HITL 분류**: LOW(자동) → MEDIUM(자동) → HIGH(승인) → CRITICAL(필수 승인)
- **Fan-Out/Fan-In**: Primary가 분배 → 병렬 실행 → 결과 통합

**상세**: `.claude/agents/shared/parallel-agents-protocol.md`

### 품질 기준

`.claude/agents/shared/quality-gates.md`

## Skill Routing (필수)

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
| 병렬 에이전트 (3+ 작업) | `parallel-coordinator` |
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
| 세션 정리/종료 | `session-wrap` |

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
