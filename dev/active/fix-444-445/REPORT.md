# REPORT — #444 metro blockList 앵커 + #445 Xcode 27 pod 배포 대상 보정

상태: 완료 (2026-11-28). 서브에이전트 분할: 하지 않음 — 두 건 모두 파일 3개 규모라 직접 처리가 재적재 비용보다 쌌다.

## 커밋
- `61821a2` fix(metro): anchor .claude blockList to project root (#444)
- `1306d1d` fix(ios): clamp pod deployment targets for Xcode 27 (#445)
- REPORT 커밋 (이 파일)

## #444 — metro blockList 앵커
- 변경: `metro.blocklist.js`(신규, 순수 함수 `buildClaudeBlockPattern(projectRoot)`), `metro.config.js`(require + 호출, 이유 주석 #444), `__tests__/metroBlocklist.test.ts`(신규).
- 분리 위치 판단: 루트 모듈 `metro.blocklist.js`. `metro.config.js` 에서 export 하면 테스트가 `expo/metro-config` 의 `getDefaultConfig` 를 실제로 로드해야 해 느리고 무겁다. `plugins/` 는 config plugin 전용이라 제외.
- 패턴: `^<escapeRegExp(__dirname)>[\/\\]\.claude[\/\\].*` — 브리프 스니펫에 `^` 를 추가했다. Metro 는 절대경로를 매칭하므로 루트 앞쪽 임의 위치 매칭을 막는 더 엄격한 앵커다.
- RED: 구현 전 `npx jest __tests__/metroBlocklist.test.ts ...` → `Cannot find module '../metro.blocklist'` (2 suites failed, logs/red.log). 원래 패턴 동작 RED: `node -e` 로 원 정규식 `/[\/\\]\.claude[\/\\].*/` 에 `/r/LiveMetro/.claude/worktrees/x/src/a.ts` → `true`(=worktree 자기 소스 차단, 404 원인 재현).
- GREEN: 4 tests PASS (루트 차단/통과, worktree 루트 통과/내부 .claude 차단, Windows `\\` 구분자, `.`·`(` 든 루트).
- 실측: 이 worktree에서 `CI=1 npx expo start --port 8095` 백그라운드 → `curl .../index.bundle?platform=android&dev=true&minify=false` → **HTTP=200** (metro.log: `Android Bundled 24957ms index.js (4182 modules)`) → kill. 8081 미사용. 종료 확인: sandbox off `lsof -ti:8095` 출력 없음(exit 1) — 8095 freed. 404 RED 실측은 브리프 허용대로 단위 RED로 갈음.
- 원 정규식에 같은 테스트 케이스 적용(동작 RED): 5개 중 2개 FAIL — worktree 루트에서 자기 `src/a.ts` 차단(true, 기대 false), `/r/LiveXMetro (1)/.claude/foo.ts` 차단(앵커 없음). 즉 새 테스트는 원 패턴의 결함을 잡는다.

## #445 — pod IPHONEOS_DEPLOYMENT_TARGET 하한
- expo-build-properties 조사: 일괄 pod 배포 대상 옵션 **없음**.
  - `node_modules/expo-build-properties/build/ios.js:45-53` — `ios.deploymentTarget` 은 앱 xcodeproj + Podfile.properties 만 갱신.
  - `ios.js:76-90` — `updateDeploymentTargetXcodeProject` 는 `TargetType.APPLICATION` 타깃만 필터.
  - `ios.js:92-97` — Podfile 쪽은 `ios.deploymentTarget` 프로퍼티(→ `platform :ios`)만 기록. 개별 pod 타깃 build setting 은 손대지 않음.
  - `pluginConfig.js:24` — SDK 최소 지원 `deploymentTarget: '15.1'`.
- 변경: `plugins/withPodDeploymentTarget.js`(신규, `withPodfile`), `plugins/__tests__/withPodDeploymentTarget.test.js`(신규), `app.json` plugins 에 `./plugins/withSeoulApiCleartext` 다음 줄로 등록.
- 동작: `post_install do |installer|` 블록 안 `react_native_post_install(...)` 의 짝 괄호 다음 줄에 마커(`# @generated begin withPodDeploymentTarget (#445)`) 스니펫 삽입. 하한 = Ruby 실행 시 `podfile_properties['ios.deploymentTarget'] || '15.1'`, 하한 미만만 올림. 마커 있으면 무변경(멱등). post_install 없으면 `console.warn` 1회 + 원문 반환(throw 없음). `react_native_post_install` 만 없으면 `post_install` 줄 바로 뒤에 삽입.
- RED: 구현 전 `Cannot find module '../withPodDeploymentTarget'` (logs/red.log). GREEN: 3 tests PASS (1회 삽입·위치, 2회 적용/재적용 동일, post_install 부재 시 무변경+경고).
- 실측: `CI=1 npx expo prebuild --platform ios --no-install --clean` → EXIT=0. `ios/Podfile` 62-71행에 스니펫 삽입, `grep -c "@generated begin withPodDeploymentTarget"` = **1**, 위치는 55행 `post_install` / 56행 `react_native_post_install(` 뒤, 72행 `end` 앞. `pod install`·`xcodebuild` 미실행(브리프 지시 — Jarvis 별도 검증).
- 생성물: `ios/` 가 새로 생성됨(git 미추적·ignored, `git status` clean). `android/` 는 이번 prebuild 대상 아님(생성 안 함). 그대로 둠.

## EXIT 표 (로그: dev/active/fix-444-445/logs/, 미커밋)
| 명령 | EXIT | 비고 |
|---|---|---|
| `npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache"` | 0 | husky 가 `.git/config` lock 실패(샌드박스) 출력 — 설치 자체는 성공 |
| `npm run type-check` | 0 | |
| `npx eslint --no-eslintrc -c .eslintrc.js <변경 5파일>` | 0 | 출력 없음 |
| `npx jest __tests__ plugins --watchman=false --silent` | 0 | 378 passed / 1 skipped suite, 6885 passed / 25 skipped tests (패턴이 src 테스트까지 매칭) |
| Metro 8095 bundle curl | HTTP=200 | |
| `CI=1 npx expo prebuild --platform ios --no-install --clean` | 0 | |

사용 스킬:
- test-driven-development: 미로드 — RED→GREEN 절차만 수동 적용(시간 예산 15분).
- superpowers:verification-before-completion: 로드 → 변경 없음. 게이트가 이미 이 세션에서 fresh 실행됐고, 이후 코드 변경 없음(REPORT만) 확인.
- pstack poteto-mode: 미적용 — 15분 예산 안에서 두 건 모두 소규모(파일 3개씩)라 직접 처리. 브리프 요구 대비 누락으로 기록.
- api-integration(훅 제안): 해당 없음 — Seoul API 호출 변경 없음.
테스트: 추가 `__tests__/metroBlocklist.test.ts`(4), `plugins/__tests__/withPodDeploymentTarget.test.js`(3). RED→GREEN 위 기재.
기존 실패: 없음.

검증: 위 EXIT 표 전부 실행. 미검증 — `pod install`/`xcodebuild`(Xcode 27 실제 빌드), Windows 실기 Metro, 메인 체크아웃(비-worktree)에서의 Metro 실측(단위 테스트로만 확인).
위험·영향 범위: Metro 블록 패턴이 틀리면 메인 체크아웃에서 `.claude/worktrees` 중복 Haste 충돌 재발 또는 번들 404(dev 서버만, OTA·런타임 코드 무관). Podfile 스니펫이 틀리면 iOS prebuild 후 `pod install`/네이티브 빌드 단계에서 실패(EAS iOS 빌드 영향). `src/**` 변경 없음.
되돌리는 법: `git revert 1306d1d`(#445) / `git revert 61821a2`(#444). 또는 app.json 에서 `./plugins/withPodDeploymentTarget` 한 줄 제거로 #445만 비활성.
