# QA REPORT r3 — #379 FIX2 독립 검증 (HEAD 5084a54, 코드 a5dd5df, base 913943b)

판정: **조건부 PASS** — r2 P2 2건(G1 접힌 caret 덮어쓰기, 같은 숫자 재입력 칸 비움)은 FIX2 테스트가 G 표 전 행을 고정하고, 뮤턴트 7종 중 6종이 검출됐다. 새 결함(P1/P2)은 찾지 못했다. 남은 조건은 실기기 확인(아래 4절 "머지 전 필수" 2건)과 P3 2건(resend 초기화 테스트 공백, 네이티브 재선택이 무시될 때 기록과 OS 선택이 어긋날 수 있는 이론적 경로)이다.

## 수용 기준 표
| # | 기준 | 결과 | 증거 |
|---|---|---|---|
| 1a | G 표 전 행(G1 98/5/38/33/3, G2 3/5/8/33/38, G3 4행, G4)이 테스트로 고정 | PASS | `SignupStep1Screen.test.tsx` "event-order independent OTP edits" describe: G1 it.each 5행 + 같은 숫자 재입력 1건, G2 it.each 5행, G3 it.each 4행, G4 1건. 기대값이 r2 3절 "기대" 열과 일치(정적 대조) |
| 1b | 뮤턴트 3종 이상 검출 | PASS(6/7) | 아래 1절 |
| 1c | 원복 증명 | PASS | sha256 동일, 사본 삭제, `git status --short` 빈 출력 (아래) |
| 2a | iOS 플래그 잔존 | 위험 낮음(P3 아님, 관찰) | 2절 |
| 2b | Android 순서 변형 | 위험 낮음 / P3 1건 | 2절 |
| 2c | 재선택 setSelection 에코 | 무해 | 2절, RN 소스 |
| 3 | 회귀 9 시나리오 + 숫자+비숫자 | PASS(9/9, 1건은 내 테스트 작성 오류로 재해석) | 3절 |
| 4 | 실기기 체크리스트 최종본 | 작성 | 4절 |

## 1 뮤턴트 (사본 `dev/active/qa-379-r3/mut/w` — worktree 안 git-ignored(`.gitignore:160 dev/active/`), node_modules 심링크)
명령: `cd dev/active/qa-379-r3/mut/w && npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx src/screens/auth/__tests__/otpInput.test.ts --watchman=false --no-cache --maxWorkers=2`
| 뮤턴트 | 결과 |
|---|---|
| CTRL 무변경 사본 | 2 suites passed, **67/67 passed** |
| M1 재선택 분기 제거(`if (false && reselect …)`) | **6 failed** |
| M2 1회 한정 제거(선택 이벤트에서 플래그 소비 안 함) | **2 failed** |
| M3 `next === prev` 분기 제거 | **4 failed** |
| M4 onBlur 플래그 해제 제거 | **1 failed** |
| M5 onFocus 플래그 설정 제거 | **6 failed** |
| M6 resend 시 선택 기록·플래그 초기화 제거 | **0 failed (생존)** — P3 테스트 공백(FIX2 REPORT가 이미 자인한 항목과 동일) |
| M7 재선택 시 네이티브 `setSelection` 호출 제거(기록만 유지) | **6 failed** |

원복: 각 뮤턴트 후 원문 재기록. 사본 `rm -rf dev/active/qa-379-r3/mut` 후 디렉터리에는 BRIEF.md·REPORT.md만 남음, `git status --short` 빈 출력(커밋 전 실측), worktree sha256 삭제 후에도 동일. sha256 worktree = 사본 — `SignupStep1Screen.tsx cba3af17…d85a`, `otpInput.ts 0d1d9a59…e133`. 사본 삭제 후 `git status --short` 결과는 아래 "검증" 줄.

## 2 FIX2가 만든 새 위험 (RN 0.83.10 소스, 근거 L2)
소스 사실:
- Android JS `setSelection` → `TextInput.js:479-488` `setTextAndSelection(ref, mostRecentEventCount, null, s, e)` → `ReactTextInputManager.kt:173-187` → `ReactEditText.kt:444-449` `canUpdateWithEventCount(eventCounter)`(=`eventCounter >= nativeEventCount`, L654)가 거짓이면 **무시**, 아니면 L452-461에서 텍스트 길이로 **clamp** 후 `setSelection` → `onSelectionChanged`(L476-484, `hasFocus()`일 때) → `ReactTextSelectionWatcher`가 직전과 다를 때만 이벤트 발송. 즉 Android는 JS 선택도 onSelectionChange로 **돌아온다**(비동기, 이벤트 큐). 텍스트 변경마다 nativeEventCount 증가(`ReactTextInputTextWatcher.kt:54,65`).
- Android 포커스: `ReactEditText.kt:487-492` `super.onFocusChanged`(selectAllOnFocus 적용 + focus 리스너) 후 현재 선택 재발송 → 선택 (0,len)이 onFocus보다 **먼저** 올 가능성이 높음(프레임워크 추론, 불확실성 Medium).
- iOS Fabric: `RCTTextInputComponentView.mm:562-592` 이벤트 카운트 불일치 시 무시, `_comingFromJS` + `notifyDelegate:NO`로 JS 선택은 onSelectionChange **안 냄**(L500-504).

| 항목 | 분석·실측(임시 jest) | 사용자 영향 등급 |
|---|---|---|
| (a) iOS 플래그 잔존: 탭 caret 이벤트가 안 오면 첫 사용자 커서 이동이 전체 선택으로 바뀜 | 코드상 그대로 발생(재선택 1회). 그러나 칸은 1자리라 "커서 끝/앞에 넣기"와 "교체"의 분배 결과가 같다(삽입 문자열이 기존 숫자를 항상 버림: `extractInsertedDigits`). 영향은 사용자가 옮긴 커서가 한 번 전체 선택 하이라이트로 돌아가는 시각적 차이뿐 | 낮음(관찰) |
| (b) Android 순서 변형: (0,1)이 onFocus보다 먼저 와 플래그가 남고, 첫 이벤트가 변경 후 접힌 선택 | 실측 N-b: (0,1)→focus→(1,1)→"5" = 125456, (2,2)→"38" = 123856(정상). 이때 네이티브 `setSelection`은 텍스트 변경 후라 event count 가드로 무시되거나(무해) clamp되어 새 숫자를 선택(포커스가 다음 칸으로 이동하므로 무해, 마지막 칸이면 다음 입력이 교체 — 원하는 동작). **잔여 P3**: 변경 전 실제 선택이 접힌 커서였는데 첫 이벤트가 변경 후 접힌 선택이면 기록은 (0,len)으로 강제되어 OS 상태와 어긋난다. 예) 칸 "3", 커서 끝에서 "8" 입력 → "38" → 123856(의도 128456). 이 경로는 "포커스 후 선택 이벤트 없이 접힌 커서 상태"가 필요한데 Android는 selectAllOnFocus로 포커스 시 (0,len)이 되므로 발생 가능성 낮음 | 낮음(P3) |
| (c) 재선택 setSelection 에코 | Android: 에코 (0,1)은 플래그 소비 후 도착 → 그냥 (0,1) 기록 = 재선택 기록과 동일. 실측 N-c: 에코가 붙여넣기 전 "38"→123856, "33"→123356 / N-c2: 에코가 onChangeText 뒤 늦게 와도 123856 유지, 이후 다른 칸 입력 123896 정상. 에코는 접히지 않은 선택이라 재선택 루프 없음. iOS: 에코 없음 | 무해 |

## 3 회귀 (임시 jest `mut/w/src/screens/auth/__tests__/qa379r3.test.tsx`, 삭제됨)
명령: `npx jest src/screens/auth/__tests__/qa379r3.test.tsx --watchman=false --maxWorkers=2` → 12 passed / 2 failed(둘 다 내 테스트 모델링 오류, 아래)
| r2 시나리오 | 관측 | 판정 |
|---|---|---|
| R1 빈 6칸 순차 타이핑(focus·(0,0)·1자리) | 123456, `confirmPhoneCode('vid-123','123456')` | OK |
| R2 채워진 칸 덮어쓰기 선택 없음 "4"칸 "47" | 123756 | OK. 두 번째 단언은 내가 새 화면의 "4"칸에 "87"을 넣어(r2는 "7"칸) 123876 — 기존 숫자를 포함하지 않는 값의 교체 추정으로 정상 |
| R3 삭제 "" + Backspace keyPress | 123_56, 예외 없음 | OK |
| R4 SMS 6자리 빈 첫 칸 | 987654 | OK |
| R5 SMS 6자리 채워진 칸 (0,1) | 111111 | OK |
| R6 7자리 없음/(1,1)/(0,0) | 222222/333333/444444 | OK |
| R7 비숫자 "12-34" 빈 첫 칸 | 1234__ | OK |
| R8 "9 8" (0,1) 교체 | 198456 | OK |
| R9 재요청 후 입력 | testID로 재전송 버튼을 찾지 못해 미실행(N-d) — r2 실측 OK, FIX2는 초기화만 추가. M6 생존과 함께 P3 | 미검증 |
| 숫자+비숫자 "3a"(칸 "3", focus→caret (1,1)) | 123456 유지 + 다음 칸 포커스(base 913943b와 같은 동작. r2 코드는 칸을 비웠음) | 개선. number-pad(iOS)에서는 비숫자 입력 불가, Android number-pad·붙여넣기에서만 발생 → 영향 낮음 |
| N-a(위험 a 시뮬레이션) | 125356: 내 모델링 오류 — 재선택이 적용되면 OS가 교체하므로 "5"가 와야 하는데 caret 앞 입력값 "53"을 넣었다. 다만 이 값은 "재선택이 네이티브에서 무시되고 OS 커서는 앞인 채"일 때의 결과이기도 해서 2(b) P3 잔여 경로의 실측 근거로 쓴다 | 2(b)로 이관 |

## 결함
### [P3] resend 초기화(선택 기록·재선택 플래그)를 고정하는 테스트 없음
재현: 1) M6 뮤턴트(재요청 핸들러의 초기화 2줄 제거) 2) 위 jest 명령. 기대: 1건 이상 실패. 실제: 67/67 통과. 영향: 초기화가 회귀해도 못 잡음(value 가드로 현재 실해는 낮음). 증거: 1절 표.
### [P3] 네이티브 재선택이 무시될 때 기록 (0,len)과 OS 커서가 어긋날 수 있음
재현(jest 모델): 1) 칸 123456 2) 칸3 focus(플래그 설정) 3) 변경 전 OS 상태가 커서인 채로 첫 선택 이벤트가 변경 후 접힌 선택 4) onChangeText "38"(커서 끝 "8") → 123856. 기대 128456. 위치 `SignupStep1Screen.tsx` handleOtpSelectionChange 재선택 분기 + `ReactEditText.kt:445` event count 가드. 영향: Android selectAllOnFocus가 포커스 시 전체 선택을 만들기 때문에 실제 발생 조건이 좁음(불확실성 Medium). 실기기 4절 A3로 관찰.

## 4 실기기 체크리스트 (최종본)
머지 전 필수:
- I1 iOS: 칸 123456 → 칸3 탭 → 클립보드 "38" 붙여넣기 → 관측 칸 값 → 기대 123856(재선택으로 "3"이 하이라이트된 상태여야 함).
- A1 Android(삼성/픽셀): 칸 123456 → 칸3 탭(전체 선택 하이라이트 확인) → "3" 입력 → 기대 칸 3 유지 + 칸4로 포커스 이동. 이어서 칸3 다시 탭 → "38" 붙여넣기 → 기대 123856.
머지 후 관찰:
- I2 iOS: 칸3 탭 후 "3" 타이핑 → 칸 유지·다음 칸 이동. "98" → 129856, "98765" → 129876.
- I3 iOS: 칸3 탭 → 커서를 끝으로 한 번 옮김 → 하이라이트가 전체 선택으로 돌아가는지(위험 a, 시각만) → "8" 입력 → 128456.
- A2 Android: 칸3 탭 → 커서를 끝으로 옮김 → "8" 입력 → 기대 128456(재선택 1회 후 에코로 기록 꼬임 없음).
- A3 Android: Backspace로 이전 칸 이동(JS focus) 후 그 칸에 "5" 입력 → 기대 그 칸만 5(위험 b/P3 경로).
- S1 iOS·Android SMS 자동완성: 빈 첫 칸 / 채워진 칸 포커스에서 "메시지에서" 제안 → 6칸 채움·인증 성공.
- R1 iOS·Android 재요청: 타이머 만료 → 재전송 → 칸2 "5" → __5___.

## 사용 스킬
- 없음 — 15분 예산상 브리프 지정 검사(정적·jest·뮤턴트)만 수행. mobile-service-qa: 실기기 미실행이라 미로드. principle-prove-it-works: 미로드(각 PASS에 명령·관측값 첨부로 갈음).
- 서브에이전트: Explore 1개(읽기 전용) — 2(c) RN 0.83.10 Android/iOS setSelection→onSelectionChange 경로. 결론: Android 조건부 발송(비동기, event count·focus·중복 가드), iOS 미발송. 메인이 `ReactEditText.kt:440-495`, `ReactTextInputManager.kt:165-190`를 직접 재확인.

## 미검증
- 실기기 iOS/Android 이벤트 순서(4절 전부) — 기기·Metro 미가동, 브리프 범위 밖.
- 재요청 후 입력(R9) — 임시 테스트에서 재전송 버튼 testID 미확인으로 미실행.
- 전체 jest·tsc·eslint — 브리프 지시로 Jarvis 담당.

검증: 위 jest 명령(CTRL 67/67, 뮤턴트 7종 결과 표), 임시 회귀 jest 12 passed/2 failed(모델링 오류 해석 포함), RN 소스 grep/sed. 실기기·전체 게이트는 미실행.
위험·영향 범위: 이 보고서는 문서 1개만 추가(코드 무변경). 판정이 틀리면 가입 OTP 입력에서 붙여넣기 오분배가 남아 인증 실패로 이어진다.
되돌리는 법: 이 REPORT 커밋을 `git revert <SHA>`.
