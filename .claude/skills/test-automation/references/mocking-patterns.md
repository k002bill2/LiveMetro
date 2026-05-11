# Jest Mocking Patterns — LiveMetro

외부 의존성 모킹 모범 모음. SKILL.md의 "Step 4: Mock External Dependencies"에서 referenced. **모든 mock은 `jest.mock()` factory 내부에 inline 정의** — 외부 변수 참조 금지 (호이스팅 함정).

## Firebase

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

## AsyncStorage

```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
```

## React Navigation (Partial Mock)

`useNavigation` / `useRoute`만 모킹하고 나머지는 실제 모듈 사용. `requireActual` spread 필수 — 안 하면 다른 export가 undefined.

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

## Seoul API (trainService)

```typescript
jest.mock('@/services/trainService', () => ({
  getRealtimeArrivals: jest.fn().mockResolvedValue([
    { trainLineNm: '2호선', arvlMsg2: '3분 후 도착', statnNm: '강남' },
  ]),
}));
```

## expo-linear-gradient (View Pass-through)

```typescript
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style, testID }: any) => (
      <View style={style} testID={testID}>{children}</View>
    ),
  };
});
```

## lucide-react-native (Proxy 일괄 stub)

```typescript
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return new Proxy({}, {
    get: () => ({ children }: any) => <View>{children}</View>,
  });
});
```

## useTheme (두 경로 모두)

Atomic 컴포넌트가 themeContext 직접 import 시 index alias만 모킹하면 우회 못 함. 두 path 다 모킹.

```typescript
jest.mock('@/contexts/themeContext', () => ({
  useTheme: () => ({ colors: mockColors, dark: false }),
}));
jest.mock('@/theme', () => ({
  useTheme: () => ({ colors: mockColors, dark: false }),
}));
```

## Fake Timers (cleanup 필수)

```typescript
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
```

## 흔한 함정 (MEMORY.md 기반)

- **Atom barrel cascade**: `@/components/design` barrel import는 모든 atom 로드 → mock 부재 시 폭발. **직접 path 사용 권장**.
- **Pill atom mock에 Text wrap 필수**: `Pill: ({children}) => children`은 RNTL `getByText`가 raw string 미인식. `<Text>{children}</Text>` wrap.
- **TDD RED mockResolvedValueOnce 누출**: 미구현 함수가 once 큐 안 소비 → 인접 테스트 누출. GREEN 진입 후 해소.
- **useAuth mock shape**: `user, firebaseUser, loading, signInAnonymously, signInWithEmail, signUpWithEmail, signOut, updateUserProfile, resetPassword, changePassword` 전부 포함.
