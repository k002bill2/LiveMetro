# Development Patterns

## Adding a New Screen

1. Create screen component in `src/screens/{category}/{ScreenName}.tsx`
2. Add route params to `src/navigation/types.ts` (AppStackParamList or AppTabParamList)
3. Register route in `AppNavigator.tsx` or `RootNavigator.tsx`
4. Use TypeScript navigation prop typing:
   ```typescript
   import { NativeStackScreenProps } from '@react-navigation/native-stack';
   import { AppStackParamList } from '@/navigation/types';

   type Props = NativeStackScreenProps<AppStackParamList, 'ScreenName'>;
   ```

## Creating a Custom Hook

1. Create in `src/hooks/use{FeatureName}.ts`
2. Return object with loading, error, data, and action functions
3. Include cleanup logic for subscriptions/timers
4. Add unit tests in `src/hooks/__tests__/`

## Adding API Integration

1. Create service in `src/services/{domain}/{serviceName}.ts`
2. Export singleton instance (lowercase): `export const serviceName = new ServiceClass()`
3. Handle errors gracefully - return empty arrays/null instead of throwing
4. Integrate with `dataManager` for caching and offline support

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

## Performance Patterns

These patterns were established during the 2026-04-25 ~ 05-03 performance overhaul. Apply consistently across new screens and hooks.

### 1. Polling Gating with `useIsFocused`

Background polling continues by default after a screen loses focus, burning Seoul API quota and JS thread cycles. Always gate polling-based hooks with focus state.

```typescript
// Hook supports an enabled flag
function useDelayDetection({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    // ... fetch + polling logic
  }, [enabled]);
}

// Screen passes useIsFocused()
const isFocused = useIsFocused();
useDelayDetection({ enabled: isFocused });
```

For child components that own subscriptions (e.g., `StationCard`), expose an `arrivalsEnabled` prop and pass `useIsFocused()` from the parent screen. Default to `true` for backward compatibility with non-screen call sites.

### 2. Pub/Sub over Polling

Replace `setInterval`-based state sync with `subscribe()`/`emit()` whenever the source of truth is a service in the same process.

```typescript
// Service exposes pub/sub
class CurrentStationAlertService {
  private listeners = new Set<() => void>();
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit() {
    this.listeners.forEach(l => l());
  }
}

// Hook subscribes once, no interval
useEffect(() => {
  return service.subscribe(() => setState(service.getValue()));
}, []);
```

Benchmark: 5s `setInterval` × 3 hooks = ~60 setStates/min when both screens active. Pub/sub: 0 setStates until mutation.

### 3. Stable Callback References for `React.memo`

`React.memo` is broken by inline arrow functions. Wrap event handlers in `useCallback`, and cache per-item closures in a `useMemo` Map keyed by item ID.

```typescript
const handlePress = useCallback((stationId: string) => {
  navigation.navigate('Detail', { stationId });
}, [navigation]);

const onPressByStation = useMemo(() => {
  const map = new Map<string, () => void>();
  stations.forEach(s => map.set(s.id, () => handlePress(s.id)));
  return map;
}, [stations, handlePress]);

// In FlatList renderItem:
<StationCard onPress={onPressByStation.get(item.id)!} />
```

### 4. Isolate Ticking State in Sub-components

A `setInterval` on the screen root re-renders the entire scroll tree once a tick. Extract the ticking node into a small child so the re-render is confined.

```typescript
// Bad: tick re-renders entire StationDetailScreen
function StationDetailScreen() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return <View>... <Text>{format(now)}</Text> ...</View>;
}

// Good: only LiveClock re-renders
function LiveClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return <Text>{format(now)}</Text>;
}
```

### 5. FlatList over `ScrollView + .map()`

Always virtualize lists. Provide `keyExtractor`, `ListEmptyComponent`, and `removeClippedSubviews`. Memoize `renderItem`.

### 6. Callback Ref Stash for Subscription Hooks

When a hook accepts callback props (`onError`, `onDataReceived`), stashing them in refs (updated via `useLayoutEffect`) prevents inline parent callbacks from churning the underlying subscription on every parent render.

```typescript
function useRealtimeTrains({ onError, onDataReceived }: Options) {
  const onErrorRef = useRef(onError);
  const onDataReceivedRef = useRef(onDataReceived);
  useLayoutEffect(() => {
    onErrorRef.current = onError;
    onDataReceivedRef.current = onDataReceived;
  });

  const handleData = useCallback((data: Data) => {
    onDataReceivedRef.current?.(data);
  }, []); // No callback deps → stable reference

  useEffect(() => {
    return service.subscribe(handleData);
  }, [handleData]);
}
```

## Schedule & Time Patterns

### Numeric Time Comparison

Use `toSecondsOfDay()` (`src/utils/timeUtils.ts`), not string comparison:

```typescript
import { toSecondsOfDay } from '@/utils/timeUtils';

// Bad: lexicographic — "9:35:00" > "14:30:00"
schedule.sort((a, b) => a.time.localeCompare(b.time));

// Good: numeric
schedule.sort((a, b) => toSecondsOfDay(a.time) - toSecondsOfDay(b.time));
```

`toSecondsOfDay` accepts non-zero-padded times (`"9:35:00"`) and hours ≥ 24 (`"25:30:00"` for next-day rows).

### Korean Public Holiday Detection

`isKoreanHoliday()` (`src/utils/koreanHolidays.ts`) covers fixed-date + 대체공휴일 + 음력 holidays for 2025-2027. Use when computing `WEEK_TAG`:

```typescript
import { isKoreanHoliday } from '@/utils/koreanHolidays';

function getWeekTag(date: Date): '1' | '2' | '3' {
  if (isKoreanHoliday(date)) return '3';
  const day = date.getDay();
  if (day === 0) return '3';
  if (day === 6) return '2';
  return '1';
}
```

⚠️ Yearly maintenance: holiday list expires after 2027 (TODO marker in source).

### Late-Night Schedule Carry-Over

At 22:00+, include schedule rows < 03:00 next-day as upcoming. Seoul subway runs until ~01:00.

## Known Issues & Workarounds

1. **Firebase Firestore Offline Persistence**: Not enabled by default in React Native. The app relies on AsyncStorage cache layer instead.
2. **Seoul API Rate Limiting**: No official rate limits documented, but the app implements 30-second polling intervals to be conservative.
3. **Location Permissions on iOS**: Requires `NSLocationWhenInUseUsageDescription` in app.json. Always request permissions before accessing GPS.
4. **TypeScript Path Aliases in Tests**: Configured in jest.config.js `moduleNameMapper`. If tests fail with module resolution errors, verify the mapping matches tsconfig.json paths.
