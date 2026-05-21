# 엘리베이터 우선 경로 — 설계 문서

- **작성일**: 2026-05-21
- **상태**: 설계 승인됨 (구현 계획 대기)
- **상위 맥락**: `train-info-gap-analysis` phase backlog #2 의 4개 sub-project 중 하나
- **GAP 항목**: GAP_REPORT.md #10 무장애 경로 (휠체어/고령자/임산부) — 🟡 PARTIAL

---

## 1. 배경

`train-info-gap-analysis` phase의 backlog #2("외부 데이터 의존 GAP 항목 phase 도출")는 단일 phase가 아니라 4개의 독립 sub-project로 분해된다:

| GAP 항목 | 성격 | 본 문서 |
|---|---|---|
| #4 칸별 혼잡도 | 데이터 공급 (인프라는 존재) | 별도 |
| #5 추천 칸 | #4 종속 derived 로직 | 별도 |
| **#10 무장애 경로** | **알고리즘 통합 (데이터는 이미 fetch됨)** | **본 문서** |
| #11 환승 하차문 | 순수 greenfield + 외부 데이터 | 별도 |

각 sub-project는 자체 spec → plan → 구현 사이클을 가진다. 본 문서는 #10만 다룬다.

### 코드베이스 현황 (탐색 결과)

- **경로 탐색**: `src/services/route/` — `routeService.ts`(A* + `calculateRoute`/`calculateEnhancedRoute`), `kShortestPath.ts`(Yen's K-shortest + `getDiverseRoutes`), `weightAdjuster.ts`(혼잡도 multiplier), `transferTime.ts`(`getTransferTime(stationId)`).
- **가중치 주입 패턴**: `buildGraph(excludeLineIds?, congestionMultipliers?)` — 혼잡도가 `ReadonlyMap<string, number>` multiplier로 들어간다. 무장애 가중치도 동일 패턴으로 확장 가능.
- **교통약자 데이터**: `src/models/publicData.ts`의 `AccessibilityInfo` — **역 단위** `elevator { available, count, status }`, escalator, wheelchairLift, tactilePaving, accessibleRestroom. `src/services/api/publicDataApi.ts`가 data.go.kr `stnInfoList` API에서 fetch (캐싱 없음, 1초 rate limit, 웹 CORS 차단). `src/components/station/AccessibilitySection.tsx`가 역 상세에서 시설 아이콘 표시.

### 결정적 데이터 제약

`AccessibilityInfo`는 역 단위 "엘리베이터 유무(개수)"만 제공한다. 환승 통로 내부 연결성, 출구별 접근성, 승강장↔개찰구 연결성은 **데이터에 존재하지 않는다**. 따라서 *진짜* 무장애 경로(계단 0 보장)는 현재 데이터로 계산 불가능하다.

---

## 2. 목표 / 범위

**목표**: 고령자·임산부를 1차 대상으로 하는 "엘리베이터 우선" 경로를 경로 결과 목록에 라벨 후보로 제공한다.

- **요구 강도**: soft preference ("엘리베이터 있는 환승역을 선호") — hard 보장이 아님.
- **데이터 적합성**: 역 단위 "엘리베이터 유무"는 soft preference에 정확히 맞는 granularity. best-effort임을 UI에 명시한다.
- **UX 진입점**: `getDiverseRoutes`가 이미 생성하는 후보(최단/최소환승/경유)에 "엘리베이터 우선" 후보를 하나 추가. 토글·설정 변경 없음 — 사용자가 경로 옵션 중 골라 선택.

### 비목표 (YAGNI 명시 제외)

- 실시간 엘리베이터 점검 상태(maintenance/broken) — 별도 phase.
- 환승 통로 내부 연결성 / 출구별 접근성 — 데이터 부재. **휠체어 hard 보장 모드는 데이터 확보 별도 phase.**
- 계단 회피 세그먼트 수준 라우팅.
- 휠체어리프트·장애인화장실·점자블록 가중치 — 이번엔 엘리베이터 단일 신호만 (KISS). 데이터 모델엔 이미 존재해 미래 확장 가능.
- #4 칸별 혼잡도 / #5 추천 칸 / #11 환승 하차문 — 각각 별도 sub-project.

---

## 3. 접근법 결정 — Approach A: 번들 정적 데이터셋

검토한 3개 접근법:

| 접근법 | 요지 | 판정 |
|---|---|---|
| **A. 번들 정적 JSON** | `data/stationAccessibility.json`을 앱에 번들 (`stations.json`/`lines.json` 방식) | **채택** |
| B. Firestore 동기화 컬렉션 | Cloud Function이 data.go.kr → Firestore 동기화 | 보류 (과설계) |
| C. 역별 lazy fetch + 캐시 | 경로 탐색 시 역마다 on-demand 호출 | 기각 (불가능) |

**A 채택 근거**: 엘리베이터 *유무*는 거의 안 변하는 안정 데이터 → 정적 번들에 적합. 런타임 API 비용 0, 오프라인 동작, 웹 CORS 회피, 즉시 응답. soft-preference 범위에 YAGNI 부합. C는 1초 rate limit × 경로당 수십 역 → 첫 경로 계산 수 분 + 웹 CORS 차단으로 라우팅에 사용 불가. B는 실시간 점검 상태가 요구사항이 될 때의 미래 업그레이드 경로로 남긴다.

---

## 4. 설계

### 4.1 핵심 모델 — 환승역 엘리베이터 페널티

고령자·임산부에게 계단이 실제 부담이 되는 지점은 **환승**이다. 열차에 앉아 지나가는 경유역은 계단 부담이 없고, 승강장 간 이동이 일어나는 **환승역**에서만 계단을 오르내린다. 따라서:

- 페널티는 **환승 엣지(transfer edge)에만** 적용 — 경유역엔 페널티 0.
- 환승역에 엘리베이터가 없으면 그 환승 엣지 가중치에 multiplier 적용.
- 결과: K-최단경로가 자연스럽게 *엘리베이터 있는 환승역*을 경유하는 경로를 선호.

이 모델은 데이터와 1:1로 정직하다 — "엘리베이터 우선 경로"의 정확한 의미가 "환승역에 엘리베이터가 있는 경로"이고, 그것이 데이터가 말해주는 사실 그 자체다. 출발·도착역의 엘리베이터 유무는 사용자가 고정하므로 라우팅을 바꾸지 못한다(UI 정보로만 노출 가능, 본 범위에서는 선택적).

### 4.2 데이터 흐름

```
[빌드 타임 — 1회성 / 가끔]
scripts/fetchStationAccessibility.ts
  → data.go.kr stnInfoList API (역별, 1초 rate limit, ~300역 ≈ 5분)
  → stations.json 의 stationId 로 매핑
  → data/stationAccessibility.json  (커밋된 SoT)

[런타임 — 경로 탐색]
data/stationAccessibility.json
  → accessibilityWeight.ts: ReadonlyMap<stationId, multiplier> 구축 (모듈 로드 시 1회, 메모이즈)
  → getDiverseRoutes(...) 가 buildGraph 에 accessibilityMultipliers 주입
       (congestionMultipliers 와 나란히 — 동일 패턴)
  → 환승 엣지 가중치 계산 시 적용 (getTransferTime 소비 지점)
  → 엘리베이터 가중 K-최단경로 1개 → "엘리베이터 우선" 후보
  → 기존 후보와 transfer signature 동일하면 중복 대신 태깅
  → 경로 결과 목록 UI 에 라벨 행으로 표시
```

### 4.3 컴포넌트 (작은 단위, 단일 책임)

| 파일 | 신규/수정 | 단일 책임 |
|---|---|---|
| `scripts/fetchStationAccessibility.ts` | 신규 | data.go.kr → `stationAccessibility.json` 생성. 1회성, 앱 번들 아님. 멱등 — 재실행 가능 |
| `data/stationAccessibility.json` | 신규 | 역별 `{ hasElevator, elevatorCount }` SoT |
| `src/services/route/accessibilityWeight.ts` | 신규 | JSON 로드 → `ReadonlyMap<stationId, transferMultiplier>` 구축. `weightAdjuster.ts` 와 병렬 구조 |
| `src/services/route/routeService.ts` | 수정 | `buildGraph` 에 `accessibilityMultipliers?` 파라미터; 환승 엣지에 적용 |
| `src/services/route/kShortestPath.ts` | 수정 | 동일 파라미터; `getDiverseRoutes` 가 "엘리베이터 우선" 후보 1개 추가 계산 |
| `src/models/route.ts` | 수정 | route 라벨 union 에 `'elevator-priority'` 추가 |
| 경로 결과 목록 UI | 수정 | 새 라벨 후보를 행으로 렌더 + best-effort sublabel |

### 4.4 데이터 스키마

`data/stationAccessibility.json`:

```json
{
  "generatedAt": "2026-05-21T00:00:00+09:00",
  "source": "data.go.kr/B553766/wksn/stnInfoList",
  "stations": {
    "<stationId>": { "hasElevator": true, "elevatorCount": 2 }
  }
}
```

- `stations` 의 키는 경로 그래프가 쓰는 `stationId` 와 동일 도메인. 빌드 스크립트가 `stations.json` 의 역명으로 data.go.kr 응답을 매핑한다.
- 환승역은 물리적으로 하나의 역(예: 시청역)이 엘리베이터를 보유하므로, `getTransferTime(stationId)` 가 키잉되는 것과 동일한 stationId 도메인으로 키잉한다.

### 4.5 가중치 적용

- `accessibilityWeight.ts` 의 공개 API: `getAccessibilityTransferMultipliers(): ReadonlyMap<string, number>`.
- 반환 map 은 **엘리베이터 없는 역의 페널티 엔트리만** 포함. 엘리베이터 있는 역·데이터셋에 없는 역은 map 에서 누락 → 소비자가 `?? 1.0` 으로 처리 (`congestionMultipliers` 와 동일 소비 패턴).
- 페널티 값은 명명 상수 `NO_ELEVATOR_TRANSFER_MULTIPLIER`(초기값 `1.75`, 튜닝 가능). 환승 엣지 가중치에 곱한다. RED 테스트가 동작을 핀.
- `buildGraph` 시그니처: `buildGraph(excludeLineIds?, congestionMultipliers?, accessibilityMultipliers?)` — 세 번째 파라미터는 optional.

### 4.6 에러 처리 (error-handling.md — throw 지양, graceful)

이 기능은 순수 가산적(additive)이며 조용히 degrade한다. 접근성 데이터에 문제가 생겨도 사용자는 평소 경로(최단/최소환승)만 보고 — 크래시도 깨진 UI도 없다.

| 상황 | 처리 |
|---|---|
| `stationAccessibility.json` 누락/malformed | `accessibilityWeight.ts` → 빈 map 반환. 모든 multiplier 1.0 → 엘리베이터 우선 후보 미생성. 기능만 비활성, 라우팅 정상 |
| 환승역이 JSON 에 없음 (신설역/누락) | **neutral(1.0)로 처리, "없음"으로 단정하지 않는다.** 모르는 것을 단정하면 거짓 신호 |
| 엘리베이터 가중으로 경로 못 찾음 | 페널티는 soft multiplier 라 엣지를 제거하지 않음 → 발생 불가. 발생 시 기존 후보만 반환 |
| 빌드 스크립트 일부 역 API 실패 | 실패 역 로깅 + 부분 JSON 생성. 누락 역은 런타임 neutral. 스크립트 멱등 |

### 4.7 테스트 (TDD RED→GREEN, 커버리지 75/70/60)

- **`accessibilityWeight.test.ts`** (unit) — 엘리베이터 있음 → map 누락(소비자 1.0) / 없음 → 페널티 상수 / 데이터셋에 없는 역 → map 누락(neutral) / malformed JSON → 빈 map graceful.
- **`getDiverseRoutes` 통합** — ① 환승역만 다른 두 경로(엘리베이터 有/無) → 엘리베이터 우선 후보가 有 쪽 선택 ② 엘리베이터 우선 경로 = 최단경로 동일 → 중복 행 없이 태깅 ③ accessibility 데이터 전무 → 후보 미추가, 크래시 없음.
- **회귀 net** — 새 파라미터는 optional → 기존 `getDiverseRoutes`/`calculateRoute` 호출부·테스트 무영향 확인.
- **데이터 회귀 분리** — mock 기반 알고리즘 테스트와 실제 `stationAccessibility.json` 로드 테스트는 별도 파일 (mock 은 실제 JSON 스키마 오류를 못 잡음).

---

## 5. 성공 기준

1. 경로 결과 목록에 "엘리베이터 우선" 라벨 후보가, 해당될 때(엘리베이터 가중 경로가 기존 후보와 다를 때) 나타난다.
2. 환승역에 엘리베이터가 있는 경로가 엘리베이터 우선 후보로 선택된다 — 통합 테스트로 검증.
3. accessibility 데이터 부재/오류 시 크래시 없이 기존 경로만 표시된다.
4. 기존 route 테스트 회귀 0건 (optional 파라미터).
5. 커버리지 임계값(75/70/60) 충족.
6. UI 라벨이 best-effort 성격을 정직하게 표기 (sublabel: "환승역에 엘리베이터가 있는 경로").

---

## 6. 후속 / 열린 항목

- 실시간 엘리베이터 점검 상태 → Approach B (Firestore 동기화) 로 별도 phase.
- 휠체어 hard 보장 모드 → 환승 통로·출구별 접근성 데이터 확보 별도 phase.
- 페널티 상수 `NO_ELEVATOR_TRANSFER_MULTIPLIER` 의 실측 튜닝 → 구현 후 실제 경로 비교로 조정.
- 빌드 스크립트의 data.go.kr 역명 ↔ stationId 매핑 정확도 → 구현 시 미매핑 역 리스트 검수 필요.
- 경로 결과 목록을 렌더하는 정확한 UI 파일(화면/컴포넌트) → 구현 계획(writing-plans) 단계에서 grep 으로 확정. 본 설계는 "라벨 후보 1행 추가"라는 변경 형태만 규정한다.
