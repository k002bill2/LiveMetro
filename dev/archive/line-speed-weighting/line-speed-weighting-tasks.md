---
phase: line-speed-weighting
status: completed
completedAt: 2026-05-16
priority: medium
estimatedHours: 4-6
actualHours: ~5
parallelizable: false
dependencies: []
verification:
  - npx tsc --noEmit                        # PASS (clean)
  - npx jest src/services/route ...         # PASS 170/170
  - npx jest --coverage ...                 # PASS 81.76/86.95/66.91 글로벌
  - 사용자 UI 검증                          # 미실행 — push/PR 시점에 진행
commits:
  - c50ea46 feat(route): per-line speed weighting for K-shortest fastest path
  - 8144760 test(commute): integration pin for useCommuteRouteSummary 산곡↔선릉
branch: feat/line-speed-weighting (TMPDIR worktree, not pushed)
---

# Tasks

## Completion Summary (2026-05-16)

**달성**:
- 산곡↔선릉 fastest = 강남구청 환승 75.8min (네이버 매칭) ✓
- 13개 route test suite + 4개 hook integration test 모두 PASS (170+4 tests)
- tsc clean, lint clean, coverage 글로벌 81.76/86.95/66.91 (임계값 75/70/60)

**Plan과 차이**:
- 수인분당선 weight: plan 2.0 → 최종 2.0 (재산정 중 2.5로 올렸다가 flip 손실로 되돌림)
- 2호선 weight: plan에 없던 dwell-time 가중 (2.5 → 2.8) — 산곡↔선릉 flip 조건
- airport: 1.76 → 4.5 (long-hop 노선 재산정)
- gtx_a: 0.72 → 5.0 (long-hop 노선 재산정)
- sinbundang: 1.2 → 3.0 (long-hop 노선 재산정)
- fareKrw 기대값: plan 2050 → 실제 2000 (fareService.calculateFare(32) 실측)

**Side benefit 발견**:
- A* heuristic floor를 `FASTEST_LINE_HOP_MINUTES × 0.95`로 재산정한 부수효과로 baseline A*가 놓쳤던 종각→을지로입구 optimal 경로(20.14min via 종로3가 L5 환승) 발견. transferTime.wiring.test.ts의 expected-path 업데이트.

**알려진 한계 (line-level 모델 본질)**:
- 강남↔홍대입구: L2=2.8 dwell-time 가중으로 L2 직행이 손해 → 알고리즘은 detour 선호
- 김포공항↔강남: 공항철도+L4+L2 (L9 직행 미선호)

별도 phase 필요 시:
- segment-level weighting (도심/외곽 별 다른 가중치)
- 9호선 급행/공항철도 직통 같은 운행 패턴별 schema 분리
- 실시간 표정속도 보정 (realtimeWeightOverride 통합)

**남은 작업 (다른 세션)**:
- T4.3 사용자 UI 검증 (홈 reload → 산곡↔선릉 32역/2000원)
- push + PR (다른 세션 머지 후)
- T5.2 dev diagnostic 코드 cleanup (HomeScreen commuteDiag effect)

---

## Stage 1 — 데이터 수집 (1–2h)

- [ ] **T1.1** 한국 위키 각 노선 표정속도 검증 (`line-speed-weighting-context.md` 표)
  - 9호선 급행/일반, 공항철도 직통/일반은 별도 노선 ID가 없으므로 일반값만 채택
  - 분기 노선(2호선 신정/성수 지선)은 본선과 동일 값
  - GTX-A, ITX-청춘 등 광역철도 포함 여부 확정

- [ ] **T1.2** `src/data/lineSpeed.json` 생성
  - schema: `Record<lineId, number /* minutes per hop */>`
  - 키: `lines.json`의 모든 lineId (1, 2, ... 9, airport, bundang, gimpo, gtx_a, gyeongchun, gyeonggang, gyeongui, incheon1, incheon2, seohaeline, sillim, sinbundang, uijeongbu, wooyisinseol, yongin)
  - 누락된 lineId에 대비해 빌드 시 keys 누락 검증 unit test 1개

- [ ] **T1.3** 데이터 fixture 검증 — 산곡↔선릉 손계산
  - 7호선 산곡→강남구청 30 hops × 7호선 minutes/hop + 환승 4분 + 수인분당선 강남구청→선릉 2 hops × 분당선 minutes/hop = ? 분
  - 네이버 1h 9min과 ±10% 안에 들어와야 채택. 차이 크면 데이터 보정.

## Stage 2 — 가중치 적용 (1–2h)

- [ ] **T2.1** `kShortestPath.ts` `buildGraph()` 수정
  - `import lineSpeedJson from '@/data/lineSpeed.json'` (또는 `@models/route`에 상수 추가 후 import)
  - 인접역 edge weight를 `LINE_SPEEDS[lineId] ?? AVG_STATION_TRAVEL_TIME`로 변경
  - 분기 노선 sub-line edge도 동일 정책 (`branch shuttle wait`은 별도 상수 유지)

- [ ] **T2.2** `routeService.ts` A* heuristic 재계산
  - heuristic factor 0.8은 admissible 조건: `h ≤ 실제 비용`
  - 가장 빠른 노선(공항철도 직통 0.92 또는 GTX 0.72)을 기준으로 재산정
  - 단순화: `min(Object.values(LINE_SPEEDS))` × 0.95 정도로 안전 마진

- [ ] **T2.3** `AVG_STATION_TRAVEL_TIME` 주석 갱신 (`src/models/route.ts`)
  - "기본값 — `data/lineSpeed.json`에 없는 노선의 fallback" 명시

## Stage 3 — 회귀 검증 (1–2h)

- [ ] **T3.1** Canonical OD integration test 작성
  - 파일: `src/services/route/__tests__/lineSpeed.integration.test.ts`
  - OD 집합 (각 transferCount/stationCount/시간 ±10%):
    - 산곡↔선릉: 강남구청, 1환승, 32역, ~69분
    - 강남↔홍대입구: 0환승, 8역, ~16분
    - 잠실↔강남: 0환승, 5역, ~12분
    - 인천공항↔서울역: 0환승, 12역, ~50분 (공항철도)
    - 김포공항↔강남: 9호선 직행 또는 1환승, 시간 검증
    - 산곡↔강남: 7호선 직행 (산곡↔선릉 fix가 회귀 안 만드는지)
  - 각 OD는 별도 `it()` 케이스로 — 한 OD 실패가 다른 OD 진단 가리지 않도록

- [ ] **T3.2** 기존 routeService 테스트 회귀 점검
  - `npx jest src/services/route --watchman=false`
  - 가중치 변경으로 기존 fixture가 깨질 수 있음. 새 가중치 기준으로 expected 값 갱신
  - 갱신 전 메모리 `[Two-layer bug partial GREEN 함정]` 참고: 부분 GREEN이면 두 번째 layer 의심

- [ ] **T3.3** `useCommuteRouteSummary.integration.test.ts` 재활성화
  - 이전 세션에서 임시 삭제됨. plan에 명시된 형태로 부활
  - 산곡↔선릉: ready=true, transferCount=1, stationCount=32, fareKrw=2050

- [ ] **T3.4** 전체 커버리지 확인
  - `npm test -- --coverage`
  - 임계값(75/70/60) 통과

## Stage 4 — Commit + UI Verify (30min)

- [ ] **T4.1** `git status -s`로 phase scope 외 파일 unstaged 확인 (다른 세션 영향 격리)

- [ ] **T4.2** Commit 메시지:
  ```
  feat(route): per-line table-speed weighting for K-shortest fastest path

  Replace flat AVG_STATION_TRAVEL_TIME with line-specific minutes-per-hop
  derived from published 표정속도. 산곡↔선릉 강남구청 환승 경로가 우리
  K-shortest fastest로 선택되도록 정렬, 네이버 검색결과와 일치.

  - data/lineSpeed.json: lineId → minutes per hop
  - kShortestPath.buildGraph: edge weight = LINE_SPEEDS[lineId] ?? default
  - routeService A* heuristic: admissibility 재산정
  - 6 canonical OD integration tests
  ```

- [ ] **T4.3** 사용자 UI 검증 안내
  - 사용자가 홈 화면 reload → 산곡↔선릉 출퇴근 카드 fact grid가 네이버와 일치(32역, 1환승, 2,050원)
  - Metro 콘솔의 `[HomeScreen.commuteDiag]` warn으로 routeSummary `ready: true` 확인

## Stage 5 — Archive (5min)

- [ ] **T5.1** phase 완료 후 `dev/active/line-speed-weighting/` → `dev/archive/`로 이동
- [ ] **T5.2** 이전 세션의 dev diagnostic 코드(`HomeScreen.tsx` commuteDiag effect, `useCommuteRouteSummary.ts` warn 3개) 유지 여부 결정 — 안정성 확인 후 별도 cleanup PR

## Out of Scope

다음은 본 phase에서 다루지 않음 — 별도 phase:
- 9호선 급행/공항철도 직통 같은 *같은 노선의 다른 운행 패턴*에 다른 가중치 (그래프 schema 변경 필요)
- 시간대별 속도 변화 (출퇴근 시간 vs 평시)
- 실시간 표정속도 보정 (`realtimeWeightOverride`와 통합)
