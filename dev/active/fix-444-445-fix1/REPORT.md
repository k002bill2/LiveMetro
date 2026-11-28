# FIX1 REPORT — #445 테스트 강화 + 버전 비교 보정

## 체크리스트
- [x] 1. Ruby 실행 테스트 (stdin 입력, 임시 파일 없음, SNIPPET export 사용) + CI 게이트 + 뮤턴트 M4/M5/M6
- [x] 2. 항상 참 assertion → 스니펫 줄 `    pod_min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'\n` 단언으로 교체
- [x] 3. `to_f` → `Gem::Version` 비교 (nil/빈 값 = 하한 미만, 현행 유지), 주석 갱신
- [x] 검증 3종 EXIT 0
- [x] 커밋 e1f2101(fix) · cae3566(test) · REPORT 커밋

## 커밋
- `e1f2101 fix(ios): compare pod deployment targets with Gem::Version (#445)` — plugins/withPodDeploymentTarget.js (비교식, 주석, `module.exports.SNIPPET`)
- `cae3566 test(ios): execute pod deployment clamp snippet in ruby (#445)` — plugins/__tests__/withPodDeploymentTarget.test.js

## RED → GREEN (logs/red.log, logs/green.log)
- RED(to_f 상태, 테스트만 추가): `npx jest plugins/__tests__/withPodDeploymentTarget.test.js --watchman=false` → EXIT=1, `✕ compares versions numerically ... (15.10 > 15.2)`, 1 failed / 5 passed.
- GREEN(Gem::Version): 같은 명령 → EXIT=0, 6 passed.
- 참고: 브리프 예시 "15.10 은 15.1 하한에서 유지"는 to_f 로도 통과한다(15.1 < 15.1 거짓). 그래서 하한 15.2 + '15.10' 케이스를 추가해 to_f 결함을 RED로 드러냈다.

## Ruby 테스트 케이스
| 하한 | 입력 | 기대 |
|---|---|---|
| 기본 15.1 (`{}`) | nil, '12.0', '16.0', '15.10' | '15.1', '15.1', '16.0', '15.10' |
| 16.0 | nil, '12.0', '16.0' | '16.0', '16.0', '16.0' |
| 15.2 | '15.10', '15.1', '9.0' | '15.10', '15.2', '15.2' |

## 뮤턴트 (gitignored 복사본 `mut/<Mx>/plugins/`, 실행 후 삭제 — logs/mut-M*.log)
| 뮤턴트 | 변경 | 결과 | 잡은 테스트 |
|---|---|---|---|
| M4 문자열 비교 | `if current < pod_min_ios` | EXIT=1 (1 failed) | 15.10 > 15.2 |
| M5 하한 고정 | `pod_min_ios = '15.1'` | EXIT=1 (3 failed) | 스니펫 줄 단언, 16.0 하한, 15.2 하한 |
| M6 가드 제거 | `if true` | EXIT=1 (2 failed) | 기본 15.1(16.0 유지), 15.10 유지 |
→ 3/3 검출. (M5 는 구 :50 단언으로는 못 잡혔다 — 문자열이 Podfile 첫 줄에 이미 있어 항상 참이었음.)

## ruby 부재 분기 (logs/noruby-ci.log, logs/noruby-local.log)
- `PATH=<node bin만> CI=1 jest ...` → EXIT=1, `✕ requires ruby on PATH in CI` (조용한 skip 아님).
- `PATH=<node bin만>` (CI 미설정) → EXIT=0, console.warn "ruby not found on PATH — skipping ..." + `describe.skip` 제목에 사유.
- CI 근거: `.github/workflows/ci.yml:16 runs-on: ubuntu-latest`. GitHub ubuntu-latest 러너 이미지는 Ruby를 기본 설치로 포함한다(러너 이미지 문서 기준, 이번 실행에서 원격 CI로 실측하지는 않음 — L2). 없으면 위 분기로 CI가 실패해 드러난다.
- 로컬 ruby: /usr/bin/ruby 2.6.10 (macOS 시스템 Ruby; Gem::Version 동작 확인).

## 검증 (fresh, logs/)
- `npm run type-check` → EXIT 0 (logs/type-check.log)
- `npx eslint --no-eslintrc -c .eslintrc.js plugins/withPodDeploymentTarget.js plugins/__tests__/withPodDeploymentTarget.test.js` → EXIT 0, 출력 없음 (logs/eslint.log)
- `npx jest plugins __tests__/metroBlocklist.test.ts --watchman=false` → EXIT 0, Test Suites 3 passed, Tests 15 passed (logs/jest.log)

사용 스킬: test-driven-development 절차 적용(RED 로그 후 구현) — 스킬 도구 로드는 시간 예산으로 생략, 브리프의 RED→GREEN 요구를 직접 따름.
테스트: Ruby 실행 describe 3건 + CI 실패 분기 1건 추가, :50 단언 교체. RED(1 failed)→GREEN(6 passed) 위 기록.
기존 실패: 없음.

검증: 위 3종 게이트 + 뮤턴트 3종 + ruby 부재 두 분기 실행. 미검증 — 실제 pod install/xcodebuild(브리프상 금지, Jarvis 담당), 원격 CI 러너의 ruby 존재 실측.
위험·영향 범위: 생성되는 ios/Podfile post_install 스니펫이 바뀐다. IPHONEOS_DEPLOYMENT_TARGET 이 Gem::Version 이 파싱 못 하는 값(예: `$(inherited)`)이면 Gem::Version.new 가 ArgumentError 로 pod install 을 실패시킨다(to_f 는 0.0 으로 덮어썼음). 실 Pods 에서는 숫자 문자열이 일반적이라 낮다고 보지만 재생성 검증에서 확인 필요.
되돌리는 법: `git revert cae3566 e1f2101` (REPORT 커밋은 별도 revert).

## 확인 필요
- 비숫자 IPHONEOS_DEPLOYMENT_TARGET 처리(위 위험). 필요하면 `Gem::Version.correct?` 가드 추가를 후속으로.
