import { defineConfig } from '@playwright/test'
import { e2ePorts } from '../ports'

// The Console visual suite. Compares the running app, fed the B-Reader sample
// brief, against PNGs rendered from the design boards (render-references.ts).
// Run with `bun run e2e:visual`. It is NOT part of `bun run e2e`.
// Ports come from ../ports.ts (see there); the web server is base + 2.
const ports = e2ePorts()
export const VISUAL_WEB_URL = ports.visualWebUrl
// The API is never started: every call is answered with page.route.
export const VISUAL_API_URL = ports.apiUrl

// The references are the design, not the app's output. Playwright's CLI flag
// overrides `updateSnapshots` below, so refuse the flag outright rather than
// let one command overwrite the design with whatever the app renders today.
if (process.argv.some((arg) => arg === '-u' || arg.startsWith('--update-snapshots'))) {
  throw new Error(
    'The visual suite never updates snapshots: e2e/visual/reference/ holds the design boards, not app output. ' +
      'Re-render them with `bun run e2e:visual:refs`.',
  )
}

export default defineConfig({
  testDir: './tests',
  // Reference PNGs live next to the renderer, named by the toHaveScreenshot argument alone.
  snapshotDir: './reference',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
  // 'missing' (the default) would write a reference for any name that has none.
  updateSnapshots: 'none',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Report and results live outside visual/, which `eslint visual` lints: the
  // report copies in the trace viewer's JS bundle.
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report-visual' }]],
  outputDir: '../test-results-visual',
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: VISUAL_WEB_URL,
    deviceScaleFactor: 1,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  // First-visit theme follows the system, so colorScheme picks the theme.
  projects: [
    { name: 'dark', use: { colorScheme: 'dark' } },
    { name: 'light', use: { colorScheme: 'light' } },
  ],
  webServer: {
    command: `bunx wrangler pages dev out --port ${ports.visualWeb} --inspector-port ${ports.visualInspector} --compatibility-date=2026-06-05`,
    cwd: '../../apps/web',
    url: VISUAL_WEB_URL,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVER === '1',
    timeout: 60_000,
  },
})
