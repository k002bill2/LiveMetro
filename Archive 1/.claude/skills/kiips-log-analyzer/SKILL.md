---
name: kiips-log-analyzer
description: Analyzes KiiPS service logs for errors, performance issues, and patterns. Use for troubleshooting and monitoring.
---

# KiiPS Log Analyzer Skill

## Purpose
Automated analysis of KiiPS microservice logs for debugging and monitoring.

## Log Location
```bash
# Service logs
KiiPS-ServiceName/logs/log.YYYY-MM-DD-0.log

# Example
KiiPS-FD/logs/log.2025-12-28-0.log
KiiPS-IL/logs/log.2025-12-28-0.log
```

## Analysis Commands

### Find Errors
```bash
# Today's errors
grep -i "error\|exception" logs/log.$(date "+%Y-%m-%d")-0.log

# With context (5 lines before/after)
grep -i -C 5 "error\|exception" logs/log.$(date "+%Y-%m-%d")-0.log

# Count errors by type
grep -i "error\|exception" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $5}' | sort | uniq -c | sort -rn

# Errors in last hour
grep -i "error\|exception" logs/log.$(date "+%Y-%m-%d")-0.log \
  | tail -1000

# Find specific error
grep -i "NullPointerException" logs/log.$(date "+%Y-%m-%d")-0.log
```

### Performance Analysis
```bash
# Find slow queries (>1000ms)
grep "execution time" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '$NF > 1000'

# API response times
grep "API" logs/log.$(date "+%Y-%m-%d")-0.log \
  | grep -oP "time=\K[0-9]+" \
  | awk '{sum+=$1; count++} END {print "Avg:", sum/count, "ms"}'

# Slowest queries
grep "execution time" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $NF, $0}' | sort -rn | head -10

# Database connection pool status
grep -i "connection pool" logs/log.$(date "+%Y-%m-%d")-0.log
```

### Traffic Patterns
```bash
# Requests per endpoint
grep "GET\|POST\|PUT\|DELETE" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $7}' | sort | uniq -c | sort -rn

# Requests per hour
grep "GET\|POST\|PUT\|DELETE" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $2}' | cut -d: -f1 | sort | uniq -c

# HTTP status codes distribution
grep "HTTP" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $9}' | sort | uniq -c | sort -rn

# Most active users
grep "username" logs/log.$(date "+%Y-%m-%d")-0.log \
  | awk '{print $10}' | sort | uniq -c | sort -rn | head -20
```

### Error Investigation
```bash
# Find stack traces
grep -A 10 "Exception" logs/log.$(date "+%Y-%m-%d")-0.log

# Find specific user's errors
grep "userId=123" logs/log.$(date "+%Y-%m-%d")-0.log \
  | grep -i "error"

# Time-based error search (between 14:00-15:00)
sed -n '/14:00/,/15:00/p' logs/log.$(date "+%Y-%m-%d")-0.log \
  | grep -i "error"

# Find failed transactions
grep -i "transaction.*failed" logs/log.$(date "+%Y-%m-%d")-0.log
```

## Automated Monitoring Script

### Basic Monitor
```bash
#!/bin/bash
# kiips-log-monitor.sh

LOG_FILE="logs/log.$(date "+%Y-%m-%d")-0.log"

echo "=== Error Summary ==="
echo "Total Errors: $(grep -c "ERROR" $LOG_FILE)"
echo "Total Exceptions: $(grep -c "Exception" $LOG_FILE)"
echo ""

echo "=== Last 10 Errors ==="
grep "ERROR" $LOG_FILE | tail -10
echo ""

echo "=== Performance Alerts (>2000ms) ==="
grep "execution time" $LOG_FILE | awk '$NF > 2000'
echo ""

echo "=== Memory Warnings ==="
grep -i "memory\|heap" $LOG_FILE | tail -5
```

### Advanced Monitor with Alerts
```bash
#!/bin/bash
# kiips-advanced-monitor.sh

LOG_FILE="logs/log.$(date "+%Y-%m-%d")-0.log"
ERROR_THRESHOLD=100
SLOW_QUERY_THRESHOLD=2000

# Count errors
ERROR_COUNT=$(grep -c "ERROR" $LOG_FILE)

if [ $ERROR_COUNT -gt $ERROR_THRESHOLD ]; then
  echo "⚠️  ALERT: High error rate detected ($ERROR_COUNT errors)"
  echo "Last 5 errors:"
  grep "ERROR" $LOG_FILE | tail -5
fi

# Check slow queries
SLOW_QUERIES=$(grep "execution time" $LOG_FILE | awk "\$NF > $SLOW_QUERY_THRESHOLD" | wc -l)

if [ $SLOW_QUERIES -gt 0 ]; then
  echo "⚠️  ALERT: $SLOW_QUERIES slow queries detected (>$SLOW_QUERY_THRESHOLD ms)"
  grep "execution time" $LOG_FILE | awk "\$NF > $SLOW_QUERY_THRESHOLD" | head -5
fi

# Check connection pool
grep -i "connection.*exhausted" $LOG_FILE
if [ $? -eq 0 ]; then
  echo "🚨 CRITICAL: Database connection pool exhausted!"
fi
```

## Multi-Service Analysis

### Check All Services
```bash
#!/bin/bash
# check-all-services.sh

SERVICES=("KiiPS-FD" "KiiPS-IL" "KiiPS-PG" "KiiPS-COMMON")
TODAY=$(date "+%Y-%m-%d")

for service in "${SERVICES[@]}"; do
  echo "=== $service ==="
  LOG_FILE="$service/logs/log.$TODAY-0.log"

  if [ -f "$LOG_FILE" ]; then
    echo "Errors: $(grep -c ERROR $LOG_FILE)"
    echo "Warnings: $(grep -c WARN $LOG_FILE)"
    echo "Last error:"
    grep ERROR $LOG_FILE | tail -1
  else
    echo "Log file not found: $LOG_FILE"
  fi
  echo ""
done
```

## Alert Triggers

### Critical Alerts (Immediate Action)
- ERROR count > 100/hour
- Response time > 5000ms
- Database connection pool exhausted
- Memory usage > 90%
- Disk usage > 85%
- Service crash/restart

### Warning Alerts (Monitor)
- ERROR count > 50/hour
- Response time > 2000ms
- Memory usage > 80%
- Disk usage > 75%
- Slow queries > 1000ms

### Info Alerts (Track)
- WARNING count > 100/hour
- API Gateway timeout
- Cache hit rate < 70%

## Real-Time Monitoring

### Watch Logs Live
```bash
# Follow logs with color highlighting
tail -f logs/log.$(date "+%Y-%m-%d")-0.log | \
  grep --color=always -E 'ERROR|WARN|Exception|$'

# Multiple services
tail -f KiiPS-*/logs/log.$(date "+%Y-%m-%d")-0.log

# Filter specific patterns
tail -f logs/log.$(date "+%Y-%m-%d")-0.log | \
  grep --line-buffered -i "error\|exception\|failed"
```

## MCP-Based Log Automation ⭐NEW

### Automated Real-Time Monitoring

**Log Watcher Daemon**을 사용하여 실시간으로 로그를 감시하고 자동 분석합니다.

```bash
# Daemon 시작 (foreground)
bash .scripts/monitoring/start-monitor.sh

# Daemon 시작 (background)
bash .scripts/monitoring/start-monitor.sh --background

# Daemon 중지
bash .scripts/monitoring/start-monitor.sh --stop

# Daemon 상태 확인
bash .scripts/monitoring/start-monitor.sh --status
```

### Dev Docs 자동 업데이트

Daemon이 실행 중일 때, 에러 감지 시 자동으로 `dev/active/log-analysis-summary.md` 파일을 업데이트합니다.

```bash
# 최신 분석 결과 확인
cat dev/active/log-analysis-summary.md

# 실시간 업데이트 감시
tail -f dev/active/log-analysis-summary.md
```

### MCP Filesystem 명령어

**IMPORTANT**: MCP 명령어는 Claude Code 내부에서만 사용 가능합니다.

```bash
# Claude에게 요청 예시:

"filesystem MCP를 사용해서 KiiPS-FD의 오늘 로그 파일을 읽어줘"

"로그 파일 목록을 filesystem MCP로 가져와줘"

"dev/active/log-analysis-summary.md를 MCP로 읽어서 요약해줘"
```

**Background**: Claude는 다음 MCP 도구들을 사용할 수 있습니다:
- `filesystem/read_file` - 파일 읽기
- `filesystem/list_directory` - 디렉토리 목록
- `filesystem/write_file` - 파일 쓰기

### 자동화 워크플로우

**1. Daemon 시작**
```bash
cd /Users/younghwankang/WORK/WORKSPACE/KiiPS
bash .scripts/monitoring/start-monitor.sh --background
```

**2. 로그 자동 감시**
- 모든 KiiPS 서비스의 로그 파일 실시간 감시
- 에러/경고/Slow Query 자동 감지
- 패턴 매칭 및 통계 집계

**3. Dev Docs 자동 생성**
- Critical 에러 발견 시 즉시 업데이트
- 서비스별 에러 현황 요약
- Action Items 자동 추출

**4. Claude에게 분석 요청**
```plaintext
"Dev Docs의 로그 분석 요약을 읽고 문제점을 알려줘"
"KiiPS-FD 서비스의 최근 에러를 분석해줘"
"Slow Query가 가장 많은 서비스는 어디야?"
```

### 설정 파일

**config.json** - 감시 대상 및 임계값 설정
```json
{
  "watchPaths": [
    "KiiPS-FD/logs/log.*.log",
    "KiiPS-IL/logs/log.*.log",
    ...
  ],
  "alertThresholds": {
    "error": { "critical": 100, "warning": 50 },
    "slowQuery": 2000
  }
}
```

**patterns.json** - 에러 패턴 정의
```json
{
  "errorPatterns": {
    "nullPointer": { "pattern": "NullPointerException", "severity": "critical" },
    "sqlError": { "pattern": "SQLException", "severity": "critical" },
    ...
  }
}
```

### 트러블슈팅

**Q: Daemon이 시작되지 않아요**
```bash
# Node.js 버전 확인 (v14+ 필요)
node --version

# 로그 파일 확인
cat .scripts/monitoring/monitor.log

# 수동 실행으로 에러 확인
node .scripts/monitoring/log-watcher-daemon.js
```

**Q: Dev Docs가 업데이트되지 않아요**
```bash
# config.json에서 devDocs.enabled 확인
cat .scripts/monitoring/config.json | grep "enabled"

# dev/active 디렉토리 권한 확인
ls -la dev/active/
```

**Q: 특정 서비스만 감시하고 싶어요**
```bash
# config.json 수정
vi .scripts/monitoring/config.json

# watchPaths에서 원하는 서비스만 남기기
{
  "watchPaths": [
    "KiiPS-FD/logs/log.*.log"  # FD 서비스만 감시
  ]
}
```

---

## When to Use This Skill
- Troubleshooting production issues
- Performance degradation investigation
- Error pattern analysis
- Capacity planning (traffic analysis)
- Security audit (access patterns)
- Post-deployment verification
- Regular health checks
- **⭐NEW: Real-time automated monitoring with MCP integration**

## Related Skills
- **kiips-maven-builder** - Analyze build logs and compilation errors
- **kiips-service-deployer** - Monitor deployment logs and startup issues
- **kiips-api-tester** - Debug API issues using request/response logs
- **checklist-generator** - Generate log verification checklists
