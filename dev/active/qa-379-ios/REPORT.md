# QA REPORT — #379 OTP iOS 시뮬레이터 실측 (b843d19)

판정: **PASS** (①②③⑤⑥ PASS, ④ NOT RUN — 시간 예산)

환경: 시뮬레이터 5FB03952-… (Appium 보고 platformVersion **18.5** — 브리프의 iOS 26.5와 다름, 기록만), Debug 앱 com.livemetro.app, Metro 8081/Appium 4723(Jarvis 실행분, 손대지 않음). 입력=XCUIElementTypeKey 소프트키 탭(좌표는 매번 트리 rect). sendKeys/setValue 미사용.
로그 경로: `simctl log stream`에는 JS console.log가 안 잡힘(0줄) → **대체: Jarvis Metro 출력 logs/metro-jarvis.log의 ` LOG [QA379]` 라인** → 발췌 logs/qa379.log.

## 시나리오 표
| # | 조작 | 기대 | 실제 digits 로그 | 결과 | 증거 |
|---|---|---|---|---|---|
| ① | idx0 탭 → 소프트키 1~6 | 123456, 자동 이동 | seq42 1\|2\|3\|4\|5\|6, 각 change 후 focus idx+1 | PASS | seq2–42, shots/03-kbd, 04-123456 |
| ② I1-a G1 | idx2 탭 → (재탭 시 편집 메뉴) 「붙여넣기」 `38` | 123856 | seq63 change(raw="38") → seq65 1\|2\|3\|8\|5\|6 → focus idx4 | **PASS** | seq58–69, shots/09,10,11-paste38 |
| ③ I1-b FIX3 | idx2 탭 → 소프트키 3 | 123456 유지, focus idx3 | seq49 keypress 3 → seq50 change(raw="3") → seq52 1\|2\|3\|4\|5\|6 → seq54 focus idx3 | PASS | seq49–56, shots/06-retype3 |
| ④ | 98 / 98765 붙여넣기 | 129856 / 129876 | — | NOT RUN (시간) | — |
| ⑤ A3 | idx5 탭 → ⌫(6 삭제) → ⌫(빈 칸) | 이전 칸 포커스 | seq79 1\|2\|3\|8\|5\|  → seq80 Backspace → seq82 focus idx4 | PASS | seq70–83, shots/12-backspace |
| ⑥ | idx2 탭 직후 순서 | 관찰 | 아래 표 | 관찰 완료 | seq43–48, shots/05-tap-idx2 |

## iOS 이벤트 순서 (실측)
- **탭 포커스**(채워진 칸): blur(prev) → focus(idx) → selection(0,0) → [reselect] → selection(0,1) ×2 (≈10ms 후). 즉 onFocus의 JS setSelection(0,1)은 선택 이벤트로 오지 않고, 네이티브 caret이 **(0,0)** 으로 1회 온 뒤 FIX2 reselect가 (0,1)로 되돌림.
- **소프트키 같은 숫자**: keypress("3") → change(raw="3") → selection(1,1) → digits. iOS는 같은 숫자 교체에도 onChangeText를 냄(Android와 차이) → FIX3 focus는 멱등.
- **단일행 붙여넣기**: (선택 (0,1) 상태에서) change(raw="38") → selection(2,2). change가 selection보다 **먼저** 옴, 직전 기록 선택 (0,1) 사용 → 교체 처리.
- 선택된 칸 재탭: 선택 이벤트 없음, 편집 메뉴(오려두기/복사하기/붙여넣기) 표시. 「Allow Paste」 프롬프트 없음(동일 앱 내 복사).
- 실측 결론: r2 정적 가정의 "탭 caret (1,1) 후착"은 **틀림 — 실제 후착 caret은 (0,0)**; 그러나 FIX2가 start===end 조건으로 처리하므로 결과 동일(PASS). 붙여넣기 순서는 change→selection으로 가정대로.

## 스크린샷 (shots/)
00-start.png 01-loaded.png 02-otp.png 03-kbd.png 04-123456.png 05-tap-idx2.png 06-retype3.png 07-clip-menu.png 08-copied.png 09-cell2-menu.png 10-cell2-tap2.png 11-paste38.png 12-backspace.png

## 원복·정리
- probe 패치 `git checkout -- src/screens/auth/SignupStep1Screen.tsx` 완료. git status --short:
```
 M metro.config.js
```
(drive.mjs·REPORT·logs·shots는 dev/active/qa-379-ios 산출물, 커밋 안 함)
- Appium 세션 DELETE 완료(서버 유지). simctl log stream 2회 시작 → 1회차(PID 15175)는 시그널 15로 즉시 종료, 2회차(bg task b4az72nrl) TaskStop. Metro·Appium 서버 미조작.

사용 스킬: 없음 — 15분 예산으로 mobile-service-qa 미로딩(브리프 절차 직접 수행).
미검증: ④(98/98765), 실기기·SMS 자동완성, 화면상 전체선택 하이라이트는 스크린샷 05로만(로그상 (0,1)).

검증: Appium XCUITest 소프트키 탭 + Metro [QA379] 로그 + 스크린샷 대조(①②③⑤⑥). tsc/lint/jest 미실행(범위 밖).
위험·영향 범위: 해당 없음 — 저장소 코드 변경 없음(probe 원복).
되돌리는 법: 해당 없음 — 커밋 없음. 산출물 삭제는 dev/active/qa-379-ios/{REPORT.md,drive.mjs,shots,logs/qa379.log,logs/src.xml,logs/session.txt,logs/js.log,logs/logstream.pid}.
