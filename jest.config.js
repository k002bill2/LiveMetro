/**
 * Jest Configuration for LiveMetro React Native App
 */

module.exports = {
  // Basic configuration
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts',
  ],
  
  // Module name mappings
  moduleNameMapper: {
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    // Mock static assets
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
  },
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    }],
  },
  
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
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Timeout
  testTimeout: 10000,
};