---
name: deployment-pipeline-orchestration
description: 서비스 배포 파이프라인 조정 및 자동 롤백 관리
type: orchestration
manager: deployment-manager
relatedSkills:
  - kiips-service-deployer
  - kiips-api-tester
  - kiips-log-analyzer
  - checklist-generator
priority: high
---

# Deployment Pipeline Orchestration Skill

## Purpose

마이크로서비스 배포 파이프라인의 전체 워크플로우를 조정하고, 6단계 검증 (pre-check → stop → start → health check → log verification → post-check)을 강제합니다. deployment-manager가 서비스 제어, 헬스체크, 로그 분석, 롤백을 오케스트레이션할 때 사용합니다.

## Core Orchestration Patterns

### Pattern 1: 6-Stage Deployment Pipeline

**목적**: 안전한 배포 및 자동 롤백 보장

```
Stage 1: Pre-Deployment Check (checklist-generator)
    ↓ [Checkpoint: Build artifacts present, config valid]
Stage 2: Service Stop (Primary Coordinator)
    ↓ [Execute: ./stop.sh]
Stage 3: Service Start (Primary Coordinator)
    ↓ [Execute: ./start.sh]
Stage 4: Health Check (kiips-developer + kiips-api-tester)
    ↓ [Parallel: API testing]
Stage 5: Log Verification (kiips-developer + kiips-log-analyzer)
    ↓ [Parallel: Error pattern detection]
Stage 6: Post-Deployment Checklist (checklist-generator)
    ↓ [Checkpoint: All validations passed]
```

**Manager의 역할**:
- 6단계 순차 실행 (이전 Stage PASS 후 다음 진행)
- Stage 4와 5는 병렬 실행 (시간 최적화)
- 실패 시 자동 롤백 또는 Primary 에스컬레이션

**Total Time**: ~3-5분 per service

### Pattern 2: Sequential Multi-Service Deployment

**목적**: 서비스 간 의존성을 고려한 순차 배포 (카스케이딩 실패 방지)

```
Deploy KiiPS-FD, KiiPS-IL, KiiPS-PG (sequential to minimize downtime)

├─ Deploy FD (Stages 1-6, 3-5 min)
│   ↓ [Validation checkpoint]
├─ Deploy IL (Stages 1-6, 3-5 min)
│   ↓ [Validation checkpoint]
└─ Deploy PG (Stages 1-6, 3-5 min)

Manager Role: Monitor each deployment, rollback on failure
Total Time: ~9-15 minutes (sequential to avoid cascading failures)
```

**왜 순차 배포?**:
- 여러 서비스 동시 재시작 시 시스템 부하 증가
- 실패 시 영향 범위 최소화 (한 서비스만 롤백)
- 의존성 순서 보장 (COMMON → UTILS → 비즈니스 서비스)

### Pattern 3: Automatic Rollback on Failure

**목적**: Health check 실패 시 자동 복구

```
onHealthCheckFailure = (serviceName, error) => {
  if (retryCount < 2) {
    // Retry: stop → start → health check
    retry(serviceName)
  } else {
    // Rollback: stop service, restore previous version
    rollback(serviceName)
    escalateToPrimary({
      reason: 'health_check_failure',
      service: serviceName,
      error
    })
  }
}
```

**Rollback 절차**:
1. 현재 서비스 중지 (`./stop.sh`)
2. 이전 JAR/WAR 버전 복원 (backup에서)
3. 이전 버전으로 서비스 재시작
4. Health check 재실행
5. 성공 시 안정화, 실패 시 Primary 에스컬레이션

### Pattern 4: Parallel Verification (Time Optimization)

**목적**: Stage 4와 5를 병렬 실행하여 시간 단축

```
After service starts:
  ├─ Worker-1: Health Check (kiips-api-tester, 30초)
  └─ Worker-2: Log Analysis (kiips-log-analyzer, 30초)
       ↓ [병렬 실행]
  Manager: Wait for both to complete (30초)
       ↓
  Both PASS → Stage 6 진행
```

**최적화 효과**: 순차 60초 → 병렬 30초 (50% 단축)

## Worker Assignment Strategy

### Service Control (Primary Coordinator Only)

**⚠️ CRITICAL**: 서비스 start/stop은 **Primary Coordinator 전용** 권한

```
deployment-manager:
  Stage 2: Service Stop 필요
    ↓
  Primary에게 요청: "KiiPS-FD 중지해주세요"
    ↓
  Primary 실행: cd KiiPS-FD && ./stop.sh
    ↓
  Manager 대기 (PID 종료 확인)
```

**Why Primary-only?**:
- 서비스 제어는 시스템 수준 작업 (보안 위험)
- 여러 Manager가 동시 제어 시 충돌 가능
- Primary가 전체 시스템 상태 파악 후 안전하게 실행

### Verification Tasks (Workers)

```
Stage 4: Health Check
  → kiips-developer + kiips-api-tester 스킬
  → curl http://localhost:8601/actuator/health

Stage 5: Log Analysis
  → kiips-developer + kiips-log-analyzer 스킬
  → tail -n 100 logs/log.$(date "+%Y-%m-%d")-0.log | grep ERROR
```

## Quality Checkpoints

### Stage 1: Pre-Deployment Check

**검증 항목** (checklist-generator):
- ✓ Build artifacts present (`target/*.jar` or `target/*.war`)
- ✓ Configuration files valid (`application*.properties`)
- ✓ No uncommitted changes (SVN status clean)
- ✓ Service not already running (avoid conflicts)

**통과 조건**: All checks passed

**Fallback**: If artifacts missing → escalate to build-manager to rebuild

### Stage 2: Service Stop

**Owner**: Primary Coordinator (exclusive permission)

**Command**: `cd KiiPS-{ServiceName} && ./stop.sh`

**Verification**: Process ID (PID) no longer exists

**Timeout**: 30 seconds

**Fallback**: If process doesn't stop → `kill -9 <PID>`

### Stage 3: Service Start

**Owner**: Primary Coordinator (exclusive permission)

**Command**: `cd KiiPS-{ServiceName} && ./start.sh`

**Verification**: Process starts, PID file created

**Timeout**: 60 seconds

**Fallback**: If start fails → check logs, retry once

### Stage 4: Health Check

**Owner**: kiips-developer + kiips-api-tester skill

**Checks**:
```bash
# Spring Boot Actuator health endpoint
curl http://localhost:8601/actuator/health
# Expected: {"status":"UP"}

# Custom health endpoint (if exists)
curl http://localhost:8601/api/health
# Expected: 200 OK
```

**Timeout**: 60 seconds (allow for service warmup)

**Retry**: 3 attempts with 10-second intervals

**Pass Criteria**: HTTP 200 + `"status":"UP"`

**Fallback**: If timeout → check logs for startup errors

### Stage 5: Log Verification

**Owner**: kiips-developer + kiips-log-analyzer skill

**Checks**:
```bash
# Analyze today's log file
tail -n 100 logs/log.$(date "+%Y-%m-%d")-0.log | grep -E "ERROR|Exception|WARN"
```

**Pass Criteria**:
- Zero ERROR entries in last 100 lines
- < 3 WARN entries
- "Started {ServiceName}Application" message present

**Fallback**: If errors found → classify severity, escalate if critical

### Stage 6: Post-Deployment Checklist

**Owner**: checklist-generator

**Checks**:
- ✓ Service running (PID exists)
- ✓ Health endpoint responsive
- ✓ No critical errors in logs
- ✓ API endpoints accessible (smoke tests)
- ✓ Database connections established (if applicable)

**Pass Criteria**: All checks passed

**Output**: Deployment summary report

## Escalation Triggers

Manager가 Primary에게 에스컬레이션하는 조건:

1. **Service Start Failures**
   - Service fails to start after 2 retries
   - Port already in use (conflict)
   - JVM crashes immediately

2. **Critical Runtime Errors**
   - Database connection failures
   - OutOfMemoryError in logs
   - Missing required configuration

3. **Health Check Failures**
   - Service unresponsive after 60 seconds (3 attempts)
   - Health check endpoint returns 500 errors
   - Dependency service unavailable

4. **Cascading Failures**
   - Multiple services failing simultaneously
   - Shared resource exhaustion (DB connections, memory)

## Example Workflows

### Workflow 1: Single Service Deployment (KiiPS-FD)

```
User: "KiiPS-FD 배포해줘"

deployment-manager:
  1. Activate skills:
     - kiips-service-deployer
     - kiips-api-tester
     - kiips-log-analyzer

  2. Acquire domain lock on "deployment"

  ★ Stage 1: Pre-Deployment Check
    - checklist-generator 할당
    - Checks:
      ✓ target/KiiPS-FD-0.0.1-SNAPSHOT.jar exists (45.2 MB)
      ✓ application-kiips.properties valid
      ✓ svn status clean
      ✓ Service not running
    - Result: PASS

  ★ Stage 2: Service Stop
    - Request to Primary: "KiiPS-FD 중지해주세요"
    - Primary executes: cd KiiPS-FD && ./stop.sh
    - Verification: PID 12345 terminated ✓
    - Result: SUCCESS

  ★ Stage 3: Service Start
    - Request to Primary: "KiiPS-FD 시작해주세요"
    - Primary executes: cd KiiPS-FD && ./start.sh
    - Verification: PID 54321 created ✓
    - Result: SUCCESS

  ★ Stage 4: Health Check (Parallel)
    - Worker-1 (kiips-developer + kiips-api-tester):
      - Wait 30s (service warmup)
      - curl http://localhost:8601/actuator/health
      - Response: {"status":"UP"}
      - Result: PASS

  ★ Stage 5: Log Verification (Parallel)
    - Worker-2 (kiips-developer + kiips-log-analyzer):
      - tail -n 100 logs/log.2026-01-05-0.log | grep ERROR
      - Errors found: 0
      - "Started KiiPSFDApplication" message present ✓
      - Result: PASS

  ★ Stage 6: Post-Deployment Checklist
    - checklist-generator 할당
    - Checks:
      ✓ Service running (PID 54321)
      ✓ Health endpoint responsive
      ✓ No critical errors
      ✓ API endpoints accessible
      ✓ DB connections established
    - Result: PASS

  Release domain lock
  Report to Primary: "Deployment successful (3분 42초)"
```

### Workflow 2: Multi-Service Sequential Deployment (FD, IL, PG)

```
User: "KiiPS-FD, IL, PG 모두 재시작해줘"

deployment-manager:
  1. Create sequential plan:
     - Deploy FD → Validate → Deploy IL → Validate → Deploy PG → Validate

  2. Acquire domain lock

  For each service (FD, IL, PG):
    ★ Stages 1-6 executed sequentially
    ★ If any stage fails → rollback service, escalate to Primary, STOP

  Results:
    - FD: SUCCESS (3.5 min)
    - IL: SUCCESS (3.2 min)
    - PG: SUCCESS (3.8 min)

  Release domain lock
  Report to Primary: "3개 서비스 배포 완료 (총 10.5분)"

Total Time: ~10-11 minutes (순차 배포로 카스케이딩 실패 방지)
```

### Workflow 3: Health Check Failure → Automatic Rollback

```
deployment-manager:
  Stage 3: KiiPS-FD started (PID 54321)

  ★ Stage 4: Health Check (Attempt 1/3)
    - curl http://localhost:8601/actuator/health
    - Result: Timeout (60s)

  ★ Stage 4: Health Check (Attempt 2/3)
    - curl http://localhost:8601/actuator/health
    - Result: Timeout (60s)

  ★ Stage 4: Health Check (Attempt 3/3)
    - curl http://localhost:8601/actuator/health
    - Result: Timeout (60s)

  Checkpoint FAIL: Health check failed after 3 attempts

  ★ Automatic Rollback:
    1. Request Primary to stop KiiPS-FD
    2. Restore previous JAR version (from backup)
    3. Request Primary to start KiiPS-FD with previous version
    4. Health check on previous version → SUCCESS ✓

  ★ Log Analysis (Root Cause):
    - grep ERROR logs/log.2026-01-05-0.log
    - Found: "OutOfMemoryError: Java heap space"

  Escalation to Primary:
    - Reason: "Health check timeout after 3 attempts"
    - Root cause: "OutOfMemoryError detected in logs"
    - Action: "Rollback to previous version completed"
    - Recommendation: "Increase heap size (-Xmx4g)"

  Primary investigates and fixes heap size issue
```

### Workflow 4: Parallel Verification (Health Check + Log Analysis)

```
deployment-manager:
  Stage 3: Service started

  ★ Stage 4 + 5: Parallel Verification (30s)
    ├─ Worker-1: Health Check
    │   - curl localhost:8601/actuator/health → UP ✓
    │
    └─ Worker-2: Log Analysis
        - grep ERROR logs/log.2026-01-05-0.log → 0 errors ✓

  Manager waits for both (30s total, not 60s)

  Both PASS → Stage 6 진행
```

## Domain Lock Management

deployment-manager acquires **domain lock** on "deployment":

```javascript
// Prevent concurrent deployments
const lock = acquireManagerLock('deployment-manager', 'deployment')

// Scope: One deployment workflow at a time (all services)
// Reason: Avoid resource contention and cascading failures
```

**Note**: Sequential deployment prevents multiple services restarting simultaneously (reduces load)

## Progress Tracking

deployment-manager tracks progress across stages:

```javascript
// Stage-based progress for single service
stageProgress = {
  'pre-deployment-check': { status: 'completed', progress: 100 },
  'service-stop': { status: 'completed', progress: 100 },
  'service-start': { status: 'completed', progress: 100 },
  'health-check': { status: 'in_progress', progress: 50, attempts: 2 },
  'log-verification': { status: 'pending', progress: 0 },
  'post-deployment-checklist': { status: 'pending', progress: 0 }
}

// Overall deployment progress
overallProgress = (completed / total) * 100 // ~62%
```

## Rollback Strategies

### Strategy 1: JAR/WAR Version Rollback

```
1. Backup current artifact:
   cp target/KiiPS-FD.jar target/KiiPS-FD.jar.backup

2. Restore previous version:
   cp backup/KiiPS-FD-previous.jar target/KiiPS-FD.jar

3. Restart service with previous version:
   ./stop.sh && ./start.sh

4. Verify health check → SUCCESS
```

### Strategy 2: Configuration Rollback

```
1. Restore previous application.properties:
   svn revert application-kiips.properties

2. Restart service:
   ./stop.sh && ./start.sh

3. Verify health check → SUCCESS
```

### Strategy 3: Full System Rollback (Multiple Services)

```
If multiple services fail during sequential deployment:
  1. Stop all deployed services
  2. Restore all previous versions
  3. Restart in reverse order (PG → IL → FD)
  4. Verify all health checks
  5. Escalate to Primary
```

## Related Skills

- **kiips-service-deployer**: Manager가 이 스킬을 활용하여 배포 워크플로우 실행
- **kiips-api-tester**: Stage 4 health check 실행
- **kiips-log-analyzer**: Stage 5 log verification 실행
- **checklist-generator**: Stage 1 및 Stage 6 체크리스트 생성

## Best Practices

1. **순차 배포 우선**: 멀티 서비스 배포 시 카스케이딩 실패 방지
2. **병렬 검증 활용**: Health check와 Log analysis 동시 실행으로 시간 단축
3. **자동 롤백 신뢰**: 3회 재시도 실패 시 자동 롤백 (수동 개입 최소화)
4. **Primary 권한 존중**: 서비스 start/stop은 반드시 Primary 요청
5. **도메인 잠금 활용**: 동시 배포 방지로 시스템 안정성 보장

---

**Manager**: deployment-manager
**Managed Skills**: kiips-service-deployer, kiips-api-tester, kiips-log-analyzer
**Delegates To**: kiips-developer (for testing), checklist-generator
**Coordinates With**: Primary Coordinator (for service control)
**Key Value**: Automated deployment validation, automatic rollback, ≥95% deployment success rate
