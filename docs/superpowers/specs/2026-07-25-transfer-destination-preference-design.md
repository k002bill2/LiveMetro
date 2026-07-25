# 환승/탑승 대기 종점행 표시·선택 (Destination Preference) 설계

- 날짜: 2026-07-25
- 상태: 사용자 승인 완료 (섹션별 승인)
- 범위: 실시간 길안내 화면의 대기 구간(첫 탑승 + 환승)

## 배경 / 문제

분기 노선(예: 5호선 마천행/하남검단산행)에서는 같은 방면이라도 종착역이 다른 열차가 섞여
도착한다. 현재 길안내 대기 카드(`GuidanceNowCard`)의 대기 문구는 "다음 열차 3분 24초 후
도착"처럼 시간만 표시해, 사용자가 어느 열차를 타야 하는지 알 수 없다.

데이터는 이미 존재한다: Seoul API `bstatnNm`은 `seoulSubwayApi.ts`(`destinationStation`
정규화)를 거쳐 `Train.finalDestination`(`src/models/train.ts:47`)으로 흘러오고,
`useRealtimeTrains`가 반환하며, `TrainSelectSheet`는 이미 "장암행" 형태로 표시 중이다.
빈 곳은 대기 카드 표시와 "원하는 종점행만 추적"하는 필터 계층뿐이다.

## 확정 결정 (브레인스토밍 Q&A)

| 질문 | 결정 |
|------|------|
| 기능 깊이 | 표시만이 아니라 **원하는 종점행 선택** — 카운트다운·탑승 감지·알림이 선택된 종점행 열차만 추적 |
| 선택 단위 | **복수 선택 + 기본 전체** — 미선택 시 현행 동작(모든 열차), 회귀 없음 |
| 적용 범위 | **모든 대기 구간** — 출발역 첫 탑승 대기 + 환승 대기 |
| 지속성 | **출퇴근 경로에 저장** — CommuteRoute 인라인 필드, 일반 검색 경로 세션은 세션 한정 |
| 접근안 | **A안: CommuteRoute 인라인 + 단일 초크포인트 필터** (전역 preferences 컬렉션 기각 — 분기 너머 목적지에서 오필터 위험 + 신규 영속 컬렉션 수명주기 비용) |

핵심 통찰: 종점행 선호는 역의 속성이 아니라 **여정의 속성**이다. 하차역이 분기 이전이면
여러 종점행이 유효하고, 분기 너머면 일부만 유효하다. 목적지가 고정된 출퇴근 경로에
귀속시켜야 의미론적으로 안전하다.

## 1. 데이터 모델 & 저장

### CommuteRoute (`src/models/commute.ts`)

```ts
export interface CommuteRoute {
  // ...기존 필드...
  /** 탑승 구간별 선호 종착역. 키 = `${stationId}|${lineId}` (출발역 1 + 환승역 N).
   *  값 = 선호 종착역 이름 배열 (finalDestination 도메인). 부재/빈 배열 = 전체 열차. */
  readonly boardingPreferences?: Readonly<Record<string, readonly string[]>>;
}
```

- 종착역을 ID가 아닌 **이름**으로 저장한다. 매칭 상대인 `Train.finalDestination`이
  `bstatnNm` 정규화 결과(이름 도메인)이기 때문. 저장·매칭 양쪽 모두 동일한
  `formatStationName` 정규화를 거쳐 표기 불일치를 차단한다.
- 탑승 구간 키 재료: 출발역은 `departureStationId`+`departureLineId`, 환승역은
  `TransferStation.stationId`+`lineId` (환승 후 탑승 노선).

### GuidanceSession (`src/models/guidance.ts`)

```ts
export interface GuidanceSession {
  // ...기존 필드...
  /** 세션 사본 — 시트에서 변경 시 즉시 반영. 키잉은 boardingPreferences와 동일. */
  readonly destinationPreferences?: Readonly<Record<string, readonly string[]>>;
  /** write-back 대상. 출퇴근 동선 진입이 아니면 부재 → 세션 한정 동작. */
  readonly sourceCommuteType?: 'morning' | 'evening';
}
```

- 세션 시작 시(출퇴근 동선 진입일 때) `CommuteRoute.boardingPreferences`를 세션으로 복사.
- 일반 경로 검색 진입 세션은 `sourceCommuteType` 부재 → 선택은 세션 내에서만 유효.

## 2. UI / UX

### GuidanceNowCard 대기 상태 (board/transfer 공통)

- 주 문구 확장: 매칭 열차 기준 + 종착역 포함 — "하남검단산행 3분 24초 후 도착".
- 보조 줄: 방면 필터 통과 열차 전체 기준으로 다음 도착 순 최대 2대 나열(매칭 여부 무관) —
  "다음: 마천행 6분 · 하남검단산행 9분". 매칭 열차는 강조, 비매칭은 흐림 처리.
  (전체 기준인 이유: 비매칭 열차가 먼저 오는 상황을 보여줘야 "이건 보내고 다음을 탄다"는
  판단이 가능하다.)
- "종점행 선택" 진입 칩 + 필터 활성 시 "하남검단산행만" 뱃지.
- 접근성: 칩·뱃지 44×44pt 터치 영역, `accessibilityLabel` 필수.

### DestinationFilterSheet (신규, bottom sheet)

- 기존 `TrainSelectSheet` 시각 패턴 재사용.
- 후보 목록 = 현재 도착 리스트의 distinct `finalDestination` ∪ 저장된 선택값
  (저장값이 현재 도착 창에 없어도 체크 상태로 노출).
- 다중 체크. 전부 해제 = "전체"(기본).

## 3. 데이터 흐름

- **단일 초크포인트**: `RouteGuidanceScreen`의 기존 방면 필터(`filteredTrains`,
  약 296-305행) 뒤에 종착역 필터를 체이닝. 카운트다운·탑승 임박 알림·soft-confirm
  후보가 전부 자동 상속한다.
- **예외 1곳**: `TrainSelectSheet`(실제 탑승 열차 보고)는 **전체 리스트 + 매칭 강조**.
  필터는 추적 대상 추천이지, 필터 밖 열차를 탔다는 사실 보고를 막으면 안 된다.
- 선택 변경 시: 세션 상태 즉시 반영 → `sourceCommuteType` 있으면 해당 `CommuteRoute`
  객체만 **부분 교체**로 write-back. 전체 preferences 스프레드 금지
  (stale 스프레드가 즐겨찾기 배열을 롤백시킨 `updateUserPreferences` 사건 재발 방지).

## 4. 에러 처리 & 엣지

| 상황 | 동작 |
|------|------|
| 매칭 열차 0대 | 빈 화면 금지 — "선택한 종점행 열차가 없어요" + 전체 기준 다음 열차 보조 표시. 임박 알림은 매칭 열차에만 발사(0대면 미발사) |
| 퇴근 경로 자동 미러(`reverseCommuteRoute`) | `boardingPreferences` **드롭** — 반대 방향 종점 집합은 무의미 |
| 경로 편집으로 탑승역/노선 변경 | 스테일 키 자연 미적용 + 저장 시 현재 경로의 유효 키 집합으로 prune |
| Firestore optional 필드 | 조건부 spread (`addDoc` undefined throw 전례 회피) |
| 표기 정규화 | 저장·매칭 모두 `formatStationName` 경유 |

## 5. 테스트

- 유닛: 종착역 필터 함수(매칭/빈 선택=전체/0매칭), 키 생성·prune, reverse 미러 시 드롭.
- 컴포넌트: 대기 카드 종착역 표시, 시트 다중 체크 토글, 0매칭 fallback 문구.
- **계약(no-mock) 1개**: commuteSchedule 저장 round-trip에 `boardingPreferences`가
  실려가는지 — mocked-seam이 데이터 계약 파손을 숨긴 반복 전례 때문에 필수.
- 알림 게이트: 매칭 0대일 때 임박 알림 미발사.

## 비범위 (YAGNI)

- 전역 (역,노선) preferences 컬렉션 — 기각 사유는 위 결정 표 참조.
- 급행/완행 구분 표시·필터 — 종착역만 다룬다.
- 노선 분기 토폴로지 기반 "탑승 가능" 자동 판별 뱃지 — 후속 후보.
- 일반 검색 경로 세션의 선택 영속화 — 저장 대상이 없어 세션 한정.

## 구현 노트 (함정 목록)

1. write-back은 부분 업데이트만 — 전체 preferences 스프레드 금지.
2. Firestore optional 필드는 조건부 spread.
3. `TrainSelectSheet`는 필터 미적용(전체 + 강조) — 초크포인트 상속에서 명시적 제외.
4. 저장·매칭 문자열은 동일 정규화(`formatStationName`) 경유.
5. 탑승 임박 알림 dedup 키(세션|역|variant)는 변경하지 않는다 — 필터는 어느 열차가
   알림을 유발하는지만 바꾼다.
