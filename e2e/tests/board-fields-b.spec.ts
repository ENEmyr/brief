import type { Browser, Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const XSS = '<img src=x onerror="window.__xss=1">'

const payload: Payload = {
  meta: { title: 'Board fields b' },
  sections: [
    {
      id: 'flow',
      no: 1,
      title: 'Request path',
      blocks: [
        {
          type: 'seq',
          actors: ['Client', 'Edge', 'Limiter'],
          steps: [
            { from: 'Client', to: 'Edge', label: 'GET /orders', text: 'Client sends GET /orders' },
            { from: 'Edge', to: 'Limiter', label: 'take(key, 1)' },
            { from: 'Limiter', to: 'Edge', label: XSS, text: XSS },
          ],
        },
        {
          type: 'state',
          initial: 'in',
          states: [
            { id: 'in', label: 'Received' },
            { id: '429', label: `429 limited ${XSS}`, tone: 'bad' },
            { id: 'done', label: 'Done', tone: 'good' },
          ],
          transitions: [
            { from: 'in', to: '429', label: XSS, tone: 'bad' },
            { from: '429', to: 'in', label: 'retry', tone: 'warn' },
            { from: 'in', to: 'done', label: '200' },
          ],
        },
        {
          type: 'layers',
          layers: [
            {
              id: 'edge',
              label: 'Edge',
              nodes: [
                { id: 'worker', label: 'Edge Worker', diffNode: `"><img src=x onerror="window.__xss=1">` },
                { id: 'limiter', label: 'Limiter' },
              ],
              edges: [{ from: 'worker', to: 'limiter' }],
            },
          ],
        },
      ],
    },
  ],
  decisions: [],
}

/** tokens.css --c-bad-soft, --c-bad-line and --c-bad per theme (B-Blocks2:37, :33). */
const BAD = {
  dark: { soft: 'rgb(43, 22, 24)', line: 'rgb(90, 35, 40)', strong: 'rgb(255, 107, 107)' },
  light: { soft: 'rgb(251, 233, 232)', line: 'rgb(240, 184, 181)', strong: 'rgb(192, 50, 45)' },
} as const

/** --c-bad-text (B-Blocks2:37 draws #FFB3B3; lightify.py:27 pairs it with #9E2A26) and --c-text per theme. */
const BAD_TEXT = { dark: 'rgb(255, 179, 179)', light: 'rgb(158, 42, 38)' } as const
const TEXT = { dark: 'rgb(232, 236, 238)', light: 'rgb(15, 18, 20)' } as const

const dialogs = new WeakMap<Page, string[]>()

async function open(page: Page, id: string) {
  const seen: string[] = []
  dialogs.set(page, seen)
  page.on('dialog', (d) => {
    seen.push(d.message())
    void d.dismiss()
  })
  await page.goto(`/s/${id}`)
  await expect(page.locator('[data-state-node="429"]')).toBeVisible()
}

async function expectNoScript(page: Page) {
  expect(dialogs.get(page)).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
}

async function stepRows(page: Page): Promise<string[]> {
  const group = page.getByRole('group', { name: 'Sequence steps' })
  if (!(await group.locator('ol').isVisible())) {
    await group.focus()
    await page.keyboard.press('ArrowRight')
  }
  return group.locator('ol > li').allTextContents()
}

test.describe('round 1 board fields on seq, state and layers', () => {
  test('the seq step list shows each step text, a step without text its arrow line', async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await open(page, id)
    expect(await stepRows(page)).toEqual(['1Client sends GET /orders', '2Edge → Limiter: take(key, 1)', `3${XSS}`])
    await expectNoScript(page)
  })

  for (const theme of ['dark', 'light'] as const) {
    test(`a toned state and transition take the tone in ${theme}`, async ({ page, createSession }) => {
      await page.emulateMedia({ colorScheme: theme })
      const { id } = await createSession(payload)
      await open(page, id)
      const node = page.locator('[data-state-node="429"]')
      await expect(node).toHaveCSS('background-color', BAD[theme].soft)
      await expect(node).toHaveCSS('border-top-color', BAD[theme].line)
      // The node wraps its label into lines, breaking a long token anywhere.
      expect((await node.innerText()).replace(/\s+/g, '')).toBe(`429 limited ${XSS}`.replace(/\s+/g, ''))
      const firstEdge = node.locator('xpath=..').locator('[data-edge] path').first()
      await expect(firstEdge).toHaveCSS('stroke', BAD[theme].strong)
      await expect(node.locator('xpath=..').getByText(XSS, { exact: true })).toHaveCSS('color', BAD[theme].strong)
      await expectNoScript(page)
    })
  }

  for (const theme of ['dark', 'light'] as const) {
    test(`only a bad state's label takes the bad-text color in ${theme}`, async ({ page, createSession }) => {
      await page.emulateMedia({ colorScheme: theme })
      const { id } = await createSession(payload)
      await open(page, id)
      await expect(page.locator('[data-state-node="429"]')).toHaveCSS('color', BAD_TEXT[theme])
      // B-Blocks2 has no text color for the other tones: they keep the text token.
      await expect(page.locator('[data-state-node="done"]')).toHaveCSS('color', TEXT[theme])
      await expect(page.locator('[data-state-node="in"]')).toHaveCSS('color', TEXT[theme])
    })
  }

  test('a layers node with a diffNode link looks like one without', async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await open(page, id)
    const worker = page.locator('[data-layer-node="worker"]')
    const limiter = page.locator('[data-layer-node="limiter"]')
    await expect(worker).toHaveAttribute('data-diff-node', `"><img src=x onerror="window.__xss=1">`)
    await expect(worker).toHaveText('Edge Worker')
    const look = (el: Element) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.color, s.width, s.height].join(' ')
    }
    expect(await worker.evaluate(look)).toBe(await limiter.evaluate(look))
    await expectNoScript(page)
  })
})

/**
 * Self-gate (a): the brief's viewport sweep. Playwright rejects a fractional
 * viewport, so 879.5 at device scale 1.1 is bracketed by 879 and 880 at 1.1.
 */
const SWEEP: { width: number; scale: number }[] = [
  { width: 388, scale: 1 },
  { width: 879, scale: 1 },
  { width: 879, scale: 1.1 },
  { width: 880, scale: 1.1 },
  { width: 881, scale: 1 },
  { width: 1440, scale: 1 },
]

interface SweepPoint {
  width: number
  height: number
  scale: number
  theme: 'dark' | 'light'
}

async function sweepOne(browser: Browser, baseURL: string, id: string, { width, height, scale, theme }: SweepPoint) {
  const context = await browser.newContext({ baseURL, viewport: { width, height }, deviceScaleFactor: scale, colorScheme: theme })
  const page = await context.newPage()
  await open(page, id)
  const rows = await stepRows(page)
  expect(rows[0], `${width}x${height}@${scale} ${theme}`).toBe('1Client sends GET /orders')
  await expect(page.locator('[data-state-node="429"]')).toHaveCSS('background-color', BAD[theme].soft)
  if (width < 880) {
    for (const name of ['Previous step', 'Next step']) {
      const control = page.getByRole('button', { name, exact: true })
      await control.scrollIntoViewIfNeeded()
      const box = await control.boundingBox()
      expect(box, `${name} at ${width}`).not.toBeNull()
      expect(Math.round(box!.width), `${name} width at ${width}`).toBeGreaterThanOrEqual(44)
      expect(Math.round(box!.height), `${name} height at ${width}`).toBeGreaterThanOrEqual(44)
      const hit = await page.evaluate(
        ([x, y, label]) => document.elementFromPoint(x, y)?.closest(`[aria-label="${label}"]`) !== null,
        [box!.x + box!.width / 2, box!.y + box!.height / 2, name] as const,
      )
      expect(hit, `${name} hit-testable at ${width}x${height}`).toBe(true)
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `no page-level side scroll at ${width}`).toBeLessThanOrEqual(0)
  await expectNoScript(page)
  await context.close()
}

test('viewport sweep: step text, tone and controls at every width, height and theme', async ({
  browser,
  baseURL,
  createSession,
  isMobile,
}) => {
  test.skip(isMobile, 'the sweep sets its own viewports')
  test.setTimeout(180_000)
  const { id } = await createSession(payload)
  for (const { width, scale } of SWEEP)
    for (const height of [700, 900])
      for (const theme of ['dark', 'light'] as const) await sweepOne(browser, baseURL ?? '', id, { width, height, scale, theme })
})
