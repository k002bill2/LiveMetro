# QA REPORT — #444 metro blockList 앵커 / #445 pod 배포 대상 config plugin

대상: `fix/444-445-local-build` (`61821a2`, `1306d1d`, `dc1769b`), 기준 main `47d7991`. 실행일 2026-11-29.
서브에이전트 분할: 하지 않음 — 분석 대상이 파일 6개라 직접 읽는 편이 빨랐다(15분 예산).

## 판정: 조건부 PASS
두 수정 모두 동작은 맞다(#444는 Metro 실측 통과, #445는 생성된 Podfile·템플릿과 일치). 결함 3건(P2 1, P3 2)은 모두 **테스트가 약하다**는 문제이고 지금 동작을 깨뜨리지 않는다. 머지 전 P2를 고치거나 후속 이슈로 남기는 것을 권장한다.

| 기준 | 결과 | 증거 |
|---|---|---|
| #444 Metro가 blockList에 넘기는 경로 형식 | PASS — 절대경로, 구분자 정규화 없음 | `node_modules/metro/src/node-haste/DependencyGraph/createFileMap.js:40-41` (blockList→ignorePattern), `node_modules/metro-file-map/src/index.js:354-355` `ignoreForCrawl: ignorePattern.test(filePath)`, `crawlers/node/index.js:73` `path.join(directory, entry.name)` = 절대경로. `^` 앵커는 이 형식에서 맞다 |
| #444 symlink·대소문자 시나리오 | PASS (실제 영향 없음) | projectRoot = `path.resolve('.')` (`@expo/cli/build/src/utils/args.js:102-103`) = `process.cwd()`. macOS getcwd는 물리 경로를 반환한다. 실측: 소문자 경로 `cd <repo root, lowercased>/...` 후 `process.cwd()` → `<repo root>/...`(정규 대소문자). `__dirname`도 realpath라 둘이 같다. 어긋나더라도 패턴이 덜 막는 쪽이고 프로젝트 자신을 막지는 않는다(404 재발 불가) |
| #444 메인 회귀(가짜 사본 차단) | PASS | 아래 실측 |
| #445 Ruby 스코프 | PASS(정적) | `ios/Podfile:5`에서 `podfile_properties`를 최상위 지역변수로 정의. `post_install do`는 블록(클로저)이라 이 변수를 볼 수 있고, 같은 블록의 기존 코드(`ios/Podfile:60` `ccache_enabled?(podfile_properties)`)가 이미 쓰고 있다. 삽입 위치는 61-71행, `end` 앞 |
| #445 nil / 더 높은 값 / to_f | PASS(부작용 무해) | `ruby -e`: `nil.to_f`=0.0 → 값이 없는 pod 타깃에는 명시적으로 15.1이 들어간다(어차피 `platform :ios`와 같은 값이라 무해). `"16.0".to_f < "15.1".to_f`=false → 더 높은 값은 유지. ios.deploymentTarget을 16.0으로 올리면 16 미만 pod을 모두 16으로 올린다(앱 하한과 같으니 의도에 맞음). 문자열 비교가 아니라 `to_f` 비교 |
| #445 템플릿 기준 삽입 위치 | PASS | `node_modules/expo/template.tgz`의 Podfile post_install 블록이 테스트 SAMPLE_PODFILE과 글자 단위로 같다. 생성된 `ios/Podfile`에 마커 1회 |
| #445 테스트가 뮤턴트를 잡는가 | 부분 — 구조 뮤턴트 3/3은 잡고, Ruby 의미 뮤턴트 3/3은 놓친다 | 아래 표 |
| Android prebuild 무영향 | PASS | `node -e`: 플러그인 적용 후 `Object.keys(config.mods)` = `['ios']`, ios = `['podfile']` |
| 테스트가 동작을 검증하는가 / withSeoulApiCleartext 패턴과 일관 | 부분 | 둘 다 실제 config-plugins mod 체인을 태운다(일관). 다만 #445 테스트는 Ruby를 실행하지 않고 텍스트만 비교한다 |
| 빌더 테스트 재실행 | PASS | `npx jest __tests__/metroBlocklist.test.ts plugins/__tests__ --watchman=false` → Suites 3 passed, Tests 12 passed |

### #444 Metro 실측 (8097)
1. 이 worktree 루트에 `.claude/worktrees/dup/` 생성: `package.json`(name = 루트와 같은 `livemetro-subway-app`), `index.js`, `dupmod.js`(마커 문자열 `DUP_FIXTURE_MARKER_444`).
2. `CI=1 npx expo start --port 8097` 실행. 샌드박스 안에서는 포트 바인딩이 막혀 Expo가 "Port 8097 is being used"로 오판했다. sandbox off `lsof`로 8097이 비어 있음을 확인한 뒤 sandbox off로 다시 실행했다.
3. `index.bundle?platform=android&dev=true&minify=false` → **HTTP 200**, 22,826,120 bytes, `Android Bundled 2377ms index.js (4182 modules)`. 번들 안 마커 문자열 0건.
4. `/.claude/worktrees/dup/index.bundle` → **HTTP 404**, `UnableToResolveError … None of these files exist: .claude/worktrees/dup/index(...)`. 파일은 디스크에 있으니 file map에서 빠졌다는 뜻 = 차단이 동작한다.
5. 대조군: 루트 파일 `/metro.blocklist.bundle` → HTTP 200(같은 요청 형식이 정상 파일에는 동작함).
6. Metro 로그에서 `haste|collision|duplicate|error` grep → **0건**.
7. 정리: `pkill -f 'expo start --port 8097'` → sandbox off `lsof -iTCP:8097` exit 1(리스너 없음). `.claude/worktrees/` 삭제 확인(`No such file or directory`).

### #445 뮤턴트 (저장소 안 gitignored 복사본 `dev/active/qa-444-445/mut/`에서 실행, 추적 파일은 건드리지 않음, 실행 후 삭제)
| 뮤턴트 | 결과 |
|---|---|
| M1 마커 검사 제거 | 잡음 (idempotent 테스트 실패) |
| M2 삽입 위치를 post_install 앞으로 | 잡음 |
| M3 삽입 위치를 post_install 줄 바로 뒤(react_native_post_install 앞)로 | 잡음 |
| M4 `to_f` 비교를 문자열 비교로 | **놓침** (3 passed) |
| M5 하한을 `'15.1'`로 고정(properties 무시) | **놓침** (3 passed) |
| M6 하한 미만 가드 제거(`if true` → 더 높은 pod도 15.1로 낮춤) | **놓침** (3 passed) |
원본: 3 passed.

## 결함
### [P2] #445 테스트가 Ruby 보정 로직을 실행하지 않아 핵심 동작 회귀를 못 잡음
- 재현: 1) `plugins/withPodDeploymentTarget.js:30`의 조건을 `if true`로 바꾼 복사본을 만든다. 2) 그 복사본에 대해 `plugins/__tests__/withPodDeploymentTarget.test.js`를 실행한다. 3) 3 passed.
- 기대: "하한 미만만 올리고 더 높은 값은 유지"(플러그인 주석 :14)가 깨지면 테스트가 실패해야 한다.
- 실제: 통과한다. M4(문자열 비교)·M5(하한 고정)도 통과한다.
- 영향: 나중에 스니펫을 고치다 회귀가 나면 16+를 요구하는 pod을 15.1로 낮춰 iOS 네이티브 빌드가 깨질 수 있는데, CI가 잡지 못한다. 이 레포에서는 ios/가 생성물이라 다른 게이트도 없다.
- 제안: `ruby`가 있으면 SNIPPET을 가짜 installer(build_settings 해시 3개: nil / '12.0' / '16.0')로 실행해 결과값을 단언한다. 아니면 최소한 조건 줄 전체를 단언한다.
- 증거: 위 뮤턴트 표(이 세션의 REPL 출력).

### [P3] #445 assertion 하나가 픽스처 때문에 항상 참
- 위치: `plugins/__tests__/withPodDeploymentTarget.test.js:50` `expect(out).toContain("podfile_properties['ios.deploymentTarget'] || '15.1'")`.
- 재현: SAMPLE_PODFILE 1행(`platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'`)에 같은 문자열이 이미 있다 → M5에서 스니펫이 이 문자열을 잃어도 통과한다.
- 기대: 스니펫 줄을 단언한다(예: `"pod_min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'"`).
- 영향: 이 줄의 검증이 사실상 없다.

### [P3] #445 `to_f` 버전 비교는 두 자리 마이너 버전에서 틀린다
- 위치: `plugins/withPodDeploymentTarget.js:30`.
- 재현: `ruby -e 'p "15.10".to_f'` → 15.1 (그래서 "15.10" < "15.2"로 판정된다).
- 영향: 지금 iOS 배포 대상 값(15.1 등)에서는 문제가 없다. `Gem::Version.new(...)`로 비교하면 없어진다. 참고용.

## 사용 스킬
- 없음 — QA 라우팅 표의 항목(웹·모바일 UI·feature-liveness·e2e)에 해당하는 검사가 없다(빌드 설정·dev 서버 동작 검사). 레포 훅이 제안한 api-integration / react-native-development는 Seoul API·화면 변경이 없어 해당 없음. principle-prove-it-works는 시간 예산 때문에 읽지 않았고, 각 PASS 줄에 명령/출력을 직접 붙이는 방식으로 대신했다.

## 미검증
- `pod install`·`xcodebuild`(Xcode 27 실빌드): 브리프 금지 — Jarvis가 병행 중. Ruby 스코프는 정적 판정만 했다(실행 증거는 Jarvis의 pod install).
- 실제 메인 체크아웃(비-worktree)에서의 Metro: 브리프가 정한 대로 worktree 안 가짜 사본으로 대신했다. 루트 경로만 다르고 같은 함수가 같은 경로 형식에 적용된다.
- Watchman 크롤러 경로: 이번 실측은 sandbox off에서 돌렸고 어느 크롤러를 썼는지 로그로 확인하지 않았다. Watchman 루트는 realpath이고 `__dirname`도 realpath라 같다고 보지만 검증하지는 않았다(추정, Medium).
- Windows 실기.

검증: `npx jest __tests__/metroBlocklist.test.ts plugins/__tests__ --watchman=false`(12 passed), Metro 8097 bundle 3종 curl(200/404/200) + 로그 grep 0건, 뮤턴트 6종, `ruby -e` to_f 확인, `node -e` mods 키 확인, 템플릿 tgz Podfile 비교. 실행하지 않은 것: 위 미검증 목록.
위험·영향 범위: 이 커밋은 QA 보고서만 추가한다. 앱·설정 변경 없음.
되돌리는 법: `git revert <이 REPORT 커밋 SHA>` 또는 `git rm dev/active/qa-444-445/REPORT.md`.
