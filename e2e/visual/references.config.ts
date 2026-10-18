import { defineConfig } from '@playwright/test'

// Renders the reference PNGs from the design boards into e2e/visual/reference/.
// Run with `bun run e2e:visual:refs`. Needs no network: render-references.ts
// serves the boards' Google Fonts requests from the app's own font files.
export default defineConfig({
  testDir: '.',
  testMatch: 'render-references.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  // Single-threaded, whole-tile raster, so two renders are byte-identical (README).
  use: {
    deviceScaleFactor: 1,
    launchOptions: {
      args: ['--num-raster-threads=1', '--disable-partial-raster', '--disable-checker-imaging'],
    },
  },
  projects: [{ name: 'references', use: { browserName: 'chromium' } }],
})
