import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ['dist/**', 'out/**', '.next/**', '.wrangler/**', 'drizzle/**'] },
)

// Vertical slice / feature-folder boundary rules.
// A feature may only be imported from outside via its index.ts.
// Features must not import other features' internals.
export function boundariesConfig() {
  return {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'app', pattern: 'src/*' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: [['feature', { feature: '${feature}' }]],
              disallow: [['feature', { feature: '!${feature}' }]],
              message: 'Feature "${file.feature}" must not import internals of another feature. Import from its index.ts through the app layer instead.',
            },
            { from: ['shared'], disallow: ['feature'], message: 'shared/ must not depend on features.' },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        { default: 'disallow', rules: [{ target: ['feature'], allow: ['index.ts', 'index.tsx'] }] },
      ],
    },
  }
}
