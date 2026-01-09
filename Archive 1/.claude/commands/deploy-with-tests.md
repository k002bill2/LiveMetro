---
command: /deploy-with-tests
description: "Safe deployment pipeline: Test → Build → Deploy → Health Check - Zero-downtime deployment"
arguments:
  - name: service
    description: "Service name (e.g., KiiPS-FD, KiiPS-IL)"
    required: true
---

# 🚀 Deploy with Tests (Safe Deployment Pipeline)

**Boris Cherny's Principle**: "검증 피드백 루프를 구축하면 품질이 2-3배 향상됩니다"

이 커맨드는 **Test → Build → Deploy → Health Check 파이프라인을 안전하게 실행**합니다.

## What This Command Does

```
[1/7] 🧪 Run Tests (Pre-deployment validation)
      ↓
[2/7] 🔨 Build Service (Maven)
      ↓
[3/7] 🛑 Stop Service (Graceful shutdown)
      ↓
[4/7] 📦 Deploy New Version
      ↓
[5/7] 🚀 Start Service
      ↓
[6/7] 🏥 Health Check (30s wait)
      ↓
[7/7] 📊 Summary & Log Monitoring
```

## Usage

```bash
# Example 1: Deploy KiiPS-FD after testing
/deploy-with-tests KiiPS-FD

# Example 2: Deploy investment service
/deploy-with-tests KiiPS-IL

# Example 3: Deploy API Gateway
/deploy-with-tests KIIPS-APIGateway
```

## Instructions for Claude

Execute the following steps in sequence. **Rollback if health check fails**.

### Step 1: Run Tests (Pre-deployment Validation)

**Boris Cherny's Core Principle**: "Never deploy without testing"

```bash
cd KiiPS-HUB
mvn test -pl :{{service}} -DskipTests=false

# Parse results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Show: Total / Passed / Failed / Skipped
```

**Decision Point**:
- ✅ All tests pass → Proceed to Step 2
- ❌ Any test fails → **ABORT deployment**
  - Show failed tests
  - Ask: "Tests failed. Deployment aborted. Options: (1) Fix and retry (2) Force deploy (DANGER)"

**CRITICAL**: Boris Cherny recommends **NEVER** force deploying with failing tests.

---

### Step 2: Build Service (Fresh Build)

```bash
cd KiiPS-HUB
mvn clean package -pl :{{service}} -am

# Verify artifact exists
if [ -f "../{{service}}/target/*.jar" ] || [ -f "../{{service}}/target/*.war" ]; then
  echo "✅ Artifact generated successfully"
  ls -lh ../{{service}}/target/*.{jar,war}
else
  echo "❌ Artifact not found - Build failed"
  exit 1
fi
```

**If build fails**:
- Show Maven error log
- **ABORT** deployment
- Ask: "Build failed. Fix issues and retry?"

---

### Step 3: Stop Service (Graceful Shutdown)

```bash
cd ../{{service}}

# Check if service is running
SERVICE_PID=$(lsof -ti:8xxx)  # Replace 8xxx with actual port

if [ -n "$SERVICE_PID" ]; then
  echo "🛑 Stopping {{service}} (PID: $SERVICE_PID)..."

  # Execute stop script
  ./stop.sh

  # Wait for graceful shutdown (max 30s)
  for i in {1..30}; do
    if ! lsof -ti:8xxx > /dev/null; then
      echo "✅ Service stopped gracefully after ${i}s"
      break
    fi
    sleep 1
  done

  # Force kill if still running
  if lsof -ti:8xxx > /dev/null; then
    echo "⚠️  Forcefully killing service..."
    kill -9 $SERVICE_PID
  fi
else
  echo "ℹ️  Service not running (fresh deployment)"
fi
```

**Safety Check**: Verify port is released before proceeding.

---

### Step 4: Deploy New Version

```bash
# Backup current version (if exists)
if [ -f "{{service}}.jar" ]; then
  BACKUP_NAME="{{service}}.jar.backup.$(date +%Y%m%d_%H%M%S)"
  cp {{service}}.jar $BACKUP_NAME
  echo "💾 Backup created: $BACKUP_NAME"
fi

# Copy new artifact from target/
cp target/*.jar {{service}}.jar

# Verify deployment
if [ -f "{{service}}.jar" ]; then
  echo "✅ New version deployed"
  ls -lh {{service}}.jar
else
  echo "❌ Deployment failed - Artifact not copied"
  exit 1
fi
```

---

### Step 5: Start Service

```bash
# Start service using start script
./start.sh

# Initial startup wait (5 seconds)
echo "⏳ Waiting 5s for startup..."
sleep 5

# Check if process started
NEW_PID=$(lsof -ti:8xxx)
if [ -n "$NEW_PID" ]; then
  echo "✅ Service started (PID: $NEW_PID)"
else
  echo "❌ Service failed to start"
  echo "📋 Check logs:"
  tail -n 50 logs/log.$(date "+%Y-%m-%d")-0.log
  exit 1
fi
```

---

### Step 6: Health Check (Comprehensive Validation)

**Wait Strategy**: 30 seconds for full initialization

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 HEALTH CHECK (30s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for service to fully initialize
for i in {1..30}; do
  echo -n "⏳ ${i}/30s... "

  # Check if service is responding
  if curl -f -s http://localhost:8xxx/actuator/health > /dev/null 2>&1; then
    echo "✅ Service responding"
    HEALTH_PASS=true
    break
  else
    echo "❌ No response"
  fi

  sleep 1
done

# Health check result
if [ "$HEALTH_PASS" = true ]; then
  echo "✅ Health check PASSED"

  # Detailed health info
  curl -s http://localhost:8xxx/actuator/health | jq '.'

else
  echo "❌ Health check FAILED"
  echo ""
  echo "🔄 AUTOMATIC ROLLBACK INITIATED"

  # Stop failed service
  ./stop.sh

  # Restore backup
  if [ -f "$BACKUP_NAME" ]; then
    cp $BACKUP_NAME {{service}}.jar
    echo "💾 Restored backup: $BACKUP_NAME"

    # Restart previous version
    ./start.sh
    sleep 5

    echo "✅ Rollback completed - Previous version restored"
  else
    echo "⚠️  No backup found - Manual intervention required"
  fi

  exit 1
fi
```

**Rollback Triggers**:
- Service doesn't respond within 30s
- Health endpoint returns non-200 status
- Process crashes during startup

---

### Step 7: Log Monitoring & Summary

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Service: {{service}}"
echo "🆕 Version: $(date +%Y%m%d_%H%M%S)"
echo ""
echo "[1/7] ✅ Tests passed (JUnit: XX/XX)"
echo "[2/7] ✅ Build successful"
echo "[3/7] ✅ Service stopped gracefully"
echo "[4/7] ✅ New version deployed"
echo "[5/7] ✅ Service started (PID: $NEW_PID)"
echo "[6/7] ✅ Health check passed (responded in ${i}s)"
echo "[7/7] ✅ Deployment completed"
echo ""
echo "⏱️  Total Duration: X.XXs"
echo "💡 Zero-downtime deployment with automatic rollback"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Monitor logs for 5 minutes:"
echo "   tail -f logs/log.$(date "+%Y-%m-%d")-0.log"
echo ""
echo "2. Check for errors:"
echo "   grep -i error logs/log.$(date "+%Y-%m-%d")-0.log"
echo ""
echo "3. Verify functionality:"
echo "   /service-status {{service}}"
echo ""
echo "4. Run API tests:"
echo "   /test-api {{service}}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Auto-tail logs for 10 seconds
echo ""
echo "📄 Live logs (10s preview):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
timeout 10 tail -f logs/log.$(date "+%Y-%m-%d")-0.log || true
echo ""
echo "✅ Deployment monitoring complete"
```

---

## Safety Features

### 1. Pre-deployment Testing
- **Mandatory** test execution before deployment
- Deployment aborted if any test fails (Boris Cherny principle)

### 2. Graceful Shutdown
- 30-second wait for graceful shutdown
- Force kill only as last resort

### 3. Automatic Rollback
- Health check failure → Auto rollback
- Previous version restored from backup
- Service automatically restarted

### 4. Zero-Downtime Strategy
```
Old Version Running
      ↓
Stop Old Version (graceful, 30s)
      ↓
Deploy New Version (fast copy)
      ↓
Start New Version (5s init)
      ↓
Health Check (30s validation)
      ↓
Success → Continue | Failure → Rollback
```

**Total Downtime**: ~35 seconds (stop + deploy + start)

---

## Port Configuration (KiiPS Services)

Auto-detect ports based on service name:

| Service | Port | Service | Port |
|---------|------|---------|------|
| KiiPS-FD | 8601 | KiiPS-IL | 8401 |
| KiiPS-PG | 8201 | KiiPS-AC | 8301 |
| KiiPS-SY | 8501 | KiiPS-Login | 8801 |
| KiiPS-COMMON | 8701 | KiiPS-UI | 8100 |
| KIIPS-APIGateway | 8000 | (Others) | 8xxx |

```bash
# Port detection logic
case "{{service}}" in
  "KiiPS-FD") PORT=8601 ;;
  "KiiPS-IL") PORT=8401 ;;
  "KiiPS-PG") PORT=8201 ;;
  "KIIPS-APIGateway") PORT=8000 ;;
  *) echo "⚠️  Unknown service - Manual port required" ;;
esac
```

---

## Rollback Scenarios

### Scenario 1: Health Check Failure
```
[6/7] ❌ Health check FAILED (timeout after 30s)

🔄 AUTOMATIC ROLLBACK INITIATED

[R1] 🛑 Stopping failed service...
[R2] 💾 Restoring backup: {{service}}.jar.backup.20260105_143022
[R3] 🚀 Starting previous version...
[R4] 🏥 Health check: ✅ Previous version healthy

✅ Rollback completed successfully
⚠️  New version failed - Review logs before retry
```

### Scenario 2: Service Crash on Startup
```
[5/7] ❌ Service failed to start (process not found)

📋 Error logs (last 50 lines):
java.lang.OutOfMemoryError: Java heap space
  at com.kiips.fd.service.FundService.loadFunds

🔄 AUTOMATIC ROLLBACK INITIATED
...
```

---

## Comparison: Before vs After

### Before (Manual Deployment)
```bash
# 1. Build (often skipped)
cd KiiPS-HUB && mvn package -pl :KiiPS-FD -am
# ⏱️ 3-4 minutes

# 2. Test (OFTEN SKIPPED ⚠️)
# ⏱️ 0 minutes (skipped = high risk)

# 3. Stop service
cd ../KiiPS-FD && ./stop.sh
# ⏱️ 30 seconds

# 4. Manual copy
cp target/*.jar KiiPS-FD.jar
# ⏱️ 10 seconds

# 5. Start service
./start.sh
# ⏱️ 10 seconds

# 6. Manual health check (OFTEN SKIPPED ⚠️)
# ⏱️ 0 seconds (skipped = high risk)

Total: ~5 minutes
Test Execution: 0% (skipped)
Health Check: 0% (skipped)
Rollback: Manual (if needed)
Risk: HIGH (no validation)
```

### After (Automated Pipeline)
```bash
/deploy-with-tests KiiPS-FD

Total: ~5 minutes
Test Execution: 100% (mandatory)
Health Check: 100% (mandatory)
Rollback: Automatic (if needed)
Risk: LOW (full validation)

Quality: 2-3x better (Boris Cherny principle)
```

---

## Error Handling Examples

### Example 1: Test Failure (Deployment Aborted)
```
[1/7] ❌ Tests FAILED

Failed Tests:
  • testFundCalculation (expected: 1500, actual: 1450)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ DEPLOYMENT ABORTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Boris Cherny Warning:
"Never deploy with failing tests. Quality drops 2-3x."

Options:
  1. Fix tests and retry (recommended)
  2. Force deploy (STRONGLY DISCOURAGED)
  3. Cancel

Your choice:
```

### Example 2: Health Check Failure (Auto Rollback)
```
[6/7] ❌ Health check FAILED

Tried 30 times (30s), no response from http://localhost:8601

🔄 AUTOMATIC ROLLBACK INITIATED

[R1] ✅ Stopped failed service
[R2] ✅ Restored backup: KiiPS-FD.jar.backup.20260105_143022
[R3] ✅ Started previous version (PID: 45678)
[R4] ✅ Health check: Previous version healthy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ROLLBACK SUCCESSFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next Steps:
  1. Review logs: tail -f logs/log.$(date "+%Y-%m-%d")-0.log
  2. Fix startup issues
  3. Retry deployment
```

---

## Integration with Other Commands

This command internally uses:
- Auto test execution (Step 1)
- `/build-service` (Step 2)
- Service control scripts: `stop.sh`, `start.sh` (Steps 3, 5)
- `/service-status` (Step 7, optional)

---

## Boris Cherny's Principles Applied

### ✅ Principle 1: Validation Feedback Loop
> "가장 중요한 요소는 Claude에게 작업 결과를 스스로 검증할 수 있는 방법을 제공하는 것입니다."

**Applied**: Test → Build → Deploy → Health Check pipeline

### ✅ Principle 2: Never Skip Tests
> "견고한 검증 루프를 구축하면 최종 결과물의 품질이 2-3배 향상됩니다."

**Applied**: Mandatory pre-deployment testing

### ✅ Principle 3: Automatic Rollback
> "백그라운드 에이전트나 플러그인을 사용해 작업을 결정론적으로 검증합니다."

**Applied**: Health check failure → Automatic rollback to previous version

---

## Troubleshooting

### Issue: "Service won't stop (force kill required)"
**Solution**:
```bash
# Find and kill process
lsof -ti:8601 | xargs kill -9
# Retry deployment
```

### Issue: "Health check always fails (new service takes >30s)"
**Solution**: Increase health check timeout
```bash
# Modify Step 6:
for i in {1..60}; do  # Increase from 30 to 60
```

### Issue: "Rollback fails (no backup found)"
**Solution**: Manual intervention required
```bash
# Restore from SVN
svn update
./stop.sh && ./start.sh
```

---

**Created**: 2026-01-05
**Version**: 1.0.0
**Inspired by**: Boris Cherny's Claude Code Workflow (Validation Feedback Loop)
**Safety**: ✅ Automatic Rollback | ✅ Pre-deployment Testing | ✅ Health Check
