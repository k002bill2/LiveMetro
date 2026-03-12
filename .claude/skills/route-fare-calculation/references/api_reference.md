# Route & Fare API Reference

## routeService (Singleton)

`import { routeService } from '@services/route';`

### calculateRoute

기본 A* 경로 탐색.

```typescript
calculateRoute(
  fromStationId: string,
  toStationId: string,
  excludeLineIds?: readonly string[]
): Route | null
```

- `excludeLineIds`: 제외할 노선 (장애 우회용)
- 반환: `Route` 또는 경로 없으면 `null`

### calculateEnhancedRoute

요금 + 실시간 지연 반영 경로.

```typescript
calculateEnhancedRoute(
  fromStationId: string,
  toStationId: string,
  excludeLineIds?: readonly string[],
  delays?: DelayInfo[]
): EnhancedRoute | null
```

- `DelayInfo`: `{ lineId: string; delayMinutes: number; reason?: string }`
- 반환: `EnhancedRoute` (Route + fare + stationCount)

### calculateRouteWithDelays

지연 반영 경로 (요금 제외).

```typescript
calculateRouteWithDelays(
  fromStationId: string,
  toStationId: string,
  delays: DelayInfo[]
): Route | null
```

### findAlternativeRoutes

장애 노선 제외 대안 경로.

```typescript
findAlternativeRoutes(
  fromStationId: string,
  toStationId: string,
  affectedLineIds: readonly string[],
  reason: AlternativeReason,
  options?: AlternativeRouteOptions
): AlternativeRoute[]
```

- `AlternativeReason`: `'DELAY' | 'SUSPENSION' | 'CONGESTION'`
- `AlternativeRouteOptions`:
  - `excludeLineIds`: 추가 제외 노선
  - `maxTransfers`: 최대 환승 횟수 (default: 4)
  - `maxTimeDifference`: 최대 시간차 (default: 30분)
  - `preferFewerTransfers`: 환승 적은 경로 선호

### findMultipleAlternatives

복수 대안 경로 (각 노선 개별 제외 + 전체 제외).

```typescript
findMultipleAlternatives(
  fromStationId: string,
  toStationId: string,
  affectedLineIds: readonly string[],
  reason: AlternativeReason,
  maxAlternatives?: number  // default: 3
): AlternativeRoute[]
```

### compareRoutes

두 경로 비교.

```typescript
compareRoutes(route1: Route, route2: Route): {
  fasterRoute: 1 | 2 | 'equal';
  timeDifference: number;
  transferDifference: number;
  recommendation: string;  // 한국어 추천 메시지
}
```

### getRouteSummary / routeUsesLine / getStationInfo / getLineColor

```typescript
getRouteSummary(route: Route): string           // "2호선 → 3호선"
routeUsesLine(route: Route, lineId: string): boolean
getStationInfo(stationId: string): { id, name, lines } | null
getLineColor(lineId: string): string            // "#33A474"
```

---

## fareService (Singleton)

`import { fareService } from '@services/route';`

### calculateFare

역 수 기반 요금 계산.

```typescript
calculateFare(stationCount: number, fareType?: FareType): FareResult
```

- `FareType`: `'regular' | 'youth' | 'child' | 'senior'`
- 내부: `estimateDistance()` → `calculateFareByDistance()`

### calculateFareByDistance

거리 기반 직접 계산.

```typescript
calculateFareByDistance(distanceKm: number, fareType?: FareType): FareResult
```

**요금 로직:**
1. `senior` → 전액 무료 (0원)
2. `distance <= 10km` → baseFare만
3. `10~50km` → baseFare + ceil((distance-10)/5) * additionalPerUnit
4. `50km+` → 위 + ceil((distance-50)/8) * additionalPerUnit

### getRouteFareInfo

환승 포함 경로 요금 정보.

```typescript
getRouteFareInfo(
  stationCount: number,
  hasTransfer?: boolean,
  fareType?: FareType
): RouteFareInfo
```

### compareFares

두 경로 요금 비교.

```typescript
compareFares(
  route1Stations: number,
  route2Stations: number,
  fareType?: FareType
): {
  route1Fare: FareResult;
  route2Fare: FareResult;
  difference: number;
  cheaperRoute: 1 | 2 | 'equal';
}
```

### Utility Methods

```typescript
formatFare(amount: number): string          // "1,400원"
getFareTypeLabel(fareType: FareType): string // "일반" | "청소년" | "어린이" | "경로"
estimateDistance(stationCount: number): number
calculateActualDistance(stationDistances: readonly number[]): number
```

---

## kShortestPath

`import { findKShortestPaths, getDiverseRoutes } from '@services/route';`

### findKShortestPaths

Yen's Algorithm으로 K개 최단경로.

```typescript
findKShortestPaths(
  fromStationId: string,
  toStationId: string,
  k?: number  // default: 3
): KShortestPathResult
```

```typescript
interface KShortestPathResult {
  paths: readonly Route[];
  k: number;
  fromStationId: string;
  toStationId: string;
  executionTimeMs: number;
}
```

### getDiverseRoutes

유사도 필터링된 다양한 경로.

```typescript
getDiverseRoutes(
  fromStationId: string,
  toStationId: string,
  minDiversity?: number  // default: 0.3 (Jaccard 기반)
): Route[]
```

- 내부: `findKShortestPaths(from, to, 10)` 후 Jaccard 유사도로 필터링
- 최대 3개 반환

---

## Model Utilities

`import { ... } from '@models/route';`

### Factory Functions

```typescript
createRoute(segments: readonly RouteSegment[]): Route
createAlternativeRoute(
  original: Route, alternative: Route,
  reason: AlternativeReason, affectedLineId: string,
  confidence?: number
): AlternativeRoute
```

### Calculation Helpers

```typescript
calculateRouteTotalTime(segments: readonly RouteSegment[]): number
countTransfers(segments: readonly RouteSegment[]): number
getRouteLineIds(segments: readonly RouteSegment[]): string[]
```

### Display Helpers

```typescript
getLineName(lineId: string): string                    // "2호선"
formatTimeDifference(minutes: number): string          // "+5분" | "-3분" | "동일"
getTimeDifferenceSeverity(minutes: number):
  'faster' | 'same' | 'slower' | 'much_slower'
```

---

## PriorityQueue

`import { PriorityQueue } from '@/utils/priorityQueue';`

Min-Heap 기반. A*, Dijkstra, Yen's에서 공통 사용.

```typescript
class PriorityQueue<T> {
  get size(): number;
  isEmpty(): boolean;
  enqueue(item: T, priority: number): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  peekPriority(): number | undefined;
  updatePriority(item: T, newPriority: number, compareFn: (a: T, b: T) => boolean): boolean;
  contains(item: T, compareFn: (a: T, b: T) => boolean): boolean;
  clear(): void;
}
```

---

## useAlternativeRoutes Hook

`import { useAlternativeRoutes } from '@hooks/useAlternativeRoutes';`

### Options

```typescript
interface UseAlternativeRoutesOptions {
  delays?: DelayInfo[];
  maxAlternatives?: number;       // default: 3
  routeOptions?: AlternativeRouteOptions;
  autoCalculate?: boolean;        // default: false
}
```

### Return Value

```typescript
interface UseAlternativeRoutesResult {
  originalRoute: Route | null;
  alternatives: AlternativeRoute[];
  loading: boolean;
  error: string | null;
  calculate: (from: string, to: string, reason?: AlternativeReason) => Promise<void>;
  clear: () => void;
  hasAffectedRoute: boolean;
  affectedLineIds: string[];
}
```

### Exported Utilities

```typescript
getDelayReason(delayInfo: DelayInfo): AlternativeReason
formatRouteDisplay(route: Route): string           // "강남 → 종로3가"
getTransferStations(route: Route): string[]        // ["신도림", "교대"]
```
