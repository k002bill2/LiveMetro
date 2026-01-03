/**
 * Jest Configuration for LiveMetro React Native App
 */

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
};