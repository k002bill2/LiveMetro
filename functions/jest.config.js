/** Jest config for Cloud Functions unit tests (pure handler logic). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  watchman: false,
  // Functions handler logic is extracted into pure functions + dependency
  // injection, so these are fast unit tests with no emulator dependency.
  //
  // firebase-admin 14 → jwks-rsa 4 → jose 6 is ESM-only. Node 22 loads it via
  // require(esm), but Jest 29's CJS runtime cannot, so transpile jose to CJS.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+/node_modules/jose/.+\\.js$': [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'commonjs' }, isolatedModules: true },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
};
