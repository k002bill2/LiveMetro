# TypeScript Strict

ESLint(expo 프리셋)는 아래를 강제하지 않는다 — 이 규칙이 유일한 게이트다:

- `any` 사용 금지 → `unknown` 또는 구체적 타입
- exported 함수에 명시적 반환 타입 선언
- type assertion (`as`) 최소화 → type guard 사용
- tsconfig strict mode 완화 금지
