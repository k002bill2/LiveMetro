---
name: test-automation
description: Generate comprehensive Jest tests for LiveMetro React Native components, hooks, and services. Use when writing tests, improving coverage, or test-driven development.
---

# Test Automation (LiveMetro)

Jest + React Native Testing Library 기반 단위·통합 테스트 작성 가이드.

## When to Use
- 새 컴포넌트/훅/서비스 테스트 작성
- 커버리지 개선 (목표: stmt 75% / fn 70% / branch 60%)
- TDD 워크플로우
- 실패 테스트 디버깅 / 픽스처 생성

## Standards

| 항목 | 값 |
|------|-----|
| Statements 최소 | 75% |
| Functions 최소 | 70% |
| Branches 최소 | 60% |
| Test 위치 | source 옆 `__tests__/` |
| 파일명 | `*.test.ts` / `*.test.tsx` |
| 서브타이틀 | `describe(componentName)` |

체크리스트: `.claude/checklists/testing.md`

## 작업 흐름

1. **Analyze**: 대상 코드의 props, 외부 의존성(Firebase, Seoul API, AsyncStorage), 분기 식별.
2. **Scenarios**: Happy / Edge(null·undefined·loading) / Error(API fail·timeout) 3종 의무.
3. **Skeleton 작성**:
   ```typescript
   import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
   import { ComponentName } from '../ComponentName';

   jest.mock('@/services/trainService', () => ({
     getRealtimeArrivals: jest.fn(),
   }));

   describe('ComponentName', () => {
     beforeEach(() => jest.clearAllMocks());
     // tests...
   });
   ```
4. **Mock dependencies**: Firebase/AsyncStorage/Navigation/Seoul API 패턴 → [references/mocking-patterns.md](references/mocking-patterns.md)
5. **Write tests**: Component / Hook / Service 템플릿 → [references/test-examples.md](references/test-examples.md)
6. **Verify**: `npm test -- --coverage` 통과 + 임계값 충족.

## Known Pitfalls (MEMORY 기반)

| 증상 | 원인 / 해결 |
|------|------------|
| "Found multiple elements with text" | `getByText` 대신 `getByTestId` |
| "Can't access .root on unmounted test renderer" | `useAuth` mock이 전체 `AuthContextType` 반환해야 함 |
| testID 미작동 | 컴포넌트 소스에서 실제 testID 확인 |
| `isAutoLoggingIn` 로딩 잔존 | `await waitFor(() => getByTestId('email-input'))` |
| Pill atom mock에 children만 반환 | `<Text>` 로 wrap 필수 |
| Atom barrel cascade 폭발 | direct path import 사용 |

## BANNED Patterns

### Mock
| BANNED | USE INSTEAD |
|--------|-------------|
| `jest.fn()` 외부 → `jest.mock` 내부 참조 | factory 내부 inline 정의 |
| `as any` mock 타입 우회 | `as jest.Mock` |
| `getByText` (중복 텍스트) | `getByTestId` |
| `expect(x).toBeTruthy()` 존재만 확인 | `toHaveTextContent` / `toBeVisible` |
| unmocked `fetch` 실제 호출 | `jest.mock` 또는 MSW |
| `act()` 없는 상태 업데이트 | `await act(async () => {...})` |

### Structure
| BANNED | USE INSTEAD |
|--------|-------------|
| 한 `it`에 5+ assertion | 시나리오별 분리 |
| `beforeAll` mutable 공유 | `beforeEach` 초기화 |
| 내부 state 직접 검사 | 사용자 행동 기반 |
| snapshot만 작성 | snapshot + 행동 테스트 |
| timer mock cleanup 누락 | `afterEach`에 `useRealTimers` |

### LLM Laziness 방지
| BANNED | REQUIRED |
|--------|----------|
| `// ... similar tests` 생략 | 모든 케이스 명시 작성 |
| `// Add more tests as needed` | 필요한 테스트 전부 작성 |
| Happy path만 | Happy + Error + Edge 의무 |

## Pre-Output Checklist

- [ ] 외부 의존성 전부 mock 처리
- [ ] `beforeEach`에서 `jest.clearAllMocks()`
- [ ] Error 케이스 1개 이상
- [ ] Edge 케이스 (null, undefined, 빈 배열)
- [ ] 비동기에 `waitFor` 또는 `act` 사용
- [ ] Firebase/타이머 cleanup 테스트
- [ ] mock 변수가 factory 내부 inline

## Running

```bash
npm test                                            # 전체
npm test -- --watch                                 # watch
npm test -- --coverage                              # 커버리지 리포트
npm test -- src/components/__tests__/StationCard    # 특정 파일
npm test -- -t "renders correctly"                  # 특정 케이스
```

## Resources

- [RNTL 공식 문서](https://callstack.github.io/react-native-testing-library/)
- [Jest 공식 문서](https://jestjs.io/docs/getting-started)
- [Testing Hooks](https://callstack.github.io/react-native-testing-library/docs/api#renderhook)
