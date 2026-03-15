# TypeScript Strict

- `any` 타입 사용 금지 → `unknown` 또는 구체적 타입 사용
- 모든 exported 함수에 명시적 반환 타입 선언
- strict mode 활성화 상태 유지 (tsconfig.json)
- 제네릭 타입으로 재사용성 확보
- type assertion (`as`) 최소화 → type guard 사용
