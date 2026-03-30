import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const reactRecommendedRules = react.configs?.recommended?.rules || {}
const reactHooksRecommendedRules =
  reactHooks.configs?.recommended?.rules || reactHooks.configs?.['recommended-latest']?.rules || {}
const reactRefreshRecommendedRules =
  reactRefresh.configs?.recommended?.rules || reactRefresh.configs?.vite?.rules || {}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      ...reactRecommendedRules,
      ...reactHooksRecommendedRules,
      ...reactRefreshRecommendedRules,
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^(_|err|error)$',
          caughtErrorsIgnorePattern: '^(err|error)$',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
])
