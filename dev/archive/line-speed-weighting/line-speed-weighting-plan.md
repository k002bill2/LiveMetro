# Phase: 노선별 표정속도 가중치 도입

## Why

산곡↔선릉 같은 OD에서 우리 K-shortest 결과가 네이버 검색결과와 일치하지 않는 본질적 원인은 `kShortestPath.ts`의 그래프 가중치가 노선별 표정속도를 모르고 `AVG_STATION_TRAVEL_TIME = 2.5분/hop` 일률 가중을 쓰기 때문이다.

| 노선 | 실제 표정속도(추정) | 우리 모델 |
|---|---|---|
| 수인분당선 (신선) | ~36 km/h, ~1.8분/역 | 2.5분 |
| 7호선 인천 연장 | ~33 km/h, ~2.0분/역 | 2.5분 |
| 2호선 본선 외곽 | ~25 km/h, ~2.7분/역 | 2.5분 |
| 2호선 본선 도심 | ~30 km/h, ~2.3분/역 | 2.5분 |

산곡↔선릉 사례:
- 우리 모델 fastest: 대림 환승 76.5분(29역, 1환승)
- 네이버 fastest: 강남구청 환승 1h9m(32역, 1환승) — 실제 빠름
- 7.5분 차이가 가중치 모델 한계에 기인

## Goal

`useCommuteRouteSummary`(이미 `getDiverseRoutes`로 전환됨)가 네이버와 동일한 fastest 경로를 반환하도록 그래프 가중치를 노선별 표정속도 기반으로 교체. 동시에 기존 OD에 회귀 없음(특히 메모리 `[K-shortest 무관 데이터 cascade]`류).

## Approach

3단계 — 데이터 수집, 가중치 적용, 회귀 검증.

### Stage 1 — 데이터 수집

노선별 표정속도 데이터 소스 후보 평가:

| 소스 | 장점 | 단점 |
|---|---|---|
| **A. 정적 매핑 JSON** (`data/lineSpeed.json`) | 명시적, 버전 관리, 테스트 가능 | 수동 유지 |
| B. 서울 OpenAPI 시간표 기반 계산 | 자동 동기화 | 시간표 API 호출/파싱, 캐시 필요 |
| C. 위키피디아 등 외부 자료 manual scrape | 정확도 ↑ | 일회성, 갱신 불가 |

**권장: A**. 노선이 25개 안팎이라 수동 유지 부담 작음. `data/lineSpeed.json` 형태:

```json
{
  "1": 2.4,
  "2": 2.5,
  "7": 2.0,
  "bundang": 1.8,
  "sinbundang": 1.6,
  ...
}
```

값은 한국 위키피디아 각 노선 페이지의 "표정속도" 기재값(km/h) → 평균 역간 거리 1.2km로 분 환산: `minutes_per_hop = 1.2 / (speed_kmh / 60)`.

### Stage 2 — 가중치 적용

`src/services/route/kShortestPath.ts`:

- 현재: `buildGraph()`에서 인접역 edge weight = `AVG_STATION_TRAVEL_TIME` (상수)
- 변경: edge weight = `LINE_SPEEDS[lineId] ?? AVG_STATION_TRAVEL_TIME` (fallback)
- `AVG_STATION_TRAVEL_TIME`는 fallback default로 유지 — `lineSpeed.json`에 누락된 노선 안전 처리

추가 고려:
- `realtimeWeightOverride.ts`의 `getNextTrainWaitMinutes`는 edge별 가산이라 영향 없음
- A* heuristic factor 0.8은 admissibility 보장 — 최소 노선 속도(가장 빠른 노선)에 맞춰 재계산 필요. `min(LINE_SPEEDS values) * 0.8`

### Stage 3 — 회귀 검증

메모리 `[Integration test로 데이터 회귀 분리]`, `[K-shortest 무관 데이터 cascade]` 따른 이중 net.

1. **Unit test**: `lineSpeed.json` 로드 + `LINE_SPEEDS[id]` lookup + fallback
2. **Integration test (canonical OD 집합)**:
   - 산곡↔선릉: 강남구청 환승 1회, 32역, 2,050원 (네이버 매칭)
   - 강남↔홍대입구: 2호선 직행 (회귀 net)
   - 잠실↔강남: 2호선 vs 분당선 비교 (가중치 영향 직접)
   - 인천공항↔서울역: 공항철도 vs 1호선 (속도 차이 큼)
   - 김포공항↔강남: 9호선 직행 vs 환승
   - 산곡↔강남: 7호선 직행 (산곡↔선릉 fix 회귀 net)
3. **getDiverseRoutes 카드 다양성 검증**: 같은 OD에 대해 후보 #1-5 환승역 set이 가중치 변경 후에도 합리적 분포 유지

## 파일 변경 (예상)

| 변경 | 경로 |
|---|---|
| New | `src/data/lineSpeed.json` |
| Edit | `src/services/route/kShortestPath.ts` (buildGraph edge weight, A* heuristic) |
| Edit | `src/models/route.ts` (`AVG_STATION_TRAVEL_TIME` 주석 갱신 — fallback default 명시) |
| New | `src/services/route/__tests__/lineSpeed.integration.test.ts` (canonical OD 집합) |
| Reactivate | `src/hooks/__tests__/useCommuteRouteSummary.integration.test.ts` (산곡↔선릉 32역/2050원 pin) |

## 검증

```bash
npx tsc --noEmit
npx jest src/services/route src/hooks/__tests__/useCommuteRouteSummary --watchman=false
npm test -- --coverage  # 전체 회귀 net
```

UI 검증 — 사용자가 홈 화면 reload → "오늘의 출근 경로" 카드 = 환승 1회 / 32개역 이동 / 2,050원 (네이버 일치).

## 외부 의존성 / 조정 사항

- 다른 세션이 작업 중인 영역(`arrivalService`, `timetableService`)과 별도 코드 경로 → 충돌 없음
- 변경 timing은 다른 세션 commit 후 rebase 권장 — `seoulSubwayApi.ts` 작업과 같은 working tree 사용

## Risk

- **Cascade 회귀**: 모든 OD에 영향. canonical OD 6-10개 integration test로 catch + 사용자 dogfooding 단계 권장
- **데이터 정확도**: 위키 표정속도가 실제와 차이 가능. PR #91-PoC처럼 한 노선 데이터부터 적용 → 회귀 발견 시 rollback 쉬움
- **fastest 의미론 변경**: 일부 OD에서 기존 fastest가 다른 경로로 교체될 수 있음 — 사용자 알림 불필요(내부 로직 개선)
