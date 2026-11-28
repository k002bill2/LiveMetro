등급: S (실행 tier M) · 예상 위험 등급: 중 (회원가입 인증 입력 흐름)
# BRIEF — #379 OTP 칸 부분 붙여넣기 오분배

## 목적
이미 숫자가 있는 OTP 칸에 2~5자리를 붙여넣으면 숫자가 잘못 나뉘는 문제를 고친다.
대상: `src/screens/auth/SignupStep1Screen.tsx` `handleOtpChange`(현재 약 187-223줄) + OTP TextInput(약 500-520줄).

## 현재 원인 (Jarvis 확인)
`handleOtpChange`는 입력 문자열 길이(2자리, OTP_LENGTH+1자리)로만 "기존 1자리 + 새 입력"을 구분한다. 부분 붙여넣기(예: 기존 `3` + 붙여넣기 `98` → `398`, 3자리)는 길이로 구분되지 않아 기존 숫자까지 새 입력으로 분배된다.

## 범위 (Jarvis 결정 ★)
- ★ 방식: **칸에 포커스가 오면 기존 값을 선택 상태로 만들어 입력·붙여넣기가 "교체"가 되게 한다** (`selectTextOnFocus` 또는 `onFocus`에서 `selection` 지정 — RN 0.83 TextInput에서 Android·iOS 모두 동작하는 방식을 확인해 선택). 이렇게 되면 onChangeText에는 새 입력만 오므로 길이 휴리스틱(`digits.length === 2 || OTP_LENGTH + 1` 분기)을 제거하거나, 선택이 실패한 플랫폼 대비 안전망으로만 남긴다 — 둘 중 테스트로 증명 가능한 쪽을 고르고 REPORT에 근거를 적는다.
- 대안(onSelectionChange로 커서 추적해 삽입 범위만 자르기)은 ★가 RN 동작상 불가할 때만 쓴다.
- 기대 동작(이슈 기준): `123456`의 세 번째 칸(`3`)에서 `98` 붙여넣기 → `129856`. `98765` 붙여넣기 → 세 번째 칸부터 `12 9876`(뒤로 분배, 앞 칸 덮어쓰기 금지; 6칸을 넘는 자리는 버림) — 즉 `129876`.
- 전체 6자리 붙여넣기/SMS 자동완성(어느 칸이든 첫 칸부터 채움)·한 자리 덮어쓰기·백스페이스 이동 등 기존 동작 유지.

## 수용 기준
- TDD: 위 두 예시를 회귀 테스트로 `src/screens/auth/__tests__/SignupStep1Screen.test.tsx`에 먼저 추가하고 RED 기록 → 구현 → GREEN.
  (테스트에서 "기존 값 선택 후 교체"를 시뮬레이션하는 방식은 구현 방식에 맞춰 정직하게 — 선택 교체 방식이면 onChangeText에 새 입력만 오는 것과, TextInput prop(selectTextOnFocus 등)이 설정됐는지를 함께 단언)
- 기존 `SignupStep1Screen.test.tsx` 테스트 전부 유지(기대값 변경 금지; 바꿨다면 사유).
- `.claude/rules/` 준수(typescript-strict, path-aliases, react-native-patterns 접근성, subscription-cleanup).

## 검증 (EXIT 기록, 로그 `dev/active/fix-379-otp-paste/logs/`, /tmp 금지)
- 첫 단계: `npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache"; echo EXIT=$?`
- `npm run type-check; echo EXIT=$?`
- `npx eslint --no-eslintrc -c .eslintrc.js src/screens/auth/SignupStep1Screen.tsx src/screens/auth/__tests__/SignupStep1Screen.test.tsx; echo EXIT=$?`
- `npx jest src/screens/auth --watchman=false --silent; echo EXIT=$?` (전체 jest는 Jarvis)

## 금지
- push·원격 쓰기·새 의존성·네이티브 코드 금지. 인증 로직(requestPhoneVerification/confirmPhoneCode) 변경 금지. 테스트 skip·완화 금지.

## 산출
- 로컬 커밋 `fix(auth): replace-on-focus for OTP cells to fix partial paste (#379)`, `dev/active/fix-379-otp-paste/REPORT.md`(`git add -f`).
- REPORT: 선택한 방식과 근거(RN 문서/소스), 변경 파일, RED→GREEN, EXIT 표, 실기기 미검증 범위(iOS/Android 붙여넣기 메뉴·삼성 키보드), `사용 스킬:`, `검증 / 위험·영향 범위 / 되돌리는 법`. REPORT 초안 먼저, 조기 종료 금지.
- 로그 파일은 커밋하지 말 것(public 저장소).

서브에이전트 분할: 불필요(1화면 + 1테스트)

## 원 이슈
<pasted_content id="p3x8">
OTP 칸: 채워진 칸에 2~5자리 부분 붙여넣기 시 오분배.
예: 123456의 세 번째 칸(3) 끝에 98 붙여넣기 → 입력값 398 → 결과 123986 (의도는 129856). 98765를 붙여넣으면 398765를 전체 코드로 잘못 보고 앞 칸까지 덮어쓴다.
원인: handleOtpChange는 문자열 길이만 보고 구분(2자리, 7자리일 때만 처리).
제안: onSelectionChange로 커서·선택 범위 추적, 또는 칸에 포커스가 오면 기존 값을 선택해 붙여넣기가 교체가 되게 한다.
완료 기준: 두 예시 회귀 테스트 추가·통과, 기존 SignupStep1Screen.test.tsx 5개 테스트 유지.
</pasted_content id="p3x8">
