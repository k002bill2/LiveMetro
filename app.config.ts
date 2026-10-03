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
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Kakao 로그인 config plugin은 네이티브 앱 키를 요구하므로 조건부로만 주입한다.
 *
 * - 조건부 주입 이유: 로컬/CI에서 키 없이도 `expo prebuild`가 성공해야 한다. 키는
 *   EAS 환경변수(`KAKAO_NATIVE_APP_KEY`)로 빌드 타임에만 주입되며, 그 값은 네이티브
 *   리소스(AndroidManifest / Info.plist)에만 쓰이고 JS 번들에는 포함되지 않는다.
 * - `kotlinVersion` 명시 이유: 플러그인은 값이 없으면 1.5.10 을 android.kotlinVersion 과
 *   kotlin-gradle-plugin classpath 에 강제로 쓴다. 고정값(예전 '1.8.10')은 RN 업그레이드 때마다
 *   Kotlin 을 다운그레이드해 빌드를 깨뜨리므로(SDK 54: "Can't find KSP version for Kotlin
 *   1.8.10"), 설치된 react-native 의 gradle 버전 카탈로그에서 읽는다. (kakao maven repo는
 *   라이브러리 자체 build.gradle이 선언하므로 extraMavenRepos 설정은 불필요.)
 */
const readReactNativeKotlinVersion = (): string => {
  const catalog = join(
    dirname(require.resolve('react-native/package.json')),
    'gradle',
    'libs.versions.toml'
  );
  const version = readFileSync(catalog, 'utf8').match(/^kotlin\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) {
    throw new Error(`kotlin version not found in ${catalog}`);
  }
  return version;
};

export default ({ config: base }: ConfigContext): ExpoConfig => {
  const { name, slug } = base;
  if (!name || !slug) {
    throw new Error('app.json must define expo.name and expo.slug');
  }

  const kakaoAppKey = process.env.KAKAO_NATIVE_APP_KEY;

  const plugins: NonNullable<ExpoConfig['plugins']> = kakaoAppKey
    ? [...(base.plugins ?? []), ['@react-native-seoul/kakao-login', { kakaoAppKey, kotlinVersion: readReactNativeKotlinVersion() }]]
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
