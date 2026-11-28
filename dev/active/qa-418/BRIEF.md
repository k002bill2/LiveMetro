등급: S (실행 tier Q) · 대상 위험 등급: 중
# QA BRIEF — #418 설정 > 앱 정보 OTA 실행 정보 표시 독립 검증

## 대상
- 저장소: 이 worktree, 브랜치 `feat/418-ota-info`, 검증 대상 `c854247` (코드 커밋 `66c016a`, base `34fe911`)
- 구현 브리프: `dev/active/feat-418-ota-info/BRIEF.md` / 구현 보고: `dev/active/feat-418-ota-info/REPORT.md`
- 변경: `src/utils/otaInfo.ts`(신규), `src/utils/__tests__/otaInfo.test.ts`(신규), `src/screens/settings/SettingsScreen.tsx`, `src/screens/settings/__tests__/SettingsScreen.test.tsx`

## Jarvis가 이미 확인한 것 (다시 하지 말 것)
- 전체 jest·type-check·eslint는 Jarvis가 별도 실행(게이트 기록 보유). 전체 jest 재실행 금지(CPU 경합).
- 설치된 `expo-updates/build/Updates.d.ts`에 `isEnabled`·`updateId`·`channel`·`runtimeVersion`·`isEmbeddedLaunch`·`createdAt` export 존재.

## 검증 항목 (코드 수정 금지 — 결함은 재현 근거와 함께 보고만)
1. 수용 기준 대조(BRIEF·이슈): update ID 전체 표시(잘림 없음), embedded/disabled/unavailable 표기, 접근성 라벨, 테마 토큰(기존 스타일 재사용), testID. 테스트가 행동을 단언하는지.
2. 회귀: `git diff 34fe911..c854247 -- '*.test.*'`에서 기존 기대값 변경 없음 확인. SettingsScreen 기존 행 순서·동작 불변.
3. 경계 사례(필요 시 `dev/active/qa-418/` 임시 테스트 → `npx jest <파일> --watchman=false --testMatch '**/dev/active/qa-418/*.test.ts*'`로 실행 후 삭제, 결과만 보고):
   - expo-updates 모듈 프로퍼티 getter가 throw하는 경우 실제로 흡수되는지(`getOtaInfo`가 네임스페이스를 넘기므로 접근 시점이 try 안인지)
   - `expo-updates`를 mock하지 않은 다른 스위트에서 SettingsScreen import가 안전한지(`--findRelatedTests` 결과 인용 가능)
   - createdAt KST 변환: 자정 경계(UTC 15:00 → 다음날 00:00 KST), Invalid Date
   - 긴 updateId(UUID 36자)·영문 모드 라벨
4. 접근성·플랫폼: `accessible` View로 감싼 `selectable` Text — iOS/Android에서 스크린리더 라벨과 텍스트 선택이 충돌하는지 RN 문서/소스 근거로 판정(실기기 미실행이면 '정적 판정'으로 표기). 웹 빌드(react-native-web)에서 expo-updates 스텁 값(isEnabled 등)이 무엇이 되는지 `node_modules/expo-updates` 소스로 확인.
5. 프로젝트 규칙: `.claude/rules/` typescript-strict, path-aliases, react-native-patterns(접근성·테마 색상·Pretendard fontWeight), error-handling.

## 산출
- `dev/active/qa-418/REPORT.md` (git add -f, 커밋 1개). 판정: PASS / 조건부 PASS / FAIL. 결함: 심각도·위치(파일:줄)·재현·관측·기대. 후속 제안 분리.
- `사용 스킬:` 줄, `검증 / 위험·영향 범위 / 되돌리는 법`(코드 미변경이면 "해당 없음 — QA 증거만 추가").
- /tmp 금지, push·원격 쓰기 금지. 조기 종료 금지. REPORT 초안 먼저.

서브에이전트 분할: 불필요(작은 변경)
