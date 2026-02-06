---
description: 테스트 검증 후 EAS 빌드/배포 실행
---

# Deploy with Tests

테스트와 타입 체크를 통과한 후에만 EAS 빌드를 실행합니다.

## 실행 단계

### 0. Pre-validation (환경 점검)

배포 전 환경 상태를 먼저 확인합니다. 하나라도 실패하면 중단합니다.

```bash
# Git 상태 확인 - 커밋되지 않은 변경사항 확인
git status --porcelain

# 의존성 일관성 확인
npm ls --depth=0 2>&1 | grep -c "UNMET\|ERR\|missing"

# app.json 버전 확인
node -e "const a=require('./app.json');console.log('Version:', a.expo.version, 'Build:', a.expo.ios?.buildNumber || a.expo.android?.versionCode)"
```

**블로커 조건:**
- 커밋되지 않은 변경사항이 있으면 커밋 또는 stash 먼저
- UNMET dependency가 있으면 `npm install` 먼저
- app.json 버전이 이전 빌드와 동일하면 버전 업 안내

### 1. 사전 검증

순서대로 실행하고 모두 통과해야 다음 단계로 진행:

```bash
# 1. TypeScript 타입 체크
npm run type-check

# 2. ESLint 검사
npm run lint

# 3. Jest 테스트 (커버리지 포함)
npm test -- --coverage --passWithNoTests
```

### 2. 커버리지 확인

커버리지 임계값 확인:
- Statements: 75% 이상
- Functions: 70% 이상
- Branches: 60% 이상

**임계값 미달 시 배포 중단**

### 3. 빌드 프로파일 선택

사용자에게 빌드 프로파일 확인:
- `development`: 개발용 빌드
- `preview`: 테스트용 빌드 (TestFlight/Internal Testing)
- `production`: 프로덕션 빌드

### 4. EAS 빌드 실행

```bash
# Preview 빌드 예시
eas build --profile preview --platform all

# Production 빌드 예시 (주의 필요)
eas build --profile production --platform all
```

### 5. 빌드 상태 모니터링

빌드 URL 제공 및 상태 확인 방법 안내.

## 출력 형식

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOY WITH TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[0/5] Pre-validation
  Git: clean
  Dependencies: OK
  Version: 1.2.0 (build 15)

[1/5] Type Check
  No type errors

[2/5] Lint Check
  No lint errors

[3/5] Test & Coverage
  Tests passed (2071 tests)
  Statements: 78.5% (>= 75%)
  Functions: 72.1% (>= 70%)
  Branches: 65.3% (>= 60%)

[4/5] Build Profile
  Profile: preview

[5/5] EAS Build
  Building with profile: preview
  Build URL: https://expo.dev/accounts/.../builds/...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 실패 시

```
DEPLOY BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step Failed: {단계}
Reason: {이유}
Suggestion: {수정 방법}

Fix and retry with: /deploy-with-tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 재시도 규칙

동일 단계에서 2회 연속 실패 시:
1. 근본 원인 분석 후 사용자에게 보고
2. 자동 재시도하지 않고 사용자 판단 대기
3. 수정 내용과 이유를 명확히 설명
