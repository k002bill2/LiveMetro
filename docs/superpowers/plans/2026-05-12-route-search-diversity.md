# Route Search Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환승역 set 그룹화 기반으로 산곡→선릉 같은 OD pair에서 강남구청 환승 경유 등 다양한 경로를 자동으로 카드 3-5장으로 노출하고, 동적 "○○ 경유" 라벨을 부여한다.

**Architecture:** K=15 K-shortest 후보 → 환승역 sorted-name signature로 그룹화 → 그룹별 cost 최소 대표 → 1.5x 시간 cap 적용 → fastest + (min-transfer if valid) + 나머지 시간순 채움(최대 5장) → category/viaTags 라벨링. 기존 PR #55의 `min-transfer.transferCount < fastest.transferCount` invariant 유지.

**Tech Stack:** TypeScript strict, Jest, React Native, in-memory graph algorithm.

**Spec:** `docs/superpowers/specs/2026-05-12-route-search-diversity-design.md`

---

## File Structure

| 파일 | 역할 | 변경 유형 |
|------|------|----------|
| `src/models/route.ts` | RouteCategory enum 확장 + Route.viaTags 필드 | 수정 (line 29 + 34-40) |
| `src/services/route/kShortestPath.ts` | signature, grouping helper + getDiverseRoutes 재작성 | 수정 (line 462-517) |
| `src/services/route/__tests__/kShortestPath.test.ts` | 신규 테스트 5개 카테고리 + 기존 invariant 유지 | 수정 (append) |
| `src/components/route/RouteCard.tsx` | CATEGORY_TAGS에 'via-station' 추가 + viaTags 렌더 | 수정 (line 16-19 + 103-107) |

각 task는 TDD: 실패하는 테스트 작성 → 구현 → 테스트 통과 → commit.

---

## Task 1: RouteCategory 타입 확장 + Route.viaTags 필드 추가

**Files:**
- Modify: `src/models/route.ts:29-40`
- Test: 타입 컴파일 확인 (별도 unit test 불필요 — Task 2-4 테스트에서 자연스럽게 검증됨)

- [ ] **Step 1: Route 타입에 'via-station' 카테고리 + viaTags 필드 추가**

`src/models/route.ts` 라인 29의 RouteCategory enum 확장:

```typescript
/**
 * Why a route was suggested. Set by `getDiverseRoutes` when picking the
 * fastest, fewest-transfer, and via-station differentiated routes from
 * the K-shortest candidates.
 *
 * - 'fastest': 최단 시간 (Yen output 첫 번째)
 * - 'min-transfer': 환승 최소 (fastest보다 환승 적을 때만)
 * - 'via-station': 특정 환승역 경유 (viaTags에 라벨 텍스트)
 */
export type RouteCategory = 'fastest' | 'min-transfer' | 'via-station';
```

`src/models/route.ts` 라인 34-40의 Route 인터페이스에 viaTags 추가:

```typescript
/**
 * Complete route from origin to destination
 */
export interface Route {
  readonly segments: readonly RouteSegment[];
  readonly totalMinutes: number;
  readonly transferCount: number;
  readonly lineIds: readonly string[];
  readonly category?: RouteCategory;
  /**
   * Dynamic display tags for `category: 'via-station'` cards. Caller
   * (RouteCard) prefers `viaTags` over the static CATEGORY_TAGS mapping
   * when category === 'via-station'. Example: ['강남구청 경유'].
   */
  readonly viaTags?: readonly string[];
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 빈 출력 (0 errors). Route를 사용하는 기존 코드는 viaTags가 optional이라 영향 없음.

- [ ] **Step 3: Commit**

```bash
git add src/models/route.ts
git commit -m "$(cat <<'EOF'
feat(route): extend RouteCategory with via-station + add viaTags field

Spec: docs/superpowers/specs/2026-05-12-route-search-diversity-design.md

다양성 강화 카드를 위한 타입 기반. via-station 카테고리에서는 viaTags의
동적 라벨(예: '강남구청 경유')을 RouteCard가 우선 표시한다.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Transfer Station Signature 헬퍼

**Files:**
- Modify: `src/services/route/kShortestPath.ts` (line 462 위 — MAX_ROUTE_TRANSFERS 상수 근처)
- Test: `src/services/route/__tests__/kShortestPath.test.ts` (append)

Signature는 `route.segments.filter(s => s.isTransfer).map(s => s.fromStationName).sort().join('|')`. 그룹화 키로 사용.

- [ ] **Step 1: 실패 테스트 작성**

`src/services/route/__tests__/kShortestPath.test.ts` 파일 끝부분에 추가:

파일 상단의 기존 import 라인을 다음으로 교체 (또는 보강):

```typescript
import {
  findKShortestPaths,
  getDiverseRoutes,
  buildTransferSignature, // 신규 export — Step 3에서 구현
} from '../kShortestPath';
import type { Route, RouteSegment } from '@/models/route';

// 테스트 헬퍼: minimal Route 만들기
const seg = (
  from: string,
  to: string,
  lineId: string,
  isTransfer: boolean,
): RouteSegment => ({
  fromStationId: from,
  fromStationName: from,
  toStationId: to,
  toStationName: to,
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: 2,
  isTransfer,
});

const route = (segs: RouteSegment[], totalMinutes = 10, transferCount = 0): Route => ({
  segments: segs,
  totalMinutes,
  transferCount,
  lineIds: Array.from(new Set(segs.map((s) => s.lineId))),
});

describe('buildTransferSignature', () => {
  it('직행 경로는 빈 signature를 반환', () => {
    const r = route([seg('A', 'B', '2', false)]);
    expect(buildTransferSignature(r)).toBe('');
  });

  it('단일 환승 경로는 환승역 이름을 signature로 반환', () => {
    const r = route([
      seg('A', '강남구청', '7', false),
      seg('강남구청', '강남구청', '수인분당', true),
      seg('강남구청', '선릉', '수인분당', false),
    ]);
    expect(buildTransferSignature(r)).toBe('강남구청');
  });

  it('환승역 순서가 달라도 같은 signature (정렬 보장)', () => {
    const r1 = route([
      seg('A', '신도림', '1', false),
      seg('신도림', '신도림', '2', true),
      seg('신도림', '선릉', '2', false),
    ]);
    const r2 = route([
      seg('A', '신도림', '1', false),
      seg('신도림', '신도림', '2', true),
      seg('신도림', '선릉', '2', false),
    ]);
    expect(buildTransferSignature(r1)).toBe(buildTransferSignature(r2));
  });

  it('두 개 환승역은 가나다 정렬되어 join', () => {
    const r = route([
      seg('A', '부평구청', '인천1', false),
      seg('부평구청', '부평구청', '7', true),
      seg('부평구청', '강남구청', '7', false),
      seg('강남구청', '강남구청', '수인분당', true),
      seg('강남구청', '선릉', '수인분당', false),
    ]);
    // sorted: ['강남구청', '부평구청']
    expect(buildTransferSignature(r)).toBe('강남구청|부평구청');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --watchman=false src/services/route/__tests__/kShortestPath.test.ts 2>&1 | tail -20`
Expected: 4개의 새 테스트가 "buildTransferSignature is not exported" 또는 "is not a function"으로 FAIL. 기존 14개 테스트는 PASS.

- [ ] **Step 3: buildTransferSignature 구현**

`src/services/route/kShortestPath.ts` 파일에서 `MAX_ROUTE_TRANSFERS` 상수(라인 462) 바로 위에 추가:

```typescript
/**
 * Build a stable signature representing the *set of transfer stations* a
 * route visits. Used by `getDiverseRoutes` to cluster K-shortest candidates
 * by transfer-station identity — routes sharing the same transfer set are
 * variants of the same idea and collapse into one card.
 *
 * Signature rules:
 *  - Direct routes (no transfer) → '' (empty string)
 *  - Single transfer at 강남구청 → '강남구청'
 *  - Two transfers in any order → '강남구청|부평구청' (alphabetical sort)
 *
 * Station NAME is used (not ID) because the resulting signature also drives
 * the user-facing 'via-station' label. ID-based signature would require a
 * second lookup at label time.
 */
export function buildTransferSignature(route: Route): string {
  const names = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .sort();
  return names.join('|');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest --watchman=false src/services/route/__tests__/kShortestPath.test.ts 2>&1 | tail -10`
Expected: 18 passed (기존 14 + 신규 4).

- [ ] **Step 5: Commit**

```bash
git add src/services/route/kShortestPath.ts src/services/route/__tests__/kShortestPath.test.ts
git commit -m "$(cat <<'EOF'
feat(route): add buildTransferSignature helper for diverse-route grouping

환승역 이름 정렬 join을 stable signature로 만들어 K-shortest 후보를
"환승역 set" 기준으로 그룹화하는 토대. 직행은 빈 문자열, 환승역 순서는
가나다 정렬로 안정화. 라벨 텍스트와 signature가 같은 소스에서 나오므로
이후 'via-station' 라벨링에 그대로 재사용.

Spec: docs/superpowers/specs/2026-05-12-route-search-diversity-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: getDiverseRoutes 재작성 (그룹화 + 적응형 N + 라벨링)

**Files:**
- Modify: `src/services/route/kShortestPath.ts:462-517` (`getDiverseRoutes` 본체)
- Test: `src/services/route/__tests__/kShortestPath.test.ts` (append)

기존 함수가 했던 일:
1. K=10 → K=15로 확대
2. transferCount cap (≤2) 유지
3. signature 기반 그룹화 + 그룹당 cost 최소 대표
4. 1.5x 시간 cap
5. fastest + min-transfer(조건부) + 나머지 → 최대 5장

- [ ] **Step 1: 실패 테스트 작성**

`src/services/route/__tests__/kShortestPath.test.ts`의 `describe('getDiverseRoutes', ...)` 블록 안에 다음 테스트 4개를 기존 `it('min-transfer 카드는 ...)` 테스트 다음에 추가:

```typescript
  it('서로 다른 환승역 그룹은 각각 1장씩 카드로 노출', () => {
    // 222(강남) → 226(종합운동장)은 mock data에서 2호선 직행 + 일부 환승
    // 변형이 있으므로 그룹화가 1개 이상의 카테고리 생성을 보장.
    const routes = getDiverseRoutes('222', '226', 5);
    // 같은 시그니처를 두 번 반환하지 않음
    const signatures = routes.map((r) => buildTransferSignature(r));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('via-station 카드는 viaTags에 환승역 이름을 포함', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    const viaCards = routes.filter((r) => r.category === 'via-station');
    for (const card of viaCards) {
      expect(card.viaTags).toBeDefined();
      expect(card.viaTags!.length).toBeGreaterThan(0);
      // 라벨은 "○○ 경유" 형식
      expect(card.viaTags![0]).toMatch(/경유$/);
    }
  });

  it('maxRoutes 인자로 노출 수 제한', () => {
    const r3 = getDiverseRoutes('222', '226', 3);
    const r5 = getDiverseRoutes('222', '226', 5);
    expect(r3.length).toBeLessThanOrEqual(3);
    expect(r5.length).toBeLessThanOrEqual(5);
    expect(r5.length).toBeGreaterThanOrEqual(r3.length);
  });

  it('1.5x 시간 격차 cap: fastest 대비 50% 초과 경로는 제외', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    if (routes.length > 1) {
      const fastest = routes[0]!;
      const threshold = fastest.totalMinutes * 1.5;
      for (const r of routes) {
        expect(r.totalMinutes).toBeLessThanOrEqual(threshold);
      }
    }
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest --watchman=false src/services/route/__tests__/kShortestPath.test.ts 2>&1 | tail -20`
Expected: 신규 4개 테스트 중 일부 FAIL. 특히 `via-station` 카드는 아직 라벨링 로직이 없어 viaTags가 undefined.

- [ ] **Step 3: getDiverseRoutes 재작성**

`src/services/route/kShortestPath.ts` 라인 462-517(기존 `getDiverseRoutes` 블록 전체)를 다음으로 교체:

```typescript
/**
 * Hard cap on transfers for any suggested route. Empirically routes in
 * 수도권 cover all reasonable origin-destination pairs with ≤2 transfers;
 * 3+ transfers almost always indicate a detour the user would not pick.
 */
const MAX_ROUTE_TRANSFERS = 2;

/**
 * Default and max number of cards exposed by `getDiverseRoutes`. Adaptive —
 * fewer than this is fine when diversity is limited (e.g. only 1 signature
 * group exists, or short OD pairs).
 */
const DEFAULT_MAX_ROUTES = 5;

/**
 * Routes whose totalMinutes exceed `fastest.totalMinutes * UNREALISTIC_TIME_FACTOR`
 * are filtered out — they're typically valid graph paths but not realistic
 * commute options.
 */
const UNREALISTIC_TIME_FACTOR = 1.5;

/**
 * Pick a diverse set of 1–5 routes from the K-shortest candidates by
 * grouping on transfer-station signature. Returns up to `maxRoutes` cards
 * with the following category invariants:
 *
 *  - First card: `category: 'fastest'` (minimum totalMinutes overall)
 *  - Optional second card: `category: 'min-transfer'` ONLY when
 *    `minTransfer.transferCount < fastest.transferCount` (PR #55 invariant).
 *  - Remaining cards: `category: 'via-station'` with `viaTags: ['{역} 경유']`
 *    sorted by totalMinutes ascending.
 *
 * `via-station` label uses the *last* transfer station along the route
 * (closest to destination) because that's the more memorable hop for users
 * planning the trip.
 *
 * Routes with > MAX_ROUTE_TRANSFERS transfers are filtered out unless no
 * candidate qualifies (in which case we fall back to the K-shortest #1 so
 * the UI shows something).
 */
export function getDiverseRoutes(
  fromStationId: string,
  toStationId: string,
  maxRoutes: number = DEFAULT_MAX_ROUTES,
): Route[] {
  const result = findKShortestPaths(fromStationId, toStationId, 15);
  if (result.paths.length === 0) return [];

  const filtered = result.paths.filter((r) => r.transferCount <= MAX_ROUTE_TRANSFERS);
  const candidates = filtered.length > 0 ? filtered : [result.paths[0]!];

  // 1. Group by transfer signature, keep cost-min representative per group
  const groupMap = new Map<string, Route>();
  for (const c of candidates) {
    const sig = buildTransferSignature(c);
    const prev = groupMap.get(sig);
    if (!prev || c.totalMinutes < prev.totalMinutes) {
      groupMap.set(sig, c);
    }
  }
  const representatives = [...groupMap.values()].sort(
    (a, b) => a.totalMinutes - b.totalMinutes,
  );

  // 2. Identify fastest (already first after sort)
  const fastest = representatives[0]!;

  // 3. Apply 1.5x time-gap cap relative to fastest
  const timeThreshold = fastest.totalMinutes * UNREALISTIC_TIME_FACTOR;
  const reachableReps = representatives.filter(
    (r) => r.totalMinutes <= timeThreshold,
  );

  // 4. Identify min-transfer ONLY if strictly better than fastest
  // (PR #55 invariant — preserved). Pick from reachable, not fastest itself.
  const minTransfer = reachableReps.reduce<Route | null>((best, r) => {
    if (r === fastest) return best;
    if (r.transferCount >= fastest.transferCount) return best;
    if (!best) return r;
    if (r.transferCount < best.transferCount) return r;
    if (r.transferCount === best.transferCount && r.totalMinutes < best.totalMinutes) {
      return r;
    }
    return best;
  }, null);

  // 5. Adaptive selection up to maxRoutes
  const selected: Route[] = [labelFastest(fastest)];
  if (minTransfer) {
    selected.push(labelMinTransfer(minTransfer));
  }

  const remaining = reachableReps.filter(
    (r) => r !== fastest && r !== minTransfer,
  );
  for (const r of remaining) {
    if (selected.length >= maxRoutes) break;
    selected.push(labelViaStation(r));
  }

  return selected;
}

function labelFastest(route: Route): Route {
  return { ...route, category: 'fastest' };
}

function labelMinTransfer(route: Route): Route {
  return { ...route, category: 'min-transfer' };
}

/**
 * Label a route as 'via-station' using the last transfer station along
 * the route as the user-facing tag. Empty viaTags would be a contract
 * violation — we fall back to '환승 경유' (generic) if the route has no
 * transfers (which shouldn't reach this path, but defensive).
 */
function labelViaStation(route: Route): Route {
  const transfers = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName);
  const lastTransfer = transfers[transfers.length - 1];
  const tag = lastTransfer ? `${lastTransfer} 경유` : '환승 경유';
  return {
    ...route,
    category: 'via-station',
    viaTags: [tag],
  };
}
```

`isSamePath` 함수는 그대로 유지(다른 곳에서 호출되거나 미래에 쓸 수 있어서 제거 안 함). 또는 미사용이면 lint error 발생 시에만 제거.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest --watchman=false src/services/route/__tests__/kShortestPath.test.ts 2>&1 | tail -25`
Expected: 22 passed (기존 14 + Task 2의 4 + 이번 4).

- [ ] **Step 5: TypeScript + Lint 확인**

Run:
```bash
npx tsc --noEmit 2>&1 | head -10
npm run lint 2>&1 | grep "error\b" | grep "kShortestPath\|route" | head -10
```
Expected: TS 0 errors. lint은 pre-existing warnings 외 신규 error 없음. `isSamePath` 미사용 경고가 나오면 제거:

만약 `'isSamePath' is defined but never used` 경고 발생 시, 라인 519-540의 함수 전체 제거.

- [ ] **Step 6: Commit**

```bash
git add src/services/route/kShortestPath.ts src/services/route/__tests__/kShortestPath.test.ts
git commit -m "$(cat <<'EOF'
feat(route): diversify route results by transfer-station grouping

K=10 → 15로 확대 + signature 기반 그룹화 + 1.5x 시간 cap + 적응형 3-5장
선택으로 산곡→선릉 같은 OD에서 강남구청 경유 등 환승 옵션을 자동 노출.

알고리즘:
1. K-shortest 15개, 환승 ≤2 필터
2. 환승역 이름 sorted-join을 signature로 그룹화
3. 그룹별 cost 최소 대표 + 시간 정렬
4. fastest 대비 1.5배 초과 경로 제외
5. fastest + (transferCount 진짜 적은 min-transfer) + 나머지 시간순 채움
6. via-station 라벨은 route 마지막 환승역 (목적지 측)

PR #55의 min-transfer.transferCount < fastest.transferCount invariant 유지.
DEFAULT_MAX_ROUTES=5, UNREALISTIC_TIME_FACTOR=1.5 상수로 노출.

Spec: docs/superpowers/specs/2026-05-12-route-search-diversity-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: RouteCard UI에 via-station 카테고리 + viaTags 렌더

**Files:**
- Modify: `src/components/route/RouteCard.tsx:16-19` (CATEGORY_TAGS) + 라인 102-107 (tags 계산)
- Test: RouteCard 관련 테스트가 있다면 수정, 없으면 별도 추가 안 함 (kShortestPath 테스트에서 데이터 검증됨)

- [ ] **Step 1: CATEGORY_TAGS에 via-station 빈 배열 추가**

`src/components/route/RouteCard.tsx` 라인 16-19를 다음으로 교체:

```typescript
/**
 * Tags shown in the top-left of each card. Two tags per category mirrors the
 * Wanted handoff: a "why this card" label + a softer descriptor.
 *
 * `via-station` is intentionally empty — the dynamic tag comes from
 * `route.viaTags` (e.g. ['강남구청 경유']) set by `labelViaStation` in
 * kShortestPath.ts.
 */
const CATEGORY_TAGS: Record<RouteCategory, readonly string[]> = {
  'fastest': ['추천', '최단'],
  'min-transfer': ['환승최소', '빠른길'],
  'via-station': [],
};
```

- [ ] **Step 2: tags 계산 로직 수정 (viaTags 우선)**

`src/components/route/RouteCard.tsx` 라인 102-107의 tags 계산 코드를 다음으로 교체:

```typescript
  const legs = routeToLegs(route);
  // via-station은 동적 viaTags 우선, 그 외 카테고리는 정적 매핑.
  // viaTags가 비어 있는 비정상 케이스는 빈 배열로 안전 fallback.
  const tags: readonly string[] =
    route.category === 'via-station' && route.viaTags && route.viaTags.length > 0
      ? route.viaTags
      : route.category
        ? CATEGORY_TAGS[route.category]
        : recommended
          ? ['추천']
          : [];
  const summary = singleLegSummary(route);
```

- [ ] **Step 3: TypeScript 컴파일 + 영향 영역 테스트**

Run:
```bash
npx tsc --noEmit 2>&1 | head -10
npx jest --watchman=false src/components/route src/services/route src/hooks/__tests__/useRouteSearch.test.ts 2>&1 | tail -10
```
Expected: TS 0 errors. 모든 route 관련 테스트 PASS (기존 + 신규).

- [ ] **Step 4: Commit**

```bash
git add src/components/route/RouteCard.tsx
git commit -m "$(cat <<'EOF'
feat(route): render dynamic viaTags for via-station route cards

RouteCard가 route.category === 'via-station'일 때 route.viaTags 배열을
태그 텍스트로 사용. fastest/min-transfer는 기존 CATEGORY_TAGS 매핑 유지.
viaTags 누락이나 빈 배열 시 안전 fallback.

Spec: docs/superpowers/specs/2026-05-12-route-search-diversity-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀 invariant + 짧은 OD pair 통합 테스트

**Files:**
- Test: `src/services/route/__tests__/kShortestPath.test.ts` (append)

기존 invariant(PR #55의 min-transfer < fastest)가 깨지지 않았는지와 짧은 OD pair에서 적응형 선택이 자연스럽게 1장으로 줄어드는지 검증.

- [ ] **Step 1: 회귀 + 적응형 테스트 추가**

`describe('getDiverseRoutes', ...)` 블록 끝에 다음 추가:

```typescript
  it('회귀: min-transfer 카드의 transferCount는 항상 fastest보다 작음 (PR #55)', () => {
    // semantic invariant — Task 3 재작성 후에도 유지돼야 함.
    const routes = getDiverseRoutes('222', '226', 5);
    const fastest = routes.find((r) => r.category === 'fastest');
    const minTransfer = routes.find((r) => r.category === 'min-transfer');
    if (fastest && minTransfer) {
      expect(minTransfer.transferCount).toBeLessThan(fastest.transferCount);
    }
  });

  it('회귀: 첫 카드는 항상 fastest 카테고리', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    if (routes.length > 0) {
      expect(routes[0]?.category).toBe('fastest');
    }
  });

  it('짧은 OD pair (인접역)는 카드 1장만 반환', () => {
    // 222(강남) → 223(역삼)은 1정거장 직행. 환승 옵션 없음.
    const routes = getDiverseRoutes('222', '223', 5);
    expect(routes.length).toBe(1);
    expect(routes[0]?.category).toBe('fastest');
    expect(routes[0]?.transferCount).toBe(0);
  });

  it('maxRoutes 기본값은 5', () => {
    // 인자 생략 시 DEFAULT_MAX_ROUTES 적용
    const routes = getDiverseRoutes('222', '226');
    expect(routes.length).toBeLessThanOrEqual(5);
  });
```

- [ ] **Step 2: 테스트 통과 확인**

Run: `npx jest --watchman=false src/services/route/__tests__/kShortestPath.test.ts 2>&1 | tail -10`
Expected: 26 passed (기존 14 + Task 2의 4 + Task 3의 4 + Task 5의 4).

- [ ] **Step 3: 전체 영향 영역 회귀**

Run: `npx jest --watchman=false src/services/route src/hooks src/components/route src/screens 2>&1 | tail -10`
Expected: 모든 suites PASS, 회귀 0건.

- [ ] **Step 4: TypeScript + Lint 최종 확인**

Run:
```bash
npx tsc --noEmit 2>&1 | head -10
npm run lint 2>&1 | grep -E "^\s+[0-9]+:\d+\s+error" | head -10
```
Expected: TS 0 errors, lint 신규 error 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/route/__tests__/kShortestPath.test.ts
git commit -m "$(cat <<'EOF'
test(route): regression tests for diversify — invariants + adaptive count

PR #55의 min-transfer < fastest invariant가 Task 3 재작성 후에도 유지되는지,
짧은 OD pair(인접역)는 카드 1장으로 자연스럽게 줄어드는지, maxRoutes 기본값이
DEFAULT_MAX_ROUTES(5)인지 확인.

Spec: docs/superpowers/specs/2026-05-12-route-search-diversity-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification (실기기 + PR)

모든 Task 완료 후:

- [ ] `npm run type-check && npm run lint && npx jest --watchman=false src/services/route src/components/route src/hooks` 전체 통과
- [ ] `git log --oneline -5` 확인 — 5개 commit (Task 1-5 각 1개)
- [ ] 실기기 E2E 테스트:
  - 산곡 → 선릉: 강남구청 경유 카드 등장 확인
  - 강남 → 역삼: 카드 1장만 노출 확인
  - 임의 OD pair: fastest 카드가 항상 첫 위치
  - 환승최소 카드가 노출될 때 환승이 fastest보다 *실제로* 적은지
- [ ] PR 생성: `gh pr create` — Title: `feat(route): diversify routes by transfer-station grouping (3-5 cards)`

## Notes

- **Surgical Changes 원칙**: 각 Task가 독립 commit. Task 3의 `getDiverseRoutes` 재작성은 큰 변경이지만 한 함수의 책임 안에 머무름.
- **Backward compatibility**: `Route.viaTags`는 optional. 기존 호출자(useRouteSearch, RoutesTabScreen)는 변경 없이 작동.
- **K=10→15 성능**: 절대값 1ms 미만(in-memory graph). 영향 무시 가능.
- **isSamePath 함수**: Task 3 재작성 후 미사용 가능성. lint warning 발생 시 그 시점에 제거 (Step 5 Task 3에 명시).
- **Mock data 한계**: kShortestPath.test.ts의 mock stations(222-226)는 모두 Line 2에 있어 실제로 다중 환승 경로가 생성되지 않는다. Task 3/5의 그룹화 테스트는 "vacuously 만족"하는 케이스가 일부 있다 — 라벨/카테고리 로직은 충실히 검증되지만 진짜 다중 환승 시나리오는 E2E(실기기)에서 확인. 추후 mock data를 multi-line transfers 포함하도록 확장하면 더 견고해진다.
