# REPORT — #418 실행 중 OTA update ID 앱 내 표시

## 결론
설정 > 앱 정보 행 바로 아래에 읽기 전용 OTA 행(`testID="settings-ota-info"`)을 추가했다. update ID는 자르지 않고 전체 표시, `selectable`.

## 변경 파일
- `src/utils/otaInfo.ts` (신규) — `formatOtaInfo(source, language)` 순수 함수 + `getOtaInfo(language)`(expo-updates 주입). throw 없음(예외 시 `OTA unavailable` + console.warn).
- `src/utils/__tests__/otaInfo.test.ts` (신규) — 7건: 정상 / createdAt null / embedded(isEmbeddedLaunch) / updateId null(+null 필드 `-`) / disabled / 모듈 throw / Invalid Date.
- `src/screens/settings/SettingsScreen.tsx` — import 1줄, `useMemo(getOtaInfo(language))`, 앱 정보 아래 View 행(기존 `styles.settingItem`/`textContainer`/`settingSubtitle` 재사용, 새 스타일 없음).
- `src/screens/settings/__tests__/SettingsScreen.test.tsx` — `jest.mock('expo-updates')` + OTA 행 테스트 1건(testID·접근성 라벨·updateId 전체). 기존 기대값 변경 0.

## 화면 표시 예시
- 정상 OTA: `OTA preview · 1.1.0 · 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d` + 둘째 줄 `2026-11-28 10:05 KST`
- 내장 번들: `OTA preview · 1.1.0 · embedded`
- 개발 모드/비활성: `OTA disabled`
- 읽기 실패: `OTA unavailable`
- 접근성 라벨(ko): `OTA 업데이트 ID <id>, 채널 <channel>, 런타임 <rv>` / (en) `OTA update ID <id>, channel …, runtime …`
- createdAt은 기기 타임존과 무관하게 KST 고정 표기(QA 대조 일관성). 브리프 형식 `YYYY-MM-DD HH:mm` 뒤에 ` KST`를 붙였다.

## RED → GREEN
| 단계 | 명령 | 결과 | 로그 |
|---|---|---|---|
| 헬퍼 RED | `npx jest src/utils/__tests__/otaInfo.test.ts --watchman=false` | FAIL: Cannot find module (미구현) | logs/red.log |
| 헬퍼 GREEN | 동일 | 7 passed | logs/green-helper.log |
| 화면 RED | `npx jest …SettingsScreen.test.tsx -t OTA` | 1 failed: Unable to find testID settings-ota-info | logs/red-screen.log |
| 화면 GREEN | 아래 jest 게이트 | pass | logs/jest.log |

## EXIT 표 (fresh 실행)
| 명령 | EXIT | 비고 |
|---|---|---|
| `npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache"` | 0 | logs/npm-ci.log |
| `npm run type-check` | 0 | logs/type-check.log |
| `npx eslint --no-eslintrc -c .eslintrc.js <변경 4파일>` | 0 | 0 errors 0 warnings (import/first 경고 1건 수정 후 재실행) |
| `npx jest src/utils src/screens/settings --watchman=false --silent` | 0 | 44 suites / 901 tests passed (테스트 파일 수정 후 재실행) |
| `npx jest --findRelatedTests src/utils/otaInfo.ts src/screens/settings/SettingsScreen.tsx --watchman=false --silent` | 0 | 5 suites / 114 tests passed — SettingsScreen을 import하는 다른 스위트도 통과 |

사용 스킬:
- `superpowers:verification-before-completion` — 완료 보고 전에 로드. 그 결과 관련 스위트(--findRelatedTests)와 브리프 jest 게이트를 다시 실행했고, 실행하지 않은 검증은 따로 적어 두었다.
- `test-driven-development` — 로드하지 않음. RED→GREEN 절차는 직접 따랐다(위 표).
테스트: otaInfo.test.ts 7건 신규, SettingsScreen.test.tsx 1건 추가. RED→GREEN 위 표.
기존 실패: 없음 (대상 범위 jest 전부 통과).

검증: type-check·eslint(변경 파일)·jest(src/utils, src/screens/settings) 실행, 모두 EXIT 0. 미검증: 전체 jest(Jarvis 담당), 실기기 표시값 = 서버 manifest Android update ID 대조(다음 OTA 후 필요), 웹 빌드에서 expo-updates web 스텁 동작.
위험·영향 범위: 설정 화면에 expo-updates import 추가 — 해당 모듈 로드 실패 시 설정 화면 렌더 영향 가능(값 읽기 예외는 헬퍼가 흡수하나 import 자체 실패는 흡수 못함). 표시 전용이라 데이터·네트워크 영향 없음.
되돌리는 법: `git revert 66c016ae6918955821af8a7f621011b5686255a6` (코드 커밋, 신규 2파일 + 수정 2파일). 이 REPORT 커밋은 문서라 따로 revert하면 된다.

## 커밋
- `66c016a` feat(settings): show running OTA update info in app info (#418)
- (다음) docs: add REPORT for #418 — REPORT.md만 force-add. logs/·BRIEF.md는 커밋하지 않았다(로컬에만 있음).

## 후속 제안
1. 앱 정보 행의 하드코딩 `1.0.0`을 `expo-application`/`Constants.expoConfig.version`으로 교체(별건).
2. OTA 행 길게 누르기로 update ID 클립보드 복사(현재는 selectable만).

## FIX 라운드 (QA 조건부 PASS P3-1·P3-2·P3-3 + 라벨 createdAt) — BRIEF: dev/active/feat-418-fix1/BRIEF.md
| 항목 | 반영 |
|---|---|
| P3-2 웹 | `formatOtaInfo(source, language, platform?)` 3번째 인자 추가. `platform === 'web'`이면 스텁 값과 무관하게 `OTA disabled`. `getOtaInfo`가 `Platform.OS` 주입 |
| P3-1 계약 | lazy require 안 함. 주석을 "프로퍼티 접근·포맷 예외만 흡수, 모듈 import 실패는 범위 밖(autolink 전제)"으로 정정. getter-throw 테스트 이름 → `property access throw is absorbed …` |
| P3-3 정렬 | `ICON_CONTAINER_SIZE = 32` 상수를 `iconContainer`와 공유, 새 `otaTextContainer` marginLeft = 32 + `WANTED_TOKENS.spacing.s3`(iconContainer marginRight와 동일 토큰). 색·글꼴 `settingSubtitle` 유지, 구분선 유지 |
| 라벨 createdAt | createdAt 있으면 ko `…, 생성 2026-11-28 10:05 KST` / en `…, created …`. 없으면 생략 |

RED→GREEN
| 단계 | 명령 | 결과 | 로그 |
|---|---|---|---|
| RED | `npx jest src/utils/__tests__/otaInfo --watchman=false` | EXIT=1, 3 failed / 8 passed (ko 라벨 createdAt, en 라벨 createdAt, 웹 disabled) | logs/fix/red-helper.log |
| GREEN | 아래 jest 게이트 | EXIT=0 | logs/fix/jest.log |

EXIT 표 (fresh)
| 명령 | EXIT | 비고 |
|---|---|---|
| `npm run type-check` | 0 | logs/fix/type-check.log |
| `npx eslint --no-eslintrc -c .eslintrc.js src/utils/otaInfo.ts src/utils/__tests__/otaInfo.test.ts src/screens/settings/SettingsScreen.tsx` | 0 | logs/fix/eslint.log |
| `npx jest src/utils/__tests__/otaInfo src/screens/settings/__tests__/SettingsScreen --watchman=false --silent` | 0 | 2 suites / 92 tests passed, logs/fix/jest.log |

테스트: otaInfo.test.ts에 4건 추가(en 라벨 createdAt, createdAt null 라벨 생략, 웹 disabled, android 기존 표시 유지), 기존 1건 기대값 갱신(ko 정상 라벨에 `, 생성 … KST` 추가 — 이번 기능의 테스트), 1건 이름 변경. SettingsScreen.test.tsx는 mock createdAt null이라 라벨 기대값 변경 불필요 — 수정하지 않음.
기존 실패: 없음 (대상 2 스위트 전부 통과).
사용 스킬: 없음 — 브리프가 절차(TDD RED→GREEN·검증 명령)를 직접 지정했고 범위가 3파일 소규모라 스킬 로드 없이 그 절차를 따랐다.

검증: type-check·eslint(변경 3파일)·jest(otaInfo, SettingsScreen) EXIT 0. 미검증: 전체 jest(Jarvis 담당), 실기기/웹 렌더에서 OTA 행이 "앱 정보" 제목 열과 픽셀 정렬되는지 눈 확인, 웹 빌드 실제 표시.
위험·영향 범위: 설정 화면 OTA 행 표시·접근성 라벨만 바뀜. `iconContainer` width/height가 상수로 바뀌었으나 값 32 동일 — 다른 설정 행 레이아웃 불변. otaInfo.ts가 react-native `Platform`을 import(이미 앱 전역 의존).
되돌리는 법: 이 FIX 커밋을 `git revert 200ab6a8a5db72073897e52dc2cd4af53f95c104` (코드 3파일 + 이 REPORT 절을 함께 되돌림; 커밋은 amend로 이 SHA 기재 후 바뀔 수 있으니 `git log --oneline -1 --grep "web disabled state"`로 확인).
