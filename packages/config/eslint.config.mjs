import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

export const baseConfig = defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
  { ignores: ['dist/**', 'out/**', '.next/**', '.wrangler/**', 'drizzle/**'] },
)

// Vertical slice / feature-folder boundary rules.
// A feature may only be imported from outside via its index.ts (enforced below by
// boundaries/entry-point, which applies to every importer, not just the app layer).
// Cross-feature composition is allowed as long as it goes through that index.ts.
export function boundariesConfig() {
  return {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'app', pattern: 'src/*' },
      ],
      'import/resolver': {
        typescript: true,
      },
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            { from: ['shared'], disallow: ['feature'], message: 'shared/ must not depend on features.' },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          rules: [
            // shared/ and the app root (app.ts, env.ts, index.ts, db/schema.ts) have no
            // designated entry file; any of their files may be imported directly.
            { target: ['shared', 'app'], allow: ['**'] },
            { target: ['feature'], allow: ['index.ts', 'index.tsx'] },
          ],
        },
      ],
    },
  }
}
