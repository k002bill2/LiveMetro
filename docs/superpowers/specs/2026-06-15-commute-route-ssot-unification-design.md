# 출퇴근 경로 SSOT 통일 — 설계

- **날짜**: 2026-06-15
- **브랜치 기준**: feat/home-commute-focus-reload (또는 신규 feat 브랜치)
- **상태**: 설계 승인됨 (사용자 결정 4건 반영)

## 문제 (근본 원인)

신길 → 선릉 출퇴근에서 **한 화면당 경로가 제각각**으로 보인다. 화면은 3개지만 **경로 소스가 4개, 라우팅 엔진이 2개, SSOT가 0개**다.

| 화면 | 소스 | 엔진 | 결과(신길→선릉) |
|---|---|---|---|
| 경로 편집(설정) | `buildRecommendations` | 라인 교차 휴리스틱 | **신도림 1환승** (직행 없어 auto-default) |
| 홈 카드 중앙 노드 | `originLineId` + `heroMinutes` | 합성(라우팅 없음) | **"5호선 직행 36분"** (허구) |
| 홈 fact grid | `useCommuteRouteSummary → getDiverseRoutes[0]` | Yen K-최단 | 2환승·13역·1500원 |
| ML 전체 경로 | `useCommuteRouteSteps → getDiverseRoutes[0]` | Yen K-최단 | **노량진(9)/선정릉(분당) 2환승** |

핵심 사실:
1. 홈 fact grid ↔ ML 타임라인은 같은 엔진/같은 OD id라 **이미 일치**한다(우연한 일치 — 두 훅이 각자 `getDiverseRoutes[0]` 호출).
2. 홈 카드 중앙 노드는 `originLineId`(출발역 첫 노선=5호선) + ML hero 분을 "직행"으로 **합성**한다 → 같은 카드 fact grid의 "2회 환승"과 자기모순.
3. 편집 화면의 `buildRecommendations`는 K-최단이 뱉던 까치산식 무의미 우회를 **의도적으로 억제**하려 도입됨(코드 주석 L177-182). 즉 노량진/선정릉은 편집 화면이 *일부러 안 보여주려던* 종류.
4. `useFirestoreMorningCommute`(L76-81)가 저장된 `CommuteRoute`를 `{stationId, destinationStationId, ...}`로 투영하며 **`transferStations`를 버린다** → 홈/ML은 사용자가 고른 환승역을 구조적으로 못 본다.
5. 신도림은 편집 화면의 auto-default(`recommendations[0]`, 직행 없을 때 첫 1환승)일 가능성이 높음 — 명시적 사용자 선택이 아님.

## 사용자 결정 (확정)

1. **SSOT 정책 = 최단시간 기준 통일**. 전 화면이 같은 canonical 경로를 보여준다.
2. **환승 override = 실제 재경로**. 사용자가 편집 화면에서 환승역을 명시 선택하면 그 경유 경로가 전 화면 SSOT가 된다(기본값은 최단, 명시 선택 시에만 경유).
3. **via 라우팅 = 접근 A (sub-route 연결)**.
4. **단계화 = Phase 1 먼저**.

## 목표

기본(환승 override 없음)이면 `getDiverseRoutes[0]`(최단), 명시적 환승 override면 그 경유 경로 — **하나의 canonical 경로**를 4개 표면(홈 카드, 홈 fact grid, ML 타임라인, 편집 미리보기)이 동일하게 읽는다. 홈 카드의 허구 "직행"을 제거한다.

## 아키텍처

### 단일 경로 리졸버 (SSOT 강제)

두 훅이 각자 `getDiverseRoutes[0]`을 호출하는 현재 구조를 **하나의 순수 함수**로 추출한다. 일치를 *우연*에서 *구조적 보장*으로 바꾼다.

```
resolveCanonicalCommuteRoute(fromSlug, toSlug, viaTransferSlug?): Route | null
  - viaTransferSlug 없음 → getDiverseRoutes(from, to)[0] ?? null
  - viaTransferSlug 있음 → routeVia(from, viaTransferSlug, to)   // §via
```

위치: `src/services/route/` (순수, 그래프 입력만 받음). `useCommuteRouteSummary`·`useCommuteRouteSteps`가 둘 다 이 함수만 호출한다.

### via 라우팅 — 접근 A (sub-route 연결)

```
routeVia(fromSlug, V, toSlug): Route | null
  legA = getDiverseRoutes(fromSlug, V)[0]
  legB = getDiverseRoutes(V, toSlug)[0]
  if (!legA || !legB) return null
  segments = [...legA.segments, <V 환승 segment>, ...legB.segments]
  return createRoute(segments)   // totalMinutes/transferCount 재계산 (모델 헬퍼)
```

- V 경유 보장, 기존 엔진 재사용, 결정적.
- `createRoute`/`countTransfers`/`calculateRouteTotalTime`(src/models/route.ts)로 재합성 → 합산·환승수·시간 일관.
- V에서의 환승 segment는 `isTransfer: true`로 명시 삽입(legA 종점 == legB 시점 == V). legA/legB 자체 환승도 보존.
- 엣지: from==V, V==to, legA 종점 노선==legB 시점 노선(불필요 환승) 등은 구현 시 TDD로 처리.

### 데이터 배관 (transferStations 복원)

- `useFirestoreMorningCommute` setValue: `transferStationId: morning.transferStations[0]?.stationId` 추가(없으면 undefined=최단).
- `useCommuteHeroEstimate`: 이 id를 `useCommuteRouteSummary`·`useCommuteRouteSteps`에 전달(slug 정규화는 기존 `resolveInternalStationId` 경계 재사용).

### 표면별 소비

- **홈 fact grid / ML 타임라인**: 리졸버 경유로 자동 일치(default=최단, override=경유).
- **홈 카드 중앙 노드(허구 "직행" 제거)**:
  - `lineId` = canonical 경로 첫 탑승(비환승) segment 노선 (← `originLineId` 폐기). `useCommuteRouteSummary`가 `lineId?` 노출 추가.
  - 라벨 = `transferCount > 0 ? "환승 {N}회" : "직행"` + 분.
  - 분(`rideMinutes`)은 기존대로 ML hero door-to-door(홈·ML 빅넘버와 동일 소스) 유지.
- **편집 화면**:
  - 자동선택 기본값을 신도림(첫 환승)에서 **"최단(자동)"**(강제 환승 없음)으로 변경.
  - 상단 "환승역(선택)" 게이트: default면 canonical 요약("환승 {N}회"), override면 "{역} 환승". 거짓 "환승 없음(직행)" 표기 제거.
  - 힌트 "직행이 가장 빨라요": 직행이 **실존할 때만**. 없으면 "가장 빠른 경로는 환승 {N}회예요. 다른 환승역을 원하면 선택하세요."
  - 환승역 선택 = **구속력 있는 override** → `transferStations[0]` 저장 → 홈/ML 재경로.

## 단계화

### Phase 1 (먼저 — 가장 visible한 거짓 제거)
- 리졸버 `resolveCanonicalCommuteRoute` 추출(via 미포함, 최단만).
- `useCommuteRouteSummary`·`useCommuteRouteSteps`가 리졸버 공유.
- `useCommuteRouteSummary`에 `lineId?`(첫 탑승 노선) 노출 추가.
- 홈 카드 중앙 노드 정직화(`CommuteRouteCard` 라벨 분기 + HomeScreen `lineId` 배선 교체).
- 결과: 기본(최단) 경로가 홈 카드·fact grid·ML에서 완전 일치, 홈 카드 자기모순 해소.

### Phase 2 (후속 — via override)
- `routeVia` + 리졸버 viaTransferSlug 분기.
- 배관(`useFirestoreMorningCommute` transferStationId → hero hook → 두 훅).
- 편집 화면: 기본값 "최단(자동)" + 구속 override + 힌트/게이트 정직화.

## 테스트 / 검증

- 유닛 TDD(RED→GREEN):
  - `resolveCanonicalCommuteRoute`(최단/via 분기, null 경계).
  - `routeVia`(경유 보장, 환승수 합산, from==V·V==to 엣지) — Phase 2.
  - `useCommuteRouteSummary`(`lineId` 노출), `useCommuteRouteSteps`(via 인자) — 기존 테스트 동작보존 확인.
  - `CommuteRouteCard`(transferCount>0 → "환승 N회", ===0 → "직행").
  - 편집 화면(직행 없는 OD → 기본값 "최단(자동)", 힌트 정직).
- 회귀: 까치산 억제(buildRecommendations 추천 목록은 휴리스틱 유지 — 리졸버는 표시 경로만 담당, 추천 목록 엔진 교체 아님).
- 게이트: `tsc --noEmit`(루트) + `eslint` + `jest --coverage`.
- 마지막 **검증 Workflow(ultracode)**: 4개 표면이 default·override 양쪽에서 동일 canonical 경로를 렌더하는지 adversarial 확인(병렬 파일편집 아님 — 검증 전용, advisor 권고).

## 범위 밖 (YAGNI)

- `buildRecommendations`(편집 추천 목록 엔진) 교체 — 까치산 억제 목적이라 유지. 리졸버는 *표시 경로*만 통일.
- ML door-to-door 분 모델 자체 변경 — 분 소스는 기존 hero 유지(경로 facts만 canonical로 통일).
- 다중 환승 override(편집 picker는 단일 환승 슬롯 유지 — 모델 `transferStations`는 배열이나 [0]만 사용).
