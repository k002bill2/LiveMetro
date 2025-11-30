---
description: Comprehensive Code Review Workflow
---

# Code Review Workflow

Perform thorough code reviews focusing on quality, security, and maintainability.

## Review Checklist

### 1. Code Quality
- [ ] **Naming**: Clear and descriptive variable/function names?
- [ ] **SRP**: Functions are single-purpose and small?
- [ ] **DRY**: No code duplication?
- [ ] **Style**: Consistent coding style (Prettier/ESLint)?
- [ ] **Abstraction**: Proper abstraction levels?

### 2. Security
- [ ] **Validation**: Input validation present?
- [ ] **Injection**: No SQL/NoSQL injection vulnerabilities?
- [ ] **Auth**: Proper authentication/authorization checks?
- [ ] **Secrets**: No hardcoded secrets or keys?
- [ ] **Data**: Sensitive data encrypted or masked?

### 3. Performance
- [ ] **Complexity**: Efficient algorithms (avoid O(n^2) in hot paths)?
- [ ] **Database**: Queries optimized (indexes used)?
- [ ] **Caching**: Implemented where appropriate?
- [ ] **Memory**: No obvious memory leaks?
- [ ] **Async**: Promises/Async-Await handled properly (no unawaited promises)?

### 4. Testing
- [ ] **Unit Tests**: Present and passing? (>80% coverage target)
- [ ] **Edge Cases**: Null/undefined/empty states handled?
- [ ] **Integration**: API endpoints tested?
- [ ] **Mocks**: External services mocked appropriately?

### 5. Documentation
- [ ] **JSDoc**: Public methods documented?
- [ ] **README**: Updated if architecture changed?
- [ ] **Comments**: Complex logic explained (why, not just what)?

## Execution

1.  **Read Diff**: `git diff` or view the changed files.
2.  **Analyze**: Go through the checklist above.
3.  **Report**: List issues categorized by 'Critical', 'Warning', and 'Suggestion'.
4.  **Fix**: Apply fixes for Critical and Warning items.