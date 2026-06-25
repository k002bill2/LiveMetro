---
name: location-services
description: Expo Location 기반 위치/GPS 작업. 위치 권한 요청, 현재 위치(cold-start degradation chain) 획득, 주변역 찾기, Haversine 거리 계산, 거리 포맷팅, 오프라인 last-known fix 게이팅을 구현할 때 사용. 단, 좌표를 받은 뒤의 역 조회/검색/실시간 도착정보 소비는 station-info, Seoul API 원시 응답 정규화는 subway-data-processor 소관.
---

# Location Services Guidelines

## When to Use
- Requesting location permissions
- Getting user's current position
- Finding nearby subway stations
- Calculating distances between coordinates

## Setup

### Installation
```bash
npx expo install expo-location
```

### Configuration (app.json)
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "LiveMetro needs your location to find nearby subway stations."
      }
    },
    "android": {
      "permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
    }
  }
}
```

## Core Patterns

### Permission Request
```typescript
import * as Location from 'expo-location';

const requestPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};
```

### Get Current Location
A bare `getCurrentPositionAsync({ Balanced })` is **wrong** for this app — on a cold
GPS / indoors / simulator it throws `kCLErrorLocationUnknown` and the UI renders
"현재 위치를 가져올 수 없습니다". Use the service, which encodes a degradation chain
(`locationService.getCurrentLocation`, locationService.ts:207):

```typescript
import { locationService } from '@services/location/locationService';

// highAccuracy=false → Balanced primary; true → High primary (NOT BestForNavigation —
// nav-grade fixes are GPS-only and slowest to cold-start; ~10m is ample for stations).
const location = await locationService.getCurrentLocation(highAccuracy);
```

Chain (code order, `getCurrentLocation:207`): recent **last-known** fix first
(maxAge 60s · requiredAccuracy 100m gate) → on miss, **primary fix** (High or
Balanced) → on miss, retry once at **Balanced** (resolves via wifi/cell where GPS
could not) → on miss, **coarse last-resort** fix (`acceptCoarse`, ≤3km via
`MAX_COARSE_FALLBACK_ACCURACY_M`; label derived UI as 추정/estimated).
Each attempt returns `null` (not throw) on a transient miss so the next link runs.
A `null` result means *all* links failed — surface it, don't crash.

### Distance Calculation
Do **not** reach for `geolib` — the app already ships a Haversine implementation on
the service. Reusing it keeps every distance (nearby search, geofence, vicinity)
on one formula. Note the signature is **four scalars, not coordinate objects**
(`locationService.calculateDistance`, locationService.ts:485):

```typescript
import { locationService } from '@services/location/locationService';

const distance = locationService.calculateDistance(
  currentLocation.latitude,
  currentLocation.longitude,
  station.coordinates.latitude,
  station.coordinates.longitude
); // meters
```

### Distance Formatting
Do **not** hand-roll a formatter — the service already exposes the same
m/km rounding (`<1000 → round+'m'`, else `(m/1000).toFixed(1)+'km'`).
Reuse it so every label stays on one formula
(`locationService.formatDistance`, locationService.ts:802):

```typescript
import { locationService } from '@services/location/locationService';

const label = locationService.formatDistance(distance); // e.g. "850m" / "1.2km"
```

## Accuracy Levels

| Level | Accuracy | Use Case |
|-------|----------|----------|
| `Lowest` | ~3000m | Battery-friendly background |
| `Low` | ~1000m | Rough proximity |
| `Balanced` | ~100m | **Nearby stations (recommended)** |
| `High` | ~10m | Precise location |
| `Highest` | GPS | Maximum precision |

## Error Handling

```typescript
const handleLocationError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('permission')) {
      return 'Location permission is required';
    }
    if (error.message.includes('timeout')) {
      return 'Location request timed out';
    }
  }
  return 'Failed to get location';
};
```

## Best Practices

1. **Request Permission at Right Time**
   ```tsx
   // ❌ Bad: On app launch
   // ✅ Good: When user clicks "Find Nearby"
   const handleFindNearby = async () => {
     const hasPermission = await requestPermission();
     if (hasPermission) { /* proceed */ }
   };
   ```

2. **Handle Permission Denial**
   - Check `canAskAgain` from `getForegroundPermissionsAsync()`
   - If `false`, direct user to Settings with `Linking.openSettings()`

3. **Cache Location**
   - Cache for 60 seconds to reduce GPS usage
   - Return cached on repeated requests

4. **Handle Offline — but gate last-known on quality, not just age**
   - Returning *any* last-known fix is the A2 bug: `maxAge` bounds staleness, not
     quality, so a fresh-but-coarse cell-tower fix would slip through and place
     the user at the wrong station. The service gates on **both**:
     `getLastKnownPositionAsync({ maxAge: 60s, requiredAccuracy: 100m })`
     (locationService.ts:341-343, constants `LAST_KNOWN_MAX_AGE_MS` /
     `LAST_KNOWN_REQUIRED_ACCURACY_M`). `requiredAccuracy` makes expo-location
     return `null` for coarse cached fixes, so the chain advances to a live retry.
   - Never hand a coarse last-known fix to nearby-station logic as if it were live.

5. **Be honest about a low-confidence fix (A4)**
   - A live fix is only *accepted* when `accuracy <= MAX_ACCEPTABLE_ACCURACY_M`
     (=500m, locationService.ts:40). So an accepted fix can still be 100–500m
     coarse — the last-known path requires ≤100m, but a live `tryGetPosition` does
     not. When a fix is **>100m or its accuracy is null/unknown**, label derived
     UI as 추정 (estimated) with a neutral tone.
   - Do **not** assert "인근 OO역" / "가장 가까운 역" as fact off a coarse fix — at
     500m uncertainty the nearest-station pick is a guess, and a wrong definitive
     claim reads as a bug. Reserve confident proximity copy for fixes you trust.

## BANNED (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `coords.accuracy \|\| undefined` | `coords.accuracy ?? undefined` | accuracy `0`(정밀 fix)이 falsy라 `\|\|`는 undefined로 뭉갬 → 다운스트림 게이트가 "정밀 0"과 "unknown"을 구분 못 함. 옳은 형태는 toCoordinates(locationService.ts:364, `accuracy ?? undefined`). |
| `location.accuracy \|\| null` | `location.accuracy ?? null` | 동일한 0-falsy. accuracy `0`이 null로 보고됨 → 정밀도 표시·신뢰도 게이트 오작동. |
| 좌표 생성을 역명 fuzzy 매칭으로 | BLDN_ID(=station_cd) 직접 매핑 | 옛 생성기의 name-only fuzzy fallback이 354역을 9–12km 오배정(PR #241로 재작성 해결) |

> accuracy 0-falsy 금지는 `seoul-api-limits.md`의 `arrivalTime ? …`(0초 도착이 null
> 처리됨) BANNED와 동급 원칙이다 — 둘 다 `0`은 유효값이므로 `\|\|`가 아니라 `??`로
> 분기해야 한다.

## 좌표 데이터 무결성 (stationCoordinates.json)

- `stationCoordinates.json`은 **BLDN_ID(=station_cd) 직접 매핑만** 쓴다. API 행이
  `BLDN_ID`로 키잉되고 이게 앱 전역의 `station_cd`와 동일하므로 좌표는 이름/노선
  매칭 없이 바로 매핑된다(`scripts/fetchStationCoordinates.ts:8-10,77`).
- **좌표 생성에 역명 fuzzy 매칭 금지.** 옛 생성기의 name-match + name-only fuzzy
  fallback이 354역을 ~9–12km 남쪽으로 오배정했고, 생성기를 BLDN_ID 직접 매핑으로
  재작성(PR #241)해 해결했다. fuzzy로 회귀하면 같은 대량 오배정이 재발한다.
- 혼동 주의: `subway-data-processor` 스킬의 Best Practice "역명 fuzzy matching"은
  **역명 해석(name resolution)용**이지 **좌표 생성과 무관**하다. 좌표 생성에는 절대
  적용하지 말 것.

## Important Notes

- Always explain WHY you need location permission
- Default to `Accuracy.Balanced` for nearby stations (battery + accuracy), but
  don't pin to it: the cold-start recovery path *starts* High (when
  `highAccuracy`) and **degrades to Balanced** on miss. Go through
  `locationService.getCurrentLocation`, not a hand-rolled single fix.
- Test on both iOS and Android (permission flows differ)
- Clean up background tracking when not needed

## Reference Documentation

For complete implementations, see [references/hooks-examples.md](references/hooks-examples.md):
- useLocation hook
- useNearbyStations hook
- Background location tracking
- Permission states handling
- Testing mocks
