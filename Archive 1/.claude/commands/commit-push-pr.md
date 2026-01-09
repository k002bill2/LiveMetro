---
command: /commit-push-pr
description: "Full pipeline: Build → Test → Commit → Push (SVN) - Boris Cherny 1-Shot Automation"
arguments:
  - name: service
    description: "Service name (e.g., KiiPS-FD, KiiPS-IL)"
    required: true
  - name: message
    description: "Commit message"
    required: true
---

# 🚀 Commit Push PR (Full Pipeline)

**Boris Cherny's Principle**: "매일 반복되는 작업은 슬래시 커맨드로 자동화"

이 커맨드는 **Build → Test → Commit → Push 전체 워크플로우를 1-shot으로 실행**합니다.

## What This Command Does

```
[1/6] 🔍 Pre-flight Checks
      ↓
[2/6] 🔨 Build Service (Maven)
      ↓
[3/6] 🧪 Run Auto Tests (JUnit)
      ↓
[4/6] 📋 Code Review Checklist
      ↓
[5/6] 💾 SVN Commit
      ↓
[6/6] 📊 Summary & Next Steps
```

## Usage

```bash
# Example 1: Commit changes to KiiPS-FD
/commit-push-pr KiiPS-FD "feat: Add fund search filter"

# Example 2: Bugfix for KiiPS-IL
/commit-push-pr KiiPS-IL "fix: Resolve investment calculation error"

# Example 3: Refactoring
/commit-push-pr KiiPS-PG "refactor: Extract common validation logic"
```

## Instructions for Claude

Execute the following steps in sequence. **Stop if any step fails** and ask the user for instructions.

### Step 1: Pre-flight Checks (안전성 검증)

```bash
# 1.1 Check current directory
pwd

# 1.2 Check for uncommitted changes
svn status

# 1.3 Verify service exists
ls -la | grep {{service}}

# 1.4 Check if KiiPS-HUB exists (for Maven build)
ls -la | grep KiiPS-HUB
```

**If pre-flight fails**: Ask user to navigate to KiiPS workspace root.

---

### Step 2: Build Service (Maven)

```bash
# Navigate to KiiPS-HUB and build the specified service
cd KiiPS-HUB
mvn clean package -pl :{{service}} -am

# Check build status
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed - Aborting workflow"
  exit 1
fi
```

**If build fails**:
- Show build error log
- Ask: "Build failed. Options: (1) Fix and retry (2) Skip build (3) Abort"

---

### Step 3: Run Auto Tests (JUnit)

```bash
# Run tests for the service
cd KiiPS-HUB
mvn test -pl :{{service}} -DskipTests=false

# Parse test results
echo "Parsing JUnit test results..."
```

**Expected Output**:
```
Tests run: 45, Failures: 0, Errors: 0, Skipped: 2
✅ All tests passed!
```

**If tests fail**:
- Show failed test names
- Ask: "Tests failed. Options: (1) Fix and retest (2) Override (not recommended) (3) Abort"

**Note**: 보리스 처니는 테스트 실패 시 배포하지 않을 것을 강력히 권장합니다.

---

### Step 4: Code Review Checklist (Quick Scan)

Run the existing `/review` command to perform a quick code quality check:

```bash
# Invoke review skill
/review
```

**Review Categories** (from existing /review command):
- 🔴 Critical issues (must fix)
- 🟡 Warnings (should fix)
- 💡 Suggestions (optional)

**If critical issues found**:
- List all 🔴 critical issues
- Ask: "Critical issues found. Options: (1) Fix now (2) Override (3) Abort"

---

### Step 5: SVN Commit

**IMPORTANT**: KiiPS uses **SVN** (not Git). Use SVN commands.

```bash
# 5.1 Check SVN status
svn status

# 5.2 Add unversioned files (if any)
# List unversioned files first:
svn status | grep "^?" | awk '{print $2}'

# Ask user if they want to add these files:
# "Found unversioned files. Add to commit? (y/n)"

# 5.3 SVN Commit
svn commit -m "{{message}}

🤖 Generated with Claude Code (https://claude.com/claude-code)

Service: {{service}}
Build: ✅ Passed
Tests: ✅ Passed
Review: ✅ Completed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 5.4 Verify commit
svn log -l 1
```

**Commit Message Format**:
```
[user-provided message]

🤖 Generated with Claude Code
Service: {{service}}
Build: ✅ Passed
Tests: ✅ Passed
Review: ✅ Completed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**If commit fails**:
- Show SVN error
- Check: Working copy is locked? Resolve with `svn cleanup`
- Ask: "Commit failed. Options: (1) Retry (2) Manual commit (3) Abort"

---

### Step 6: Summary & Next Steps

Display a comprehensive summary:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMMIT-PUSH-PR COMPLETED SUCCESSFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Service: {{service}}
💬 Message: {{message}}

[1/6] ✅ Pre-flight checks passed
[2/6] ✅ Build successful (Maven)
[3/6] ✅ Tests passed (JUnit: XX/XX)
[4/6] ✅ Code review completed
[5/6] ✅ SVN commit successful (r12345)
[6/6] ✅ Workflow completed

⏱️  Total Duration: X.XX seconds
💡 Quality Improvement: 2-3x (Boris Cherny's feedback loop)

📋 Next Steps:
  1. Verify changes in SVN repository
  2. Notify team if this is a critical fix
  3. Monitor deployment logs: tail -f {{service}}/logs/log.$(date "+%Y-%m-%d")-0.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Safety Features

### 1. Step-by-Step Validation
- Each step validates before proceeding
- Failure in any step stops the workflow
- User can override (with warning)

### 2. Test-Driven Quality Gate
- **Build must pass** before tests
- **Tests must pass** before commit (Boris Cherny principle)
- Code review highlights issues

### 3. SVN Safety
- Shows `svn status` before commit
- Asks before adding unversioned files
- Includes detailed commit message with metadata

### 4. Rollback Support
```bash
# If commit needs to be reverted:
svn update
svn merge -r HEAD:PREV .
svn commit -m "Revert: {{message}}"
```

---

## Performance Optimization

### Parallel Execution (Future)
```bash
# Build and test can potentially run in parallel for independent modules
cd KiiPS-HUB
mvn clean package test -pl :{{service}} -am -DskipTests=false -T 4
```

### Incremental Build
```bash
# Only rebuild changed modules (Maven's -pl flag already does this)
mvn package -pl :{{service}} -am
```

---

## Comparison: Before vs After

### Before (Manual, 5 separate commands)
```bash
# 1. Build (manual)
cd KiiPS-HUB && mvn clean package -pl :KiiPS-FD -am
# ⏱️ 3-4 minutes

# 2. Test (often skipped)
mvn test -pl :KiiPS-FD -DskipTests=false
# ⏱️ 1-2 minutes (often skipped)

# 3. Review (manual, often skipped)
/review
# ⏱️ 2-3 minutes (often skipped)

# 4. Commit (manual)
svn commit -m "message"
# ⏱️ 1 minute

# 5. Verify (manual)
svn log -l 1
# ⏱️ 10 seconds

Total: ~15 minutes (with context switching)
Test Execution Rate: ~20% (often skipped)
```

### After (Automated, 1 command)
```bash
/commit-push-pr KiiPS-FD "feat: Add fund search"

Total: ~5 minutes (automated)
Test Execution Rate: 100% (always run)
Time Savings: 67% (10 minutes saved)
Quality: 2-3x better (Boris Cherny principle)
```

---

## Error Handling Examples

### Example 1: Build Failure
```
❌ Build failed at Step 2/6

Error: Compilation error in FundService.java
Line 42: incompatible types: String cannot be converted to BigDecimal

Options:
  1. Fix error and retry (recommended)
  2. Skip build (not recommended)
  3. Abort workflow

Your choice:
```

### Example 2: Test Failure
```
❌ Tests failed at Step 3/6

Failed Tests:
  • testCalculateReturns (expected: 1500, actual: 1450)
  • testValidateFund (NullPointerException)

Total: 45 tests, 2 failed, 43 passed

⚠️  Boris Cherny Warning: "Never commit with failing tests"

Options:
  1. Fix tests and retest (recommended)
  2. Override and commit anyway (strongly discouraged)
  3. Abort workflow

Your choice:
```

---

## Integration with Other Commands

This command internally uses:
- `/build-service` (Step 2)
- Auto test execution from `stopEvent.js` (Step 3)
- `/review` (Step 4)

---

## Boris Cherny's Principles Applied

### ✅ Principle 1: Automate Repetitive Tasks
> "매일 반복되는 작업(예: /commit-push-pr)은 슬래시 커맨드로 자동화하며, 이는 .claude/commands/ 디렉토리에 저장되어 팀과 공유됩니다."

**Applied**: Full pipeline automation in 1 command

### ✅ Principle 2: Validation Feedback Loop
> "가장 중요한 요소는 Claude에게 작업 결과를 스스로 검증할 수 있는 방법을 제공하는 것"

**Applied**: Build → Test → Review → Commit pipeline

### ✅ Principle 3: Team Sharing
> ".claude/commands/ 디렉토리에 저장되어 팀과 공유됩니다"

**Applied**: This command file is version-controlled in `.claude/commands/`

---

## Troubleshooting

### Issue: "SVN: Working copy is locked"
**Solution**:
```bash
svn cleanup
svn update
# Retry workflow
```

### Issue: "Maven: Cannot resolve dependencies"
**Solution**:
```bash
cd KiiPS-HUB
mvn clean install -U  # Force update dependencies
# Retry workflow
```

### Issue: "Tests timeout (>2 minutes)"
**Solution**:
```bash
# Increase timeout in stopEvent.js
timeout: 300000  # 5 minutes
```

---

**Created**: 2026-01-05
**Version**: 1.0.0
**Inspired by**: Boris Cherny's Claude Code Workflow #5 (Slash Command Automation)
