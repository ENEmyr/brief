import { baseConfig } from '@brief/config/eslint'

// Playwright tests live outside any features/ tree, so the vertical-slice
// boundaries plugin (boundariesConfig, used by apps/web and apps/api) does
// not apply here -- baseConfig alone is enough.
export default [...baseConfig, { ignores: ['playwright-report/**', 'test-results/**'] }]
