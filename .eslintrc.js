module.exports = {
  extends: [
    'expo'
  ],
  rules: {
    // General code quality
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  env: {
    es6: true,
    node: true,
    jest: true
  }
};