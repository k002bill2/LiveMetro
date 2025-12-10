# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project**: LiveMetro - 실시간 서울 지하철 알림 앱
**Architecture**: React Native (Expo) + TypeScript + Firebase + Seoul Open API
**Development Status**: Active - Map visualization and real-time data integration

<vooster-docs>
- @vooster-docs/prd.md
- @vooster-docs/architecture.md
- @vooster-docs/guideline.md
- @vooster-docs/step-by-step.md
- @vooster-docs/clean-code.md
</vooster-docs>

## Essential Commands

```bash
# Development
npm start                    # Start Expo development server (press 'a' for Android, 'i' for iOS)
npm run android              # Run on Android device/emulator
npm run ios                  # Run on iOS device/simulator
npm run web                  # Run web version

# Testing
npm test                     # Run all Jest tests
npm run test:watch           # Watch mode for development
npm run test:coverage        # Generate coverage report

# Code Quality
npm run lint                 # ESLint with auto-fix
npm run type-check           # TypeScript compiler check (no emit)
npm run prebuild             # Full quality check (lint + type-check)

# Deployment
npm run build:development    # EAS development build (all platforms)
npm run build:ios            # Production iOS build
npm run build:android        # Production Android build
npm run submit:all           # Submit to app stores
```

## Core Architecture

### Data Flow (3-Tier Fallback System)
```
Seoul Open API (primary)
    ↓ (failure/offline)
Firebase Firestore (cloud backup)
    ↓ (failure/offline)
AsyncStorage (local cache)
```

**Key Service Files**:
- `src/services/data/dataManager.ts` - Orchestrates 3-tier data fallback
- `src/services/api/seoulSubwayApi.ts` - Seoul Open API client
- `src/services/notification/notificationService.ts` - Push notification system
- `src/services/location/locationService.ts` - GPS and geofencing
- `src/services/firebase/config.ts` - Firebase configuration

### Map Visualization System
Recent implementation of interactive Seoul subway map with 2024 design system:
- `src/components/map/SubwayMapCanvas.tsx` - Gesture-based zoomable map with Reanimated
- `src/utils/mapLayout.ts` - Map coordinate system and path generation
- `src/utils/subwayMapData.ts` - Station data and line colors
- Uses `react-native-svg` for rendering, `react-native-gesture-handler` for interactions

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication UI
│   ├── common/         # Reusable components (buttons, cards, etc.)
│   ├── map/            # Subway map visualization (SubwayMapCanvas.tsx)
│   └── train/          # Train-specific components
├── hooks/              # Custom React hooks (useRealtimeTrains, useLocation, etc.)
├── models/             # TypeScript interfaces and types
├── screens/            # Top-level navigation screens
│   ├── home/           # Home screen (HomeScreen.tsx)
│   ├── favorites/      # Favorites screen
│   ├── alerts/         # Alerts screen
│   └── settings/       # Settings screen
├── services/
│   ├── api/            # seoulSubwayApi.ts - External API client
│   ├── data/           # dataManager.ts - 3-tier fallback orchestration
│   ├── location/       # locationService.ts - GPS tracking singleton
│   ├── notification/   # notificationService.ts - Push notifications
│   ├── train/          # trainService.ts - Train data processing
│   ├── monitoring/     # Performance, crash reporting, health checks
│   └── firebase/       # Firebase config and initialization
└── utils/
    ├── mapLayout.ts    # Map coordinate system
    ├── subwayMapData.ts # Station coordinates and line data
    ├── colorUtils.ts   # LINE_COLORS mapping
    └── formatUtils.ts  # Display formatting helpers
```

## Key Patterns and Conventions

### TypeScript Path Aliases
Configured in `tsconfig.json` and `jest.config.js`:
```typescript
import { Train } from '@models/train';
import { dataManager } from '@services/data/dataManager';
import { useRealtimeTrains } from '@hooks/useRealtimeTrains';
```

### Data Fetching Pattern
```typescript
// dataManager.ts handles 3-tier fallback automatically
const trains = await dataManager.getRealtimeTrains(stationName);
// Internally tries: Seoul API → Firebase → AsyncStorage → null
```

### Custom Hooks Usage
```typescript
// Hooks provide state management with error handling
const { trains, loading, error, refetch } = useRealtimeTrains(stationName, {
  refetchInterval: 30000,
  retryAttempts: 3
});
```

### Singleton Services
Key services are singletons (not classes to instantiate):
```typescript
import { locationService } from '@services/location/locationService';
import { notificationService } from '@services/notification/notificationService';

await locationService.initialize();
await notificationService.sendDelayAlert(stationName, lineName, delay, reason);
```

## TypeScript Configuration

**Strict Mode Features**:
- Full strict mode enabled (`strict: true`)
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` enforced
- `noUncheckedIndexedAccess` for safer array/object access
- Path aliases configured for cleaner imports

**Important**: `exactOptionalPropertyTypes` is set to `false` to allow flexible optional property handling.

## Testing

**Test Setup** (`jest.config.js`):
- Jest with React Native preset (jest-expo)
- TypeScript support via Babel
- Path aliases mirror `tsconfig.json`
- Coverage thresholds: 75% lines, 70% functions, 60% branches

**Running Tests**:
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report
```

**Test Location**:
- Unit tests: `src/**/__tests__/**/*.test.ts(x)`
- Service tests: `src/services/**/__tests__/*.test.ts`
- Coverage excludes: `src/models/`, test files, `.d.ts` files

## External APIs

### Seoul Open API
- **Base URL**: `http://swopenapi.seoul.go.kr/api/subway/`
- **Endpoint**: `/realtimeStationArrival/{startIndex}/{endIndex}/{stationName}`
- **Rate Limit**: 1000 requests/day on free tier
- **Test Script**: `scripts/testRealtimeApi.ts` - Use `npx ts-node` to run

### Firebase Configuration
- Configured in `src/services/firebase/config.ts`
- Services: Firestore (data backup), Auth (user management)
- Environment variables required (see `.env.example`)

## Working with the Subway Map

**Current Implementation** (as of latest commit):
- Interactive zoomable map using `react-native-gesture-handler` and `react-native-reanimated`
- 2024 Seoul Metro design system with accurate line widths and station styling
- File: `src/components/map/SubwayMapCanvas.tsx`

**Design Constants**:
```typescript
LINE_WIDTH_MAIN = 13;          // Main lines (1-9호선)
LINE_WIDTH_BRANCH = 10;        // Branch lines
STATION_RADIUS_REGULAR = 6;    // Regular stations
STATION_RADIUS_TRANSFER = 9;   // Transfer stations (traffic light style)
```

**Map Data Structure**:
- Station coordinates: `src/utils/subwayMapData.ts`
- Layout calculation: `src/utils/mapLayout.ts` (`createLinePaths()`)
- Line colors: `LINE_COLORS` constant matches official Seoul Metro colors

## Platform-Specific Configuration

**iOS** (`app.json`):
- Background location permission: `NSLocationAlwaysUsageDescription`
- UI background modes: `['location', 'remote-notification']`
- Non-exempt encryption: `false` (for App Store submission)

**Android** (`app.json`):
- Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- Blocked: `CAMERA`, `RECORD_AUDIO` (not used)
- Adaptive icon configured with `#1976d2` background

## Development Workflow

1. **Start development**: `npm start` → Press 'a' (Android) or 'i' (iOS)
2. **Before committing**: `npm run prebuild` (runs lint + type-check)
3. **Write tests**: Follow existing patterns in `src/services/**/__tests__/`
4. **Check coverage**: Aim for 75%+ line coverage on new code

## Environment Setup

Required in `.env`:
```bash
SEOUL_SUBWAY_API_KEY=your_key_here
SEOUL_SUBWAY_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway
# Firebase credentials
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
```

Test API connectivity: `npx ts-node scripts/testRealtimeApi.ts`

## Reference Documentation

Vooster-AI methodology guides (in `vooster-docs/`):
- `prd.md` - Product requirements and feature specifications
- `architecture.md` - Technical architecture decisions
- `guideline.md` - Coding standards and conventions
- `step-by-step.md` - Development methodology (Exploration → Planning → Execution)
- `clean-code.md` - Code quality guidelines

## Task Master AI Integration
Task Master workflow commands and guidelines: @./.taskmaster/CLAUDE.md
