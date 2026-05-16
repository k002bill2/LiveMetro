# Phase Context: 노선별 표정속도 가중치

## 발견 경위

2026-05-16 세션 — `CommuteRouteCard` fact grid 누락 원인 분석 중 발견.

순차적으로 두 layer가 풀렸음:
1. **stationIdResolver fix** (commit `5f6a62a`): Onboarding 저장 ID(외부 station_cd "3762", "0220") ↔ routeService 그래프 키(internal slug "s_ec82b0ea", "seolleung") 불일치 → boundary normalize utility로 해결.
2. **getDiverseRoutes 전환** (commit `5f6a62a`): `routeService.calculateRoute()` (K=1 dijkstra)를 `getDiverseRoutes()[0]`로 교체. K=1이 못 찾는 1환승 경로 발견.

두 layer를 풀고 나서 드러난 남은 문제: 우리 모델의 fastest(대림 환승, 29역, 76.5분)와 네이버 fastest(강남구청 환승, 32역, 1h9m) 불일치.

## 진단 데이터 (산곡↔선릉, K=15 K-shortest)

```
K#1: 76.5min, 1xfer, 29 stations, via=대림        lines=7+2          ← 우리 [0]
K#2: 82.0min, 2xfer, 30 stations, via=가산→신도림   lines=7+1+2
K#3: 83.5min, 3xfer, 29 stations, via=온수→구로→신도림
K#4: 83.0min, 2xfer, 30 stations, via=고속터미널→교대 lines=7+3+2
K#5: 84.0min, 1xfer, 32 stations, via=강남구청      lines=7+bundang    ← 네이버 답
```

7.5분 차이가 가중치 모델 일률성에서 발생. 네이버는 시간표/표정속도 기반.

## 결정 근거

다른 옵션 검토 후 "노선별 가중치 도입"으로 결정:

| 옵션 | 채택 여부 | 사유 |
|---|---|---|
| 현 모델 유지 + integration test pin | ✗ | 사용자 신뢰 issue. 네이버 표시값과 다르면 "잘못된 앱"으로 인식 |
| 환승 1회 카드 *내에서* 최다역 우선 | ✗ | 산곡↔선릉만 우연히 풀고 다른 OD에 잘못된 선호 가능 |
| 외부 API 호출 | ✗ | 자율성↓, quota/키 관리, 오프라인 미지원 |
| **노선별 표정속도 가중치** | ✓ | 모델 정확도 근본 개선. 회귀 검증 비용은 integration test로 흡수 |

## 메모리 참조

작업 진행 시 반드시 참조할 메모리 노트:

- `[K-shortest 무관 데이터 cascade]` (2026-05-13 PR #78/#79) — 가중치 변경이 무관 OD에 회귀 야기. binary search로 원인 분리, 별개 PR 권장.
- `[Integration test로 데이터 회귀 분리]` (2026-05-13 PR #68) — algorithm unit test와 데이터 회귀 integration test 별도 파일 필수.
- `[Yen's signature-dedupe efficiency]` (2026-05-14 PR #91+#102) — K=15는 산곡↔선릉 강남구청 발견에 충분(K=11 floor). 가중치 변경 후에도 K 상수는 유지.
- `[Yen's multi-source origin selection limit]` (PR #79) — 가중치 변경으로 fastest origin이 바뀔 수 있음. transferCount === 0 단정 금지.
- `[stations.json identity collision]` — 동명이역 처리 안전성. 본 phase에선 영향 없을 듯하지만 회귀 OD에 포함.

## 코드 좌표

- 가중치 상수: `src/services/route/kShortestPath.ts`의 `AVG_STATION_TRAVEL_TIME` import from `@models/route` (file: `src/models/route.ts`)
- 그래프 빌더: `kShortestPath.ts:75` `buildGraph()`
- A* heuristic: `routeService.ts:457` `calculateRoute()`의 heuristic factor 0.8 — admissibility 재계산 필요
- 시간표 데이터 (참고용): `src/data/seoulStations.json` 노선 정보
- 정적 노선 데이터: `src/data/lines.json` (string[][] schema, 분기 노선 포함)
- 좌표 데이터(참고): `src/data/stationCoordinates.json`

## 데이터 수집 시작점

한국 위키 표정속도 (검증 필요):

| 노선 | 표정속도 (km/h) | minutes/hop @ 1.2km 평균 |
|---|---|---|
| 1호선 (서울) | 30.2 | 2.38 |
| 2호선 | 31.4 | 2.29 |
| 3호선 | 30.6 | 2.35 |
| 4호선 | 32.6 | 2.21 |
| 5호선 | 33.3 | 2.16 |
| 6호선 | 31.5 | 2.29 |
| 7호선 | 31.8 | 2.26 |
| 8호선 | 33.5 | 2.15 |
| 9호선 급행 | 46.8 | 1.54 |
| 9호선 일반 | 32.5 | 2.22 |
| 수인분당선 | 36.0 | 2.00 |
| 신분당선 | 60.0 | 1.20 |
| 공항철도 일반 | 41.0 | 1.76 |
| 공항철도 직통 | 78.0 | 0.92 |
| 경의중앙선 | 36.0 | 2.00 |
| 경춘선 | 50.0 | 1.44 |
| ITX-청춘 | 70.0 | 1.03 |
| GTX-A | 100.0 | 0.72 |

값은 실제 시간표로 재검증 권장. 9호선/공항철도/신분당선의 급행/직통은 별도 lineId가 없으면 일반 속도만 적용(현 그래프 schema 한계).

## 다음 세션 시작 안내

새 세션에서 다음 명령으로 picking up:

```
/resume dev/active/line-speed-weighting
```

또는:

```
이 phase의 plan.md, context.md, tasks.md 읽고 Stage 1 데이터 수집부터 시작
```

본 세션 종료 직전 동일 working tree에 다른 세션의 unstaged 변경 존재(`TrainArrivalList`, `seoulSubwayApi`, `apiKeyManager`). 새 세션은 그 commit이 통합된 후 시작 권장.
