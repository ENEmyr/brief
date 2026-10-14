import type { Locator, Page, Route } from '@playwright/test'
import { expectBox, expectComputed } from '../lib/geometry'
import { PHONE_VIEWPORT, type Theme } from '../lib/regions'
import { APP_FONTS, assertFontsLoaded } from '../lib/fonts'
import { SESSION_ID, expect, openReader, seedReaderState, sessionEnvelope, test } from '../lib/session'
import { VISUAL_API_URL } from '../visual.config'

// The block card header (features.md B1) against B-Blocks and B-Blocks2.
// Numbers were read on the boards with getBoundingClientRect and
// getComputedStyle, in Chromium with the board fonts:
// - text-only header (B-Blocks:41, :51, :65, :113, :127, :179; B-Blocks2:132, :151): 35 high
//   with its 1px rule, padding 8/12, gap 8, Geist Mono 11px, faint text
// - header with controls (B-Blocks:75; B-Blocks2:28, :52, :81, :97, :166): 45 high, padding 6/6/6/12
// - kind tag: 18 high, padding 1/5, 1px line2 border, radius 3, faint text
// - full-screen button (B-Blocks2:28): 32 x 32, radius 4, 1px line2 border, elev fill, text color
// - panel: radius 6, 1px line border, card fill
// Under 880 the header follows B-Mobile (B-Mobile:35): padding 4/4/4/10 and gap 6
// beside buttons, which grow to the 44px touch floor (B-Mobile draws 40).

const COLORS: Record<
  Theme,
  { card: string; line: string; line2: string; faint: string; elev: string; text: string }
> = {
  dark: {
    card: 'rgb(17, 20, 23)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    faint: 'rgb(124, 134, 143)',
    elev: 'rgb(23, 27, 31)',
    text: 'rgb(232, 236, 238)',
  },
  light: {
    card: 'rgb(255, 255, 255)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    faint: 'rgb(106, 115, 123)',
    elev: 'rgb(249, 250, 250)',
    text: 'rgb(15, 18, 20)',
  },
}

const FIXTURE_CARDS = [
  { section: 's1', kind: 'stat', fullScreen: false },
  { section: 's1', kind: 'compare', fullScreen: false },
  { section: 's2', kind: 'seq', fullScreen: true },
  { section: 's2', kind: 'code', fullScreen: false },
  { section: 's3', kind: 'table', fullScreen: false },
  { section: 's3', kind: 'bigo', fullScreen: true },
  { section: 's4', kind: 'coverage', fullScreen: false },
  { section: 's4', kind: 'warn', fullScreen: false },
] as const

function card(page: Page, section: string, kind: string): Locator {
  return page.locator(`section#${section} figure`).filter({
    has: page.locator(':scope > div:first-child > [data-kind-tag]', {
      hasText: new RegExp(`^${kind}$`),
    }),
  })
}
const headerOf = (figure: Locator) => figure.locator(':scope > div:first-child')
const tagOf = (figure: Locator) => headerOf(figure).locator('[data-kind-tag]')
const fullScreenOf = (figure: Locator) =>
  headerOf(figure).getByRole('button', { name: 'Open diagram full screen' })

test.describe('block card header at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
  })

  for (const { section, kind, fullScreen } of FIXTURE_CARDS) {
    test(`${kind}: panel, header, tag${fullScreen ? ' and full-screen button' : ''} match the board`, async ({
      page,
      theme,
    }) => {
      const c = COLORS[theme]
      const figure = card(page, section, kind)
      await expect(figure).toHaveCount(1)
      await expectComputed(figure, {
        'border-radius': '6px',
        'border-top-width': '1px',
        'border-top-color': c.line,
        'background-color': c.card,
      })

      const header = headerOf(figure)
      await expectBox(header, { height: fullScreen ? 45 : 35 })
      await expectComputed(header, {
        padding: fullScreen ? '6px 6px 6px 12px' : '8px 12px',
        gap: '8px',
        'font-size': '11px',
        'line-height': 'normal',
        color: c.faint,
        'border-bottom-width': '1px',
        'border-bottom-color': c.line,
      })
      expect(await header.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Geist Mono/)

      const tag = tagOf(figure)
      await expectBox(tag, { height: 18 })
      await expectComputed(tag, {
        padding: '1px 5px',
        'border-top-width': '1px',
        'border-top-color': c.line2,
        'border-radius': '3px',
        color: c.faint,
      })

      if (fullScreen) {
        const button = fullScreenOf(figure)
        await expectBox(button, { width: 32, height: 32 })
        await expectComputed(button, {
          'border-radius': '4px',
          'border-top-color': c.line2,
          'background-color': c.elev,
          color: c.text,
        })
      } else {
        await expect(fullScreenOf(figure)).toHaveCount(0)
      }
    })
  }

  test('the code caption is the filename, in the header text style', async ({ page, theme }) => {
    const caption = headerOf(card(page, 's2', 'code')).getByText('src/limiter.ts')
    await expectComputed(caption, { 'font-size': '11px', color: COLORS[theme].faint })
  })

  test('full screen exists only on seq and bigo, and opens the viewer for each', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Open diagram full screen' })).toHaveCount(2)

    await fullScreenOf(card(page, 's2', 'seq')).click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expect(viewer.locator('svg').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)

    await fullScreenOf(card(page, 's3', 'bigo')).click()
    await expect(viewer.locator('img[alt="chart"]')).toBeVisible()
  })
})

test.describe('block card header at the phone width', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT)
    await openReader(page)
  })

  for (const { section, kind, fullScreen } of FIXTURE_CARDS) {
    test(`${kind}: header keeps its tag; buttons reach 44`, async ({ page, theme }) => {
      const figure = card(page, section, kind)
      await expect(figure).toHaveCount(1)
      const header = headerOf(figure)
      await expectBox(header, { height: fullScreen ? 53 : 35 })
      await expectComputed(header, {
        padding: fullScreen ? '4px 4px 4px 10px' : '8px 12px 8px 10px',
        gap: '6px',
        color: COLORS[theme].faint,
      })
      await expectBox(tagOf(figure), { height: 18 })
      if (fullScreen) await expectBox(fullScreenOf(figure), { width: 44, height: 44 })
    })
  }
})

const SECTIONS = ['s1', 's2', 's3', 's4'] as const

async function sectionHeights(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [id, document.getElementById(id)!.getBoundingClientRect().height]),
      ),
    [...SECTIONS],
  )
}

test('lazy blocks: section heights do not move when their chunks arrive', async ({
  page,
  theme,
}) => {
  test.skip(theme !== 'dark', 'one theme is enough: the swap is layout, not color')
  await page.setViewportSize({ width: 1440, height: 900 })

  const html = await (await page.request.get(`/s/${SESSION_ID}`)).text()
  const initial = new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map((m) => m[0]))
  const held: Route[] = []
  let releasing = false
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, (route) => {
    if (releasing || initial.has(new URL(route.request().url()).pathname)) return route.continue()
    held.push(route)
  })

  await seedReaderState(page)
  await page.goto(`/s/${SESSION_ID}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('h1').first()).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'app')
  await expect
    .poll(() => held.length, { message: 'the page asked for no lazy chunk' })
    .toBeGreaterThan(0)
  await expect(page.locator('section#s3 canvas')).toHaveCount(0)
  await expect(page.locator('section#s3').getByText('loading chart')).toBeVisible()
  await expect(fullScreenOf(card(page, 's3', 'bigo'))).toBeDisabled()
  const before = await sectionHeights(page)

  releasing = true
  for (const route of held) await route.continue()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('section#s3 canvas').first()).toBeVisible()
  await expect(page.locator('section#s3').getByText('loading chart')).toHaveCount(0)
  await expect(fullScreenOf(card(page, 's3', 'bigo'))).toBeEnabled()
  const after = await sectionHeights(page)

  const summary =
    SECTIONS.map((id) => `${id} ${before[id]} -> ${after[id]}`).join('; ') +
    `; ${held.length} chunks held`
  test.info().annotations.push({ type: 'section heights', description: summary })
  console.log(`section heights: ${summary}`)
  for (const id of SECTIONS)
    expect(Math.abs(after[id]! - before[id]!), `${id} moved`).toBeLessThanOrEqual(1)
})

// Every block type the schema knows, in one section, so the header is measured
// on all 22 in a real browser (the sample brief has only 8 of them).
const ALL_ID = 'Bk7AllBlocks22'

const ALL_BLOCKS = [
  { type: 'p', text: 'plain prose' },
  { type: 'note', text: 'a note' },
  { type: 'warn', text: 'a warning' },
  { type: 'good', text: 'a win' },
  { type: 'table', head: ['name'], rows: [['kv']] },
  {
    type: 'compare',
    left: { title: 'A', items: [{ text: 'fast', ok: true }] },
    right: { title: 'B', items: [{ text: 'slow', ok: false }] },
  },
  { type: 'stat', items: [{ label: 'files', value: '12' }] },
  { type: 'coverage', items: [{ label: 'auth', status: 'full' }] },
  { type: 'details', summary: 'more', blocks: [{ type: 'p', text: 'inner' }] },
  { type: 'seq', actors: ['A', 'B'], steps: [{ from: 'A', to: 'B', label: 'hi' }] },
  {
    type: 'state',
    states: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    transitions: [{ from: 'a', to: 'b', label: 'go' }],
    initial: 'a',
  },
  { type: 'layers', layers: [{ id: 'l', label: 'Edge', nodes: [{ id: 'n', label: 'Worker' }], edges: [] }] },
  { type: 'ba', language: 'ts', before: 'a', after: 'b' },
  { type: 'bigo', series: [{ label: 'scan', curve: 'n' }] },
  { type: 'code', language: 'ts', code: 'const a = 1' },
  { type: 'mermaid', code: 'graph TD; A-->B' },
  { type: 'math', latex: 'e=mc^2' },
  { type: 'erd', tables: [{ name: 't', columns: [{ name: 'id', type: 'int', pk: true }] }] },
  { type: 'heatmap', xLabels: ['a'], yLabels: ['x'], values: [[1]] },
  { type: 'histogram', bins: [{ label: '0-10', count: 1 }] },
  { type: 'scatter', series: [{ label: 'A', points: [[1, 2]] }] },
  { type: 'plot3d', kind: 'scatter3d', points: [[0, 0, 1]] },
] as const

/** features.md B1 and owner ruling D5. */
const FULL_SCREEN_TYPES = new Set([
  'seq',
  'state',
  'layers',
  'erd',
  'mermaid',
  'plot3d',
  'bigo',
  'heatmap',
  'histogram',
  'scatter',
])

async function openAllBlocks(page: Page): Promise<void> {
  const origin = new URL(VISUAL_API_URL).origin
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS' }
  const payload = {
    meta: { title: 'All blocks' },
    sections: [{ id: 'all', no: 1, title: 'Every block', blocks: ALL_BLOCKS }],
    decisions: [],
  }
  await page.route(`${origin}/api/session/${ALL_ID}**`, (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS' || req.method() === 'PUT') return route.fulfill({ status: 204, headers: cors })
    const body = new URL(req.url()).pathname.endsWith('/state')
      ? { state: null }
      : { ...sessionEnvelope(), id: ALL_ID, title: 'All blocks', payload: JSON.stringify(payload) }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
  })
  await page.goto(`/s/${ALL_ID}`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'app')
}

for (const [label, viewport] of [
  ['1440', { width: 1440, height: 900 }],
  ['the phone width', PHONE_VIEWPORT],
] as const) {
  test(`all 22 block types: card header at ${label}`, async ({ page, theme }) => {
    const phone = viewport.width < 880
    const c = COLORS[theme]
    await page.setViewportSize(viewport)
    await openAllBlocks(page)

    // p is prose, never a card; every other block is one top-level card, in order.
    await expect(page.getByText('plain prose')).toBeVisible()
    expect(await page.getByText('plain prose').evaluate((el) => el.closest('figure'))).toBeNull()
    const cards = page.locator('section#all > div:last-child > figure')
    const carded = ALL_BLOCKS.filter((b) => b.type !== 'p')
    await expect(cards).toHaveCount(carded.length)

    for (const [i, block] of carded.entries()) {
      const figure = cards.nth(i)
      const header = headerOf(figure)
      const tag = tagOf(figure)
      await expect(tag, `card ${i}`).toHaveText(block.type)
      await expectComputed(figure, {
        'border-radius': '6px',
        'border-top-color': c.line,
        'background-color': c.card,
      })
      await expectComputed(header, {
        'font-size': '11px',
        color: c.faint,
        'border-bottom-color': c.line,
        gap: phone ? '6px' : '8px',
      })
      await expectBox(tag, { height: 18 })
      await expectComputed(tag, { padding: '1px 5px', 'border-top-color': c.line2, color: c.faint })

      const fullScreen = fullScreenOf(figure)
      await expect(fullScreen, `${block.type} full-screen button`).toHaveCount(
        FULL_SCREEN_TYPES.has(block.type) ? 1 : 0,
      )
      if (block.type === 'ba') {
        // ba's Before/After toggle is a header control: control padding.
        await expectComputed(header, { padding: phone ? '4px 4px 4px 10px' : '6px 6px 6px 12px' })
      } else if (FULL_SCREEN_TYPES.has(block.type)) {
        await expectBox(header, { height: phone ? 53 : 45 })
        await expectComputed(header, { padding: phone ? '4px 4px 4px 10px' : '6px 6px 6px 12px' })
        await expectBox(fullScreen, phone ? { width: 44, height: 44 } : { width: 32, height: 32 })
        await expectComputed(fullScreen, {
          'border-radius': '4px',
          'border-top-color': c.line2,
          'background-color': c.elev,
          color: c.text,
        })
      } else {
        await expectBox(header, { height: 35 })
        await expectComputed(header, { padding: phone ? '8px 12px 8px 10px' : '8px 12px' })
      }
    }
  })
}
