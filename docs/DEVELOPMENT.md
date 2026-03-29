# LiveMetro Development Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Development Workflows](#development-workflows)
3. [Validation Gates](#validation-gates)
4. [Common Patterns](#common-patterns)
5. [Testing Requirements](#testing-requirements)
6. [Troubleshooting](#troubleshooting)

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
- 
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

# 2. Primary Agent decomposes task
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

## Validation Gates

### Pre-Execution Gates
Before starting parallel execution:
- [ ] Task decomposition reviewed
- [ ] Agent capabilities match tasks
- [ ] No overlapping file assignments
- [ ] Rollback checkpoints defined

### Mid-Execution Gates
During parallel execution:
- [ ] Progress updates received from all agents
- [ ] No deadlocks detected
- [ ] Workspace isolation maintained

### Post-Execution Gates
After parallel execution completes:
- [ ] All subtasks completed successfully
- [ ] File integrity verified (no corruption)
- [ ] TypeScript type-check passed (`npm run type-check`)
- [ ] ESLint passed (`npm run lint`)
- [ ] All tests passed (`npm test`)
- [ ] Test coverage >75% (`npm test -- --coverage`)
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
- **CONTRIBUTING.md**: Contribution guidelines

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
**Version**: 2.0
