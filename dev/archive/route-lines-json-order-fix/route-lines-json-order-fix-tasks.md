---
parent_plan: route-lines-json-order-fix-plan.md
phase: A_completed_B_completed
last_updated: 2026-05-13
status: closeout — moved to dev/archive
---

# Route — lines.json Order Correctness — Tasks

**Progress**: Phase A 8/8 ✅. Phase B 24/24 노선 audit ✅.

## Phase B 종합 결과 (2026-05-13)

| 카테고리 | 노선 수 | 비율 | 노선 |
|---------|--------|------|------|
| 실수정 (PR 머지) | 5 | 21% | Line 3 (#75), Line 4 (#76), Line 8 (#77), gyeonggang + airport (#78) |
| closeout no-op (좌표 jump false positive) | 10 | 42% | Line 7, 9, incheon1, incheon2, sinbundang, uijeongbu, gimpo, sillim, yongin, wooyisinseol |
| 분기 위임 (branched-line-schema-fix) | 6 | 25% | Line 2, 5, 6, gyeongui, gtx_a, gyeongchun |
| K-shortest 영향 분리 (별개 PR) | 1 | 4% | seohaeline |
| 데이터 미입력 (data quality) | 1 | 4% | uisinseol |
| Phase A 이전 처리 | 1 | 4% | bundang (PR #69) |

회귀 net: 17 integration tests in `kShortestPath.integration.test.ts`.

## 후속 phase 후보 (별도 dev docs 권장)

1. **branched-line-schema-fix** (큰 phase): Line 2/5/6/gyeongui/gtx_a/gyeongchun 일괄 schema 작업.
   `lines.json` single-array 한계 해결. 옵션: schema 확장(`branchAt` 필드) 또는 노선 분리(`5-branch` 등). LineId 명명 + UI 색상 매핑 + graph builder 수정 cross-cutting.

2. **seohaeline + K_SHORTEST_CANDIDATES 조정**: 일산~대곡 hybrid 6역 reorder + K=30 → 40+ 조정. 산곡→선릉 강남구청 경유 회귀 net 유지하며 적용.

3. **uisinseol 데이터 보충**: stations 배열 빈 상태. wooyisinseol(우이신설선)과 별개 노선인지 확인 후 데이터 입력 또는 colors에서 제거.

4. **lines.json append audit 자동화** (prevention): 신설역 추가 시 array 끝 push 패턴 방지. CI lint 단계로 통합 검토.

## Phase A (이번 세션 — 완료)

- [x] **A1** Ground truth 확보 — Wikipedia 수인분당선 운행 순서 추출
- [x] **A2** Set equality 검증 — current bundang ↔ ground truth 동일 set (63 stations, 0 add/remove)
- [x] **A3** TDD RED — 통합 테스트 4건 작성 후 실패 확인
- [x] **A4** lines.json bundang reorder — 청량리→인천 운행 순서로 교체
- [x] **A5** 알고리즘 후보 수 조정 — `K_SHORTEST_CANDIDATES = 30` 상수 도입
- [x] **A6** TDD GREEN — 4개 통합 테스트 통과
- [x] **A7** 회귀 검증 — `npx jest` 전체 통과 (3,669 pass), `tsc --noEmit` 0 error, `npm run lint` 0 error
- [x] **A8** dev-docs 3-파일 작성

## Phase B (다음 세션 시작)

### B1. 사전 작업: ground truth 일괄 수집 자동화

- [ ] **B1.1** 자동 fetch 스크립트 `scripts/fetch-line-ground-truth.ts` 작성
  - Korean Wikipedia 노선별 페이지에서 station 운행 순서 추출
  - 보조: Seoul Open API (`openapi.seoul.go.kr:8088/.../SearchSTNBySubwayLineInfo`)
  - 결과는 `.cache/line-ground-truth.json` 에 저장 (gitignore)
- [ ] **B1.2** Set equality 검증 모드 + 순서 diff 모드 분리
  - `--mode=set`: stations.json `lines: [X]` 선언 ↔ ground truth set 비교 (membership)
  - `--mode=order`: lines.json `stations.X` 배열 순서 ↔ ground truth 순서 diff

### B2. 노선별 수정 (각 노선당 atomic commit)

**분류 (2026-05-13 5호선 분석 결과)**: jump count는 두 원인 혼재 → 분기 노선과 단일 운행선 분리.

**분기 노선 (Branched lines — single-array schema 한계, 별개 phase 위임)**:
- [x] **B2.5** Line 5 (jump=25, 본선 + 마천지선) — **closeout, branched-line-schema-fix phase 위임 (2026-05-13)**
  - Wikipedia ground truth 확보: 본선 49역(방화→하남검단산) + 마천지선 7역(둔촌동→마천) at 강동 분기
  - Set equality ✅ 56역 일치 / Order: 1-44 본선 정확, 45-51에 지선 삽입 + 52-56에 본선 연장 ← single-array schema가 분기를 표현 불가
  - 잘못된 인접 edge 2건: `상일동(44)↔둔촌동(45)`, `마천(51)↔강일(52)`
- [ ] **B2.X-branched** Line 6 (응암 순환), Line 4/안산선 분기, airport(T1/T2 분기) — branched-line phase에서 일괄

**단일 운행선 (Single-trunk lines — Phase A 패턴 그대로 적용 가능)**:
- [ ] **B2.1** Line 2 (jump=18): 잠실/까치산 권역 확인 (순환선이지만 분기 없음)
  - 대표 OD: 강남→홍대입구 (직행), 잠실→사당 (시청 경유 vs 강남 경유)
  - 회귀 테스트: `kShortestPath.integration.test.ts` 에 분리된 describe block
- [x] **B2.2** Line 7 (jump=19) — **closeout (no-op, 2026-05-13)**: 현재 array가 Wikipedia ground truth와 100% 일치 (53/53 stations, 운행 순서 동일, 분기 없음). jump=19는 좌표 jump였고 order는 정상. 좌표 품질 audit은 B4로 위임.
- [x] **B2.3** Line 3 (jump=20) — **완료 (2026-05-13, PR #75 `66709bf`)**: hybrid array(1-34 지축→오금 + 35-44 원흥→대화) 해소, Wikipedia 순서로 reorder. 원흥/삼송 위치 확정. 회귀 테스트 3건 (오금→원흥 > 30분, 원흥→삼송 ≤5분, 양재→교대 ≤8분).
- [x] **B2.4** Line 4 (jump=20) — **완료 (2026-05-13, PR #76 `69dd9c9`)**: 단일 운행선 confirmed (안산선 분기 없음, 일체 운행). 수리산을 array 끝(#51) → 산본↔대야미 사이(#40)로 surgical 이동. 잘못된 인접 edge `오이도↔수리산` 제거. 회귀 테스트 3건 (산본→수리산 ≤5분, 수리산→대야미 ≤5분, 오이도→수리산 > 15분).
- [x] **B2.6** gyeongui (jump=17) — **closeout, branched-line-schema-fix phase 위임 (2026-05-13)**: 4 운행 계통(문산↔용문/지평, 문산↔서울역, 문산↔임진강, 임진강↔도라산) + 5 종착역 + 용산 직결. 현재 array의 1.대곡 분리 + 31번 갑작스러운 "서울역" 점프는 4 계통이 single array에 mash된 결과. Line 5/2보다도 한 단계 더 복잡한 case.
- [x] **B2.7** incheon2 (jump=12) — **closeout (no-op, 2026-05-13)**: 현재 array가 Wikipedia ground truth와 100% 일치 (27/27 stations, 단일 운행선). jump=12는 좌표 jump였고 order는 정상. Line 7과 같은 false positive 패턴. 좌표 품질은 B4로 위임.
- [x] **B2.8** Line 8 — **완료 (2026-05-13, PR #77 머지)**: Line 4 패턴 그대로. 남위례(2021.12 신설)를 array 끝(#24) → 복정↔산성 사이(#18)로 surgical 이동. 잘못된 인접 edge `모란↔남위례` 제거. 회귀 테스트 3건.
- [x] **B2.9** Line 9 — **closeout (no-op, 2026-05-13)**: 현재 array가 Wikipedia ground truth와 100% 일치 (38/38 stations, 단일 운행선). 사용자 영향 큰 강남 라인이지만 데이터 정상. Line 7/incheon2와 동일 false positive 패턴.
- [x] **B2.10** Line 6 — **closeout, branched-line-schema-fix 위임 (2026-05-13)**: 응암 순환선(응암→역촌→불광→독바위→연신내→구산→응암 편도) + 본선(새절→신내) 합류 구조. 현재 array의 구산↔새절 인접 edge는 실제로 응암 복귀 경로라 잘못. Line 2/5/gyeongui와 같은 카테고리.
- [x] **B2.11** sinbundang — **closeout (no-op, 2026-05-13)**: 16/16 Wikipedia ground truth 100% 일치, 단일 운행선 (신사↔광교).
- [x] **B2.12** gyeonggang — **완료 (2026-05-13, PR #78 머지)**: 성남(s_0009) #12 → #2 (판교↔이매 사이) surgical 이동. Line 4/8 single misplacement 패턴. 회귀 테스트 2건.
- [x] **B2.13** airport — **완료 (2026-05-13, PR #78 머지)**: 영종(s_ec9881ec) #14 → #10 (청라국제도시↔운서 사이) surgical 이동. 잘못된 인접 edge `인천공항2터미널↔영종` 제거. 회귀 테스트 2건.
- [x] **B2.14** seohaeline — **별개 phase 위임 (2026-05-13)**: 일산~대곡 6역 hybrid 발견했으나 단순 reorder가 산곡→선릉 K-shortest 후보 set에 cascade 영향. `K_SHORTEST_CANDIDATES=30` → 40+ 조정 또는 영향 분석 동반 필요. 메모리 [Yens K-shortest 자연 한계] 패턴. 별개 PR로 분리.
- [x] **B2.15** gtx_a — **closeout, branched-line-schema-fix 위임 (2026-05-13)**: 수서~동탄(4역) + 운정중앙~서울(5역) 2단계 분리 운행 (2026.8 직결 예정). 현재 array의 동탄↔운정중앙 인접 edge가 잘못. 직결 개통 시점에 자연 정상화 가능.
- [x] **B2.16** gyeongchun — **closeout, branched-line-schema-fix 위임 (2026-05-13)**: 본선(청량리↔춘천 24역) + 망우선 지선(광운대↔상봉 평일 일부). 현재 array의 광운대(1) ↔ 청량리(2) 인접 edge는 잘못된 분기 인접.
- [x] **B2.17** uijeongbu (15역), gimpo (10역), sillim (11역), yongin (15역), wooyisinseol (13역) — **batch closeout (no-op, 2026-05-13)**: 시각 검증 결과 5개 모두 단일 외곽 경전철, 분기 없음, array 순서 일관됨. 각 노선 종착역↔종착역 시각적 monotone. Wikipedia 추가 검증은 cost-benefit 낮음.
- [x] **B2.18** incheon1 — **closeout (no-op, 2026-05-13)**: 33/33 Wikipedia ground truth 100% 일치, 단일 운행선 (검단호수공원↔송도달빛축제공원, 2025 검단 연장 반영).
- [x] **B2.19** uisinseol — **closeout (data quality issue, 2026-05-13)**: stations 배열이 0 elements. colors에는 정의되어 있으나 station 데이터 미입력. graph builder forEach로 처리되어 영향 0. 별개 data 보충 작업 후보 (Wikipedia: 우이신설선 wooyisinseol과 다른 가상 노선인지 확인 필요).
  - jump count 적은 순. 각 노선마다 ground truth 비교 후 진짜 order 오류면 수정,
    좌표 오류면 별도 phase로 분리.

**위임된 별개 phase**: `dev/active/branched-line-schema-fix/` (5/6/4안산/airport 일괄 처리)

### B3. 회귀 net 강화

- [ ] **B3.1** 노선별 대표 OD pair 매트릭스 통합 테스트 추가 (~30 케이스)
- [ ] **B3.2** "직행 가능 OD에서 환승 카드가 fastest보다 비합리적으로 많이 안 나옴" 일반 회귀 테스트
- [ ] **B3.3** 좌표 jump 검출 audit 스크립트를 CI lint 단계로 통합 검토

### B4. 좌표 품질 (별도 phase 후보)

좌표 오류는 라우팅에 무관 (Dijkstra는 idx만 사용)하나 지도 렌더링 정확성에 영향.
별도 phase로 분리할지 결정:

- [ ] **B4.1** 좌표 vs order 오류 자동 분류 스크립트
- [ ] **B4.2** order만 수정한 노선의 좌표 후속 처리 정책 결정

### B5. 알고리즘 개선 (선택)

K_SHORTEST_CANDIDATES = 30 의존도 감소:

- [ ] **B5.1** Pareto K-shortest 또는 transfer-set 명시 enumeration 검토
- [ ] **B5.2** 동적 K (OD pair 거리 또는 환승 가능 라인 수 기반) 검토

## Progress Tracking

| Category | Phase | Total | Completed | Progress |
|----------|-------|-------|-----------|----------|
| Phase A 코드 | A | 5 | 5 | 100% |
| Phase A 검증 | A | 2 | 2 | 100% |
| Phase A 문서 | A | 1 | 1 | 100% |
| Phase B 자동화 | B | 2 | 0 | 0% |
| Phase B 노선 수정 | B | ~16 | 0 | 0% |
| Phase B 회귀 net | B | 3 | 0 | 0% |
| Phase B 좌표 | B | 2 | 0 | 0% (선택) |
| Phase B 알고리즘 | B | 2 | 0 | 0% (선택) |
| **TOTAL** | - | **33** | **8** | **24%** |

---
**Resume command (다음 세션)**: `/resume route-lines-json-order-fix` 또는
`cat dev/active/route-lines-json-order-fix/route-lines-json-order-fix-plan.md`
