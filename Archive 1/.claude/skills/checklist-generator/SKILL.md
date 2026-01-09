---
name: checklist-generator
description: Generate structured verification checklists for code review, deployment, and testing. Automatically creates TodoWrite-compatible task lists.
---

# Checklist Generator Skill

## Purpose
Automatically generate context-aware verification checklists for KiiPS development workflows, ensuring consistent quality gates across all phases of development.

## Checklist Types

### 1. Code Review Checklist
Essential verification steps before code review or PR submission:

- [ ] **Build Verification**: `cd KiiPS-HUB && mvn clean package -pl :ServiceName -am`
- [ ] **Service Starts**: No errors in startup logs
- [ ] **API Endpoints**: All endpoints respond correctly
- [ ] **Error Handling**: Appropriate exception handling implemented
- [ ] **Security Validation**: SQL injection, XSS vulnerabilities checked
- [ ] **Code Conventions**: Follows KiiPS naming and structure patterns
- [ ] **Dependencies**: All dependencies declared in pom.xml
- [ ] **SVN Commit**: Descriptive commit message prepared

### 2. Deployment Checklist
Critical steps for safe service deployment:

- [ ] **SVN Update**: `svn up` completed, no conflicts
- [ ] **Build Success**: `mvn clean package -am` from KiiPS-HUB
- [ ] **Configuration**: Environment-specific properties verified (`app-{env}.properties`)
- [ ] **API Gateway Routes**: Routes configured and tested
- [ ] **Service Dependencies**: Required services running (COMMON, Login, etc.)
- [ ] **Port Availability**: Target port not in use (`lsof -ti:PORT`)
- [ ] **Health Check**: Endpoint responds after deployment
- [ ] **Logs Clean**: No ERROR/WARN messages in startup
- [ ] **Rollback Plan**: Previous version artifacts available

### 3. Testing Checklist
Comprehensive testing validation:

- [ ] **Manual API Testing**: Core endpoints tested with curl/Postman
- [ ] **UI Functionality**: All UI features work as expected
- [ ] **Error Scenarios**: Invalid inputs handled gracefully
- [ ] **Cross-Service Communication**: Service-to-service calls verified
- [ ] **Performance**: Response times acceptable
- [ ] **Gateway Integration**: Requests through port 8000 succeed

## KiiPS-Specific Checklists

### Maven Build Checklist
Specialized checklist for KiiPS multi-module builds:

```markdown
**Maven Build Verification**
- [ ] Currently in KiiPS-HUB directory (`pwd`)
- [ ] Using `-am` flag for dependency resolution
- [ ] KiiPS-COMMON up-to-date (latest SVN revision)
- [ ] KiiPS-UTILS up-to-date (latest SVN revision)
- [ ] Java 8 active (`java -version` shows 1.8.x)
- [ ] Build artifacts created in target/ directory
- [ ] No compilation errors in output
- [ ] All modules built successfully
```

### Service Deployment Checklist
KiiPS microservice deployment verification:

```markdown
**Service Deployment Verification**
- [ ] Service port not in use (check with `lsof -ti:PORT`)
- [ ] Environment profile correct (local/stg/kiips)
- [ ] Database connectivity verified (if applicable)
- [ ] Service-to-Service auth configured (x-api-key header)
- [ ] JWT validation working (if using authentication)
- [ ] Actuator health endpoint accessible
- [ ] Logs directory writable
- [ ] No port conflicts with other services
```

### API Gateway Integration Checklist
Ensuring proper Gateway routing:

```markdown
**API Gateway Integration**
- [ ] Route defined in KIIPS-APIGateway/application.yml
- [ ] Predicate path matches controller @RequestMapping
- [ ] CORS settings correct (if needed)
- [ ] Headers forwarded properly (X-AUTH-TOKEN, logostoken)
- [ ] Timeouts configured appropriately
- [ ] Load balancing configured (if multiple instances)
- [ ] Gateway restart completed after route changes
```

## Usage Examples

### Example 1: Generate Code Review Checklist

**Context**: Implementing new fund search endpoint in KiiPS-FD

**Generated Checklist**:
```markdown
## Code Review Checklist - Fund Search Endpoint

### Build & Startup
- [ ] Build: `cd KiiPS-HUB && mvn clean package -pl :KiiPS-FD -am`
- [ ] Service starts: `cd KiiPS-FD && ./start.sh`
- [ ] Logs clean: `tail -f logs/log.$(date +%Y-%m-%d)-0.log | grep -i error`

### API Testing
- [ ] Direct call: `curl http://localhost:8601/api/funds/search?keyword=test`
- [ ] Gateway call: `curl http://localhost:8000/api/funds/search?keyword=test -H "X-AUTH-TOKEN: token"`
- [ ] Error handling: Test with invalid parameters

### Code Quality
- [ ] Service class follows naming pattern (FundService)
- [ ] DAO injection uses KiiPS-UTILS patterns
- [ ] Exception handling implemented
- [ ] Logging added for debugging

### Documentation
- [ ] API endpoint documented in api.md
- [ ] SVN commit: `svn commit -m "Add fund search endpoint with keyword filtering"`
```

### Example 2: Generate Deployment Checklist

**Context**: Deploying KiiPS-IL service to staging environment

**Generated Checklist**:
```markdown
## Deployment Checklist - KiiPS-IL Staging

### Pre-Deployment
- [ ] SVN update: `cd KiiPS-IL && svn up`
- [ ] Build: `cd ../KiiPS-HUB && mvn clean package -pl :KiiPS-IL -am`
- [ ] Config check: Verify `app-stg.properties` settings
- [ ] Dependencies: Ensure COMMON (8701), Login (8801) running

### Deployment
- [ ] Stop service: `cd KiiPS-IL && ./stop.sh`
- [ ] Port check: `lsof -ti:8401` (should be empty)
- [ ] Start service: `./start.sh`
- [ ] Wait: 10 seconds for initialization

### Post-Deployment Verification
- [ ] Health check: `curl http://localhost:8401/actuator/health`
- [ ] Log check: `tail -f logs/log.$(date +%Y-%m-%d)-0.log`
- [ ] Gateway test: `curl http://localhost:8000/api/investments/list -H "X-AUTH-TOKEN: token"`
- [ ] No errors: `grep ERROR logs/log.$(date +%Y-%m-%d)-0.log` (empty result)

### Rollback Plan
- [ ] Previous JAR backup: `KiiPS-IL/target/KiiPS-IL-backup.jar`
- [ ] Rollback command: `./stop.sh && cp target/KiiPS-IL-backup.jar target/KiiPS-IL.jar && ./start.sh`
```

### Example 3: Generate Testing Checklist

**Context**: Testing new payment processing feature in KiiPS-FD

**Generated Checklist**:
```markdown
## Testing Checklist - Payment Processing

### API Testing
- [ ] Create payment: `curl -X POST http://localhost:8000/api/funds/payment -d '{"amount":1000}' -H "Content-Type: application/json"`
- [ ] Get payment status: `curl http://localhost:8000/api/funds/payment/{id}`
- [ ] List payments: `curl http://localhost:8000/api/funds/payments`
- [ ] Cancel payment: `curl -X DELETE http://localhost:8000/api/funds/payment/{id}`

### Error Scenarios
- [ ] Invalid amount (negative): Should return 400 Bad Request
- [ ] Missing auth token: Should return 401 Unauthorized
- [ ] Non-existent payment ID: Should return 404 Not Found
- [ ] Duplicate payment: Should handle gracefully

### UI Testing (if applicable)
- [ ] Payment form validation works
- [ ] Payment list displays correctly
- [ ] Status updates in real-time
- [ ] Error messages user-friendly

### Integration Testing
- [ ] KiiPS-FD → KiiPS-COMMON (logging)
- [ ] KiiPS-FD → KiiPS-Login (auth validation)
- [ ] Database transactions commit properly
- [ ] Rollback on errors works

### Performance
- [ ] Single payment < 500ms response time
- [ ] List 100 payments < 1s response time
- [ ] Concurrent requests handled (10 users)
```

## TodoWrite Integration

Generate checklists and automatically add to TodoWrite for task tracking:

```javascript
// Example: Convert checklist to TodoWrite format
const deploymentChecklist = [
  { content: "SVN update completed", status: "pending", activeForm: "Updating SVN" },
  { content: "Build from KiiPS-HUB", status: "pending", activeForm: "Building from KiiPS-HUB" },
  { content: "Service deployed successfully", status: "pending", activeForm: "Deploying service" },
  { content: "Health check passed", status: "pending", activeForm: "Checking health endpoint" },
  { content: "Gateway integration verified", status: "pending", activeForm: "Verifying gateway" }
];

// Use TodoWrite tool with this checklist
```

**Integration Pattern**:
1. Generate contextual checklist based on task
2. Convert to TodoWrite JSON format
3. Track progress automatically
4. Mark items complete as you go

## Progressive Disclosure

### Quick Start (30 seconds)
Generate a simple checklist for common tasks:
- Code Review: Use Code Review Checklist template
- Deployment: Use Deployment Checklist template
- Testing: Use Testing Checklist template

### Intermediate (5 minutes)
Customize checklists for your specific context:
- Add KiiPS-specific service names and ports
- Include environment-specific configurations
- Add project-specific quality gates

### Advanced (15+ minutes)
Create comprehensive, automated workflows:
- TodoWrite integration for progress tracking
- Custom checklist templates for your team
- Integration with ACE Framework checkpoints
- Automated validation scripts

## Related Skills

- **kiips-maven-builder** - Build verification steps (Maven commands, dependency checks)
- **kiips-service-deployer** - Deployment verification (service lifecycle, health checks)
- **kiips-api-tester** - API testing validation (endpoint testing, JWT tokens)
- **kiips-log-analyzer** - Log verification (error detection, performance analysis)
- **kiips-feature-planner** - Integration with feature planning (phase gates, quality criteria)

## When to Use

Use this skill when:
- **Before code review** or pull request submission
- **Before deploying** to staging or production environments
- **When implementing** new features (ensures nothing is forgotten)
- **After major code changes** (comprehensive validation)
- **For training** new team members (standardized processes)
- **Creating documentation** for processes and procedures

## When NOT to Use

Skip this skill for:
- **Simple typo fixes** (no verification needed)
- **Documentation-only changes** (unless deployment documentation)
- **Configuration tweaks** (unless deployment-related)
- **Read-only operations** (viewing logs, reading code)
- **Exploratory work** (research, proof-of-concepts)

## Best Practices

1. **Always customize** - Don't use generic checklists; adapt to your specific context
2. **Update regularly** - As processes evolve, update checklist templates
3. **Use TodoWrite** - Track progress automatically for visibility
4. **Share checklists** - Document team processes in dev/checklists/
5. **Automate verification** - Where possible, create scripts to validate checklist items
6. **Quality gates** - Don't skip items; they prevent production issues

## Checklist Template Library

Store reusable templates in `dev/checklists/`:

```
dev/checklists/
├── code-review-template.md
├── deployment-template.md
├── testing-template.md
├── hotfix-template.md
├── db-migration-template.md
└── security-audit-template.md
```

Each template should be version-controlled and team-reviewed for consistency.

---

**Version**: 1.0.0
**Last Updated**: 2026-01-04
**Maintainer**: KiiPS Development Team
