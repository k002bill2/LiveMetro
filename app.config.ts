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
 *
 * Expo loads `app.config.ts` in preference to `app.json` when both are
 * present, but we still import `app.json` so all the static config lives
 * in one place and version control sees JSON-shaped diffs.
 */
import type { ExpoConfig } from 'expo/config';

import baseConfig from './app.json';

const base = baseConfig.expo as unknown as ExpoConfig;

/**
 * Kakao 로그인 config plugin은 네이티브 앱 키를 요구하므로 조건부로만 주입한다.
 *
 * - 조건부 주입 이유: 로컬/CI에서 키 없이도 `expo prebuild`가 성공해야 한다. 키는
 *   EAS 환경변수(`KAKAO_NATIVE_APP_KEY`)로 빌드 타임에만 주입되며, 그 값은 네이티브
 *   리소스(AndroidManifest / Info.plist)에만 쓰이고 JS 번들에는 포함되지 않는다.
 * - `kotlinVersion: '1.8.10'` 명시 이유: 플러그인 기본값(1.5.10)이 RN 0.72 / Expo 49가
 *   요구하는 Kotlin 1.8.x를 다운그레이드해 Android 빌드를 깨뜨린다. (kakao maven repo는
 *   라이브러리 자체 build.gradle이 선언하므로 extraMavenRepos 설정은 불필요.)
 */
const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;

const plugins: NonNullable<ExpoConfig['plugins']> = kakaoAppKey
  ? [
      ...(base.plugins ?? []),
      [
        '@react-native-seoul/kakao-login',
        { kakaoAppKey, kotlinVersion: '1.8.10' },
      ],
    ]
  : base.plugins ?? [];

const config: ExpoConfig = {
  ...base,
  plugins,
  android: {
    ...base.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  ios: {
    ...base.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
  },
};

export default config;
