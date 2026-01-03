# Contributing to LiveMetro

Thank you for your interest in contributing to LiveMetro! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Quality Standards](#code-quality-standards)
- [Parallel Development Guidelines](#parallel-development-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Architecture Patterns](#architecture-patterns)

---

## Code of Conduct

### Our Commitment

We are committed to providing a welcoming and inclusive environment for all contributors. We expect:

- Respectful and constructive communication
- Focus on what is best for the community and users
- Empathy towards other community members
- Graceful acceptance of constructive criticism

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission

---

## Getting Started

### Prerequisites

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Expo CLI**: Install globally with `npm install -g expo-cli`
- **Git**: Version control
- **Editor**: VS Code recommended (project includes .vscode/ settings)

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/LiveMetro.git
cd LiveMetro

# 3. Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/LiveMetro.git

# 4. Install dependencies
npm install

# 5. Copy environment variables
cp .env.example .env
# Edit .env with your API keys (Seoul API, Firebase)

# 6. Run type checking and linting
npm run type-check
npm run lint

# 7. Run tests
npm test

# 8. Start development server
npm start
```

### Environment Variables

You'll need the following API keys:

1. **Seoul Open Data API Key**: Register at [Seoul Open Data Portal](http://data.seoul.go.kr)
2. **Firebase Project**: Create a project at [Firebase Console](https://console.firebase.google.com)

See `.env.example` for required variables.

---

## Development Workflow

### Branching Strategy

We use a simplified Git Flow:

- **`main`**: Production-ready code (protected)
- **`develop`**: Integration branch (not currently used, merge directly to main)
- **Feature branches**: `feature/description` (e.g., `feature/favorites-ui`)
- **Bug fix branches**: `fix/description` (e.g., `fix/null-pointer-trainService`)
- **Performance branches**: `perf/description` (e.g., `perf/stationlist-rendering`)

### Creating a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create and checkout new feature branch
git checkout -b feature/your-feature-name

# Work on your feature
# ...

# Push to your fork
git push origin feature/your-feature-name
```

### Keeping Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch on latest main
git checkout feature/your-feature-name
git rebase upstream/main

# If conflicts occur, resolve them and continue
git add .
git rebase --continue

# Force push to your fork (only for your own branches!)
git push origin feature/your-feature-name --force-with-lease
```

---

## Code Quality Standards

### TypeScript

**We use TypeScript strict mode.** All code must comply with:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true
}
```

**Guidelines:**

- ✅ **Do**: Define explicit return types for functions
- ✅ **Do**: Use `interface` for object shapes, `type` for unions/intersections
- ✅ **Do**: Use `unknown` and type guards instead of `any`
- ❌ **Don't**: Use `any` type (use `unknown` or proper types)
- ❌ **Don't**: Use `@ts-ignore` or `@ts-expect-error` without justification
- ❌ **Don't**: Disable strict checks in individual files

**Example:**

```typescript
// ✅ Good
interface TrainArrival {
  trainNo: string;
  arrivalTime: Date;
  destination: string;
}

function getNextTrain(arrivals: TrainArrival[]): TrainArrival | null {
  return arrivals[0] ?? null;
}

// ❌ Bad
function getNextTrain(arrivals: any) {  // 'any' type
  return arrivals[0];  // No null handling
}
```

### ESLint and Prettier

**All code must pass linting:**

```bash
npm run lint
```

**Auto-fix most issues:**

```bash
npm run lint -- --fix
```

**Key Rules:**

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- No semicolons (Prettier removes them)
- Max line length: 100 characters
- No `console.log` in production code (use proper logging)

### Path Aliases

**Always use path aliases**, never relative imports:

```typescript
// ✅ Good
import { trainService } from '@/services/train/trainService'
import { StationCard } from '@components/train/StationCard'

// ❌ Bad
import { trainService } from '../../services/train/trainService'
import { StationCard } from '../components/train/StationCard'
```

**Available Aliases:**

- `@` → `src/`
- `@components` → `src/components`
- `@screens` → `src/screens`
- `@services` → `src/services`
- `@models` → `src/models`
- `@utils` → `src/utils`
- `@hooks` → `src/hooks`

---

## Parallel Development Guidelines

LiveMetro supports **parallel agent development** using the ACE Framework for complex features. See [PARALLEL_AGENTS_GUIDE.md](./PARALLEL_AGENTS_GUIDE.md) for details.

### When to Use Parallel Development

**✅ Use parallel agents when:**

- Feature has 3+ independent subtasks
- Different file types (screens + services + tests)
- Multi-layer feature (UI + API + Firebase + tests)
- Performance optimization across multiple files

**❌ Don't use parallel agents when:**

- Single, focused task (one component, one function)
- Sequential dependencies (B needs A's output)
- Same file modifications by multiple contributors
- Exploratory work (code reading, investigation)

### Parallel Development Workflow

If you're working on a complex feature that could benefit from parallel development:

1. **Plan First**: Use the `parallel-coordinator` skill to decompose the task
2. **Workspace Isolation**: Each specialist works in `.temp/agent_workspaces/{agent-name}/`
3. **No Direct src/ Writes**: Specialists write to `proposals/` subdirectory
4. **Primary Integration**: Primary agent integrates all proposals to `src/`
5. **Quality Gates**: Run type-check, lint, and tests after integration

**Example:**

```bash
# 1. Primary agent invokes coordinator
Skill parallel-coordinator

# 2. Agents work in parallel in isolated workspaces
# mobile-ui-specialist → .temp/agent_workspaces/mobile-ui/proposals/
# backend-integration-specialist → .temp/agent_workspaces/backend-integration/proposals/
# test-automation-specialist → .temp/agent_workspaces/test-automation/proposals/

# 3. Primary agent integrates and validates
npm run type-check && npm run lint && npm test
```

### File Organization for Parallel Work

**When working on a feature that will be developed in parallel:**

- Create clear module boundaries (separate files for UI, services, tests)
- Avoid shared utilities that multiple agents will modify
- Use TypeScript interfaces to define contracts between modules
- Document dependencies in task decomposition

---

## Testing Requirements

### Coverage Thresholds

**All contributions must maintain or improve test coverage:**

```json
{
  "statements": 75,
  "functions": 70,
  "branches": 60,
  "lines": 75
}
```

**Check coverage:**

```bash
npm test -- --coverage
```

### Test File Organization

Tests are **co-located** with source files:

```
src/components/train/
├── StationCard.tsx
└── __tests__/
    └── StationCard.test.tsx

src/services/train/
├── trainService.ts
└── __tests__/
    └── trainService.test.ts
```

### Test Structure

**Use the AAA pattern (Arrange, Act, Assert):**

```typescript
describe('StationCard', () => {
  it('should display station name and line', () => {
    // Arrange
    const station = {
      id: '0150',
      name: '강남',
      lineId: 'line2',
    }

    // Act
    const { getByText } = render(<StationCard station={station} />)

    // Assert
    expect(getByText('강남')).toBeTruthy()
    expect(getByText('2호선')).toBeTruthy()
  })
})
```

### Mocking Guidelines

**Mock external dependencies consistently:**

```typescript
// Mock Firebase
jest.mock('@/services/firebase/firebaseConfig', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
}))

// Mock Seoul API
jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrivals: jest.fn(),
  },
}))

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}))
```

### Test Types

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test service interactions (API + Firebase)
3. **Component Tests**: Test React components with React Testing Library
4. **Performance Tests**: Benchmark tests for critical paths (optional)

**Example test structure:**

```typescript
// src/services/train/__tests__/trainService.test.ts

import { trainService } from '../trainService'
import { firestore } from '@/services/firebase/firebaseConfig'

jest.mock('@/services/firebase/firebaseConfig')

describe('trainService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('subscribeToTrainUpdates', () => {
    it('should subscribe to Firestore collection and call callback', async () => {
      // Test implementation
    })

    it('should handle Firestore errors gracefully', async () => {
      // Test error handling
    })

    it('should unsubscribe when cleanup function is called', async () => {
      // Test cleanup
    })
  })
})
```

---

## Commit Guidelines

### Commit Message Format

We follow **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `refactor`: Code refactoring (no functional changes)
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `chore`: Build process or tooling changes
- `style`: Code style changes (formatting, missing semicolons, etc.)

**Examples:**

```bash
# Feature
git commit -m "feat(favorites): add star icon to StationCard component"

# Bug fix
git commit -m "fix(trainService): handle null pointer in subscribeToTrainUpdates"

# Performance
git commit -m "perf(StationList): add React.memo to reduce re-renders"

# Documentation
git commit -m "docs(README): update setup instructions for Firebase"

# Breaking change
git commit -m "feat(navigation)!: migrate to React Navigation 6

BREAKING CHANGE: Navigation structure changed, old deep links won't work"
```

### Commit Best Practices

- **Atomic commits**: One logical change per commit
- **Meaningful messages**: Describe *what* and *why*, not *how*
- **Reference issues**: Include issue number if applicable (`fix #123`)
- **Sign commits**: Use GPG signing if possible (`git commit -S`)

---

## Pull Request Process

### Before Creating a PR

**Checklist:**

- [ ] Code passes type checking (`npm run type-check`)
- [ ] Code passes linting (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Test coverage meets thresholds (75%+ statements)
- [ ] Branch is up to date with `main` (rebased)
- [ ] Commits follow conventional commit format
- [ ] No `console.log` or debug code left in
- [ ] No `.only` or `.skip` in tests

### Creating a Pull Request

1. **Push to your fork:**

```bash
git push origin feature/your-feature-name
```

2. **Create PR on GitHub:**

   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template

3. **PR Title Format:**

Use conventional commit format:

```
feat(favorites): add favorite stations feature with offline sync
fix(trainService): resolve crash when tapping favorite with no network
perf(StationList): optimize rendering with React.memo and virtualization
```

4. **PR Description Template:**

```markdown
## Summary
<!-- Brief description of what this PR does -->

## Changes
<!-- List of specific changes -->
- Added FavoritesService with Firebase CRUD operations
- Updated StationCard with star icon toggle
- Added offline caching with AsyncStorage

## Testing
<!-- How was this tested? -->
- [ ] Unit tests added (coverage: X%)
- [ ] Manual testing on iOS
- [ ] Manual testing on Android
- [ ] Tested offline behavior

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Related Issues
<!-- Reference issues: Closes #123, Fixes #456 -->

## Breaking Changes
<!-- List any breaking changes -->
None

## Checklist
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Tests pass with coverage >75%
- [ ] Documentation updated (if applicable)
- [ ] Rebased on latest main
```

### PR Review Process

1. **Automated Checks**: CI will run type-check, lint, and tests
2. **Code Review**: At least one maintainer review required
3. **Address Feedback**: Make changes in new commits (don't force push during review)
4. **Approval**: Once approved, maintainer will merge
5. **Clean Up**: Delete your feature branch after merge

### Review Criteria

Reviewers will check:

- **Functionality**: Does it work as expected?
- **Code Quality**: Follows TypeScript, ESLint, and project patterns?
- **Tests**: Adequate coverage and quality?
- **Performance**: No regressions?
- **Documentation**: Code comments and docs updated?
- **Architecture**: Follows existing patterns (navigation, state management)?

---

## Architecture Patterns

### Component Structure

**Follow this pattern for React components:**

```typescript
// src/components/train/StationCard.tsx

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Station } from '@/models/train'

interface StationCardProps {
  station: Station
  onPress?: (station: Station) => void
}

export function StationCard({ station, onPress }: StationCardProps) {
  const handlePress = () => {
    onPress?.(station)
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Text style={styles.name}>{station.name}</Text>
      <Text style={styles.line}>{station.lineId}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  line: {
    fontSize: 14,
    color: '#666',
  },
})
```

### Service Pattern

**Export singleton instances (lowercase):**

```typescript
// src/services/train/trainService.ts

class TrainService {
  async getTrainArrivals(stationId: string): Promise<TrainArrival[]> {
    try {
      // Implementation
    } catch (error) {
      console.error('Failed to get train arrivals:', error)
      return []
    }
  }

  subscribeToTrainUpdates(
    stationId: string,
    callback: (trains: Train[]) => void
  ): () => void {
    // Return unsubscribe function
  }
}

// Export singleton (lowercase!)
export const trainService = new TrainService()
```

### Custom Hooks

**Use custom hooks for data fetching:**

```typescript
// src/hooks/useRealtimeTrains.ts

import { useState, useEffect } from 'react'
import { trainService } from '@/services/train/trainService'
import { Train } from '@/models/train'

export function useRealtimeTrains(stationId: string) {
  const [trains, setTrains] = useState<Train[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = trainService.subscribeToTrainUpdates(
      stationId,
      (data) => {
        setTrains(data)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [stationId])

  return { trains, loading, error }
}
```

### Error Handling

**Always handle errors gracefully:**

```typescript
// ✅ Good - Returns empty array on error
async function getStations(): Promise<Station[]> {
  try {
    const response = await api.getStations()
    return response.data
  } catch (error) {
    console.error('Failed to fetch stations:', error)
    return []
  }
}

// ❌ Bad - Throws error up to caller
async function getStations(): Promise<Station[]> {
  const response = await api.getStations()
  return response.data
}
```

### Navigation

**Use typed navigation props:**

```typescript
// src/navigation/types.ts
export type AppStackParamList = {
  StationDetail: { stationId: string }
  SubwayMap: undefined
}

// src/screens/train/StationDetailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'StationDetail'>

export function StationDetailScreen({ route, navigation }: Props) {
  const { stationId } = route.params
  // ...
}
```

---

## Questions?

If you have questions about contributing:

1. **Check Documentation**: Read [DEVELOPMENT.md](./DEVELOPMENT.md) and [PARALLEL_AGENTS_GUIDE.md](./PARALLEL_AGENTS_GUIDE.md)
2. **Search Issues**: See if your question has been asked before
3. **Ask in Discussions**: Use GitHub Discussions for general questions
4. **Open an Issue**: For bug reports or feature requests

---

## License

By contributing to LiveMetro, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to LiveMetro! 🚇**
