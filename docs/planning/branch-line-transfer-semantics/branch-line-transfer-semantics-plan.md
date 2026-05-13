# Branch-Line Transfer Semantics — Plan

**Created**: 2026-05-14
**Status**: Phase 1 RED tests 준비 단계
**Owner**: 002bill

## Why

PR #85가 lines.json에 nested-array schema(`string[][]`)로 분기 노선을 올바르게 표현했지만, **그래프 빌더가 같은 노선의 본선/지선을 단일 노드로 통합**해서 분기점 환승이 transferCount에 반영되지 않는다.

**증상**: 까치산(2호선 신정지선) → 선릉(2호선 본선) 라우팅이 "직통, 환승 0회"로 표시. 실제 운영체계는 신정지선 열차가 까치산↔신도림 셔틀이라 **신도림 환승 1회 필수**.

**위치**: `src/services/route/kShortestPath.ts:79`
```ts
const nodeKey = `${stationId}#${lineId}`;
```
같은 station + 같은 lineId면 단일 노드. 본선 subarray와 신정지선 subarray가 모두 `sindorim#2` 노드를 공유 → transferCount=0으로 fall through.

**부수 발견**:
1. **2호선 순환선 wrap 코드 silent no-op** (`kShortestPath.ts:127-160`) — 키 포맷이 `${first}_2`(underscore)인데 본문이 `${stationId}#${lineId}`(hash)로 바뀌면서 매치 안 됨. 시청↔본선 종착역 edge 없음. 코드 주석에 "fix in separate phase if Line 2 wrap is needed" 있음.
2. **Skill 문서 doc-rot** — `.claude/skills/route-fare-calculation`에 노드 키 `{stationId}_{lineId}` 명시. `_`→`#` 리네임 시 누락.

## What

같은 노선의 subarray마다 sub-line id를 부여해서 본선↔지선이 별도 노드로 분리되도록 한다. 분기점 station(예: 신도림, 성수)에서 sub-line 간 transfer edge를 추가한다.

**비-목표** (out of scope):
- 다른 노선 환승 로직 (이미 동작 중)
- UI 카드 디자인 변경 (transferCount 정확해지면 자동 반영)
- 요금 계산 변경 (총 station count는 동일)

## How — 3 sub-PR

### Sub-PR #1: RED 통합 테스트 + 분기 노선 inventory

**목표**: 모든 nested-array 노선의 branch junction OD pair 식별하고 RED integration test로 회귀 net 미리 펴기. 프로덕션 코드 변경 0줄.

**산출물**:
- `src/services/route/__tests__/branchTransferSemantics.integration.test.ts` — 분기 OD pair RED test
- 본 문서의 context.md에 inventory 표

**커버리지 (RED)**:
- 까치산 → 선릉 (2호선 신정지선 → 본선): expected transferCount=1
- 성수 → 건대입구 (2호선 성수지선 → 본선): transferCount=0 (성수가 본선 노드, 건대입구도 본선)
- 신답 → 강남 (2호선 성수지선 → 본선): transferCount=1
- 마천 → 광화문 (5호선 마천지선 → 본선): transferCount=1
- 신내 → 광운대 (6호선 본선 → 응암 ring): transferCount 검증
- 운정 → 동탄 (gtx_a 분리 운행 → 직결 전): 경로 미발견 또는 transferCount=1
- gyeongchun 망우선 회귀: 회기 → 망우 OD

**예상 작업량**: 1일

### Sub-PR #2: Sub-line id encoding + branch transfer edges

**목표**: PR #1의 RED 테스트 전부 GREEN. 같은 노선 sub-line 분리 + 분기점 transfer edge + 순환선 wrap key format 통일.

**변경**:
1. **`kShortestPath.ts` 노드 키 변경**:
   - `${stationId}#${lineId}` → `${stationId}#${lineId}::${subIdx}` (subIdx 0이 trunk)
   - Trunk(`::0`)는 backwards-compat 위해 `${stationId}#${lineId}` 별칭 유지 가능
2. **branch junction transfer edges**:
   - 같은 station이 한 노선의 N개 subarray에 등장 → sub-line 간 양방향 transfer edge
   - Weight: 새 상수 `AVG_BRANCH_SHUTTLE_WAIT` (~3분, 본선 환승 4분보다 약간 짧음)
3. **순환선 wrap fix**: `${first}_2` → 새 키 포맷 통일. 2호선 본선 + 6호선 응암 ring 적용.
4. **UI display mapping** (`utils/colorUtils.ts` LINE_LABELS):
   - `"2::1"` → "2호선" (trunk과 동일 라벨)
   - LineBadge / transferLabel이 sub-id를 받아도 trunk 라벨 표출
5. **routeService transferCount 계산**: 기존 로직이 lineId 변경 감지 기반이면 sub-line 전환도 자동 카운트됨 — 확인 후 fix.
6. **Skill 문서 doc-rot fix**: `route-fare-calculation` SKILL.md의 노드 키 표기 갱신.

**예상 작업량**: 2-3일

### Sub-PR #3: Yen's signature-dedupe + regression net 통합

**목표**: Sub-PR #2가 K-shortest 후보 multiplicity를 부풀린 영향을 흡수. PR79 follow-ups Priority 1(`산곡 .skip 해제`) 동시 해결.

**변경**:
- `kShortestPath.ts` spur generation 시점에 signature-dedupe in-loop 추가 (현재 후처리 `groupMap` 방식을 spur 직후로 이동)
- `kShortestPath.integration.test.ts:36` 산곡 .skip 해제
- 추가 회귀 net: 모든 PR #1 OD pair + 산곡 + Priority 3 stations.json 데이터 품질 검증

**예상 작업량**: 2일 (메모리 `feedback_k_shortest_unrelated_data_cascade` 경고 — multi-OD canary 필수)

## Estimated total: 5-6 working days, 3 PRs

## Risk

- **Cascade**: Sub-PR #2가 같은 노선 내 transfer edge를 추가하면서 K-shortest 후보 셋의 multiplicity 증가. Sub-PR #3까지 머지되기 전까지 다른 OD pair 회귀 가능 → Sub-PR #2 머지 시 임시 .skip 허용, #3가 close.
- **UX consistency**: 사용자에게 "2호선 환승"이 보이는 게 자연스러운지 도메인 검증 필요. 라벨을 "2호선 (지선)"으로 분리할지 등 디자인 결정.
- **Backwards-compat**: 외부 코드(현재 단일 노선 직통 가정)가 sub-line id 노출 받으면 깨질 수 있음. UI 매핑 레이어에서 strict하게 trunk id로 정규화 필요.

## Memory references

- [[two-layer-bug-partial-green]] — 데이터 layer GREEN 후 알고리즘 layer 발견 패턴
- [[line-stations-nested-array-schema]] — `string[][]` schema
- [[yens-multisource-origin-selection-limit]] — Sub-line 도입이 multi-source 의미론에 영향
- [[k-shortest-unrelated-data-cascade]] — 한 노선 변경이 무관 OD 흔드는 위험
- [[pr79-pending-followups]] — Priority 1 (signature-dedupe) 통합
- [[ui-squash-n-to-1-relation]] — picker fix 패턴이 유사 (UI 매핑 시 참고)
