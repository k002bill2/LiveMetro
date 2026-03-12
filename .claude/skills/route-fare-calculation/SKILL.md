---
name: route-fare-calculation
description: "지하철 경로 탐색 및 요금 계산 시스템. A* 알고리즘, K-Shortest Path, 환승 처리, 요금 타입별 계산. Use when: (1) 경로 탐색/최단경로 구현, (2) 요금 계산 로직, (3) 환승 시간 계산, (4) 대안경로 비교. 트리거: 경로, route, fare, 요금, 환승, transfer, 최단경로, shortest path."
---

# Route Fare Calculation

## Overview

서울 지하철 경로 탐색(A*, Yen's K-Shortest Path)과 거리 기반 요금 계산 시스템. 실시간 지연 반영, 대안 경로 제안, 요금 타입별(성인/청소년/어린이/경로) 계산을 제공한다.

## Graph Structure

### Node Key Format

`{stationId}_{lineId}` -- 동일 역이라도 노선별 별도 노드.

```
"gangnam_2"   → 강남역 2호선
"gangnam_9"   → 강남역 신분당선
```

### Edge Types

| Type | Weight | 설명 |
|------|--------|------|
| Adjacent | `AVG_STATION_TRAVEL_TIME` (2.5min) | 같은 노선 인접역 |
| Transfer | `AVG_TRANSFER_TIME` (4min) | 같은 역 다른 노선 |
| Circular | 2.5min | 2호선 마지막역 <-> 첫역 |

### Graph Build

```typescript
// routeService.ts - buildGraph()
const graph = buildGraph(excludeLineIds);
// LINE_STATIONS → 양방향 인접 엣지
// STATIONS.lines → 환승 엣지 (모든 노선 쌍)
// 2호선 → 순환 엣지 추가
```

`excludeLineIds`로 특정 노선을 그래프에서 제외 (장애/지연 우회용).

## A* Algorithm

### Heuristic

역 순서 기반 거리 추정. `AVG_STATION_TRAVEL_TIME * 0.8` 계수로 admissible 보장.

```typescript
// heuristic(): station position 기반 최소 거리 추정
const h = minDistance * AVG_STATION_TRAVEL_TIME * 0.8;
```

### 실시간 지연 반영

```typescript
// astar()에서 lineDelays Map으로 엣지 가중치 조정
if (lineDelays && !edge.isTransfer) {
  weight += lineDelays.get(lineId) ?? 0;
}
```

### 사용 패턴

```typescript
import { routeService } from '@services/route';

// 기본 경로 탐색
const route = routeService.calculateRoute('gangnam', 'jongno3ga');
// → Route { segments, totalMinutes, transferCount, lineIds }

// 지연 반영 경로
const enhanced = routeService.calculateEnhancedRoute(
  'gangnam', 'jongno3ga', [],
  [{ lineId: '2', delayMinutes: 10 }]
);
// → EnhancedRoute { ...route, fare, stationCount }
```

## K-Shortest Path (Yen's Algorithm)

`kShortestPath.ts`에서 Yen's Algorithm으로 K개 최단 경로 탐색.

### Flow

1. Dijkstra로 첫 번째 최단경로
2. 각 spur node에서 기존 경로 엣지 제거 후 재탐색
3. 후보 경로를 PriorityQueue에 저장, 비용 순 선택
4. K개 경로 수집

```typescript
import { findKShortestPaths, getDiverseRoutes } from '@services/route';

// K개 최단경로
const result = findKShortestPaths('gangnam', 'hongdae', 3);
// → KShortestPathResult { paths: Route[], k, executionTimeMs }

// 다양성 필터링 (Jaccard 유사도 < 0.7)
const diverse = getDiverseRoutes('gangnam', 'hongdae', 0.3);
// → Route[] (최대 3개, 서로 30%+ 다른 경로)
```

### Route Similarity

Jaccard 유사도: `|A ∩ B| / |A ∪ B|` (segment 기준).

## Fare Calculation

### 요금 체계

| Type | Base Fare | Additional/Unit | 무료 |
|------|-----------|-----------------|------|
| `regular` (일반) | 1,400원 | 100원 | - |
| `youth` (청소년) | 720원 | 80원 | - |
| `child` (어린이) | 450원 | 50원 | - |
| `senior` (경로) | 0원 | 0원 | 전액 무료 |

### 거리별 추가 요금

| 구간 | 단위 거리 |
|------|-----------|
| 0~10km | 기본요금 |
| 10~50km | 5km당 추가 |
| 50km+ | 8km당 추가 |

### 거리 추정

`distance = (stationCount - 1) * 1.2km` (역간 평균 거리)

### 사용 패턴

```typescript
import { fareService } from '@services/route';

// 역 수 기반 요금
const fare = fareService.calculateFare(15, 'regular');
// → FareResult { baseFare: 1400, additionalFare: 200, totalFare: 1600, ... }

// 거리 기반 요금
const fare2 = fareService.calculateFareByDistance(25, 'youth');

// 경로 요금 정보
const info = fareService.getRouteFareInfo(10, true, 'child');
// → RouteFareInfo { stationCount, estimatedDistance, fare, transferDiscount }

// 요금 비교
const comparison = fareService.compareFares(10, 15);
// → { route1Fare, route2Fare, difference, cheaperRoute }

// 포맷팅
fareService.formatFare(1400);       // "1,400원"
fareService.getFareTypeLabel('youth'); // "청소년"
```

## Alternative Routes

### 대안 경로 탐색

지연/장애 발생 시 영향받는 노선을 제외하고 경로 재탐색.

```typescript
// 단일 대안
const alts = routeService.findAlternativeRoutes(
  'gangnam', 'hongdae',
  ['2'],           // 장애 노선
  'DELAY',         // 사유: DELAY | SUSPENSION | CONGESTION
  { maxTransfers: 4, maxTimeDifference: 30 }
);

// 복수 대안 (각 노선 개별 + 전체 제외)
const multiAlts = routeService.findMultipleAlternatives(
  'gangnam', 'hongdae', ['2', '9'], 'SUSPENSION', 3
);
```

### Confidence 계산

`confidence = max(0, 100 - |timeDiff| * 5 - transferCount * 10)`

### useAlternativeRoutes Hook

```typescript
const { delays } = useDelayDetection();
const {
  originalRoute,
  alternatives,
  loading,
  hasAffectedRoute,
  affectedLineIds,
  calculate,
  clear,
} = useAlternativeRoutes({
  delays,
  maxAlternatives: 3,
  autoCalculate: true,  // 지연 변경 시 자동 재계산
});

await calculate('gangnam', 'jongno3ga', 'DELAY');
```

### Route Comparison

```typescript
const result = routeService.compareRoutes(route1, route2);
// → { fasterRoute: 1|2|'equal', timeDifference, transferDifference, recommendation }
// recommendation: "경로 1이 훨씬 빠릅니다" | "경로 2가 환승이 적습니다" | ...
```

## Core Types

```typescript
// 경로 세그먼트
interface RouteSegment {
  fromStationId: string; fromStationName: string;
  toStationId: string;   toStationName: string;
  lineId: string;        lineName: string;
  estimatedMinutes: number;
  isTransfer: boolean;
}

// 경로
interface Route {
  segments: readonly RouteSegment[];
  totalMinutes: number;
  transferCount: number;
  lineIds: readonly string[];
}

// 강화된 경로 (요금 포함)
interface EnhancedRoute extends Route {
  fare: FareResult;
  stationCount: number;
  estimatedArrivalTime?: string;
}

// 대안 경로
interface AlternativeRoute {
  id: string;
  originalRoute: Route;
  alternativeRoute: Route;
  timeDifference: number;  // + slower, - faster
  reason: 'DELAY' | 'SUSPENSION' | 'CONGESTION';
  confidence: number;      // 0-100
  affectedLineId: string;
  createdAt: Date;
}

// 요금 결과
interface FareResult {
  baseFare: number;
  additionalFare: number;
  totalFare: number;
  distance: number;
  fareType: 'regular' | 'youth' | 'child' | 'senior';
  breakdown: FareBreakdown;
}

// 대안 경로 옵션
interface AlternativeRouteOptions {
  excludeLineIds?: readonly string[];
  maxTransfers?: number;       // default: 4
  maxTimeDifference?: number;  // default: 30min
  preferFewerTransfers?: boolean;
}
```

## UI Components

| Component | 용도 |
|-----------|------|
| `AlternativeRouteCard` | 대안 경로 카드 (시간차, 추천 배지, 비교) |
| `RouteComparisonView` | 기존 vs 대안 경로 나란히 비교 |

```tsx
<AlternativeRouteCard
  alternative={alt}
  onPress={() => navigate('RouteDetail', { route: alt })}
  showComparison={true}
  isRecommended={index === 0}
/>

<RouteComparisonView
  originalRoute={original}
  alternativeRoute={alternative}
  affectedLineIds={['2']}
/>
```

## Constants

| Constant | Value | 위치 |
|----------|-------|------|
| `AVG_STATION_TRAVEL_TIME` | 2.5분 | `@models/route` |
| `AVG_TRANSFER_TIME` | 4분 | `@models/route` |
| `AVG_STATION_DISTANCE` | 1.2km | `fareService.ts` |
| `BASE_DISTANCE` | 10km | `fareService.ts` |
| `BASE_FARE (regular)` | 1,400원 | `fareService.ts` |
| A* heuristic factor | 0.8 | `routeService.ts` |

## File Map

| File | 역할 |
|------|------|
| `src/models/route.ts` | 타입 정의, 상수, 유틸 함수 |
| `src/services/route/routeService.ts` | A* 경로 탐색, 대안 경로, 비교 |
| `src/services/route/fareService.ts` | 요금 계산 (FareService 클래스) |
| `src/services/route/kShortestPath.ts` | Yen's K-Shortest Path |
| `src/services/route/index.ts` | 모듈 re-export |
| `src/hooks/useAlternativeRoutes.ts` | 대안 경로 React Hook |
| `src/components/route/AlternativeRouteCard.tsx` | 대안 경로 카드 UI |
| `src/components/route/RouteComparisonView.tsx` | 경로 비교 UI |
| `src/utils/priorityQueue.ts` | Min-Heap PriorityQueue |
| `src/utils/subwayMapData.ts` | STATIONS, LINE_STATIONS 데이터 |

## Reference Documentation

상세 API 레퍼런스: [references/api_reference.md](references/api_reference.md)
