module.exports = {
  extends: [
    'expo'
  ],
  rules: {
    // General code quality
    // warn/error는 에러 계약(.claude/rules/error-handling.md)상 정당한 로깅
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      typescript: {}
    }
  },
  env: {
    es6: true,
    node: true,
    jest: true
  },
  overrides: [
    {
      // CLI scripts and e2e specs report progress via stdout by design
      files: ['scripts/**', 'e2e/**'],
      rules: { 'no-console': 'off' }
    },
    {
      // Test wrappers/mocks are anonymous by convention; console is stubbed in tests
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      rules: { 'no-console': 'off', 'react/display-name': 'off' }
    }
  ]
};
