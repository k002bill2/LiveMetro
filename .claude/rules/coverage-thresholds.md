# Coverage Thresholds

테스트 커버리지 최소 기준:

| 지표 | 최소 | 목표 |
|------|------|------|
| Statements | 75% | 85% |
| Functions | 70% | 80% |
| Branches | 60% | 70% |

- 새 파일 추가 시 테스트 파일도 함께 생성
- 커버리지 미달 시 PR 차단
- `npm test -- --coverage` 로 확인

## BANNED — 테스트 코드 (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `jest.fn()` 외부 → `jest.mock()` 내부 참조 | factory 내부에 inline 정의 | 호이스팅으로 undefined |
| `// ... similar tests` 생략 | 모든 케이스 명시적 작성 | LLM laziness 방지 |
| `// Add more tests as needed` | 필요한 테스트 전부 작성 | 불완전 출력 방지 |
| Happy path만 테스트 | Happy + Error + Edge 전부 | 실제 버그는 edge에서 발생 |
| `getByText()` (중복 텍스트) | `getByTestId()` | "Found multiple elements" |
| `expect(x).toBeTruthy()` 존재만 확인 | `toHaveTextContent`, `toBeVisible` | 의미 없는 assertion |
