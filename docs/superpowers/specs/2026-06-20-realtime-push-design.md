# 실시간 푸시 — 토큰 파이프라인 + 크라우드소싱 지연 알림 (Expo Push) — Design

- **Date**: 2026-06-20
- **Status**: 설계 승인 (spec 리뷰 대기)
- **Scope tag**: B-(나-1) — 첫 서브프로젝트 (토큰 파이프라인 + 1개 end-to-end 푸시 경로)
- **선행**: B-(가) 출근 리마인더([[project_notification_firing_architecture_gaps]]) 완료 후속

## 1. Problem / Goal

진단 결과 앱에 "꺼진 동안 동적 알림" 능력이 없다. server-push(FCM) 스캐폴드는 있으나
**클라이언트가 토큰을 등록하는 고리가 통째로 없어** 수신자가 0명이다.

**Goal**: 토큰 파이프라인을 깔고(모든 푸시의 토대), 그 위에서 **검증된 지연 제보**가 사용자
노선에 발생하면 앱이 꺼져 있어도 푸시를 받는 경로를 **end-to-end로 증명**한다. 전송은
**Expo Push**(네이티브 messaging lib 불필요)로 한다.

## 2. Non-Goals (YAGNI)

- 출퇴근 리마인더 — B-(가) 클라 로컬 알림이 소유. 서버 `sendCommuteReminders`(매분 cron)는
  **중복이므로 비활성/미사용** (이중 발사 방지).
- 공식 Seoul API 지연 폴링 — 후속 서브프로젝트 B-(나-2).
- 도착-임박(arrival) while-closed 푸시 — 후속.
- raw FCM / `@react-native-firebase/messaging` — 사용 안 함(Expo Push 채택).
- badge/certificate 트리거 — 기존대로 두되 이 spec 범위 밖.

## 3. Key Decisions (확정)

| 결정 | 값 | 근거 |
|------|-----|------|
| 전송 채널 | **Expo Push** (`getExpoPushTokenAsync` + Expo Push API) | 클라가 이미 Expo 토큰 획득. 네이티브 lib·APNs/FCM 토큰 저글링 불필요 |
| 첫 푸시 소스 | **크라우드소싱 지연**(`onDelayReportVerified` 어댑트) | 트리거 이미 존재 → 새 코드 최소로 파이프라인 증명 |
| 타게팅 | `pushTokens.lines` 배열 비정규화 + `array-contains` 역조회 | Expo Push에 토픽 없음. lines는 commute∪favorites에서 클라 파생 → 별도 구독 UI 불필요 |
| 토큰 저장 | 클라 → Firestore `pushTokens/{uid}` 직접 쓰기(rules 게이트) | callable 왕복 불필요. 기존 `registerFcmToken`(FCM 전용)은 미사용/deprecate |
| 멱등성 | `pushDedup/{reportId}` 1회 발사 가드 | functions/CLAUDE.md: side-effect 트리거 멱등 필수 |
| Functions API | **v2**(`onDocumentWritten`) | functions/CLAUDE.md: 신규/변경 트리거는 v1 금지 |

## 4. Architecture

### 4.1 클라이언트

**`src/services/notification/pushTokenService.ts`** (신규)
- `registerPushToken(uid, lines): Promise<void>` — 권한 granted일 때 `getExpoPushTokenAsync()`로
  토큰 획득 → Firestore `pushTokens/{uid}`에 `{ uid, token, platform, lines, updatedAt }` setDoc.
  권한 없으면 no-op(토큰 미발급).
- `updateLines(uid, lines): Promise<void>` — lines만 갱신(merge).
- `unregisterPushToken(uid): Promise<void>` — 로그아웃/탈퇴 시 doc 삭제.

**`src/hooks/usePushRegistration.ts`** (신규) — `useCommuteReminderSync`와 동형 패턴
- useAuth + 파생 `lines`(출퇴근 경로 lineIds ∪ 즐겨찾기 역 lineIds)를 구해, 변화 시
  `pushTokenService.registerPushToken(uid, lines)` 호출. App.tsx `AppContent`에 1회 마운트.
- `lines` 파생 소스: 출퇴근 경로(useFirestoreMorningCommute의 route lineIds) + 즐겨찾기
  (useFavorites의 각 역 lineIds). dedup된 string[].

### 4.2 서버 (functions/)

**`functions/src/services/expoPushService.ts`** (신규)
- `sendToTokens(tokens: string[], message): Promise<ExpoPushResult>` — Expo Push API
  (`https://exp.host/--/api/v2/push/send`)로 **100개 청크** POST. 응답 ticket 수집.
- `handleReceipts(ticketIds): Promise<string[]>` — receipt 조회, `DeviceNotRegistered` 토큰 반환.
- expo-server-sdk(node) 사용 권장(청크·receipt 처리 내장). 토큰 형식 검증(`Expo.isExpoPushToken`).

**`functions/src/triggers/notificationTriggers.ts` — `onDelayReportVerified` 어댑트**
- v1 → **v2 `onDocumentWritten('delayReports/{reportId}')`**로 마이그레이션.
- 게이트 보존: status `→ verified` 전이 AND `delayMinutes >= 5`.
- **멱등**: `pushDedup/{reportId}` 트랜잭션 가드 — 이미 있으면 skip, 없으면 기록 후 발사.
- 타게팅: `pushTokens where lines array-contains after.lineId` 조회 → 토큰 수집 →
  `expoPushService.sendToTokens(tokens, { title, body, data })`.
- receipt에서 `DeviceNotRegistered` 토큰은 해당 pushTokens doc 무효화(삭제).
- 카피: `⚠️ {lineName} 지연` / `{stationName} 부근 약 {delayMinutes}분 지연{reason}`.

### 4.3 Firestore

- `pushTokens/{uid}`: `{ uid, token, platform, lines: string[], updatedAt }`.
- `pushDedup/{reportId}`: `{ sentAt }` (멱등 마커, TTL 정리 후속).
- **rules**: `pushTokens/{uid}` → `allow read, write: if request.auth.uid == uid` (서버 admin은 우회).
  `pushDedup` → 클라 접근 불가(서버 전용).

## 5. Data Flow

```
[등록]
 로그인 + 알림권한 granted
  → lines = dedup(출퇴근 경로 lineIds ∪ 즐겨찾기 역 lineIds)
  → pushTokenService.registerPushToken(uid, lines)
  → setDoc pushTokens/{uid} { token, platform, lines, updatedAt }
 commute/favorites 변경 → lines 재파생 → updateLines (반응형, usePushRegistration)
 로그아웃 → unregisterPushToken → delete doc

[발사]
 delayReports/{reportId} status → 'verified' (delayMinutes ≥ 5)
  → onDelayReportVerified (v2 onDocumentWritten)
  → 멱등: runTransaction(pushDedup/{reportId} 없으면 기록, 있으면 return)
  → query pushTokens where lines array-contains lineId → tokens[]
  → expoPushService.sendToTokens(tokens, message)  [100개 청크]
  → handleReceipts → DeviceNotRegistered 토큰 → pushTokens 무효화
```

## 6. Error Handling / Idempotency (functions/CLAUDE.md 준수)

- side-effect(푸시 발송) 트리거 → `pushDedup/{reportId}` 트랜잭션 멱등 가드(재검증·재실행 시 중복 0).
- 외부 호출(Expo Push API)은 트랜잭션 밖. 실패 시 구조적 로깅 후 graceful(throw 금지, null 반환).
- **민감정보(토큰) 로깅 금지** — 토큰 개수/lineId/reportId만 구조적 로깅.
- 토큰 0건 → no-op + 로그. Expo `DeviceNotRegistered` → 토큰 무효화(재등록은 다음 launch).
- 클라 권한 denied → 토큰 미발급(등록 skip). Expo Go/시뮬레이터 → 푸시 수신 불가(device-required).

## 7. Testing

- 클라: `pushTokenService`(권한 granted/denied, setDoc/merge/delete), `usePushRegistration`
  (lines 파생·dedup·로그아웃). Firebase/AsyncStorage mock.
- 서버: `onDelayReportVerified` 핸들러 로직 + `expoPushService`(청크·receipt·토큰형식) —
  `firebase-functions-test` + Firestore emulator. 멱등(같은 reportId 2회 → 1회 발사) 단위 검증.
- rules: `firebase emulators:exec --only firestore "npm run test:rules"` (pushTokens 본인-only,
  pushDedup 클라 차단).

## 8. Files

| 파일 | 변경 |
|------|------|
| `src/services/notification/pushTokenService.ts` | 신규(클라) |
| `src/hooks/usePushRegistration.ts` | 신규(클라) |
| `App.tsx` | `usePushRegistration()` 마운트 |
| `src/services/notification/index.ts` | export |
| `functions/src/services/expoPushService.ts` | 신규(서버) |
| `functions/src/triggers/notificationTriggers.ts` | `onDelayReportVerified` v2 어댑트 |
| `functions/package.json` | `expo-server-sdk` 추가 |
| `firestore.rules` / `firestore.indexes.json` | pushTokens/pushDedup rules + `lines` array-contains 인덱스 |
| 각 `__tests__` | 클라·서버 테스트 |

→ 9+ 파일(서버+클라 크로스). writing-plans에서 **클라 토큰 파이프라인 → 서버 전송 → 트리거 어댑트**
순으로 단계 분해. functions 작업은 DEPLOYMENT.md + functions/CLAUDE.md 게이트 준수.

## 9. Risks

- **Expo 토큰 발급은 dev/EAS 빌드 + 자격증명 필요** — Expo Push는 내부적으로 FCM(Android)/APNs(iOS)
  로 라우팅하므로 EAS에 FCM server key/APNs key 설정 필요. Expo Go/시뮬레이터 검증 불가
  (device-required). **EAS 빌드 실기기가 수용 기준**.
- **array-contains 인덱스** — `pushTokens.lines` 단일 array-contains는 자동 단일필드 인덱스로 충분
  하나, 추가 필터 결합 시 복합 인덱스 필요. 인덱스 배포 확인([[feedback_firestore_range_filter_needs_asc_index]] 교훈: 링크 클릭으로 생성, 방향·순서까지 비교).
- **v1→v2 마이그레이션** — 기존 v1 `onDelayReportVerified`를 v2로 바꾸면 함수 재배포 시
  delete+create. 배포 검증([[feedback_firebase_deploy_stale_worktree_update_not_delete]]: deleting/updating 구분, lib mtime 확인).
- **멱등 경합** — 동시 재검증 write 2건 → 트랜잭션으로 1회 보장. pushDedup TTL 정리 후속.
- **B-(가) 중복** — 서버 `sendCommuteReminders`는 비활성 유지(클라 로컬이 소유). 인덱스/배포 시
  실수로 재활성 금지.
- **공유 워킹트리 병렬 세션** — 매 커밋 브랜치 가드, 명시 파일만 stage.

## 10. Success Criteria

- [ ] 로그인+권한 → `pushTokens/{uid}`에 Expo 토큰+lines 저장, 로그아웃 시 삭제.
- [ ] commute/favorites 변경 → lines 갱신.
- [ ] delayReport verified(≥5분) → 해당 lineId 구독 토큰에만 푸시, reportId 멱등(2회=1발사).
- [ ] `DeviceNotRegistered` 토큰 무효화.
- [ ] 클라/서버 tsc·lint·jest·emulator rules 통과.
- [ ] (수용) EAS 빌드 실기기에서 앱 종료 상태로 지연 푸시 수신 확인.
