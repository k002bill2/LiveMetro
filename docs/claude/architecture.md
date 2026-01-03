# Architecture Reference

## Multi-Tier Data Flow Strategy

The app implements a sophisticated fallback system for real-time subway data:

**Priority Order:** Seoul API → Firebase → Local Cache

1. **Seoul API (Primary Source)**: Real-time arrival data from Seoul Open Data Portal
2. **Firebase (Fallback)**: Secondary source with real-time subscriptions
3. **AsyncStorage (Cache)**: Offline support with TTL-based expiration

**Key Service Layer:**
- `dataManager` (src/services/data/dataManager.ts): Orchestrates the multi-tier fallback with automatic retry logic
- `seoulSubwayApi` (src/services/api/seoulSubwayApi.ts): Seoul API integration with timeout and error handling
- `trainService` (src/services/train/trainService.ts): Firebase queries and real-time subscriptions

## Navigation Architecture

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

## State Management Pattern

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
- `src/utils/subwayMapData.ts`: Station coordinates and metadata
- `src/utils/subwayLinePaths.ts`: SVG path definitions for all 9 lines
- `src/utils/mapLayout.ts`: Layout calculations and zoom/pan logic

**Design System:** Follows Seoul Metro 2024 official design standards.
