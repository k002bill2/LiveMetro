# QA REPORT — #379 OTP 부분 붙여넣기 수정 (d981e51, base 913943b)

판정: **FAIL** — 이슈의 두 예시는 "칸이 선택된 상태"에서만 해결된다. iOS(New Architecture/Fabric)에서는 사용자가 칸을 탭하면 선택이 걸리지 않아(정적 근거), 실제 사용자 경로인 "세 번째 칸 탭 → 98 붙여넣기"가 수정 전과 똑같이 오분배된다. 선택이 걸려도 겹치는 숫자(38·83·33) 붙여넣기는 휴리스틱이 한 자리를 잘라 오분배한다(jest로 재현).

## 수용 기준 표
| # | 기준 | 결과 | 증거 |
|---|---|---|---|
| 1a | 예시 98 → 129856 (선택 교체 경로) | PASS | 임시 jest: 입력 "98" → 129856 |
| 1b | 예시 98765 → 129876 (선택 교체 경로) | PASS | 임시 jest: "98765" → 129876 |
| 1c | 같은 예시, 선택 없는 경로(iOS 사용자 탭 → 커서 끝 → onChangeText "398") | **FAIL** | 임시 jest: "398" → 123986 (기대 129856). 수정 전과 동일 |
| 1d | 추가 테스트가 버그를 고정하는가 | **아니오** | 테스트는 "98"/"98765"만 넣는다. handleOtpChange 로직은 base와 동일(diff는 주석 2줄+prop 1줄)이라 같은 입력이면 base에서도 같은 값 — RED는 `selectTextOnFocus` prop 단언에서만 났다(구현 REPORT 자인). 즉 prop이 붙었는지만 고정하고 동작은 고정하지 않는다 |
| 2 | 교체 입력 × 2자리 휴리스틱 충돌 | **FAIL (결함 D2)** | 아래 표 |
| 3 | 회귀: 6자리 붙여넣기/SMS, 한 자리 덮어쓰기, 기존 테스트 | PASS | `npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx --watchman=false` → 6 passed / 6. `git diff 913943b..d981e51 --stat -- '*.test.*'` → 42 insertions, 0 deletions (기존 기대값 불변). 6자리 "654321"/7자리 "3654321" 셀2 → 654321, 1자리 "5"/"35"/"53" → 125456 |
| 3b | 백스페이스 이전 칸 이동 | 변경 없음(코드 동일) | handleOtpKeyPress 미변경 (diff). "" 입력 → 12_456 |
| 4 | 플랫폼 근거 | iOS FAIL(정적) / Android PASS(정적) | 아래 |
| 5 | 규칙(typescript-strict·react-native-patterns) | PASS (diff 범위) | 새 타입·any·하드코딩 색 없음. OTP TextInput에 accessibilityLabel 부재는 **기존 결함**(diff 이전부터) — P3 별건 |

## 2번 경계 관측 (셀 값 123456, 셀2=3에 onChangeText 값 주입)
| 입력 | 해석 | 관측 | 기대(사용자 의도) | 결과 |
|---|---|---|---|---|
| 98 | 선택 교체 붙여넣기 | 129856 | 129856 | OK |
| 98765 | 선택 교체 붙여넣기 | 129876 | 129876 | OK |
| 38 | 선택 교체 붙여넣기(기존 3으로 시작) | **128456** | 123856 | 오분배 |
| 83 | 선택 교체 붙여넣기(기존 3으로 끝남) | **128456** | 128356 | 오분배 |
| 33 | 선택 교체 붙여넣기 | **123456** | 123356 | 오분배(입력 유실) |
| 5 | 선택 교체 타이핑 | 125456 | 125456 | OK |
| 35 / 53 | 선택 풀림, 끝/앞 커서 타이핑 | 125456 | 125456 | OK (구분됨) |
| 398 | 선택 풀림, 끝 커서 붙여넣기 98 | **123986** | 129856 | 원래 버그 그대로 |
| 654321 / 3654321 | 전체 코드 | 654321 | 654321 | OK |

핵심: onChangeText 값만으로는 "선택 교체 38"과 "선택 없이 3 뒤에 8 타이핑"을 구분할 수 없다. 선택 교체가 기본이 되면 2자리 분기는 안전망이 아니라 오분배 원인이 된다. 3자리 이상(부분 붙여넣기 + 기존 숫자)은 분기 대상이 아니라 선택 없는 경로에서는 전혀 보호되지 않는다.

## 4번 플랫폼 근거 (RN 0.83.10, node_modules 정적 판정 — 실기기 미실행)
- 이 앱은 RN 0.83 = New Architecture 고정이므로 iOS는 Fabric 컴포넌트가 실제 경로다. 구현 REPORT가 인용한 `Libraries/Text/TextInput/RCTBaseTextInputView.mm:650-661`(reactFocus)은 **구 아키텍처(Paper)** 코드다.
- Fabric: `React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputComponentView.mm:538-553` — `- (void)focus`(JS `ref.focus()` 명령)에서만 `selectTextOnFocus`면 `selectAll:`. 같은 파일 `:277-278` "selectTextOnFocus … checked on-demand", 사용자 탭으로 편집이 시작될 때 호출되는 `textInputDidBeginEditing`(`:394-399`)은 onFocus 이벤트만 보내고 선택하지 않는다. Fabric TextInput 폴더에서 selectTextOnFocus 사용처는 549 한 곳뿐(grep).
  → iOS: 자동 이동(이전 칸 입력 후 `otpRefs.current[i+1].focus()`)으로 온 칸은 선택됨, **사용자가 탭한 칸은 선택 안 됨**. 부분 붙여넣기 시나리오는 보통 "틀린 칸을 탭"이므로 iOS 주 경로가 고쳐지지 않는다.
- Android: `ReactAndroid/.../textinput/ReactEditText.kt:1084-1086` `setSelectAllOnFocus`(네이티브 EditText는 탭 포커스 포함 포커스 획득 시 전체 선택), `:292-296` onLayout 1회 selectAll 보강 후 플래그 false. 이미 포커스된 칸 재탭은 포커스 변화가 없어 선택 안 됨(= 선택 없는 경로). Android 탭 경로는 정적으로 해결로 판정.
- 선택 상태에서 붙여넣기 시 onChangeText 값 = 붙여넣은 문자열만(표준 UITextField/EditText 교체 동작, 정적).

## 결함
### [P1] iOS 사용자 탭 경로에서 #379 미해결
재현: 1) iOS(New Arch) 실기기에서 OTP 123456 입력 2) 세 번째 칸 탭 3) 클립보드 "98" 붙여넣기.
기대: 129856. 실제(정적+로직 재현): 탭으로는 선택이 안 걸려 onChangeText "398"(커서 끝) → 123986.
영향: 이슈의 핵심 시나리오가 iOS에서 그대로. 증거: Fabric `RCTTextInputComponentView.mm:394-399, 538-553`, 임시 jest "398" → 123986.
### [P1] 선택 교체 + 2자리 휴리스틱 충돌 (D2)
재현: 셀2=3이 선택된 상태에서 "38"/"83"/"33" 붙여넣기(Android 탭 또는 iOS 자동 이동 칸).
기대: 123856 / 128356 / 123356. 실제: 128456 / 128456 / 123456 (임시 jest). 위치: `src/screens/auth/SignupStep1Screen.tsx:194-197`.
영향: 붙여넣은 숫자가 바뀌거나 유실 → 인증 실패. 붙여넣기 첫/끝 자리가 기존 숫자와 같을 확률 약 2/10(추정).
### [P2] 추가 테스트가 동작을 고정하지 않음
`SignupStep1Screen.test.tsx:230-270` — prop 존재 단언 + base에서도 통과하는 입력. 위 두 결함을 못 잡는다.
### [P3·기존] OTP 칸 6개에 accessibilityLabel 없음 (`SignupStep1Screen.tsx:503-520`) — diff 이전부터. 별건.

## ★ 수정안 (근거)
★ A: 셀별 선택을 `onSelectionChange`로 ref에 기록하고, onChangeText에서 직전 선택으로 새 입력을 결정론적으로 복원 — 선택(0,1)이면 값 전체가 새 입력, 커서 끝(1,1)이면 `value.slice(1)`, 커서 앞(0,0)이면 `value.slice(0,-1)`. 길이 휴리스틱(2자리·startsWith/endsWith) 제거, 전체코드(≥6자리) 분기만 유지. 근거: 값만으로는 위 표의 모호성이 원리적으로 해소 불가. 주의: iOS에서 onSelectionChange와 onChangeText 순서는 실기기 확인 필요.
보조 B: 각 칸 `onFocus`에서 `ref.setSelection(0, 1)`을 호출해 iOS 탭 경로도 선택되게 맞춘 뒤 2자리 분기 제거. 단순하지만 재탭(포커스 변화 없음) 경로는 A가 있어야 덮인다.
테스트: 위 경계 표 12건(특히 38·83·33·398)을 onSelectionChange 이벤트 + changeText로 고정.

## 후속 제안 (별건)
- OTP 칸 accessibilityLabel("인증번호 n번째 자리") 추가.
- 실기기 QA: iOS 탭→붙여넣기, Android 삼성 키보드 클립보드 제안, SMS 자동완성.

사용 스킬:
- mobile-service-qa / principle-prove-it-works: 미로드 — 15분 예산, 실기기·시뮬레이터 미사용(정적+jest 판정). 본 레인 규칙의 증거 원칙(각 PASS에 명령 근거)만 적용.
- 그 외 없음 — 범위가 단일 화면 로직·RN 소스 정적 확인.

미검증: iOS·Android 실기기/시뮬레이터 동작(실행 중인 기기 없음·브리프에 기동 방법 없음), 전체 jest·tsc·eslint(Jarvis 담당), onSelectionChange 이벤트 순서.

검증: 임시 `dev/active/qa-379/edge.test.tsx`(12케이스)를 `npx jest dev/active/qa-379/edge.test.tsx --watchman=false --testMatch '**/dev/active/qa-379/*.test.ts*'`로 실행 → 4 failed / 8 passed(위 표), 실행 후 삭제. `npx jest src/screens/auth/__tests__/SignupStep1Screen.test.tsx --watchman=false` → 6/6 passed. RN 소스 grep/sed 정적 확인. 임시 테스트의 firebase config mock은 자격증명 패턴 훅 때문에 빈 객체로 대체(화면 동작 무관).
위험·영향 범위: 이 REPORT 파일 추가만. 코드 변경 없음.
되돌리는 법: 이 REPORT 커밋을 `git revert <SHA>`.
