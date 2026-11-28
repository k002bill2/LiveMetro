# QA REPORT r3 — #379 OTP 칸 Android 에뮬레이터 실측 (emulator-5554, bad3b5c + 로컬 프로브)

판정: **조건부 PASS (r3 범위)** — 원 이슈·G·A2·6자리 붙여넣기 전부 기대값 일치. **A3(빈 칸 Backspace → 이전 칸 이동) FAIL: adb 하드웨어 DEL로는 포커스 이동 0건**(실 소프트키보드 미검증). r2의 A1-a 포커스 FAIL은 FIX3 레인 소관으로 유지.

## 시나리오 표 (값 = [QA379] digits 로그 L1, 스크린샷은 shots/r3-*.png)
| 시나리오 | 기대 | 관측 | 결과 | 근거 |
|---|---|---|---|---|
| 준비 1→6 | 123456 | 123456 | PASS | shots/r3-05-prep.png |
| ① 원 이슈 3번째 칸 PASTE `98` | 129856 | 129856 (seq36 change raw=98 → seq38 digits 1/2/9/8/5/6), 포커스 idx4 | PASS | r3-10-orig-98.png, js-r3.log seq32–41 |
| ① 원 이슈 PASTE `98765` | 129876 | 129876 (seq65 raw=98765 → seq67), 넘치는 5는 버림, 포커스 idx5 | PASS | r3-11-orig-98765.png, seq61–70 |
| ② G `33` | 123356 | 123356 (seq102→104), 포커스 idx4 | PASS | r3-12-G-33.png, seq98–107 |
| ② G `83` | 128356 | 128356 (seq122→124), 포커스 idx4 | PASS | r3-13-G-83.png, seq118–126 |
| ③ A2 탭 → MOVE_END(123) → `8` | 128456 | 128456 (seq152 raw=**"8"** → seq156), 포커스 idx3 | PASS(값) · 관찰 있음 | r3-14-A2.png, seq145–156 |
| ④ A3 빈 칸 Backspace → 이전 칸 → `5` | 이전 칸(idx4) 포커스, 그 칸만 5 | idx5 탭→DEL로 6 삭제(seq169–172) 후 **빈 idx5에서 DEL → focus/blur 이벤트 0건, 포커스 idx5 유지**. 이후 `5` → idx5=5(123455), `9` → idx5=9(123459) | **FAIL**(adb 하드웨어 키 범위) | r3-15-A3.png, seq166–179 |
| ⑤ 6자리 `654321` 붙여넣기(idx2) | 654321 | 654321 (seq189 raw=654321 → seq191, 첫 칸부터 분배), 포커스 idx5 | PASS | r3-16-paste6.png, seq185–194 |
| ⑥ 롱프레스 → 「Paste」 메뉴 탭(`38`, idx2) | 123856 | 123856 (249:change@2raw=38 251:digits=1|2|3|8|5|6) | PASS | r3-17-longpress.png(메뉴 표시, 좌표는 스크린샷 실측 456,491), r3-18-menu-paste.png |

## 이벤트 순서표 (r3 실측 — r2 결론과 일치)
| 상황 | 순서 |
|---|---|
| 채워진 칸 탭 | selection(0,1) → focus → selection(1,1) → reselect → (selection(0,1)) |
| 채워진 칸 PASTE N자리 | (탭 순서) → **change(raw=N자리)** → selection(N,N) → digits → blur(cur) → selection/focus(다음 칸) |
| A2 MOVE_END 후 타이핑 | reselect → selection(0,1) → **selection(1,1)**(MOVE_END) → change(raw="8") → blur → focus(idx3) → digits |
| 채워진 칸 DEL | change(raw="") → selection(0,0) → reselect(빈 값이라 setSelection 생략) → digits |
| 빈 칸 DEL(adb keyevent 67) | **이벤트 없음** (onKeyPress는 프로브 미계측 — 포커스 이동 부재로 판정) |

**G1·G2 실측 결론:** Android(RN 0.83 Fabric, adb 입력)에서는 값 변경 시 **onChangeText가 onSelectionChange보다 먼저** 온다 → handleOtpChange는 변경 직전 선택 기록을 사용한다(①②⑤ 전부 정확).

## 결함
### [P2] A3 빈 칸에서 Backspace 시 이전 칸으로 포커스가 이동하지 않음 (adb 하드웨어 DEL)
재현 단계:
1. 123456 상태에서 6번째 칸 탭.
2. `adb -s emulator-5554 shell input keyevent 67` → 6번째 칸 비워짐(정상).
3. 같은 빈 칸에서 `input keyevent 67` 한 번 더.
기대: 5번째 칸으로 포커스 이동(handleOtpKeyPress `src/screens/auth/SignupStep1Screen.tsx` ≈L256–262).
실제: focus/blur [QA379] 이벤트 0건, 이후 입력이 6번째 칸으로 들어감(seq173 change@5).
원인 추정(미확정): Android에서 빈 EditText에 대한 하드웨어 DEL은 RN onKeyPress 'Backspace'를 내지 않을 수 있음(프로브가 onKeyPress를 계측하지 않아 L2 추정). 실 소프트키보드(Gboard/삼성)에서의 재현 여부 미검증 → P2(소프트키보드에서도 재현되면 P1 상향 검토). #379 변경 범위(붙여넣기 분배) 밖의 기존 동작일 가능성 있음.
증거: shots/r3-15-A3.png, logs/js-r3.log seq166–179.

## 관찰 (결함 아님)
- A2: MOVE_END로 selection(1,1)이 기록됐는데도 change raw가 "38"이 아니라 "8" — 네이티브가 직전 전체선택(reselect의 setSelection)을 기준으로 교체한 것으로 보임. 결과값은 기대(128456)와 같아 영향 없음.

## 편차·조건
- OTP 화면 uiautomator dump가 idle 실패(r2와 동일) → 셀 좌표는 스크린샷 실측(×1.2 환산: x=125/292/457/623/788/954, y=617). **매 탭 결과를 [QA379] focus idx로 검증**(전 케이스 idx 일치).
- 클립보드는 qa-clip-src 칸 → Ctrl+A → input text → Ctrl+A → COPY(278)로 앱 내부에서만 준비(호스트 pbcopy 미사용).
- 로그 수집: `logcat -c`가 auto-mode 분류기에 거부되어 `logcat -T 1 -s ReactNativeJS:V`로 대체(새 줄만 수집).
- 범위: Android 에뮬레이터 + adb 하드웨어 입력. 삼성 키보드·실 SMS 자동완성·iOS 범위 밖.

## 원복 / 실기기
- 프로브 패치: `git checkout -- src/screens/auth/SignupStep1Screen.tsx` 실행. 실행 후 `git status --short`:
```
M metro.config.js
```
  (남은 ` M metro.config.js`는 Jarvis 로컬 프로브 — lane 미접촉. dev/active/qa-379-emu/는 gitignore 산출물로 표시 안 됨)
- Metro(8081): lane이 띄우지도 끄지도 않음. logcat 백그라운드 태스크 TaskStop으로 종료.
- 에뮬레이터 앱은 OTP 화면에 그대로(프로브 해제 후 다음 리로드 시 원래 코드). 「인증」·「재전송」 미탭(타이머 00:00 후 버튼 활성화됐지만 누르지 않음).
- 실기기 R3CMC08YHMX: 모든 adb에 `-s emulator-5554`만 사용, 실기기 조회·접촉 0회. lastUpdateTime 확인은 r2 메모대로 Jarvis 몫(미조회).

사용 스킬: 없음 — 15분 예산 내 r3 시나리오 실측 우선(mobile-service-qa 미로드; 증거 규칙은 QA lane 규칙으로 적용)
미검증: 실 소프트키보드 입력(A3·A1-a 재현 여부), 삼성 키보드·실 SMS 자동완성·iOS(범위 밖), onKeyPress 계측(프로브 미포함).
검증: 에뮬레이터 adb 입력 + [QA379] logcat(logs/js-r3.log) + screencap(shots/r3-*.png)로 ①~⑥ 실행. 저장소 테스트(jest/tsc) 미실행 — 이번 범위 아님.
위험·영향 범위: 저장소 코드 변경 없음(프로브 원복). A3 결함 영향 = 빈 칸 Backspace로 이전 칸 이동 불가(하드웨어 키 기준).
되돌리는 법: 해당 없음 — 저장소 변경 없음(REPORT·로그·스크린샷은 untracked 산출물, 삭제하면 끝).
