---
name: test-automation
description: Generate comprehensive Jest tests for LiveMetro React Native components, hooks, and services. Use when writing tests, improving coverage, or test-driven development.
---

# Test Automation Skill (LiveMetro)

## Purpose
Create comprehensive unit and integration tests for LiveMetro React Native components, hooks, and services using **Jest** and **React Native Testing Library**.

## Checklists

테스트 작성 시 다음 체크리스트를 참조하세요:
- `.claude/checklists/testing.md` - 단위/통합 테스트, 커버리지, 모킹, 엣지 케이스

## When to Use
- Writing tests for new components or features
- Improving test coverage (target: 75% statements, 70% functions)
- Implementing test-driven development (TDD)
- Debugging failing tests
- Creating mock data and fixtures

## Testing Standards

### Coverage Requirements
- **Statements**: 75% minimum
- **Lines**: 75% minimum
- **Functions**: 70% minimum
- **Branches**: 60% minimum

### Test Location
- Co-located with source files in `__tests__/` directories
- Example: `src/components/station/__tests__/StationCard.test.tsx`

### Naming Conventions
- Test files: `*.test.ts` or `*.test.tsx`
- Test suites: `describe('ComponentName', () => {})`
- Test cases: `it('should do something', () => {})`

## Instructions

### 1. Analyze the Code
- Read the component/hook/service implementation
- Identify all functions, props, and edge cases
- Note external dependencies (Firebase, Seoul API, AsyncStorage)

### 2. Identify Test Scenarios
**Happy Path**: Normal usage with valid inputs
**Edge Cases**: Empty data, null values, undefined, loading states
**Error Cases**: API failures, Firebase errors, network timeouts

### 3. Create Test File
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ComponentName } from '../ComponentName';

// Mock external dependencies BEFORE imports
jest.mock('@/services/trainService', () => ({
  getRealtimeArrivals: jest.fn(),
}));

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Tests here
});
```

### 4. Mock External Dependencies

**Firebase**:
```typescript
jest.mock('@/config/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-uid', email: 'test@test.com' },
    onAuthStateChanged: jest.fn((callback) => {
      callback({ uid: 'test-uid', email: 'test@test.com' });
      return jest.fn(); // unsubscribe
    }),
  },
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn((_, callback) => {
    callback({ docs: [] });
    return jest.fn(); // unsubscribe
  }),
}));
```

**AsyncStorage**:
```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
```

**React Navigation**:
```typescript
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { stationId: 'test-station' },
  }),
}));
```

**Seoul API**:
```typescript
jest.mock('@/services/trainService', () => ({
  getRealtimeArrivals: jest.fn().mockResolvedValue([
    { trainLineNm: '2호선', arvlMsg2: '3분 후 도착', statnNm: '강남' },
  ]),
}));
```

### 5. Write Tests

**Component Tests**:
```typescript
describe('StationCard', () => {
  const mockStation = {
    stationId: 'ST001',
    stationName: '강남',
    lineId: '2',
  };

  it('renders station name correctly', () => {
    render(<StationCard station={mockStation} />);
    expect(screen.getByText('강남')).toBeTruthy();
  });

  it('handles press event', () => {
    const onPress = jest.fn();
    render(<StationCard station={mockStation} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('station-card'));
    expect(onPress).toHaveBeenCalledWith(mockStation);
  });

  it('shows loading state', () => {
    render(<StationCard station={mockStation} loading={true} />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

**Hook Tests**:
```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTrainData } from '../useTrainData';

describe('useTrainData', () => {
  it('fetches train data on mount', async () => {
    const { result } = renderHook(() => useTrainData('ST001'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.arrivals).toBeDefined();
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('API Error');
    (getRealtimeArrivals as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useTrainData('invalid'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.arrivals).toEqual([]);
    });
  });
});
```

**Service Tests**:
```typescript
describe('dataManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches from Seoul API first', async () => {
    const data = await dataManager.getTrainArrivals('ST001');
    expect(seoulApi.fetchArrivals).toHaveBeenCalledWith('ST001');
    expect(data).toBeDefined();
  });

  it('falls back to Firebase on API failure', async () => {
    (seoulApi.fetchArrivals as jest.Mock).mockRejectedValue(new Error('API Error'));

    const data = await dataManager.getTrainArrivals('ST001');
    expect(trainService.getTrainsByStation).toHaveBeenCalledWith('ST001');
  });

  it('uses cache when available and fresh', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: mockData, timestamp: Date.now() })
    );

    const data = await dataManager.getTrainArrivals('ST001');
    expect(seoulApi.fetchArrivals).not.toHaveBeenCalled();
    expect(data).toEqual(mockData);
  });
});
```

### 6. Verify Coverage
```bash
npm test -- --coverage
```

## Common Patterns

### Testing Async Operations
```typescript
it('fetches data asynchronously', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeTruthy();
  });
});
```

### Testing Navigation
```typescript
it('navigates to station detail', () => {
  render(<StationCard station={mockStation} />);
  fireEvent.press(screen.getByTestId('station-card'));

  expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
    stationId: 'ST001',
    stationName: '강남',
    lineId: '2',
  });
});
```

### Testing Firebase Subscriptions Cleanup
```typescript
it('subscribes to Firestore and cleans up on unmount', () => {
  const unsubscribe = jest.fn();
  (onSnapshot as jest.Mock).mockReturnValue(unsubscribe);

  const { unmount } = render(<RealtimeComponent stationId="ST001" />);

  expect(onSnapshot).toHaveBeenCalled();

  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
```

## Known Test Pitfalls (from MEMORY.md)

1. **"Found multiple elements with text"** - Use `getByTestId` when text appears in both title and button
2. **"Can't access .root on unmounted test renderer"** - `useAuth` mock must return full `AuthContextType`
3. **Missing testID** - Check actual component source before writing tests
4. **`isAutoLoggingIn` state** - AuthScreen starts with loading; wait for `getByTestId('email-input')`
5. **useAuth mock shape**: Must include ALL fields: `user, firebaseUser, loading, signInAnonymously, signInWithEmail, signUpWithEmail, signOut, updateUserProfile, resetPassword, changePassword`

## Test Configuration

LiveMetro uses **Jest** with React Native Testing Library:

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['./jest.setup.js'],
  coverageThreshold: {
    global: {
      statements: 75,
      lines: 75,
      functions: 70,
      branches: 60,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
};
```

## Running Tests

```bash
npm test                                          # Run all tests
npm test -- --watch                               # Watch mode
npm test -- --coverage                            # Coverage report
npm test -- src/components/__tests__/StationCard   # Specific file
npm test -- -t "renders correctly"                # Specific test name
```

## Resources
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Hooks](https://callstack.github.io/react-native-testing-library/docs/api#renderhook)

---

*Use this skill to maintain high test coverage and ensure code quality in LiveMetro.*
