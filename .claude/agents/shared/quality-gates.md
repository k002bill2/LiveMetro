---
name: quality-gates
description: Shared quality gates for all specialist agents
---

# Quality Gates

All agents MUST pass these quality gates before marking work as complete.

## Automated Checks

```bash
# Run all quality checks
npm run type-check   # TypeScript strict mode
npm run lint         # ESLint zero errors
npm test -- --coverage  # Test coverage
```

## Quality Gate Requirements

### 1. TypeScript Strict Mode
- [ ] `npm run type-check` passes with zero errors
- [ ] No `any` types (use `unknown` if type is truly unknown)
- [ ] Explicit return types on exported functions
- [ ] Proper null/undefined handling with guards

### 2. ESLint Compliance
- [ ] `npm run lint` passes with zero errors
- [ ] No disabled ESLint rules without justification comment
- [ ] Consistent code style

### 3. Test Coverage Thresholds
| Metric | Minimum |
|--------|---------|
| Statements | 75% |
| Functions | 70% |
| Branches | 60% |
| Lines | 75% |

### 4. Security
- [ ] No hardcoded API keys or secrets
- [ ] No hardcoded Firebase credentials
- [ ] Sensitive data uses environment variables
- [ ] No console.log with sensitive information

### 5. React Native Specific
- [ ] `memo()` on expensive components
- [ ] `useCallback`/`useMemo` for stable references
- [ ] Accessibility labels on interactive elements
- [ ] Proper cleanup in useEffect return functions

### 6. Subscription Cleanup
```typescript
// REQUIRED pattern for all subscriptions
useEffect(() => {
  const unsubscribe = service.subscribe(callback);
  return () => unsubscribe(); // Cleanup!
}, []);
```

## Validation Commands

```bash
# Quick validation
npm run lint && npm run type-check

# Full validation (before PR)
npm run lint && npm run type-check && npm test -- --coverage
```

## Agent-Specific Gates

| Agent | Additional Requirements |
|-------|------------------------|
| mobile-ui-specialist | Accessibility labels, responsive design |
| backend-integration-specialist | API rate limits respected, cleanup functions |
| performance-optimizer | Metrics before/after, no memory leaks |
| test-automation-specialist | Coverage meets thresholds, no flaky tests |
| quality-validator | All gates verified, integration checked |

---

**Version**: 1.0 | **Last Updated**: 2025-01-05
