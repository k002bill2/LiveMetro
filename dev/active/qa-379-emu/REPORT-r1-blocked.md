# QA REPORT — #379 OTP 칸 Android 에뮬레이터 실측 (bad3b5c)

판정: **BLOCKED** — 앱 JS 번들이 로드되지 않아 OTP 화면에 도달하지 못함. 시나리오 0건 실행.

## 수용 기준 표
| 항목 | 결과 | 근거 |
|---|---|---|
| A1-a (3번째 칸 같은 숫자 재입력 → 123456 유지) | NOT RUN (BLOCKED) | 번들 로드 실패 |
| A1-b (38 붙여넣기 → 123856, 키/롱프레스 메뉴) | NOT RUN (BLOCKED) | 〃 |
| 원 이슈 98/98765, A2, A3, G 보강, 6자리 붙여넣기 | NOT RUN (BLOCKED) | 〃 |
| 이벤트 순서표 (focus/selection/change/reselect) | NOT RUN — G1·G2 가정은 여전히 **미실측** | logs/js.log 0줄 |

## 차단 원인 (L1, 증거 있음)
1. dev client에서 `http://10.0.2.2:8081` 선택 → Metro가 404 `UnableToResolveError: Unable to resolve module ./index from .../qa-379-emu/.` 반환 (shots/02-app.png, `adb logcat -b crash`). `index.js`는 실제로 존재함(`ls index*` → index.js, package.json main=index.js).
2. metro.log: watchman이 상위 저장소 `<repo root>`를 watch root로 잡고 "Recrawled this watch 7 times … MustScanSubDirs UserDroppedTo" 경고. 즉 중첩 worktree(`.claude/worktrees/…`)의 파일이 watchman 크롤 결과에서 빠져 해석 실패로 추정(L2, 추정).
3. 워크트리에 임시 `.watchmanconfig`를 두고 `--clear` 재시작했으나 같은 경고 유지(기존 상위 watch가 우선). 상위 watch를 `watchman watch-del` 하는 것은 다른 세션 Metro에 영향 가능 → 하지 않음.

## 해소 방안 (Jarvis 결정 필요, ★ 추천)
- ★ A: 워크트리를 저장소 밖 경로로 복제(예: scratch 하위 detached worktree)하거나 `metro.config.js` 로컬 프로브에 `resolver.useWatchman=false` 추가 후 재실행. 실행 15분 예산이면 설정 ~3분 + 시나리오 ~10분 → 20분 이상 예산 권장.
- B: 상위 저장소 watchman watch 재설정(`watch-del`) — 다른 세션 Metro 재크롤 유발, 비권장.

## 실행한 것
- 1단계 프로브 패치(SignupStep1Screen.tsx: phase 'otp', [QA379] 로그 7종, qa-clip-src 입력칸) 적용 → 번들 불가로 미사용 → `git checkout --`로 원복.
- `adb -s emulator-5554 reverse tcp:8081`, `npx expo start --port 8081`(2회), `logcat -s ReactNativeJS:V`, `am start -n com.livemetro.app/.MainActivity`, uiautomator dump 기반 탭(10.0.2.2:8081 항목 bounds [179,609][542,660]).
- 스크린샷: shots/00-launch.png(dev launcher), shots/01-app.png(크래시 후 런처), shots/02-app.png(크래시 리포트 404).

## 원복 증명
- `git status --short` → 빈 출력(2026-11-28 21:21 KST). `.watchmanconfig` 삭제됨. dev/active/qa-379-emu/는 ignored.
- metro·logcat: TaskStop 후 `pgrep -fl "expo start|logcat -s ReactNativeJS"` → none. `adb -s emulator-5554 reverse --remove tcp:8081` 실행, 앱 force-stop.

## 실기기 미접촉
- 모든 adb 호출에 `-s emulator-5554` 사용. 실기기 R3CMC08YHMX `lastUpdateTime` 조회는 **하지 않음**: 브리프는 조회를 요구했으나 사용자 지시 「실기기 접촉 금지」와 충돌하고, 시도 시 auto-mode 분류기가 거부함 → 읽기 전용 조회조차 미실행. 미접촉의 근거는 명령 이력(전부 -s emulator-5554)뿐.

사용 스킬: 없음 — mobile-service-qa 로딩은 15분 예산 때문에 생략(브리프가 adb 절차를 직접 명시). 
미검증: 모든 시나리오·이벤트 순서(번들 로드 차단). 삼성 키보드·SMS 자동완성·iOS는 원래 범위 밖.

검증: 위 adb/Metro 실행과 git status·pgrep 확인만 실행. OTP 동작은 전혀 검증하지 못함.
위험·영향 범위: 저장소 변경 없음(원복 완료). 에뮬레이터 앱 상태만 force-stop.
되돌리는 법: 해당 없음 — 남은 변경 없음(git status 빈 출력).
