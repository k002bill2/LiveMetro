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

const config: ExpoConfig = {
  ...base,
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
