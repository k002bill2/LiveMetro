# QA REPORT r2 — #379 OTP 칸 Android 에뮬레이터 실측 (emulator-5554, bad3b5c)

판정: **FAIL (조건부)** — A1-b PASS, A1-a 값 유지 PASS·**포커스 이동 FAIL**. 나머지 시나리오는 시간(15분 예산) 부족으로 NOT RUN.

## 시나리오 표
| 시나리오 | 기대 | 관측(digits 로그 L1 + screencap) | 결과 | 근거 |
|---|---|---|---|---|
| 준비 1→6 타이핑 | 123456, 자동 포커스 이동 | seq30 digits 1|2|3|4|5|6, 매 칸 focus 이동 | PASS | shots/r2-05-prep.png, js-r2.log seq2–30 |
| A1-a 3번째 칸 탭 → input text 3 | 123456 유지 + 포커스 4번째 칸 | 값 123456 유지. **onChangeText 미발생 → 포커스 3번째 칸에 머묾(선택 하이라이트 유지)** | 값 PASS / 포커스 **FAIL** | shots/r2-06-A1a.png, seq31–36 (change 이벤트 없음) |
| A1-b 3번째 칸 탭 → PASTE(38, keyevent 279) | 123856 | seq44 digits 1|2|3|8|5|6, 포커스 5번째 칸(idx4) | PASS | shots/r2-07-A1b.png, seq37–47 |
| A1-b 롱프레스 → 「붙여넣기」 메뉴 | 123856 | — | NOT RUN | 시간 |
| 원 이슈 98 / 98765 | 129856 / 129876 | — | NOT RUN | 시간 |
| A2 MOVE_END → 8 | 128456 | — | NOT RUN | 시간 |
| A3 Backspace 이전 칸 → 5 | 해당 칸만 5 | — | NOT RUN | 시간 |
| G 보강 33 / 83 | 123356 / 128356 | — | NOT RUN | 시간 |
| 6자리 654321 붙여넣기 | 654321 | — | NOT RUN | 시간 |

## 이벤트 순서표 (실측, Android RN 0.83 Fabric, adb 하드웨어 입력)
| 상황 | 순서 (seq) |
|---|---|
| 빈 칸 탭 후 타이핑 | focus(idx,cur="") → change(raw="1") → selection(1,1) → blur(idx) → focus(idx+1) → digits |
| 채워진 칸 탭 | **selection(0,1)** → focus → selection(1,1) [탭 caret이 전체선택을 덮음] → reselect → selection(0,1) |
| 채워진 칸에 같은 숫자 타이핑(A1-a) | 위 탭 순서 이후 **change 없음, selection 없음** (텍스트 불변 → 네이티브가 onChangeText 미발행) |
| 채워진 칸에 PASTE "38"(A1-b) | (탭 순서) → **change(raw="38") → selection(2,2)** → digits |

**G1·G2 실측 결론:** Android에서는 값 변경 시 **change가 selection보다 먼저** 온다(selection(2,2)는 change 뒤). 따라서 handleOtpChange가 쓰는 선택은 변경 *직전*의 selection(0,1) 기록이며 교체 판정이 정확했다(A1-b PASS). 또한 채워진 칸 탭에서는 selection(0,1)이 focus보다 먼저, 이어 접힌 caret selection(1,1)이 오며 FIX2 reselect가 실제로 발동해 (0,1)로 되돌린다.

## 결함
### [P1] A1-a 같은 숫자 재입력 시 다음 칸으로 포커스가 이동하지 않음
재현 단계:
1. OTP 6칸에 1~6 입력(123456).
2. 3번째 칸 탭(값 3 전체선택됨).
3. `adb -s emulator-5554 shell input text 3`.
기대: 값 123456 유지 + 포커스 4번째 칸. 실제: 값은 유지되나 포커스·선택이 3번째 칸에 그대로(screencap 하이라이트), [QA379] change 이벤트 0건.
원인 위치: `src/screens/auth/SignupStep1Screen.tsx` handleOtpChange(≈L202–217) — 포커스 전진은 onChangeText 안에서만 일어나는데, 선택된 "3"을 "3"으로 교체하면 텍스트가 같아 Android가 onChangeText를 내지 않는다. 대응 경로(onKeyPress 등)가 없음. handleOtpKeyPress(≈L256)는 Backspace만 처리.
영향: A1 「머지 전 필수」 중 포커스 이동 항목 미충족. 값 손상은 없음(사용자가 다음 칸을 직접 탭하면 계속 가능) → 우회 가능하나 수용기준 미달이라 P1로 분류(Jarvis 재분류 가능).
증거: shots/r2-06-A1a.png, logs/js-r2.log seq31–36.
주의: 실 키보드(소프트 키) 입력에서도 같은지는 미검증 — adb input text는 IME commitText 경로.

## 참고 관찰
- OTP 화면에서 `uiautomator dump`가 `ERROR: could not get idle state.`(커서 Animated.View 반복 애니메이션 추정)로 실패. 셀 좌표는 dump 대신 스크린샷 실측(900px 표시 → 1080 환산 ×1.2)으로 산출 — 브리프의 「좌표 추측 금지」에 대한 편차, 탭 결과는 매번 focus 로그 idx로 검증함.
- 로그인/회원가입 진입 경로는 dump로 확보(email-cta → goto-signup).

## 산출물
- 스크린샷: shots/r2-00-launch.png, r2-01.png, r2-03.png, r2-05-prep.png, r2-06-A1a.png, r2-07-A1b.png
- 로그: logs/js-r2.log ([QA379] 라인), logs/ui-r2-*.xml

## 원복 / 실기기
- 프로브 패치: `git checkout -- src/screens/auth/SignupStep1Screen.tsx` (아래 결과 참조). metro.config.js는 Jarvis 소관이라 미접촉.
- Metro: lane이 띄우지도 끄지도 않음. logcat 백그라운드 태스크는 종료.
- 실기기 R3CMC08YHMX: lane은 모든 adb 명령에 `-s emulator-5554`만 사용, 실기기 조회·접촉 0회(lastUpdateTime 확인은 r2 메모대로 Jarvis 몫).

사용 스킬: 없음 — 15분 예산 내 A1 실측 우선(mobile-service-qa 미로드; 증거 규칙은 lane 규칙으로 적용)
미검증: 롱프레스 붙여넣기 메뉴, 원 이슈 98/98765, A2, A3, G 보강, 6자리 붙여넣기(시간), 삼성 키보드·실 SMS 자동완성·iOS(범위 밖), 소프트키보드 탭 입력 시 A1-a 재현 여부.
검증: 에뮬레이터 adb 입력 + [QA379] logcat + screencap로 준비·A1-a·A1-b 실행. 나머지 미실행.
위험·영향 범위: 코드 변경 없음(로컬 프로브는 원복). 결함 영향은 OTP 칸 같은 숫자 재입력 시 포커스 미전진.
되돌리는 법: 해당 없음 — 저장소 변경 없음(REPORT·로그·스크린샷은 untracked 산출물, 삭제하면 끝).
