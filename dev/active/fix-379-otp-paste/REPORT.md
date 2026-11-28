# REPORT — #379 OTP 칸 부분 붙여넣기 오분배

## 결론
OTP TextInput 6칸에 `selectTextOnFocus`를 추가했다. 칸에 포커스가 오면 기존 숫자가 선택되므로 입력·붙여넣기가 "교체"가 되고, onChangeText에는 새 입력만 온다. 길이 휴리스틱(2자리 / OTP_LENGTH+1자리)은 **안전망으로 유지**했다.

선택: ★selectTextOnFocus + 휴리스틱 안전망 유지(사유: 기존 테스트 'replaces only the current cell…'이 선택 없이 "39"/"9987654"가 오는 경로를 단언하며, 브리프가 기존 기대값 변경을 금지함. 이미 포커스된 칸을 다시 탭하면 선택이 다시 걸리지 않는 경우도 있어 안전망이 필요).

## 방식 근거 (RN 0.83 node_modules 소스, L1)
- 타입: `Libraries/Components/TextInput/TextInput.d.ts:932` "If true, all text will automatically be selected on focus".
- iOS: `Libraries/Text/TextInput/RCTBaseTextInputView.mm:650-661` `reactFocus`에서 `_selectTextOnFocus`면 `selectAll:` 호출 (ref.focus()로 다음 칸 이동하는 이 화면의 경로가 여기에 해당).
- Android: `ReactAndroid/.../ReactEditText.kt:1084-1086` `setSelectTextOnFocus` → `super.setSelectAllOnFocus` (네이티브 EditText의 포커스 시 전체 선택) + `onLayout`(292-296)에서 1회 selectAll 보강.
- onSelectionChange 커서 추적 대안은 ★가 동작하므로 쓰지 않음.

## 변경 파일
- `src/screens/auth/SignupStep1Screen.tsx` — TextInput에 `selectTextOnFocus` + 주석, handleOtpChange 주석에 안전망 설명(로직 변경 없음).
- `src/screens/auth/__tests__/SignupStep1Screen.test.tsx` — 회귀 테스트 1건 추가(두 예시 + 6칸 모두 selectTextOnFocus 단언).

## 테스트 (RED→GREEN)
- RED: `npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx --watchman=false` → EXIT=1, 신규 테스트 ✕ `Expected: true / Received: undefined` (selectTextOnFocus 미설정), 기존 5건 ✓.
- 정직성 메모: 테스트는 선택 교체 방식에 맞춰 onChangeText에 새 입력만("98", "98765") 넣는다. 이 입력에 대한 분배 로직은 원래도 맞았으므로 RED는 prop 단언에서 났다 — 즉 버그 수정의 실체는 "OS가 기존 값을 선택해 새 입력만 오게 하는 것"이고, 이것은 jest로 증명 불가하며 실기기 확인이 필요하다.
- GREEN: `npx jest src/screens/auth --watchman=false --silent` → EXIT=0, Suites 6/6, Tests 54/54. 기존 5개 테스트 기대값 변경 없음.

## EXIT 표 (로그: dev/active/fix-379-otp-paste/logs/, 미커밋)
| 명령 | EXIT |
|---|---|
| npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache" | 0 |
| npm run type-check | 0 |
| npx eslint --no-eslintrc -c .eslintrc.js (2파일) | 0 |
| npx jest src/screens/auth --watchman=false --silent | 0 (54/54) |

## 실기기 미검증 범위
- iOS 붙여넣기 메뉴(길게 눌러 붙여넣기 시 선택 상태 유지 여부), 사용자 탭으로 포커스 시 iOS selectAll 동작(소스상 확인한 경로는 reactFocus).
- Android 삼성 키보드·클립보드 제안 붙여넣기, 이미 포커스된 칸 재탭(선택 해제 → 안전망 경로).
- SMS 자동완성(iOS oneTimeCode / Android sms-otp)이 선택된 칸에 들어올 때 6자리 전체로 오는지.

사용 스킬:
- superpowers:test-driven-development → 테스트 먼저 작성, RED(prop 미설정) 확인 후 구현.
- test-automation·react-native-development: 미로드 — 15분 예산, 1 prop 추가 수준이라 생략.
테스트: SignupStep1Screen.test.tsx에 #379 회귀 1건 추가, RED(EXIT=1)→GREEN(EXIT=0).
기존 실패: 없음 (src/screens/auth 범위. 전체 jest는 Jarvis 담당으로 미실행).

검증: npm ci·type-check·eslint(2파일)·jest src/screens/auth 실행, 전부 EXIT=0. 전체 jest·실기기 붙여넣기는 미검증.
위험·영향 범위: 회원가입 Step1 OTP 입력 칸만. 잘못되면 탭 시 숫자가 선택돼 보이는 UX 변화, 또는 플랫폼에서 선택이 안 걸리면 기존(수정 전)과 같은 동작으로 남음(안전망 유지). 인증 로직 변경 없음.
되돌리는 법: `git revert <이 커밋 SHA>` (또는 TextInput의 selectTextOnFocus 한 줄 삭제).
