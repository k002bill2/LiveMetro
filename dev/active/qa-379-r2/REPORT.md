# QA REPORT r2 — #379 선택 상태 기반 OTP 분배 (HEAD 43ffe2f, base 913943b)

판정: **조건부 PASS** — 이전 FAIL 3건은 테스트된 이벤트 순서에서 해소됐고(뮤턴트 5종 전부 검출), 핵심 가입 흐름 회귀는 없다(임시 jest). 남은 조건: "변경 전 선택 기록 뒤에 커서 접힘 선택 (n,n)이 한 번 더 기록되는" 순서에서는 기존 숫자로 시작/끝나는 붙여넣기("38"·"83"·"33")가 여전히 오분배되고, 같은 숫자 재입력("3" 위에 "3")은 칸을 비운다(신규, P2 2건). 이 순서가 실제로 발생하는지는 소스로 확정하지 못해서 실기기 G1·G2 확인을 머지 조건으로 둔다.

## 수용 기준 표
| # | 기준 | 결과 | 증거 |
|---|---|---|---|
| 1a | [P1] iOS 탭 경로: onFocus에서 setSelection + 기록 | PASS(jest·정적) / 실기기 미확인 | `SignupStep1Screen.tsx:222-232`. 기존 테스트 "selects the existing digit on focus" 통과. 뮤턴트 M3(기록 제거) → 1 failed |
| 1b | [P1] 38/83/33 오분배 | PASS(선택이 깨끗할 때) / **조건부**(G1·G2) | 기존 it.each 13건 통과. 아래 G1 표에서 caret 이벤트가 뒤에 오면 38→128456 재발 |
| 1c | [P2] 테스트가 동작을 고정하는가 | **PASS** | 아래 뮤턴트 표: base 화면 코드로 돌리면 7 failed, 뮤턴트 4종 모두 1~13 failed. 대조군(무변경 사본) 89/89 passed |
| 2 | 핵심 가입 흐름 회귀 | PASS | 아래 회귀 표 (임시 jest 9/9 passed) |
| 3 | 가드 논리 조합 | 결함 2건(P2, 실기기 조건부) | 아래 G 표 |
| 4 | cleanup·타입·alias | PASS | 아래 4절 |
| 5 | 실기기 필요 항목 | 목록 작성 | 아래 5절 |

## 1c 뮤턴트 (사본 `~/.hermes/profiles/jarvis/cache/scratch/qa-mut-379r2`, `npx jest src/screens/auth/__tests__ --watchman=false --no-cache --maxWorkers=2`)
| 뮤턴트 | 결과 |
|---|---|
| CTRL 무변경 사본 | 7 suites passed, 89/89 passed |
| M0 `SignupStep1Screen.tsx`를 913943b 버전으로 교체(휴리스틱 부활) | 1 suite failed, **7 failed** |
| M1 `extractInsertedDigits`가 `next`를 그대로 반환 | 2 suites failed, **13 failed** |
| M2 `isConsistentSelection` 항상 true | **2 failed** |
| M3 `handleOtpFocus`의 recordOtpSelection 제거 | **1 failed** |
| M4 직전 선택(earlier) 무시 — `[sel].find` | **2 failed** |
원복 증명: 사본 삭제(`ls` → No such file). 워크트리 sha256 전후 동일 — otpInput.ts `1620a448…64fd`, SignupStep1Screen.tsx `2fd19bb3…3d11`. `git status --short` 빈 출력.

## 2 회귀 (임시 jest, 셀 값 `_`=빈 칸)
| 시나리오 | 관측 | 판정 |
|---|---|---|
| 빈 6칸 순차 타이핑(칸마다 (0,0) 선택 후 1자리) | 123456, 인증 버튼 활성, `confirmPhoneCode('vid-123','123456')` 1회 | OK |
| 채워진 칸 덮어쓰기, 선택 기록 없음: "4" 칸에 "47" / "7" 칸에 "87" | 123756 / 123856 (커서 끝·앞 추정) | OK |
| 삭제 "" | 123_56, Backspace keyPress 예외 없음 (handleOtpKeyPress 미변경) | OK |
| SMS 6자리, 빈 칸 첫 칸 | 987654 | OK |
| SMS 6자리, 채워진 칸 (0,1) 선택 | 111111 | OK |
| 7자리(기존+전체 코드) 선택 없음 / (1,1) / (0,0) | 222222 / 333333 / 444444 | OK |
| 비숫자 "12-34" 빈 첫 칸 | 1234__ | OK |
| "9 8" 선택 (0,1) 교체 | 칸1부터 98 | OK |
| 타이머 만료(181초) → 재요청 | 전 칸 비움, 이후 칸2 "5" → __5___ (이전 선택 기록은 value 가드로 무시됨) | OK |

## 3 가드 조합 (셀 값 123456, 칸2="3")
| 조합 | 입력 | 관측 | 기대 | 판정 |
|---|---|---|---|---|
| G1 iOS 탭: onFocus 기록 (0,1) → caret 이벤트 (1,1) | 98 | 129856 | 129856 | OK (일관성 검사가 (1,1) 거부) |
| G1 | 5 | 125456 | 125456 | OK |
| G1 | **38** | **128456** | 123856 | 오분배 |
| G1 | **33** | **123456** | 123356 | 입력 유실 |
| G1 | **3** (같은 숫자 타이핑) | **12_456** | 123456 + 다음 칸 포커스 | 칸 비워짐 |
| G2 Android 변경 후 선택 먼저: (0,1) → (1,1) → 값 | **3** | **12_456** | 123456 | 칸 비워짐 |
| G2 | 5 / 8 | 125456 / 128456 | 동일 | OK |
| G2 (0,1) → (2,2) → 값 | 33 / 38 | 123356 / 123856 | 동일 | OK |
| G3 선택 후 커서 이동 (0,1)→(1,1) "35" / (0,1)→(1,1)→(2,2) "35" / (0,1)→(0,0)→(1,1) "53" | 125456 ×3 | 125456 | OK (REPORT 모호성 1번 해소) |
| G3 (0,1)→(1,1)→(1,1) "98" | 129856 | 129856 | OK |
| G4 선택 사용 후 같은 칸 재변경, 선택 없음 "98" | 128456 | 커서 끝 가정 = 타이핑 의도와 일치 | OK |

원인: `otpInput.ts` `isConsistentSelection`(L36-39)은 최근 선택이 "접힌 커서 (n,n)"여도 next와 모순만 없으면 채택한다. 기존 숫자로 시작/끝나는 입력, 또는 같은 숫자 1자리는 (1,1)/(0,0)과도 모순되지 않아 변경 전 선택 (0,1)보다 우선된다. REPORT 모호성 2번("98"이 "8"만 남음)은 **발생하지 않음** — "98"은 "3"으로 시작하지 않아 걸러진다. 실제로 깨지는 것은 "3x"/"x3"/"3" 계열.

발생 가능성 (RN 0.83.10 소스, 근거 L2):
- iOS G1: `RCTTextInputComponentView.mm:394-398` 탭 시 onFocus만 emit, JS `setSelection`은 `setTextAndSelection`(`:570-591`)에서 `_comingFromJS`로 onSelectionChange 안 냄(`:502-504`). 탭 caret 배치가 `textInputDidChangeSelection`으로 onFocus 직후 emit되는지는 UIKit 델리게이트 순서라 **소스로 미확정**(불확실성 High). 배치되면 JS 큐에서 onFocus 핸들러 뒤에 처리되므로 G1 순서가 된다. 등급: 중(실기기 필요).
- Android G2: 텍스트는 `ReactTextInputTextWatcher.kt:32-67`, 선택은 `ReactEditText.kt:476-484`→`ReactTextSelectionWatcher.kt:27-44`(값이 바뀔 때만). 붙여넣기/타이핑 시 두 이벤트의 JS 도착 순서는 소스로 미확정. FIX 작성자가 "변경 후 선택이 먼저 올 수 있다"고 가정한 그 순서에서 같은 숫자 재입력이 깨진다. 등급: 중-하.
- iOS 단일행에서 `textInputDidChangeSelection`이 텍스트 변경 전 선택을 내는 순서 보정은 멀티라인 전용(`:512-518`) — 단일행 OTP 칸의 붙여넣기 순서도 실기기 확인 대상.

## 결함
### [P2] 접힌 커서 선택이 변경 전 선택을 덮으면 기존 숫자로 시작/끝나는 붙여넣기 오분배
재현: 1) 칸 123456 2) 칸2 탭(iOS: onFocus 기록 (0,1) 뒤 caret (1,1) 이벤트) 3) "38" 붙여넣기.
기대 123856. 실제(jest 재현) 128456. "33" → 123456(유실). 위치 `src/screens/auth/otpInput.ts:36-39`, `SignupStep1Screen.tsx:108-112`(최근·직전 2슬롯 순서).
영향: 이전 D2와 같은 오분배가 caret 이벤트 순서에서 재발. 붙여넣기 첫/끝 자리가 기존 숫자와 같을 확률 약 2/10(추정). 실기기에서 순서가 확인되면 P1로 올림.
### [P2] 같은 숫자 재입력이 칸을 비움 (신규 회귀, 조건부)
재현: 1) 칸2="3" 선택 상태 2) (0,1) 기록 뒤 (1,1)이 먼저 기록(Android 변경 후 선택 선행 또는 iOS G1) 3) "3" 타이핑.
기대: 칸 3 유지 + 다음 칸 포커스(base 동작). 실제: 칸 비워짐, 포커스 이동 없음(`distributeOtpDigits` 빈 삽입=삭제 경로). 우회: 다시 입력.
### [P3] 재요청(resend) 시 `otpSelectionsRef` 초기화 없음
value 가드로 현재는 무해(재요청 후 입력 OK 실측). 같은 값이 다시 채워지면 오래된 기록이 쓰일 여지만 있음(포커스 시 새 기록으로 덮여 실제 위험 낮음).

후속 제안(코드는 builder 몫): 최근 선택이 접힌 커서이고 직전 선택이 같은 value의 비접힘 선택이면 직전 선택을 우선하거나, 삽입이 빈 문자열인데 next===prev면 "변경 없음"으로 처리해 같은 숫자를 다시 쓰고 포커스를 옮긴다. G1·G2 표를 회귀 테스트로 추가.

## 4 규칙
- cleanup: 새 구독·타이머·리스너 없음. `otpSelectionsRef`는 ref 배열(길이 OTP_LENGTH, `Array.from`), 사용 후 `[null,null]` 소거(L205). 언마운트 누수 없음(정적).
- typescript-strict: `extractInsertedDigits`·`distributeOtpDigits` 명시적 반환 타입, any 없음, `as` 없음(타입 가드 `sel is OtpCellSelection`). `setSelection?.` 옵셔널 호출은 타입상 존재하는 메서드에 대한 방어(무해).
- path-aliases: 새 import `@/screens/auth/otpInput`(화면·otpInput.test). 화면 테스트의 `'../SignupStep1Screen'` 상대 경로는 기존부터(이번 diff 아님).

## 5 실기기 체크리스트
1. **iOS G1(머지 조건)**: 칸 123456 → 칸3 탭 → 클립보드 "38" 붙여넣기. 기대 123856. 128456이면 P2→P1. 같은 상태에서 "3" 타이핑 → 칸 3 유지·다음 칸 이동.
2. **Android G2(머지 조건)**: 삼성/픽셀에서 칸3 탭(전체 선택 확인) → "3" 타이핑 → 칸 유지·포커스 이동, "38" 붙여넣기 → 123856.
3. iOS 탭 경로 원 시나리오: 칸3 탭 → "98" → 129856 / "98765" → 129876. Android 동일.
4. SMS 자동완성: 빈 칸 첫 칸 / 채워진 칸 포커스 상태에서 "메시지에서" 제안 탭 → 6칸 전체 채움·인증 성공.
5. 이미 포커스된 칸 재탭(Android 선택 안 걸림) 후 "98" 붙여넣기 → 커서 끝 가정으로 129856(기존 it.each 'cursor end 398' 경로).

## 사용 스킬
- 없음 — 15분 예산상 브리프 지정 항목(정적·jest·뮤턴트)만 수행. mobile-service-qa: 실기기 미실행이라 미로드. principle-prove-it-works: 미로드(각 PASS에 명령·관측값 첨부로 갈음).
- 서브에이전트: analyzer 1개(읽기 전용) — RN 0.83.10 TextInput 이벤트 순서 소스 근거(위 3절 파일:줄). 결론: JS setSelection은 onSelectionChange 미발송(iOS 확정), 탭 caret·붙여넣기 순서는 미확정.

## 미검증
- 실기기 iOS/Android 이벤트 순서(5절 1·2) — 기기·Metro 미가동, 브리프 범위 밖.
- 전체 jest·tsc·eslint — 브리프 지시로 Jarvis 담당(뮤턴트 대조군에서 src/screens/auth/__tests__ 7 suites 89/89만 실행).

검증: `npx jest dev/active/qa-379-r2/qa379r2.test.tsx --watchman=false --testMatch '**/dev/active/qa-379-r2/*.test.ts*'` → 9/9 passed(관측값은 표). 뮤턴트 5종+대조군(위 표). 실기기·전체 게이트는 미실행.
위험·영향 범위: 이 보고서는 문서 1개만 추가(코드 무변경). 판정이 틀리면 가입 OTP 입력에서 붙여넣기 오분배·칸 비워짐이 남아 인증 실패로 이어진다.
되돌리는 법: 이 REPORT 커밋을 `git revert <SHA>`.
