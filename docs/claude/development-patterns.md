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

## Known Issues & Workarounds

1. **Firebase Firestore Offline Persistence**: Not enabled by default in React Native. The app relies on AsyncStorage cache layer instead.
2. **Seoul API Rate Limiting**: No official rate limits documented, but the app implements 30-second polling intervals to be conservative.
3. **Location Permissions on iOS**: Requires `NSLocationWhenInUseUsageDescription` in app.json. Always request permissions before accessing GPS.
4. **TypeScript Path Aliases in Tests**: Configured in jest.config.js `moduleNameMapper`. If tests fail with module resolution errors, verify the mapping matches tsconfig.json paths.
