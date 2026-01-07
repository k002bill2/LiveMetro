# API Reference

## Seoul Metro API Integration

### Real-Time Arrival API

**Base URL:** `http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}`

**Key Fields in Response:**
| Field | Description |
|-------|-------------|
| `arvlMsg2`, `arvlMsg3` | Arrival messages ("2분후[1번째전]", "곧 도착") |
| `btrainNo` | Train number |
| `updnLine` | Direction ("상행" = up, "하행" = down) |
| `trainLineNm` | Line name |
| `bstatnNm` | Destination station |

### Timetable API

**Base URL:** `http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/`

**Parameters:**
| Parameter | Values |
|-----------|--------|
| `WEEK_TAG` | '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday) |
| `INOUT_TAG` | '1' (Up/Inner), '2' (Down/Outer) |

### Service Disruption Detection

The `dataManager.detectServiceDisruptions()` method scans arrival messages for keywords:
- **Suspension:** "운행중단", "전면중단", "운행불가"
- **Incidents:** "장애", "고장", "사고", "탈선", "화재"

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

delayReports/         # User-submitted delay reports (Phase 3)
  ├─ userId           # Report author's user ID
  ├─ userDisplayName  # Author's display name
  ├─ lineId           # Affected line (1-9)
  ├─ stationId        # Station where delay observed
  ├─ stationName      # Station name (display)
  ├─ reportType       # DELAY | ACCIDENT | CROWDED | SIGNAL_ISSUE | DOOR_ISSUE | STOPPED | OTHER
  ├─ severity         # LOW | MEDIUM | HIGH | CRITICAL
  ├─ description      # Optional detailed description
  ├─ estimatedDelayMinutes  # Optional delay estimate
  ├─ timestamp        # Report submission time
  ├─ expiresAt        # Auto-expire time (default: timestamp + 2 hours)
  ├─ upvotes          # Upvote count
  ├─ upvotedBy[]      # User IDs who upvoted
  ├─ verified         # Official verification status
  └─ status           # ACTIVE | RESOLVED | EXPIRED
```

### Firebase Subscription Pattern

```typescript
// Train updates subscription
const unsubscribe = trainService.subscribeToTrainUpdates(
  stationId,
  (trains) => {
    // Handle real-time updates
  }
);

// Clean up on unmount
return () => unsubscribe();
```

### Delay Reports Subscription

```typescript
import { delayReportService } from '@/services/delay/delayReportService';

// Subscribe to real-time delay reports
const unsubscribe = delayReportService.subscribeToActiveReports(
  (reports) => {
    // Handle new reports
  }
);

// Submit a new report
await delayReportService.submitReport({
  userId: user.id,
  userDisplayName: user.displayName || 'Anonymous',
  lineId: '2',
  stationId: 'gangnam',
  stationName: '강남',
  reportType: ReportType.DELAY,
  severity: ReportSeverity.MEDIUM,
  description: '열차가 10분째 멈춰있습니다',
  estimatedDelayMinutes: 10,
});

// Upvote a report
await delayReportService.upvoteReport(reportId, userId);
```

**Important:** Always clean up Firebase subscriptions in useEffect return functions to prevent memory leaks.

## Environment Variables

Required environment variables (use `.env` file):

```bash
# Seoul Open Data API
EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY=your_api_key_here
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
