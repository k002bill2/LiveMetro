# LiveMetro Development Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Development Workflows](#development-workflows)
3. [ACE Framework Integration](#ace-framework-integration)
4. [Validation Gates](#validation-gates)
5. [Common Patterns](#common-patterns)
6. [Testing Requirements](#testing-requirements)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Multi-Tier Data Flow Strategy
LiveMetro implements a sophisticated fallback system for real-time subway data:

**Priority Order**: Seoul API → Firebase → Local Cache

```
┌─────────────────┐
│  Seoul Open API │ (Primary, 30s polling)
└────────┬────────┘
         │ Timeout/Error
         ↓
┌─────────────────┐
│    Firebase     │ (Secondary, real-time subscriptions)
└────────┬────────┘
         │ Offline
         ↓
┌─────────────────┐
│  AsyncStorage   │ (Cache, TTL-based expiration)
└─────────────────┘
```

**Key Services**:
- `dataManager` (src/services/data/dataManager.ts): Orchestrates multi-tier fallback
- `seoulSubwayApi` (src/services/api/seoulSubwayApi.ts): Seoul API integration
- `trainService` (src/services/train/trainService.ts): Firebase queries

### Navigation Structure
Auth-based conditional routing:

```
RootNavigator (Stack)
├── Authenticated:
│   └── Main (BottomTabs)
│       ├── Home
│       ├── Favorites
│       ├── Alerts
│       └── Settings
└── Unauthenticated:
    ├── Welcome
    └── Auth
```

### State Management
- **No Redux/MobX**: React hooks + Context API
- **AuthContext**: Global authentication state
- **Custom Hooks**: Domain-specific data fetching (`useRealtimeTrains`, `useLocation`, etc.)
- **Singleton Services**: Stateful service classes

---

## Development Workflows

### Single-Agent Development (Default)

**When to use**:
- ✅ Single-file changes
- ✅ Focused bug fixes
- ✅ Simple feature additions
- ✅ Exploratory work

**Workflow**:
```bash
# 1. Make changes directly in src/
npx Edit src/components/train/StationCard.tsx

# 2. Auto-validated by hooks
# - TypeScript type-check runs automatically
# - ESLint runs automatically

# 3. Run tests manually
npm test

# 4. Commit
git add .
git commit -m "feat: add station card component"
```

**Advantages**:
- Simple and straightforward
- No coordination overhead
- Direct feedback

### Parallel-Agent Development (Advanced)

**When to use**:
- ✅ Feature with 3+ independent subtasks
- ✅ Multi-layer work (UI + API + Firebase + Tests)
- ✅ Different file types (screens + services + hooks)
- ✅ Performance optimization across multiple modules
- ✅ Test coverage improvement for multiple files

**When NOT to use**:
- ❌ Sequential dependencies (task B requires task A output)
- ❌ Same file modifications
- ❌ Exploratory code reading
- ❌ Single, focused task

**Workflow**:
```bash
# 1. Primary Agent invokes parallel-coordinator skill
Skill parallel-coordinator

# 2. Primary Agent decomposes task using ACE Layer 4
# Example: "Implement real-time train arrival feature"

Subtasks:
- backend-integration-specialist: Seoul API client
- mobile-ui-specialist: StationDetailScreen
- test-automation-specialist: Jest tests

# 3. Parallel execution in isolated workspaces
# Agents work in .temp/agent_workspaces/{agent-name}/

# 4. Primary Agent integrates proposals
# Reviews files in .temp/agent_workspaces/*/proposals/
# Merges to src/ after validation

# 5. Run quality gates
npm run type-check
npm run lint
npm test

# 6. Commit integrated work
git add .
git commit -m "feat: implement real-time train arrivals"
```

**Advantages**:
- 1.6-2.0x faster development
- Maintained code quality (parallel quality checks)
- Clear separation of concerns

---

## ACE Framework Integration

LiveMetro uses the **ACE (Autonomous Cognitive Entity) Framework** with 6 layers for coordinated parallel development.

### Layer 1: Aspirational (Ethical Principles)

**Core Mission - Reduce Suffering**:
- Prevent data loss (user preferences, favorite stations are critical)
- Avoid user frustration (accurate arrival times, clear error messages)
- Minimize errors (pre-flight checks, cross-validation)
- Abort operations that risk app instability (users depend on real-time info)

**Core Mission - Increase Prosperity**:
- Maximize efficiency (faster API responses, better UX)
- Optimize resources (respect Seoul API rate limits: 30s polling minimum)
- Minimize costs (optimize Firebase reads)
- Enable user success (reliable subway information)

**Core Mission - Increase Understanding**:
- Transparency in all decisions
- Clear documentation (TypeScript types, code comments)
- Share learnings (React Native best practices)

**Ethical Constraints (Never Violate)**:
- **Data Integrity**: Never corrupt, lose, or expose user data
- **Privacy**: Respect user location data, no indefinite storage
- **API Respect**: Never exceed Seoul API rate limits
- **App Stability**: Never commit code that crashes the app

**Example - Ethical Veto**:
```
User Request: "Store detailed user location history"
Agent Response: ⚠️ ETHICAL CONCERN
  - Violates privacy principle (Layer 1)
  - Recommend: Local-only predictions (no server storage)
  - Alternative: Aggregate station patterns only (no GPS)
```

### Layer 2: Global Strategy (Mission Context)

**Primary Agent maintains**:
```json
{
  "user_goal": "Implement real-time train arrival feature",
  "success_criteria": [
    "Seoul API integration with proper error handling",
    "Firebase fallback operational",
    "AsyncStorage offline cache with TTL",
    "TypeScript strict mode compliance",
    "Test coverage >75%",
    "Works on iOS and Android"
  ],
  "constraints": [
    "Must respect Seoul API rate limits (30s polling)",
    "Optimize Firebase reads (cost consideration)",
    "No breaking changes to existing navigation"
  ],
  "long_term_context": "Part of LiveMetro v2.0 major release"
}
```

### Layer 3: Agent Model (Self-Assessment)

Each agent knows its capabilities:

| Agent | Strengths | Weaknesses |
|-------|-----------|------------|
| mobile-ui-specialist | React Native (0.95), TypeScript (0.90), Mobile UX (0.85) | Native modules (0.30), Animations (0.50) |
| backend-integration-specialist | Firebase (0.95), Seoul API (0.90), Data sync (0.90) | UI design (0.40), UX patterns (0.35) |
| performance-optimizer | React optimization (0.90), Profiling (0.80) | New features (0.50), API design (0.50) |
| test-automation-specialist | Jest (0.95), RTL (0.90), Coverage (0.90) | Implementation (0.40), UI design (0.35) |

**Agent Self-Assessment Example**:
```
Task: "Implement native module for GPS tracking"
mobile-ui-specialist:
  ❌ DECLINE (Native module capability: 0.30)
  ✅ SUGGEST: Reassign to specialist or use Expo Location API
```

### Layer 4: Executive Function (Task Decomposition)

**Primary Agent's Role**:
- Decompose user request into subtasks
- Match subtasks to agent capabilities (Layer 3)
- Assign workspaces and file outputs
- Define dependencies
- Monitor progress and reallocate if needed

**Example Task Decomposition**:
```json
{
  "primary_task": "Add push notification for train delays",
  "subtasks": [
    {
      "agent": "backend-integration-specialist",
      "task": "Setup Firebase Cloud Messaging",
      "output": "src/services/notification/fcmService.ts",
      "workspace": ".temp/agent_workspaces/backend-integration/",
      "estimated_time": "15 min"
    },
    {
      "agent": "mobile-ui-specialist",
      "task": "Notification settings screen",
      "output": "src/screens/NotificationSettingsScreen.tsx",
      "dependencies": ["backend-integration-specialist"],
      "workspace": ".temp/agent_workspaces/mobile-ui/",
      "estimated_time": "20 min"
    },
    {
      "agent": "test-automation-specialist",
      "task": "Notification tests",
      "output": "src/services/notification/__tests__/",
      "dependencies": ["backend-integration-specialist"],
      "workspace": ".temp/agent_workspaces/test-automation/",
      "estimated_time": "15 min"
    }
  ]
}
```

**Dynamic Reallocation**:
If an agent is blocked or task takes 2x expected time:
1. Primary assesses other agents' workload
2. Splits blocked task if possible
3. Reassigns to idle agent with capability match

### Layer 5: Cognitive Control (File Locks & Conflict Prevention)

**File Lock Mechanism**:
```
Before writing to any file:
1. Check .temp/coordination/locks/ for existing lock
2. If locked → Queue operation or notify Primary
3. If available → Acquire lock, write to workspace
4. After completion → Release lock
```

**Workspace Isolation**:
- Secondary agents write ONLY to `.temp/agent_workspaces/{agent-name}/`
- Primary Agent has exclusive write access to `src/`
- Proposals in `.temp/agent_workspaces/*/proposals/` await Primary review

**Conflict Detection**:
```
Scenario: Both agents try to modify dataManager.ts
Resolution:
1. First agent acquires lock → proceeds
2. Second agent detects conflict → waits
3. Primary Agent coordinates:
   - Option A: Sequential execution
   - Option B: Split file into separate concerns
```

### Layer 6: Task Prosecution (Skill Invocation & Execution)

**Skill Auto-Invocation Before Operations**:

| Operation | Required Skill | Timing |
|-----------|---------------|--------|
| React Native UI | `react-native-development` | Before creating screens/components |
| Push notifications | `notification-system` | Before implementing alerts |
| Seoul API | `api-integration` | Before API calls |
| Firebase | `firebase-integration` | Before Firestore/Auth work |
| Tests | `test-automation` | Before writing tests |

**Example Execution**:
```
T0:00 - Primary: Task decomposition (Layer 4)
T0:05 - Primary: Ethical check passed (Layer 1)
T0:10 - Secondary-API: Skill api-integration invoked
T0:15 - Secondary-UI: Skill react-native-development invoked
T2:30 - Secondary-API: Completes → Notifies Primary
T3:00 - Secondary-UI: Blocked (waiting for API types)
T3:05 - Primary: Exports types from API file
T3:10 - Secondary-UI: Resumes
T5:00 - Primary: Integrates all proposals
T6:00 - Primary: Runs validation gates
```

---

## Validation Gates

### Pre-Execution Gates
Before starting parallel execution:
- [ ] Task decomposition reviewed (Layer 4)
- [ ] Agent capabilities match tasks (Layer 3)
- [ ] No overlapping file assignments (Layer 5)
- [ ] Rollback checkpoints defined
- [ ] Ethical clearance obtained (Layer 1)

### Mid-Execution Gates
During parallel execution (every 30s):
- [ ] Progress updates received from all agents
- [ ] No deadlocks detected (Layer 5)
- [ ] File locks properly acquired/released
- [ ] No ethical concerns raised (Layer 1)
- [ ] Agent self-monitoring active (Layer 3)

### Post-Execution Gates
After parallel execution completes:
- [ ] All subtasks completed successfully
- [ ] File integrity verified (no corruption)
- [ ] TypeScript type-check passed (`npm run type-check`)
- [ ] ESLint passed (`npm run lint`)
- [ ] All tests passed (`npm test`)
- [ ] Test coverage >75% (`npm test -- --coverage`)
- [ ] No orphaned lock files remain
- [ ] User-facing output ready

**Example Validation Flow**:
```bash
# Post-execution validation
npm run type-check
# ✅ No TypeScript errors

npm run lint
# ✅ No linting errors

npm test -- --coverage
# ✅ All tests passed
# ✅ Coverage: 78% statements (target: 75%)

# If any validation fails:
# → Rollback to last checkpoint
# → Fix issues
# → Re-run validation
```

---

## Common Patterns

### 1. Component Creation
```tsx
// 1. Invoke react-native-development skill
Skill react-native-development

// 2. Create component with strict TypeScript
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StationCardProps {
  station: Station;
  onPress: () => void;
}

export const StationCard: React.FC<StationCardProps> = memo(({
  station,
  onPress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{station.name}</Text>
    </View>
  );
});

StationCard.displayName = 'StationCard';

const styles = StyleSheet.create({
  container: { padding: 16 },
  name: { fontSize: 16, fontWeight: '600' },
});
```

### 2. API Integration
```typescript
// 1. Invoke api-integration skill
Skill api-integration

// 2. Implement with error handling and rate limiting
export class SeoulSubwayApi {
  private lastCallTime: number = 0;
  private readonly MIN_INTERVAL = 30000; // 30s rate limit

  async getRealtimeArrivals(stationName: string): Promise<Train[]> {
    // Rate limit check
    const now = Date.now();
    if (now - this.lastCallTime < this.MIN_INTERVAL) {
      throw new Error('Rate limit: Wait 30s between calls');
    }

    try {
      const response = await fetch(this.buildUrl(stationName));
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      this.lastCallTime = now;
      return this.parseTrains(data);
    } catch (error) {
      console.error('Seoul API failed:', error);
      throw error; // Let dataManager handle fallback
    }
  }
}
```

### 3. Firebase Service Implementation
```typescript
// 1. Invoke firebase-integration skill
Skill firebase-integration

// 2. Implement with proper subscription cleanup
export class TrainService {
  subscribeToTrainUpdates(
    stationId: string,
    callback: (trains: Train[]) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      query(collection(db, 'trains'), where('stationId', '==', stationId)),
      (snapshot) => {
        const trains = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Train));
        callback(trains);
      },
      (error) => {
        console.error('Firebase subscription error:', error);
        callback([]); // Return empty on error
      }
    );

    return unsubscribe; // Critical: Return cleanup function
  }
}

// Usage in component
useEffect(() => {
  const unsubscribe = trainService.subscribeToTrainUpdates(
    stationId,
    (trains) => setTrains(trains)
  );
  return () => unsubscribe(); // Cleanup on unmount
}, [stationId]);
```

### 4. Test Writing
```typescript
// 1. Invoke test-automation skill
Skill test-automation

// 2. Write comprehensive tests
import { render, fireEvent } from '@testing-library/react-native';
import { StationCard } from '../StationCard';

describe('StationCard', () => {
  const mockStation: Station = {
    id: '1',
    name: 'Gangnam',
    lineId: '2',
  };

  it('renders station name correctly', () => {
    const { getByText } = render(
      <StationCard station={mockStation} onPress={jest.fn()} />
    );
    expect(getByText('Gangnam')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <StationCard station={mockStation} onPress={onPress} />
    );
    fireEvent.press(getByText('Gangnam'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

---

## Testing Requirements

### Coverage Thresholds
```json
{
  "statements": 75,
  "lines": 75,
  "functions": 70,
  "branches": 60
}
```

### Test Categories
1. **Unit Tests**: Components, hooks, services (co-located in `__tests__/`)
2. **Integration Tests**: Data flow, API integration
3. **E2E Tests**: Critical user flows (when applicable)

### Mock Strategy
- Firebase: `src/__tests__/setup.ts` provides mocks
- Seoul API: Mock fetch responses
- Expo modules: Jest presets handle automatically

### Running Tests
```bash
# Run all tests
npm test

# Watch mode (during development)
npm test:watch

# Coverage report
npm test:coverage

# Specific file
npm test -- src/components/train/__tests__/StationCard.test.tsx
```

---

## Troubleshooting

### Parallel Execution Issues

**Issue**: Deadlock detected (circular wait)
```
Solution:
1. Primary Agent detects timeout (30s)
2. Aborts youngest lock request
3. Re-queues operation
4. If persists → Convert to sequential execution
```

**Issue**: Agent capability mismatch (task too complex)
```
Solution:
1. Agent self-assesses (Layer 3)
2. Declines task transparently
3. Reports to Primary Agent
4. Primary reallocates or simplifies task
```

**Issue**: File conflict (both agents need same file)
```
Solution:
1. Conflict detection in Layer 5
2. Primary Agent reviews both versions
3. Options:
   - Accept one version
   - Merge manually
   - Request refinement from agents
```

### Common Errors

**TypeScript Error**: "Property 'X' does not exist on type 'Y'"
```bash
# Fix: Update type definitions
Edit src/models/train.ts
# Add missing property to interface

# Verify
npm run type-check
```

**Test Failure**: "Cannot find module '@/...'
```bash
# Fix: Check jest.config.js module mapper
# Ensure it matches tsconfig.json paths
```

**Firebase Error**: "Permission denied"
```bash
# Fix: Check Firestore security rules
# Verify user is authenticated
# Check Firebase console
```

---

## Additional Resources

- **CLAUDE.md**: Project architecture and guidelines
- **PARALLEL_AGENTS_GUIDE.md**: Quick reference for parallel execution
- **CONTRIBUTING.md**: Contribution guidelines
- **Parallel Agents Safety Protocol v3.0.1**: Full ACE Framework documentation

---

## Quick Command Reference

```bash
# Development
npm start                    # Start Expo dev server
npm run android              # Run on Android
npm run ios                  # Run on iOS

# Quality Checks
npm run type-check           # TypeScript validation
npm run lint                 # ESLint (auto-fix)
npm test                     # Run tests
npm test:coverage            # Coverage report

# Building
npm run build:development    # Dev build (all platforms)
npm run build:production     # Production build
npm run submit:all           # Submit to stores

# Custom Commands
/check-health                # Comprehensive health check
/test-coverage               # Coverage analysis
```

---

**Last Updated**: 2025-01-03
**Version**: 1.0 (ACE Framework Integration)
