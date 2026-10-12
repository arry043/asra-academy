// Single flat ESLint config for the whole monorepo.
// Workspace `eslint .` runs resolve this file by walking up from their cwd.
import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WEB_FILES = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'apps/api/src/generated/**',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },

  // Next.js (React, hooks, a11y, core web vitals) — scoped to the web app only.
  ...nextCoreWebVitals.map((config) => ({
    ...config,
    files: WEB_FILES,
    settings: { ...config.settings, next: { rootDir: 'apps/web' } },
  })),
  {
    files: WEB_FILES,
    languageOptions: { globals: { ...globals.browser } },
  },

  // API: no browser globals; discourage stray console logging in favour of the logger.
  {
    files: ['apps/api/src/**/*.ts'],
    rules: { 'no-console': ['warn', { allow: ['error'] }] },
  },

  prettier,
);
