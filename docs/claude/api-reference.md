# API Reference

## Seoul Metro API Integration

### Real-Time Arrival API

**Base URL:** `http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}`

**Key Fields in Response:**
| Field | Description |
|-------|-------------|
| `arvlMsg2`, `arvlMsg3` | Arrival messages ("2분후[1번째전]", "곧 도착") |
| `barvlDt` | Remaining seconds until arrival (numeric, **prefer this over `arvlMsg2` text parsing**) |
| `arvlCd` | Arrival status code: `'0'` 진입, `'1'` 도착, `'2'` 출발(당역 출발), `'3'` 전역 출발, `'4'` 전역 진입, `'5'` 전역 도착, `'99'` 운행 중 |
| `btrainNo` | Train number |
| `ordkey` | Sequence key (used in `trainId` derivation alongside `btrainNo` + `statnId`) |
| `updnLine` | Direction (`'상행'` / `'하행'` / `'내선'` / `'외선'` — 2호선 순환선은 `'내선'`/`'외선'` 사용) |
| `trainLineNm` | Line name |
| `bstatnNm` | Destination station |
| `statnId` | Station ID (4-digit, e.g., `'0222'`) |

**Filtering rules** (applied in `arrivalService.convertToArrivalInfo`):
- `arvlCd === '2'` (당역 출발): excluded — train just left, no actionable info
- Empty result sets are **not cached** to avoid 60s stale empty state

**trainId derivation**: `${btrainNo}_${ordkey}_${statnId}_${index}` (deterministic, FlatList-key safe).
Avoid `Date.now()` in IDs — it churns every poll and breaks memoization.

### Timetable API

**Base URL:** `http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/`

**Parameters:**
| Parameter | Values |
|-----------|--------|
| `WEEK_TAG` | '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday) |
| `INOUT_TAG` | '1' (Up/Inner), '2' (Down/Outer) |

**Authentication key**: separate from real-time API.
- Real-time arrivals: `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` (실시간 인증키)
- Timetable: `EXPO_PUBLIC_DATA_PORTAL_API_KEY` (일반 인증키, "데이터 포털")
- Cross-using keys returns 401. Both keys are issued from the same data.seoul.go.kr account but require separate application.

**Key fallback**: `timetableKeyManager` rotates between primary/secondary keys (`EXPO_PUBLIC_DATA_PORTAL_API_KEY` + `_KEY_2`) on quota exhaustion or auth failure. On parse failure (XML/HTML response when key invalid), `timetableKeyManager.reportError()` is called automatically.

**`WEEK_TAG` derivation**:
- Weekday → `'1'`, Saturday → `'2'`, Sunday → `'3'`
- **Korean public holidays falling on weekdays also use `'3'`** — handled by `isKoreanHoliday()` (`src/utils/koreanHolidays.ts`). Without this, ~12-15 days/year show wrong schedule (e.g., 어린이날 화요일).

**Web platform**: Timetable endpoint is HTTP-only (mixed-content blocked in browsers). Calls from `Platform.OS === 'web'` throw `TimetableUnsupportedOnWebError`. UI surfaces this as "시간표는 모바일 앱에서 확인할 수 있습니다" instead of empty state.

**Time comparison**: Use `toSecondsOfDay()` (`src/utils/timeUtils.ts`) — accepts non-zero-padded `"9:35:00"` and hours ≥ 24 (next-day rows like `"25:30:00"`). String lexicographic compare ranks `"9:35:00" > "14:30:00"` (broken).

**Late-night carry-over**: At 22:00+, include schedule rows < 03:00 as upcoming. Seoul subway runs until ~01:00 next-day; otherwise users at 23:55 see zero upcoming trains.

**Observability on parse failure**: When `SearchSTNTimeTableByIDService` returns XML/HTML (typical for invalid key or quota exhaustion), the response is cloned, content-type and first 300 bytes are logged with the **API key masked**, and the error is rethrown with diagnostic context.

### Service Disruption Detection

The `dataManager.detectServiceDisruptions()` method scans arrival messages for keywords:
- **Suspension:** "운행중단", "전면중단", "운행불가"
- **Incidents:** "장애", "고장", "사고", "탈선", "화재"

### Delay Detection (currently disabled)

`dataManager.detectDelays()` returns `[]` as of 2026-04-25. The previous implementation treated "time until arrival" as schedule deviation, flagging every train >5 min out as "delayed" — false alerts on every normal trip.

Real delay detection requires comparing realtime arrivals against the timetable (`seoulSubwayApi.getStationTimetable`). Tracked as follow-up work; do not re-enable without timetable cross-reference.

### arrivalService Contract (`src/services/arrival/arrivalService.ts`)

Wraps `seoulSubwayApi` with rate limiting (30s min polling), retry (exponential backoff), AsyncStorage caching, and subscription multiplexing. Singleton `arrivalService` exported alongside the `ArrivalService` class for custom instances.

**Public API**:

```typescript
arrivalService.getArrivals(
  stationName: string,
  options?: GetArrivalsOptions
): Promise<ArrivalInfo>

arrivalService.subscribe(
  stationName: string,
  callback: (arrival: ArrivalInfo | null, error?: Error) => void,
  intervalMs?: number,
  options?: GetArrivalsOptions
): () => void  // unsubscribe

arrivalService.clearCache(stationName?: string): Promise<void>
arrivalService.destroy(): void
```

**`GetArrivalsOptions.throwOnError`** (PR #140, added 2026-05-17):

By default, `getArrivals` swallows `fetchWithRetry` errors and falls back to cached data, or returns an empty `ArrivalInfo` (`source: 'cache'`) when no cache exists. This is the *legacy behavior* — `throwOnError: false`.

When `throwOnError: true`, the retry chain still runs in full, but the cache fallback layer is bypassed: the original error (often `SeoulApiError` with a category — `quota` / `auth` / `transient` / `rateLimit` / `network`) is re-thrown. Subscribers receive the error via the second callback argument.

| Caller | `throwOnError` | Reason |
|--------|----------------|--------|
| `dataManager.subscribeToRealtimeUpdates` | `true` | Routes errors to `ErrorFallback` (`src/components/common/ErrorFallback.tsx`) which branches on `SeoulApiError.category` for user-friendly copy. Direct cache fallback would mask the category and reduce diagnostic value. |
| Direct callers of `arrivalService.getArrivals` (legacy) | `undefined` / `false` | Cache fallback preserves stale data on transient outages — acceptable for code paths that don't surface errors to a category-aware UI. |

**Caching policy summary**:

- Successful arrivals (`arrivals.length > 0`): cached with TTL `cacheTTL` (default 60s).
- Empty arrivals: **not** cached — next call re-fetches immediately (avoids 60s of stale empty state on transient API hiccup).
- Within `minPollingInterval` (30s default): cached data returned without API hit. This is the legal Seoul API rate-limit floor.
- On failure with `throwOnError: false`: cache (if present, regardless of expiry-vs-polling-interval), then empty-info, then never throws.
- On failure with `throwOnError: true`: original error re-thrown after retries exhaust. Cache is not consulted.

**Subscription multiplexing**: Multiple subscribers for the same `stationName` share a single polling interval. The interval starts on first subscriber and stops on last unsubscribe. Each subscriber receives every poll's result independently. `options` from the first subscriber wins for the interval-level behavior (throwOnError applies to all subsequent polls).

**Cleanup**: `arrivalService.destroy()` clears all intervals + subscriptions + fetch timestamps. Tests must call it in `afterEach`.

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

Copy `.env.example` to `.env` and fill in actual values. **`.env` is git-ignored** (`.gitignore:24`); never commit secrets.

```bash
# Firebase Configuration (all prefixed with EXPO_PUBLIC_ for client access)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Seoul Open Data API — Real-Time Arrival (실시간 인증키)
# Up to 3 keys for fallback rotation via timetableKeyManager
EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY=
EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2=
EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_3=
SEOUL_SUBWAY_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway

# Seoul Open Data API — Data Portal (일반 인증키, separate application required)
# Used for timetable, station info, and other static data endpoints
EXPO_PUBLIC_DATA_PORTAL_API_KEY=
EXPO_PUBLIC_DATA_PORTAL_API_KEY_2=
```

**Notes**:
- Expo requires `EXPO_PUBLIC_` prefix for variables accessible in client code.
- Real-time and data portal keys are **separately issued** from data.seoul.go.kr — using one for the other returns 401.
- `.editorconfig` enforces `[.env*] trim_trailing_whitespace = true` + `indent_style = unset` to prevent silent dotenv parsing failures from leading indent or trailing whitespace.

**Migration note (2026-05-03)**: Variable `EXPO_PUBLIC_DATA_GO_KR_API_KEY` was renamed to `EXPO_PUBLIC_DATA_PORTAL_API_KEY`. Update local `.env` and CI/CD secret stores accordingly.
