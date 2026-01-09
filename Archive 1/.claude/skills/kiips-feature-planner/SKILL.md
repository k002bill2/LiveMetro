---
name: kiips-feature-planner
description: Creates practical feature plans for KiiPS microservices. Use when planning new features, organizing development work, or structuring implementation strategy. Optimized for KiiPS Maven Multi-Module architecture.
---

# KiiPS Feature Planner Skill

## Purpose
Generate structured, phase-based implementation plans for KiiPS microservice features with realistic quality gates and progress tracking.

## Planning Principles
1. **Practical over Perfect** - Focus on deployable functionality, not test coverage
2. **Phase-based Delivery** - Each phase (1-3 hours) delivers working features
3. **Quality Gates** - Simple validation before proceeding to next phase
4. **Documentation** - Track progress in markdown with checkboxes

## Planning Workflow

### Step 1: Requirements Analysis
Before creating a plan:
```bash
# Understand existing codebase
# Use Read tool to examine:
# - Service structure: src/main/java/com/kiips/{domain}/
# - Dependencies: Check pom.xml
# - API patterns: Look at existing controllers
# - Data access: Review DAO implementations
```

**Questions to Answer**:
- Which service(s) will be modified? (FD, IL, PG, etc.)
- What dependencies are needed? (COMMON, UTILS, Login)
- Does this require API Gateway routing changes?
- Will this impact the UI? (KiiPS-UI JSP pages)

### Step 2: Feature Breakdown
Break feature into **3-5 phases** where each phase:
- Delivers complete, deployable functionality
- Takes 1-3 hours maximum
- Has clear success criteria
- Can be tested manually
- Has rollback strategy

**Typical Phase Structure**:
1. **Phase 1**: Core business logic (Service layer)
2. **Phase 2**: API endpoint (Controller layer)
3. **Phase 3**: API Gateway integration
4. **Phase 4**: UI integration (if needed)
5. **Phase 5**: Error handling & refinement (optional)

### Step 3: Plan Document Creation
Generate plan using template: `docs/plans/PLAN_<feature-name>.md`

**Include**:
- Feature overview and objectives
- Affected services and dependencies
- Phase breakdown with checkboxes
- Quality gate per phase (build, start, manual test)
- SVN workflow steps
- Rollback strategy

### Step 4: User Approval
**CRITICAL**: Ask user to confirm plan before proceeding.

Use AskUserQuestion:
- "Does this phase breakdown make sense?"
- "Any concerns about the approach?"
- "Should I create the plan document and start implementation?"

### Step 5: Document Generation
```bash
# Create plans directory if needed
mkdir -p docs/plans/

# Generate plan document
# Use plan-template-kiips.md as template
# File name: docs/plans/PLAN_<feature-name>.md
```

## Quality Gate Standards

Each phase validates these items **before proceeding**:

### Build Verification
```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am
```
- [ ] Build completes without compilation errors
- [ ] No dependency resolution failures
- [ ] Artifacts created in target/ directory

### Deployment Check
```bash
cd ../KiiPS-ServiceName/
./start.sh

# Monitor logs
tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```
- [ ] Service starts without exceptions
- [ ] Spring context loads successfully
- [ ] No critical errors in logs

### Functionality Test
- [ ] Manual testing confirms feature works
- [ ] Postman/curl API tests pass (if applicable)
- [ ] No regression in existing functionality

### Code Quality (Optional)
- [ ] Code follows project conventions
- [ ] No obvious security issues (SQL injection, XSS)
- [ ] Error handling implemented
- [ ] Logging added for debugging

## Phase Sizing Guidelines

**Small Feature** (2-3 phases, 3-6 hours):
- Single endpoint addition
- Simple CRUD operation
- Configuration change
- Example: "Add fund search filter", "New report export"

**Medium Feature** (3-4 phases, 6-12 hours):
- Multiple endpoints
- Database schema changes
- API Gateway routing updates
- Example: "Investment approval workflow", "User notification system"

**Large Feature** (4-5 phases, 12-20 hours):
- Cross-service integration
- Major business logic changes
- UI and API work
- Example: "LP portal integration", "New fund lifecycle management"

## SVN Workflow Integration

### Before Starting
```bash
cd KiiPS-ServiceName/
svn up
svn status  # Should be clean
```

### After Each Phase
```bash
# Review changes
svn status
svn diff | less

# Commit with descriptive message
svn commit -m "Phase X: [Description of what was completed]"
```

### Rollback Strategy
```bash
# Revert uncommitted changes
svn revert -R .

# Revert to specific revision
svn update -r <previous-revision>
```

## KiiPS-Specific Considerations

### Multi-Module Dependencies
Always build from KiiPS-HUB with `-am` flag:
```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am
```

### Service Communication
If calling other services, use `Common_API_Service`:
```java
@Autowired
private Common_API_Service commonApiService;

String url = "http://localhost:8701/api/...";
Result result = commonApiService.get(url, Result.class, headers);
```

### API Gateway Routing
Update KIIPS-APIGateway/src/main/resources/application.yml:
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: your-service-route
          uri: http://localhost:8xxx
          predicates:
            - Path=/api/your-endpoint/**
```

### Error Handling
- **Global**: Handled by KiiPS-COMMON `GlobalExceptionHandler`
- **Slack Alerts**: Automatic via `ErrorNotificationService`
- **Custom**: Throw business exceptions in Service layer

### UI Integration (KiiPS-UI)
- **Views**: JSP in `src/main/resources/templates/`
- **JavaScript**: jQuery + AJAX
- **Grids**: RealGrid 2.8.8 (주력, 라이선스 필요), DataTables (보조)
- **Charts**: ApexCharts (주력), AnyChart (보조)
- **Security**: Lucy XSS filter automatically applied

## Testing Strategy (Optional)

**Current State**: Tests are skipped (`<skipTests>true</skipTests>`)

**If You Want to Add Tests** (Future improvement):
```xml
<!-- Add to pom.xml if needed -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <scope>test</scope>
</dependency>
```

**Test Types to Consider**:
- **Unit Tests**: Service layer business logic
- **Integration Tests**: DAO database operations
- **Controller Tests**: MockMvc for endpoints

**Enable Tests**:
```bash
# Run tests
mvn test -pl :KiiPS-ServiceName

# With coverage (requires JaCoCo plugin)
mvn test jacoco:report -pl :KiiPS-ServiceName
```

## Progress Tracking

Add to plan document header:
```markdown
**Progress Tracking Protocol**:
1. ✅ Check off completed task checkboxes
2. 🔧 Run quality gate validation (build + start)
3. ✋ Verify all checks pass before next phase
4. 📅 Update "Last Updated" date
5. 📝 Document issues in Notes section
6. ➡️ Only then proceed to next phase

⛔ DO NOT skip quality gates or proceed with failing builds
```

## When to Use This Skill

- Planning new feature implementation
- Breaking down complex requirements
- Organizing multi-phase development work
- Need structured approach with quality gates
- Want progress tracking documentation
- Preparing for code review or demo

## Troubleshooting

### Build Fails During Quality Gate
1. Verify you're in KiiPS-HUB: `pwd`
2. Check `-am` flag is used
3. Build dependencies first:
   ```bash
   mvn clean install -pl :KiiPS-COMMON -am
   mvn clean install -pl :KiiPS-UTILS -am
   ```
4. Check Java version: `java -version` (should be Java 8)

### Service Won't Start After Phase
1. Check logs: `tail -f logs/log.$(date "+%Y-%m-%d")-0.log`
2. Verify port not in use: `lsof -i :8xxx`
3. Review application.properties configuration
4. Check dependent services are running (Login, COMMON)

### Phase Takes Longer Than Estimated
1. Document reason in plan Notes section
2. Consider breaking into sub-phases
3. Update estimated hours for learning
4. Don't skip quality gates to save time

## Important Notes

- **Maven First**: Always build from KiiPS-HUB, never from service directories
- **Tests Optional**: Current setup skips tests - focus on manual verification
- **SVN Commits**: Commit after each phase for clean rollback points
- **Quality Gates**: Simple but mandatory - build, start, manual test
- **Practical Focus**: Working software over comprehensive testing
- **Documentation**: Plans help onboarding and knowledge transfer

## Example Usage

**User**: "I need to add a new fund search API with filters"

**Planner Response**:
1. Analyze requirements (which filters, response format, performance needs)
2. Break into phases:
   - Phase 1: Service layer with search logic (2 hours)
   - Phase 2: Controller endpoint (1 hour)
   - Phase 3: API Gateway routing (1 hour)
   - Phase 4: UI integration (2 hours, optional)
3. Create plan document: `docs/plans/PLAN_fund-search-api.md`
4. Get user approval
5. Track progress with checkboxes

## Supporting Files
- [plan-template-kiips.md](plan-template-kiips.md) - Feature plan template

## Related Skills
- **kiips-maven-builder** - Build planned features and verify dependencies
- **kiips-service-deployer** - Deploy implemented features to environments
- **kiips-api-tester** - Test feature APIs and validate functionality
- **kiips-log-analyzer** - Monitor feature performance and track issues
- **checklist-generator** - Generate feature development checklists and quality gates
