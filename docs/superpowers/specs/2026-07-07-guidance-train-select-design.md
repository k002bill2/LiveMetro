# 길안내 탑승 열차 선택/변경 — 설계

날짜: 2026-07-07
상태: 사용자 승인됨 (브레인스토밍 세션)

## 문제

실시간 길안내(RouteGuidanceScreen)는 시간 anchor 기반 추적이다. "탑승했어요"를 누르면
`Date.now()`가 anchor가 되고 이후 hop별 소요 분으로 진행을 추정한다. 이 모델에서:

1. **탑승 버튼을 놓친 경우** — 실제 탑승 몇 분 뒤에 버튼을 누르면 anchor가 "지금"으로
   잡혀 진행률·ETA·하차 안내가 전부 실제보다 늦게 계산된다.
2. **탑승 열차를 바꿔야 하는 경우** — 잘못 확정했거나 다른 열차에 탔을 때 열차(=출발
   시각)를 바꿀 수단이 없다. `goPrev`는 단계를 되돌릴 뿐이다.

어떤 열차에 탔는지는 현재 저장되지 않으며, 사용자 결정: **열차 정체성 추적은 하지 않고
시간 보정만 한다.** 열차 선택 = 그 열차의 출발 시각으로 anchor를 소급 보정(rebase).

## 데이터: 출발 열차 로그 (departedTrainLog)

Seoul 도착정보 API는 역 기준이라 출발한 열차는 조회 불가. 대기(board/transfer) 단계에서
이미 도는 30초 폴링 스냅샷을 이용해 앱이 스스로 기억한다.

- **관측 출발(observed)**: 이전 스냅샷에서 ETA ≤ 임계(기존 `ARRIVING_ETA_THRESHOLD_SEC`)로
  "도착 중"이던 열차 id가 다음 스냅샷에서 사라짐 → 그 시점을 출발 시각으로 기록.
  `departureDetection.ts`의 사라짐 감지와 같은 원리이나, soft-confirm용 단일 판정과 달리
  **후보 전부를** 기록한다 (방면 우선 필터는 표시 단계에서).
- **추정 항목(estimated)**: 탑승 확정 순간 폴링이 꺼지므로(Seoul API 예산 0) 그 후 열차의
  출발은 관측 불가. 마지막 스냅샷의 "도착 예정" 열차들을 `expectedArrivalMs` 기반 추정
  출발 시각으로 함께 보관해 ride 중 "열차 변경" 시나리오를 커버.
- 항목 형태: `{ trainId, finalDestination, lineId, departedAtMs, confidence: 'observed'|'estimated' }`
- **보관 위치**: `guidanceSessionStore` JS-heap (AsyncStorage 영속 안 함 — 앱 재시작 시
  로그 유실은 폴백 항목이 흡수). 최근 15분만 유지(prune), trainId 중복 제거(관측 우선).
- 순수 함수 모듈 `src/services/guidance/departedTrainLog.ts`로 기록/정리 로직 분리.

## UI: 공용 TrainSelectSheet 1개

목록 항목: "○○행 · N분 전 출발" (+ 추정 항목은 "추정" 뱃지). 목록이 비어도 항상
**"방금 출발했어요"**(= anchor를 now로, 기존 동작과 동일) 폴백 항목을 제공.

진입점 3곳:
1. **대기 카드(board/transfer)**: 보조 버튼 "이미 탑승하셨나요?" → 시트 → 선택 시
   해당 출발 시각 T로 다음 단계 진행 (`confirmBoarded(T)` 상당).
2. **ride 카드**: "열차 변경" 버튼 → 시트 → 선택 시 현재 ride 단계 anchor를 T로 rebase
   (단계 인덱스는 유지, 시각만 교체).
3. **soft-confirm 모달**: 기존 "예/아직이에요"에 "다른 열차예요" 추가 → 시트 열기.

## 진행 로직: anchor 소급 rebase

`useGuidanceProgress`에 추가:
- `goNextAt(atMs: number)` — `goNext`와 동일하되 anchor 시각을 과거 T로 (대기→탑승 확정용).
- `rebaseAnchorAt(atMs: number)` — 현재 인덱스 유지, anchor 시각만 T로 (ride 중 변경용).

T가 과거이므로 진행률이 즉시 재계산돼 hop 여러 개를 건너뛴 위치로 점프할 수 있으며 이는
의도된 동작. hold 단계(board/transfer)는 기존 `computeProgress` 규칙대로 자동 통과하지
않는다 — rebase가 hold를 뚫지 않음을 테스트로 고정한다. 미래 시각 입력은 now로 clamp.

## 테스트

- `departedTrainLog`: 기록(사라짐 감지)·prune·dedup·estimated 병합 — 순수 단위 테스트.
- anchor rebase: 과거 T로 진행 점프, hold 미통과, 미래 clamp — 순수/훅 테스트.
- 화면: 3개 진입점에서 시트 열림, 선택 시 진행 반영, 폴백 항목 동작 — RNTL.

## 의도적 제외 (YAGNI)

- 열차 정체성 추적(realtimePosition 폴링) — 사용자 결정으로 제외.
- 로그 AsyncStorage 영속 — 폴백으로 충분.
- 탑승 열차 번호의 세션 저장/표시 — 시간 보정만 수행.
