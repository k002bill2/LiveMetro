---
name: review
description: 코드 리뷰 자동화 - 변경된 파일 분석, 보안/성능/타입 안전성 체크리스트 포함
allowed-tools: Read, Grep, Glob, Bash(git diff*), Bash(git log*)
---

# Code Review

Git diff 기반 체계적 코드 리뷰. 보안, 성능, 타입 안전성, LiveMetro 프로젝트 규칙 준수 여부를 검증합니다.

## Checklists

리뷰 시 다음 체크리스트를 참조하세요:
- `.claude/checklists/code-review.md` - TypeScript, 에러 처리, 성능, 접근성
- `.claude/checklists/rn-specific.md` - React Native 전용 (useEffect, 네비게이션, 리스트 최적화)

## 실행 단계

### 1. 변경사항 수집

```bash
# Staged + unstaged changes
git diff --cached --name-only
git diff --name-only

# Or compare with main branch
git diff main...HEAD --name-only
```

### 2. 파일 분류

Group changed files by type:
- **Components** (`src/components/**/*.tsx`)
- **Screens** (`src/screens/**/*.tsx`)
- **Services** (`src/services/**/*.ts`)
- **Hooks** (`src/hooks/**/*.ts`)
- **Utils** (`src/utils/**/*.ts`)
- **Tests** (`**/__tests__/**`)
- **Config** (`.claude/**`, `*.config.*`)

### 3. Review Checklist

#### TypeScript Strict Compliance
- [ ] `any` 타입 사용 없음
- [ ] 명시적 반환 타입 선언
- [ ] `unknown` 또는 구체적 타입 사용
- [ ] path alias (`@/`, `@components/` 등) 사용 (상대 경로 금지)

#### Security
- [ ] API 키/시크릿 하드코딩 없음
- [ ] 환경 변수 또는 설정 파일로 관리
- [ ] 사용자 입력 검증/새니타이징
- [ ] Firebase Security Rules 고려

#### Performance
- [ ] `React.memo` 적절히 사용
- [ ] `useMemo`/`useCallback` 비용이 큰 연산에만 적용
- [ ] `StyleSheet.create` 사용 (인라인 스타일 금지)
- [ ] Seoul API 폴링 간격 30초 이상
- [ ] 불필요한 리렌더링 없음

#### Error Handling
- [ ] try/catch로 비동기 에러 처리
- [ ] 에러 시 빈 배열/null 반환 (throw 지양)
- [ ] ErrorBoundary 활용 (UI 컴포넌트)
- [ ] 사용자 친화적 에러 메시지

#### Subscription Cleanup
- [ ] `useEffect` cleanup 함수 존재
- [ ] Firebase `onSnapshot` 구독 해제
- [ ] 타이머(`setInterval`/`setTimeout`) 정리
- [ ] 이벤트 리스너 제거

#### Accessibility
- [ ] `accessibilityLabel` 속성 존재
- [ ] 터치 영역 44x44pt 이상
- [ ] 스크린 리더 호환

#### Code Quality
- [ ] `console.log` 제거 (디버깅 코드)
- [ ] 중복 코드 없음
- [ ] 함수/변수 명명 일관성
- [ ] 복잡한 로직에 주석 추가
- [ ] 단일 책임 원칙 준수

### 4. Cross-File Analysis

- Type consistency between services and components
- Import cycle detection
- Shared state management coherence

### 5. 리뷰 점수 계산

| Category | Weight | Max Score |
|----------|--------|-----------|
| TypeScript Strict | 20% | 20 |
| Security | 20% | 20 |
| Performance | 15% | 15 |
| Error Handling | 15% | 15 |
| Subscription Cleanup | 10% | 10 |
| Accessibility | 10% | 10 |
| Code Quality | 10% | 10 |
| **Total** | **100%** | **100** |

### Grade Scale

| Score | Grade | Action |
|-------|-------|--------|
| 90-100 | A | Approve |
| 75-89 | B | Approve with suggestions |
| 60-74 | C | Request changes (minor) |
| < 60 | D | Request changes (major) |

## 출력 형식

```
CODE REVIEW REPORT

Overall Score: {score}/100 (Grade: {grade})
Files Reviewed: {count}

| Category            | Score  | Status |
|---------------------|--------|--------|
| TypeScript Strict   | {n}/20 | {icon} |
| Security            | {n}/20 | {icon} |
| Performance         | {n}/15 | {icon} |
| Error Handling      | {n}/15 | {icon} |
| Subscription Cleanup| {n}/10 | {icon} |
| Accessibility       | {n}/10 | {icon} |
| Code Quality        | {n}/10 | {icon} |

Critical Issues ({count}):
- {file}:{line} - {description}

Suggestions ({count}):
- {file}:{line} - {description}

Good Practices:
- {description}
```

## Auto-Fix Commands

```bash
npm run lint -- --fix
npm run type-check
npm test -- --findRelatedTests {changed_files}
```

## Integration

- **Gemini Cross-Review**: `geminiAutoTrigger.js`가 변경 시 자동 큐잉
- **Quality Validator**: `quality-validator` 에이전트가 최종 검증
