# Route — lines.json Order Correctness — Implementation Plan

**Created**: 2026-05-13
**Status**: Phase A Completed / Phase B Planning
**Priority**: High (Phase A) / Medium (Phase B)

## Objective

`src/data/lines.json` 의 노선별 station order가 실제 운행 순서와 일치하도록
교정하여, route 검색 결과의 정확도를 회복한다.

원인 발견 경위: 사용자가 산곡(7호선) → 선릉(2호선/수인분당선) 경로 검색
화면에서 "강남구청 환승" 경로 카드가 노출되지 않는 문제를 보고. 조사 결과
`bundang` 노선이 지리적 순서가 아닌 무작위 순서로 등록돼 있어 강남구청→선릉
거리가 실제 ~5분이 아닌 ~52분으로 잘못 계산됐다. 동일 원인이 17개 노선에
의심된다 (좌표 기반 jump 검출).

## Requirements

### Phase A (이 PR — 완료)
- [x] `bundang` 노선 station order를 청량리→인천 운행 순서로 교정 (63 stations)
- [x] 선정릉(`s_4127`)이 강남구청과 선릉 사이에 위치하도록 보장
- [x] K-shortest 후보 수 확대 (15 → 30): 강남구청 경유 경로가 K=15에서는
      자연 탐색 순위 밖이라 후보 set에 못 들어가는 문제 해소
- [x] 통합 회귀 테스트: 산곡→선릉 강남구청 환승 카드 노출 보장
- [x] 분당선 내부 OD pair 회귀 테스트 3건 (강남구청→선릉, 정자→선릉, 강남구청→정자)
- [x] 기존 86개 route 테스트, 전체 3,669개 jest 테스트 통과

### Phase B (다음 세션 이월)
- [ ] 16개 의심 노선 ground truth 확보 (Wikipedia/나무위키 우선, Seoul Open API 보조)
- [ ] 노선별 station order 교정 + 회귀 테스트 (per-line atomic commit)
- [ ] (선택) Pareto K-shortest 알고리즘 검토 — K 파라미터 의존도 감소

## Architecture Overview

### Affected Areas (Phase A)
- **Data**: `src/data/lines.json` — bundang 노선 station ID 순서 재배열
- **Services**: `src/services/route/kShortestPath.ts` — `K_SHORTEST_CANDIDATES` 상수 추출, 15 → 30
- **Tests**: `src/services/route/__tests__/kShortestPath.integration.test.ts` (신규) — 실제 데이터 기반 회귀 테스트

### 검증된 invariant 유지
- `getDiverseRoutes` min-transfer 카드 invariant (PR #55)
- `viaTags` 'via-station' 라벨 (PR #58)
- `UNREALISTIC_TIME_FACTOR = 1.5` 시간 cap

## Phase B 의심 노선 우선순위

좌표 기반 jump 검출 결과 (5x median threshold):

| 노선 | jump count | 비고 |
|---|---|---|
| 5 | 25 | 좌표 vs order 구분 필요 — 김포공항/방화/마곡 인접성 의심 |
| bundang | 23 | **Phase A에서 해소** |
| 3 | 20 | 충무로/동대입구/약수 좌표 vs order 구분 필요 |
| 4 | 20 | 진접/오남 등 신규 연장 구간 의심 |
| 7 | 19 | 중화/상봉/면목 좌표 vs order 구분 필요 |
| 2 | 18 | 까치산↔시청 점프, 잠실 권역 의심 |
| gyeongui | 17 | 양수/덕소/구리 권역 의심 |
| incheon2 | 12 | 검단/마전 권역 의심 |
| 6, 8, 9, seohaeline, gyeongchun, uijeongbu, sinbundang | 5-8 | 후순위 |

**참고**: jump = 인접 station간 좌표 거리가 median의 5배 초과. order 오류와 좌표
오류 둘 다 트리거. Phase B는 각 노선별로 (a) ground truth 비교 후 진짜 order
오류면 수정 (b) 좌표만 잘못이면 별도 phase로 분리.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ground truth 부정확 | High | Wikipedia + 나무위키 + Seoul Open API 3-source cross-check |
| 노선당 30-60 station 수동 입력 오류 | High | 자동 비교 스크립트로 set equality 검증 (Phase A 패턴 재사용) |
| 한 노선 수정이 다른 OD pair 회귀 야기 | Medium | 노선별 atomic commit + 전체 jest 회귀 실행 |
| K=30이 다른 OD pair에서도 충분한지 불확실 | Low | 추가 사용자 보고 시 K 증가 또는 알고리즘 개선 |

## Success Criteria

### Phase A
- [x] 산곡→선릉 검색 결과에 강남구청 환승 카드 노출
- [x] 전체 jest 통과 + type-check + lint 0 error
- [x] 4개 신규 통합 테스트 GREEN

### Phase B (예상)
- [ ] 17개 의심 노선 중 진짜 order 오류 식별 + 수정
- [ ] 노선별 회귀 테스트 (각 노선 대표 OD pair 1-2개)
- [ ] 좌표만 오류인 노선은 별도 ticket으로 분리

## Related Documents
- [route-lines-json-order-fix-context.md](./route-lines-json-order-fix-context.md) — 원인 분석 상세
- [route-lines-json-order-fix-tasks.md](./route-lines-json-order-fix-tasks.md) — Phase B 작업 분할
- `.claude/skills/route-fare-calculation/SKILL.md` — 알고리즘 컨텍스트
- PR #55, #58 — 이전 route 다양성 개선

---
*Phase A: 2026-05-13 완료. Phase B: 다음 세션 시작.*
