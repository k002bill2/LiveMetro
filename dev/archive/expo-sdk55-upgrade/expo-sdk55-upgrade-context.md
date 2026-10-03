# Expo SDK 49 → 55 업그레이드 — Context

작성 2026-10-03. 계획: `expo-sdk55-upgrade-plan.md`

## 왜 하는가 — Play 스토어 target API
- Google Play: **2026-08-31 부터 새 앱·업데이트는 Android 16 (API 36) 이상 target** 필수.
  연장 신청 시 2026-11-01 까지. 출처: https://developer.android.com/google/play/requirements/target-sdk (2026-10-03 조회)
- expo-doctor 의 "API 34" 문구는 2024 기준이라 낡았다. **SDK 50 으로는 부족.**
- Expo 버전표(https://docs.expo.dev/versions/latest/, 2026-10-03): SDK 54~57 이 targetSdk 36. 최신 57.

## 결정 (2026-10-03 사용자 선택)
- 목표: **SDK 55 이상** (New Architecture 강제 구간에 한 번에 진입). 기각안: SDK 54(legacy 마지막, 내년 재전환 필요).
- 제출 일정: **정해진 날짜 없음** → SDK 한 단계씩, 단계마다 게이트.
- 전화 인증 선행: `dev/active/phone-auth-recaptcha-webview/` 를 SDK 49 에서 먼저 머지.

## 확인된 사실 (L1)
- SDK 55 changelog: "SDK 54 is the final release to include Legacy Architecture support", `newArchEnabled` 제거,
  Android 16 target 시 edge-to-edge 필수, Node ^20.19.4 / ^22.13.0, Xcode 26 필요, `eas update` 에 `--environment` 필수.
- 로컬: Node v22.23.1, Xcode 26.6 → SDK 55 요건 충족. CI quality-gate 는 `node-version: '20'`(최신 20.x 해석).
- `app.json` runtimeVersion = `{ policy: "appVersion" }`, version `1.0.0`. preview-ota.yml 이 main 머지 시 자동 OTA 발행
  → **버전 안 올리고 머지하면 새 JS 가 SDK 49 설치본으로 배달되어 크래시**.
- 네이티브 의존성 New Arch 상태(reactnative.directory, 2026-10-03):
  google-signin ✅ / draggable-flatlist ✅ / lucide ✅ / slider·webview·datetimepicker: 표기 없음(최신 릴리스 2026) /
  `@react-native-seoul/kakao-login` 6.0.4(2026-08) codegenConfig 없음 → **interop 레이어 의존, 최대 위험** /
  `react-native-markdown-display` unmaintained 지만 순수 JS.
- `expo-camera` 는 의존성에 있으나 `src` 사용 0건 → 제거 후보.
- `expo-file-system` 3곳 사용(`useSubwayLineSvgXml.ts`, `pdfService.ts`, `mapCacheService.ts`) → SDK 54 신 API 전환 대상.
- 패치 3개: `@expo+cli+0.10.17`(minimatch export 호환), `expo-dev-menu+3.2.4`(simulator 판별),
  `expo-firebase-core+6.0.0`(전화 인증 계획에서 제거됨). 버전 고정 패치라 SDK 상향 시 재적용 실패 → 단계별 판정 필요.
- Firebase JS SDK auth 는 `initializeAuth` + `getReactNativePersistence(AsyncStorage)` (`config.ts:9-11`).

## 미확인 (계획 실행 중 확인)
- SDK 50~53 각 changelog 의 세부 breaking change — 각 Task 첫 단계에서 읽는다.
- kakao-login 이 New Arch interop 에서 실제로 동작하는지 — Task 5(SDK 54, New Arch 켠 상태)에서 실기기로 판정.
