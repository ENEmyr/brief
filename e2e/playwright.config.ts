import { defineConfig, devices } from '@playwright/test'

// Base URLs for the two local servers the suite drives. Overridable via env
// so CI (or a developer with different ports already in use) can point the
// suite elsewhere without editing this file.
export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:8788'
export const API_URL = process.env.API_URL ?? 'http://localhost:8787'

// `bun run e2e` (e2e/run.sh) has already built apps/web/out with
// NEXT_PUBLIC_API_URL baked in and applied local D1 migrations before
// invoking `playwright test` -- these webServer entries only start/stop the
// two already-built local servers and block until each is actually
// reachable, so a single `bunx playwright test` run here is self-contained.
export default defineConfig({
  testDir: './tests',
  // A single local `wrangler dev`/`wrangler pages dev` pair backs every
  // spec (webServer below), not a scalable environment -- running the
  // handful of specs one at a time is far more reliable than racing several
  // workers against one workerd instance and one D1/KV state directory.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Local mode: skips RATE_LIMITER (guarded by `if (env.RATE_LIMITER)`
      // in the API source) and uses the top-level env's local-placeholder D1
      // binding under apps/api/.wrangler/state -- the same state directory
      // run.sh's `wrangler d1 migrations apply --local` writes to, since both
      // run with cwd apps/api.
      command: 'bunx wrangler dev --port 8787',
      cwd: '../apps/api',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // wrangler pages dev serves the static export as-is, including
      // apps/web/public/_redirects (the `/s/* -> /s/ 200` rewrite the
      // reader route depends on) -- a plain static file server would not
      // honor that rewrite.
      command: 'bunx wrangler pages dev out --port 8788 --compatibility-date=2026-06-05',
      cwd: '../apps/web',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
