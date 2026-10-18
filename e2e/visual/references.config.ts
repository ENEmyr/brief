import { defineConfig } from '@playwright/test'

// Renders the reference PNGs from the design boards into e2e/visual/reference/.
// Run with `bun run e2e:visual:refs`. Needs network on first use: the boards
// load Geist, Geist Mono and Noto Sans Thai from Google Fonts.
export default defineConfig({
  testDir: '.',
  testMatch: 'render-references.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: { deviceScaleFactor: 1 },
  projects: [{ name: 'references', use: { browserName: 'chromium' } }],
})
