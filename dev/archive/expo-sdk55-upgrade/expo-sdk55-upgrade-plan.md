# Expo SDK 49 → 55 업그레이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo SDK 49 → 55 로 올려 Android targetSdk 36(Google Play 2026-08-31 요건)을 충족하고, Expo Doctor 16/16 을 달성한다.

**Architecture:** 격리 브랜치 하나에서 **SDK 한 단계 = 커밋 하나**(49→50→51→52→53→54→55)로 올린다. 각 단계는 공식 changelog 를 읽고 `expo install --fix` 후 같은 게이트(tsc·jest·expo-doctor·prebuild)를 통과해야 다음으로 간다. New Architecture 는 legacy 가 아직 허용되는 SDK 54 에서 먼저 켜서 실기기로 판정하고(되돌릴 수 있는 마지막 지점), SDK 55 에서 확정한다. EAS 빌드는 쿼터를 아껴 SDK 54(중간점)와 55(최종)에서만 한다.

**Tech Stack:** Expo SDK 49→55, React Native 0.72→0.83, React 18→19, EAS Build, Jest(jest-expo), Firebase JS SDK 10.

**Spec:** `dev/active/expo-sdk55-upgrade/expo-sdk55-upgrade-context.md` (요건 출처·결정·실측 사실)

## 실행 기록 (2026-10-03, 워크트리 `.claude/worktrees/expo-sdk55-upgrade`, 브랜치 `feat/expo-sdk55-upgrade`)

진행: Task 0~4 커밋·푸시 완료 (`72d9912` → `e9e84fe` → `128a182` → `87f4586` → `4a548ce`). Task 5 Step 1~4: `fc82bfc`(SDK 54+New Arch) · `ea6fefa`(SafeAreaView 26개) · `b8fdc37`(kakao kotlinVersion — 첫 Android EAS 빌드 e22fd3e0 KSP 실패 수정).
EAS 중간점: iOS `b15617b1` FINISHED(ea6fefa) · Android `b03f1678` FINISHED(b8fdc37).
**실기기 판정 (Task 5 Step 6): iOS 9/9 통과 (2026-10-03 사용자 확인 — Kakao·로그인 유지 포함 → Task 4 Step 4 해소). Android: #1 Kakao 신규 로그인 ✅ (사용자에게 재확인 — Kakao 관문 통과, SDK 55 진행 정당). 나머지 Android 항목은 Task 7 SDK 55 빌드에서 9항목 재판정.** Task 6 완료 `9a598df` (doctor 20/20, worklets jest mock 추가). Task 7: Codex 검증을 최종 빌드보다 먼저 실행(지적 반영 후 재빌드 방지).
Codex: R1 P2 1건(SafeAreaView 상단 inset 중복 — 정당, `58507ec` 반영) → R2 지적 없음(58507ec 기준). Codex 는 jest·네이티브 빌드·기기는 실행 못 함(읽기 전용) — 로컬 게이트·EAS·실기기로 보완.
SDK 55 최종 EAS: Android `03e1c557` FINISHED · iOS `41354c4a` FINISHED (58507ec, runtime 1.1.0).
**SDK 55 Android 재판정 (SM-N971N 3버튼, 다른 세션 adb 확인 23:51):** 크래시 0 · #6 탭바 ✅(내비바 위 온전) · #6 헤더 있는 설정 하위 ✅(헤더 아래 빈 여백 없음) · #6 헤더 없는 탭 ✅ · #2 ✅ · #3 ✅부분(막차 시간대, 낮 재확인 권장) · #5 ✅부분(화면만) · 미확인: #6 인증 화면 · #7 드래그 · #8 전화인증 · #9 알림 예약 시각.
**SDK 55 Android 잔여 (사용자 판정, 다른 세션 경유 00:24):** #6 인증 화면 ✅ · #7 ✅ · #8 ✅ · #9 ✅(확인한 리마인더 종류·재시작 후 주간 중복 검증 범위는 미기록) · #3 ✅ 사용자 판단 — 운행 종료 후라 출시 전 운행 시간 중 카운트다운 1회 재확인 권장. #1 은 SDK 55 에서 명시 판정 없음(SDK 54 New Arch 에서 Kakao ✅).
**SDK 55 iOS:** ✅ 설정 하위 화면 여백 정상·다이나믹 아일랜드 가림 없음 (iPhone 16 Pro, 41354c4a, 사용자 확인). 머지 전 필수 실기기 확인 완료.
CI: 첫 실행 실패(dotenv·NativeAnimatedHelper — 중첩 워크트리 거짓 통과) → `d5b06aa`·`58534f3`, 메인 밖 detached worktree 에서 CI 재현 전부 통과. PR CI 재실행 ✅ quality-gate pass (58534f3, 7m41s), MERGEABLE/CLEAN. 남은 것 = 사용자 머지 → Step 5 OTA 발행 확인. Task 6 은 Android 결과(특히 #1 Kakao, #3 cleartext, #6 edge-to-edge) 후 진행. 게이트에 '더미 kakao 키 prebuild + gradlew help'(JDK 17) 추가.
**Task 4 Step 4 → SDK 54 EAS 빌드로 이연 (2026-10-03 사용자 결정).** 설치본이 SDK 49 라 SDK 53 JS 가 안 돌고, 별도 빌드 대신 Task 5 Step 6 2번 항목에서 같은 확인을 한다. 실패 시 New Arch 와 원인이 섞임을 감수. metro 우회책(`unstable_enablePackageExports = false`)은 iOS export 번들 실측 근거로 이미 적용됨.

실행 중 발견 (각 커밋 본문에 근거 상세):
- changelog URL 은 `expo.dev/changelog/sdk-5X` 가 아니라 날짜형 (50 = `/changelog/2024/01-18-sdk-50`, 51 = `/2024/05-07-sdk-51`, 52 = `/2024/11-12-sdk-52`). `sdk-53` 은 동작.
- `npx expo install <devDep>` 는 `-- --save-dev` 를 줘도 dependencies 에 넣고, `--fix` 는 devDeps 를 갱신하지 않는다 → Expo 기대 버전을 devDependencies 에 직접 기입 후 `npm install`, `expo install --check` 로 확인.
- 워크트리(`.claude/` 하위)에서 eslint 는 상위 `.eslintrc.js` 를 cascade 로드해 플러그인 충돌 → 게이트는 `--no-eslintrc -c .eslintrc.js`. Metro blockList(`/.claude/`)가 워크트리 자체를 막아 `expo export` 는 blockList 를 임시로 끄고 실행(커밋 금지).
- typescript 는 `expo.install.exclude` 로 검사 제외(5.9.2 유지). SDK 54 가 ~5.9 를 기대하면 제외 항목 삭제.
- expo-notifications 0.29+ 는 `type` 없는 trigger 를 즉시 발송으로 처리 — SDK 52 에서 명시형으로 전환함.
  `isWeeklyTrigger` 의 iOS 런타임 형태 전제(`{type:'calendar', dateComponents}`)는 0.31 네이티브로 확인: `SchedulerModule.swift:122` → `EXNotificationSerializer.m:129-133`.
- patches/ 는 SDK 52 에서 비었음(dev-menu 원본에 수정 반영). SDK 51 은 로컬 Xcode 26 때문에 doctor 1건 실패(환경 문제, SDK 52 에서 해소).
- 게이트 스크립트·로그: 워크트리 `.gate-logs/` (info/exclude 로 git 제외).

## Global Constraints

- **선행 조건:** `dev/active/phone-auth-recaptcha-webview/` 가 main 에 머지돼 있어야 한다 (`npm ls expo-firebase-core` 가 비어 있음).
- **OTA 크래시 방지:** 첫 커밋에서 `app.json` `version` 을 `1.0.0` → `1.1.0` 으로 올린다 (runtimeVersion policy 가 `appVersion` 이라 이것이 새 런타임을 만든다). 이 커밋 없이 main 에 머지 금지 — `preview-ota.yml` 이 새 JS 를 SDK 49 설치본으로 배달한다.
- **브랜치:** `feat/expo-sdk55-upgrade` 하나. 단계마다 커밋하고 push. main 머지는 Task 7 완료 후 1회.
- **단계 게이트(모든 Task 공통, 통과 못 하면 다음 단계 금지):**
  `npx tsc --noEmit` exit 0 · `(cd functions && npx tsc --noEmit)` exit 0 · `npx jest --watchman=false --maxWorkers=2 --silent` 0 failures · `npx eslint . --ext .ts,.tsx` 0 errors · `npx expo-doctor` 실패 항목이 직전 단계보다 늘지 않음 · `npx expo prebuild --clean --no-install` exit 0 (확인 후 `git status` 로 생성물이 커밋 대상에 안 들어가는지 확인 — `android/`·`ios/` 는 gitignore 대상인지 Task 0 에서 확인).
- 각 SDK 단계의 **첫 행동은 그 SDK 의 changelog 읽기**: `https://expo.dev/changelog/sdk-5X`. 아래 Task 의 "알려진 변경"은 출발점일 뿐이며 changelog 가 우선한다.
- 버전 지정은 `npx expo install` 로만 한다 (`npm install pkg@x` 직접 지정 금지 — SDK 호환 버전표를 우회한다).
- 서울 실시간 API 는 **http 유지** (`plugins/withSeoulApiCleartext.js`). https 강제 금지 — 서버가 443 을 열지 않는다.
- 2-Strike: 같은 단계에서 같은 수정이 2번 실패하면 멈추고 원인 분석 후 사용자에게 보고.
- EAS 빌드는 sandbox off, 전역 `eas` 바이너리, `--non-interactive --no-wait`.

## Review Focus

1. **Android edge-to-edge (targetSdk 36 강제)** — 상태바·내비게이션바 밑으로 콘텐츠가 깔리거나 하단 탭이 제스처 바에 가려짐. 오늘(10/03) SafeArea 검증은 iOS 만 했다 → Task 5·7 Android 실기기 체크리스트에 탭 5개 확인 포함.
2. **서울 API cleartext** — 단계를 거치며 config plugin 순서·Android manifest 병합이 바뀌어 http 가 막히면 도착정보가 캐시로만 보임 → Task 5·7 에서 prebuild 산출물의 network security config 확인 + 실기기 도착정보 확인.
3. **Firebase JS SDK 인증 유지(persistence)** — SDK 53 부터 Metro package exports 기본 활성 → `firebase/auth` 가 다른 빌드로 해석되면 `getReactNativePersistence` 가 깨져 앱 재시작 시 로그아웃됨 → Task 4 에 "로그인 → 앱 종료 → 재실행 → 로그인 유지" 확인.
4. **로그인 4종(이메일·Google·Kakao·Apple)** — 특히 kakao-login 은 codegen 없이 interop 에 의존 → Task 5 에서 New Arch 켠 직후 실기기 판정. 실패 시 SDK 54 에서 멈추고 대안 결정.
5. **React 19 / jest-expo 상향** — 5,891 테스트 중 렌더러·타이머 관련 일괄 실패 → Task 4 에서 실패 패턴을 분류(코드 결함 vs 테스트 하네스)하고 하네스 문제는 `src/__tests__/setup.ts` 에서 한 번에 해결.

---

### Task 0: 브랜치 준비 + 런타임 버전 상향 + 죽은 의존성 제거

**Files:**
- Modify: `app.json` (`expo.version`)
- Modify: `package.json`, `package-lock.json`

- [x] **Step 1: 선행 조건 확인**

```bash
git switch main && git pull --ff-only
npm ls expo-firebase-core            # Expected: (empty) — 전화 인증 계획 머지 완료
git grep -n "expo-camera" -- src App.tsx   # Expected: 0건
git check-ignore -q android && git check-ignore -q ios && echo "native dirs ignored"
```
`native dirs ignored` 가 안 나오면 멈추고 보고한다(prebuild 가 추적 파일을 덮어쓴다).

- [x] **Step 2: 브랜치 + 버전 상향**

```bash
git switch -c feat/expo-sdk55-upgrade
```
`app.json` 의 `"version": "1.0.0"` → `"version": "1.1.0"`.

- [x] **Step 3: 죽은 의존성 제거**

```bash
npm uninstall @types/react-native expo-camera
```
(`@types/react-native` — RN 0.72 부터 타입 내장, expo-doctor 지적 대상. `expo-camera` — 사용 0건.)

- [x] **Step 4: 게이트**

Global Constraints 의 단계 게이트 전부 실행. Expected: expo-doctor 실패 항목에서 "should not be installed directly" 가 사라짐(남은 것: API 레벨).

- [x] **Step 5: Commit**

```bash
git add app.json package.json package-lock.json
git commit -m "chore(sdk): SDK 업그레이드 준비 — 앱 버전 1.1.0(새 OTA 런타임) + 미사용 의존성 제거"
git push -u origin feat/expo-sdk55-upgrade
```

---

### Task 1: SDK 50 (RN 0.73)

**Files:** `package.json`, `package-lock.json`, `patches/@expo+cli+0.10.17.patch`, `patches/expo-dev-menu+3.2.4.patch`, changelog 가 요구하는 소스 파일

**알려진 변경 (changelog 로 확인):** RN 0.73, `@expo/cli` 메이저 상향 → `@expo+cli+0.10.17.patch` 는 대상 버전이 사라져 재적용 실패, `expo-dev-menu` 상향 → 같은 문제.

- [x] **Step 1: changelog 읽기** — `https://expo.dev/changelog/sdk-50` 의 Breaking changes 를 이 Task 체크리스트 아래에 한 줄씩 메모한다.

- [x] **Step 2: 패치 판정**

```bash
cat patches/@expo+cli+0.10.17.patch patches/expo-dev-menu+3.2.4.patch
```
각 패치에 대해: 고친 문제(cli=minimatch default export 호환, dev-menu=simulator 판별)가 새 버전 소스에 이미 반영됐는지 `node_modules` 의 해당 파일을 업그레이드 후 열어 확인 → 반영됐으면 `git rm`, 아니면 새 버전에 맞춰 `npx patch-package <pkg>` 로 재생성.

- [x] **Step 3: 업그레이드**

```bash
npx expo install expo@^50.0.0 -- --legacy-peer-deps
npx expo install --fix
npx expo install jest-expo eslint-config-expo
```
(`--legacy-peer-deps` 는 `expo install` 이 실패할 때만. 쓰면 커밋 메시지에 남긴다.)

- [x] **Step 4: 게이트** — Global Constraints 단계 게이트 전부. 실패는 changelog 메모와 대조해 고친다.

- [x] **Step 5: Commit**

```bash
git add -A package.json package-lock.json patches/ src/ app.json
git commit -m "chore(sdk): Expo SDK 50 (RN 0.73)"
git push
```

---

### Task 2: SDK 51 (RN 0.74)

**Files:** `package.json`, `package-lock.json`, changelog 가 요구하는 소스 파일

- [x] **Step 1: changelog 읽기** — `https://expo.dev/changelog/sdk-51` Breaking changes 메모.

- [x] **Step 2: 업그레이드**

```bash
npx expo install expo@^51.0.0
npx expo install --fix
npx expo install jest-expo eslint-config-expo
```

- [x] **Step 3: 게이트** — 단계 게이트 전부.

- [x] **Step 4: Commit**

```bash
git add -A package.json package-lock.json patches/ src/ app.json
git commit -m "chore(sdk): Expo SDK 51 (RN 0.74)"
git push
```

---

### Task 3: SDK 52 (RN 0.76)

**Files:** `package.json`, `package-lock.json`, `app.json`(필요 시 iOS deployment target), changelog 가 요구하는 소스 파일

**알려진 변경 (changelog 로 확인):** iOS 최소 15.1, 신규 프로젝트 New Arch 기본(기존 프로젝트는 아직 opt-in).

- [x] **Step 1: changelog 읽기** — `https://expo.dev/changelog/sdk-52` 메모.

- [x] **Step 2: 업그레이드**

```bash
npx expo install expo@^52.0.0
npx expo install --fix
npx expo install jest-expo eslint-config-expo
```

- [x] **Step 3: New Arch 는 아직 끈다** — `app.json` 에 `"newArchEnabled": false` 를 명시(SDK 52 에서 기본값이 바뀌었으면). 아키텍처 전환은 Task 5 에서만 한다(원인 분리).

- [x] **Step 4: 게이트** — 단계 게이트 전부.

- [x] **Step 5: Commit**

```bash
git add -A package.json package-lock.json patches/ src/ app.json
git commit -m "chore(sdk): Expo SDK 52 (RN 0.76), New Arch 는 명시적 off 유지"
git push
```

---

### Task 4: SDK 53 (RN 0.79, React 19)

**Files:** `package.json`, `package-lock.json`, `src/__tests__/setup.ts`(필요 시), `metro.config.js`(필요 시), changelog 가 요구하는 소스 파일

**알려진 변경 (changelog 로 확인):** React 19, `@types/react` 19, Metro package exports 기본 활성, `newArchEnabled` 기본 true(위 Step 에서 계속 false 로 고정).

- [x] **Step 1: changelog 읽기** — `https://expo.dev/changelog/sdk-53` 메모.

- [x] **Step 2: 업그레이드**

```bash
npx expo install expo@^53.0.0
npx expo install --fix
npx expo install jest-expo eslint-config-expo @types/react
```

- [x] **Step 3: jest 실패 분류** — 실패가 많으면 첫 실패 3개의 스택을 보고 (a) 하네스(렌더러·타이머·mock) 문제면 `src/__tests__/setup.ts` 에서 공통 해결, (b) 코드 결함이면 해당 파일 수정. 분류 결과를 커밋 메시지 본문에 남긴다.

- [x] **Step 4: Firebase persistence 확인 (Review Focus 3)** — SDK 54 iOS 빌드로 확인 통과 (Android 대기)

jest 는 `firebase/auth` 를 mock 하므로 이 결함을 잡지 못한다. 게이트 통과 후 **dev client 로 1회** 확인: 로그인 → 앱 완전 종료 → 재실행 → 로그인 유지. 깨지면 `metro.config.js` 에 `config.resolver.unstable_enablePackageExports = false;` 를 넣고 재확인(우회책임을 주석으로 명시).

- [x] **Step 5: 게이트** — 단계 게이트 전부.

- [x] **Step 6: Commit**

```bash
git add -A package.json package-lock.json patches/ src/ app.json metro.config.js
git commit -m "chore(sdk): Expo SDK 53 (RN 0.79, React 19)"
git push
```

---

### Task 5: SDK 54 (RN 0.81) + New Architecture 전환 + 중간점 실기기 판정

**Files:** `package.json`, `package-lock.json`, `app.json`, `babel.config.js`(Reanimated 4), `src/hooks/useSubwayLineSvgXml.ts`, `src/services/certificate/pdfService.ts`, `src/services/map/mapCacheService.ts`, changelog 가 요구하는 소스 파일

**알려진 변경 (changelog 로 확인):** Legacy 를 허용하는 마지막 SDK, targetSdk 36 + Android edge-to-edge 상시, Reanimated 4(New Arch 전용, `react-native-worklets` 필요), `expo-file-system` 신 API(구 API 는 `expo-file-system/legacy`).

- [x] **Step 1: changelog 읽기** — `https://expo.dev/changelog/sdk-54` 메모.

- [x] **Step 2: 업그레이드 + New Arch 켜기**

```bash
npx expo install expo@^54.0.0
npx expo install --fix
npx expo install jest-expo eslint-config-expo react-native-reanimated react-native-worklets
```
`app.json` 의 `"newArchEnabled": false` 를 **삭제**(SDK 54 기본 true). Reanimated 4 babel 플러그인 설정은 changelog/Reanimated 4 마이그레이션 문서대로 `babel.config.js` 수정.

- [x] **Step 3: expo-file-system 3곳** — 우선 최소 변경으로 import 를 `expo-file-system/legacy` 로 바꿔 동작 동일성을 유지한다(신 API 전환은 별건):

```ts
// src/hooks/useSubwayLineSvgXml.ts:4
import { readAsStringAsync } from 'expo-file-system/legacy';
// src/services/map/mapCacheService.ts:7
import * as FileSystem from 'expo-file-system/legacy';
// src/services/certificate/pdfService.ts:101
FileSystem = require('expo-file-system/legacy') as FileSystemModule;
```
각 파일의 테스트 mock 경로(`jest.mock('expo-file-system', …)`)도 `expo-file-system/legacy` 로 맞춘다: `git grep -n "jest.mock('expo-file-system'" -- src`.

- [x] **Step 4: 게이트** — 단계 게이트 전부 + prebuild 산출물 확인:

```bash
grep -n "targetSdkVersion\|compileSdkVersion" android/build.gradle android/gradle.properties   # Expected: 36
grep -rn "cleartextTrafficPermitted\|swopenapi" android/app/src/main/res/xml/ 2>/dev/null       # Expected: 서울 API 도메인 존재
```

- [x] **Step 5: Commit + 중간점 EAS 빌드**

```bash
git add -A package.json package-lock.json patches/ src/ app.json babel.config.js
git commit -m "chore(sdk): Expo SDK 54 (RN 0.81) + New Architecture 전환"
git push
eas build --platform all --profile preview --non-interactive --no-wait
```

- [ ] **Step 6: 실기기 판정 (사람 손 필요, iOS·Android 둘 다)**

| # | 항목 | 판정 |
|---|---|---|
| 1 | 로그인 4종 (이메일·Google·**Kakao**·Apple) | iOS ✅ (사용자 9/9) · Android ✅ Kakao 신규 로그인 성공 (사용자 확인 2026-10-03, SDK 54 b8fdc37 New Arch) |
| 2 | 로그인 → 앱 완전 종료 → 재실행 → 로그인 유지 | iOS ✅ · Android ✅ (SM-N971N 강제 종료 후 유지) |
| 3 | 실시간 도착정보 표시 (Android 에서 특히 — cleartext) | iOS ✅ · Android ✅ (산곡역 초 단위 카운트다운) |
| 4 | 위치 권한 + 실제 주변역 | iOS ✅ · Android ✅ (산곡역 967m) |
| 5 | 알림 권한 + 알림 설정 화면 | iOS ✅ · Android 미확인 |
| 6 | **Android edge-to-edge**: 탭 5개에서 상태바·제스처바 가림 없음 + 화면 26개는 `ea6fefa` 에서 safe-area-context 로 교체됨(인증·설정 화면 위주로 확인) + **보류한 Modal 5개**: RecaptchaVerifierModal(전화인증), StationSearchModal, SettingPicker, VibrationPicker, DelayReportForm(지연 제보) — Android 에서 상단/하단 가림 확인, 문제 시 StationPickerModal 패턴(내부 SafeAreaProvider) | iOS ✅ · Android ❌ 탭바가 3버튼 내비바에 가림 → `58507ec` 수정(재판정 필요). 같은 커밋에서 Codex P2(헤더 아래 상단 inset 중복) 수정 |
| 7 | 즐겨찾기 드래그 정렬(draggable-flatlist + Reanimated 4) | iOS ✅ · Android 미확인 |
| 8 | 전화 인증(회원가입 1단계, Firebase 테스트 번호) | iOS ✅ · Android 미확인 |
| 9 | **알림 예약 시각**: 도착/출근 리마인더가 예약 시각에 울림(즉시 X) · 앱 재시작 후 주간 리마인더 중복·소실 없음 (SDK 52 trigger 명시형 전환 검증) | iOS ✅ · Android 미확인 |

**판정 규칙:** 1번 Kakao 가 New Arch 에서 실패하면 Task 6 진행 금지 — SDK 54 + `newArchEnabled: false` 로 되돌려 출시 가능한 상태를 확보한 뒤, kakao-login 대체(REST 로그인 등)를 별도 결정으로 사용자에게 올린다.

---

### Task 6: SDK 55 (RN 0.83) — Legacy 제거 확정

**Files:** `package.json`, `package-lock.json`, `app.json`, `.github/workflows/preview-ota.yml`, changelog 가 요구하는 소스 파일

**알려진 변경 (changelog 확인 완료):** `newArchEnabled`·`edgeToEdgeEnabled` 설정 제거, Node ^20.19.4/^22.13.0, Xcode 26, **`eas update` 에 `--environment` 필수**.

- [x] **Step 1: changelog 재확인** — `https://expo.dev/changelog/sdk-55`.

- [x] **Step 2: 업그레이드**

```bash
npx expo install expo@^55.0.0
npx expo install --fix
npx expo install jest-expo eslint-config-expo
```
`app.json` 에 `newArchEnabled`/`edgeToEdgeEnabled` 키가 남아 있으면 삭제.

- [x] **Step 3: OTA 워크플로우 수정** — `preview-ota.yml` 의 `eas update` 호출에 `--environment` 추가:

```bash
git grep -n "eas update" -- .github/workflows/preview-ota.yml
```
찾은 각 줄에 채널과 같은 이름의 환경을 붙인다(예: `--channel preview` 줄 → `--environment preview`, production 분기 → `--environment production`).

- [x] **Step 4: 게이트** — 단계 게이트 전부. expo-doctor Expected: **16/16**.

- [x] **Step 5: Commit**

```bash
git add -A package.json package-lock.json patches/ src/ app.json .github/workflows/preview-ota.yml
git commit -m "chore(sdk): Expo SDK 55 (RN 0.83) — Legacy Architecture 제거, eas update --environment"
git push
```

---

### Task 7: 최종 빌드 + 실기기 전체 판정 + PR

- [x] **Step 1: 최종 EAS 빌드**

```bash
eas build --platform all --profile preview --non-interactive --no-wait
```

- [x] **Step 2: 실기기 판정** — Task 5 Step 6 표 9항목을 SDK 55 빌드로 iOS·Android 모두 다시 판정. 전부 ✅ 여야 다음 단계.

- [x] **Step 3: Codex 검증 (필수 게이트)** — R1 P2 반영, R2 클린

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1)
node "$SCRIPT" review --scope branch --base origin/main
```
최대 3라운드. 반영하지 않은 지적은 이유와 함께 PR 본문에.

- [x] **Step 4: PR** — #348 (https://github.com/k002bill2/LiveMetro/pull/348), 머지는 사용자가 남은 실기기 확인 후 — `commit-push-pr` 스킬로 생성. 본문에: 단계별 커밋 목록, 실기기 판정표, expo-doctor 16/16 출력, OTA 런타임 버전 1.1.0 설명.

- [ ] **Step 5: 머지 후 확인**

```bash
gh run list --workflow=preview-ota.yml --limit 1   # Expected: success, 런타임 1.1.0 으로 발행
```
