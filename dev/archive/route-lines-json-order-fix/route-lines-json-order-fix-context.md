# Route — lines.json Order Correctness — Context

## 발견 경위 (2026-05-13)

사용자 디바이스 테스트: 산곡(7호선) → 선릉(2호선/수인분당선) 경로 검색
결과로 3개 카드가 노출됨:

1. 추천/최단: 76.5분, 7호선→2호선 환승 1회 (대림 추정)
2. 교대 경유: 83분, 7호선→3호선→2호선 환승 2회
3. 초지 경유: 85.5분, 7호선→서해선→분당선 환승 2회

사용자 질문: "왜 경로가 강남구청 환승하는건 안나오지?"

산곡(인천 부평구 7호선) → 강남구청(7호선·수인분당선 환승) → 선정릉 → 선릉
경로는 실제 운행 가능. 환승 1회, 약 84분(7호선 30 hops × 2.5 + 환승 4 +
bundang 2 hops × 2.5). 76.5분 fastest의 1.5x cap(114.75분) 안. PR #58의
`getDiverseRoutes`가 환승역 set 기반 그룹화로 이런 경로를 카드로 분리하도록
설계됐는데도 노출되지 않음.

## Root Cause 두 가지

### 1. lines.json 데이터 오류

`src/data/lines.json` 의 `bundang` 노선 station order가 실제 운행 순서가
아닌 무작위 순서:

**잘못된 순서 (수정 전)**:
```
[seolleung, 한티, 도곡, 구룡, 개포동, 대모산입구, 왕십리, 수서, 복정,
 오이도, 한대앞, 중앙, 고잔, 초지, 안산, 신길온천, 정왕, 청량리, 수원,
 서울숲, 압구정로데오, 강남구청, ...]
```

이 순서로는:
- 강남구청(idx 21) → 선릉(idx 0) = **21 hops × 2.5 = 52.5분**
- 실제: 강남구청 → 선정릉 → 선릉 = 2 hops × 2.5 = **5분**

결과적으로 산곡→강남구청→선릉 경로 cost가 ~84분이 아닌 ~131분으로 계산되어
1.5x 시간 cap에 걸려 제거됨.

**정상 순서 (수정 후, 청량리→인천 운행 순서)**:
```
청량리 → 왕십리 → 서울숲 → 압구정로데오 → 강남구청 → 선정릉 → 선릉 →
한티 → 도곡 → 구룡 → 개포동 → 대모산입구 → 수서 → 복정 → 가천대 → 태평 →
모란 → 야탑 → 이매 → 서현 → 수내 → 정자 → 미금 → 오리 → 죽전 → 보정 →
구성 → 신갈 → 기흥 → 상갈 → 청명 → 영통 → 망포 → 매탄권선 → 수원시청 →
매교 → 수원 → 고색 → 오목천 → 어천 → 야목 → 사리 → 한대앞 → 중앙 →
고잔 → 초지 → 안산 → 신길온천 → 정왕 → 오이도 → 달월 → 월곶 → 소래포구 →
인천논현 → 호구포 → 남동인더스파크 → 원인재 → 연수 → 송도 → 인하대 →
숭의 → 신포 → 인천
```

63 stations, 선정릉 포함. 데이터 set은 동일 — 순서만 교정.

### 2. K-shortest 후보 수 부족

`getDiverseRoutes`가 `findKShortestPaths(from, to, 15)` 호출. Yen's 알고리즘은
첫 최단경로 주변의 spur를 탐색하므로, 위상적으로 다른 환승 경로는 K가 충분히
크지 않으면 발견되지 않음.

K=50 실험 결과:
- 산곡→선릉 K-shortest #1: 76.5분, t=1, [대림] (fastest)
- 산곡→선릉 K-shortest #2~#24: 대림/부천종합운동장 변형들
- 산곡→선릉 K-shortest **#25: 84.0분, t=1, [강남구청]** ← 본 회귀
- 산곡→선릉 K-shortest #43: 85.5분, t=2, [고속터미널, 선정릉]

K=15로는 강남구청 경로가 후보 set에 진입 못 함. K=25 이상 필요.

**채택**: K=30 (margin 포함, 비용은 K=15 대비 2배 ≈ 100ms).

### Ground Truth Source

[Korean Wikipedia: 수도권 전철 수인·분당선](https://ko.wikipedia.org/wiki/수도권_전철_수인·분당선)
2026-05-13 검증. WebFetch로 운행 순서 추출 (63 stations).

3-way verification:
- stations.json의 `lines: ['bundang']` 선언 ↔ Wikipedia 순서 ↔ 현재 lines.json set:
  set equality ✓ (모두 동일 63 stations)
- 즉 add/remove 0건. 순서만 변경.

## Decisions

### Decision 1: 분당선/수인선/수인분당선을 하나의 `bundang` 노선으로 유지
- **결정**: 분리하지 않음 (현행 schema 유지)
- **이유**:
  - 실제로 수인분당선은 청량리~인천 일체 운행 (분리 운행 안 함)
  - 분리하면 stations.json의 `lines` 배열, route 알고리즘, line color, UI 텍스트 등 다층 변경
  - 사용자 의도(강남구청 경유 카드 표시)는 schema 변경 없이 해결 가능
- **재검토 트리거**: UI에서 "수인분당선" 라벨 명확화가 필요해질 때

### Decision 2: `bundang` 노선 id 유지 (rename 안 함)
- **결정**: id를 `suinbundang`이 아닌 `bundang`으로 유지
- **이유**:
  - migration 비용 — STATIONS의 모든 분당선 station, LINE_COLORS, UI 색상 매핑, 테스트 의존
  - lineId rename은 별도 phase
- **재검토 트리거**: 노선별 색상/이름을 더 정확하게 표시할 때 (UI 정확성 우선 phase)

### Decision 3: K_SHORTEST_CANDIDATES = 30 (40·50 아님)
- **결정**: 30
- **이유**:
  - 산곡→선릉 강남구청 경로는 K=25에서 catch (margin 5)
  - K 비례 비용 증가 (~O(K))
  - 더 큰 K가 필요한 경우는 추가 사용자 보고 시 surgical 증가
- **재검토 트리거**: 다른 OD pair에서 누락 보고 발생 시 K 증가 vs 알고리즘 변경 검토

### Decision 4: Phase B는 다음 세션으로 이월
- **결정**: 17개 의심 노선 일괄 수정은 이번 세션에서 안 함
- **이유**:
  - 노선당 ground truth 확보 + 검증 + 회귀 테스트 = 15-30분
  - 17 노선 × 평균 20분 = 5-6시간, 한 세션 범위 초과
  - 졸속 수정은 새 버그 양산 위험 (데이터 수정은 코드보다 검증 어려움)
- **재검토 트리거**: 사용자 우선순위 변경

## Related Code Reading

- `src/services/route/kShortestPath.ts:472-479` — `buildTransferSignature`
- `src/services/route/kShortestPath.ts:521-582` — `getDiverseRoutes`
- `src/data/lines.json` — line station order
- `src/data/stations.json` — station coordinates + lines membership
- `src/utils/subwayMapData.ts:88-94` — 이전부터 알려진 데이터 불일치 주석
