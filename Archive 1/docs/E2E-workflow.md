# KiiPS End-to-End Development Workflows

This document provides comprehensive workflows for KiiPS microservices development, integrating all available Skills for maximum efficiency.

---

## 📋 Table of Contents

1. [Feature Development Lifecycle](#workflow-1-feature-development-lifecycle)
2. [Build & Deploy Cycle](#workflow-2-build--deploy-cycle)
3. [Troubleshooting](#workflow-3-troubleshooting)
4. [Code Review Preparation](#workflow-4-code-review-preparation)
5. [Emergency Hotfix](#workflow-5-emergency-hotfix)
6. [ACE Framework Integration](#ace-framework-integration)

---

## Workflow 1: Feature Development Lifecycle

**Complete end-to-end process for implementing a new feature in KiiPS**

### Phase 1: Planning (kiips-feature-planner)

```bash
# Analyze requirements and create implementation plan
# The Feature Planner Skill will help you:
# - Break down feature into 3-5 phases
# - Identify affected services and dependencies
# - Define quality gates for each phase
# - Create rollback strategy
```

**Steps**:
1. Understand the feature requirements
2. Analyze existing codebase structure
3. Generate phase-based implementation plan
4. Get user approval before proceeding

**Output**: `docs/plans/PLAN_<feature-name>.md`

---

### Phase 2: Implementation & Build (kiips-maven-builder, checklist-generator)

```bash
# 1. Generate code review checklist
# Use checklist-generator Skill to create verification items

# 2. Implement feature code
#    - Service layer (business logic)
#    - Controller layer (API endpoints)
#    - DAO layer (data access via KiiPS-UTILS)

# 3. Build from KiiPS-HUB (CRITICAL)
cd /Users/younghwankang/WORK/WORKSPACE/KiiPS/KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am

# 4. Verify artifacts
ls -lh ../KiiPS-ServiceName/target/*.{jar,war}
```

**Quality Gates**:
- [ ] Build completes without errors
- [ ] No dependency resolution failures
- [ ] Artifacts created successfully
- [ ] Code follows KiiPS conventions
- [ ] No security vulnerabilities (SQL injection, XSS)

**Skills Used**:
- **kiips-maven-builder** - Build process management
- **checklist-generator** - Quality gate checklists

---

### Phase 3: Deployment (kiips-service-deployer, kiips-log-analyzer)

```bash
# 1. Generate deployment checklist
# Use checklist-generator Skill

# 2. Stop existing service (if needed)
cd /Users/younghwankang/WORK/WORKSPACE/KiiPS/KiiPS-ServiceName/
./stop.sh

# 3. Verify port availability
lsof -i :PORT  # Should return empty

# 4. Start service
./start.sh

# 5. Monitor logs in real-time
tail -f logs/log.$(date +%Y-%m-%d)-0.log

# 6. Check for startup errors
grep -i "ERROR\|Exception" logs/log.$(date +%Y-%m-%d)-0.log
```

**Quality Gates**:
- [ ] Service starts without exceptions
- [ ] Spring context loads successfully
- [ ] Health check endpoint responds
- [ ] No ERROR/WARN in startup logs
- [ ] Port binding successful

**Skills Used**:
- **kiips-service-deployer** - Service lifecycle management
- **kiips-log-analyzer** - Log monitoring and error detection
- **checklist-generator** - Deployment verification

---

### Phase 4: Testing & Validation (kiips-api-tester)

```bash
# 1. Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8801/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# 2. Test endpoint through API Gateway
curl -H "X-AUTH-TOKEN: $TOKEN" \
     http://localhost:8000/api/your-endpoint

# 3. Verify response format
curl -s -H "X-AUTH-TOKEN: $TOKEN" \
     http://localhost:8000/api/your-endpoint | jq '.'

# 4. Test error scenarios
curl -H "X-AUTH-TOKEN: invalid-token" \
     http://localhost:8000/api/your-endpoint  # Should return 401

# 5. Performance check
time curl -s -H "X-AUTH-TOKEN: $TOKEN" \
     http://localhost:8000/api/your-endpoint > /dev/null
```

**Quality Gates**:
- [ ] API responds correctly
- [ ] Response format matches specification
- [ ] Error handling works properly
- [ ] Performance acceptable (<200ms p95)
- [ ] Gateway routing correct

**Skills Used**:
- **kiips-api-tester** - API testing and validation
- **checklist-generator** - Testing checklists

---

### Phase 5: Monitoring & Verification (kiips-log-analyzer)

```bash
# 1. Monitor logs for errors
grep -i "ERROR" logs/log.$(date +%Y-%m-%d)-0.log

# 2. Check performance metrics
grep "execution time" logs/log.$(date +%Y-%m-%d)-0.log \
  | awk '{print $NF}' | sort -rn | head -10

# 3. Analyze traffic patterns
grep "GET\|POST\|PUT\|DELETE" logs/log.$(date +%Y-%m-%d)-0.log \
  | awk '{print $7}' | sort | uniq -c | sort -rn

# 4. Verify no memory issues
grep -i "memory\|heap\|OutOfMemory" logs/log.$(date +%Y-%m-%d)-0.log
```

**Quality Gates**:
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] No memory warnings
- [ ] Traffic patterns normal

**Skills Used**:
- **kiips-log-analyzer** - Production monitoring and analysis

---

### Phase 6: SVN Commit

```bash
# 1. Review changes
svn status
svn diff | less

# 2. Commit with descriptive message
svn commit -m "Feature: <description>

Implemented:
- Service layer with business logic
- API endpoints for <functionality>
- Error handling and validation
- Logging and monitoring

Tested:
- Build from KiiPS-HUB successful
- Service deployment verified
- API endpoints validated
- Performance acceptable
"
```

**Complete Workflow Summary**:
```
Feature Request
       ↓
[kiips-feature-planner] → Generate implementation plan
       ↓
[checklist-generator] → Code review checklist
       ↓
Implementation (Code)
       ↓
[kiips-maven-builder] → Build from KiiPS-HUB
       ↓
[kiips-service-deployer] → Deploy service
       ↓
[kiips-log-analyzer] → Monitor startup
       ↓
[kiips-api-tester] → Test endpoints
       ↓
[kiips-log-analyzer] → Verify production health
       ↓
SVN Commit → Feature Complete ✅
```

---

## Workflow 2: Build & Deploy Cycle

**Quick cycle for rebuilding and redeploying after code changes**

### Sequence

```bash
# 1. Update from SVN
cd KiiPS-ServiceName/
svn up

# 2. Build with dependencies
cd ../KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am

# 3. Deploy
cd ../KiiPS-ServiceName/
./stop.sh && sleep 2 && ./start.sh

# 4. Monitor logs
tail -f logs/log.$(date +%Y-%m-%d)-0.log

# 5. Quick API test
TOKEN=$(curl -s -X POST http://localhost:8801/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | jq -r '.token')

curl -H "X-AUTH-TOKEN: $TOKEN" http://localhost:8000/api/health
```

### Skill Chain
```
kiips-maven-builder → kiips-service-deployer → kiips-log-analyzer → kiips-api-tester
```

**Use Cases**:
- After code changes
- During active development
- Testing new features
- Debugging issues

---

## Workflow 3: Troubleshooting

**Systematic approach to diagnosing and fixing issues**

### Step 1: Analyze Logs (kiips-log-analyzer)

```bash
# Find recent errors
grep -i "ERROR\|Exception" logs/log.$(date +%Y-%m-%d)-0.log | tail -20

# Find error context
grep -C 5 "NullPointerException" logs/log.$(date +%Y-%m-%d)-0.log

# Check for pattern
grep -i "connection.*timeout" logs/log.$(date +%Y-%m-%d)-0.log | wc -l
```

### Step 2: Identify Root Cause

**Common Issues**:
1. **Build Errors** → Use **kiips-maven-builder** to check dependencies
2. **Deployment Failures** → Use **kiips-service-deployer** to verify port/config
3. **API Errors** → Use **kiips-api-tester** to reproduce and debug
4. **Performance Issues** → Use **kiips-log-analyzer** for metrics

### Step 3: Fix & Rebuild

```bash
# After fixing code
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am

cd ../KiiPS-ServiceName/
./stop.sh && ./start.sh

# Verify fix
tail -f logs/log.$(date +%Y-%m-%d)-0.log | grep --color=always -i "ERROR\|$"
```

### Step 4: Validate Fix

```bash
# Test the specific scenario that failed
curl -H "X-AUTH-TOKEN: $TOKEN" \
     http://localhost:8000/api/endpoint-that-failed

# Check logs confirm no errors
grep -i "ERROR" logs/log.$(date +%Y-%m-%d)-0.log | tail -10
```

### Skill Chain
```
kiips-log-analyzer → (identify issue) → kiips-maven-builder → kiips-service-deployer → kiips-api-tester
```

---

## Workflow 4: Code Review Preparation

**Ensure code quality before code review or PR**

### Checklist Generation (checklist-generator)

```markdown
## Code Review Checklist

### Build Verification
- [ ] Build: `cd KiiPS-HUB && mvn clean package -pl :KiiPS-ServiceName -am`
- [ ] No compilation errors
- [ ] All dependencies resolved
- [ ] Artifacts created in target/

### Deployment Verification
- [ ] Service starts: `cd KiiPS-ServiceName && ./start.sh`
- [ ] No startup errors in logs
- [ ] Health check responds: `curl http://localhost:PORT/actuator/health`

### API Verification
- [ ] API endpoints respond correctly
- [ ] Error handling implemented
- [ ] Response formats correct
- [ ] Authentication working

### Code Quality
- [ ] Follows KiiPS naming conventions
- [ ] Error handling comprehensive
- [ ] Logging added for debugging
- [ ] No security vulnerabilities
- [ ] Code comments where needed

### Testing
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Performance acceptable

### Documentation
- [ ] API endpoints documented
- [ ] Configuration changes noted
- [ ] SVN commit message prepared
```

### Skill Chain
```
checklist-generator → kiips-maven-builder → kiips-api-tester → kiips-log-analyzer
```

---

## Workflow 5: Emergency Hotfix

**Fast-track process for critical production issues**

### Rapid Response Protocol

```bash
# 1. Immediate log analysis
cd KiiPS-ServiceName/
grep -i "ERROR\|CRITICAL\|Exception" logs/log.$(date +%Y-%m-%d)-0.log | tail -50

# 2. Identify affected code
# Use kiips-log-analyzer to find stack traces

# 3. Quick fix implementation
# Minimal code change to resolve immediate issue

# 4. Fast build
cd ../KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am -DskipTests=true

# 5. Emergency deployment
cd ../KiiPS-ServiceName/
./stop.sh && ./start.sh

# 6. Immediate verification
tail -f logs/log.$(date +%Y-%m-%d)-0.log &
curl -H "X-AUTH-TOKEN: $TOKEN" http://localhost:8000/api/critical-endpoint

# 7. Monitor for 5 minutes
grep -i "ERROR" logs/log.$(date +%Y-%m-%d)-0.log | tail -20

# 8. Emergency commit
svn commit -m "HOTFIX: <critical issue description>"
```

### Skill Chain
```
kiips-log-analyzer → (quick fix) → kiips-maven-builder → kiips-service-deployer → kiips-api-tester
```

**Post-Hotfix**:
- [ ] Schedule proper fix in next sprint
- [ ] Update documentation
- [ ] Add monitoring for similar issues
- [ ] Review root cause analysis

---

## ACE Framework Integration

KiiPS Skills are integrated with the ACE (Autonomous Cognitive Entity) Framework for intelligent orchestration.

### ACE Layers

**Layer 1: Aspirational (Ethical Validation)**
- Validates all tool use against ethical guidelines
- Ensures safe operations (no destructive commands)
- Hook: `.claude/hooks/ethicalValidator.js`

**Layer 2: Global Strategy (Goal Definition)**
- Defines high-level objectives
- Selects appropriate Skills for task
- Hook: `.claude/hooks/userPromptSubmit.js`

**Layer 3: Agent Model (Capability Matching)**
- Matches user intent to available Skills
- Activates relevant Skills based on keywords and patterns
- Config: `.claude/ace-framework/layer3-agent-model.json`

**Layer 4: Executive Function (Task Decomposition)**
- Breaks complex tasks into phases
- Coordinates Skills execution
- Document: `.claude/ace-framework/layer4-executive.md`

**Layer 5: Cognitive Control (Resource Allocation)**
- Manages parallel execution
- Prevents resource conflicts
- Script: `.claude/coordination/parallelCoordinator.js`

**Layer 6: Task Prosecution (Execution & Validation)**
- Executes Skills and tools
- Validates results
- Self-check and feedback loop
- Hook: `.claude/hooks/stopEvent.js`

### Skill Activation Examples

```
User Input: "KiiPS-FD 빌드해줘"
       ↓
[Layer 2] Analyze intent → "build request"
       ↓
[Layer 3] Match capabilities → kiips-maven-builder
       ↓
[Layer 4] Plan execution → cd KiiPS-HUB, mvn clean package -pl :KiiPS-FD -am
       ↓
[Layer 5] Allocate resources → check KiiPS-HUB exists, verify Maven available
       ↓
[Layer 6] Execute & validate → run build, verify artifacts
```

### Coordination Flow

```
Multiple Skills in Sequence:
Feature Development Request
       ↓
[ACE Layer 2] Identify as "feature implementation"
       ↓
[ACE Layer 3] Activate Skills: feature-planner, maven-builder, service-deployer, api-tester
       ↓
[ACE Layer 4] Decompose into phases
       ↓
[ACE Layer 5] Execute in order (with checkpoints)
       ↓
[ACE Layer 6] Validate each phase before proceeding
```

---

## Best Practices

### 1. Always Use Skills Chain

**Don't**: Skip skills and run commands manually
```bash
# ❌ Bad
cd KiiPS-FD/
mvn clean package  # Wrong directory, wrong approach
```

**Do**: Follow Skill guidance
```bash
# ✅ Good
# Use kiips-maven-builder Skill
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-FD -am
```

### 2. Generate Checklists Early

Use **checklist-generator** at the start of any workflow to ensure nothing is missed.

### 3. Monitor Logs Continuously

Use **kiips-log-analyzer** throughout the process, not just when errors occur.

### 4. Verify Each Phase

Don't skip quality gates. Each phase should be verified before proceeding.

### 5. Document Progress

Track progress in feature plans using checkboxes and notes.

---

## Quick Reference

| Workflow | Primary Skills | Duration |
|----------|---------------|----------|
| Feature Development | feature-planner, maven-builder, service-deployer, api-tester, log-analyzer | 6-20 hours |
| Build & Deploy | maven-builder, service-deployer, log-analyzer | 10-15 minutes |
| Troubleshooting | log-analyzer, maven-builder, service-deployer, api-tester | 30-120 minutes |
| Code Review Prep | checklist-generator, maven-builder, api-tester | 30-60 minutes |
| Emergency Hotfix | log-analyzer, maven-builder, service-deployer | 15-30 minutes |

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guide
- [architecture.md](../architecture.md) - System architecture
- [api.md](../api.md) - API documentation
- [deployment.md](../deployment.md) - Deployment guide
- [troubleshooting.md](../troubleshooting.md) - Troubleshooting guide

---

**Last Updated**: 2026-01-04
**Version**: 1.0.0
**Maintainer**: KiiPS Development Team
