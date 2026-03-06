---
name: quality-reference
description: Shared quality gates for all specialist agents
---

# Quality Reference

All agents MUST pass these quality gates before marking work as complete.

## Automated Checks

```bash
# Quick validation
npm run lint && npm run type-check

# Full validation (before PR)
npm run lint && npm run type-check && npm test -- --coverage
```

## Quality Gate Requirements

### 1. TypeScript Strict Mode
- `npm run type-check` passes with zero errors
- No `any` types (use `unknown` if type is truly unknown)
- Explicit return types on exported functions
- Proper null/undefined handling with guards

### 2. ESLint Compliance
- `npm run lint` passes with zero errors
- No disabled ESLint rules without justification comment

### 3. Test Coverage Thresholds
| Metric | Minimum |
|--------|---------|
| Statements | 75% |
| Functions | 70% |
| Branches | 60% |
| Lines | 75% |

### 4. Security
- No hardcoded API keys or secrets
- Sensitive data uses environment variables
- No console.log with sensitive information

### 5. React Native Specific
- `StyleSheet.create()` for styles (no inline objects)
- `useCallback`/`useMemo` for stable references
- Path aliases (`@components`, `@services`, etc.)
- Proper cleanup in useEffect return functions
- 30s minimum polling interval for Seoul API

### 6. Firebase Specific
- All onSnapshot subscriptions have cleanup
- Error handling returns empty arrays/null (no throws)
- Auth state properly managed via AuthContext

## Agent-Specific Gates

| Agent | Additional Requirements |
|-------|------------------------|
| mobile-ui-specialist | Accessibility labels, responsive layout, iOS+Android |
| test-automation-specialist | Coverage meets thresholds, no flaky tests |
| quality-validator | All gates verified, integration checked |
