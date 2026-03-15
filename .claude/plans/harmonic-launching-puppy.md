# Skills 2.0 균형 재구성: Commands + Rules 추가

## Context

현재 시스템 분석 결과 "Skills 40개 이상이지만 Commands/Rules 부재로 균형이 떨어짐"이라는 진단.
- **Skills**: 44개 (명령형 22 + 도메인 21 + 프레임워크 1)
- **Commands** (`.claude/commands/`): **0개**
- **Rules** (프로젝트 `.claude/rules/`): **0개**

22개 명령형 스킬(`disable-model-invocation: true`)이 Skills 디렉토리에 있어 구조적 불일치.
CLAUDE.md에 규칙이 산재되어 있으나 프로젝트 레벨 Rules 파일이 없음.

## 목표

Skills 2.0 3-tier 구조로 재구성:
- **Commands** (`.claude/commands/`): 사용자가 `/` 로 직접 호출하는 액션
- **Rules** (`.claude/rules/`): 항상 로드되는 프로젝트 규칙
- **Skills** (`.claude/skills/`): 컨텍스트에 따라 on-demand 로드되는 도메인 지식

---

## Step 1: Commands 디렉토리 생성 및 마이그레이션

`.claude/commands/` 에 22개 명령형 스킬을 이동. 각 커맨드는 flat `.md` 파일.

### 마이그레이션 대상 (22개)

| 현재 위치 | 커맨드 파일 |
|-----------|------------|
| `skills/verify-app/SKILL.md` | `commands/verify-app.md` |
| `skills/commit-push-pr/SKILL.md` | `commands/commit-push-pr.md` |
| `skills/check-health/SKILL.md` | `commands/check-health.md` |
| `skills/deploy-with-tests/SKILL.md` | `commands/deploy-with-tests.md` |
| `skills/start-dev/SKILL.md` | `commands/start-dev.md` |
| `skills/run-workflow/SKILL.md` | `commands/run-workflow.md` |
| `skills/review/SKILL.md` | `commands/review.md` |
| `skills/draft-commits/SKILL.md` | `commands/draft-commits.md` |
| `skills/test-coverage/SKILL.md` | `commands/test-coverage.md` |
| `skills/simplify-code/SKILL.md` | `commands/simplify-code.md` |
| `skills/gemini-review/SKILL.md` | `commands/gemini-review.md` |
| `skills/gemini-scan/SKILL.md` | `commands/gemini-scan.md` |
| `skills/eval-dashboard/SKILL.md` | `commands/eval-dashboard.md` |
| `skills/run-eval/SKILL.md` | `commands/run-eval.md` |
| `skills/config-backup/SKILL.md` | `commands/config-backup.md` |
| `skills/save-and-compact/SKILL.md` | `commands/save-and-compact.md` |
| `skills/session-wrap/SKILL.md` | `commands/session-wrap.md` |
| `skills/resume/SKILL.md` | `commands/resume.md` |
| `skills/update-dev-docs/SKILL.md` | `commands/update-dev-docs.md` |
| `skills/sync-registry/SKILL.md` | `commands/sync-registry.md` |
| `skills/dev-docs/SKILL.md` | `commands/dev-docs.md` |
| `skills/code-review/SKILL.md` → 병합 | `commands/review.md` (review와 통합) |

### 커맨드 형식 (Skills 2.0)

```markdown
---
name: verify-app
description: 앱 종합 검증 - 타입체크, 린트, 테스트, 빌드 한번에 실행
allowed-tools: Bash(npm run*), Bash(npx tsc*), Bash(npx jest*)
---

[기존 SKILL.md body 내용 - 불필요한 예시/설명 축소]
```

### 처리 방식

1. `skills/X/SKILL.md` → `commands/X.md` 복사 (frontmatter에서 `disable-model-invocation` 제거)
2. `skills/X/references/` 가 있는 경우 → `commands/` 에 인라인하거나 참조 유지
3. `code-review` + `review` → `commands/review.md` 로 통합 (code-review 체크리스트 포함)
4. 마이그레이션 완료 후 원본 skills 디렉토리 삭제

---

## Step 2: 프로젝트 Rules 생성

`.claude/rules/` 에 LiveMetro 전용 상시 규칙 파일 생성.
글로벌 규칙(`~/.claude/rules/`)과 중복하지 않음.

### 글로벌 규칙 (이미 존재 - 변경 불필요)

| 파일 | 내용 |
|------|------|
| `golden-principles.md` | Surgical changes, DRY/KISS/YAGNI, 함수/파일 크기 |
| `verification.md` | 증거 필수, 2-strike rule |
| `interaction.md` | 한국어, 파일:줄 참조 |
| `security.md` | 환경변수, 입력 검증 |

### 신규 프로젝트 Rules (7개)

| 파일 | 내용 | 출처 |
|------|------|------|
| `typescript-strict.md` | `any` 금지, 명시적 반환 타입, strict mode | CLAUDE.md |
| `path-aliases.md` | `@/` alias 필수, 상대 경로 금지 | CLAUDE.md |
| `subscription-cleanup.md` | useEffect cleanup, onSnapshot 해제, 타이머 정리 | CLAUDE.md + code-review |
| `seoul-api-limits.md` | 30초 최소 폴링 간격, API 키 관리 | CLAUDE.md |
| `error-handling.md` | 빈 배열/null 반환, throw 지양, ErrorBoundary | CLAUDE.md + code-review |
| `react-native-patterns.md` | StyleSheet.create, memo, accessibilityLabel, FlatList | code-review |
| `coverage-thresholds.md` | Stmt 75%, Fn 70%, Branch 60% | CLAUDE.md |

### Rules 형식

```markdown
# TypeScript Strict Mode

- `any` 타입 사용 금지 → `unknown` 또는 구체적 타입 사용
- 모든 함수에 명시적 반환 타입 선언
- TypeScript strict mode 활성화 상태 유지
- 제네릭 타입 적극 활용
```

Rules는 frontmatter 없이 간결한 마크다운. 항상 컨텍스트에 로드됨.

---

## Step 3: Skills 정리

남은 21개 도메인 스킬 유지 + ace-framework 처리.

### 유지 스킬 (21개)

| 스킬 | 용도 |
|------|------|
| `react-native-development` | RN 컴포넌트 패턴 |
| `firebase-integration` | Auth, Firestore 통합 |
| `test-automation` | Jest, RNTL 패턴 |
| `api-integration` | Seoul API 통합 |
| `subway-data-processor` | 데이터 정규화 |
| `location-services` | GPS, 주변역 |
| `notification-system` | 푸시 알림 |
| `station-info` | 역정보 조회 |
| `crowdsourced-congestion` | 혼잡도 시스템 |
| `route-fare-calculation` | 경로/요금 계산 |
| `statistics-analytics` | 통계/차트 |
| `theme-i18n-system` | 테마/다국어 |
| `audio-accessibility` | TTS/접근성 |
| `user-trust-reputation` | 신뢰도/평판 |
| `monitoring-observability` | 모니터링 |
| `parallel-coordinator` | 병렬 에이전트 |
| `verification-loop` | 검증 피드백 루프 |
| `cc-feature-implementer-main` | 기능 계획 |
| `external-memory` | 장기 컨텍스트 |
| `agent-observability` | 에이전트 추적 |
| `ace-framework` | ACE 6-Layer |

### 처리 사항

- `ace-framework/references/enforcement-matrix.md` → 유지 (프레임워크 참조)
- 각 스킬의 description에 `When to use` 정보가 충분한지 확인
- references/ 가 있는 스킬은 그대로 유지

---

## Step 4: CLAUDE.md 업데이트

- "Skill Routing" 테이블에서 command 항목 분리
- Commands 섹션 추가 (commands/ 디렉토리 참조)
- Rules 섹션 추가 (rules/ 디렉토리 참조)
- 중복 규칙 내용 제거 (rules/ 파일로 이동했으므로)

---

## Step 5: 검증

```bash
# 1. 구조 확인
ls .claude/commands/    # 22개 .md 파일
ls .claude/rules/       # 7개 .md 파일
ls .claude/skills/      # 21개 디렉토리

# 2. 기존 command-type skills 삭제 확인
# skills/ 에 disable-model-invocation 스킬이 없어야 함

# 3. TypeScript + 테스트 (코드 변경 없으므로 영향 없음)
npm run type-check
npm test
```

---

## 최종 구조

```
.claude/
├── commands/           # 22개 (사용자 호출)
│   ├── verify-app.md
│   ├── commit-push-pr.md
│   ├── check-health.md
│   ├── deploy-with-tests.md
│   ├── start-dev.md
│   ├── review.md       # code-review + review 통합
│   ├── draft-commits.md
│   ├── test-coverage.md
│   ├── simplify-code.md
│   ├── gemini-review.md
│   ├── gemini-scan.md
│   ├── run-workflow.md
│   ├── eval-dashboard.md
│   ├── run-eval.md
│   ├── config-backup.md
│   ├── save-and-compact.md
│   ├── session-wrap.md
│   ├── resume.md
│   ├── update-dev-docs.md
│   ├── sync-registry.md
│   └── dev-docs.md
├── rules/              # 7개 (상시 적용)
│   ├── typescript-strict.md
│   ├── path-aliases.md
│   ├── subscription-cleanup.md
│   ├── seoul-api-limits.md
│   ├── error-handling.md
│   ├── react-native-patterns.md
│   └── coverage-thresholds.md
├── skills/             # 21개 (on-demand)
│   ├── react-native-development/
│   ├── firebase-integration/
│   ├── test-automation/
│   ├── api-integration/
│   ├── subway-data-processor/
│   ├── location-services/
│   ├── notification-system/
│   ├── station-info/
│   ├── crowdsourced-congestion/
│   ├── route-fare-calculation/
│   ├── statistics-analytics/
│   ├── theme-i18n-system/
│   ├── audio-accessibility/
│   ├── user-trust-reputation/
│   ├── monitoring-observability/
│   ├── parallel-coordinator/
│   ├── verification-loop/
│   ├── cc-feature-implementer-main/
│   ├── external-memory/
│   ├── agent-observability/
│   └── ace-framework/
├── agents/             # 기존 유지
├── hooks/              # 기존 유지
└── settings.json       # 기존 유지
```

### Before vs After

| 구분 | Before | After |
|------|--------|-------|
| Commands | 0 | **22** |
| Rules (project) | 0 | **7** |
| Skills | 44 | **21** |
| 균형 점수 | 낮음 | **높음** |

---

## 주요 파일 목록

### 수정 대상
- `.claude/commands/*.md` (22개 신규)
- `.claude/rules/*.md` (7개 신규)
- `CLAUDE.md` (Skill Routing 테이블 업데이트)

### 삭제 대상
- `.claude/skills/verify-app/` (commands로 이동)
- `.claude/skills/commit-push-pr/` (commands로 이동)
- `.claude/skills/check-health/` (commands로 이동)
- ... (22개 command-type skill 디렉토리)
