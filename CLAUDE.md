# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project**: LiveMetro - 실시간 서울 지하철 알림 앱
**Architecture**: React Native + TypeScript + Firebase + Seoul Open API
**Development Status**: T-004 Complete - Production-ready real-time system  

<vooster-docs>
- @vooster-docs/prd.md
- @vooster-docs/architecture.md
- @vooster-docs/guideline.md
- @vooster-docs/step-by-step.md
- @vooster-docs/clean-code.md
</vooster-docs>

## Quick Start Commands

```bash
# Development
npm start              # Start Expo development server
npm run android        # Run on Android device/emulator  
npm run ios           # Run on iOS device/simulator
npm run web           # Run web version

# Quality Assurance
npm run lint          # Run ESLint with auto-fix
npm run type-check    # TypeScript type checking
npm test              # Run Jest tests
npm run prebuild      # Lint + TypeScript check

# Deployment  
npm run build         # Build for production
```

## Architecture Overview

**3-Tier Real-Time Data Architecture**:
```
Seoul Subway API → Firebase Firestore → Local AsyncStorage Cache
     ↓                    ↓                      ↓
Real-time data    Cloud sync/backup    Offline fallback
```

**Core Systems Implemented**:
- ✅ **Seoul API Integration** ([src/services/api/seoulSubwayApi.ts](src/services/api/seoulSubwayApi.ts))
- ✅ **Push Notifications** ([src/services/notification/notificationService.ts](src/services/notification/notificationService.ts))
- ✅ **Location Services** ([src/services/location/locationService.ts](src/services/location/locationService.ts))
- ✅ **Data Management** ([src/services/data/dataManager.ts](src/services/data/dataManager.ts))
- ✅ **Custom Hooks** ([src/hooks/](src/hooks/))
- ✅ **Utility Functions** ([src/utils/](src/utils/))

## Domain-Driven Structure

```
src/
├── components/          # UI components by domain
│   ├── auth/            # Authentication components
│   ├── common/          # Reusable UI components
│   └── train/           # Subway-specific components
├── hooks/               # Custom React hooks
│   ├── useRealtimeTrains.ts    # Real-time train data
│   ├── useLocation.ts          # GPS tracking
│   ├── useNearbyStations.ts    # Location-based stations
│   └── useNotifications.ts     # Push notification management
├── models/              # TypeScript type definitions
│   ├── train.ts         # Train, Station, Delay models
│   ├── notification.ts  # Notification preferences
│   └── user.ts          # User profile models
├── screens/             # App screens/pages
├── services/            # Business logic & external integrations
│   ├── api/             # Seoul Subway API client
│   ├── data/            # 3-tier data management
│   ├── location/        # GPS & geofencing
│   ├── notification/    # Push notification system
│   └── firebase/        # Firebase configuration
└── utils/               # Pure utility functions
    ├── colorUtils.ts    # Seoul subway line colors
    ├── dateUtils.ts     # Korean timezone formatting
    └── formatUtils.ts   # Display formatting
```

## Key Technical Patterns

### Real-Time Data Flow
```typescript
// Primary pattern: Multi-tier fallback with caching
const trainData = await dataManager.getRealtimeTrains(stationName);
// Tries: Seoul API → Firebase → Local Cache → null
```

### Custom Hook Pattern
```typescript
// Standard hook usage for real-time subscriptions
const { trains, loading, error, refetch } = useRealtimeTrains(
  stationName, 
  { refetchInterval: 30000, retryAttempts: 3 }
);
```

### Location-Based Services
```typescript
// Battery-optimized location tracking
await locationService.initialize();
const isTracking = locationService.startLocationTracking(
  (location) => console.log('Location updated:', location),
  { accuracy: Location.Accuracy.Balanced }
);
```

### Notification Management
```typescript
// Context-aware notification system
await notificationService.sendDelayAlert(
  stationName, 
  lineName, 
  delayMinutes, 
  reason
);
```

## Development Methodology

**Vooster-AI 3-Phase Approach**:
1. **Exploration**: Analyze requirements and current state
2. **Planning**: Create detailed implementation plan 
3. **Execution**: Systematic implementation with validation

**Reference Documentation**:
- [vooster-docs/step-by-step.md](vooster-docs/step-by-step.md) - Development methodology
- [vooster-docs/guideline.md](vooster-docs/guideline.md) - Coding standards
- [vooster-docs/architecture.md](vooster-docs/architecture.md) - Technical architecture
- [vooster-docs/clean-code.md](vooster-docs/clean-code.md) - Code quality guidelines

## API Integration Details

### Seoul Open API
- **Service**: Seoul Metropolitan Government Real-time Subway API
- **Endpoint**: `http://swopenAPI.seoul.go.kr/api/subway/`
- **Key Features**: Real-time arrivals, station info, service status
- **Rate Limits**: 1000 requests/day (production keys available)

### Firebase Services
- **Firestore**: Real-time database for train data sync
- **Auth**: User authentication and profile management  
- **Cloud Functions**: Server-side business logic
- **Performance**: Monitoring and crash reporting

## TypeScript Configuration

**Strict Mode Enabled**:
- `strict: true` with comprehensive type checking
- Path aliases configured for clean imports: `@/`, `@components/`, etc.
- Exact optional property types for enhanced type safety

**Import Pattern**:
```typescript
import { Train } from '@models/train';
import { dataManager } from '@services/data/dataManager'; 
import { useRealtimeTrains } from '@hooks/useRealtimeTrains';
```

## Common Development Tasks

### Adding New Station Features
1. Update [src/models/train.ts](src/models/train.ts) for new data types
2. Extend [src/services/api/seoulSubwayApi.ts](src/services/api/seoulSubwayApi.ts) with new endpoints
3. Create custom hook in [src/hooks/](src/hooks/) for state management
4. Add UI components in [src/components/train/](src/components/train/)
5. Update utility functions if needed

### Location-Based Features
- Use `locationService` singleton for GPS operations
- Implement geofencing through `addStationGeofence()`
- Handle permissions via `useLocation` hook
- Battery optimization built-in with smart intervals

### Notification Enhancements  
- Extend `NotificationPreferences` model
- Update `notificationService` with new alert types
- Configure notification channels in Expo config
- Test on both iOS and Android for platform differences

### Performance Optimization
- Utilize 3-tier caching strategy in `dataManager`
- Implement offline-first with AsyncStorage fallback
- Optimize location tracking intervals based on app state
- Use React.memo() for expensive train list renders

## Testing Strategy

**Current Test Setup**:
- Jest configured for unit tests
- TypeScript integration with type checking
- ESLint for code quality enforcement
- Prettier for consistent formatting

**Testing Priorities**:
1. API integration and error handling
2. Real-time data subscription reliability
3. Location services and geofencing accuracy
4. Notification delivery and user preferences
5. Offline functionality and cache behavior

## Environment Variables

**Required Configuration** (`.env`):
```
SEOUL_API_KEY=your_seoul_api_key
FIREBASE_API_KEY=your_firebase_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

## Deployment Considerations

**iOS Specific**:
- Location permission descriptions in [app.json](app.json)
- Background location requires special approval
- Push notification certificates required

**Android Specific**:
- Location permissions configured in [app.json](app.json)
- Notification channels properly configured
- Google Play Console setup for push notifications

## Known Issues & Solutions

### Location Services
- **Issue**: iOS background location requires always permission
- **Solution**: Request step-by-step permissions with clear UX

### API Rate Limits
- **Issue**: Seoul API daily limits for free tier
- **Solution**: Implemented intelligent caching and request batching

### Real-time Reliability
- **Issue**: Network connectivity affecting real-time updates
- **Solution**: 3-tier fallback system with offline support

## Development Team Guidance

**For New Features**: Follow vooster-ai methodology
**For Bug Fixes**: Use `dataManager` error handling patterns  
**For UI Changes**: Maintain Seoul subway color scheme consistency
**For API Changes**: Update both service layer and TypeScript models
**For Performance**: Leverage existing caching and optimization patterns

**Code Quality Standards**:
- TypeScript strict mode compliance required
- ESLint configuration must pass
- Unit tests for business logic components
- Documentation for public API functions

---

*Generated for T-004 completion - Production-ready real-time Seoul subway notification system*

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
