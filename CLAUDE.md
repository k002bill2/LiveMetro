# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiveMetro is a React Native mobile application (Expo-based) for real-time Seoul metropolitan subway arrival notifications. The app integrates with Seoul's Open API for real-time train data and uses Firebase for user authentication and data persistence.

**Key Technologies:**
- React Native 0.72 with Expo ~49
- TypeScript 5.1+ with strict mode
- Firebase (Auth, Firestore, Functions)
- React Navigation 6.x (Stack + Bottom Tabs)
- Seoul Open Data API integration

## Development Commands

### Running the App
```bash
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run web            # Run in web browser
```

### Code Quality
```bash
npm run lint           # Run ESLint with auto-fix
npm run type-check     # TypeScript type checking (no emit)
npm test               # Run Jest tests
npm test:watch         # Run tests in watch mode
npm test:coverage      # Generate coverage report
```

### Building & Deployment
```bash
# EAS Build (Expo Application Services)
npm run build:development     # Development build (all platforms)
npm run build:preview         # Preview build (all platforms)
npm run build:production      # Production build (all platforms)
npm run build:ios            # iOS production build
npm run build:android        # Android production build

# Submit to stores
npm run submit:ios           # Submit to App Store
npm run submit:android       # Submit to Play Store
npm run submit:all           # Submit to both stores
```

**Important:** Both `prebuild` and `presubmit` hooks run linting and type-checking automatically. Builds will fail if these checks don't pass.

## Architecture Overview

### Multi-Tier Data Flow Strategy

The app implements a sophisticated fallback system for real-time subway data:

**Priority Order:** Seoul API → Firebase → Local Cache

1. **Seoul API (Primary Source)**: Real-time arrival data from Seoul Open Data Portal
2. **Firebase (Fallback)**: Secondary source with real-time subscriptions
3. **AsyncStorage (Cache)**: Offline support with TTL-based expiration

**Key Service Layer:**
- `dataManager` (src/services/data/dataManager.ts): Orchestrates the multi-tier fallback with automatic retry logic
- `seoulSubwayApi` (src/services/api/seoulSubwayApi.ts): Seoul API integration with timeout and error handling
- `trainService` (src/services/train/trainService.ts): Firebase queries and real-time subscriptions

### Navigation Architecture

The app uses a conditional authentication-based navigation structure:

**Root Structure:**
```
RootNavigator (Stack)
├── If authenticated:
│   └── Main (BottomTabs)
│       ├── Home
│       ├── Favorites
│       ├── Alerts
│       └── Settings
└── If unauthenticated:
    ├── Welcome
    └── Auth
```

**Modal/Overlay Screens:**
- `StationDetail`: Pushed onto stack from any tab (shows train arrivals)
- `SubwayMap`: Full-screen Seoul Metro map with station navigation

**Navigation Pattern:** Uses TypeScript-typed route params (see `src/navigation/types.ts`). All navigation props are strongly typed via `AppStackParamList` and `AppTabParamList`.

### State Management Pattern

**No Redux/MobX** - The app uses React hooks and Context API:

1. **AuthContext** (src/services/auth/AuthContext.tsx): Global authentication state
2. **Custom Hooks**: Domain-specific hooks for data fetching
   - `useRealtimeTrains`: Real-time train data with auto-retry and stale detection
   - `useLocation`: Location permissions and GPS tracking
   - `useNearbyStations`: Geo-proximity station search
   - `useNotifications`: Push notification management

3. **Singleton Services**: Stateful service classes exported as singletons
   - `dataManager`: Manages subscriptions and cache
   - `trainService`: Firebase subscriptions
   - `monitoringManager`: Production monitoring

### Module Path Aliases

The project uses Babel module resolver with TypeScript paths:

```typescript
@ → src/
@components → src/components
@screens → src/screens
@services → src/services
@models → src/models
@utils → src/utils
@hooks → src/hooks
```

**When creating imports:** Use path aliases consistently. Don't use relative imports like `../../services/`.

## Environment Variables

Required environment variables (use `.env` file):

```bash
# Seoul Open Data API
SEOUL_SUBWAY_API_KEY=your_api_key_here
SEOUL_SUBWAY_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway
SEOUL_OPEN_API_BASE_URL=http://openAPI.seoul.go.kr:8088

# Firebase Configuration (all prefixed with EXPO_PUBLIC_)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

**Note:** Expo requires `EXPO_PUBLIC_` prefix for variables accessible in client code.

## Testing Strategy

### Test Configuration

- **Test Runner**: Jest with React Native preset
- **Test Environment**: Node (not jsdom)
- **Coverage Thresholds**: 75% statements/lines, 70% functions, 60% branches
- **Setup File**: `src/__tests__/setup.ts` (loads before all tests)

### Running Specific Tests

```bash
# Run single test file
npm test -- src/components/train/__tests__/StationCard.test.tsx

# Run tests matching pattern
npm test -- --testPathPattern=train

# Run tests in watch mode with coverage
npm test:watch -- --coverage
```

### Test File Organization

Tests are co-located with source files in `__tests__` directories:
```
src/components/train/
├── StationCard.tsx
└── __tests__/
    └── StationCard.test.tsx
```

## TypeScript Guidelines

### Strict Mode Configuration

The project uses **strict TypeScript** with additional safety flags:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedIndexedAccess: true`

### Common Patterns

**When writing new code:**
1. Always define explicit return types for functions
2. Use `interface` for object shapes, `type` for unions/intersections
3. Avoid `any` - use `unknown` and type guards instead
4. All async functions must handle errors with try-catch
5. Use optional chaining (`?.`) and nullish coalescing (`??`) for nullable values

**Model Definitions:**
All data models are centralized in `src/models/`:
- `train.ts`: Train, Station, SubwayLine, TrainDelay, CongestionData
- `user.ts`: User, UserPreferences
- `notification.ts`: Notification types

## Seoul Metro API Integration

### Real-Time Arrival API

**Base URL:** `http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}`

**Key Fields in Response:**
- `arvlMsg2`, `arvlMsg3`: Arrival messages ("2분후[1번째전]", "곧 도착")
- `btrainNo`: Train number
- `updnLine`: Direction ("상행" = up, "하행" = down)
- `trainLineNm`: Line name
- `bstatnNm`: Destination station

### Timetable API

**Base URL:** `http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/`

**Parameters:**
- `WEEK_TAG`: '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday)
- `INOUT_TAG`: '1' (Up/Inner), '2' (Down/Outer)

**Service Disruption Detection:**
The `dataManager.detectServiceDisruptions()` method scans arrival messages for keywords:
- Suspension: "운행중단", "전면중단", "운행불가"
- Incidents: "장애", "고장", "사고", "탈선", "화재"

## Firebase Integration

### Firestore Collections

```
subwayLines/          # Line metadata (color, name, sequence)
stations/             # Station info with coordinates
  ├─ lineId          # References subwayLines
  ├─ coordinates     # {latitude, longitude}
  └─ transfers[]     # Transfer station IDs

trains/               # Real-time train positions
  ├─ currentStationId
  ├─ arrivalTime     # Timestamp
  └─ status          # NORMAL | DELAYED | SUSPENDED | EMERGENCY

trainDelays/          # Delay/disruption alerts
  ├─ severity        # MINOR | MODERATE | MAJOR | SEVERE
  └─ affectedStations[]

congestionData/       # Train car congestion levels
```

### Firebase Subscription Pattern

The app uses Firebase real-time listeners through `trainService.subscribeToTrainUpdates()`:

```typescript
const unsubscribe = trainService.subscribeToTrainUpdates(
  stationId,
  (trains) => {
    // Handle real-time updates
  }
);

// Clean up on unmount
return () => unsubscribe();
```

**Important:** Always clean up Firebase subscriptions in useEffect return functions to prevent memory leaks.

## Production Monitoring

The app includes comprehensive monitoring via `monitoringManager` (src/services/monitoring/):

- **Crash Reporting**: Automatic error capture and reporting
- **Performance Monitoring**: App startup, API latency tracking
- **Health Checks**: Service availability monitoring
- **Breadcrumbs**: Navigation and user action tracking

**Initialization:** Monitoring is initialized in `App.tsx` and disabled in `__DEV__` mode by default.

## Subway Map Implementation

The subway map (SubwayMapScreen) uses a custom SVG-based rendering system:

**Data Files:**
- `src/utils/subwayMapData.ts`: Station coordinates and metadata (100% accuracy achieved)
- `src/utils/subwayLinePaths.ts`: SVG path definitions for all 9 lines
- `src/utils/mapLayout.ts`: Layout calculations and zoom/pan logic

**Design System:** Follows Seoul Metro 2024 official design standards with accurate line colors and typography.

## Common Development Patterns

### Adding a New Screen

1. Create screen component in `src/screens/{category}/{ScreenName}.tsx`
2. Add route params to `src/navigation/types.ts` (AppStackParamList or AppTabParamList)
3. Register route in `AppNavigator.tsx` or `RootNavigator.tsx`
4. Use TypeScript navigation prop typing:
   ```typescript
   import { NativeStackScreenProps } from '@react-navigation/native-stack';
   import { AppStackParamList } from '@/navigation/types';

   type Props = NativeStackScreenProps<AppStackParamList, 'ScreenName'>;
   ```

### Creating a Custom Hook

1. Create in `src/hooks/use{FeatureName}.ts`
2. Return object with loading, error, data, and action functions
3. Include cleanup logic for subscriptions/timers
4. Add unit tests in `src/hooks/__tests__/`

### Adding API Integration

1. Create service in `src/services/{domain}/{serviceName}.ts`
2. Export singleton instance (lowercase): `export const serviceName = new ServiceClass()`
3. Handle errors gracefully - return empty arrays/null instead of throwing
4. Integrate with `dataManager` for caching and offline support

## Known Issues & Workarounds

1. **Firebase Firestore Offline Persistence**: Not enabled by default in React Native. The app relies on AsyncStorage cache layer instead.
2. **Seoul API Rate Limiting**: No official rate limits documented, but the app implements 30-second polling intervals to be conservative.
3. **Location Permissions on iOS**: Requires `NSLocationWhenInUseUsageDescription` in app.json. Always request permissions before accessing GPS.
4. **TypeScript Path Aliases in Tests**: Configured in jest.config.js `moduleNameMapper`. If tests fail with module resolution errors, verify the mapping matches tsconfig.json paths.
