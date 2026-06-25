# 출퇴근 노선 공식 지연 포그라운드 알림 (Delay Alert Firing) — Design Spec

- **Date**: 2026-06-26
- **Branch**: `worktree-delay-alert-firing` (base: `origin/main` @ dac4b71)
- **Scope**: v1 — 포그라운드(앱 열림) 한정, 공식 지연 소스, 클라이언트 전용

## 1. 문제 (Problem)

오늘 이 앱은 **어떤 경로로도 지연 알림을 0건 발사한다** (현재 main, fresh 검증):

- 서버 푸시 트리거 `onDelayReportVerified`는 `status === 'verified'` 문자열 transition을 요구하나(`delayPushLogic.ts:43`), 클라이언트는 `verified: false` boolean만 쓰고(`delayReportService.ts:60`) 검증 플로우도 #221에서 제거됨 → 영구 미발화.
- 토큰 컬렉션 단절: 클라이언트 `pushTokens` ↔ 서버 cert/badge/commute `fcm_tokens`(`registerFcmToken` 클라 호출 0건).
- 포그라운드 모니터(`useNotifications.monitorStationDelays`)는 `monitoredStations=[]` 기본 + populate 0건 + **데이터 소스 `dataManager.detectDelays`가 deprecated, 항상 `[]` 반환**(`dataManager.ts:210`).

## 2. 목표 / 비목표

### Goals (v1)
- G1. 앱이 포그라운드(AppState 'active')일 때, 사용자의 **출퇴근/즐겨찾기 노선에 공식 지연이 발생하면 로컬 알림**을 발사한다.
- G2. 알림은 사용자 알림 설정(`shouldSendNotification`: 방해금지/평일만/이벤트별)을 통과할 때만 발사한다.
- G3. 동일 지연을 반복 발사하지 않는다(dedup). 지연이 해소 후 재발하거나 상태가 악화되면 재발사한다.

### Non-Goals (의도적 후속)
- 앱 종료/백그라운드 푸시(서버 FCM) — 토큰 통일·트리거·배포 필요. 별도 작업.
- 도착편차 기반 비공식 지연 감지(저정밀, false alarm 위험으로 제외).
- 사용자 제보(community) 지연 푸시.
- 현재위치 지도 시각화(별개 feature).

## 3. 핵심 통찰 (Design Rationale)

**알림은 recall보다 precision.** false delay alert는 신뢰를 깨므로(코드베이스가 `dataManager.detectDelays`를 deprecate하며 남긴 명시적 이유: "false delay alerts that erode user trust"), v1은 **권위적 공식 소스만** 사용한다: `officialDelayService.getActiveDelays()` (서울 공식 노선 상태, `status: delayed|suspended|modified`). 전 노선 1콜+캐시라 rate-limit 친화적이고, official-delay-realdata WIP와 비충돌(소비만 — 그 WIP가 데이터 소스를 강화하면 자동으로 더 정확해짐).

기존 `useNotifications.monitorStationDelays`(station-based, 죽은 detectDelays 의존, 복잡한 timer ref 머신)는 **부활하지 않는다** — 신규 focused 훅이 더 단순하고 정직하다.

## 4. 아키텍처 (Units & Interfaces)

### 4.1 `useWatchedLineIds` (신규 · 셀렉터 훅)
- **위치**: `src/hooks/useWatchedLineIds.ts`
- **시그니처**: `useWatchedLineIds(): readonly string[]`
- **책임**: 사용자가 관심 갖는 노선 id 집합을 도출 — 즐겨찾기 역들의 `lineId`(FavoritesContext, 동기) ∪ 출퇴근 OD 노선. commute 역→lineId 해석이 미완이면 즐겨찾기만으로 graceful degrade. 중복 제거된 정렬 배열 반환(안정 참조 = `useMemo`).

### 4.2 `useCommuteDelayAlerts` (신규 · 오케스트레이터 훅)
- **위치**: `src/hooks/useCommuteDelayAlerts.ts`
- **시그니처**: `useCommuteDelayAlerts(watchedLineIds: readonly string[]): void`
- **책임**: AppState가 'active'이고 알림 권한이 있을 때만 동작.
  - `officialDelayService.getActiveDelays()`를 polling(캐시 경유, **90초 간격**). 백그라운드 전환 시 interval 정지, 복귀 시 재개.
  - 결과를 `watchedLineIds`로 필터.
  - 각 활성 지연에 대해 dedup(§4.3) 판정 후, 신규/악화면 `notificationService.shouldSendNotification(settings, DELAY_ALERT)` 통과 시 `fireLineDelayAlert`(§4.4) 호출.
  - cleanup: 언마운트 시 `clearInterval` + `AppState` subscription `.remove()`.
- **의존**: `officialDelayService`, `notificationService`, `AppState`(react-native), `useAuth`(권한/설정), `useDelayAlertDedup`(§4.3).

### 4.3 `useDelayAlertDedup` (신규 · dedup 순수 로직 + ref state)
- **위치**: `src/hooks/useDelayAlertDedup.ts` (또는 §4.2 내부 ref + 순수 헬퍼 `delayAlertDedup.ts`)
- **순수 함수**: `shouldAlert(prev: Map<lineId, AlertedState>, delay: OfficialDelay): boolean` — prev에 없거나 status가 악화(delayed→suspended 등)면 true. **재계산 후 호출자가 prev를 갱신**, 활성 목록에서 사라진 lineId는 prune(해소→재발 시 재알림).
- 불변식: 동일 (lineId, status) 연속 폴링은 1회만 알림.

### 4.4 `fireLineDelayAlert` (신규 · notificationService 래퍼 또는 메서드)
- **위치**: `src/services/notification/lineDelayAlert.ts` (얇은 어댑터)
- **시그니처**: `fireLineDelayAlert(delay: OfficialDelay): Promise<void>`
- **책임**: line-level `OfficialDelay`를 사용자 메시지로 변환("2호선 지연 — {reason}" / suspended는 "운행 중단")하여 기존 `notificationService.sendDelayAlert`(또는 신규 line variant) 호출. station-oriented 기존 시그니처에 lineName을 subject로 매핑.

### 4.5 `App.tsx` (수정 · app-root 배선)
- `AppContent`에서 `const watchedLineIds = useWatchedLineIds(); useCommuteDelayAlerts(watchedLineIds);` (기존 `useCommuteReminderSync`/`usePushRegistration` 옆). AppState 게이트로 모든 탭을 포그라운드 동안 커버.

## 5. 데이터 흐름

```
App-root: useWatchedLineIds (favorites∪commute lineIds)
   → useCommuteDelayAlerts(watchedLineIds)
        │ (AppState 'active' + 권한)
        ├─ 90s poll: officialDelayService.getActiveDelays() [캐시]
        ├─ filter(watchedLineIds) → shouldAlert(dedup) → shouldSendNotification(settings)
        └─ fireLineDelayAlert → notificationService.sendDelayAlert (OS 로컬 알림)
   [백그라운드 전환] interval 정지 → [복귀] 재개
```

## 6. 에러 처리
- `getActiveDelays()` 실패 → 무알림(throw 금지, `__DEV__` 경고). 다음 폴링에서 재시도.
- 권한 없음/설정 off → 무발사.
- dedup state는 세션 in-memory(ref) — 포그라운드 한정 기능이라 영속 불요.

## 7. 테스트 전략 (TDD)
- `useWatchedLineIds`: 즐겨찾기만 / 출퇴근 추가 / 중복 제거 / 빈 상태.
- `delayAlertDedup.shouldAlert`: 신규=true, 동일상태 반복=false, 악화=true, 해소후재발=true.
- `useCommuteDelayAlerts`(fake timers + AppState/officialDelayService/notificationService mock): 관심노선 신규지연→sendDelayAlert 1회; 미관심노선 무시; 동일지연 반복폴링 1회만; `shouldSendNotification`=false 무발사; AppState 'background' 무폴링; 언마운트 cleanup(interval clear, AppState remove).
- `fireLineDelayAlert`: OfficialDelay→메시지 매핑(delayed/suspended/reason 유무).
- 커버리지: `jest.config.js` 게이트.

## 8. 영향 파일
- **신규(4+테스트)**: `useWatchedLineIds.ts`, `useCommuteDelayAlerts.ts`, `delayAlertDedup.ts`, `lineDelayAlert.ts`.
- **수정(1)**: `App.tsx`(배선). 필요 시 `notificationService`에 line variant 1개.
- **불변**: 죽은 `useNotifications.monitorStationDelays`/`dataManager.detectDelays`는 건드리지 않음(별도 정리 대상).

## 9. 위험 & 완화
- **false alarm**: 공식 소스만 사용(precision 우선).
- **rate-limit**: getAllLineStatuses 캐시 경유 + 90s — 전 노선 1콜이라 안전(서울 API 30s 최소·일 1000 준수).
- **app-root 비용**: AppState 'active'에서만 폴링, 단일 캐시 콜이라 경량. 백그라운드 완전 정지.
