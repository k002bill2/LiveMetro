# Coverage Thresholds

## 강제 게이트 — SSOT는 `jest.config.js`

PR을 실제로 차단하는 커버리지 임계값은 **`jest.config.js`의 `coverageThreshold.global`이 단일 진실원천(SSOT)**이다. 이 문서에 숫자를 하드코딩하면 드리프트가 발생하므로(과거 이 문서의 "최소 75/70/60"이 실제 게이트와 불일치) 여기엔 적지 않는다.

```bash
npm test -- --coverage   # jest.config.js의 coverageThreshold 미달 시 실패 → PR 차단
```

현재 게이트는 낮은 안전망 수준이다. 아래 목표로 점진 상향(ratchet)하되, **상향 전 전체 `--coverage` 실측으로 통과를 확인한 뒤** `jest.config.js`에서 올린다 (이 문서가 아님).

## 목표 (target — 게이트 아님)

| 지표 | 1차 목표 | 최종 목표 |
|------|---------|----------|
| Statements | 75% | 85% |
| Functions | 70% | 80% |
| Branches | 60% | 70% |

- 새 파일 추가 시 테스트 파일도 함께 생성

## BANNED — 테스트 코드 (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `jest.fn()` 외부 → `jest.mock()` 내부 참조 | factory 내부에 inline 정의 | 호이스팅으로 undefined |
| `// ... similar tests` 생략 | 모든 케이스 명시적 작성 | LLM laziness 방지 |
| `// Add more tests as needed` | 필요한 테스트 전부 작성 | 불완전 출력 방지 |
| Happy path만 테스트 | Happy + Error + Edge 전부 | 실제 버그는 edge에서 발생 |
| `getByText()` (중복 텍스트) | `getByTestId()` | "Found multiple elements" |
| `expect(x).toBeTruthy()` 존재만 확인 | `toHaveTextContent`, `toBeVisible` | 의미 없는 assertion |
