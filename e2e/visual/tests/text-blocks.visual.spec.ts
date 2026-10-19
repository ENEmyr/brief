import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page, Route } from '@playwright/test'
import { expectBox, expectComputed } from '../lib/geometry'
import { PHONE_VIEWPORT, clipOf, type Theme } from '../lib/regions'
import { APP_FONTS, assertFontsLoaded } from '../lib/fonts'
import { expect, openReader, sessionEnvelope, test } from '../lib/session'
import { VISUAL_API_URL } from '../visual.config'

// Phase 4a text and data blocks against B-Blocks, B-Reader, B-Mobile and
// B-States. Board numbers were read in Chromium with the board fonts
// (getBoundingClientRect, getComputedStyle) on B-Blocks at its 1280 canvas;
// the light values are the tokens.css light set and the light boards
// (B-Reader-Light, B-Mobile-Light), since B-Blocks is drawn dark only.
// fixtures/blocks-sample.payload.json carries B-Blocks' own content.

// Session ids are 14 characters (findings.md F3).
const BLOCKS_ID = 'Bk7TextBlock4a'
const blocksPayload: unknown = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, '..', 'fixtures', 'blocks-sample.payload.json'),
    'utf8',
  ),
)

const C = {
  dark: {
    text: 'rgb(232, 236, 238)',
    sub: 'rgb(161, 170, 178)',
    faint: 'rgb(124, 134, 143)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    elev: 'rgb(23, 27, 31)',
    info: 'rgb(98, 199, 245)',
    infoSoft: 'rgb(15, 26, 32)',
    infoLine: 'rgb(29, 58, 72)',
    warn: 'rgb(244, 183, 64)',
    warnLine: 'rgb(74, 58, 22)',
    warnCallout: 'rgb(29, 24, 16)',
    warnFill: 'rgb(244, 183, 64)',
    good: 'rgb(79, 211, 154)',
    goodLine: 'rgb(29, 68, 52)',
    goodCallout: 'rgb(15, 29, 23)',
    goodSoft: 'rgb(19, 38, 31)',
    bad: 'rgb(255, 107, 107)',
    badSoft: 'rgb(43, 22, 24)',
    zebra: 'rgb(15, 18, 21)',
    accentText: 'rgb(197, 240, 90)',
    codeLine: 'rgb(21, 26, 30)',
    body: 'rgb(213, 218, 221)',
  },
  light: {
    text: 'rgb(15, 18, 20)',
    sub: 'rgb(76, 85, 93)',
    faint: 'rgb(104, 113, 121)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    elev: 'rgb(249, 250, 250)',
    info: 'rgb(11, 111, 168)',
    infoSoft: 'rgb(230, 242, 250)',
    infoLine: 'rgb(181, 220, 239)',
    warn: 'rgb(143, 90, 0)',
    warnLine: 'rgb(235, 203, 138)',
    warnCallout: 'rgb(251, 243, 226)',
    warnFill: 'rgb(184, 122, 10)',
    good: 'rgb(19, 120, 74)',
    goodLine: 'rgb(169, 220, 194)',
    goodCallout: 'rgb(232, 245, 238)',
    goodSoft: 'rgb(227, 243, 234)',
    bad: 'rgb(192, 50, 45)',
    badSoft: 'rgb(251, 233, 232)',
    zebra: 'rgb(249, 250, 250)',
    accentText: 'rgb(77, 122, 0)',
    codeLine: 'rgb(241, 243, 244)',
    body: 'rgb(42, 48, 54)',
  },
} satisfies Record<Theme, Record<string, string>>

async function routePayload(page: Page, id: string, payload: unknown): Promise<void> {
  const origin = new URL(VISUAL_API_URL).origin
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
  await page.route(`${origin}/api/session/${id}**`, (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS' || req.method() === 'PUT')
      return route.fulfill({ status: 204, headers: cors })
    const body = new URL(req.url()).pathname.endsWith('/state')
      ? { state: null }
      : { ...sessionEnvelope(), id, title: 'Console blocks', payload: JSON.stringify(payload) }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify(body),
    })
  })
}

async function openBlocks(page: Page): Promise<void> {
  await routePayload(page, BLOCKS_ID, blocksPayload)
  await page.goto(`/s/${BLOCKS_ID}`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'app')
}

/** The nth top-level card of a kind in a section. A card with code notes sits
    in the wrapper that prints its note list under it (WithPrintedNotes). */
function cardOf(page: Page, section: string, kind: string, nth = 0): Locator {
  const blocks = `section#${section} > div:last-child`
  return page
    .locator(`${blocks} > figure, ${blocks} > div > figure`)
    .filter({
      has: page.locator(':scope > div:first-child > [data-kind-tag]', {
        hasText: new RegExp(`^${kind}$`),
      }),
    })
    .nth(nth)
}
const bodyOf = (figure: Locator) => figure.locator(':scope > :nth-child(2)')

/** Resizes so the cards are `width` wide, as the board panel is, and returns the viewport width used. */
async function cardWidth(page: Page, figure: Locator, width: number): Promise<number> {
  const current = page.viewportSize()!
  const box = (await figure.boundingBox())!
  const viewport = Math.round(current.width + width - box.width)
  await page.setViewportSize({ width: viewport, height: current.height })
  await expectBox(figure, { width })
  return viewport
}

for (const [label, viewport] of [
  ['1440', { width: 1440, height: 900 }],
  ['the phone width', PHONE_VIEWPORT],
] as const) {
  const phone = viewport.width < 880

  test.describe(`text blocks at ${label}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
      await openBlocks(page)
    })

    test('callouts: status border on a soft fill, caps label (B-Blocks:34-36)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      for (const [kind, label, color, line, fill] of [
        ['note', 'NOTE', c.info, c.infoLine, c.infoSoft],
        ['warn', 'WARN', c.warn, c.warnLine, c.warnCallout],
        ['good', 'GOOD', c.good, c.goodLine, c.goodCallout],
      ] as const) {
        const aside = cardOf(page, 'blocks', kind).locator('aside')
        await expectComputed(aside, {
          padding: '12px 14px',
          gap: '12px',
          'border-top-width': '1px',
          'border-top-color': line,
          'border-radius': '4px',
          'background-color': fill,
        })
        const tag = aside.getByText(label, { exact: true })
        await expectBox(tag, { width: 40 })
        await expectComputed(tag, { 'font-size': '11px', 'padding-top': '3px', color })
        await expectComputed(aside.locator(':scope > div'), {
          'font-size': '15px',
          'line-height': '26px',
          color: c.text,
        })
      }
      // One line of text: 12 + 26 + 12 and the 1px border on each side.
      if (!phone) await expectBox(cardOf(page, 'blocks', 'good').locator('aside'), { height: 52 })
    })

    test('stat: two columns of label, value and hint split by line rules (B-Blocks:42-47)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const grid = bodyOf(cardOf(page, 'blocks', 'stat'))
      const cells = grid.locator(':scope > div')
      await expect(cells).toHaveCount(4)
      await expect(grid).toHaveCSS('grid-template-columns', /^\S+ \S+$/)
      await expectComputed(cells.nth(0), {
        padding: '14px',
        gap: '6px',
        'border-right-width': '1px',
        'border-right-color': c.line,
        'border-bottom-width': '1px',
      })
      await expectComputed(cells.nth(3), {
        'border-right-width': '0px',
        'border-bottom-width': '0px',
      })
      // Row two: 14 + 18 (Thai label) + 6 + 32 + 6 + 18 + 14.
      await expectBox(cells.nth(3), { height: 108 })
      await expectComputed(cells.nth(0).getByText('Peak RPS'), {
        'font-size': '12px',
        color: c.sub,
      })
      for (const [value, color] of [
        ['4,800', c.text],
        ['2.4 s', c.bad],
        ['0.2%', c.good],
      ] as const) {
        const el = grid.getByText(value, { exact: true })
        await expect(el).toBeVisible()
        await expectComputed(el, {
          'font-size': '28px',
          'line-height': '32px',
          'font-weight': '500',
          color,
        })
        expect(await el.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Geist Mono/)
      }
      await expectComputed(grid.getByText('ช่วง burst'), { 'font-size': '12px', color: c.faint })
    })

    test('compare: one split panel, tone in the tag (B-Blocks:52-61)', async ({ page, theme }) => {
      const c = C[theme]
      const panes = bodyOf(cardOf(page, 'blocks', 'compare')).locator(':scope > div')
      await expect(panes).toHaveCount(2)
      await expectComputed(
        panes.nth(0),
        phone
          ? {
              'border-bottom-width': '1px',
              'border-bottom-color': c.line,
              'border-right-width': '0px',
            }
          : { 'border-right-width': '1px', 'border-right-color': c.line },
      )
      const head = panes.nth(0).locator(':scope > div')
      await expectBox(head, { height: 42 })
      await expectComputed(head, { padding: '10px 14px', 'border-bottom-color': c.line })
      await expectComputed(head.getByText('ไม่มีตัวคุมอัตรา'), {
        'font-size': '14px',
        'font-weight': '600',
      })
      await expectComputed(panes.nth(0).getByText('เสี่ยง'), {
        'font-size': '11px',
        padding: '1px 6px',
        'border-radius': '3px',
        color: c.bad,
        'background-color': c.badSoft,
      })
      await expectComputed(panes.nth(1).getByText('ปลอดภัย'), {
        color: c.good,
        'background-color': c.goodSoft,
      })
      const items = panes.nth(0).locator('ul')
      await expectComputed(items, {
        padding: '8px 14px',
        gap: '6px',
        'font-size': '14px',
        'line-height': '22px',
      })
      await expectComputed(items.getByText('✗').first(), { color: c.bad })
      await expectComputed(panes.nth(1).getByText('✓').first(), { color: c.good })
      if (!phone) await expectBox(panes.nth(0), { height: 136 })
    })

    test('coverage: four-segment bars, status words, derived percent (B-Blocks:64-72)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const figure = cardOf(page, 'blocks', 'coverage')
      await expectComputed(figure.locator(':scope > div:first-child').getByText('50%'), {
        color: c.sub,
      })
      await expectComputed(bodyOf(figure), { padding: '6px 0px' })
      const rows = bodyOf(figure).locator(':scope > div')
      await expect(rows).toHaveCount(4)
      await expectComputed(rows.nth(1), { padding: '7px 14px', gap: '12px', 'font-size': '14px' })
      // Latin label rows are 7 + 18 + 7; the Thai label row is 35 (B-Blocks:67).
      await expectBox(rows.nth(1), { height: 32 })
      await expectBox(rows.nth(0), { height: 35 })
      for (const [i, label, word, color, fills] of [
        [0, 'Burst 10 เท่า: full', 'full', c.good, [c.good, c.good, c.good, c.good]],
        [1, 'Multi-region: partial', 'part', c.warn, [c.warnFill, c.warnFill, c.line, c.line]],
        [
          3,
          'Retry storm: missing',
          'none',
          c.bad,
          ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
        ],
      ] as const) {
        const bar = rows.nth(i).getByRole('img', { name: label })
        await expectBox(bar, { width: 120, height: 10 })
        for (const [j, fill] of fills.entries()) {
          await expectComputed(bar.locator(':scope > span').nth(j), { 'background-color': fill })
        }
        await expectComputed(rows.nth(i).getByText(word, { exact: true }), {
          'font-size': '12px',
          color,
        })
      }
      await expectComputed(rows.nth(3).getByRole('img').locator(':scope > span').first(), {
        'border-top-style': 'dashed',
        'border-top-color': c.bad,
      })
    })

    test('table: elev head in sub, line rules, zebra, plain first column (B-Blocks:113-122)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const figure = cardOf(page, 'blocks', 'table')
      await expect(figure.locator(':scope > div:first-child').getByText('3 rows')).toBeVisible()
      const table = figure.locator('table')
      await expectComputed(table, { 'font-size': '13px', 'line-height': '20px' })
      const head = table.locator('thead tr')
      await expectComputed(head, { 'background-color': c.elev, color: c.sub })
      await expectComputed(head.locator('th').first(), {
        padding: '8px 12px',
        'font-weight': '500',
      })
      const rows = table.locator('tbody tr')
      await expectComputed(rows.nth(0), {
        'border-top-color': c.line,
        'background-color': 'rgba(0, 0, 0, 0)',
      })
      await expectComputed(rows.nth(1), { 'background-color': c.zebra })
      await expectComputed(rows.nth(0).locator('th'), {
        padding: '9px 12px',
        'font-weight': '400',
        color: c.text,
      })
      await expectComputed(rows.nth(0).locator('td').first(), {
        padding: '9px 12px',
        color: c.text,
      })
      if (!phone) {
        await expectBox(head, { height: 36.5 })
        await expectBox(rows.nth(1), { height: 39 })
      }
    })

    test('ba: Split and Unified in the header, both sides with diff tints (B-Blocks:141-160)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const figure = cardOf(page, 'blocks', 'ba')
      const header = figure.locator(':scope > div:first-child')
      const split = header.getByRole('button', { name: 'Split' })
      const unified = header.getByRole('button', { name: 'Unified' })
      await expectBox(header, { height: phone ? 53 : 41 })
      await expectBox(split, { height: phone ? 44 : 28 })
      await expectComputed(split, {
        padding: '0px 8px',
        'font-size': '11px',
        'border-top-width': '1px',
        'border-top-color': c.line2,
        'background-color': c.elev,
        color: c.text,
      })
      await expectComputed(unified, {
        'border-top-width': '0px',
        'background-color': 'rgba(0, 0, 0, 0)',
        color: c.faint,
      })

      const panes = bodyOf(figure).locator(':scope > div')
      await expect(panes).toHaveCount(2)
      await expectComputed(bodyOf(figure), { 'font-size': '13px', 'line-height': '22px' })
      await expectComputed(panes.nth(0), { padding: '8px 0px' })
      const label = panes.nth(0).getByText('before', { exact: true })
      await expectBox(label, { height: 28 })
      await expectComputed(label, { 'font-size': '11px', color: c.faint, padding: '0px 12px 6px' })
      const removed = panes.nth(0).locator('code > span').nth(1)
      await expectBox(removed, { height: 22 })
      await expectComputed(removed, { padding: '0px 12px', 'background-color': c.badSoft })
      await expectBox(removed.locator(':scope > span').first(), { width: 28 })
      await expectComputed(removed.locator(':scope > span').first(), { color: c.bad })
      const added = panes.nth(1).locator('code > span').nth(1)
      await expectComputed(added, { 'background-color': c.goodSoft })
      await expectComputed(added.locator(':scope > span').first(), { color: c.good })
      const kept = panes.nth(1).locator('code > span').last()
      await expectComputed(kept, { 'background-color': 'rgba(0, 0, 0, 0)' })
      await expectComputed(kept.locator(':scope > span').first(), { color: c.faint })

      await unified.click()
      await expect(unified).toHaveAttribute('aria-pressed', 'true')
      // Three before lines, six after: two removed, five added, the closing brace kept.
      await expect(bodyOf(figure).locator('code > span')).toHaveCount(8)
    })

    test('details: elev when open, ▾ in accent; ▸ in faint when closed (B-Blocks:164-174)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const open = cardOf(page, 'blocks', 'details', 0)
      const closed = cardOf(page, 'blocks', 'details', 1)
      await expectComputed(bodyOf(open), { padding: '8px' })
      const summary = open.locator('summary')
      await summary.click()
      const details = open.locator('details')
      await expect(details).toHaveAttribute('open', '')
      await expectComputed(details, { 'background-color': c.elev, 'border-radius': '4px' })
      await expectBox(summary, { height: phone ? 44 : 40 })
      await expectComputed(summary, {
        padding: '0px 12px',
        gap: '10px',
        'font-size': '14px',
        'font-weight': '500',
        color: c.text,
      })
      await expect(summary.locator('[data-details-marker]')).toHaveText('▾')
      await expectComputed(summary.locator('[data-details-marker]'), { color: c.accentText })
      await expectComputed(details.locator(':scope > div'), {
        padding: '0px 12px 12px 32px',
        gap: '10px',
      })
      await expectComputed(details.getByText('เติม r token ต่อวินาที เก็บได้มากสุด C'), {
        'font-size': '14px',
        'line-height': '22px',
        color: c.sub,
      })

      await expect(closed.locator('details')).not.toHaveAttribute('open', '')
      await expect(closed.locator('[data-details-marker]')).toHaveText('▸')
      await expectComputed(closed.locator('[data-details-marker]'), { color: c.faint })
      await expectComputed(closed.locator('summary'), { color: c.sub })
      await expectComputed(closed.locator('details'), { 'background-color': 'rgba(0, 0, 0, 0)' })

      await summary.click()
      await expect(details).not.toHaveAttribute('open', '')
      await expect(summary.locator('[data-details-marker]')).toHaveText('▸')
    })

    test('math: a KaTeX failure stays in its card with the bad line marked (B-States:92-98)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const figure = cardOf(page, 'blocks', 'math')
      const alert = figure.getByRole('alert')
      await expect(alert).toHaveText('Math could not be drawn. Parse error on line 2.')
      await expectComputed(alert, {
        'background-color': c.badSoft,
        'border-left-width': '3px',
        'border-left-color': c.bad,
        'font-size': '13px',
        'line-height': '20px',
      })
      const bad = figure.locator('[data-bad-line]')
      await expect(bad).toHaveText('2  \\foo{x}')
      await expectComputed(bad, { 'background-color': c.badSoft, color: c.bad })
      const text = await figure.innerText()
      expect(text).not.toMatch(/KaTeX|Undefined control sequence|position|\/home\/|\.tsx|at \w+ \(/)
      // The formula nested in the first details renders.
      await expect(page.locator('section#blocks details [data-math] .katex')).toHaveCount(1)
    })
  })

  test.describe(`code and paragraph at ${label}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
      await openReader(page)
    })

    test('code: 13/24 rows on the panel, 26px gutter, marked lines tinted (B-Reader:152-163, B-NewBlocks:125)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const figure = cardOf(page, 's2', 'code')
      const pre = bodyOf(figure)
      await expectComputed(pre, {
        padding: '8px 0px',
        'font-size': '13px',
        'line-height': '24px',
        color: c.text,
      })
      expect(await pre.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
        await figure.evaluate((e) => getComputedStyle(e).backgroundColor),
      )
      const rows = pre.locator('code > span')
      await expect(rows).toHaveCount(6)
      await expectBox(rows.nth(0), { height: 24 })
      await expectComputed(rows.nth(0), {
        padding: '0px 12px',
        'background-color': 'rgba(0, 0, 0, 0)',
      })
      await expectComputed(rows.nth(2), { 'background-color': c.codeLine })
      await expectComputed(rows.nth(3), { 'background-color': c.codeLine })
      const gutter = rows.nth(0).locator(':scope > span').first()
      await expectBox(gutter, { width: 26 })
      await expectComputed(gutter, { color: c.faint })
      await expectComputed(rows.nth(0).locator('span[style*="--shiki-token-keyword"]').first(), {
        color: c.info,
      })
    })

    test('paragraph: bare prose, 15/26 text; 16/27 body on a phone (B-Reader:107, B-Mobile:33)', async ({
      page,
      theme,
    }) => {
      const c = C[theme]
      const p = page.locator('section#s1 > div:last-child > p').first()
      await expect(p).toBeVisible()
      expect(await p.evaluate((e) => e.closest('figure'))).toBeNull()
      await expectComputed(
        p,
        phone
          ? { 'font-size': '16px', 'line-height': '27px', color: c.body, margin: '0px' }
          : { 'font-size': '15px', 'line-height': '26px', color: c.text, margin: '0px' },
      )
    })
  })
}

test.describe('stat count-up in a browser', () => {
  /**
   * Samples the counter's text inside `card` on every frame for `ms`. Scoped to the card: the
   * first stat on the page counts too, and a slow run can still be counting it here.
   */
  async function sampleCounter(card: Locator, ms: number): Promise<string[]> {
    return card.evaluate(
      (el, duration) =>
        new Promise<string[]>((resolve) => {
          const seen: string[] = []
          const start = performance.now()
          const tick = () => {
            const counter = el.querySelector('[data-count-up]')
            if (counter?.textContent) seen.push(counter.textContent)
            if (performance.now() - start < duration) requestAnimationFrame(tick)
            else resolve(seen)
          }
          requestAnimationFrame(tick)
        }),
      ms,
    )
  }

  test('counts once, over 600ms, the first time the stat is on screen', async ({ page, theme }) => {
    test.skip(theme !== 'dark', 'one theme is enough: the count is timing, not color')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBlocks(page)
    const last = cardOf(page, 'blocks', 'stat', 1)
    const value = last.getByText('1,250', { exact: true })
    await expect(value).toHaveCSS('visibility', 'hidden')
    // Paper never waits for a count: an unseen stat prints its value.
    await page.emulateMedia({ media: 'print' })
    await expect(value).toHaveCSS('visibility', 'visible')
    await page.emulateMedia({ media: 'screen' })
    await expect(value).toHaveCSS('visibility', 'hidden')

    const [samples] = await Promise.all([sampleCounter(last, 900), last.scrollIntoViewIfNeeded()])
    const numbers = samples.map((s) => Number(s.replace(/,/g, '')))
    console.log(`count-up frames: ${samples.length}, first ${samples[0]}, last ${samples.at(-1)}`)
    expect(samples.length).toBeGreaterThan(10)
    expect(numbers[0]).toBeLessThan(400)
    for (let i = 1; i < numbers.length; i++)
      expect(numbers[i]).toBeGreaterThanOrEqual(numbers[i - 1]!)
    await expect(value).toHaveCSS('visibility', 'visible')
    await expect(last.locator('[data-count-up]')).toHaveCount(0)

    await page.evaluate(() => window.scrollTo(0, 0))
    await last.scrollIntoViewIfNeeded()
    expect(await sampleCounter(last, 400)).toEqual([])
  })

  test('shows every value at once under reduced motion', async ({ page, theme }) => {
    test.skip(theme !== 'dark', 'one theme is enough: the count is timing, not color')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBlocks(page)
    const last = cardOf(page, 'blocks', 'stat', 1)
    await expect(last.getByText('1,250', { exact: true })).toHaveCSS('visibility', 'visible')
    const [samples] = await Promise.all([
      sampleCounter(page.locator('section#blocks'), 700),
      last.scrollIntoViewIfNeeded(),
    ])
    expect(samples).toEqual([])
    await expect(cardOf(page, 'blocks', 'stat', 0).getByText('4,800', { exact: true })).toHaveCSS(
      'visibility',
      'visible',
    )
  })
})

test('math keeps its height while KaTeX loads and after it draws (B-States:105-108)', async ({
  page,
  theme,
}) => {
  test.skip(theme !== 'dark', 'one theme is enough: the swap is layout, not color')
  const id = 'Bk7MathHeight1'
  await routePayload(page, id, {
    meta: { title: 'Math height' },
    sections: [
      {
        id: 'm',
        no: 1,
        title: 'Math',
        blocks: [
          { type: 'math', latex: 'e = mc^2' },
          { type: 'p', text: 'after' },
        ],
      },
    ],
    decisions: [],
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  const html = await (await page.request.get(`/s/${id}`)).text()
  const initial = new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map((m) => m[0]))
  const held: Route[] = []
  let releasing = false
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, (route) => {
    if (releasing || initial.has(new URL(route.request().url()).pathname)) return route.continue()
    held.push(route)
  })
  await page.goto(`/s/${id}`, { waitUntil: 'domcontentloaded' })
  const figure = cardOf(page, 'm', 'math')
  await expect(figure.getByText('loading math')).toBeVisible()
  const before = (await figure.boundingBox())!.height

  releasing = true
  for (const route of held) await route.continue()
  await expect(figure.locator('[data-math] .katex')).toBeVisible()
  const after = (await figure.boundingBox())!.height
  console.log(`math card: ${before} while loading, ${after} drawn; ${held.length} chunks held`)
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
})

test.describe('text blocks against the B-Blocks panels', () => {
  // Pixel crops at the board's panel width (576, or 1168 for ba). Dark only:
  // B-Blocks has no light board.
  for (const [name, kind, width, part] of [
    ['blocks-note', 'note', 576, 'aside'],
    ['blocks-warn', 'warn', 576, 'aside'],
    ['blocks-good', 'good', 576, 'aside'],
    ['blocks-stat', 'stat', 576, null],
    ['blocks-compare', 'compare', 576, null],
    ['blocks-coverage', 'coverage', 576, null],
    ['blocks-table', 'table', 576, null],
    ['blocks-details', 'details', 576, 'details'],
    ['blocks-ba', 'ba', 1168, null],
  ] as const) {
    test(`crop ${name}`, async ({ page, theme }) => {
      test.skip(theme !== 'dark', 'B-Blocks is drawn dark only')
      await page.setViewportSize({ width: 1440, height: 900 })
      await openBlocks(page)
      const figure = cardOf(page, 'blocks', kind)
      const used = await cardWidth(page, figure, width)
      test.info().annotations.push({ type: 'viewport', description: String(used) })
      if (kind === 'details') await figure.locator('summary').click()
      if (kind === 'stat') {
        // The counter holds the final text for its last frame, beside the value it covers.
        await expect(figure.locator('[data-count-up]')).toHaveCount(0)
        await expect(figure.getByText('4,800', { exact: true })).toHaveCSS('visibility', 'visible')
      }
      const target = part === null ? figure : figure.locator(part)
      await expect(target).toBeVisible()
      // R-V3 (d201): the app keeps one card per details and KaTeX; the crop is
      // the open details alone, and the formula box (Times italic on the
      // board) is masked on both sides (crops.json blocks-details).
      const formula = target.locator('[data-math]')
      // R-V5 (board tint inconsistency, B-Blocks:146,152): line 1 changes
      // (handle(req) to handle(req, env)) but the board tints it on neither
      // side; the app decides and tints it on both, so line 1 is masked on both sides
      // (crops.json blocks-ba). The same entry's css keeps the board's
      // indentation, which its flex rows collapse.
      const line1 = target.locator(
        '[data-tone]:has([data-path$="before.0"]), [data-tone]:has([data-path$="after.0"])',
      )
      if (kind === 'ba') await expect(line1).toHaveCount(2)
      const masks: Partial<Record<string, Locator[]>> = { details: [formula], ba: [line1] }
      await expect(page).toHaveScreenshot(`crop-${name}.png`, {
        fullPage: true,
        clip: await clipOf(target),
        mask: masks[kind],
      })
    })
  }
})
