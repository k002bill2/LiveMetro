---
name: check-health
description: Comprehensive project health check including tests, types, linting, and build verification
allowed-tools: Bash(npm *), Bash(npx *)
---

# Project Health Check

Perform a comprehensive health check of the project, running all quality gates and reporting any issues with actionable fixes.

## Steps

### 1. TypeScript Type Check
```bash
npm run type-check
```
- Catches type mismatches, missing definitions, strict mode violations
- Fix: Add property to interface, use optional chaining, check path aliases

### 2. ESLint Check
```bash
npm run lint
```
- Enforces code style, unused variables, missing useEffect deps
- Fix: Add dependencies, remove unused vars, use const

### 3. Test Suite
```bash
npm test
```
- All unit tests pass, coverage thresholds met
- Fix: Update expectations, add more tests for coverage

### 4. Build Verification
```bash
npm run build:development
```
- App bundles correctly, no build-time errors
- Fix: Check imports, dependencies, cache

### 5. Dependency Audit
```bash
npm audit
```
- Security vulnerabilities in dependencies
- Fix: `npm audit fix`

### 6. Project Structure Validation
- Required files exist (CLAUDE.md, etc.)
- Git status is clean (no uncommitted sensitive files)

## Output Format

```markdown
# Project Health Check
*Run at: YYYY-MM-DD HH:MM:SS*

## Passed Checks (N/6)
1. **TypeScript**: No type errors
2. **ESLint**: No linting issues
3. **Tests**: All N tests passed
4. **Build**: Development build successful

## Failed Checks (N/6)
5. **Test Coverage**: Below threshold
   - Current: X% statements (target: 75%)
   - Recommendation: Run `/test-coverage` command

6. **Dependencies**: N vulnerabilities
   - Recommendation: Run `npm audit fix`

## Summary
**Overall Health**: Excellent/Good/Fair/Poor
**Action Items**: (numbered list)
```

## Health Score Calculation

```
Health Score = (Passed Checks / Total Checks) x 100

- 100%: Excellent - Production ready
- 80-99%: Good - Minor issues
- 60-79%: Fair - Several issues need attention
- <60%: Poor - Critical issues, do not deploy
```
