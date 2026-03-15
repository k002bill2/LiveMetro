---
name: test-coverage
description: Run tests with coverage report and identify areas needing more tests
allowed-tools: Bash(npx jest*), Read, Grep, Glob
---

# Test Coverage Analysis

Run the complete test suite with coverage reporting, analyze the results, and provide actionable recommendations for improving test coverage.

## Steps

1. **Run Tests with Coverage**
   ```bash
   npm test -- --coverage
   ```

2. **Analyze Coverage Report**
   - Identify files with < 75% statement coverage
   - Identify files with < 70% function coverage
   - Identify files with < 60% branch coverage
   - List completely untested files

3. **Prioritize Coverage Gaps**
   - **High Priority**: Core services (dataManager, trainService, seoulSubwayApi)
   - **Medium Priority**: Custom hooks (useRealtimeTrains, useLocation, useNotifications)
   - **Low Priority**: UI components (already have some tests)

4. **Generate Test Recommendations**
   For each file with insufficient coverage:
   - List specific functions/branches missing tests
   - Suggest test scenarios (happy path, edge cases, errors)
   - Estimate number of tests needed

5. **Create Test Stubs** (Optional)
   Offer to create test file skeletons for completely untested files

## Output Format

```markdown
# Test Coverage Report

## Summary
- Overall Coverage: X%
- Statements: X% (target: 75%)
- Branches: X% (target: 60%)
- Functions: X% (target: 70%)
- Lines: X% (target: 75%)

## Files Below Coverage Threshold

### High Priority
1. **file.ts** (X% coverage)
   - Missing tests: description
   - Suggested tests: N new tests

### Medium Priority
...

### Low Priority
...

## Recommended Next Steps
1. Focus on core services
2. Add error scenario tests
3. Test subscription cleanup
```

## Follow-up Actions

After running this command:
1. **Offer to Create Tests**: "Should I create tests for the high-priority gaps?"
2. **Use test-automation Skill**: Automatically use the test-automation skill to generate tests
3. **Verify Coverage Improvement**: Re-run coverage after adding tests
