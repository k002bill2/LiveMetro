# REPORT — #379 OTP 칸 부분 붙여넣기 오분배

## 결론
OTP TextInput 6칸에 `selectTextOnFocus`를 추가했다. 칸에 포커스가 오면 기존 숫자가 선택되므로 입력·붙여넣기가 "교체"가 되고, onChangeText에는 새 입력만 온다. 길이 휴리스틱(2자리 / OTP_LENGTH+1자리)은 **안전망으로 유지**했다.

선택: ★selectTextOnFocus + 휴리스틱 안전망 유지(사유: 기존 테스트 'replaces only the current cell…'이 선택 없이 "39"/"9987654"가 오는 경로를 단언하며, 브리프가 기존 기대값 변경을 금지함. 이미 포커스된 칸을 다시 탭하면 선택이 다시 걸리지 않는 경우도 있어 안전망이 필요).

## 방식 근거 (RN 0.83 node_modules 소스, L1)
- 타입: `Libraries/Components/TextInput/TextInput.d.ts:932` "If true, all text will automatically be selected on focus".
- iOS: `Libraries/Text/TextInput/RCTBaseTextInputView.mm:650-661` `reactFocus`에서 `_selectTextOnFocus`면 `selectAll:` 호출 (ref.focus()로 다음 칸 이동하는 이 화면의 경로가 여기에 해당).
- Android: `ReactAndroid/.../ReactEditText.kt:1084-1086` `setSelectTextOnFocus` → `super.setSelectAllOnFocus` (네이티브 EditText의 포커스 시 전체 선택) + `onLayout`(292-296)에서 1회 selectAll 보강.
- onSelectionChange 커서 추적 대안은 ★가 동작하므로 쓰지 않음.

## 변경 파일
- `src/screens/auth/SignupStep1Screen.tsx` — TextInput에 `selectTextOnFocus` + 주석, handleOtpChange 주석에 안전망 설명(로직 변경 없음).
- `src/screens/auth/__tests__/SignupStep1Screen.test.tsx` — 회귀 테스트 1건 추가(두 예시 + 6칸 모두 selectTextOnFocus 단언).

## 테스트 (RED→GREEN)
- RED: `npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx --watchman=false` → EXIT=1, 신규 테스트 ✕ `Expected: true / Received: undefined` (selectTextOnFocus 미설정), 기존 5건 ✓.
- 정직성 메모: 테스트는 선택 교체 방식에 맞춰 onChangeText에 새 입력만("98", "98765") 넣는다. 이 입력에 대한 분배 로직은 원래도 맞았으므로 RED는 prop 단언에서 났다 — 즉 버그 수정의 실체는 "OS가 기존 값을 선택해 새 입력만 오게 하는 것"이고, 이것은 jest로 증명 불가하며 실기기 확인이 필요하다.
- GREEN: `npx jest src/screens/auth --watchman=false --silent` → EXIT=0, Suites 6/6, Tests 54/54. 기존 5개 테스트 기대값 변경 없음.

## EXIT 표 (로그: dev/active/fix-379-otp-paste/logs/, 미커밋)
| 명령 | EXIT |
|---|---|
| npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache" | 0 |
| npm run type-check | 0 |
| npx eslint --no-eslintrc -c .eslintrc.js (2파일) | 0 |
| npx jest src/screens/auth --watchman=false --silent | 0 (54/54) |

## 실기기 미검증 범위
- iOS 붙여넣기 메뉴(길게 눌러 붙여넣기 시 선택 상태 유지 여부), 사용자 탭으로 포커스 시 iOS selectAll 동작(소스상 확인한 경로는 reactFocus).
- Android 삼성 키보드·클립보드 제안 붙여넣기, 이미 포커스된 칸 재탭(선택 해제 → 안전망 경로).
- SMS 자동완성(iOS oneTimeCode / Android sms-otp)이 선택된 칸에 들어올 때 6자리 전체로 오는지.

사용 스킬:
- superpowers:test-driven-development → 테스트 먼저 작성, RED(prop 미설정) 확인 후 구현.
- test-automation·react-native-development: 미로드 — 15분 예산, 1 prop 추가 수준이라 생략.
테스트: SignupStep1Screen.test.tsx에 #379 회귀 1건 추가, RED(EXIT=1)→GREEN(EXIT=0).
기존 실패: 없음 (src/screens/auth 범위. 전체 jest는 Jarvis 담당으로 미실행).

검증: npm ci·type-check·eslint(2파일)·jest src/screens/auth 실행, 전부 EXIT=0. 전체 jest·실기기 붙여넣기는 미검증.
위험·영향 범위: 회원가입 Step1 OTP 입력 칸만. 잘못되면 탭 시 숫자가 선택돼 보이는 UX 변화, 또는 플랫폼에서 선택이 안 걸리면 기존(수정 전)과 같은 동작으로 남음(안전망 유지). 인증 로직 변경 없음.
되돌리는 법: `git revert <이 커밋 SHA>` (또는 TextInput의 selectTextOnFocus 한 줄 삭제).


---

# FIX — QA FAIL 반영 (fix-379-fix1, 커밋 7682c58, base 3ad929b)

선택: ★A(선택 상태 기반 결정론적 복원) + 보조 B(onFocus 직접 선택) — Jarvis 결정 그대로.

## 이벤트 순서 근거 (RN 0.83.10 node_modules 정적, 읽기 전용 서브에이전트 조사)
- iOS Fabric `React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputComponentView.mm`: `textInputDidChange` 481-498(onChange 발행 496) → `textInputDidChangeSelection` 500-519(onSelectionChange 518). 멀티라인은 512-513에서 onChange를 강제로 먼저 보낸다. 50-55 주석: UITextField는 onChange → onSelectionChange. 선택값은 `_textInputMetrics` 702-714에서 현재(변경 후) 상태 → **변경 후 선택은 onChangeText 뒤에 온다** = onChangeText 시점에 기록된 선택은 변경 전 선택.
- iOS JS 선택: `setTextAndSelection` 562-591이 `_comingFromJS`로 delegate 콜백 차단 → `ref.setSelection`은 onSelectionChange로 돌아오지 않음 → handleOtpFocus가 선택 기록을 직접 남긴다.
- Android: `ReactTextInputTextWatcher.kt` 32-67(onTextChanged → ReactTextChangedEvent 60-67), `ReactTextSelectionWatcher.kt` 27-45(값이 바뀔 때만 발행 38-40), `ReactEditText.kt` 476-485(onSelectionChanged → selectionWatcher, hasFocus 조건). 두 이벤트의 상대 순서는 Android 프레임워크(Editable/SpanWatcher) 동작이라 이 저장소로 **확정 불가(추정)** → 가드 적용.
- JS `Libraries/Components/TextInput/TextInput.js` 499-502(_onChange → onChangeText 동기), 518-519(_onSelectionChange) — 재정렬 없음. `setSelection(start, end)` 479-489 존재.
- 가드: 선택 기록 시 그 칸 값도 저장(`OtpCellSelection.value`). onChangeText 시 저장 값 ≠ 이전 칸 값, 또는 범위가 이전 값 길이를 벗어나면(변경 후 선택이 먼저 온 경우의 전형) 버리고 커서 끝(append, 수정 전 기본 동작) 가정. 한 번 쓴 선택은 소거.

## 결함별 반영
| QA 결함 | 반영 |
|---|---|
| [P1] iOS 탭 포커스에서 선택 안 걸림 | `handleOtpFocus`: `ref.setSelection?.(0, len)` + 선택 기록. selectTextOnFocus는 Android 네이티브 탭 선택 경로로 유지. 탭 선택이 안 걸려도 커서 끝 "398"은 A가 129856으로 복원 |
| [P1] 2자리 휴리스틱 38/83/33 오분배 | 휴리스틱 제거. `src/screens/auth/otpInput.ts` 순수 함수 `extractInsertedDigits`(삽입 = next.slice(start, next.length − (len − end)))·`distributeOtpDigits`(≥6자리 첫 칸부터, 그 외 현재 칸부터·넘침 버림·앞 칸 보존) |
| [P2] 테스트가 prop만 단언 | d981e51의 prop 단언 테스트를 경계 표 12건 + 순서 가드 1건의 `it.each` 동작 테스트(selectionChange 이벤트 → changeText)로 대체. 사유: prop 단언은 동작을 고정하지 못하고(QA 1d), 새 설계에선 선택이 prop이 아니라 기록 값으로 결정된다. onFocus 경로 테스트 1건 추가 |

## 테스트 (RED→GREEN)
- 추가: `src/screens/auth/__tests__/otpInput.test.ts`(경계 12건·가드·불변성/포커스), `SignupStep1Screen.test.tsx` 동작 테스트 13건 + onFocus 1건.
- RED: 헬퍼 파일을 치운 상태(화면 미수정)에서 `npx jest src/screens/auth --watchman=false --silent` → EXIT=1, Suites 2 failed, Tests 5 failed / 61 passed (Cannot find module otpInput, 화면 38·83·33·398·가드 실패). 로그 `logs/fix/red.log`.
- GREEN: 같은 명령 → EXIT=0, Suites 7/7, Tests 82/82. 기존 5건 기대값 불변(diff에서 기존 it 블록 미변경).
- 정직성 메모: 헬퍼 본체는 테스트 파일보다 먼저 작성했고, RED는 헬퍼를 치워 재현했다.

## EXIT 표 (로그: dev/active/fix-379-otp-paste/logs/fix/, 미커밋)
| 명령 | EXIT |
|---|---|
| npm run type-check | 0 |
| npx eslint --no-eslintrc -c .eslintrc.js --no-ignore (변경 4파일) | 0 |
| npx jest src/screens/auth --watchman=false --silent (헬퍼 테스트 포함) | 0 (82/82) |

## 실기기 미검증 범위
- Android에서 onChangeText와 onSelectionChange의 실제 순서(가드로 커서 끝 폴백. 단 "변경 후 선택이 이전 값 길이 안"인 경우—예: 선택된 "3"을 "5"로 교체 후 (1,1)이 먼저 옴—는 가드가 못 거른다 → 칸이 비는 오동작 가능. 로그로 순서 확인 필요).
- iOS 탭 시 UIKit의 커서 배치 선택 이벤트가 onFocus 이후에 오면 기록이 (1,1)로 덮이는데, 네이티브는 JS setSelection으로 (0,1) 선택 → 붙여넣기 "98"이 "8"만 남을 수 있음(경쟁 조건, 정적 판정 불가).
- SMS 자동완성·삼성 키보드 클립보드 제안 경로.

사용 스킬:
- superpowers:test-driven-development → 경계 표를 테스트로 먼저 고정, RED(EXIT=1) 확인 후 화면 반영.
- test-automation·react-native-development·verification-before-completion: 미로드 — 15분 예산. 검증은 브리프 3종 명령 fresh 실행으로 대신.
- 서브에이전트: analyzer 1개(읽기 전용) — RN 이벤트 순서 조사, 결과를 위 근거 절에 통합.
테스트: 위 RED→GREEN.
기존 실패: 없음 (src/screens/auth 범위. 전체 jest 미실행).

검증: type-check·eslint(4파일)·jest src/screens/auth 실행, 전부 EXIT=0. 전체 jest·실기기(iOS/Android) 동작·Android 이벤트 순서는 미검증.
위험·영향 범위: 회원가입 Step1 OTP 6칸 입력만. 잘못되면 부분 붙여넣기/교체 입력이 잘못 분배되거나 칸이 비어 인증 실패 → 재입력 필요. 인증 로직·네이티브·의존성 변경 없음.
되돌리는 법: `git revert 7682c58` (d981e51 상태로 복귀) — REPORT 커밋은 별도로 revert.
