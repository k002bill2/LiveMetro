# Branch-Line Transfer Semantics — Context

**Created**: 2026-05-14

## Decision log

### D1: 노드 키 인코딩 — `${stationId}#${lineId}::${subIdx}`

**Why**: subIdx를 명시적으로 분리하면 (1) parse 시 prefix 매칭 쉬움, (2) trunk(`::0`)와 branch 자연스럽게 구분, (3) Yen's signature 생성 시 sub-line별 별도 path로 인식. 대안 `${lineId}_${subIdx}` 같은 underscore 인코딩은 LINE_LABELS 키와 충돌 위험.

**Reject 대안**:
- 별도 lineId 발급 (`"2_sinjeong"` 등) — 옵션 C에서 검토했으나 stations.json `lines` 배열도 모두 수정해야 해서 surface area가 더 큼. 데이터 보존 측면에서 sub-line은 알고리즘 내부 표현으로 격리.

### D2: trunk subIdx=0은 `${stationId}#${lineId}` 별칭 유지

**Why**: `_2`(underscore) 잔재 코드처럼 키 포맷 통일은 silent breakage 위험. 단계적 마이그레이션 위해 trunk 노드는 두 키 모두 받아들이도록 graph builder가 alias 등록.

**적용**: Sub-PR #2 종료 시점에 trunk 키도 `::0` suffix로 통일하고 alias 제거 (별도 cleanup 커밋).

### D3: AVG_BRANCH_SHUTTLE_WAIT 상수 도입

**Why**: 같은 노선 본선↔지선 환승은 다른 노선 환승(`AVG_TRANSFER_TIME=4분`)과 의미가 다름. 신정지선/마천지선/응암 ring 모두 셔틀 열차 배차가 본선보다 빈도 낮음.

**Initial value**: 3분 (잠정). 실제 배차 자료 확인 후 보정.

**Reject 대안**:
- `AVG_TRANSFER_TIME` 재사용 — 본선 신호기 분리 + 같은 플랫폼 환승이 가능한 경우(예: 신도림 신정지선) 시간 과대 추정.
- 0분 — transferCount는 +1이지만 weight 변화 없으면 K-shortest가 분기 경로를 강하게 선호하게 됨 (잘못된 압축).

### D4: UI 표시 라벨은 trunk와 동일

**Why**: 사용자가 "2호선 [신정지선]" vs "2호선 [본선]" 구분을 신경쓰지 않음. 환승 1회로만 표시되면 충분. 라벨 분리는 over-engineering.

**적용 위치**: `LineBadge`, `transferLabel`, route segment 표시. sub-line id 받으면 LINE_LABELS lookup 전에 `lineId.split('::')[0]`으로 trunk normalize.

### D5: PR79 follow-ups Priority 1 (Yen's signature-dedupe) 통합

**Why**: Sub-PR #2가 sub-line edge로 K 후보를 multiplicity로 부풀리면 산곡 .skip 같은 기존 cascade 더 악화. Sub-PR #3에서 in-loop dedupe로 동시 해결이 자연스러움.

**Cross-reference**: `project_pr79_pending_followups.md` Priority 1 (현재 "산곡 .skip 해제, signature-dedupe 알고리즘 변경 필요")이 본 phase Sub-PR #3로 흡수됨. 머지 시 PR79 메모리 update.

## Branch-line inventory (Sub-PR #1 RED 대상)

| 노선 | subarrays | 분기점 | 대표 RED OD pair |
|------|-----------|--------|-------------------|
| **2** (`서울 2호선`) | 본선 ring(43) + 성수지선(5) + 신정지선(5) | 성수 (본선↔성수지선), 신도림 (본선↔신정지선) | 까치산 → 선릉, 신답 → 강남 |
| **5** (`서울 5호선`) | 본선(49) + 마천지선(8) | 강동 | 마천 → 광화문 |
| **6** (`서울 6호선`) | 본선(34) + 응암 순환(7) | 응암 | 새절 → 한강진 |
| **gyeongchun** | 본선(24) + 망우선(2) | 망우 | 회기 → 망우 |
| **gtx_a** | 운정-서울(5) + 수서-동탄(4) | (분리 운행, 직결 X) | 운정 → 동탄 (경로 미발견 expected) |
| **gyeongui** | 본선(여러 subarray) + 임진강 (PR #79) | TBD | 디테일 PR #79 머지 후 |
| **bundang/sinbundang/etc.** | 단일 subarray | — | (해당 없음 — 통제 그룹) |

**Note**: Sub-PR #1 작업 첫 단계가 위 표 정확화. PR #85 머지 후 `lines.json` 재스캔해서 subarrays.length > 1 인 모든 노선 inventory.

## Algorithm: branch junction transfer edge 추가 위치

`kShortestPath.ts:162` "Add transfer edges" 블록에서 현재 **다른 노선 간**만 transfer 추가. 같은 노선 내 sub-line은 누락. 추가 로직:

```ts
// (1) 같은 station이 한 노선 안에서 N개 subarray에 등장하는지 확인
// (2) 등장 시 각 sub-line 쌍에 transfer edge 추가
LINE_STATIONS의 각 [lineId, segments]에서:
  station-to-subIdxs 맵 만들고
  N >= 2 인 station에서 sub-line 간 양방향 edge 추가 (weight: AVG_BRANCH_SHUTTLE_WAIT)
```

이 로직은 다른 노선 transfer 로직(`L162-198`)과 분리해서 별 헬퍼 함수로 추출 권장 — 회귀 분리 + 단위 테스트 작성 쉬움.

## File map (예상 변경 파일)

| Sub-PR | 파일 | 변경 종류 |
|--------|------|----------|
| #1 | `src/services/route/__tests__/branchTransferSemantics.integration.test.ts` | 신규 (RED) |
| #1 | `docs/planning/branch-line-transfer-semantics/branch-line-transfer-semantics-context.md` | 본 문서 inventory 표 정확화 |
| #2 | `src/services/route/kShortestPath.ts` | 노드 키, branch transfer, 순환선 wrap |
| #2 | `src/models/route.ts` | `AVG_BRANCH_SHUTTLE_WAIT` 상수 |
| #2 | `src/utils/colorUtils.ts` (LINE_LABELS) | sub-line id 정규화 |
| #2 | `src/utils/transferLabel.ts` | sub-line normalize |
| #2 | `src/services/route/routeService.ts` | transferCount 계산 검증 |
| #2 | `.claude/skills/route-fare-calculation/SKILL.md` | doc-rot fix |
| #3 | `src/services/route/kShortestPath.ts` | signature-dedupe in-loop |
| #3 | `src/services/route/__tests__/kShortestPath.integration.test.ts` | .skip 해제 + 회귀 net 확장 |

## RED Evidence — 2026-05-14 (Sub-PR #1 작성 직후 캡처)

Sub-PR #1의 `branchTransferSemantics.integration.test.ts`에서 `.skip`을 일시 해제하고 `npx jest --no-cache` 실행한 fresh 결과. 그 후 `git checkout --`로 복원해 `.skip` 상태로 commit `d2d5ae9`에 머무름.

```
FAIL src/services/route/__tests__/branchTransferSemantics.integration.test.ts

  Branch-line transfer semantics (RED until Sub-PR #2)
    Line 2 — 신정지선 ↔ 본선
      ✕ 까치산 → 선릉: 신도림 환승 1회 (499 ms)
        Expected: 1 / Received: 0
    Line 2 — 성수지선 ↔ 본선
      ✕ 신답 → 강남: 성수 환승 1회 (356 ms)
        Expected: 1 / Received: 0
    Line 5 — 마천지선 ↔ 본선
      ✕ 마천 → 하남검단산: 강동 환승 1회 (742 ms)
        Expected: 1 / Received: 0
    gyeongchun — 망우선 ↔ 본선
      ✕ 광운대(gyeongchun) → 청량리: 상봉 환승 1회 (236 ms)
        Expected: 1 / Received: 0
    gtx_a — 분리 운행 (junction 없음, 회귀 net)
      ✓ 운정중앙 → 동탄: 다른 노선 경유 (transferCount >= 2) (1313 ms)

Tests: 4 failed, 1 passed, 5 total
```

**해석**:
- 4개 fail 모두 동일 시그니처 `Expected 1 / Received 0` — 본선↔지선 환승이 그래프에 없다는 단일 root cause 증거. 4건이 같은 메커니즘으로 깨진다는 건 fix도 한 곳(노드 키 인코딩)에서 통합 해결 가능 신호.
- gtx_a PASS는 회귀 net — 분리 운행은 sub-line encoding 이후에도 결과 동일해야 함. Sub-PR #2 머지 전 필수 회귀 게이트.
- 메모리 `verification.md` Red-Green TDD step 2 ("수정 안 된 상태에서 fail 확인") 완료. step 3는 Sub-PR #2 머지 시 5/5 PASS로 입증.

## Sub-PR #2 acceptance criteria (RED evidence 기반)

1. 위 4개 RED → GREEN (`transferCount=1`, 환승역 정확)
2. gtx_a 1건은 PASS 유지 (회귀 net)
3. 기존 `kShortestPath.integration.test.ts` 17건 모두 PASS 유지
4. `npm run type-check` + `npm run lint` 0 errors
5. 디바이스 manual: 까치산→선릉 라우팅에서 "신도림 환승 1회" 표시

## External references

- 위키피디아 2호선 신정지선: [서울 지하철 2호선 신정지선](https://ko.wikipedia.org/wiki/서울_지하철_2호선#신정지선) — 까치산↔신도림 셔틀 운행체계 확인
- 위키피디아 2호선 성수지선: 성수↔신설동 셔틀
- 메모리 `feedback_seoul_api_sandbox_hang_wikipedia_fallback` — sandbox에서 Seoul API hang 시 Wikipedia WebFetch가 정적 사실(노선 순서/역명) 대안

## Related memories

- [[two-layer-bug-partial-green]]
- [[line-stations-nested-array-schema]]
- [[lines-json-order-load-bearing]]
- [[yens-multisource-origin-selection-limit]]
- [[k-shortest-unrelated-data-cascade]]
- [[yens-k-shortest-natural-limit]]
- [[pr79-pending-followups]]
- [[ui-squash-n-to-1-relation]]
- [[integration-test-separates-data-regression]]
