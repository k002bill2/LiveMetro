# 경로 검색 다양성 강화 설계 (Route Search Diversity)

**작성일**: 2026-05-12
**상태**: Design Approved
**관련 이슈**: 산곡→선릉 경로에서 강남구청 환승 경유 옵션이 노출되지 않음. 사용자가 다양한 환승 옵션을 비교할 수 없음.

---

## Context

현재 `routeService.getDiverseRoutes()`는 K-shortest path 후보 10개에서 단 2장(`fastest` + `min-transfer`)만 노출한다. 같은 OD pair에 환승역 조합이 여러 개 있는 경우(예: 인천↔강남 장거리), 대부분의 가치 있는 대안 경로가 카테고리 압축에서 손실된다.

산곡(인천1호선) → 선릉(2호선/수인분당) 사례:
- fastest: 신도림 환승 경로
- min-transfer: 다른 환승 경로 1장
- **누락**: 강남구청(7↔수인분당) 경유 경로 → 사용자가 인지할 방법 없음

## Goals

1. 환승역 조합이 다른 경로들이 자연스럽게 카드로 노출되도록 한다 (강남구청 경유, 신도림 경유, 이촌 경유 등).
2. 기존 `fastest`/`min-transfer` 의미와 invariant를 깨지 않는다.
3. 짧은 OD pair에서는 불필요하게 카드를 늘리지 않는다 (적응형 3-5장, 최소 2 보장 아님).
4. 기존 UI 컴포넌트(`RouteCard`, `CATEGORY_TAGS`)는 surgical 수준의 변경만 받는다.

## Non-Goals

- 사용자가 환승역을 직접 지정하는 advanced search UI (별도 phase).
- 운행 시간(첫차/막차), 요금별 정렬 (별도 phase).
- MMR 같은 수학적 다양성 최적화 알고리즘 (복잡도 대비 효과 미검증).
- 환승 cap 완화 (`MAX_ROUTE_TRANSFERS=2` 유지; 별도 결정 필요 시 follow-up).

## Architecture

### Algorithm: Transfer-Station-Set Grouping

```
입력: fromStationId, toStationId, maxRoutes=5
출력: Route[] (1-5장, 적응형)

1. K-shortest 후보 생성
   candidates = findKShortestPaths(from, to, K=15)
   // 기존 10 → 15로 확대 (다양성 풀 확보)

2. 환승 cap 적용 (기존 유지)
   candidates = candidates.filter(c => c.transferCount <= MAX_ROUTE_TRANSFERS)
   if (empty) candidates = [paths[0]]  // fallback

3. 시그니처 생성
   signature(route) =
     route.segments
       .filter(s => s.isTransfer)
       .map(s => s.fromStationName)
       .sort()
       .join('|')
   // 직행 → '', 환승 다중 → 정렬된 이름 join

4. 그룹화
   groups = new Map<signature, Route[]>()
   for each candidate: groups.get(sig(c)).push(c)

5. 그룹별 대표
   representatives = [...groups.values()].map(g =>
     g.reduce((best, r) => r.totalMinutes < best.totalMinutes ? r : best)
   )

6. 1.5x 시간 격차 cap (sort 필수)
   representatives.sort((a, b) => a.totalMinutes - b.totalMinutes)
   // Map iteration order에 의존하면 안 됨 — 명시적 cost-sort
   fastest = representatives[0]
   threshold = fastest.totalMinutes * 1.5
   representatives = representatives.filter(r => r.totalMinutes <= threshold)

7. Top-N 적응형 선택
   selected = [fastest]
   minTransfer = representatives.find(r =>
     r !== fastest && r.transferCount < fastest.transferCount
   )
   if (minTransfer) selected.push(minTransfer)

   rest = representatives
     .filter(r => !selected.includes(r))
     .sort((a, b) => a.totalMinutes - b.totalMinutes)

   while (selected.length < maxRoutes && rest.length > 0) {
     selected.push(rest.shift())
   }

   return selected with category/viaTags labels
```

### Category Labeling

```typescript
labelRoute(route, fastest, minTransfer, allSignatures): Route {
  if (route === fastest) {
    return { ...route, category: 'fastest' };
  }
  if (route === minTransfer) {
    return { ...route, category: 'min-transfer' };
  }
  // via-station: route 순서상 마지막 환승역(목적지 근처)을 라벨로
  // — 사용자에게 "어디에서 갈아타나"는 목적지 직전 환승이 더 의미 있다.
  // signature는 sort된 환승역 집합이지만, 라벨은 segment 원래 순서 기반.
  const transfers = route.segments
    .filter(s => s.isTransfer)
    .map(s => s.fromStationName);
  const primary = transfers[transfers.length - 1] ?? '';
  return {
    ...route,
    category: 'via-station',
    viaTags: [`${primary} 경유`],
  };
}
```

### Type Changes

```typescript
// src/models/route.ts
export type RouteCategory = 'fastest' | 'min-transfer' | 'via-station';

export interface Route {
  // ... 기존 필드
  category?: RouteCategory;
  viaTags?: readonly string[];  // 신규
}

// src/services/route/kShortestPath.ts
export function getDiverseRoutes(
  fromStationId: string,
  toStationId: string,
  maxRoutes?: number  // 기본 5
): Route[]
```

### UI: RouteCard

```typescript
// src/components/route/RouteCard.tsx
const CATEGORY_TAGS: Record<RouteCategory, readonly string[]> = {
  'fastest': ['추천', '최단'],
  'min-transfer': ['환승최소', '빠른길'],
  'via-station': [],  // 동적 viaTags 사용
};

// 렌더
const tags: readonly string[] = route.category === 'via-station' && route.viaTags
  ? route.viaTags
  : route.category
    ? CATEGORY_TAGS[route.category]
    : (recommended ? ['추천'] : []);
```

`RoutesTabScreen`의 `routes.map(...)` 렌더 로직은 그대로. 카드 수가 늘어나도 동작 동일.

## Data Flow

```
useRouteSearch.performFetch()
  ↓
routeService.getDiverseRoutes(fromId, toId)
  ↓
kShortestPath.getDiverseRoutes(fromId, toId, 5)
  ↓ (K-shortest + group + select)
Route[] (1-5장, category + viaTags 라벨)
  ↓
enrichRoute (ETA, delay) — 기존 유지
  ↓
setRoutes(enriched)
  ↓
RoutesTabScreen → RouteCard (각 카드 category 기반 라벨)
```

## Edge Cases

| 케이스 | 동작 |
|--------|------|
| 직행만 존재 (환승 0회) | 1장만 (signature='') |
| 모든 후보가 같은 환승역 | 1장 (대표) |
| K=15 candidates < 3 | 받은 만큼만 (강제 padding 없음) |
| fastest 대비 시간 1.5x 초과 그룹 | 제외 |
| `segment.fromStationName`이 undefined | signature에서 무시 (`?? ''` 사용) |
| min-transfer가 fastest와 transferCount 동일 | min-transfer 카드 생략 (기존 invariant) |
| 짧은 OD (단거리) | 1-2장 자연스럽게 |

## Testing

### Unit Tests (kShortestPath.test.ts에 추가)

1. **Signature 생성**
   - 같은 환승역 경유 두 경로 → 같은 signature
   - 환승 순서 다른 두 경로 → 같은 signature (sort 결과)
   - 직행 → 빈 signature

2. **그룹화**
   - 5개 후보 → 2개 signature → 2개 그룹
   - 각 그룹 대표는 totalMinutes 최소

3. **Top-N 선택**
   - 다양성 충분: 최대 5장 반환
   - 다양성 부족: 받은 만큼 반환
   - 1.5x cap 작동: threshold 초과 그룹 제외

4. **카테고리 라벨 invariant (기존 + 신규)**
   - fastest는 항상 첫 카드
   - min-transfer.transferCount < fastest.transferCount (기존 PR #55 invariant 유지)
   - via-station 카드의 viaTags는 항상 비어있지 않음
   - via-station 카드는 fastest/min-transfer가 아닌 경로에만 부여

5. **회귀**
   - 단거리 OD pair (강남→역삼) → 1장만 반환
   - 산곡→선릉 시나리오 (mock data) → 3장 이상 + 강남구청 경유 카드 존재

### Integration Tests (useRouteSearch.test.ts)

- `RouteWithMLMeta`에 새 `category`/`viaTags` 필드가 그대로 전달되는지

### UI Tests (RouteCard.test.tsx)

- `via-station` 카테고리에서 `viaTags` 텍스트가 렌더되는지
- `viaTags`가 비어있을 때 graceful fallback

## Risks & Trade-offs

| Risk | 완화 |
|------|------|
| K=10→15로 성능 50% 증가 | 절대값 1ms 미만, in-memory; 영향 무시 가능 |
| 라벨이 너무 많아 UI 혼잡 | 적응형 N (다양성 만큼만), 1.5x cap, fastest borderline 강조 유지 |
| 사용자가 5장을 모두 비교하기 어려움 | 첫 카드 강조 유지 + 시간순 정렬로 인지 부하 최소화 |
| signature 충돌 (같은 이름 다른 역) | `fromStationName`은 한국 지하철에서 유일 (역 코드 매핑은 별도 표) |
| min-transfer < fastest invariant 충돌 | 기존 invariant 그대로 유지 — min-transfer는 transferCount 비교 후에만 추가 |

## Critical Files

수정 대상:
- `src/services/route/kShortestPath.ts` (algorithm 본체)
- `src/models/route.ts` (RouteCategory enum, viaTags 필드)
- `src/components/route/RouteCard.tsx` (라벨 매핑)
- `src/services/route/__tests__/kShortestPath.test.ts` (테스트)

영향 없는 파일 (변경 불필요):
- `src/hooks/useRouteSearch.ts` (Route 인터페이스 변경에 transparent)
- `src/screens/route/RoutesTabScreen.tsx` (.map(...) 그대로 작동)

## Verification

각 변경 후:
- `npm run type-check` (0 errors)
- `npm run lint` (0 errors)
- `npx jest src/services/route src/components/route` (회귀 + 새 테스트 통과)

E2E:
- 산곡 → 선릉 검색 결과에 강남구청 경유 카드 등장 확인
- 강남 → 역삼 검색 결과 1장 반환 확인
- 기존 PR #55의 min-transfer invariant 회귀 없음 확인

## Out of Scope (Follow-up Phases)

- 환승 cap=3으로 완화 (별도 결정)
- 사용자 환승역 직접 선택 UI
- 운행시간/요금 기반 정렬
- 카드 정렬 사용자 커스터마이징
- "○○ 경유" 라벨에 2개 이상 환승역 표시 (`강남구청·이촌 경유`)
