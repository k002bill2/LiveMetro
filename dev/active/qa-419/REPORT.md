# QA REPORT — #419 useRealtimeTrains 쿼터 소진 로그 dedupe 독립 검증

대상: 브랜치 `fix/419-quota-log`, 커밋 `472a256` (base `b8eb5ea`) · 검증자: QA 레인 (구현자와 독립)

## 판정: 조건부 PASS
수용 기준 3개는 모두 행동 단언 테스트로 고정되어 있고 재실행으로 확인했습니다. 다만 경계 사례에서 Low 결함 2건(아래 D1·D2)이 나왔습니다. 현재 소비자 6곳 중 영향받는 곳은 없어 머지를 막지는 않지만, 기록해 둡니다.

## 체크리스트
- [x] 1 수용 기준 대조
- [x] 2 회귀 (기존 테스트 기대값 diff)
- [x] 3 경계 사례 (임시 테스트 5건, 실행 후 삭제)
- [x] 4 소비자 영향 (6곳)
- [x] 5 프로젝트 규칙

## 1. 수용 기준 대조
| 수용 기준 | 결과 | 근거 |
|---|---|---|
| 쿼터 error N≥5틱 → 로그 1회·onError 1회·구분값 | PASS | `useRealtimeTrains.test.ts` "logs one warning and calls onError once across repeated quota ticks": 6틱, warn 1·error 0·onError 1·errorKind 'quota'·isRetrying false. 공개 반환값과 console/onError 관측만 단언 → 행동 테스트 |
| 일반 실패(null, error 없음) 1/3→2/3→최대 유지 | PASS | "keeps the generic retry sequence…" 및 기존 Retry Logic 테스트(기대값 변경 없음) |
| 쿼터 후 정상 데이터 → 상태·dedupe 초기화 | PASS | "resets state and log dedupe after data arrives": 쿼터→데이터→쿼터 시 warn 2·onError 2, error/errorKind null |
| 기존 테스트 전부 유지 | PASS | `git diff b8eb5ea..472a256 -- '*.test.*'`의 삭제 줄은 `dataCallback` 타입 선언 1줄(`error?: unknown` 인자 추가)뿐. 기대값 변경 0 |

재실행: `npx jest src/hooks/__tests__/useRealtimeTrains.test.ts --watchman=false --coverage=false --forceExit` → `Tests: 33 passed, 33 total` (구현 REPORT의 37 = integration 테스트 4건 포함 패턴 결과. 전체 jest는 브리프 지시대로 재실행하지 않음)

## 2. 회귀
- 일반 재시도 문구 `데이터 로드 실패, 재시도 중... (n/N)`·`최대 재시도 횟수(N)에 도달했습니다.`는 base와 동일 (diff 확인, 임시 테스트 E2 g1~g4 관측).
- `isRetrying` 계산식(`retryCount>0 && <retryAttempts`)은 미변경. 일반 경로 값은 base와 같음(E2: g1·g2 true, g3 false).
- 의도된 동작 변경: 최대 재시도 도달 후 매 틱 찍히던 `console.error`·`onError`가 1회로 줄어듦 (브리프 범위 2에 해당).

## 3. 경계 사례 (임시 테스트 `dev/active/qa-419/qa419.edge.test.ts`, 실행 후 삭제)
명령: `npx jest dev/active/qa-419/qa419.edge.test.ts --watchman=false --testMatch '**/dev/active/qa-419/*.test.ts' --testPathIgnorePatterns /node_modules/ --coverage=false --forceExit` → 5 passed (관측 기록용)

| 사례 | 관측 | 판정 |
|---|---|---|
| E1 캐시 data(비null)+쿼터 error | trains 1건 표시, error null, errorKind null, warn 0 → 데이터 우선 | 정상. 참고: 실제로는 `throwOnError:true`라 `pollAndNotify`가 오류 때 `callback(null, error)`로 보내므로 이 조합은 실경로에서 드묾 |
| E2 쿼터→일반→쿼터 | q1 warn1·onError1 / q2 변화 없음 / g1·g2 로그 없음(base와 같음) / g3 최대 도달 error1·onError2 / g4 변화 없음 / q3 warn2·onError3 / q4 변화 없음 | 상태 전환마다 1회 → 정상 |
| E2b 일반 1/3 이후 쿼터 | errorKind 'quota'인데 **isRetrying true** | **결함 D1** |
| E3 refetch / enabled 토글 / stationName 변경 후 같은 쿼터 오류 | 세 경우 모두 state는 'quota'로 다시 바뀌지만 warn·onError는 **다시 안 남음** (w1·o1 유지) | refetch·토글: 구현 REPORT 후속 4에 적힌 의도(포그라운드 복귀마다 재기록 방지)와 일치 → 정상. stationName 변경: **결함 D2(Low)** |
| E4 언마운트 후 콜백 도착 | console.error 0(React 경고 없음), 쿼터 warn 1건 기록 | 누수·경고 없음. 실경로는 `arrivalService.notifyIfActive`가 해제된 콜백을 걸러 도달하지 않음 → 문제 아님 |

## 결함
### [Low] D1 일반 실패 뒤 쿼터로 바뀌면 isRetrying이 true로 남음
- 위치: `src/hooks/useRealtimeTrains.ts:155-157`(쿼터 분기가 `retryCountRef`를 그대로 둠), `:262`(isRetrying 계산)
- 재현: 1) `renderHook(() => useRealtimeTrains('강남', { retryAttempts: 3 }))` 2) 콜백에 `(null)` 1회 3) 콜백에 `(null, { dailyQuotaExhausted: true })` 4) `result.current` 확인
- 관측: `errorKind: 'quota'`, `isRetrying: true`
- 기대: 쿼터는 재시도 대상이 아니므로 `isRetrying: false` (구현 주석 "leave retryCount alone so isRetrying stays false"의 의도와 어긋남. 수용 테스트는 깨끗한 시작 상태에서만 확인)
- 영향: 현재 `src` 안 소비자 중 `isRetrying`을 읽는 곳 없음(`rg isRetrying src --glob '!src/hooks/**'` → HomeScreen 테스트 mock 1건뿐). 실제 순서(일시 오류 몇 번 → 337 소진)는 흔함
### [Low] D2 stationName이 바뀌어도 같은 쿼터 오류는 로그·onError를 다시 남기지 않음
- 위치: `src/hooks/useRealtimeTrains.ts:118-120`(`reportedErrorKeyRef`는 데이터 수신 때만 초기화)
- 재현: 1) '강남'으로 렌더 후 쿼터 오류 1틱 2) `rerender`로 '역삼' 변경 3) 새 구독 콜백에 쿼터 오류 1틱
- 관측: state는 'quota'로 바뀌지만 warn 1·onError 1 그대로
- 기대: 판단 필요. 쿼터는 전역 상태라 다시 기록하지 않는 편이 맞을 수도 있음. 다만 일반 오류 키(`generic:최대 재시도…`)도 역 사이에 공유되어, 역 A에서 최대 도달 후 역 B에서도 최대 도달하면 B의 `console.error`·`onError`가 빠짐
- 영향: 현재 소비자 모두 `onError` 미사용. 화면 문구는 state로 정상 표시. 로그 진단 정보만 줄어듦

## 4. 소비자 영향 (6곳)
| 소비자 | 사용 필드 | 쿼터 시 사용자 흐름 |
|---|---|---|
| `StationDetailScreen.tsx:186-525` | error, refetch | 오류 패널에 쿼터 문구 그대로 표시 + "다시 시도" 버튼 노출 (누르면 차단된 호출만 반복) |
| `TrainSelectionScreen.tsx:97-262` | error, refetch | 위와 같음 |
| `StationNavigatorScreen.tsx:41-193` | error, refetch | 전체 오류 화면 제목으로 쿼터 문구 표시 |
| `HomeFavoriteRow.tsx:36,93` | error | `connectionLost`("연결 안 됨")로만 표시 — 쿼터와 구분 안 됨 |
| `DraggableFavoriteItem.tsx:132,321` | error | 위와 같음 |
| `RouteGuidanceScreen.tsx:312` | trains만 | 영향 없음 |
- `onError`·`isRetrying`·`errorKind` 사용 소비자 0곳 → onError dedupe는 현재 사용자 흐름을 바꾸지 않음.
- 결함 아님(브리프 범위 4: 문구 그대로 표시면 추가 수정 없음). 후속 제안 F1·F2로 분리.

## 5. 프로젝트 규칙
- typescript-strict: 새 코드에 `any` 없음. `isDailyQuotaExhausted`의 `as { dailyQuotaExhausted?: unknown }` 1건은 `unknown` 좁히기용 최소 단언 — 허용 범위. exported 훅에 명시적 반환 타입 없음은 base부터 있던 것(이번 diff가 만든 위반 아님). 새 export `RealtimeTrainsErrorKind`·`DAILY_QUOTA_ERROR_MESSAGE`는 타입/상수.
- error-handling: throw 추가 없음. 기술 오류 문자열(ERROR-337) 대신 친화 문구 노출 → 준수.
- seoul-api-limits: 폴링 간격·타임아웃·키 정책 미변경. "에러와 빈 데이터 구분"은 errorKind로 개선. 위반 없음.
- path-aliases: 훅의 상대 import 2줄(`../services/data/dataManager`, `../models/train`)은 base부터 있던 것, diff 미변경. 테스트에 추가된 import는 `@services/...` alias 사용.
- subscription-cleanup: 새 타이머·구독 없음. E4에서 언마운트 후 경고 없음.

## 후속 제안 (결함 아님)
- F1 `errorKind === 'quota'`이면 StationDetail·TrainSelection에서 "다시 시도" 버튼 숨김 (구현 REPORT 후속 2와 같음).
- F2 즐겨찾기 행(HomeFavoriteRow·DraggableFavoriteItem)에서 쿼터를 "연결 안 됨"과 구분 표기할지 결정.
- F3 D1 수정 시: 쿼터 분기에서 `retryCountRef.current = 0` 또는 isRetrying 계산에 `errorKind !== 'quota'` 조건 + 회귀 테스트(일반 1회 → 쿼터) 추가.
- F4 자정까지 폴링 정지 (구현 REPORT 후속 1, arrivalService 정책).

사용 스킬: 없음 — 브리프가 단일 훅 코드·테스트 검증으로 한정. 화면·기기·보안 검사가 없어 QA 라우팅 표의 스킬 해당 없음. 원칙(테스트는 내부 구현이 아닌 행동을 단언해야 함)은 1번 판정에 적용.
미검증: 실기기(실제 337 소진 상태) 화면 확인, 전체 jest·type-check·eslint(Jarvis 게이트 보유, 브리프 지시로 재실행 안 함).

검증: `npx jest src/hooks/__tests__/useRealtimeTrains.test.ts …` 33/33 PASS, 임시 경계 테스트 5건 실행·관측 후 삭제, `git diff b8eb5ea..472a256` 검토. 실기기·전체 스위트는 실행하지 않음.
위험·영향 범위: 해당 없음 — QA 증거만 추가 (코드 미변경)
되돌리는 법: 해당 없음 — QA 증거만 추가 (이 REPORT 커밋은 `git revert <QA 커밋 SHA>`로 제거 가능)
