import { test as base, expect, type Page, type Route } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { APP_FONTS, assertFontsLoaded } from './fonts'
import type { Theme } from './regions'
import { VISUAL_API_URL } from '../visual.config'

const fixtureDir = path.resolve(import.meta.dirname, '..', 'fixtures')
const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'))

export const SESSION_ID = 'k2p9x4Qm7Zr1Ta'
/** 2026-10-14T09:00:00Z, the clock every spec runs at. */
export const FIXED_NOW = Date.UTC(2026, 9, 14, 9, 0, 0)
/** 30 days after FIXED_NOW (2026-11-13), as the Share dialog on B-Overlays shows. */
export const EXPIRES_AT = Date.UTC(2026, 10, 13, 9, 0, 0)

export const samplePayload = readJson('brief-sample.payload.json')
export const readerSeed = readJson('reader-state.seed.json')

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS,
    body: JSON.stringify(body),
  })
}

export function sessionEnvelope(payload: unknown = samplePayload) {
  return {
    id: SESSION_ID,
    title: (payload as { meta: { title: string } }).meta.title,
    saved: false,
    encrypted: false,
    encParams: null,
    payload: JSON.stringify(payload),
    createdAt: FIXED_NOW - 3_600_000,
    lastOpenedAt: FIXED_NOW,
    expiresAt: EXPIRES_AT,
  }
}

/**
 * Answers every API call the reader makes from the fixture. Any other call to
 * the API origin is recorded in `unexpected` and refused, so a new endpoint
 * fails the spec instead of silently going to the network.
 */
export async function mockApi(page: Page, unexpected: string[]): Promise<void> {
  const origin = new URL(VISUAL_API_URL).origin
  await page.route(`${origin}/**`, async (route) => {
    const req = route.request()
    const { pathname } = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (req.method() === 'GET' && pathname === `/api/session/${SESSION_ID}`) return json(route, sessionEnvelope())
    if (pathname === `/api/session/${SESSION_ID}/state`) {
      if (req.method() === 'GET') return json(route, { state: null })
      // apps/api answers a state write with 204 and no body.
      if (req.method() === 'PUT') return route.fulfill({ status: 204, headers: CORS })
    }
    unexpected.push(`${req.method()} ${pathname}`)
    return route.abort('failed')
  })
}

/** Serves another payload under SESSION_ID; routes added later win over mockApi's. */
export async function serveSession(page: Page, payload: unknown): Promise<void> {
  const origin = new URL(VISUAL_API_URL).origin
  await page.route(`${origin}/api/session/${SESSION_ID}`, (route) =>
    route.request().method() === 'GET' ? json(route, sessionEnvelope(payload)) : route.fallback(),
  )
}

export const test = base.extend<{ unexpectedApi: string[]; theme: Theme }>({
  theme: async ({ colorScheme }, use) => {
    await use(colorScheme === 'light' ? 'light' : 'dark')
  },
  unexpectedApi: [
    async ({ page }, use) => {
      const unexpected: string[] = []
      await mockApi(page, unexpected)
      // setFixedTime freezes Date only; timers keep running, so charts and the
      // store's debounced writes behave as in production.
      await page.clock.setFixedTime(FIXED_NOW)
      await use(unexpected)
      expect(unexpected, 'API calls the visual suite does not answer').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Applies the reader-state seed before any page script runs. Pass null for a blank reader. */
export async function seedReaderState(page: Page, state: unknown = readerSeed): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (value !== null) window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: `idocs:${SESSION_ID}`, value: state },
  )
}

/**
 * Opens the sample brief with the default board state. Waits for network idle:
 * some blocks mount after a lazy chunk loads and grow their section, which
 * would move boxes measured earlier (clipOf, expectBox). Throws if the app's
 * fonts did not load.
 */
export async function openReader(page: Page, state: unknown = readerSeed): Promise<void> {
  await seedReaderState(page, state)
  await page.goto(`/s/${SESSION_ID}`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'app')
}
