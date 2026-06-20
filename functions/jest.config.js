/** Jest config for Cloud Functions unit tests (pure handler logic). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  watchman: false,
  // Functions handler logic is extracted into pure functions + dependency
  // injection, so these are fast unit tests with no emulator dependency.
};
