/**
 * Dynamic Expo config — wraps the static app.json and overrides paths that
 * need runtime resolution (currently the Firebase service files).
 *
 * Why this file exists:
 * - `app.json` is pure JSON — no `process.env` access.
 * - `google-services.json` / `GoogleService-Info.plist` are git-ignored
 *   secrets, so EAS Build can't archive them from the working tree.
 * - EAS Build exposes them as **file environment variables**
 *   (`GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_INFO_PLIST`) which contain
 *   the absolute path to the mounted temp file at build time.
 * - On local dev (no EAS env), we fall back to the project-root paths.
 * - Off the EAS build server (GitHub runner `eas build`, `expo config`), a
 *   missing file drops the key: the iOS Info.plist mod reads the plist during
 *   config introspection and would otherwise die with ENOENT. On the build
 *   server (`EAS_BUILD` set) the path is passed through unchecked so a missing
 *   file still fails the build loudly instead of shipping without Firebase.
 *
 * Expo reads `app.json` first and passes its `expo` object to this function
 * as `config`, so all the static config lives in one place and version
 * control sees JSON-shaped diffs. (Importing app.json directly instead of
 * using `config` trips expo-doctor's "app.config.ts is not using app.json".)
 */
import fs from 'fs';
import path from 'path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Firebase 서비스 파일 경로 결정.
 * - EAS 빌드 서버(`EAS_BUILD` 비어있지 않음 = fail-closed): 기존과 동일하게 env ?? 기본 경로.
 * - 그 외(runner·로컬): 후보 경로가 projectRoot 기준으로 실재할 때만 반환, 없으면 undefined(키 생략).
 */
const resolveGoogleServicesFile = (
  envPath: string | undefined,
  defaultPath: string,
  projectRoot: string,
): string | undefined => {
  const candidate = envPath ?? defaultPath;
  if (process.env.EAS_BUILD) {
    return candidate;
  }
  return fs.existsSync(path.resolve(projectRoot, candidate)) ? candidate : undefined;
};

/**
 * Kakao 로그인 config plugin은 네이티브 앱 키를 요구하므로 조건부로만 주입한다.
 *
 * - 조건부 주입 이유: 로컬/CI에서 키 없이도 `expo prebuild`가 성공해야 한다. 키는
 *   EAS 환경변수(`KAKAO_NATIVE_APP_KEY`)로 빌드 타임에만 주입되며, 그 값은 네이티브
 *   리소스(AndroidManifest / Info.plist)에만 쓰이고 JS 번들에는 포함되지 않는다.
 * - `kotlinVersion`을 넘기지 않는 이유: v6 플러그인은 옵션이 `kakaoAppKey`·`overrideKakaoSDKVersion`
 *   뿐이고 Kotlin 버전을 더 이상 쓰지 않는다(v5 는 미지정 시 1.5.10 을 강제해 우리가 RN 카탈로그
 *   값을 넘겼다). 라이브러리 build.gradle 은 루트 `ext.kotlinVersion` 이 있으면 그 값을, 없으면
 *   자체 gradle.properties 기본값(`RNKakaoLogins_kotlinVersion=2.1.20`, RN 0.83 카탈로그와 동일)을 쓴다.
 *   (kakao maven repo는 라이브러리 자체 build.gradle이 선언하므로 extraMavenRepos 설정은 불필요.)
 */
export default ({ config: base, projectRoot }: ConfigContext): ExpoConfig => {
  const { name, slug } = base;
  if (!name || !slug) {
    throw new Error('app.json must define expo.name and expo.slug');
  }

  const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;

  const plugins: NonNullable<ExpoConfig['plugins']> = kakaoAppKey
    ? [...(base.plugins ?? []), ['@react-native-seoul/kakao-login', { kakaoAppKey }]]
    : (base.plugins ?? []);

  const androidServicesFile = resolveGoogleServicesFile(
    process.env.GOOGLE_SERVICES_JSON,
    './google-services.json',
    projectRoot,
  );
  const iosServicesFile = resolveGoogleServicesFile(
    process.env.GOOGLE_SERVICES_INFO_PLIST,
    './GoogleService-Info.plist',
    projectRoot,
  );
  // app.json의 정적 android.googleServicesFile까지 지워야 생략이 실제로 적용된다.
  const { googleServicesFile: _staticAndroid, ...androidBase } = base.android ?? {};
  const { googleServicesFile: _staticIos, ...iosBase } = base.ios ?? {};

  return {
    ...base,
    name,
    slug,
    plugins,
    android: androidServicesFile
      ? { ...androidBase, googleServicesFile: androidServicesFile }
      : androidBase,
    ios: iosServicesFile ? { ...iosBase, googleServicesFile: iosServicesFile } : iosBase,
  };
};
