// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Exclude the .claude/ harness directory from Metro's file crawl.
// It holds git worktrees (.claude/worktrees/*) — full repo checkouts whose
// duplicate package.json ("livemetro-app" / "livemetro-functions") otherwise
// collide in Metro's Haste map: "Error: Duplicated files or mocks".
// Metro does NOT honor .gitignore, so these copies must be excluded explicitly.
config.resolver.blockList = exclusionList([/[\/\\]\.claude[\/\\].*/]);

module.exports = config;
