# ACE Framework - Layer 4.5: Domain Orchestration

**Version**: 1.0.0
**Last Updated**: 2026-01-05
**Status**: Active

---

## Purpose

Layer 4.5 (Domain Orchestration) introduces **Manager Agents** as specialized orchestrators between the Primary Coordinator (Layer 4) and Worker Agents (Layer 6). This layer reduces the Primary's cognitive load while enabling domain-specific workflow optimization through dedicated managers for builds, features, UI, and deployments.

## Architecture Position

```
Layer 1: Aspirational (Ethical Principles)
    ↓
Layer 2: Global Strategy (Mission & Goals)
    ↓
Layer 3: Agent Model (Capabilities & Self-Assessment)
    ↓
Layer 4: Executive Function (Primary Coordinator - Strategic Decomposition)
    ↓
★ Layer 4.5: Domain Orchestration (Manager Agents - Workflow Coordination) ★
    ↓
Layer 5: Cognitive Control (Resource Management, Locks, Checkpoints)
    ↓
Layer 6: Task Prosecution (Worker Agents - Execution)
    ↓
Feedback Loops (Continuous Learning)
```

## Key Concepts

### Manager Agents vs Primary vs Workers

| Role | Layer | Scope | Decision Authority | Example |
|------|-------|-------|-------------------|---------|
| **Primary Coordinator** | Layer 4 | Strategic | High (approvals, integration, shared modules) | Decide whether to build or deploy |
| **Manager Agents** | Layer 4.5 | Domain-specific | Medium (workflow orchestration, worker selection) | Coordinate parallel builds, validation pipelines |
| **Worker Agents** | Layer 6 | Task execution | Low (execute assigned subtasks) | Run Maven command, create JSP file |

### Manager Agent Characteristics

1. **Domain Expertise**: Specialized knowledge (builds, features, UI, deployments)
2. **Workflow Orchestration**: Coordinate sequences of subtasks across multiple workers
3. **Worker Coordination**: Assign, monitor, and aggregate results from workers
4. **Quality Gates**: Enforce checkpoints before phase transitions
5. **Escalation Intelligence**: Know when to escalate to Primary vs handle independently

## 4 Specialized Manager Agents

### 1. Build Manager (`build-manager`)

**Domain**: Maven Multi-Module builds, dependency resolution

**Manages**: `kiips-maven-builder` skill

**Workflow**:
```
Build Request
    ↓
Build Manager analyzes dependencies (COMMON → UTILS → services)
    ↓
Identifies parallel build groups
    ↓
Delegates individual builds to kiips-developer workers
    ↓
Aggregates build results
    ↓
Reports to Primary
```

**Key Value**: 2.6x speedup on multi-service builds via parallelization

### 2. Feature Manager (`feature-manager`)

**Domain**: Feature development lifecycle (requirements → architecture → implementation → QA → integration)

**Manages**: `kiips-feature-planner`, `checklist-generator` skills

**Workflow**:
```
Feature Request
    ↓
Feature Manager breaks down into phases
    ↓
Sequential handoffs: architect → developer → ui-designer → QA
    ↓
Enforces quality checkpoints between phases
    ↓
Maintains dev docs (plan.md, context.md, tasks.md)
    ↓
Requests Primary for final integration
```

**Key Value**: Structured lifecycle, quality gates, dev docs automation

### 3. UI Manager (`ui-manager`)

**Domain**: UI/UX workflows, validation pipelines

**Manages**: `kiips-ui-component-builder`, `kiips-realgrid-builder`, `kiips-responsive-validator`, `kiips-a11y-checker`, `kiips-scss-theme-manager` skills

**Workflow**:
```
UI Request
    ↓
UI Manager plans component implementation
    ↓
Delegates to kiips-ui-designer (JSP, RealGrid, SCSS)
    ↓
Validation pipeline: responsive → accessibility → cross-browser
    ↓
Enforces WCAG 2.1 AA compliance
    ↓
Reports to Primary
```

**Key Value**: Production-ready UI with automated validation pipelines

### 4. Deployment Manager (`deployment-manager`)

**Domain**: Service deployment, health checks, rollback

**Manages**: `kiips-service-deployer`, `kiips-api-tester`, `kiips-log-analyzer` skills

**Workflow**:
```
Deployment Request
    ↓
Deployment Manager creates pipeline (pre-check → stop → start → verify)
    ↓
Coordinates with Primary for service control
    ↓
Parallel verification (health check || log analysis)
    ↓
Automatic rollback on failure
    ↓
Reports to Primary
```

**Key Value**: Automated deployment validation, rollback safety

## Manager Agent Responsibilities

### What Managers Handle (Orchestration)

✅ **Workflow Planning**
- Break domain tasks into subtasks
- Identify parallel groups and dependencies
- Estimate effort and timeline

✅ **Worker Coordination**
- Select appropriate workers for subtasks
- Assign work based on capability and availability
- Monitor worker progress

✅ **Quality Checkpoints**
- Enforce validation before phase transitions
- Handle iterative refinement (feedback loops)
- Validate integration readiness

✅ **Progress Aggregation**
- Collect worker progress updates
- Calculate domain-level completion percentage
- Report consolidated status to Primary

✅ **Failure Handling**
- Retry failed subtasks
- Reassign work to different workers
- Decide when to escalate to Primary

### What Managers Delegate (Execution)

⬇️ **To Worker Agents**:
- Actual tool execution (Maven commands, JSP creation, API calls)
- File reads/writes
- Test execution
- Validation checks

⬇️ **To Primary Coordinator**:
- Shared module modifications (KiiPS-HUB, COMMON, UTILS)
- Service start/stop commands (deployment-manager requests, Primary executes)
- Final integration and merges
- User approval workflows

## Task Routing Decision Tree

```
User Request → Primary Coordinator
    ↓
Primary analyzes task type
    ↓
    ├─ Simple task (≤2 subtasks, low complexity)
    │  └─ Route directly to Worker (Layer 6)
    │
    └─ Complex task (≥3 subtasks, domain-specific)
       └─ Route to Manager (Layer 4.5)
          ↓
          Manager plans workflow
          ↓
          Manager delegates to Workers
          ↓
          Manager aggregates results
          ↓
          Manager reports to Primary
```

**Routing Logic**:
- **Build tasks** (`service_build`, `multi_service_build`) → Build Manager
- **Feature tasks** (`feature_development`) → Feature Manager
- **UI tasks** (`ui_component_creation`, `ui_validation`) → UI Manager
- **Deployment tasks** (`service_deploy`) → Deployment Manager

## Domain Lock Management

Managers use **domain-level locks** to prevent concurrent orchestrations in the same domain:

```javascript
// Build Manager acquires "build" domain lock
acquireManagerLock('build-manager', 'build')
```

**Lock Hierarchy**:
1. **Primary-Only Locks**: Shared modules (KiiPS-HUB, COMMON, UTILS)
2. **Manager Domain Locks**: Prevent concurrent managers in same domain
3. **Worker Module Locks**: Business services (FD, IL, PG, etc.)

**Example**:
- Build Manager holds "build" lock → No other Manager can orchestrate builds
- But individual workers can still build services in parallel (different module locks)

## Escalation Patterns

### When Managers Escalate to Primary

Managers escalate when they encounter situations beyond their authority:

1. **Resource Conflicts**
   - Shared modules need modification (primaryOnly: true)
   - All workers busy or unavailable
   - Domain lock held by another Manager

2. **Critical Failures**
   - Multiple consecutive failures (≥3)
   - Cascading failures across services
   - Unrecoverable errors (OutOfMemoryError, database down)

3. **Architectural Decisions**
   - New framework/library required
   - Pattern conflicts with existing architecture
   - Security or compliance concerns

4. **User Approvals**
   - Multiple valid design approaches
   - Trade-offs require user decision
   - Scope or timeline changes

### Escalation Protocol

```javascript
escalateToPrimary({
  managerId: 'build-manager',
  reason: 'shared_module_modification_required',
  context: {
    task: 'multi_service_build',
    module: 'KiiPS-COMMON',
    change: 'Add new SharedService method'
  },
  recommendation: 'Allow Primary to modify KiiPS-COMMON, then retry builds'
})
```

**Primary's Response Options**:
1. **Handle and Return**: Primary handles escalation, returns control to Manager
2. **Take Over**: Primary takes full control of task
3. **Request User Input**: Primary asks user for guidance

## Communication Protocols

### Manager ↔ Primary

**Manager Receives from Primary**:
- Task assignments with domain classification
- Resource availability updates
- Approval/rejection decisions
- Escalation responses

**Manager Sends to Primary**:
- Workflow execution plans (for informational purposes)
- Progress updates (aggregated from workers)
- Escalation requests
- Completion reports

### Manager ↔ Workers

**Manager Sends to Workers**:
- Subtask assignments with clear requirements
- Retry requests (on failure)
- Cancellation signals (on timeout/escalation)

**Manager Receives from Workers**:
- Progress updates (0-100%)
- Success/failure reports
- Intermediate results
- Error details

### Manager ↔ Manager (Rare)

Managers typically don't communicate directly, but exceptions exist:

**Example**: UI Manager needs backend API → Coordinates with Deployment Manager to verify service running

**Protocol**: Manager-to-Manager requests go through Primary for visibility

## Progress Tracking

Managers track progress at two levels:

### Worker-Level Progress
```javascript
workerProgress = {
  'worker-1': { task: 'Build KiiPS-FD', progress: 75, status: 'in_progress' },
  'worker-2': { task: 'Build KiiPS-IL', progress: 100, status: 'completed' },
  'worker-3': { task: 'Build KiiPS-PG', progress: 40, status: 'in_progress' }
}
```

### Manager-Level Progress (Aggregated)
```javascript
managerProgress = {
  managerId: 'build-manager',
  task: 'multi_service_build',
  overallProgress: 72, // weighted average of workers
  workersActive: 2,
  workersCompleted: 1,
  estimatedTimeRemaining: 120 // seconds
}
```

**Reporting Frequency**: Managers report to Primary every 30 seconds or on status change

## Resource Allocation

### Token Budget Distribution

**Before (with only Primary)**:
- Primary Coordinator: 40%
- Secondary Agents: 60%

**After (with Manager layer)**:
- Primary Coordinator: 30% (-10%, less cognitive load)
- Build Manager: 10%
- Feature Manager: 12%
- UI Manager: 10%
- Deployment Manager: 8%
- Worker Agents: 30%

**Total**: 100% (Managers absorb coordination overhead previously in Primary)

## Quality Assurance

### Manager-Enforced Checkpoints

Each Manager enforces domain-specific quality checkpoints:

**Build Manager**:
- ✓ Dependency resolution correct (COMMON → UTILS → services)
- ✓ Build artifacts generated (JAR/WAR files present)
- ✓ No build warnings or errors

**Feature Manager**:
- ✓ Design approval before implementation
- ✓ Code review passed before testing
- ✓ Tests passed before integration

**UI Manager**:
- ✓ Responsive design validated (all breakpoints)
- ✓ Accessibility compliance (WCAG 2.1 AA)
- ✓ Cross-browser compatibility checked

**Deployment Manager**:
- ✓ Pre-deployment checks (artifacts, configs)
- ✓ Health checks passed (service responsive)
- ✓ No critical errors in logs

## Metrics & Telemetry

Layer 4.5 tracks Manager-specific metrics:

- **Manager Utilization**: % time Managers active vs idle
- **Task Routing Accuracy**: % tasks correctly routed to Managers
- **Escalation Rate**: % tasks requiring Primary escalation
- **Worker Coordination Efficiency**: Average workers per Manager task
- **Domain-Level Performance**: Build time, feature cycle time, deployment time

**Target Metrics**:
- Manager utilization: 50-70% (balanced load)
- Routing accuracy: ≥90%
- Escalation rate: <15% (Managers handle most domain tasks)
- Worker coordination: 2-5 workers per Manager task

## Configuration

**Feature Flags** (in `ace-config.json`):
```json
"featureFlags": {
  "enableManagerAgents": true,
  "managerRoutingMode": "domain-first"
}
```

**Modes**:
- **domain-first** (default): Route to Managers first, fallback to Workers
- **fallback-only**: Route to Workers first, use Managers only if Workers fail
- **disabled**: Route directly to Workers (bypass Layer 4.5)

## Backward Compatibility

### Graceful Degradation

If Manager layer fails or is disabled:
1. Primary routes tasks directly to Workers (Layer 6)
2. Existing Secondary Agents continue to function
3. No impact on user experience (slightly higher Primary load)

### Rollback Procedure

1. **Immediate**: Set `enableManagerAgents: false` in `ace-config.json`
2. **Short-term**: Revert coordination script changes
3. **Long-term**: Remove Manager definitions and Layer 4.5 files

## Success Criteria

Layer 4.5 is successful if:

✅ Primary Coordinator's task load reduced by ≥10%
✅ Build time reduced by ≥50% via parallel coordination (multi-service builds)
✅ Feature development cycle time reduced by ≥20%
✅ UI validation automation rate ≥90% (responsive + accessibility)
✅ Deployment success rate ≥95% with automatic rollback
✅ Manager escalation rate <15% (domain autonomy)
✅ Overall system throughput increased by ≥30%

---

**Related Documents**:
- `../agents/managers/build-manager.md`
- `../agents/managers/feature-manager.md`
- `../agents/managers/ui-manager.md`
- `../agents/managers/deployment-manager.md`
- `ace-config.json` (Manager configuration)
- `layer3-agent-model.json` (Manager capabilities)

**Coordination Scripts**:
- `../coordination/task-allocator.js` (Manager routing logic)
- `../coordination/manager-coordinator.js` (Manager utilities)
- `../coordination/file-lock-manager.js` (Domain locks)
