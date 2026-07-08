# 하차 임박 알림 (환승역 + 목적지) + 설정 — 설계

- 날짜: 2026-07-08
- 상태: 사용자 승인 (접근법 A — 사전 스케줄 방식)
- 범위: 실시간 길안내 중 열차 탑승(ride) 구간에서, 다음 하차 지점(환승역 또는 최종 목적지) 도착 N분 전에 로컬 알림 발사 + 사용자 설정(토글 + 사전 알림 시간)

## 배경

- 환승 승강장 대기 중 "환승 열차 곧 도착" 알림(`boardingAlertService`의 `variant='transfer'`)은 이미 존재. 이번 작업 대상 아님.
- **탑승 중 "곧 하차/환승역" 알림은 부재.** 길안내 진행은 시간 기반(`useGuidanceProgress`)이므로 ride 스텝의 도착 예정 시각을 계산해 사전 예약이 가능.
- 앱은 지하철 탑승 중 백그라운드/화면 꺼짐이 기본 상황 → 포그라운드 틱 감시(접근법 B)는 부적합. pending 로컬 알림 사전 예약(접근법 A)을 채택.

## 요구사항

1. 길안내 중 ride 스텝의 종착(다음 스텝이 `transfer` 또는 `alight`)에 대해, 도착 예정 시각 `leadMinutes`분 전에 로컬 알림 발사.
   - 다음 스텝 `transfer`: "곧 ○○역 — △△선 환승 준비하세요"
   - 다음 스텝 `alight`: "곧 ○○역 — 하차 준비하세요"
2. 설정: 켜기/끄기 토글 + 사전 알림 시간 선택(1 / 2 / 3분, 기본 2분). 기본값 enabled.
3. 백그라운드에서도 발사 (pending 로컬 알림).
4. 알림 과다 발사 금지: 스텝당 1회 예약, 재예약 시 기존 pending 취소 후 교체 (PR #287 교훈: trigger:null 즉시발사 반복 패턴 금지).

## 아키텍처 (접근법 A)

### 신규 서비스: `src/services/notification/alightAlertService.ts`

- `scheduleAlightAlert(params)`: ride 스텝 진입/보정 시 호출. `arrivalAtMs - leadMinutes*60_000`에 발사되는 pending 알림 예약.
  - 발사 시각이 이미 과거이거나 임박(< 몇 초)이면 **예약 생략** (즉시발사 강등 금지 — PR #287 회귀 방지).
  - 스텝 식별자(세션 id + step index) 기준 dedup: 같은 스텝에 이미 예약/발사된 이력이 있으면 재예약하지 않음. 단, 도착 예정 시각이 바뀐 재예약 요청은 기존 pending 취소 후 교체.
- `cancelAlightAlert()` / `cancelAllAlightAlerts()`: 스텝 이탈·세션 종료 시 pending 취소.
- 기존 `notificationService.scheduleArrivalAlert` 래퍼 재사용 (fireAt 계산·권한·채널 처리 공통화).

### 발사/재예약 트리거 (RouteGuidanceScreen 통합)

- ride 스텝 진입 시: 해당 스텝의 도착 예정 시각으로 예약.
- 탑승 열차 선택/변경(PR #288 `departedTrainLog`/`rebaseAt` 경로) 및 수동 "다음 단계" 보정 시: 도착 예정 시각 재계산 → 재예약.
- 세션 종료/도착 완료 시: 전체 취소.
- 설정 off → 예약 자체를 하지 않음. 설정 변경(off→on)은 다음 스텝 진입/보정 시점부터 반영 (소급 예약은 하지 않음 — 단순성 우선).

### 설정 모델: `src/models/user.ts`

```typescript
NotificationSettings {
  ...
  alightAlert?: {
    enabled: boolean;        // 기본 true
    leadMinutes: 1 | 2 | 3;  // 기본 2
  }
}
```

- 필드 부재(기존 사용자) 시 기본값으로 간주하는 정규화 헬퍼 제공.
- 저장: Firestore userPreferences — **부분쓰기(`updateUserPreferences`)만 사용.** stale 전체 스프레드 setDoc 금지 (즐겨찾기 전멸 사고 이력).

### 발사 게이트

- `notificationService.shouldSendNotification`의 quietHours 게이트 통과.
- `alightAlert.enabled === false`면 스케줄 단계에서 차단 (발사 단계가 아니라 예약 단계 게이트 — pending 알림은 발사 시점에 설정을 재평가할 수 없으므로, 설정 off 시 pending 전체 취소도 수행).

### 설정 UI

- 알림 설정 영역에 "하차 임박 알림" 행 신설: 토글 + 사전 시간 선택(1/2/3분 세그먼트 또는 선택지).
- 정확한 화면 배치(기존 알림 설정 허브 내 위치)는 구현 계획 단계에서 기존 화면 구조 확인 후 확정.
- 카피는 정직성 원칙 준수: 실제 발사되는 조건(길안내 중, 시간 추정 기반)을 과장 없이 설명.

## 에러 처리

- 알림 권한 없음: 예약 실패를 조용히 무시하고 길안내는 정상 진행 (서비스 함수는 throw 금지, null/false 반환).
- 도착 예정 시각 계산 불가(스텝 데이터 이상): 예약 생략.

## 테스트

- `alightAlertService` 단위 테스트: 발사 시각 계산(lead 반영), 과거/임박 시각 예약 생략, 스텝 dedup, 시각 변경 시 취소+교체, 설정 off 게이트, 전체 취소.
- 설정 정규화 헬퍼 테스트: 필드 부재 시 기본값.
- 설정 저장: 부분쓰기 호출 검증.
- RouteGuidanceScreen 통합: ride 진입 시 예약 호출, 열차 변경 시 재예약, 세션 종료 시 취소 (mock 기반, jest.mock factory inline 패턴 준수).

## 비범위 (YAGNI)

- GPS 기반 실측 도착 감지 (시간 추정으로 충분, 기존 보정 기능이 완화)
- 환승 알림 전용 사운드/진동 (perEventSound 확장 안 함)
- 기존 "환승 열차 곧 도착"(boarding variant='transfer') 알림의 설정 토글
- 백그라운드 위치 추적
