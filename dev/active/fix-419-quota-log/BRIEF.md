등급: S (실행 tier M) · 예상 위험 등급: 중 (훅 로직·사용자 안내 문구)
# BRIEF — #419 쿼터 소진 중 useRealtimeTrains 오류 로그 반복

## 목적
서울 API 일일 쿼터가 모두 소진된 상태(ERROR-337, 모든 키 비활성)에서 `src/hooks/useRealtimeTrains.ts`가 30초 폴링 틱마다
`console.error('Realtime trains error:', ...)`와 "최대 재시도 횟수(3)에 도달했습니다"를 반복 기록하는 문제를 고친다.

## Jarvis가 이미 확인한 것 (다시 조사하지 말 것)
- 네트워크 호출은 이미 0: `seoulSubwayApi.assertDailyQuotaAvailable()`가 fetch 전에
  `SeoulApiError(ERROR-337, ..., { retryable:false, dailyQuotaExhausted:true })`를 throw한다.
- `dataManager.subscribeToRealtimeUpdates` 콜백은 `(data, error?)`로 error를 넘기지만(throwOnError:true),
  훅의 `handleDataReceived`는 `data`만 받아서 error를 버린다 → 매 틱 null → retryCount 계속 증가 → 매 틱 handleError.

## 범위 (Jarvis 결정 ★)
1. 훅이 콜백의 `error` 인자를 받는다. 쿼터 소진(SeoulApiError + dailyQuotaExhausted 또는 동등 판정 — 실제 필드명은 소스에서 확인)이면
   재시도 카운트와 별개로 즉시 "쿼터 소진" 상태로 전환한다. 사용자 문구는 일반 오류와 구분한다
   (예: "오늘 실시간 조회 한도를 모두 사용했어요. 자정 이후 다시 시도됩니다" — 기존 문구 톤에 맞춰 조정 가능).
   훅의 반환 타입에 구분 가능한 값(예: `errorKind: 'quota' | 'generic' | null` 등)을 추가하되 기존 필드·호출부 계약은 깨지 않는다.
2. 같은 오류 상태가 이어지는 동안에는 `console.error`/`console.warn`를 1회만 남긴다(상태가 바뀌거나 데이터 수신 후 다시 실패하면 재기록).
   쿼터 소진은 error가 아니라 warn 1회 수준으로 기록한다. `onError` 콜백도 같은 상태에서 매 틱 반복 호출되지 않게 한다.
3. 폴링 자체 중단(자정까지 정지)은 이번 범위 아님 — arrivalService 정책 변경이므로 REPORT에 후속 제안만 적는다.
4. 화면 쪽: 훅의 `error`를 표시하는 consumer가 쿼터 문구를 그대로 보여주면 추가 수정 없음. consumer 변경이 필요하면 1~2파일 이내로만, 아니면 REPORT에 후속으로.

## 수용 기준
- TDD: 먼저 실패하는 테스트를 `src/hooks/__tests__/` 의 useRealtimeTrains 테스트에 추가(RED 확인 기록) 후 구현.
  - 쿼터 소진 error가 N틱(≥5) 연속 와도 console 오류/경고 기록 1회, onError 1회, 상태는 쿼터 소진 구분값.
  - 일반 실패(null, error 없음)의 기존 재시도 동작(1/3, 2/3, 최대 도달)은 유지.
  - 쿼터 소진 후 정상 데이터 수신 시 상태·로그 dedupe가 초기화.
- 기존 테스트 전부 유지. 기존 테스트 기대값을 바꿨다면 이유를 REPORT에 파일별로 적는다.
- 프로젝트 규칙 준수: `.claude/rules/`(typescript-strict, path-aliases `@/`, subscription-cleanup, error-handling, seoul-api-limits).

## 검증 명령 (전부 실행하고 EXIT 코드 기록)
- 첫 단계: worktree에 node_modules가 없으므로 `npm ci --no-audit --no-fund; echo EXIT=$?` (실패 시 BLOCKED 보고)
- `npm run type-check; echo EXIT=$?`
- `npx eslint src/hooks; echo EXIT=$?`
- `npx jest src/hooks src/services/data src/screens --silent; echo EXIT=$?` 후 마지막에 전체 `npx jest --silent; echo EXIT=$?`
  (전체 jest는 한 번에 하나만 실행. 출력은 `dev/active/fix-419-quota-log/logs/`에 저장. /tmp 사용 금지)

## 금지
- push·PR·원격 쓰기 금지. 테스트 skip·timeout 상향·assertion 완화 금지. `src/services/api/*` 키 관리 정책 변경 금지.
- 의존성 추가 금지.

## 산출
- 로컬 커밋(Conventional Commits, `fix(hooks): ... (#419)`), `dev/active/fix-419-quota-log/REPORT.md`는 `git add -f`로 함께 커밋.
- REPORT: 변경 파일, RED→GREEN 근거, 검증 EXIT, `검증 / 위험·영향 범위 / 되돌리는 법` 3칸, 후속 제안, `사용 스킬:` 줄.
- REPORT 초안을 먼저 쓰고 끝에 갱신. 래퍼가 실제 시간 한도를 강제하니 조기 종료하지 말 것.

서브에이전트 분할: 불필요(훅 1파일 + 테스트 1파일, 결합도 높음)

## 원 이슈 본문
<pasted_content id="q4r9">
서울 API 쿼터 소진(ERROR-337) 중 useRealtimeTrains가 30초마다 오류 로그 반복
2026-10-31 Galaxy SM-N971N 실기기 QA에서 src/hooks/useRealtimeTrains.ts:88 의 console.error('Realtime trains error:', error)가
985줄(30초마다 5줄) 반복. 선행 로그: [SeoulSubwayApi] Realtime arrival error ... code=ERROR-337 category=quota /
Rate limit hit on ERROR-337, no healthy backup key — not retrying.
확인할 점: 1) 소진 상태에서 실제 HTTP 호출 0인지 2) 쿼터 소진을 상태로 다뤄 1회만 로그하거나 자정 리셋까지 폴링 중단
3) UI가 쿼터 소진과 일반 오류를 구분해 안내하는지(seoul-api-limits: 에러와 빈 데이터 구분)
</pasted_content id="q4r9">
