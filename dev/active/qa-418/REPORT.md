# QA REPORT — #418 설정 > 앱 정보 OTA 실행 정보 표시 (독립 검증)

- 대상: `feat/418-ota-info` @ `c854247` (코드 `66c016a`, base `34fe911`)
- 검증자: QA 레인 (구현자와 독립). 코드 수정 없음.

## 판정: 조건부 PASS

수용 기준은 모두 충족(P1·P2 결함 0). P3 3건은 표기·견고성 개선이며 머지를 막지 않는다. 실기기 기준("다음 OTA 후 실기기 표시값 = 서버 manifest Android update ID")은 이 레인에서 실행 불가 → 미검증.

## 수용 기준 대조

| # | 기준 | 결과 | 증거 |
|---|------|------|------|
| 1 | update ID 전체 표시(잘림 없음) | PASS | `otaInfo.ts:52` id 원문 그대로, `numberOfLines` 없음(`SettingsScreen.tsx:737`). 36자 UUID 전체가 text·label에 포함(edge D_mid) |
| 2 | embedded 표기 (`isEmbeddedLaunch` 또는 updateId null) | PASS | edge D_emb `OTA production · 1.1.0 · embedded`, 단위 테스트 2건 |
| 3 | disabled 표기 (`isEnabled === false`) | PASS | edge D_dis `OTA disabled` / `OTA updates disabled` |
| 4 | 예외 시 throw 금지 (error-handling) | PASS(부분) | 프로퍼티 접근 throw는 흡수(edge B → `OTA unavailable`). 단 import 시점 throw는 미흡수 → P3-1 |
| 5 | createdAt `YYYY-MM-DD HH:mm` (KST) | PASS | 15:00Z→`2026-11-29 00:00 KST`, 14:59Z→`2026-11-28 23:59 KST`, 12/31 15:30Z→`2027-01-01 00:30 KST`, Invalid Date·비 Date 값→날짜 줄 생략 (edge D) |
| 6 | 접근성 라벨 | PASS | `accessible` + `accessibilityLabel` (`SettingsScreen.tsx:730-734`), ko/en 라벨 확인(edge D) |
| 7 | 테마 토큰·기존 스타일 재사용 | PASS | `styles.settingItem`/`textContainer`/`settingSubtitle` 재사용, 하드코딩 색·fontWeight 단독 없음 |
| 8 | `testID="settings-ota-info"` | PASS | `SettingsScreen.tsx:731`, 화면 테스트가 testID로 조회 |
| 9 | 테스트가 행동을 단언 | PASS | 화면 테스트: 라벨 전체 문자열 + `toHaveTextContent`(전체 ID) — 렌더 결과 단언. 헬퍼 테스트: 7케이스 출력 문자열 단언 |
| 10 | 기존 테스트 기대값 변경 없음 | PASS | `git diff 34fe911..c854247 --numstat -- '*.test.*'` → `20 0`, `70 0` (삭제 0줄), 삭제 라인 grep 카운트 0 |
| 11 | SettingsScreen 기존 행 순서·동작 불변 | PASS | diff는 app-info `SettingItem` 뒤 `View` 1개 추가 + import·useMemo 1줄뿐. 기존 행 변경 없음 |
| 12 | 프로젝트 규칙(typescript-strict·path-aliases·RN patterns·error-handling) | PASS | `any` 0, exported 함수 반환 타입 명시(`formatOtaInfo(): OtaInfo`, `getOtaInfo(): OtaInfo`), `@/utils/otaInfo` alias, `as`는 테스트 1곳(`as unknown as OtaSource`, throw getter 주입용) |

## 결함

### [P3-1] import 시점 예외는 "절대 throw하지 않는다" 계약 밖
- 위치: `src/utils/otaInfo.ts:6`, `:68` (doc 주석 "절대 throw하지 않는다")
- 재현: 1) `jest.doMock('expo-updates', () => { throw new Error('native module missing at import'); })` 2) `require('@/utils/otaInfo')`
- 관측: `Error: native module missing at import` 가 import에서 그대로 전파(edge C). → SettingsScreen 모듈 로드 실패 = 설정 탭 전체 크래시 경로.
- 근거: `node_modules/expo-updates/build/Updates.js`의 `isEnabled`·`updateId`·`createdAt` 등은 **모듈 평가 시 계산되는 `export const`**이고, `ExpoUpdates.js`는 `requireNativeModule('ExpoUpdates')`(미존재 시 throw). 즉 실제 실패 모드는 import 시점이며, 단위 테스트의 "getter throw" 케이스(`otaInfo.test.ts:54-63`)는 실제로는 일어나지 않는 합성 시나리오다.
- 기대: 계약을 지키려면 지연 `require`를 try 안에서 하거나, 주석을 "프로퍼티 접근 예외만 흡수"로 정정.
- 영향: 낮음 — expo-updates는 의존성으로 autolink되어 iOS/Android 빌드·웹(`ExpoUpdates.web.js` registerWebModule)에 모두 모듈이 존재. 현실적 발생 경로 확인 못 함.

### [P3-2] 웹 빌드에서 "disabled" 대신 `OTA - · - · embedded`
- 위치: `src/utils/otaInfo.ts:42` (isEnabled 판정)
- 재현(정적+단위): `ExpoUpdates.web.js`는 `isEnabled = true`, `channel = ''`, `runtimeVersion = ''`, `updateId` undefined. 같은 값으로 `formatOtaInfo` → `OTA - · - · embedded` (edge D_web). `app.json:140-143` platforms에 web 포함.
- 기대: 웹은 OTA 대상이 아니므로 `OTA disabled`(또는 행 숨김)가 의미상 정확.
- 영향: 표기만 오해 소지. 기능 영향 없음.

### [P3-3] OTA 행 텍스트가 위 행 제목과 정렬되지 않음
- 위치: `src/screens/settings/SettingsScreen.tsx:728-741`
- 관측(정적): 새 행은 `settingItem`(paddingHorizontal s4)만 쓰고 `iconContainer`(32 + marginRight s3) 자리가 없어 텍스트가 좌측 가장자리에서 시작 → "앱 정보" 제목보다 약 44px 왼쪽. 또 `settingItem`의 borderBottom 때문에 "앱 정보"와 OTA 줄 사이에 구분선이 생겨 별개 항목처럼 보임.
- 기대: BRIEF 표현 "앱 정보 행 아래(또는 subtitle 둘째 줄)" — subtitle 둘째 줄이면 정렬·그룹이 자연스러움. 렌더 스크린샷 미확인이라 polish로만 분류.

## 경계 사례 실행 결과 (임시 테스트, 실행 후 삭제)

명령: `npx jest dev/active/qa-418/edge.test.ts --watchman=false --testMatch '**/dev/active/qa-418/*.test.ts*'` → EXIT=0, 4/4 PASS. 원시 출력: `dev/active/qa-418/logs/edge-out.txt`, `logs/edge.log`.

- A. expo-updates 무 mock(jest-expo 네이티브 mock): `OTA mock · mock · mock` — throw 없음. → 다른 스위트에서 SettingsScreen import 안전.
- B. 네임스페이스 getter throw: `OTA unavailable` / `OTA 업데이트 정보 없음` — 접근이 `formatOtaInfo` try 안이라 흡수됨.
- C. import 자체 throw: 전파됨 → P3-1.
- D. KST 자정·연말 경계, Invalid Date, 문자열 createdAt, 36자 ID, 영문 라벨: 위 표 5·1·6행대로.

관련 스위트: `npx jest --listTests --findRelatedTests src/utils/otaInfo.ts src/screens/settings/SettingsScreen.tsx` → 5개(SignupStep1/2/3, SettingsScreen, otaInfo). 실행 `npx jest --watchman=false --maxWorkers=2 <5개>` → EXIT=0, 5 suites / 114 tests passed (`logs/related.log`). Signup 3종은 expo-updates를 mock하지 않고 통과 = A와 일치.

lint: `npx eslint --no-eslintrc -c .eslintrc.js <변경 4파일>` → EXIT=0 (`logs/eslint.log`).

## 접근성·플랫폼 (정적 판정 — 실기기 미실행)

- `accessible` View + 내부 `selectable` Text: iOS에서 `accessible`은 자식을 하나의 VoiceOver 요소로 묶고 라벨을 읽는다. 텍스트 선택은 VoiceOver 꺼진 상태의 long-press 제스처라 상호 배제 아님 → 일반 사용자 선택·스크린리더 낭독 모두 가능, 다만 VoiceOver 켠 상태에서는 텍스트 선택 불가(라벨에 ID 전체가 있어 정보 손실 없음). Android에서 `accessible`은 `focusable`만 설정하고 터치를 가로채지 않으므로 TextView `setTextIsSelectable` long-press와 충돌 없음. 판정: 충돌 없음(정적).
- 라벨에 createdAt이 빠짐 — 화면엔 보이고 낭독은 안 됨. 수용 기준("OTA 업데이트 ID <id>")은 충족, 후속 제안으로만.
- 웹(react-native-web): `ExpoUpdates.web.js` 스텁 값 → P3-2.

## 후속 제안 (결함 아님)
1. 버전 하드코딩 `1.0.0` (`SettingsScreen.tsx:723`) → `expo-application`/`Constants.expoConfig.version` (BRIEF 범위 밖으로 명시됨).
2. 접근성 라벨에 createdAt 포함 검토.
3. 실기기: 다음 preview OTA 후 Android 표시 ID = `eas update:view` manifest Android update ID 대조.

## 미검증
- 실기기 iOS/Android 렌더·스크린리더·텍스트 선택: 기기·빌드 없음(정적 판정만).
- 웹 실렌더 스크린샷: dev 서버 미기동, 브리프가 기동 방법을 지정하지 않음 → 소스 기반 판정.
- 변이(mutation) 검사: 지정 scratch 경로(`~/.hermes/.../scratch`)가 샌드박스 쓰기 거부(`mkdir: Operation not permitted`) → 미실행. 화면 테스트가 라벨·텍스트 전체 문자열을 정확 일치 단언하므로 ID 잘림 변이는 잡힐 것으로 정적 판단.
- 전체 jest·type-check: 브리프 지시로 재실행하지 않음(Jarvis 게이트 기록).

## 사용 스킬
- 없음 — 브리프가 정적 대조·단위 경계 테스트 범위로 한정했고 화면 렌더·실기기 검사를 요구하지 않음. `mobile-service-qa`·`ego-browser`는 기기/서버 미기동으로 로드하지 않음.

검증: 위 jest(edge 4/4, related 5 suites 114 tests)·eslint EXIT=0 실행. 실기기·웹 렌더·변이 검사·전체 jest는 미실행.
위험·영향 범위: 해당 없음 — QA 증거만 추가(코드 미변경).
되돌리는 법: 해당 없음 — QA 증거만 추가. 필요 시 이 QA 커밋을 `git revert <sha>`.
