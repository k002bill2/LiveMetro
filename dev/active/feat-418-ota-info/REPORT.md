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
