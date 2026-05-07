# LiveMetro Firebase Functions Rules

Node 20 + TypeScript strict + Firebase Cloud Functions 2nd gen 기준.

## 핸들러 패턴
- Callable: `onCall<RequestData, ResponseData>` 제네릭으로 타입 안정성 확보
- HTTP: `onRequest`는 외부 webhook 전용 (Seoul API, 서드파티 푸시)
- Scheduled: `onSchedule("every 5 minutes", { timeZone: "Asia/Seoul" })` — KST 명시
- Firestore trigger: `onDocumentWritten` 같은 v2 API 사용, v1 `functions.firestore.document()`는 신규 코드에서 금지

## Firestore Transaction & Idempotency
- 결제/구독/알림 발송처럼 사이드 이펙트가 있는 작업은 `firestore.runTransaction` 필수
- 외부 API 호출이 섞이면 transaction 안에 넣지 말고, **idempotency key**(`requestId` 또는 `jobId`)를 별도 컬렉션에 기록해 중복 처리 방어
- onSchedule + 외부 API 조합은 항상 멱등성 가드 (재실행 시 부작용 없음)

## async/await + 에러
- 모든 핸들러 본문은 `async`. sync 호출로 이벤트 루프 차단 금지
- `try/catch` → 사용자 메시지는 `HttpsError("invalid-argument" | "permission-denied" | ...)`로 매핑
- catch 블록에서 민감 정보(토큰, 이메일, Firestore document body) 로깅 금지
- 알 수 없는 에러는 `internal` 코드로 마스킹, 원본은 Pino logger로만 기록

## 로깅
- `pino` 또는 `firebase-functions/logger` 통일 (혼용 금지)
- Structured logging: `logger.info({ uid, action: "subscribe", lineId }, "msg")`
- 외부 API 응답을 그대로 로깅하지 말 것 (PII 위험)

## 환경변수 & 시크릿
- 비밀키: `defineSecret("STRIPE_KEY")` (Functions v2) — `functions.config()`는 deprecated
- 환경별 설정: `.env.<project-id>` 파일 + `firebase functions:config:get`
- 하드코딩 금지: `.env.example`을 SSOT로 유지하고 PR마다 동기화 확인

## Seoul API 호출 (`subway-data-processor` 스킬과 연계)
- 폴링 주기 ≥ 30초 (`.claude/rules/seoul-api-limits.md` 강제)
- 응답 캐시는 Firestore 또는 메모리 LRU
- Rate-limit 응답(429) 발생 시 exponential backoff (최대 5분)

## 테스트
- `firebase-functions-test` + emulator로 통합 테스트
- Unit: 핸들러 로직 함수만 분리해 jest로 검증
- 커버리지 임계값은 `.claude/rules/coverage-thresholds.md` 정책 따름
- Firestore rules 변경은 `firebase emulators:exec --only firestore "npm run test:rules"` 강제

## 배포 전 게이트
1. `cd functions && tsc --noEmit`
2. `eslint . --max-warnings 0`
3. `jest --coverage`
4. `firebase emulators:exec --only firestore,auth "npm run test:integration"`
5. 에러 0 + emulator pass 확인 → `firebase deploy --only functions`
