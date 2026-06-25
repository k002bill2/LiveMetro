# Routing Debugging — 호출 토폴로지 + OD 회귀 체크리스트

이 문서는 경로 탐색 코드를 **수정하기 전** 또는 **OD(출발-도착) 쌍별 경로/환승 회귀를 디버깅할 때** 읽는다. 두 가지 재진입 함정을 다룬다:

1. **Routing 호출 토폴로지** — 어느 엔진이 어느 화면을 그리고, 무엇이 배선돼 있고 무엇이 안 돼 있나
2. **OD 회귀 디버깅 체크리스트** — 특정 OD에서 경로가 틀릴 때 가장 먼저 의심할 3가지

본문 SKILL.md의 "최단경로 (Dijkstra)" / "K-Shortest Path" 섹션이 *각* 엔진의 내부를 설명한다면, 이 문서는 **두 엔진의 격리와 그로 인한 함정**을 설명한다.

---

## 1. Routing 호출 토폴로지 — Dual-Dijkstra 격리

경로 계산은 **서로 다른 그래프를 빌드하는 두 개의 독립 엔진**으로 갈라져 있다. 같은 이름(`buildGraph`/`dijkstra`)이지만 다른 파일·다른 노드 키 스킴이라 결과가 OD에 따라 갈릴 수 있다.

| 엔진 | 진입점 | 노드 키 | 쓰이는 곳 |
|------|--------|---------|-----------|
| 장애 우회 (disruption-detour) | `routeService.calculateRoute` (`routeService.ts:390`) | `${stationId}#${lineId}` — **`::subIdx` 없음** (`routeService.ts:86`) | `findAlternativeRoutes`/`findMultipleAlternatives` (지연·장애 시 노선 제외 재탐색) |
| 메인 UI 탐색 (main search) | `getDiverseRoutes` (`kShortestPath.ts:813`) → `findKShortestPaths` | `${stationId}#${lineId}::${subIdx}` — **sub-line 보존** (`kShortestPath.ts:117,122`) | `useRouteSearch.ts:120`, `useCommuteRouteSummary.ts:97`, `useCommuteRouteSteps.ts:61`, `routeVia.ts:40-41` (경로 카드·출퇴근 요약 전부) |

### 핵심: 두 엔진은 *구조적으로 다른 그래프*를 만든다 — 결과가 갈릴 수 있다

같은 OD에 대해 두 엔진이 **다른 transferCount, 심지어 다른 feasible path**를 낼 수 있다. 원인은 노드 키 스킴 차이다:

- **분기 노선(branch line) 처리:** `kShortestPath`는 본선/지선을 `::subIdx`로 분리된 노드로 유지해 셔틀 환승(예: 2호선 신정지선↔본선 @신도림)을 `transferCount`에 반영한다(`kShortestPath.ts:170-215`의 branch junction transfer edge). `calculateRoute`는 `::subIdx`가 없어 본선·지선이 한 노드로 collapse → **셔틀 환승이 카운트되지 않고**, trunk[0]+branch[2] 양쪽에 동시 등장하는 역은 양쪽 이웃에 무료 인접(teleport)이 생긴다. SKILL.md "Graph Structure" 섹션의 `::subIdx` 설명은 `kShortestPath` 기준임에 유의.
- **2호선 순환 seam:** `kShortestPath`는 trunk(`2::0`) 첫역↔마지막역(시청↔충정로) ring edge를 실제로 추가한다(`kShortestPath.ts:220-253`). `calculateRoute`의 순환 처리는 `${first}_2` **언더스코어 키**를 쓰는데(`routeService.ts:135`), 그래프 노드는 전부 `${stationId}#${lineId}` 포맷이라 Dijkstra가 `_2` 키를 절대 조회하지 않는다 → **silent no-op**(코드 주석도 "existing silent no-op"로 명시, `routeService.ts:129`). 즉 `calculateRoute`는 2호선 순환 seam을 가로지르는 경로를 못 찾을 수 있다.

→ **디버깅 함의:** 분기 노선이나 2호선 순환 seam이 관련된 OD에서 "카드(메인 UI)와 장애 우회 경로의 환승 수/경로가 다르다"는 버그는 두 엔진의 그래프 차이로 설명된다. 두 엔진을 같은 동작으로 가정하지 말 것.

### 실시간 배선: 두 메커니즘을 혼동하지 말 것

실시간 데이터가 경로에 영향을 주는 경로는 **두 개**이고, 둘의 배선 상태가 다르다:

1. **`congestionMultipliers`** (그래프 가중치 조정) — `getDiverseRoutes`(`kShortestPath.ts:817`)와 `findKShortestPaths`까지 **배선돼 있다**. 노선 혼잡 배수를 엣지 weight에 곱한다. 메인 UI 경로에 반영 가능.
2. **`realtimeArrivals` / `getNextTrainWaitMinutes`** (다음 열차 대기 시간) — **그래프 가중치가 아니라** path 확정 *후* 첫 segment의 `estimatedMinutes`에 더하는 후처리 bump다(`routeService.ts:416-428`). 이건 **`calculateRoute`에만** 파라미터가 존재하고(`routeService.ts:395`), **`getDiverseRoutes`엔 파라미터 자체가 없다**.

게다가 `calculateRoute`의 `realtimeArrivals` 파라미터조차 **현재 어떤 호출자도 공급하지 않는다** — `src/`에서 `realtimeArrivals`는 `routeService.ts:395/419/422` 3곳(정의·내부 사용)에만 등장하고 호출처는 0건이다. 즉 다음-열차-대기 capability는:

- 장애 우회 엔진(`calculateRoute`)엔 **있으나 dormant** (아무도 라이브 도착을 안 먹임)
- 메인 검색 엔진(`getDiverseRoutes`)엔 **파라미터조차 없음**

→ **단, 라이브 경로 카드 반영은 PR #254에서 별도 메커니즘으로 shipped:** `applyRealtimeBoardingWait`(`routeService.ts:456`)가 path 확정 후 첫 segment에 대기 분을 덧씌우는 후처리 overlay이며 `useRouteSearch.ts:164`에서 호출된다 — `getDiverseRoutes` 파라미터 추가 없이. 위 dormant 진단은 `calculateRoute`의 5번째 param 한정이다.

---

## 2. OD 회귀 디버깅 체크리스트

특정 OD에서 경로/환승이 틀릴 때 아래 3개를 순서대로 의심한다.

### ① Yen's multi-source origin 한계 — `transferCount === 0`을 단정하지 말 것

`getStationNodeKeys`(`kShortestPath.ts:340-355`)는 출발역이 속한 **모든 sub-line 노드 키**를 반환하고, `dijkstra`는 그 키들을 전부 distance 0으로 seed한다(`kShortestPath.ts:385-390`). 즉 **출발역의 노선 선택이 비용 없이(invisible) 이뤄진다** — 멀티소스라 출발 노선을 고르는 "환승"이 경로상에 안 나타난다.

함정: 환승역이 출발역인 OD에서, 출발 노선 선택이 무료라 "direct path"처럼 보이거나, 반대로 Yen's 탐색 순서가 특정 토폴로지 경로를 K 안에서 못 잡아 `transferCount === 0`(직행)으로 보일 수 있다. **직행이 없는데 있다고, 또는 환승 1회짜리를 0으로 단정하지 말 것.** K를 올려(`K_SHORTEST_CANDIDATES`) 그 경로가 늦게 등장하는지 먼저 확인한다.

### ② U-turn(redundant line revisit) 판별은 train 시퀀스로 — `route.lineIds` Set 사용 금지

U-turn(노선을 떠났다 우회 후 같은 노선으로 복귀, 예: 4→1→4 @서울역)은 `hasRedundantLineRevisit`(`kShortestPath.ts:741-745`)로 컬링한다. 이 판별은 반드시 **train(non-transfer) segment의 lineId 시퀀스**를 쓴다:

```ts
const trainLines = route.segments.filter(s => !s.isTransfer).map(s => s.lineId);
const compressed = trainLines.filter((l, i) => i === 0 || l !== trainLines[i - 1]);
return new Set(compressed).size !== compressed.length;
```

**`route.lineIds`를 쓰면 안 된다** — `getRouteLineIds`(`route.ts:357-360`)가 이미 `Set`-dedup해서 `[4,1,4]`의 순서·중복을 통째로 잃는다. 연속 중복을 먼저 compress하는 이유: 같은 trunk 안 본선↔지선 셔틀 재방문(둘 다 trunk '2')은 정당한 경로라 보존해야 하기 때문. U-turn 컬링이 과·소 작동하면 이 함수가 `lineIds` Set으로 회귀했는지부터 본다.

### ③ Line-level weighting은 ~80% 천장 — cross-OD cascade 위험

엣지 weight는 노선별 단일 평균(`lineSpeed.json`, `getLineHopMinutes` via `route.ts:206-209`)에 기댄다. 노선당 하나의 weight라 한 노선의 실제 구간별 변동(도심 dwell vs 외곽)을 약 80% 수준까지만 표현하고, **한 노선 weight를 건드리면 그 노선을 지나는 모든 OD가 동시에 흔들리는(cross-OD cascade)** 위험이 있다. 한 OD를 고치려다 다른 OD를 깬다.

천장을 넘는 escape hatch는 **`segmentSpeed.json` per-edge override**다(`route.ts:256-286`의 3단계 fallback: segment override → line-level → 글로벌 평균). per-edge 변경은 **국소적**이라 다른 OD로 cascade되지 않는다 — 특정 A↔B 구간이 틀렸으면 노선 weight가 아니라 segment override로 고친다.
