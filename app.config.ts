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
 * Expo reads `app.json` first and passes its `expo` object to this function
 * as `config`, so all the static config lives in one place and version
 * control sees JSON-shaped diffs. (Importing app.json directly instead of
 * using `config` trips expo-doctor's "app.config.ts is not using app.json".)
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Kakao 로그인 config plugin은 네이티브 앱 키를 요구하므로 조건부로만 주입한다.
 *
 * - 조건부 주입 이유: 로컬/CI에서 키 없이도 `expo prebuild`가 성공해야 한다. 키는
 *   EAS 환경변수(`KAKAO_NATIVE_APP_KEY`)로 빌드 타임에만 주입되며, 그 값은 네이티브
 *   리소스(AndroidManifest / Info.plist)에만 쓰이고 JS 번들에는 포함되지 않는다.
 * - `kotlinVersion`을 넘기지 않는 이유: v6 플러그인은 옵션이 `kakaoAppKey`·`overrideKakaoSDKVersion`
 *   뿐이고 Kotlin 버전을 더 이상 쓰지 않는다(v5 는 미지정 시 1.5.10 을 강제해 우리가 RN 카탈로그
 *   값을 넘겼다). 라이브러리 build.gradle 은 루트 프로젝트의 `kotlinVersion` ext 를 따른다.
 *   (kakao maven repo는 라이브러리 자체 build.gradle이 선언하므로 extraMavenRepos 설정은 불필요.)
 */
export default ({ config: base }: ConfigContext): ExpoConfig => {
  const { name, slug } = base;
  if (!name || !slug) {
    throw new Error('app.json must define expo.name and expo.slug');
  }

  const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;

  const plugins: NonNullable<ExpoConfig['plugins']> = kakaoAppKey
    ? [...(base.plugins ?? []), ['@react-native-seoul/kakao-login', { kakaoAppKey }]]
    : (base.plugins ?? []);

  return {
    ...base,
    name,
    slug,
    plugins,
    android: {
      ...base.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    ios: {
      ...base.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    },
  };
};
