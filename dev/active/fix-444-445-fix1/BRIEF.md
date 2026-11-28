등급: S (실행 tier M) · 위험 등급: 중 · QA 조건부 PASS 후속 (`dev/active/qa-444-445/REPORT.md`)
# FIX1 BRIEF — #445 테스트 강화 + 버전 비교 보정

## 범위 (Jarvis 결정 ★, 이 3건만)
1. **[P2] Ruby 실행 테스트**: `plugins/__tests__/withPodDeploymentTarget.test.js`에 플러그인이 삽입하는 SNIPPET을 실제 `ruby`로 실행하는 테스트 추가.
   - 가짜 installer: `pods_project.targets` → 타깃 3개(build_settings `IPHONEOS_DEPLOYMENT_TARGET` = nil / `'12.0'` / `'16.0'`), `podfile_properties` = `{}` 그리고 `{'ios.deploymentTarget' => '16.0'}` 두 경우. Ruby가 결과를 JSON으로 stdout에 출력 → jest에서 단언.
     - 기본(15.1): nil→'15.1', '12.0'→'15.1', '16.0'→'16.0' 유지.
     - 하한 16.0: '12.0'→'16.0', '16.0' 유지.
     - 두 자리 마이너: '15.10' 은 15.1 하한에서 유지(아래 3번).
   - SNIPPET은 플러그인 모듈에서 export해 쓴다(문자열 복붙 금지). 실행: `child_process.spawnSync('ruby', ['-e', script])`, 임시 파일 쓰지 말 것(-e 또는 stdin).
   - `ruby`가 PATH에 없으면 `test.skip`이 아니라 **명시적 메시지와 함께 skip**(`describe.skip` 분기 + 이유 출력). 단 CI(`process.env.CI`)에서는 ruby가 없으면 **실패**하게 해 조용히 건너뛰지 않도록 한다. CI 러너(ubuntu-latest)에 ruby가 있는지 `.github/workflows/*.yml`의 runs-on과 함께 REPORT에 근거 기록.
   - 뮤턴트 재검증: QA M4(문자열 비교)·M5(하한 고정)·M6(가드 제거)을 gitignored 복사본(`dev/active/fix-444-445-fix1/mut/`, 끝나면 삭제)에서 적용 → 새 테스트가 3/3 잡는지 표로.
2. **[P3] 항상 참 assertion**: 테스트 :50의 `podfile_properties['ios.deploymentTarget'] || '15.1'` 단언을 스니펫 줄(`pod_min_ios = …`) 단언으로 교체.
3. **[P3] 버전 비교**: `plugins/withPodDeploymentTarget.js:30` `to_f` 비교 → `Gem::Version.new(current) < Gem::Version.new(pod_min_ios)`. nil/빈 값은 하한 미만으로 취급(현행 동작 유지). 주석 갱신.

## 검증 (EXIT, 로그 `dev/active/fix-444-445-fix1/logs/`, /tmp·저장소 밖 금지)
- `npm run type-check` / `npx eslint --no-eslintrc -c .eslintrc.js plugins/withPodDeploymentTarget.js plugins/__tests__/withPodDeploymentTarget.test.js` / `npx jest plugins __tests__/metroBlocklist.test.ts --watchman=false` 각 EXIT.
- `ios/`·pod install·xcodebuild 실행 금지(Jarvis가 재생성 후 검증).

## 금지·산출
- `src/**`·새 의존성·push 금지. 커밋 `test(ios): execute pod deployment clamp snippet in ruby (#445)` (+필요시 fix 커밋 분리) + `dev/active/fix-444-445-fix1/REPORT.md`(`git add -f`). RED→GREEN, 뮤턴트 표, `사용 스킬:`, `검증 / 위험·영향 범위 / 되돌리는 법`. REPORT 초안 먼저.

서브에이전트 분할: 불필요(파일 2개)
