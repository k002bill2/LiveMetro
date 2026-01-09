---
name: kiips-api-tester
description: Tests KiiPS API Gateway endpoints and service integration. Use for API testing, JWT validation, and routing verification.
---

# KiiPS API Gateway Tester Skill

## Purpose
Automated testing of KiiPS API Gateway and microservice endpoints.

## Service Port Reference

| Service | Port | API Prefix | Description |
|---------|------|------------|-------------|
| API Gateway | 8088 | - | 라우팅 & CORS |
| KiiPS-Login | 8801 | /api/login | 인증 |
| KiiPS-UI | 8100 | - | 웹 UI |
| KiiPS-FD | 8601 | /FDAPI/ | 펀드 관리 |
| KiiPS-IL | 8401 | /ILAPI/ | 투자 관리 |
| KiiPS-PG | 8501 | /PGAPI/ | 프로그램 관리 |
| KiiPS-COMMON | 8701 | /COMMONAPI/ | 공통 서비스 |
| KiiPS-SY | 8301 | /SYAPI/ | 시스템 관리 |
| KiiPS-AC | 8901 | /ACAPI/ | 회계 |
| KiiPS-EL | 8201 | /ELAPI/ | 전자문서 |
| KiiPS-LP | 8101 | /LPAPI/ | LP 관리 |
| KiiPS-RT | 8001 | /RTAPI/ | 리포팅 |
| KiiPS-MES | 8200 | /MESAPI/ | MES |
| KIIPS-MOBILE | 8002 | - | 모바일 |
| KIIPS-BATCH | 9432 | - | 배치 |
| KIIPS-KSD | 9993 | - | KSD 연동 |

## Environment Setup (Recommended)

> **동기화 문제 방지**: 하드코딩된 포트 대신 환경변수를 사용하면 `app-local.properties` 변경 시 자동으로 반영됩니다.

### Quick Setup
```bash
# 환경변수 로드 (app-local.properties에서 자동 읽기)
source .claude/skills/kiips-api-tester/kiips-env.sh

# 로그인 및 토큰 획득
kiips_login admin password

# API 호출 (환경변수 사용)
kiips_api FDAPI/FD0101/LIST

# 서비스 상태 확인
kiips_health
```

### Available Environment Variables
```bash
# After sourcing kiips-env.sh:
$KIIPS_GATEWAY      # http://localhost:8088 (auto-detected)
$KIIPS_LOGIN        # http://localhost:8801
$KIIPS_FD           # http://localhost:8601
$KIIPS_IL           # http://localhost:8401
$KIIPS_PG           # http://localhost:8501
$KIIPS_COMMON       # http://localhost:8701
$KIIPS_SY           # http://localhost:8301
$KIIPS_AC           # http://localhost:8901
$KIIPS_TOKEN        # JWT token (after kiips_login)
$KIIPS_API_KEY      # SpammerGoHome
```

### Helper Functions
| Function | Description | Example |
|----------|-------------|---------|
| `kiips_login` | JWT 토큰 획득 | `kiips_login admin password` |
| `kiips_api` | API 호출 (Gateway 경유) | `kiips_api FDAPI/FD0101/LIST` |
| `kiips_health` | 모든 서비스 상태 확인 | `kiips_health` |

### Using Environment Variables Directly
```bash
# Source the environment
source .claude/skills/kiips-api-tester/kiips-env.sh

# Use variables instead of hardcoded ports
curl -H "X-AUTH-TOKEN: $KIIPS_TOKEN" \
     -H "x-api-key: $KIIPS_API_KEY" \
     $KIIPS_GATEWAY/FDAPI/FD0101/LIST

# Direct service call
curl -H "X-AUTH-TOKEN: $KIIPS_TOKEN" \
     $KIIPS_FD/FDAPI/FD0101/LIST
```

---

## Usage Examples (Manual)

The following sections demonstrate practical API testing scenarios for KiiPS services.
**Note**: 아래 예시는 하드코딩된 포트를 사용합니다. 환경변수 방식을 권장합니다.

### Authentication

### Get JWT Token
```bash
# Login and get token (Port 8801)
curl -X POST $KIIPS_LOGIN/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  | jq -r '.token'

# Save token to variable
KIIPS_TOKEN=$(curl -s -X POST $KIIPS_LOGIN/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

echo "Token: $KIIPS_TOKEN"
```

### Test with JWT
```bash
# Call through API Gateway (Port 8088)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST

# With pretty-print
curl -s -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST | jq '.'
```

## Service Endpoints Testing

### Fund Management (FD - Port 8601)
```bash
# List funds (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST

# Direct service call (skip Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8601/FDAPI/FD0101/LIST
```

### Investment Management (IL - Port 8401)
```bash
# List investments (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/ILAPI/IL0501/LIST

# Direct service call
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8401/ILAPI/IL0501/LIST
```

### Program Management (PG - Port 8501)
```bash
# List programs (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/PGAPI/PG0203/LIST

# Direct service call
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8501/PGAPI/PG0203/LIST
```

### Common Service (COMMON - Port 8701)
```bash
# Common API call (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/COMMONAPI/file/imgView

# Direct service call
curl -H "X-AUTH-TOKEN: $TOKEN" \
     http://localhost:8701/COMMONAPI/file/imgView
```

### System Management (SY - Port 8301)
```bash
# System API call (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/SYAPI/SY0101/LIST
```

### Accounting (AC - Port 8901)
```bash
# Accounting API call (via Gateway)
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/ACAPI/AC0101/LIST
```

## Health Check

### Check All Services
```bash
# All services health check
for port in 8088 8801 8601 8401 8501 8701 8301 8901 8201 8101 8001 8100; do
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$port/actuator/health 2>/dev/null || echo "DOWN")
  echo "Port $port: $status"
done
```

### Individual Service Check
```bash
# API Gateway
curl -s http://localhost:8088/actuator/health | jq '.'

# Login Service
curl -s http://localhost:8801/actuator/health | jq '.'

# FD Service
curl -s http://localhost:8601/actuator/health | jq '.'

# Common Service
curl -s http://localhost:8701/actuator/health | jq '.'
```

## Service-to-Service Testing

### Direct Service Call (Skip Gateway)
```bash
# Call service directly (for internal testing)
curl -H "x-api-key: SpammerGoHome" \
     http://localhost:8601/FDAPI/internal/stats

# Verify service is running
curl http://localhost:8601/actuator/health
```

### Gateway Routing Verification
```bash
# Test routing through gateway
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     -w "\nStatus: %{http_code}\nTime: %{time_total}s\n" \
     http://localhost:8088/FDAPI/FD0101/LIST
```

## Load Testing

### Simple Load Test with Apache Bench
```bash
# Install ab (if needed)
# brew install apache-bench

# 1000 requests, 10 concurrent
ab -n 1000 -c 10 \
   -H "X-AUTH-TOKEN: $TOKEN" \
   -H "x-api-key: SpammerGoHome" \
   http://localhost:8088/FDAPI/FD0101/LIST

# With output file
ab -n 1000 -c 10 \
   -H "X-AUTH-TOKEN: $TOKEN" \
   -g load-test-results.tsv \
   http://localhost:8088/FDAPI/FD0101/LIST
```

### Performance Metrics
```bash
# Measure response time
time curl -s -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST > /dev/null

# Multiple endpoints
for api in FDAPI ILAPI PGAPI COMMONAPI; do
  echo "Testing $api..."
  time curl -s -H "X-AUTH-TOKEN: $TOKEN" \
       -H "x-api-key: SpammerGoHome" \
       http://localhost:8088/$api/ > /dev/null
done
```

## Error Testing

### Test Error Handling
```bash
# Invalid token
curl -H "X-AUTH-TOKEN: invalid-token" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST

# Missing token
curl -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST

# Invalid API key
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: wrong-key" \
     http://localhost:8088/FDAPI/FD0101/LIST

# Non-existent endpoint
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/NONEXISTENT/endpoint

# Invalid method (DELETE not allowed by Gateway)
curl -X DELETE \
     -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     http://localhost:8088/FDAPI/FD0101/LIST
```

## CORS Testing

### Test CORS Headers
```bash
# OPTIONS preflight request
curl -X OPTIONS \
     -H "Origin: http://localhost:8100" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-AUTH-TOKEN, x-api-key" \
     -v http://localhost:8088/FDAPI/FD0101/LIST 2>&1 | grep -i "access-control"

# Cross-origin request simulation
curl -H "Origin: http://localhost:8100" \
     -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     -v http://localhost:8088/FDAPI/FD0101/LIST 2>&1 | grep -i "access-control"
```

## Test Checklist

### Pre-Test Verification
- [ ] All services are running (check health endpoints)
- [ ] API Gateway is accessible (port 8088)
- [ ] JWT authentication service is running (port 8801)
- [ ] Test data is prepared

### Test Execution
- [ ] Authentication works (can get JWT token from 8801)
- [ ] JWT authentication working (valid token accepted)
- [ ] Invalid authentication rejected (401/403)
- [ ] API Gateway routing correct (requests reach services via 8088)
- [ ] Service responds within SLA (<200ms p95)
- [ ] Error handling proper (4xx, 5xx responses)
- [ ] Response format correct (JSON structure)
- [ ] CORS headers present (for browser requests)
- [ ] Pagination working (if applicable)
- [ ] Filtering/sorting working (if applicable)

### Post-Test Verification
- [ ] No errors in service logs
- [ ] Performance metrics acceptable
- [ ] Memory usage stable
- [ ] No resource leaks

## Quick Reference Commands

```bash
# Set environment
export GATEWAY=http://localhost:8088
export LOGIN=http://localhost:8801

# Get token
TOKEN=$(curl -s -X POST $LOGIN/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | jq -r '.token')

# Test any API (replace {SERVICE}API and {ENDPOINT})
curl -H "X-AUTH-TOKEN: $TOKEN" \
     -H "x-api-key: SpammerGoHome" \
     $GATEWAY/{SERVICE}API/{ENDPOINT}

# Examples:
# $GATEWAY/FDAPI/FD0101/LIST
# $GATEWAY/ILAPI/IL0501/LIST
# $GATEWAY/PGAPI/PG0203/LIST
# $GATEWAY/COMMONAPI/file/imgView
```

## When to Use This Skill
- After deploying new services
- Testing API Gateway configuration changes
- Verifying authentication flow
- Performance testing
- Integration testing
- Troubleshooting API issues
- CORS debugging

## Related Skills
- **kiips-service-deployer** - Deploy services before testing
- **kiips-log-analyzer** - Analyze API logs and debug issues
- **kiips-maven-builder** - Build services before deployment
- **checklist-generator** - Generate API testing checklists
