# FIX3 REPORT — #379 같은 숫자 재입력 시 다음 칸 포커스

상태: 완료 (로컬 커밋 `667b744`, push 안 함)

## 변경
- `src/screens/auth/SignupStep1Screen.tsx` `handleOtpKeyPress`: key 가 한 자리 숫자이고 현재 칸 값과 같으면 `otpRefs[index+1].focus()` (마지막 칸이면 이동 없음). Backspace 분기는 기존 조건 그대로(+`return`).
- `src/screens/auth/__tests__/SignupStep1Screen.test.tsx`: `same-digit retype via onKeyPress (#379 FIX3)` 4건 추가. 기존 테스트 기대값 변경 없음.
- 붙여넣기·SMS·삭제·재선택 로직 불변(handleOtpChange / SelectionChange / Focus 미수정).

## onKeyPress 발생 근거 (RN 0.83.10, node_modules 확인)
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/textinput/ReactEditText.kt:349-356` — JS 에 `onKeyPress` prop 이 있으면 InputConnection 을 `ReactEditTextInputConnectionWrapper` 로 감쌈 (`ReactTextInputManager.kt:354-356` setOnKeyPress). 이 화면은 이미 onKeyPress 를 넘김(SignupStep1Screen.tsx:541).
- `.../ReactEditTextInputConnectionWrapper.kt:97-107` `commitText`: 길이 ≤2 텍스트면 `super.commitText` **이전에** `dispatchKeyEventOrEnqueue(inputKey)` → 텍스트 변경 여부와 무관하게 keyPress("3") 발생. 그래서 텍스트 불변(onChangeText 0건)인 A1-a 에서도 keyPress 는 온다.
- 같은 파일 `:118-129` `sendKeyEvent`: 숫자 KeyEvent(ACTION_DOWN)도 `dispatchKeyEvent(event.number)`.
- `:58-67` batch edit 중이면 endBatchEdit 에서 1회 dispatch (중복 아님).
- **`adb shell input text` 는 keyPress 를 내지 않을 가능성이 높다(정정, L2·확인 필요).** keyPress 를 내는 곳은 이 래퍼뿐이고 래퍼는 `onCreateInputConnection`(IME→뷰 채널)에만 붙는다. `ReactEditText.kt` 에 `KeyPressEvent` dispatch 는 0건(`onKeyUp:328`, KeyListener `:1282-1288` 은 keyPress 미발행). `input text` 는 KeyEvent 를 입력 파이프라인에 주입(하드웨어 키 경로 → TextView.onKeyDown/KeyListener)하므로 래퍼를 거치지 않는다. 브리프의 "(IME commitText)" 는 가정. 결론: 소프트 키보드 숫자패드(commitText·sendKeyEvent) = keyPress 옴, `input text`·하드웨어 키보드 = 안 올 가능성 높음.
- QA 계측: `evidence-js-r2.log` 의 `[QA379]` 로그에는 keyPress 이벤트 계측 자체가 없다(grep -i key 0건) → A1-a 에서 keyPress 발생 여부는 실측으로 미확정.
- **QA 재현 지시: `input text 3` 로 재현하면 다시 FAIL 로 보일 수 있다 → 화면 숫자패드 탭(`adb shell input tap …`)으로 재현할 것.** 가능하면 `[QA379]` 에 keyPress 계측 추가.
- QA 확인 항목(차단 아님): batch edit 중 keyPress 는 `endBatchEdit` 까지 지연(`:58-67`) → 칸2 reselect `setSelection(0,1)` 이 칸3 `focus()` 보다 늦게 와도 포커스가 칸3 에 머무는지(칸2 로 안 돌아가는지) 확인.
- selection 기반 대안은 구현하지 않음: 실측 순서 selection(0,1)→focus→첫 접힌 caret(1,1) 은 단순 재탭과 같은 숫자 입력이 같은 이벤트 모양이라 구분 불가 → 구현 시 브리프의 오탐 금지 조건 위반. 소프트 키보드에서도 keyPress 가 없다는 실측이 나오면 재검토.
- 오탐 검토: 단순 커서 탭은 keyPress 를 내지 않으므로(위 경로 모두 텍스트 입력/키 이벤트 한정) 포커스가 튀지 않는다. 다른 숫자는 이 분기를 타지 않고 기존 changeText 경로가 처리.

## 테스트 (RED→GREEN)
- RED (구현 전, `npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx --watchman=false -t FIX3`): `✕ keyPress of the same digit without changeText moves focus to the next cell`, 1 failed / 3 passed (가드 3건은 구현 전에도 통과가 정상). 로그 logs/red.log
- 테스트 함정: `jest.spyOn(TextInput.prototype,'focus')` 가 이미 spy 된 메서드면 이전 호출이 누적된 같은 mock 을 돌려줌(셋업의 'otp-cell-5' focus 가 섞임) → spyOn 직후 `mockClear()`.
- GREEN: 같은 명령 4 passed. 로그 logs/green.log
- 포커스 대상은 `spy.mock.contexts[i].props.testID` 로 칸 단위 단언(멱등 테스트: keyPress+changeText 후 focus 대상 집합 = {otp-cell-3}).

## 검증 (로그 dev/active/fix-379-fix3/logs/, 커밋 안 함)
- `npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache"` → EXIT=0 (added 2005 packages)
- `npm run type-check` → EXIT=0
- `npx eslint --no-eslintrc -c .eslintrc.js src/screens/auth/SignupStep1Screen.tsx src/screens/auth/__tests__/SignupStep1Screen.test.tsx` → EXIT=0
- `npx jest src/screens/auth --watchman=false --silent` → EXIT=0, Suites 7/7, Tests 119/119 (기존 115 + 신규 4)

검증: 위 4개 명령 fresh 실행 EXIT=0. 실기기·에뮬레이터 동작은 미검증(브리프상 금지, 다른 QA 레인 사용 중). Codex 리뷰 미실시(Jarvis 게이트).
위험·영향 범위: SignupStep1Screen OTP 칸 onKeyPress 만. 오류 시 같은 숫자 키에서 포커스가 다음 칸으로 한 번 더 이동(값은 불변) 정도. iOS 는 changeText 분기와 같은 대상 focus 라 멱등.
되돌리는 법: `git revert 667b744`

사용 스킬: 없음 — Skill 도구로 로드하지 않음(작업 판단상 생략; 예산 부족 때문은 아님). TDD(RED 먼저)·fresh 검증 절차는 수동 적용. 조언자(advisor) 검토 1회 반영(adb input text 근거 정정)
테스트: 신규 4건(위 RED→GREEN), 기존 기대값 변경 없음
기존 실패: 없음 (auth 115건 기존 통과 유지)
