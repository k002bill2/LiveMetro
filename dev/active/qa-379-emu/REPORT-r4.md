# QA REPORT r4 — #379 FIX3(2da1c8b) Android 에뮬레이터 소프트 키보드 실측

판정: **PASS (r4 범위)** — FIX3 같은 숫자 재입력 포커스 이동, 대조(다른 숫자), 마지막 칸, A3(빈 칸 Backspace), 회귀 PASTE `98` 전부 기대값 일치.
**A3 결론: r3의 하드웨어 DEL FAIL은 소프트키(Gboard ⌫)로는 재현되지 않는다** — Gboard ⌫는 onKeyPress('Backspace')를 내고 이전 칸으로 포커스가 이동한다(seq67–70). r3 FAIL은 adb keyevent 경로 한정(하드웨어 키보드 사용자에게는 여전히 해당 — P3로 하향 권고).

환경: emulator-5554(AVD LiveMetro_API_34), worktree HEAD `2da1c8b` + 로컬 프로브(종료 후 원복), Metro 8081(Jarvis 실행분, 미접촉), 앱 `am force-stop` 후 재실행으로 새 번들 수신.
입력: **Gboard(`com.google.android.inputmethod.latin/...LatinIME`, mInputShown=true) 숫자패드(inputType 0x4002)** 키 탭. 키 좌표는 shots/r4-03-kbd.png 실측(×1.2): x=138/406/672/941, y=1724/1880/2036/2190(⌫=941,2036). 셀 좌표 x=126/292/456/622/787/954, y=618 — 매 탭을 [QA379] focus idx로 검증(전부 일치). 예외: 회귀 ⑥의 붙여넣기만 `input keyevent 279`(브리프 허용).

## 시나리오 표 (값 = [QA379] digits 로그 L1 + 스크린샷)
| # | 시나리오 | 기대 | 관측 | 결과 | 근거 |
|---|---|---|---|---|---|
| ① | 준비 소프트키 1→6 | 123456, 자동 이동 | 각 키마다 keypress→change→selection→digits→blur→focus(idx+1), 최종 1|2|3|4|5|6 | PASS | seq3–36, r4-05-prep.png |
| ② | **A1-a** idx2 탭 → 소프트키 `3` | 123456 유지 + 포커스 idx3 | keypress(idx2,"3") → selection(1,1) → reselect → **change 없음** → blur(2) → focus(idx3); digits 이벤트 없음(값 불변) | **PASS** | seq37–45, r4-06-A1a.png(4번째 칸 선택 표시) |
| ③ | A1-a 대조 idx2 탭 → `7` | 127456(브리프 표기 123756은 오기 — 3번째 칸 교체 결과는 127456), 포커스 idx3 | keypress("7") → selection → reselect → change(raw="7") → digits 1|2|7|4|5|6 → focus(idx3) | PASS | seq46–55, r4-07-A1a-ctrl7.png |
| ④ | 마지막 칸 idx5 탭 → 같은 숫자 `6` | 이동 없음, 값 유지 | keypress(idx5,"6") → selection(1,1) → reselect → selection(0,1); focus/blur/change 없음 | PASS | seq56–62, r4-08-last-same.png |
| ⑤ | **A3** idx5 ⌫(6 삭제) → 빈 idx5에서 ⌫ | 이전 칸(idx4) 포커스 | 1회: keypress Backspace → change("") → digits 1|2|7|4|5|. 2회(빈 칸): **keypress(idx5,"Backspace") → blur(5) → selection(idx4,0,1) → focus(idx4)** | **PASS** | seq63–70, r4-09-A3.png |
| ⑥ | 회귀: idx5 복원(6) 후 idx2 탭 → PASTE `98`(qa-clip-src → Ctrl+A → COPY → keyevent 279) | 129856 | change(raw="98") → digits 1|2|9|8|5|6 → focus(idx4) | PASS | seq71–86, r4-10-paste98.png |

## 이벤트 순서 (r4 소프트키 신규 관찰)
| 상황 | 순서 |
|---|---|
| 빈 칸 소프트키 숫자 | **keypress → change → selection(1,1)** → digits/blur/focus(다음) — onKeyPress가 onChangeText보다 먼저 |
| 채워진 칸 같은 숫자 | keypress → selection(1,1) → reselect → (change 없음) → FIX3 focus(idx+1) |
| 채워진 칸 다른 숫자 | keypress → selection(1,1) → reselect → change → digits → focus(idx+1) |
| 빈 칸 ⌫ | keypress('Backspace') → blur → focus(idx-1) (change 없음) |
| PASTE(keyevent 279) | selection(1,1) → reselect → change(raw=2자리) → selection(2,2) → digits → focus — keypress 없음 |

관찰(결함 아님): 채워진 칸에서 키 입력 직전 selection(1,1)이 와서 reselect(setSelection(0,1))가 한 번 더 실행된다. 값·포커스 결과에는 영향 없음(②③⑥ 정확).

## 결함
- 신규 결함 없음.
- r3 [P2] A3(adb 하드웨어 DEL에서 onKeyPress 미도착): 소프트키에서는 재현 안 됨 → **하드웨어/외장 키보드 한정 [P3]로 재분류 권고**. 증거: r4 seq67–70 vs r3 seq166–179.

## 원복·미접촉 증명
- `git checkout -- src/screens/auth/SignupStep1Screen.tsx` 후 `git status --short`: `M metro.config.js` (metro.config.js = Jarvis 프로브, lane 미접촉).
- Metro(8081): 시작·종료하지 않음. logcat 백그라운드 프로세스는 띄우지 않음(`logcat -d` 단발 덤프만) → 정리할 프로세스 없음.
- 실기기 R3CMC08YHMX: 모든 adb 명령에 `-s emulator-5554`. 실기기 lastUpdateTime 조회는 r2 메모대로 Jarvis 담당(lane 미조회).
- 증거: logs/js-r4.log([QA379] 전 라인), shots/r4-00-start … r4-10-paste98.png.

사용 스킬: 없음 — 브리프가 절차·명령을 전부 지정했고 15분 예산 내 단일 기기 순차 조작이라 mobile-service-qa 미로드(사유 기록).
미검증: 삼성 키보드·실제 SMS 자동완성·iOS·롱프레스 「붙여넣기」 메뉴(r3에서 PASS, r4 범위 외)·하드웨어 키보드 실기기.

검증: 위 ①–⑥을 emulator-5554에서 Gboard 소프트키 탭으로 실행, [QA379] 로그(L1)와 스크린샷 대조. tsc/lint/jest는 이번 범위 아님(미실행).
위험·영향 범위: 코드 변경 없음(프로브 원복). 결론이 틀리면 영향은 #379 머지 판단(OTP 칸 포커스 UX)에 한정.
되돌리는 법: 해당 없음 — 저장소 코드 변경 없음(REPORT.md·logs/js-r4.log·shots/r4-*는 미커밋 산출물, 삭제로 원복).
