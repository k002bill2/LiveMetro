// Minimal flat config for Cloud Functions (ESLint 10 dropped .eslintrc / --ext).
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['lib/**', 'node_modules/**'] },
  ...tseslint.configs['flat/recommended'],
  {
    rules: {
      // `_`-prefixed names are the codebase's marker for intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
