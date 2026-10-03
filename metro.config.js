// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the .claude/ harness directory from Metro's file crawl.
// It holds git worktrees (.claude/worktrees/*) — full repo checkouts whose
// duplicate package.json ("livemetro-app" / "livemetro-functions") otherwise
// collide in Metro's Haste map: "Error: Duplicated files or mocks".
// Metro does NOT honor .gitignore, so these copies must be excluded explicitly.
// Appended to Expo's defaults (which already exclude __tests__) instead of
// metro-config/src/defaults/exclusionList — Metro 0.83 (SDK 54) no longer
// exports that internal path, so requiring it crashed config loading.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /[\/\\]\.claude[\/\\].*/,
];

// Workaround (SDK 53+ enables package.json "exports" by default): Firebase JS
// SDK 10 then bundles @firebase/app twice — @firebase/auth's RN build does
// require('@firebase/app') (→ "require" condition → index.cjs.js) while
// `firebase/app` resolves to the ESM build. Auth registers on one copy and the
// app instance lives on the other, breaking initializeAuth/persistence.
// Legacy field resolution (react-native/browser/main) yields a single copy.
// Remove once Firebase ships a "react-native" exports condition for @firebase/app.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
