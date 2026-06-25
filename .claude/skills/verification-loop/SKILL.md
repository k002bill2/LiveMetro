---
name: verification-loop
description: Boris Cherny style verification feedback loop automation. Run type check, lint, test, and build verification. Use after completing a feature/refactor/bugfix and BEFORE declaring completion or opening a PR — enforces fresh-run evidence. NOT for CI/hook 작성(update-config), 테스트 작성(test-automation), 빌드 에러 수정(build-error-resolver).
allowed-tools: Bash(npm run*), Bash(npx tsc*), Bash(npx jest*), Bash(npx eslint*), Bash(npx expo*)
---

# Verification Loop Skill

Boris Cherny가 강조하는 **검증 피드백 루프**를 자동화하는 스킬입니다.

## 핵심 원칙

> "검증 피드백 루프는 Claude Code 워크플로우에서 가장 중요한 요소입니다."
> — Boris Cherny

## 자동 검증 시점

### 필수 검증 (반드시 실행)
| 시점 | 커맨드 | 검증 항목 |
|------|--------|----------|
| 기능 구현 완료 | `/verify-app` | 타입, 린트, 테스트, 빌드 |
| PR 생성 전 | `/check-health` | 전체 상태 점검 |
| 리팩토링 후 | `/verify-app` | 변경 영향 확인 |

### 권장 검증 (상황별)
| 시점 | 커맨드 | 목적 |
|------|--------|------|
| 복잡한 코드 발견 | `/simplify-code` | 복잡도 분석 |
| 커버리지 확인 | `/test-coverage` | 테스트 충분성 |

## 검증 체크리스트

### Level 1: Quick Check (1분 이내)
```bash
npm run type-check
```
- 타입 에러 0개 확인
- 빠른 피드백 루프

### Level 2: Standard Check (2-3분)
```bash
npm run type-check
npm run lint
npm test
```
- 타입 + 린트 + 테스트
- 기능 구현 완료 시

### Level 3: Full Check (로컬, 5분 이내)
```bash
npm run type-check
npm run lint
npm test -- --coverage
npx expo-doctor      # Expo SDK 호환성 (로컬)
npx expo export      # 번들 export 검증 (로컬)
```
- 전체 검증 (로컬 피드백 루프)
- PR 생성 전 필수
- 실제 EAS 빌드(`npm run build:development` = `eas build`, EAS 클라우드 10-20분·인증/크레딧 필요)는 로컬 검증이 아니라 **CI/배포 파이프라인**에서 수행 (`.github/workflows/eas-build.yml`). 로컬 루프에서는 `expo-doctor`/`expo export`로 대체.

## 검증 기준

### TypeScript
| 기준 | 상태 |
|------|------|
| 타입 에러 0개 | 필수 |
| `any` 사용 금지 | 필수 |
| strict mode 활성화 | 필수 |

### ESLint
| 기준 | 상태 |
|------|------|
| 에러 0개 | 필수 |
| 경고 10개 미만 | 권장 |

### 테스트 커버리지
`jest.config.js`의 `coverageThreshold`가 강제 게이트의 SSOT다 (`npm test -- --coverage`로 강제, 미달 시 PR 차단). 숫자를 여기 하드코딩하면 드리프트가 발생하므로 적지 않는다. 목표·상향(ratchet) 정책은 [`.claude/rules/coverage-thresholds.md`](../../rules/coverage-thresholds.md) 참조.

### 빌드
| 기준 | 상태 |
|------|------|
| 빌드 성공 | 필수 |
| 번들 크기 경고 없음 | 권장 |

## 자동화 설정

### PostToolUse 훅 (선택사항)
```json
{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "npm run type-check 2>&1 | head -5",
    "timeout": 30
  }]
}
```

### quality-validator 에이전트
복잡한 작업 완료 후 백그라운드에서 자동 검증:
```
Task(subagent_type="quality-validator", run_in_background=true)
```

## 실패 시 대응

### 우선순위
1. **TypeScript 에러**: 즉시 수정 (블로커)
2. **테스트 실패**: 코드 또는 테스트 수정
3. **린트 에러**: `npm run lint -- --fix` 시도
4. **커버리지 미달**: 테스트 추가

### 수정 후 재검증
```bash
# 수정 후 반드시 재검증
npm run type-check && npm test
```

## 팀 협업 패턴

### 커밋 전 검증
```bash
# 모든 팀원이 커밋 전 실행
/verify-app
```

### PR 리뷰 기준
- [ ] TypeScript 에러 없음
- [ ] ESLint 에러 없음
- [ ] 모든 테스트 통과
- [ ] 커버리지 목표 충족
- [ ] 빌드 성공

## BANNED Patterns (검증 우회 금지)

| BANNED | WHY |
|--------|-----|
| "아마 될 거예요" / "자신 있어요" | 자신감은 증거가 아님 |
| 이전 실행 결과를 증거로 인용 | 아까 ≠ 지금. fresh 실행만 유효 |
| tsc만 통과 → "빌드도 되겠지" | 빌드는 별도 검증 필요 |
| 테스트 통과 → "요구사항 충족" | 항목별 체크리스트 검증 필요 |
| `--no-verify`로 훅 스킵 | 훅 실패 = 실제 문제 존재 |
| 같은 수정 3회 반복 | 2-Strike Rule: 2회 실패 시 근본 원인 분석 |

## Pre-Completion Checklist (완료 선언 전 필수)

코드 변경 완료를 선언하기 전 다음을 **모두** 실행하고 결과를 확인:

```
□ 1. npx tsc --noEmit          → 에러 0개
□ 2. npm run lint               → 에러 0개
□ 3. npm test -- --coverage     → 전체 통과 + 커버리지 충족
□ 4. 변경 파일 목록 확인        → 요청 범위만 변경했는가?
□ 5. git diff 확인              → 의도하지 않은 변경 없는가?
```

### Token Overflow Protocol (대량 수정 시)

수정 파일이 5개 이상이거나 컨텍스트 한계 접근 시:
1. 완성된 파일 단위로 중단
2. 명시적 상태 보고: `[검증 중단 — X/Y 파일 수정 완료. 나머지 진행하려면 "continue"]`
3. 절대 미완성 상태에서 "완료" 선언 금지

## 관련 리소스

- [quality-validator 에이전트](../../agents/quality-validator.md)
- [/verify-app 커맨드](../../commands/verify-app.md)
- [/check-health 커맨드](../../commands/check-health.md)
