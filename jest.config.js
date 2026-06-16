/**
 * Jest Configuration for LiveMetro React Native App
 */

// LiveMetro is a Seoul-only app. Pin TZ so date/time-formatting tests are
// deterministic across local (often KST) and CI (UTC) environments.
// Why: regression on PR #60 — TZ-naive formatHHMM produced '08:00' locally
// but '23:00' in UTC, breaking congestionService.getHourlyForecast tests.
process.env.TZ = 'Asia/Seoul';

module.exports = {
  // Use jest-expo preset for React Native
  preset: 'jest-expo',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts',
  ],

  // Global variables for React Native
  globals: {
    __DEV__: true,
  },

  // Module name mappings
  moduleNameMapper: {
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
  },

  // Test patterns - exclude setup and mock files
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],

  // Transform ignore patterns for React Native modules
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase)',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.(test|spec).{ts,tsx}',
    '!src/models/**', // Type definitions only
  ],

  coverageReporters: ['text', 'lcov', 'json-summary', 'clover'],

  // SSOT for the PR-blocking coverage gate. Ratcheted from the initial
  // 15/20/20/20 safety net to tier-1 targets after a measured full --coverage
  // pass (stmt 84.8 / br 73.6 / fn 87.2 / lines 86.0 — all clear with headroom).
  // Do NOT raise to the 85/80/70 final targets yet: statements sits at ~84.8%,
  // so an 85 gate would fail the next run. See .claude/rules/coverage-thresholds.md.
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },

  // Ignore problematic patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/src/__tests__/__mocks__/',
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Timeout
  testTimeout: 10000,

  // Watchman: use --no-watchman flag locally if permission issues occur
  // watchman: false,
};