import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `frontend/` is the V2 Expo app — a separate project with its own
  // dependencies, TypeScript/JSX and its own lint config
  // (frontend/eslint.frontend.config.mjs). It is not Vite/browser code, so it
  // does not belong under the browser-globals rule below; ignored here the
  // same way `server/` gets its own block rather than the browser one.
  globalIgnores(['dist', 'frontend']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
