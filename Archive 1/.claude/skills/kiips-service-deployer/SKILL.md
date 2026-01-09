---
name: kiips-service-deployer
description: Manages KiiPS microservice deployment (start/stop/restart). Use for service lifecycle management and deployment verification.
---

# KiiPS Service Deployer Skill

## Purpose
Automate deployment and lifecycle management of KiiPS microservices.

## Deployment Commands

### Start Service
```bash
cd KiiPS-ServiceName/
./start.sh

# Verify startup
tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```

### Stop Service
```bash
cd KiiPS-ServiceName/
./stop.sh
```

### Restart Service
```bash
cd KiiPS-ServiceName/
./stop.sh && sleep 2 && ./start.sh
```

## Health Checks

### Service Status
```bash
# API Gateway health
curl http://localhost:8000/health

# Specific service health
curl http://localhost:8601/actuator/health  # FD service
curl http://localhost:8401/actuator/health  # IL service
curl http://localhost:8201/actuator/health  # PG service
curl http://localhost:8701/actuator/health  # COMMON service
curl http://localhost:8801/actuator/health  # Login service
```

### Log Monitoring
```bash
# Real-time logs
tail -f logs/log.$(date "+%Y-%m-%d")-0.log

# Search for errors
grep -i "error\|exception" logs/log.$(date "+%Y-%m-%d")-0.log

# Last 100 lines
tail -100 logs/log.$(date "+%Y-%m-%d")-0.log

# Watch for specific patterns
tail -f logs/log.$(date "+%Y-%m-%d")-0.log | grep --line-buffered "ERROR\|WARN"
```

## Environment-Specific Deployment

### Local Development
```bash
export SPRING_PROFILES_ACTIVE=local
./start.sh
```

### Staging
```bash
export SPRING_PROFILES_ACTIVE=stg
./start.sh
```

### Production
```bash
export SPRING_PROFILES_ACTIVE=kiips
./start.sh
```

## Deployment Checklist

Before deployment:
- [ ] Service built successfully (check target/*.jar)
- [ ] Configuration files updated (app-*.properties)
- [ ] Database migrations applied (if any)
- [ ] Dependencies verified (mvn dependency:tree)
- [ ] Previous version stopped (./stop.sh)

After deployment:
- [ ] New version started (./start.sh)
- [ ] Health check passed (curl actuator/health)
- [ ] Logs show no errors (tail -f logs/...)
- [ ] API Gateway routing verified (curl through gateway)
- [ ] Service responds to test requests

## Port Management

### Standard Ports (Local)
| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8000 | Main entry point |
| UI | 8100 | Web interface |
| Login | 8801 | Authentication |
| Common | 8701 | Shared services |
| FD (펀드) | 8601 | Fund management |
| IL (투자) | 8401 | Investment management |
| PG (프로그램) | 8201 | Program management |

### Check Port Usage
```bash
# Check if port is in use
lsof -i :8601

# Kill process on port
lsof -ti :8601 | xargs kill -9
```

## Troubleshooting

### Service Won't Start
1. Check logs: `tail -f logs/log.$(date "+%Y-%m-%d")-0.log`
2. Verify port is available: `lsof -i :PORT`
3. Check Java version: `java -version` (should be Java 8)
4. Verify application.properties: `cat app-local.properties`

### Service Crashes
1. Check error logs: `grep -i "exception" logs/log.*.log | tail -50`
2. Verify memory settings: Check -Xmx flags in start.sh
3. Check database connectivity
4. Review recent code changes

## When to Use This Skill
- Deploying newly built services
- Restarting services after configuration changes
- Troubleshooting runtime issues
- Switching between environments
- Performing health checks

## Related Skills
- **kiips-maven-builder** - Build services before deployment
- **kiips-api-tester** - Test deployed services and verify endpoints
- **kiips-log-analyzer** - Monitor deployment logs and track errors
- **checklist-generator** - Generate deployment verification checklists
