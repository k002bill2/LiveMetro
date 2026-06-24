# 공식 지연 실데이터 통합 (A2) — data.go.kr 알림 → OfficialDelay — Design

- **Date**: 2026-06-25
- **Status**: 설계 승인 (spec 리뷰 대기)
- **Scope tag**: A2 — `fix/delay-accuracy-honesty`(PR #252, Math.random 가짜 지연 제거)의 후속
- **선행**: A 단계(#252) — `fetchOfficialDelays`가 날조 없이 all-normal 정직 반환 중

## 1. Problem / Goal

`officialDelayService.fetchOfficialDelays()`는 현재 실소스가 없어 전 노선 `normal`만 반환한다
(A 단계에서 `Math.random()` 가짜 지연을 제거한 정직 상태). 소비처
`usePredictionFactors.buildDelayFactor`는 빈 결과를 neutral "지연 정보 없음"으로 표시하며,
짝지어진 TODO(`officialDelayService.ts:275`, `usePredictionFactors.ts:203`)가 실데이터 통합을
가리키고 있다.

**Goal**: 이미 존재·검증된 `publicDataApi.getActiveAlerts()`(data.go.kr 서울교통공사 지하철알림,
B553766/ntce)를 소스로 연결해, **실제 지연/사고 알림이 ML 예측 "예측에 반영된 요소" 패널의
지연 factor에 정직하게 드러나게** 한다. 날조·과단정 없이.

## 2. Non-Goals (YAGNI)

- **"정시 운행" positive 복원 안 함** — 빈 결과는 neutral "지연 정보 없음" 유지. A2의 핵심
  가치는 실제 장애가 드러나는 negative 경로다. positive는 genuine-realtime 신호 배선이 필요해
  과설계이며, 거짓 확신 위험만 키운다. 소비처 `buildDelayFactor`는 **무변경**.
- **`delayMinutes` 파싱 안 함** — `SubwayAlert`에 구조화된 분(分)이 없고 free-text `content`뿐.
  텍스트에서 분을 추출하면 "거짓 5분"(#252에서 제거한 버그 클래스) 재발. `delayMinutes`는 항상
  `undefined`. `verifyReportedDelay`는 undefined에서 confidence 0.6 분기로 graceful degrade.
- **비-1~9호선 알림** — 본 서비스 도메인(`LINE_NAMES`)이 1~9호선 한정. 경의중앙선 등은 drop
  (lineId 스킴 발명 안 함). 도메인 확장은 별도 작업.
- **새 fetch/rate-limit/timeout 코드** — `publicDataApi`가 이미 소유(웹 CORS 가드, 10초 timeout,
  retry/throttle, `EXPO_PUBLIC_DATA_PORTAL_API_KEY`).
- **publicDataApi / 모델(`OfficialDelay`, `SubwayAlert`) 변경 없음.**

## 3. Key Decisions (확정)

| 결정 | 값 | 근거 |
|------|-----|------|
| 소스 | `publicDataApi.getActiveAlerts()` → `SubwayAlert[]` | 이미 프로덕션-ready. A2=매핑이지 새 fetch 아님 |
| 장애 분류 집합 | `'delay'`, `'accident'`만 | 기존 SoT `integratedAlertService.checkDelayStatus` L297-302의 `['delay','accident']`와 정합. maintenance/crowded/weather/other 무시 |
| status 매핑 | `delay→delayed`, `accident→delayed` | accident=MAJOR(운행 지속, subway-data-processor SoT "사고는 났지만 운행은 한다"). free-text 미파싱이라 `suspended`(운행 중단=SEVERE)는 과단정 → 회피. 그 외→normal(미표시) |
| `delayMinutes` | 항상 `undefined` | free-text 파싱 금지 ("거짓 5분" 회피) |
| positive 복원 | **안 함** — neutral 유지 | YAGNI + 정직. 소비처 무변경 |
| 웹/비지원 플랫폼 | `Platform.OS === 'web'`이면 throw → `isRealtime:false` | `getActiveAlerts`의 웹 `[]`이 거짓 realtime-normal로 굳는 것 방지(방어적, 미래 소비처 대비) |
| 다중 알림 같은 노선 | 장애 있으면 `delayed` | A2는 `delayed`만 산출 — status 단일이라 tie-break 불요 |

## 4. Architecture

```
publicDataApi.getActiveAlerts()  →  SubwayAlert[]   (기존: 웹 CORS·timeout·retry·키)
            │
            ▼  fetchOfficialDelays() 내부 (교체 대상)
   [웹 가드] Platform.OS==='web' → throw  ───────────────┐
            │ (native)                                    │
   classifyAlertStatus(alertType): 'delayed'|null   (delay/accident만)
   lineNameToLineId(lineName): "2호선"→"2" (1~9), else null
            │                                             │
   mergeWithBaseline(disruptions): 1~9 all-normal + delayed 오버레이
            │                                             │
            ▼  OfficialDelay[]                            ▼ catch → isRealtime:false
   getAllLineStatuses() ─ 캐시(60s) ─ getActiveDelays() ─ buildDelayFactor (무변경)
```

### 4.1 신규 순수 헬퍼 (officialDelayService.ts 내부, 단위 테스트 대상)

- `classifyAlertStatus(alertType: AlertType): DelayStatus | null`
  - `'delay' → 'delayed'`, `'accident' → 'delayed'`, 그 외 → `null`(장애 아님)
- `lineNameToLineId(lineName: string): string | null`
  - `LINE_NAMES` 역매핑. `"N호선"`(N∈1..9) → `"N"`, 그 외 → `null`
- `mergeWithBaseline(disruptions: OfficialDelay[]): OfficialDelay[]`
  - 1~9호선 baseline(all-normal)에 disruption 오버레이. 동일 lineId 다중 시 첫 disruption 유지(현재 전부 `delayed`라 동일)

### 4.2 OfficialDelay 필드 채움 (분류된 알림 → OfficialDelay)

| 필드 | 값 |
|------|-----|
| `lineId` | `lineNameToLineId(alert.lineName)` (null이면 그 알림 drop) |
| `lineName` | `LINE_NAMES[lineId]` (canonical) |
| `status` | `classifyAlertStatus(alert.alertType)` |
| `delayMinutes` | `undefined` (불변) |
| `reason` | `alert.title || alert.content` (있으면) |
| `affectedStations` | `alert.affectedStations` (현재 `[]`) |
| `startTime` / `estimatedEndTime` | `alert.startTime` / `alert.endTime ?? undefined` |
| `updatedAt` | `new Date()` |
| `source` | `'seoul_metro'` |

## 5. Error Handling

- API 실패/타임아웃 → `publicDataApi`가 내부 retry 후 throw → 기존 `getAllLineStatuses` try/catch가
  캐시 또는 all-normal 폴백(`isRealtime:false`). **신규 에러 경로 불필요**(이미 존재).
- 웹 플랫폼 → `fetchOfficialDelays` throw → 동일 catch 경로 → `isRealtime:false`. 소비처는
  `getActiveDelays()` `[]` → neutral(정직).
- 분류 불가/비-1~9 알림 → 조용히 drop(에러 아님). baseline normal 유지.

## 6. Testing (TDD)

순수 헬퍼 (RED→GREEN):
- `classifyAlertStatus`: 6종 alertType → delay='delayed', accident='delayed', 나머지 4종(maintenance/crowded/weather/other)=null
- `lineNameToLineId`: "2호선"→"2", "9호선"→"9", "경의중앙선"→null, ""→null
- `mergeWithBaseline`: ①무장애→9 normal ②2호선 delay→2만 delayed·나머지 normal
  ③동일 노선 delay+accident→delayed (단일 status)

통합 (jest.mock `@/services/api` publicDataApi):
- `getActiveAlerts` mock(2호선 delay 알림) → `fetchOfficialDelays` → 2호선 delayed 포함 OfficialDelay[]
- `getActiveAlerts` mock([]) → 전 노선 normal
- 비-1~9 알림만 → 전 노선 normal (drop 검증)

웹 가드 (Platform mock):
- `Platform.OS='web'` → `getAllLineStatuses().isRealtime === false` (RED: 현재 true)

회귀(기존 동작 보존):
- `getActiveDelays`는 delayed/suspended만 필터
- `verifyReportedDelay`(delayMinutes undefined) → confidence 0.6 분기
- `getStatusLabel`/`getStatusColor` 불변

소비처 회귀:
- `buildDelayFactor` 무변경 확인 — empty→neutral, 장애 있으면 negative `N건 지연`

## 7. Files

- **변경**: `src/services/delay/officialDelayService.ts` (fetchOfficialDelays 교체 + 3 헬퍼 + Platform import + L272-276 TODO 주석 갱신)
- **변경**: `src/services/delay/__tests__/officialDelayService.test.ts` (위 케이스)
- **주석만 변경**: `usePredictionFactors.ts` L201-203 — 로직 불변. "실소스 통합 시 positive 복원" 주석이 A2로 stale → "통합 완료, positive는 YAGNI로 의도적 미복원"으로 갱신(내 변경이 만든 stale 정리)
- **무변경**: `publicDataApi.ts`, 모델(`OfficialDelay`/`SubwayAlert`)
