# Branched Line Schema Fix — Design

**Date**: 2026-05-13
**Status**: Design approved, pending implementation plan
**Predecessor phase**: `dev/archive/route-lines-json-order-fix/` (PR #69, #75, #76, #77, #78)
**Scope**: 6 branched lines — gyeongui (first/validate), then Line 2, 5, 6, gyeongchun, gtx_a

## Problem Statement

`src/data/lines.json`의 `stations` 필드는 lineId마다 단일 `string[]`을 사용한다. graph builder는 이 배열을 `array[i] ↔ array[i+1]` 인접 edge SoT로 사용한다 (메모리 [lines.json 순서는 인접성 SoT]). 이 schema는 분기 토폴로지를 표현할 수 없다.

분기 노선 6개 (Line 2, 5, 6, gyeongui, gyeongchun, gtx_a)에서 본선과 지선이 한 array에 mash되며 잘못된 인접 edge가 발생한다:

- **Line 5**: `상일동(44) ↔ 둔촌동(45)`, `마천(51) ↔ 강일(52)` — 마천지선이 본선 사이에 끼어듦
- **Line 6**: `구산 ↔ 새절` — 응암 순환의 잘못된 본선 직결
- **gyeongchun**: `광운대(1) ↔ 청량리(2)` — 망우선 분기 시작점이 본선처럼 연결
- **gtx_a**: `동탄 ↔ 운정중앙` — 분리 운행 2단계가 직결로 표현 (2026.8 직결 시 자연 정상화 예정)
- **gyeongui**: `대곡(0) ↔ 이촌(1)`, `지평(29) ↔ 서울역(30)` 등 다수 — 4 운행 계통 mash
- **Line 2**: jump=18 의심 (성수지선·신정지선) — Wikipedia 확인 필요

영향: K-shortest path가 존재하지 않는 직결 경로를 발견 → 사용자에게 잘못된 빠른 경로 추천 + 실제 환승 경로 누락.

## Decisions

### D1. Schema 형태: nested array per lineId, backwards-compatible

**Chosen**: 분기 노선만 `string[][]`, 단일 운행선 18개는 `string[]` 그대로 유지. Loader가 정규화.

**Rejected**:
- 별도 lineId 분리 (`5-main`, `5-macheon` 등) — `LINE_COLORS`, `stations.json[].lines`, 실시간 API 매핑, UI 라벨 모두 변경 필요. blast radius 과다.
- `branches` metadata 필드 (`{trunk: [...], branches: [{at, stations}]}`) — graph builder가 분기 metadata를 별도 처리해야 함. 새 코드 path 도입.

**Rationale**: 같은 station id가 여러 subarray에 등장하는 것을 분기점으로 사용하면 (graph builder 노드 키는 `${stationId}#${lineId}` 한 개), 분기 정보가 데이터에 implicit하고 코드에는 invisible. 기존 graph builder의 inner loop가 한 단계만 깊어지면 끝.

### D2. Scope: gyeongui 먼저, 5 노선은 후속 PR

**Chosen**: PR-1에서 schema infra + gyeongui (가장 복잡한 케이스로 schema 검증). PR-2~6에서 1 line = 1 PR.

**Rejected**:
- 6개 일괄 1 PR — 리뷰 부담 큼, rollback 어려움
- 단순한 케이스 (Line 5)부터 — schema가 불충분하다는 발견이 늦음

**Rationale**: tracer bullet 전략. gyeongui (4 계통 mash)가 통과하면 나머지 5개는 schema 변경 없이 데이터만 reshape.

### D3. Type strategy: loader 정규화, 항상 `string[][]`

**Chosen**: `subwayMapData.ts` loader가 JSON 읽을 때 flat → `[[...]]` wrap. `LINE_STATIONS` export 타입은 `Record<string, readonly string[][]>`.

**Rejected**:
- Dual export (`LINE_STATIONS` flat + `LINE_SEGMENTS` nested) — dual SoT, 동기화 risk
- Union 타입 (`string[] | string[][]`) — 11 consumer마다 narrow 필요, lazy migration anti-pattern

**Rationale**: 명확한 type contract, type-safe, consumer 변경 최소화.

### D4. Priority: routing correctness only

**Chosen**: 잘못된 인접 edge 제거 + K-shortest 결과 정상화만. UI/색상/실시간 API 변경 없음.

**Rejected** (별개 phase):
- UI에서 분기를 별도 라벨 표시 ("5호선 마천지선")
- 실시간 도착 정보의 분기 구분
- Map 시각화 개선 (분기점 시각 효과)

**Rationale**: surgical changes 원칙 + scope creep 차단.

## Architecture

### Schema Contract

```jsonc
{
  "stations": {
    // 단일 운행선 18개: 변경 없음
    "1": ["s1", "s2", "s3", ...],

    // 분기 노선 6개: 다중 subarray
    "gyeongui": [
      ["yongmun", ..., "munsan"],          // 본선 trunk
      ["gajwa", "sinchon", "seoul"],       // 서울역 지선
      ["munsan", "imjingang", "uncheon"]   // 임진강 연장
    ]
  }
}
```

**Invariants** (`linesData.invariant.test.ts`로 강제):
1. 각 lineId의 stations는 `string[]` 또는 `string[][]` (mixed 금지)
2. 각 subarray는 비어있지 않음
3. flat union은 stations.json의 해당 line membership과 set-equal
4. 분기 노선의 분기점은 다중 subarray에 등장 (적어도 하나의 station이 count > 1)

### Runtime API

```typescript
// src/utils/subwayMapData.ts
function normalizeLine(raw: string[] | string[][]): string[][] {
  if (raw.length === 0) return [];
  return Array.isArray(raw[0]) ? raw as string[][] : [raw as string[]];
}

export const LINE_STATIONS: Record<string, readonly string[][]> =
  Object.fromEntries(
    Object.entries(linesData.stations).map(
      ([lineId, raw]) => [lineId, normalizeLine(raw)]
    )
  );

export const lineStationSet = (lineId: string): ReadonlySet<string> =>
  new Set(LINE_STATIONS[lineId]?.flat() ?? []);
```

### Graph Builder 변경

`kShortestPath.ts:71-100`, `routeService.ts:108`:

```typescript
// Before
Object.entries(LINE_STATIONS).forEach(([lineId, stationIds]) => {
  for (let i = 0; i < stationIds.length; i++) {
    // edge stationIds[i] → stationIds[i+1]
  }
});

// After
Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
  segments.forEach(stationIds => {
    for (let i = 0; i < stationIds.length; i++) {
      // edge stationIds[i] → stationIds[i+1]
    }
  });
});
```

**핵심**: 같은 station이 두 subarray에 등장하면 노드 키 (`${id}#${lineId}`)가 동일 → 같은 노드에 양방향 분기 edge 자동 추가. 별도 분기 metadata 처리 코드 불필요.

### Line 2 Circular Wrap

`kShortestPath.ts:124`, `routeService.ts:154`의 순환선 처리는 본선 subarray (`segments[0]`)에만 적용:

```typescript
const trunk = LINE_STATIONS['2']?.[0];
if (trunk && trunk.length > 1) {
  // wrap trunk[last] ↔ trunk[0]
}
```

분기 subarray (성수지선, 신정지선)는 wrap 안 함 — 단방향 직선.

### 11 Consumer 변경 분류

| 위치 | 변경 패턴 | diff 규모 |
|------|----------|----------|
| `kShortestPath.ts:71` (graph build) | `segments.forEach + for i` | +1 라인 |
| `kShortestPath.ts:124` (Line 2 wrap) | `segments[0]` 적응 | refactor 5라인 |
| `kShortestPath.ts:155, 201` | truthy check 조정 | +1 글자 |
| `routeService.ts:108` (graph build) | 동일 | +1 라인 |
| `routeService.ts:154` (Line 2 wrap) | 동일 | refactor 5라인 |
| `routeService.ts:185, 266, 439` | filter/check | +1 글자 |
| `subwayMapData.ts:96` (`ROUTABLE_STATION_IDS`) | `.flat(2)` | +1 글자 |
| `subwayMapData.ts:143` (`generateLinePathData`) | subarray마다 `M-L-L` segment | refactor 8라인 |
| `subwayMapData.ts:217` (`getStationsForLine`) | `segments.flat().map` | +1 라인 |
| `mapLayout.ts:67` | `.map(([id, segs]) => ({stations: segs.flat()}))` | +1 라인 |
| `CommuteRouteScreen.tsx:135` (index distance) | 같은 subarray 내에서만, fallback graph search | refactor 15라인 |

## Migration Sequence

| PR | 내용 | 잘못된 인접 edge 제거 | 회귀 net |
|----|------|---------|---------|
| **PR-1** | Schema infra + 11 consumer + gyeongui reshape + Line 2 wrap 적응 + invariant test | `대곡↔이촌`, `지평↔서울역`, 가좌 분기 모순 등 | gyeongui describe block 5 케이스 |
| **PR-2** | Line 5 reshape | `상일동↔둔촌동`, `마천↔강일` | Line 5 describe block 3 케이스 |
| **PR-3** | Line 6 reshape | `구산↔새절` | Line 6 describe block 2 케이스 |
| **PR-4** | gyeongchun reshape | `광운대↔청량리` | gyeongchun describe block 2 케이스 |
| **PR-5** | gtx_a reshape | `동탄↔운정중앙` | gtx_a describe block 2 케이스 |
| **PR-6** | Line 2 reshape (또는 closeout no-op) | 의심 인접 edge (Wikipedia 확인 우선) | Line 2 describe block 4 케이스 |

각 PR ground truth source: Korean Wikipedia 노선별 페이지 (메모리 [Seoul API hang → Wikipedia WebFetch fallback]). Sandbox에서 안정적.

**Per-PR 검증 게이트**:
1. `tsc --noEmit` 0 error
2. `npm run lint` 0 error
3. `npx jest --no-cache --watchman=false` 통과 (새 케이스 GREEN + 기존 무회귀)
4. 영향 OD pair 시나리오 3-5개 수동 검증
5. Commit 직전 `git branch --show-current` (메모리 [평행 세션 race 한 세션 두 번 fire])

**예상 비용**: PR-1 4-6h, PR-2~6 1.5-2h씩. 총 12-16h, 3-4 세션.

## Testing Strategy

### Layer 1: Schema invariant (`__tests__/linesData.invariant.test.ts` — 신규)

데이터 자기 일관성 자동 검증. 위 Architecture > Schema Contract의 invariant 4종.

### Layer 2: Graph builder unit (`kShortestPath.test.ts` 추가)

추상 모델 — mock LINE_STATIONS로 nested loop가 정확히 분기 edge를 만드는지:
- 동일 station이 여러 subarray에 → 양방향 분기 edge 생성
- 단일 subarray → 기존 동작 보존
- Line 2 circular wrap → `segments[0]`에만 적용

### Layer 3: Integration (`kShortestPath.integration.test.ts` 추가)

실제 lines.json 로드 후 사용자 시나리오. 메모리 [Integration test로 데이터 회귀 분리] 패턴.

PR-1 gyeongui 예시:
- `대곡 → 이촌` 환승 1+ 필수 (잘못된 인접 edge 제거 검증)
- `지평 → 서울역` 합리적 시간 ≥ 60분 (지평↔서울역 잘못 인접 제거)
- `가좌 → 서울역` 직결 존재 (분기 양방향 edge 검증)
- `가좌 → DMC` 직결 존재 (본선 edge 보존)
- `용산 → 용문` 직결 존재 (본선 trunk 무회귀)

### Layer 4: TDD Red-Green-Verify (메모리 [Red-Green Verification])

각 PR마다:
1. RED: 새 테스트 작성 → 데이터 변경 전 실행 → FAIL
2. GREEN: lines.json reshape → PASS
3. VERIFY: lines.json revert → 다시 FAIL → restore → PASS

### Layer 5: Cross-PR canary (메모리 [K-shortest 무관 데이터 cascade])

산곡↔선릉 강남구청 경로(K=25 catch)는 K-shortest cascade canary. 모든 PR에서 통과 확인. 새 cascade 발견 시 별개 phase로 즉시 분리.

## Risk Register

| # | 리스크 | 가능성 | 영향 | 완화 |
|---|--------|--------|------|------|
| R1 | K-shortest cascade (무관 OD pair 변경) | 중 | 중 | 산곡↔선릉 canary, 발견 시 별개 PR 분리 |
| R2 | `generateLinePathData` 지도 회귀 | 중 | 저 | RNTL snapshot 또는 manual 시각 검증 |
| R3 | `CommuteRouteScreen` 인덱스 거리 부정확 (다른 subarray) | 중 | 저 | 같은 subarray 아니면 graph search fallback |
| R4 | Subarray 분할 휴먼 에러 (schema 통과해도 분할 자체 틀림) | 중 | 고 | (a) Wikipedia ground truth 페치 (b) Integration test 인접 검증 (c) OD 시나리오 수동 검증 |
| R5 | 평행 세션 branch race (메모리 [Branch-tip race]) | 중 | 중 | commit 직전 branch 재확인, 회복 후 reflog |
| R6 | gyeongui 토폴로지 미지수 (4 계통 정확한 분리) | 고 | 중 | PR-1 첫 task로 Wikipedia fetch + 운행 계통 분석. 복잡 시 scope 재협의 |
| R7 | Sandbox/test 인프라 마찰 (jest cache, watchman) | 저 | 저 | `--no-cache --watchman=false` 기본 |
| R8 | Realtime API의 분기 모호성 | 저 | 저 | 본 phase 외 (Non-Goals) |

## Non-Goals

다음 항목은 가치 있지만 scope creep 차단을 위해 명시 제외:

1. UI에서 분기를 별도 라벨 표시 ("5호선 마천지선")
2. 실시간 도착 정보의 분기 구분 (Seoul Open API 응답 기반)
3. Map 시각화 개선 (분기점 시각 효과, dashed line 등)
4. Line 2 jump=18 사전 검증 — PR-6에서 처리 (Line 2 분기 없음 false positive면 closeout no-op)
5. 신설역 자동 audit script (메모리 [lines.json append-only 안티패턴] 완전 prevention)
6. Ground truth 자동 fetch 도구 (이전 phase B1.1)
7. `bundang`/수인분당선 노선 분리 (PR #69 closeout 결정 reaffirm)

## Definition of Done

- 6개 PR 머지 완료
- `kShortestPath.integration.test.ts`에 분기 노선 회귀 18+ 케이스 추가
- 산곡↔선릉 canary 포함 기존 17 회귀 무손실
- 모든 PR이 `tsc --noEmit` + `npm run lint` + `npx jest` 0 error
- `linesData.invariant.test.ts` 신규 invariant 4종 PASS
- 영향 OD pair 사용자 시나리오 30+ 케이스 수동 통과
- 메모리 업데이트 최소 1건 ("LINE_STATIONS string[][] schema with implicit branch points" 패턴)

## Related Memory References

- [lines.json 순서는 인접성 SoT](memory/project_lines_json_order_load_bearing.md)
- [lines.json append-only 안티패턴](memory/feedback_lines_json_append_only_anti_pattern.md)
- [K-shortest 무관 데이터 cascade](memory/feedback_k_shortest_unrelated_data_cascade.md)
- [Yens K-shortest 자연 한계](memory/project_yens_k_shortest_natural_limit.md)
- [Integration test로 데이터 회귀 분리](memory/project_integration_test_separates_data_regression.md)
- [Two-layer bug partial GREEN 함정](memory/project_two_layer_bug_partial_green.md)
- [Seoul API hang → Wikipedia WebFetch fallback](memory/feedback_seoul_api_sandbox_hang_wikipedia_fallback.md)
- [평행 세션 race 한 세션 두 번 fire](memory/feedback_branch_race_double_fire.md)
- [Branch-tip race + amend metadata trap](memory/feedback_branch_amend_race_commit_tree_recovery.md)
- [Jest cache가 deleted source에 대해 거짓 PASS](memory/feedback_jest_cache_lies_about_source.md)
- [Sandbox jest watchman 차단](memory/feedback_jest_watchman_sandbox.md)
