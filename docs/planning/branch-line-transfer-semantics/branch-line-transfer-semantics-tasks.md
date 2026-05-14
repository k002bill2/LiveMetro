---
parent_plan: branch-line-transfer-semantics-plan.md
phase: 1_inventory_and_red_tests
last_updated: 2026-05-14
status: not_started
---

# Branch-Line Transfer Semantics — Tasks

**Progress**: 0 / TBD tasks completed

## Sub-PR #1: RED 통합 테스트 + 분기 노선 inventory

### Inventory
- [ ] `lines.json` 스캔: `subarrays.length > 1` 인 모든 노선 식별
- [ ] context.md inventory 표 정확화 (subarray 역 개수, 분기점 station id, 대표 OD pair)
- [ ] 위키피디아 cross-verify: 신정지선/성수지선/마천지선/응암 ring/망우선/gtx_a 운행체계
- [ ] stations.json `lines` 배열에서 sub-line 정보 부재 확인 (현재는 trunk lineId만)

### RED Integration Tests
- [ ] 테스트 파일 생성: `src/services/route/__tests__/branchTransferSemantics.integration.test.ts`
- [ ] 까치산 → 선릉: `transferCount === 1`, 환승역 `신도림`
- [ ] 신답(2호선 성수지선) → 강남: `transferCount === 1`, 환승역 `성수`
- [ ] 마천 → 광화문: `transferCount === 1`, 환승역 `강동` 또는 `강동구청` (위키 확인)
- [ ] 응암 ring entry test: 새절 → 한강진 (`transferCount` 정확)
- [ ] gyeongchun 망우 회기 → 망우 OD
- [ ] gtx_a 운정 → 동탄 (분리 운행 — 경로 미발견 or transferCount=1)
- [ ] 통제 그룹: 단일 subarray 노선 (sinbundang, bundang) 회귀 없음 확인

### Verification
- [ ] `npm test -- branchTransferSemantics` 실행 — 모든 신규 test FAIL (RED) 확인
- [ ] 기존 통합 테스트(`kShortestPath.integration.test.ts`) 전부 PASS 유지 확인
- [ ] tsc + lint 깨끗

### Sub-PR #1 Commit & PR
- [ ] 새 브랜치 `phase/branch-transfer-red-tests`
- [ ] Conventional Commits 포맷 commit
- [ ] PR 본문: RED 의도 + Sub-PR #2 대기 명시
- [ ] PR79 follow-ups 메모리 업데이트 (Priority 7 status: phase 1 in progress)

---

## Sub-PR #2: Sub-line id encoding + branch transfer edges

### Graph builder
- [ ] `kShortestPath.ts` 노드 키 인코딩 변경 (`${stationId}#${lineId}::${subIdx}`)
- [ ] trunk(`::0`) backwards-compat alias 등록
- [ ] branch junction transfer edge 추가 헬퍼 함수 추출
- [ ] 같은 노선 내 sub-line 쌍에 양방향 transfer edge 생성
- [ ] 순환선 wrap 코드 키 포맷 통일 (`_2` → `#2::0`)
- [ ] Line 6 응암 ring도 wrap 적용

### Constants
- [ ] `src/models/route.ts` `AVG_BRANCH_SHUTTLE_WAIT` 상수 추가 (~3분)
- [ ] route-fare-calculation skill에 상수 등록

### Display layer
- [ ] `utils/colorUtils.ts` LINE_LABELS: sub-line id → trunk 라벨 normalize
- [ ] `utils/transferLabel.ts`: sub-line normalize 헬퍼
- [ ] `LineBadge` 컴포넌트: sub-id 입력도 trunk 색상 매핑
- [ ] `routeService.ts` transferCount 계산: sub-line 전환도 +1 (확인 + 필요 시 fix)

### Sub-PR #1 RED → GREEN
- [ ] `branchTransferSemantics.integration.test.ts` 모든 케이스 GREEN
- [ ] 기존 통합 테스트 전부 PASS 유지 (회귀 net)
- [ ] 산곡 .skip은 Sub-PR #3까지 유지

### Doc-rot fix
- [ ] `.claude/skills/route-fare-calculation/SKILL.md` 노드 키 표기 `_` → `#`
- [ ] Skill 문서에 sub-line id 인코딩 + AVG_BRANCH_SHUTTLE_WAIT 추가
- [ ] CLAUDE.md / docs/claude/api-reference.md 영향 확인

### Verification
- [ ] `npm run type-check` 0 에러
- [ ] `npm run lint` 0 에러
- [ ] `npm test -- --coverage` (커버리지 임계값 통과)
- [ ] 디바이스에서 까치산→선릉 라우팅 직접 확인: "환승 1·신도림" 표시

### Sub-PR #2 Commit & PR
- [ ] 새 브랜치 `phase/branch-transfer-encoding`
- [ ] PR 본문: 노드 키 변경 + transfer edge + 순환 wrap fix + display normalize 통합
- [ ] PR79 follow-ups 메모리 업데이트
- [ ] 새 메모리: sub-line id encoding pattern (memory candidate)

---

## Sub-PR #3: Yen's signature-dedupe + regression net 통합

### Algorithm
- [ ] `kShortestPath.ts` spur generation 시점에 signature-dedupe in-loop 추가
- [ ] 기존 후처리 `groupMap` 제거 또는 보조 layer로 격하
- [ ] Multi-OD canary: PR #1 OD pair + 산곡 + 기존 17개 통합 테스트 전부 PASS

### PR79 follow-ups Priority 1 close
- [ ] `kShortestPath.integration.test.ts:36` 산곡 .skip 해제
- [ ] 산곡 GREEN 확인 (강남구청 경유 path 발견)
- [ ] Priority 3 stations.json 데이터 품질 점검 (도라산역, (0,0) 좌표, identity collision)

### Regression net 확장
- [ ] 통합 테스트에 sub-line edge case 추가
  - 같은 sub-line 내 stations OD (transfer=0)
  - sub-line → 다른 노선 → 같은 노선 다른 sub-line (transfer=2)
  - 본선만으로 가능한 OD가 sub-line 우회 안 함 확인

### Verification
- [ ] 모든 통합 테스트 PASS (산곡 포함)
- [ ] 디바이스 manual smoke: 까치산↔선릉, 마천↔광화문, 새절↔한강진 (3개 분기 노선)
- [ ] EAS preview 빌드 후 OTA 채널에서 실측

### Sub-PR #3 Commit & PR
- [ ] 새 브랜치 `phase/yens-signature-dedupe-and-regression`
- [ ] PR 본문: Priority 1 close + 본 phase regression net 완성
- [ ] PR79 follow-ups 메모리: Priority 1 + Priority 7 모두 close
- [ ] phase 종료 후 본 docs를 archive 위치로 이동 (`docs/planning/_archive/branch-line-transfer-semantics/`) 또는 inline 유지 결정

---

## Quality Gates (각 Sub-PR 공통)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (coverage 75%/70%/60% 임계값)
- [ ] PR Gemini cross-review verdict 검토
- [ ] PR 본문에 영향 OD pair + 비-목표 명시

## Phase Closeout
- [ ] 까치산↔선릉 manual 검증 영상 (선택)
- [ ] 메모리 `project_pr79_pending_followups` Priority 1, 7 close
- [ ] 새 메모리 `project_sub_line_id_encoding.md` 작성 (분기 노선 인코딩 패턴)
- [ ] `docs/planning/branch-line-transfer-semantics/` 보관 위치 결정 (inline 유지 vs `_archive/` 하위로 이동)
- [ ] CLAUDE.md / 관련 docs 영향 확인 + update

---

## Progress Tracking

| Sub-PR | Total | Completed | Status |
|--------|-------|-----------|--------|
| #1 RED + inventory | TBD | 0 | not_started |
| #2 Encoding + edges | TBD | 0 | not_started |
| #3 Dedupe + regression | TBD | 0 | not_started |
| **TOTAL** | **TBD** | **0** | **not_started** |

---
**Task Management**: Sub-PR #1 시작 시 inventory 결과 따라 task 수 확정. 체크하며 last_updated 갱신.
