import { defineConfig } from 'eslint/config'
import expoConfig from 'eslint-config-expo/flat.js'

export default defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Expo's default only wires the plain `node` resolver, which has no idea
    // about tsconfig.json's `paths` (`@/*`, and `@shared/*` → `../shared`,
    // outside this package entirely). `typescript` reads tsconfig directly;
    // `node` stays alongside it for anything path-alias resolution doesn't
    // cover. Restated in full, not merged onto Expo's, because flat-config
    // `settings` replace per key across the array rather than deep-merging.
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: true,
      },
    },
    rules: {
      // `eslint-plugin-import`'s resolvers verify a resolved path's on-disk
      // case by walking up its parent directories with `readdirSync` — for
      // `@shared/*` (`../shared`, outside this package) that walk reaches
      // this machine's home directory and can hit a permission-denied there,
      // crashing the whole lint run rather than reporting a lint error.
      // `tsc --noEmit` already checks that every import resolves and every
      // named import actually exists — strictly, and for every file, not
      // only where this plugin's resolver happens to succeed — so these are
      // redundant with it, not a loss of coverage.
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/export': 'off',
    },
  },
])
