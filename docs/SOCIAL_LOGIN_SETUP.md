# 소셜 로그인 설정 가이드 (Google · Kakao · Apple)

소셜 로그인이 실기기에서 동작하려면 **외부 콘솔 설정**과 **EAS 환경변수**, **dev client 재빌드**가
모두 갖춰져야 합니다. 아래 체크리스트를 순서대로 확인하세요.

## 개요

| Provider | 인증 흐름 | 핵심 값 |
|----------|-----------|---------|
| **Google** | 네이티브 SDK → `idToken` → `GoogleAuthProvider.credential` → Firebase `signIn`/`link` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (web client, client_type 3) |
| **Apple** | `expo-apple-authentication` + SHA256 nonce → `OAuthProvider('apple.com').credential` → Firebase `signIn`/`link` | `usesAppleSignIn` (entitlement) |
| **Kakao** | 네이티브 SDK `accessToken` → Cloud Function `kakaoLogin`(서버측 검증) → `createCustomToken` → `signInWithCustomToken` | `KAKAO_NATIVE_APP_KEY`(빌드) · `KAKAO_APP_ID`(functions) |

**앱 식별자 (공통)**

- Bundle ID / Android package: `com.livemetro.app`
- URL scheme: `livemetro`
- Firebase 프로젝트: `livemetro-cc092`

> ⚠️ 세 provider 모두 **네이티브 모듈**을 사용합니다. Expo Go 및 소셜 로그인 이전 빌드에서는
> 동작하지 않으며, **dev client / preview / production 재빌드가 필수**입니다 (§5 참고).

---

## 1. Firebase Console

Firebase Console(https://console.firebase.google.com) > 프로젝트 `livemetro-cc092` > **Authentication > Sign-in method**.

- [ ] **Google** provider "사용 설정"으로 변경 후 저장
  - 활성화하면 **web client**(OAuth 2.0 웹 클라이언트)가 자동 생성됩니다.
  - 이 web client ID가 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`의 값입니다 (§2-④).
- [ ] **Apple** provider "사용 설정"으로 변경 후 저장
  - 본 앱은 **네이티브 iOS 전용 흐름**(`expo-apple-authentication`)이므로 provider **활성화만 필수**입니다.
  - Services ID / Key / redirect URL 입력란은 **웹(OAuth redirect) 플로우용**이라 네이티브 전용에서는 **선택**입니다. 비워 두어도 iOS 네이티브 로그인은 동작합니다.
- [ ] Email/Password 등 기존 provider는 그대로 유지 (변경하지 마세요)

> Google/Apple provider가 "사용 중지됨"(회색) 상태면 로그인 시
> `auth/operation-not-allowed`가 발생합니다.

---

## 2. Google Cloud / Google 로그인

Google 네이티브 로그인은 **SHA-1 지문 + 패키지/번들 ID**로 앱을 검증합니다. redirect URI 수동 등록은
**불필요**합니다 (네이티브 플로우는 SHA-1 / bundle ID 검증으로 대체).

- [ ] **① EAS 빌드 keystore의 SHA-1 확인**

  ```bash
  eas credentials -p android
  # → Keystore > 목록에서 SHA-1 Fingerprint 확인/복사
  ```

  > 로컬 debug keystore가 아니라 **EAS가 관리하는 빌드 keystore**의 SHA-1이어야 합니다.
  > (dev client / preview / production 각각 keystore가 다를 수 있으니 사용하는 프로파일 기준으로 확인)

- [ ] **② Firebase 콘솔 Android 앱에 SHA-1 등록**
  - Firebase Console > 프로젝트 설정(⚙️) > 일반 > Android 앱 `com.livemetro.app`
  - "SHA 인증서 지문 추가"에 위 SHA-1 붙여넣기 → 저장

- [ ] **③ 갱신된 서비스 파일 재다운로드 → EAS file env 갱신**
  - SHA-1 추가 후 `google-services.json`(Android) / `GoogleService-Info.plist`(iOS)를 **다시 다운로드**
  - EAS **file 환경변수**로 등록 (app.config.ts가 `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_INFO_PLIST` 경로를 읽음):

    ```bash
    eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment development
    eas env:create --name GOOGLE_SERVICES_INFO_PLIST --type file --value ./GoogleService-Info.plist --environment development
    # preview / production 환경도 동일하게 반복
    ```

  > 이 두 파일은 git-ignored 시크릿입니다. 저장소에 커밋하지 마세요.

- [ ] **④ `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 설정**
  - `google-services.json`의 `oauth_client` 배열에서 **`client_type: 3`**(web client) 항목의 `client_id`를 사용합니다.
  - 이 값이 네이티브 SDK가 발급하는 `idToken`의 **audience**가 되며, 없으면 `idToken`이 `null`로 반환됩니다.
  - EAS 환경변수로 등록 (§5).

---

## 3. Apple Developer

- [ ] Apple Developer > Certificates, Identifiers & Profiles > **Identifiers**에서 App ID `com.livemetro.app` 선택
- [ ] **"Sign In with Apple"** capability 체크 → 저장
- [ ] entitlement(`com.apple.developer.applesignin`)는 앱 설정의 **`ios.usesAppleSignIn: true`**(app.json)에 의해 **EAS 빌드가 자동 처리**합니다. 수동으로 entitlements 파일을 만들 필요는 없습니다.
- [ ] App Store Connect의 해당 앱에도 "Sign In with Apple"이 반영됐는지 확인

> 🍎 Apple 로그인 버튼은 **실기기 iOS 13+에서만** 노출·동작합니다. 시뮬레이터/미지원 기기에서는
> `isAvailableAsync()`가 `false`를 반환하므로 앱이 버튼을 숨깁니다 (정상 동작).

---

## 4. Kakao Developers

Kakao Developers(https://developers.kakao.com) > 내 애플리케이션.

> **LiveMetro 확정 값 (2026-07-16 기준)** — 아래 ①·②에 그대로 사용:
>
> | 항목 | 값 |
> |------|-----|
> | 앱 ID (`KAKAO_APP_ID`) | `1514990` |
> | 네이티브 앱 키 (`KAKAO_NATIVE_APP_KEY`) | `8f70a45a817be91dce7341224fc17fd5` |
> | Android 패키지명 / iOS 번들 ID | `com.livemetro.app` |
> | Android 키 해시 (EAS 기본 keystore) | `Yzpt6vUJMy+w/67Se5Yi1n6v58Y=` |
>
> 키 해시는 EAS 기본 Build Credentials(`Kw300n7K4A`, SHA-1
> `63:3A:6D:EA:F5:09:33:2F:B0:FF:AE:D2:7B:96:22:D6:7E:AF:E7:C6`)에서 산출 —
> development/preview/production 프로파일이 이 기본 keystore를 공유하므로 해시 1개로
> 충분합니다. 단, **로컬 `expo run:android`용 debug keystore**(`~/.android/debug.keystore`)를
> 새로 만들면 그 해시를 추가 등록해야 합니다.

- [x] **① 앱 생성 후 두 값 확보** — 완료 (위 표)

- [x] **② 플랫폼 등록** (앱 설정 > 플랫폼) — **완료 (2026-07-16, 콘솔 배지 확인)**
  - **Android**: 패키지명 `com.livemetro.app` + 키 해시 `Yzpt6vUJMy+w/67Se5Yi1n6v58Y=` 등록 완료
    - 다른 keystore의 해시가 추가로 필요하면 SHA-1(HEX, 콜론 제거)로 변환:

      ```bash
      # <SHA1_HEX>는 콜론(:) 제거한 40자리 16진수 (eas credentials -p android 로 확인)
      echo <SHA1_HEX> | xxd -r -p | openssl base64
      ```

  - **iOS**: 번들 ID `com.livemetro.app` 등록 완료

- [ ] **③ 카카오 로그인 활성화** (제품 설정 > 카카오 로그인 > 활성화 ON)

- [ ] **④ 동의항목 설정** (카카오 로그인 > 동의항목)
  - 닉네임(profile_nickname), 프로필 사진(profile_image) → **필수 또는 선택 동의**로 설정
  - 이메일은 **비즈 앱 심사**가 필요하며 **현재 미사용**입니다 (auth record에 이메일을 넣지 않아 계정 충돌을 피함).

- [ ] **⑤ Redirect URI**
  - Redirect URI는 **REST API(웹) 로그인 전용**입니다. 본 앱은 **네이티브 SDK 흐름**이므로 **등록 불필요**합니다.

> KOE101(플랫폼 미등록) / KOE004(로그인 미활성화) 발생 시 ②·③ 항목을 재확인하세요 (§8).

---

## 5. EAS 환경변수 & 재빌드

- [ ] **환경변수 등록** — `eas env:create`(또는 EAS 대시보드)로 아래 값을 각 환경에 등록:

  ```bash
  eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <web_client_id> --environment development --visibility plaintext
  eas env:create --name KAKAO_NATIVE_APP_KEY            --value <kakao_native_key> --environment development --visibility plaintext
  # preview / production 환경도 동일하게 반복 (--environment preview / production)
  ```

  - [x] `KAKAO_NATIVE_APP_KEY` — **3개 환경(development/preview/production) 등록 완료** (2026-07-16)
  - [ ] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Firebase Google provider 활성화 후 등록 (§1·§2)

  | 변수 | 성격 | 노출 범위 |
  |------|------|-----------|
  | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 런타임(JS 번들 포함) | 공개 식별자 — 공개돼도 안전 |
  | `KAKAO_NATIVE_APP_KEY` | **빌드 타임 전용** (app.config.ts → config plugin) | 네이티브 리소스에만 기록, **JS 번들 미포함** |

- [ ] **⚠️ dev client 재빌드 (필수)**
  - 소셜 로그인은 **네이티브 모듈**을 추가하므로 **OTA 업데이트만으로는 활성화되지 않습니다**.
  - 구 바이너리에서는 모듈 부재로 로그인 시 "**최신 버전의 앱이 필요합니다**" 안내가 표시됩니다.

    ```bash
    npm run build:development   # dev client 재빌드 (preview/production은 build:preview / build:production)
    ```

---

## 6. Firebase Functions (Kakao 서버 검증)

Kakao는 클라이언트 `accessToken`을 Cloud Function `kakaoLogin`이 서버에서 검증한 뒤
custom token을 발급합니다. 검증은 카카오가 돌려준 토큰의 `app_id`가 **우리 앱 ID와 일치**하는지 대조합니다.

- [x] `functions/.env`에 숫자 앱 ID 설정 — **로컬 생성 완료** (2026-07-16, gitignored):

  ```bash
  # functions/.env
  KAKAO_APP_ID=1514990   # LiveMetro 앱 ID (§4 확정 값 표)
  ```

- [ ] 배포:

  ```bash
  firebase deploy --only functions:kakaoLogin
  ```

> `KAKAO_APP_ID`는 **서버 검증용 식별자**이며 시크릿이 아니지만, functions 런타임에서만 사용합니다.

---

## 7. 검증 체크리스트

각 provider에 대해 아래 동작을 실기기(재빌드된 dev client)에서 확인합니다.

- [ ] **Google**
  - 성공: 계정 선택 → 홈 진입
  - 취소: 계정 선택 시트를 닫으면 **에러 없이** 로그인 화면 유지 (취소는 에러 아님)
  - 미구성: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 누락 시 안내 메시지 (idToken null → 구성 에러)
- [ ] **Apple**
  - 성공: Face ID/암호 → 홈 진입 (첫 로그인 시 이름이 프로필에 병합)
  - 취소: 시트 닫으면 로그인 화면 유지
  - 미지원 기기: 버튼 미노출 (정상)
- [ ] **Kakao**
  - 성공: 카카오 동의 → 홈 진입
  - 취소: 동의 취소 시 로그인 화면 유지
  - 미구성: `KAKAO_NATIVE_APP_KEY`(빌드) 또는 `KAKAO_APP_ID`(functions) 누락 시 안내 메시지
- [ ] **익명 → 소셜 업그레이드 (데이터 보존)**
  - 익명 사용자 상태에서 **Google / Apple** 로그인 시 기존 익명 계정에 **link**되어 즐겨찾기 등 데이터가 보존됩니다.
  - **Kakao는 custom token 특성상 link를 지원하지 않습니다** → 새 세션으로 **대체**되며, 익명 상태의 로컬 데이터는 이어지지 않습니다 (문서화된 제한).

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Google `DEVELOPER_ERROR` | SHA-1 미등록 / 잘못된 `google-services.json` | §2-① SHA-1 확인 → ② Firebase 등록 → ③ 서비스 파일 재다운로드 후 재빌드 |
| Google `idToken`이 null | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 미설정/오설정 | §2-④ web client(client_type 3) ID 확인 |
| Apple `authorization attempt failed` | App ID에 "Sign In with Apple" capability 누락 | §3 capability 추가 후 재빌드 |
| Apple 버튼이 안 보임 | 시뮬레이터 또는 iOS 13 미만 | 실기기 iOS 13+ 에서 확인 (정상 동작) |
| Kakao `KOE101` | 플랫폼(패키지/키 해시/번들 ID) 미등록 | §4-② 재확인 (키 해시는 사용 keystore별로 등록) |
| Kakao `KOE004` | 카카오 로그인 비활성화 | §4-③ 카카오 로그인 활성화 |
| Android 빌드 Kotlin 버전 충돌 | kakao-login 플러그인 기본 `kotlinVersion`(1.5.10)이 RN 0.72의 Kotlin 1.8.x를 다운그레이드 | app.config.ts에서 `kotlinVersion: '1.8.10'` 명시 (이미 배선됨) |
| 로그인 시 "최신 버전의 앱이 필요합니다" / 크래시 | Expo Go 또는 네이티브 모듈 이전 빌드 | dev build 재빌드(§5). Expo Go는 소셜 로그인 미지원 |
| Kakao 로그인 후 `permission-denied` | functions `KAKAO_APP_ID`가 실제 앱 ID와 불일치 | §6 `KAKAO_APP_ID` 재확인 후 재배포 |

---

## 🔒 보안 원칙

- **클라이언트에는 공개 식별자만** 배치합니다.
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`(web client ID)와 `KAKAO_NATIVE_APP_KEY`(네이티브 앱 키)는
    설계상 **공개값**입니다 (앱 바이너리/OAuth 흐름에서 노출되는 것이 정상).
  - 클라이언트에는 **서버 시크릿(admin key, client secret 등)을 두지 않습니다.**
- **Kakao 토큰 검증은 서버(Cloud Function)에서 수행**합니다.
  - 클라이언트의 `accessToken`은 신뢰하지 않고, 함수가 `kapi.kakao.com`에 조회한 토큰의
    **`app_id`가 우리 `KAKAO_APP_ID`와 일치**할 때만 custom token을 발급합니다.
- **비밀값을 저장소에 커밋하지 않습니다.**
  - `.env`, `google-services.json`, `GoogleService-Info.plist`, `functions/.env`는 git-ignored이며,
    EAS 환경변수(런타임/파일)로만 주입합니다. 예시 값은 전부 placeholder입니다.
