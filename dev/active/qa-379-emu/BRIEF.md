등급: M (실행 tier Q) · 대상 위험 등급: 중 · Android 에뮬레이터 실동작 QA (영환님 지시 「이뮬레이터로 확인해」)
# QA BRIEF — #379 OTP 칸 붙여넣기/재입력 Android 에뮬레이터 실측 (A1 + 이벤트 순서)

## r4 재실행 메모 (Jarvis — FIX3 검증, 이 절이 최우선)
- 이 worktree는 이제 FIX3 커밋 `2da1c8b`(`fix/379-same-digit-focus`, onKeyPress로 같은 숫자 재입력 시 다음 칸 포커스)다. Metro(8081)가 그대로 실행 중이며 핫리로드됨 — 앱을 `am force-stop` 후 다시 실행해 새 번들을 받을 것. Metro·metro.config.js·실기기 접촉 금지는 동일.
- **입력은 반드시 화면 소프트 키보드(Gboard, `com.google.android.inputmethod.latin`) 키 탭으로.** `adb input text`/`keyevent`는 하드웨어 키 경로라 onKeyPress가 오지 않는다(FIX3 REPORT 근거: `ReactEditTextInputConnectionWrapper.kt:97-107`). 키 좌표는 키보드가 뜬 상태의 스크린샷에서 실측, 각 키 탭 후 [QA379] 로그로 검증. 숫자패드(number-pad)가 뜨는지 확인.
- 프로브 패치를 다시 적용하되 **`handleOtpKeyPress` 진입 로그 `{ev:'keypress', idx, key}`를 추가**한다.
- 실행 순서: ① 준비 1→6(소프트키) ② **A1-a** 3번째 칸 탭 → 소프트키 `3` → 기대 123456 유지 + 포커스 idx3 (keypress 로그 확인) ③ A1-a 대조: 3번째 칸 탭 → 소프트키 `7` → 123756, 포커스 idx3 ④ 마지막 칸(idx5) 탭 → 같은 숫자 → 이동 없음 ⑤ **A3** 빈 칸에서 소프트키 ⌫ → 이전 칸 포커스(keypress 'Backspace' 로그 확인) ⑥ 회귀 1건: 3번째 칸 PASTE `98`(keyevent 279 허용) → 129856.
- 결과는 `REPORT.md`(r4)로 새로 작성(r3는 `REPORT-r3.md`로 보존됨). 하드웨어 키 A3 FAIL(r3)이 소프트키로도 재현되는지 결론 한 줄.

## r3 재실행 메모 (Jarvis — r2 결과 반영, 이 절이 최우선)
- r2 완료분(다시 하지 말 것): 준비 1→6, A1-a(값 PASS·포커스 FAIL — Developer FIX3 레인이 별도 수정 중), A1-b PASS(keyevent 279), 이벤트 순서표. 결과: `REPORT-r2.md`, `logs/js-r2.log`.
- 이번에 실행할 것(이 순서, 시간 모자라면 뒤에서부터 NOT RUN): ① 원 이슈 `98`→129856 / `98765`→129876 ② G `33`→123356 / `83`→128356 ③ A2 MOVE_END→`8`→128456 ④ A3 Backspace 이전 칸→`5` ⑤ 6자리 `654321` 붙여넣기 ⑥ 롱프레스 「붙여넣기」 메뉴로 `38`.
- OTP 화면은 `uiautomator dump`가 idle 실패(커서 애니메이션)함 → r2처럼 스크린샷 실측 좌표를 쓰되 **매 탭마다 [QA379] focus 로그의 idx로 맞았는지 검증**(허용된 편차, REPORT에 명시).
- Metro(8081)·metro.config.js·실기기는 r2 메모와 동일하게 건드리지 않음. SignupStep1 프로브 패치는 다시 적용하고 끝에 그 파일만 원복.
- 결과는 `REPORT.md`(r3)로 새로 작성.

## r2 재실행 메모 (Jarvis, 이전 시도 BLOCKED 해소)
- 이전 BLOCKED 원인은 watchman이 아니라 `metro.config.js` blockList `/[\/\\]\.claude[\/\\].*/` — 이 worktree 경로 자체가 `.claude/worktrees/` 아래라 **모든 파일이 차단**됨. Jarvis가 이 worktree의 `metro.config.js`에 로컬 프로브(프로젝트 루트 기준 regex)를 적용했고 **Metro를 port 8081로 이미 실행 중**이다(`curl …/index.bundle?platform=android` → HTTP 200, 22.8MB 확인). **lane은 Metro를 새로 띄우거나 종료하지 말 것**, `metro.config.js`도 건드리지 말 것(원복은 Jarvis).
- 실기기 `lastUpdateTime` 확인은 Jarvis가 직접 한다(lane은 실기기 adb 금지 — 조회도 하지 않음).
- 2단계의 `npx expo start`·metro kill 지시는 무시한다. `SignupStep1Screen.tsx` 프로브 패치만 lane이 적용하고 끝에 그 파일만 `git checkout -- src/screens/auth/SignupStep1Screen.tsx`로 원복.

## 목적
main `bad3b5c`(#379 병합본)의 OTP 칸이 **실제 Android 네이티브 TextInput(RN 0.83 New Arch)**에서 QA r3 「머지 전 필수」A1과 관찰 항목대로 동작하는지 실측하고,
지금까지 정적 추정이던 **onSelectionChange / onChangeText / onFocus 이벤트 도착 순서**를 로그로 확정한다.

## 환경 (Jarvis 준비 완료 — 다시 하지 말 것)
- 이 worktree = `bad3b5c` detached. Jarvis가 `npm ci` → `expo prebuild --platform android` → `gradlew :app:assembleDebug` → **emulator-5554에만** 설치함(로그 `dev/active/qa-379-emu/logs/`).
- 에뮬레이터 `emulator-5554`(AVD LiveMetro_API_34) 부팅됨.
- **영환님 실기기 `R3CMC08YHMX`가 같은 adb에 연결돼 있다. 모든 adb 명령에 `-s emulator-5554`를 반드시 붙인다. 실기기는 어떤 명령으로도 건드리지 않는다.** 종료 시 실기기 `dumpsys package com.livemetro.app | grep lastUpdateTime`이 `2026-11-21 01:00:00` 그대로인지 기록.

## 1단계 — 로컬 전용 프로브 패치 (커밋 금지, 끝나면 `git checkout -- .`로 원복)
`src/screens/auth/SignupStep1Screen.tsx`에만:
1. `useState<Phase>('input')` → `'otp'` (SMS·reCAPTCHA 없이 OTP 단계 진입. 실제 인증 경로는 실기기 항목으로 남김).
2. `[QA379]` 태그 로그(`console.log`, JSON 한 줄): `handleOtpFocus(idx)`, `handleOtpBlur(idx)`, `handleOtpSelectionChange(idx, selection)`, `handleOtpChange(idx, rawValue)` 진입 시 각각 `{seq, t: Date.now(), ev, idx, ...}`; 그리고 `otpDigits`가 바뀔 때마다 `{ev:'digits', value: otpDigits.join('|')}`. 재선택(setSelection) 호출 시 `{ev:'reselect', idx}`.
3. 붙여넣기 원본 확보용 개발 하네스: OTP 칸 아래에 `testID="qa-clip-src"` TextInput 하나(기본값 `38`, 편집 가능). 클립보드에 넣을 땐 이 칸 포커스 → `input keycombination 113 29`(Ctrl+A) → `input keyevent 278`(COPY). **호스트 Mac 클립보드(pbcopy)는 쓰지 않는다.**
- 인증 확인 버튼·재전송·뒤로가기 외 상태 변경 버튼은 누르지 않는다(verificationId 없음).

## 2단계 — Metro + 앱 실행
- `adb -s emulator-5554 reverse tcp:8081 tcp:8081`, `npx expo start --port 8081 > dev/active/qa-379-emu/logs/metro.log 2>&1 &` (PID 기록, 끝나면 kill).
- 앱 실행 `adb -s emulator-5554 shell am start -n com.livemetro.app/.MainActivity`(실제 액티비티는 `cmd package resolve-activity`로 확인). dev launcher가 뜨면 `http://10.0.2.2:8081` 또는 localhost 항목 선택.
- 회원가입(SignupStep1) 화면까지 `uiautomator dump` + `adb pull`로 text/content-desc/bounds를 읽어 탭(**좌표 추측 금지**). 로그인·계정 생성·저장 버튼 금지.
- 로그 수집: `adb -s emulator-5554 logcat -c` 후 `adb -s emulator-5554 logcat -s ReactNativeJS:V > dev/active/qa-379-emu/logs/js.log &`.

## 3단계 — 시나리오 (각 단계 전후 screencap + 해당 구간 [QA379] 로그)
준비: 6칸에 `1 2 3 4 5 6`을 순서대로 타이핑(첫 칸 탭 → `input text 1` … 자동 포커스 이동 확인).
- **A1-a** 3번째 칸 탭 → `input text 3` → 기대: 칸 `123456` 유지 + 포커스 4번째 칸.
- **A1-b** 클립보드 `38` 준비 → 3번째 칸 탭 → `input keyevent 279`(PASTE) → 기대 `123856`. 같은 상황을 **롱프레스 → 「붙여넣기」 메뉴 탭**으로도 1회(메뉴 bounds는 dump로).
- **원 이슈 예시** 값 `123456`으로 복원 후: 3번째 칸 탭 → 붙여넣기 `98` → `129856` / `98765` → `129876`.
- **A2** 3번째 칸 탭 → 커서를 끝으로(`input keyevent 123` MOVE_END) → `input text 8` → 기대 `128456`.
- **A3** 빈 칸에서 Backspace로 이전 칸 이동(JS focus) → 그 칸에 `input text 5` → 그 칸만 5.
- **G 보강** 3번째 칸 탭 → 붙여넣기 `33` → `123356`, `83` → `128356`.
- **6자리 전체 붙여넣기** 3번째 칸에서 `654321` 붙여넣기 → `654321`.
각 시나리오 사이 값 복원은 칸별 탭+타이핑으로(로그에 남는 대로 둠).

## 판정 규칙
- 칸 값은 `[QA379] digits` 로그(L1)와 screencap(vision)을 둘 다 보고 일치할 때만 PASS. 불일치면 로그 기준 + 불일치 명시.
- 이벤트 순서표: 각 시나리오에서 focus/selection/change/reselect가 **어떤 순서와 어떤 selection 값**으로 왔는지 표로. QA r2/r3의 G1·G2 가정(Android: 변경 후 선택이 먼저 오는가?)에 대한 **실측 결론**을 한 줄로.
- 실패 시 원인 위치(otpInput.ts / handleOtp* 줄)와 로그 증거, 심각도. 코드 수정은 하지 않는다.
- 이 실측은 **Android 에뮬레이터 + 하드웨어 키 입력(adb input)** 범위다. 삼성 키보드·실제 SMS 자동완성·iOS는 범위 밖으로 명시.

## 산출
- `dev/active/qa-379-emu/REPORT.md`(커밋하지 말 것 — Jarvis가 회수). 판정 PASS / 조건부 / FAIL, 시나리오 표(기대/관측/근거), 이벤트 순서표, 스크린샷 파일 목록(`dev/active/qa-379-emu/shots/`), 원복 증명(`git status --short` 빈 출력, metro·logcat 프로세스 종료), 실기기 미접촉 증명.
- `사용 스킬:`, `검증 / 위험·영향 범위 / 되돌리는 법`. /tmp·저장소 밖 쓰기 금지, push 금지, 조기 종료 금지. REPORT 초안 먼저.
- 시간이 모자라면 A1-a·A1-b·이벤트 순서표를 최우선으로 끝내고 나머지는 NOT RUN으로 표기.

서브에이전트 분할: 불필요(단일 기기 순차 조작)
