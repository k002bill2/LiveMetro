# Parallel Agents Execution Guide

Quick reference for using multi-agent parallel execution in LiveMetro development.

---

## Quick Start

```bash
# 1. Identify parallelizable work
Feature: "Add favorites feature with UI + API + Tests"
✅ 3 independent subtasks → Good candidate

# 2. Invoke coordinator skill
Skill parallel-coordinator

# 3. Primary Agent decomposes and coordinates
# Agents work in .temp/agent_workspaces/

# 4. Validate and merge
npm run type-check && npm run lint && npm test
```

---

## When to Use Parallel Agents

### ✅ **Use When:**
- 3+ independent subtasks
- Different file types (screens + services + tests)
- Multi-layer feature (UI + API + DB + tests)
- Performance optimization across multiple files
- Research + implementation can happen simultaneously

### ❌ **Don't Use When:**
- Sequential dependencies (B needs A's output)
- Same file modifications
- Single, focused task (one component, one function)
- Exploratory work (code reading, investigation)
- Simple refactoring (rename, move)

---

## Agent Capabilities Matrix

| Agent | Best For | Strengths | Avoid Assigning |
|-------|----------|-----------|-----------------|
| **mobile-ui-specialist** | Screens, Components, UI/UX | React Native (0.95), TypeScript (0.90), Mobile UX (0.85) | Native modules, Backend logic, API design |
| **backend-integration-specialist** | Services, API, Firebase, Hooks | Firebase (0.95), Seoul API (0.90), Data sync (0.90) | UI design, Animations, Visual styling |
| **performance-optimizer** | Profiling, Optimization, Bundle analysis | React optimization (0.90), Memory leak detection (0.85) | New features, UI implementation |
| **test-automation-specialist** | Jest tests, Coverage analysis, Mocks | Jest (0.95), RTL (0.90), Coverage (0.90) | Feature implementation, Architecture design |

---

## Coordination Patterns

### Pattern 1: Fan-Out / Fan-In
**Best for**: Independent parallel work, then combine

```
Primary (1)
  ↓ Distribute
API Agent │ UI Agent │ Test Agent (3 parallel)
  ↓ Collect
Primary (1) → Integration
```

**Example**: Real-time train arrival feature
- API agent: Seoul API client
- UI agent: StationDetailScreen
- Test agent: Test coverage
- Primary: Integrates all + validation

**Speedup**: ~3x

### Pattern 2: Pipeline
**Best for**: Sequential stages with parallel substeps

```
Stage 1: Data layer (parallel) → Validate
Stage 2: UI layer (parallel) → Validate
Stage 3: Integration (Primary)
```

**Example**: Add notification feature
- Stage 1: Backend agent (FCM setup) + Test agent (mock setup)
- Stage 2: UI agent (settings screen) + Test agent (UI tests)
- Stage 3: Primary integrates

**Speedup**: ~2x

### Pattern 3: Hierarchical
**Best for**: Complex features with sub-features

```
Primary
├─ UI Agent (Component A)
│  ├─ Sub-task A1
│  └─ Sub-task A2
└─ Backend Agent (Service B)
   ├─ Sub-task B1
   └─ Sub-task B2
```

**Example**: Multi-screen feature flow
- UI agent: Multiple related screens
- Backend agent: Multiple related services
- Primary: Navigation + integration

**Speedup**: ~2x + better organization

---

## Step-by-Step: First Parallel Feature

### Example: Add "Favorite Stations" Feature

**Step 1: Invoke Coordinator**
```
Primary: Skill parallel-coordinator
```

**Step 2: Task Decomposition (ACE Layer 4)**
```json
{
  "task": "Add favorite stations feature",
  "subtasks": [
    {
      "agent": "backend-integration-specialist",
      "task": "Firebase favorites service",
      "output": "src/services/favorites/favoritesService.ts",
      "time": "15 min"
    },
    {
      "agent": "mobile-ui-specialist",
      "task": "Star icon in StationCard",
      "output": "src/components/train/StationCard.tsx",
      "dependencies": ["backend-integration-specialist"],
      "time": "10 min"
    },
    {
      "agent": "test-automation-specialist",
      "task": "Test coverage",
      "output": "__tests__/favoritesService.test.ts",
      "dependencies": ["backend-integration-specialist"],
      "time": "15 min"
    }
  ]
}
```

**Step 3: Parallel Execution**
```
T0:00 - backend-integration starts Firebase service
T0:15 - backend-integration completes → types available
T0:16 - mobile-ui starts (consumes types)
T0:16 - test-automation starts (can work in parallel)
T0:26 - mobile-ui completes
T0:31 - test-automation completes
```

**Step 4: Integration (ACE Layer 4)**
```
Primary reviews:
- .temp/agent_workspaces/backend-integration/proposals/favoritesService.ts
- .temp/agent_workspaces/mobile-ui/proposals/StationCard.tsx
- .temp/agent_workspaces/test-automation/proposals/favoritesService.test.ts

Primary integrates to src/
```

**Step 5: Validation (ACE Layer 5)**
```bash
npm run type-check  # ✅ Pass
npm run lint        # ✅ Pass
npm test           # ✅ Pass, coverage 78%
```

**Result**: Feature completed in 31 minutes (vs ~50 minutes sequential) = **1.6x speedup**

---

## Troubleshooting

### Issue: Agent Declined Task

**Symptom**:
```
mobile-ui-specialist: ❌ DECLINE
Reason: Task requires native module development (capability: 0.30)
```

**Solution**:
1. Primary Agent reassigns to appropriate specialist
2. OR simplifies task (use Expo API instead of native module)
3. OR converts to sequential execution with Primary handling

**Prevention**: Match tasks to agent strengths using capabilities matrix

---

### Issue: Deadlock Detected

**Symptom**:
```
ERROR: Circular wait detected
- Agent A waiting for types from Agent B
- Agent B waiting for types from Agent A
```

**Solution**:
1. Primary Agent aborts youngest lock
2. Re-sequences tasks: Agent A completes first
3. Agent B consumes Agent A's types

**Prevention**: Define clear dependencies in task decomposition

---

### Issue: Merge Conflict

**Symptom**:
```
Both agents modified: src/services/data/dataManager.ts
Overlapping changes in lines 45-60
```

**Solution**:
```
1. Primary reviews both versions:
   - .temp/integration/conflicts/dataManager_agent-a.ts
   - .temp/integration/conflicts/dataManager_agent-b.ts

2. Options:
   A) Accept Agent A's version (discard B)
   B) Accept Agent B's version (discard A)
   C) Manual merge (combine both)
   D) Request refinement from both agents

3. Re-run validation gates
```

**Prevention**: Better task decomposition (split file into separate concerns)

---

### Issue: Quality Gate Failure

**Symptom**:
```
npm test -- --coverage
FAIL: Coverage 68% (target: 75%)
Missing coverage in src/services/favorites/favoritesService.ts
```

**Solution**:
```
1. Primary identifies gap
2. Assigns test-automation-specialist:
   "Write tests for favoritesService.ts lines 20-35"
3. Re-run validation
```

**Prevention**: Always assign test-automation-specialist in initial decomposition

---

### Issue: Agent Blocked (Waiting for Dependency)

**Symptom**:
```
T3:00 - mobile-ui-specialist: Blocked
Waiting for backend-integration-specialist to export types
```

**Solution (Dynamic Reallocation)**:
```
1. Primary detects blockage
2. Reassigns mobile-ui to different subtask:
   "Create UI mockups while waiting"
3. When types available, mobile-ui returns to original task
```

**Prevention**: Define clear dependency order in task decomposition

---

## Emergency Abort

**When to Abort**:
- Ethical constraint violation (privacy, data integrity)
- Data corruption detected
- Critical tool failure
- User cancellation

**Procedure**:
```bash
# 1. Primary broadcasts abort to all agents
echo "ABORT" > .temp/coordination/status/abort_signal

# 2. All agents freeze and release locks
rm -f .temp/coordination/locks/*

# 3. Rollback to last checkpoint
cp -r .temp/integration/checkpoints/last_valid/* src/

# 4. Notify user
echo "Execution aborted. Rolled back to last valid state."
```

---

## Performance Tips

### Maximize Parallelization
- **✅ Do**: Assign independent tasks to different agents
- **❌ Don't**: Create artificial dependencies

**Example**:
```
# ❌ Bad: Sequential dependencies
Task A → Task B → Task C
Time: 45 min

# ✅ Good: Parallel where possible
Task A │ Task B (parallel, no dependency on A)
   ↓
Task C (depends on both)
Time: 30 min
```

### Minimize Coordination Overhead
- Keep task boundaries clear
- Avoid frequent inter-agent communication
- Batch status updates (every 30s, not every 5s)

### Optimal Team Size
- **2-3 agents**: Ideal (1.6-2.0x speedup)
- **4+ agents**: Diminishing returns (coordination overhead)
- **1 agent**: Use single-agent workflow instead

---

## ACE Framework Quick Reference

| Layer | Purpose | Key Action |
|-------|---------|------------|
| **Layer 1: Aspirational** | Ethics | Check privacy, API limits, stability |
| **Layer 2: Global Strategy** | Mission | Define success criteria, constraints |
| **Layer 3: Agent Model** | Self-assess | Match capabilities to tasks |
| **Layer 4: Executive Function** | Coordinate | Decompose, assign, integrate |
| **Layer 5: Cognitive Control** | Prevent conflicts | Manage file locks, detect deadlocks |
| **Layer 6: Task Prosecution** | Execute | Invoke skills, use tools, write code |

---

## Common Commands

```bash
# Check parallel execution status
ls -la .temp/coordination/status/

# View agent proposals
ls -la .temp/agent_workspaces/*/proposals/

# Check file locks
ls -la .temp/coordination/locks/

# View task assignments
cat .temp/coordination/tasks/*.json

# Validate quality
npm run type-check && npm run lint && npm test -- --coverage
```

---

## Further Reading

- **DEVELOPMENT.md**: Comprehensive development guide with ACE Framework details
- **Parallel Agents Safety Protocol v3.0.1**: Full ACE Framework documentation
- **CLAUDE.md**: Project architecture and patterns
- **CONTRIBUTING.md**: Contribution guidelines

---

**Version**: 1.0
**Last Updated**: 2025-01-03
