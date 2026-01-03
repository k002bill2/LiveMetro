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
```

### Firebase Subscription Pattern

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
