import { defineConfig, devices } from '@playwright/test'
import { e2ePorts } from './ports'

// Ports come from ports.ts: 8787/8788 in CI, a per-checkout base locally, or
// E2E_PORT_BASE when set. run.sh bakes the same API URL into the web build.
const ports = e2ePorts()
export const WEB_URL = ports.webUrl
export const API_URL = ports.apiUrl

// A server already on the port is reused only in CI-less runs that ask for it:
// the port is derived from this checkout, but a leftover server could still be
// an older build of it, so the default is to fail loudly instead.
const reuseExistingServer = !process.env.CI && process.env.E2E_REUSE_SERVER === '1'

// `bun run e2e` (e2e/run.sh) has already built apps/web/out with
// NEXT_PUBLIC_API_URL baked in and applied local D1 migrations before
// invoking `playwright test` -- these webServer entries only start/stop the
// two already-built local servers and block until each is actually
// reachable, so a single `bunx playwright test` run here is self-contained.
export default defineConfig({
  testDir: './tests',
  // A single local `wrangler dev` API and static web server back every
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Pixel 7 is Chromium-based (390x844 class, touch, mobile UA), so it runs
    // on the browser the suite already installs. Specs that only make sense with
    // a mouse and a wide window skip themselves on this project, each with a
    // stated reason.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Local mode: skips RATE_LIMITER (guarded by `if (env.RATE_LIMITER)`
      // in the API source) and uses the top-level env's local-placeholder D1
      // binding under apps/api/.wrangler/state -- the same state directory
      // run.sh's `wrangler d1 migrations apply --local` writes to, since both
      // run with cwd apps/api.
      command: `bunx wrangler dev --port ${ports.api} --inspector-port ${ports.apiInspector}`,
      cwd: '../apps/api',
      url: `${API_URL}/health`,
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      // static-server.ts serves the static export and applies
      // apps/web/public/_redirects (the `/s/* -> /s/ 200` rewrite the reader
      // route depends on), as Pages does. It replaced `wrangler pages dev`,
      // whose miniflare ProxyWorker crashed under repeated runs.
      command: `bun ../../e2e/static-server.ts out ${ports.web}`,
      cwd: '../apps/web',
      url: WEB_URL,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
})
