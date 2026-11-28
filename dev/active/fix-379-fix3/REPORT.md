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
- 확인 필요(추정): `adb shell input text` 는 IME 경유 KeyEvent 주입이라 IME 가 commitText/sendKeyEvent 중 어느 쪽으로 넘기든 위 두 경로 모두 keyPress 를 낸다고 판단. 에뮬레이터 재측정은 브리프 지시로 미실시 → QA 레인 실측 필요.
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

사용 스킬: 없음 — 15분 예산으로 Skill 로드 생략, TDD(RED 먼저)·검증 절차는 수동 적용
테스트: 신규 4건(위 RED→GREEN), 기존 기대값 변경 없음
기존 실패: 없음 (auth 115건 기존 통과 유지)
