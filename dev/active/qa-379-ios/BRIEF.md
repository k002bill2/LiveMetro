등급: M (실행 tier Q) · 대상 위험 등급: 중 · iOS 시뮬레이터 실동작 QA (영환님 ★1 승인: push 후 iOS I1)
# QA BRIEF — #379 OTP 칸 iOS 시뮬레이터 실측 (I1 = QA r2 5절 1·3항, FIX3 포함 main `b843d19`)

## 목적
QA r2 「머지 조건」 iOS G1과 원 시나리오를 **실제 iOS Fabric TextInput**에서 실측한다. 정적 분석상 미확정이던 iOS 이벤트 순서(탭 시 onFocus 기록 (0,1) 뒤 caret (1,1)이 오는지, 단일행 붙여넣기에서 change/selection 순서)를 로그로 확정한다.

## 환경 (Jarvis 준비 완료 — 다시 하지 말 것)
- 이 worktree = `b843d19` detached. Debug 앱을 **iPhone 16 Pro 시뮬레이터 `5FB03952-6CD5-43F7-8EDB-D73319E39039`**(iOS 18.5 — 실제 런타임, 브리프 초안의 26.5는 오기)에만 설치함. 빌드 로그 `dev/active/qa-379-ios/logs/`.
- **Metro(8081)·Appium(4723)은 Jarvis가 이미 띄웠다. 새로 띄우거나 끄지 말 것.** `metro.config.js`는 Jarvis 로컬 프로브(수정 금지, 원복은 Jarvis).
- 실기기(iPhone·Android 폰)·호스트 Mac 클립보드(pbcopy/pbpaste, `simctl pbcopy`도 Simulator가 호스트와 동기화할 수 있으므로 **금지**) 접촉 금지.

## 1단계 — 로컬 프로브 패치 (커밋 금지, 끝나면 그 파일만 `git checkout --`)
`src/screens/auth/SignupStep1Screen.tsx`만: Android QA r4와 동일 — `useState<Phase>('otp')`, `[QA379]` JSON 한 줄 로그(`focus/blur/selection/change/keypress/reselect/digits`, `{seq,t,ev,idx,...}`), OTP 칸 아래 `testID="qa-clip-src"` TextInput(기본값 `38`). 참고 구현: `dev/active/qa-379-emu/REPORT-r4.md`(main에 커밋됨).
- JS 로그 확인: Metro 터미널 대신 `xcrun simctl spawn 5FB03952-6CD5-43F7-8EDB-D73319E39039 log stream --style compact --predicate 'eventMessage CONTAINS "QA379"' > dev/active/qa-379-ios/logs/js.log &`(PID 기록·종료). 안 잡히면 Metro 로그 대체 경로를 찾고 REPORT에 방법 기록.

## 2단계 — 조작 도구: Appium XCUITest (로컬 node_modules, 서버 4723 실행 중)
- 세션: `platformName=iOS, appium:automationName=XCUITest, appium:udid=5FB03952-…, appium:bundleId=com.livemetro.app, appium:noReset=true, appium:newCommandTimeout=600` — `node`에서 `webdriverio`(node_modules에 있음, 없으면 Appium HTTP API를 curl로) 사용. 스크립트는 `dev/active/qa-379-ios/drive.mjs`(커밋 금지).
- 앱 실행 후 dev 메뉴/번들 로딩 화면이 뜨면 `http://localhost:8081`. 회원가입(SignupStep1)까지 accessibility tree(`getPageSource`)로 요소를 찾아 탭. **좌표 추측 금지**(트리에서 rect 사용). 로그인·계정 생성·인증 확인 버튼 금지.
- 입력: **iOS 소프트 키보드 키 요소(XCUIElementTypeKey name="3")를 탭**. `sendKeys`/`setValue`는 키보드 이벤트 경로가 달라 판정에 쓰지 않는다(대조용으로만, 표기).
- 붙여넣기: qa-clip-src 길게 눌러 「Select All」→「Copy」, OTP 칸 탭 후 길게 눌러 편집 메뉴 「Paste」(붙여넣기) 탭. 「Allow Paste」 시스템 프롬프트가 뜨면 허용하고 기록.

## 3단계 — 시나리오 (각 단계 전후 스크린샷 `dev/active/qa-379-ios/shots/`, [QA379] 로그 구간)
① 준비 소프트키 1→6 → 123456 (자동 포커스 이동)
② **I1-a (G1 머지 조건)** 3번째 칸 탭 → 붙여넣기 `38` → 기대 **123856** (128456이면 FAIL·P1)
③ **I1-b** 3번째 칸 탭 → 소프트키 `3` → 123456 유지 + 포커스 4번째 칸 (FIX3)
④ 원 시나리오 3번째 칸 탭 → 붙여넣기 `98` → 129856 / `98765` → 129876
⑤ 빈 칸 ⌫ → 이전 칸 포커스 (A3)
⑥ 탭 후 커서 이동 관찰: 3번째 칸 탭 직후 [QA379] 순서(focus → selection (0,1)? (1,1)? reselect?)와 화면상 전체선택 하이라이트 여부
시간이 모자라면 ②③⑥ 우선, 나머지 NOT RUN.

## 판정
- 값은 `[QA379] digits` 로그와 스크린샷 둘 다 일치해야 PASS. 이벤트 순서표(iOS) + r2 정적 가정(G1 caret (1,1) 후착, 단일행 붙여넣기 순서)에 대한 **실측 결론** 한 줄.
- 실패 시 위치(파일:줄)·로그 증거·심각도. 코드 수정 금지.
- 범위: iOS 시뮬레이터 + 소프트 키보드. 실기기 SMS 자동완성(`textContentType=oneTimeCode`)·삼성 키보드는 범위 밖.

## 산출
- `dev/active/qa-379-ios/REPORT.md`(커밋 금지 — Jarvis 회수). 판정·시나리오 표·이벤트 순서표·스크린샷 목록·원복 증명(`git status --short`에 `M metro.config.js`만), 종료한 프로세스(log stream; Appium 세션은 deleteSession, 서버는 유지).
- `사용 스킬:`, `검증 / 위험·영향 범위 / 되돌리는 법`. /tmp·저장소 밖 쓰기 금지, push 금지. REPORT 초안 먼저, 조기 종료 금지.

서브에이전트 분할: 불필요(단일 기기 순차 조작)
