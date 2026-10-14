import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expectComputed } from '../lib/geometry'
import { PHONE_VIEWPORT, type Theme } from '../lib/regions'
import { APP_FONTS, assertFontsLoaded } from '../lib/fonts'
import { expect, openReader, sessionEnvelope, test } from '../lib/session'
import { VISUAL_API_URL } from '../visual.config'

// The diagram and chart blocks of Phase 4b against their board regions. Board
// numbers are the inline styles of the board elements named on each test;
// positions are read relative to the diagram's own canvas, so the card's place
// on the page does not enter. fixtures/diagrams.payload.json carries the
// boards' own sample content (B-Blocks seq, B-Blocks2 state, layers, erd,
// mermaid and charts).

const COLORS: Record<
  Theme,
  Record<
    | 'elev'
    | 'line'
    | 'line2'
    | 'sub'
    | 'faint'
    | 'text'
    | 'accent'
    | 'accentText'
    | 'accentLine'
    | 'accentSoft'
    | 'stepLine'
    | 'good'
    | 'goodSoft'
    | 'warn'
    | 'info'
    | 'codeBg'
    | 'gridLine'
    | 'chip'
    | 'topbar'
    | 'viewerCanvas',
    string
  >
> = {
  dark: {
    elev: 'rgb(23, 27, 31)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    sub: 'rgb(161, 170, 178)',
    faint: 'rgb(124, 134, 143)',
    text: 'rgb(232, 236, 238)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(197, 240, 90)',
    accentLine: 'rgb(197, 240, 90)',
    accentSoft: 'rgb(30, 38, 18)',
    stepLine: 'rgb(59, 74, 28)',
    good: 'rgb(79, 211, 154)',
    goodSoft: 'rgb(19, 38, 31)',
    warn: 'rgb(244, 183, 64)',
    info: 'rgb(98, 199, 245)',
    codeBg: 'rgb(14, 17, 19)',
    gridLine: 'rgb(26, 31, 35)',
    chip: 'rgb(27, 32, 36)',
    topbar: 'rgba(11, 13, 15, 0.92)',
    viewerCanvas: 'rgb(8, 9, 10)',
  },
  light: {
    elev: 'rgb(249, 250, 250)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    sub: 'rgb(76, 85, 93)',
    faint: 'rgb(106, 115, 123)',
    text: 'rgb(15, 18, 20)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(77, 122, 0)',
    accentLine: 'rgb(94, 140, 16)',
    accentSoft: 'rgb(238, 248, 217)',
    stepLine: 'rgb(185, 217, 138)',
    good: 'rgb(19, 120, 74)',
    goodSoft: 'rgb(227, 243, 234)',
    warn: 'rgb(143, 90, 0)',
    info: 'rgb(11, 111, 168)',
    codeBg: 'rgb(249, 250, 250)',
    gridLine: 'rgb(233, 236, 238)',
    chip: 'rgb(238, 240, 242)',
    topbar: 'rgba(255, 255, 255, 0.92)',
    viewerCanvas: 'rgb(238, 240, 242)',
  },
}

const DIAGRAMS_ID = 'Dg4bBoardDiags'
const diagramsPayload = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '..', 'fixtures', 'diagrams.payload.json'), 'utf8'),
) as { meta: { title: string } }

async function openDiagrams(page: Page): Promise<void> {
  const origin = new URL(VISUAL_API_URL).origin
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS' }
  await page.route(`${origin}/api/session/${DIAGRAMS_ID}**`, (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS' || req.method() === 'PUT') return route.fulfill({ status: 204, headers: cors })
    const body = new URL(req.url()).pathname.endsWith('/state')
      ? { state: null }
      : {
          ...sessionEnvelope(),
          id: DIAGRAMS_ID,
          title: diagramsPayload.meta.title,
          payload: JSON.stringify(diagramsPayload),
        }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
  })
  await page.goto(`/s/${DIAGRAMS_ID}`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'app')
}

function card(page: Page, kind: string, nth = 0): Locator {
  return page
    .locator('figure')
    .filter({ has: page.locator(':scope > div:first-child > [data-kind-tag]', { hasText: new RegExp(`^${kind}$`) }) })
    .nth(nth)
}
const headerOf = (figure: Locator) => figure.locator(':scope > div:first-child')
const captionOf = (figure: Locator) => headerOf(figure).locator('[data-kind-tag] + span')

interface Rel {
  x: number
  y: number
  width: number
  height: number
}

/** The box of `el` relative to `origin`'s top-left corner. */
async function rel(el: Locator, origin: Locator): Promise<Rel> {
  await expect(el).toBeVisible()
  const [a, o] = await Promise.all([el.boundingBox(), origin.boundingBox()])
  expect(a, 'element has no box').not.toBeNull()
  expect(o, 'origin has no box').not.toBeNull()
  return { x: a!.x - o!.x, y: a!.y - o!.y, width: a!.width, height: a!.height }
}

function expectNear(got: Partial<Rel>, want: Partial<Rel>, what: string, tolerance = 1): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (want[key] === undefined) continue
    expect(Math.abs(got[key]! - want[key]!), `${what} ${key}: got ${got[key]}, board has ${want[key]}`).toBeLessThanOrEqual(
      tolerance,
    )
  }
}

const seqCanvas = (figure: Locator) => figure.locator('[data-actor]').first().locator('..')

test.describe('at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('seq at rest on the sample brief (B-Reader:128-160)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openReader(page)
    const figure = page.locator('section#s2 figure').filter({ has: page.locator('[data-actor]') })
    const canvas = seqCanvas(figure)
    // B-Reader:131: 640 x 400, centered in a body padded 16 top and bottom.
    expectNear(await rel(canvas, canvas), { width: 640, height: 400 }, 'canvas')
    await expect(captionOf(figure)).toHaveText('6 messages')
    // B-Reader:128: Play is the accent button; at rest there is no step label.
    await expectComputed(figure.getByRole('button', { name: 'Play sequence' }), { 'background-color': c.accent })
    await expect(headerOf(figure).getByText(/^step/)).toHaveCount(0)

    // B-Reader:140-143: actor boxes 130 x 44 on a 160 lane from x 15.
    const actors = figure.locator('[data-actor]')
    await expect(actors).toHaveText(['Client', 'Edge Worker', 'Limiter', 'Origin API'])
    for (let i = 0; i < 4; i++) {
      expectNear(await rel(actors.nth(i), canvas), { x: 15 + 160 * i, y: 0, width: 130, height: 44 }, `actor ${i}`)
    }
    await expectComputed(actors.first(), {
      'background-color': c.elev,
      'border-top-color': c.line2,
      'border-top-width': '1px',
      'border-radius': '4px',
      'font-size': '13px',
      'font-weight': '500',
    })
    await expect(actors.first()).toHaveCSS('font-family', /Geist/)

    // B-Reader:144-150: labels 12/16 mono, centered over their arrow, 52 apart from y 68.
    const labels = figure.locator('[data-seq-label]')
    await expect(labels).toHaveText(['1 GET /orders', '2 take(key, 1)', '3 ok · เหลือ 41', '4 forward', '5 200 OK', '6 200 · เหลือ 41'])
    const centers = [160, 320, 320, 400, 400, 160]
    for (let i = 0; i < 6; i++) {
      const box = await rel(labels.nth(i), canvas)
      expectNear({ x: box.x + box.width / 2, y: box.y }, { x: centers[i]!, y: 68 + 52 * i }, `label ${i + 1}`)
    }
    await expectComputed(labels.first(), { 'font-size': '12px', 'line-height': '16px', color: c.sub })
    await expect(labels.first()).toHaveCSS('font-family', /Geist Mono/)

    // B-Reader:132-135: dashed 3 4 lifelines down the lane middles from the box
    // bottom (44) to 390, 1.5 wide, line2. A vertical path has no width, so its
    // geometry is read from the path itself.
    const lifelines = figure.locator('path[stroke-dasharray="3 4"]')
    await expect(lifelines).toHaveCount(4)
    const paths = await lifelines.evaluateAll((els) =>
      els.map((e) => [e.getAttribute('d'), e.getAttribute('stroke-width'), getComputedStyle(e).stroke]),
    )
    expect(paths).toEqual([0, 1, 2, 3].map((i) => [`M${80 + 160 * i} 44 V390`, '1.5', c.line2]))
  })

  test('seq in step mode (B-Blocks:74-110)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'seq')
    // At rest a wide header has only Play (B-Reader:128); the arrow keys step.
    const steps = figure.getByRole('group', { name: 'Sequence steps' })
    for (let i = 0; i < 3; i++) await steps.press('ArrowRight')

    // B-Blocks:75: caption with the count, then the step in accent.
    await expect(captionOf(figure)).toHaveText('เส้นทางของ request / 6 messages')
    await expectComputed(headerOf(figure).getByText('step 3 / 6', { exact: true }), { color: c.accentText })

    // B-Blocks:93-98: past labels sub, the current one accent, later ones faint.
    const labels = figure.locator('[data-seq-label]')
    const colors = await labels.evaluateAll((els) => els.map((e) => getComputedStyle(e).color))
    expect(colors).toEqual([c.sub, c.sub, c.accentText, c.faint, c.faint, c.faint])
    // B-Blocks:89-92: the two actors of the current message take the accent border.
    const borders = await figure.locator('[data-actor]').evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor))
    expect(borders).toEqual([c.line2, c.accentLine, c.accentLine, c.line2])

    // B-Blocks:77: the diagram pane is padded 20/10 beside the list.
    const pane = seqCanvas(figure).locator('..')
    await expectComputed(pane, { 'padding-top': '20px', 'padding-left': '10px' })
    // B-Blocks:78: the canvas starts at the pane's padding, not centered.
    expectNear(await rel(seqCanvas(figure), pane), { x: 10, y: 20 }, 'canvas in the pane')
    // B-Blocks:101-108: the list is padded 10 with 4 between rows, 13px.
    const list = figure.getByRole('list')
    await expectComputed(list, { 'padding-top': '10px', 'row-gap': '4px', 'font-size': '13px' })
    // B-Blocks:76-77, :101: the pane and the list share one row, the 1px rule between them.
    const paneBox = await rel(pane, figure)
    expectNear(await rel(list, figure), { x: paneBox.x + paneBox.width + 1, y: paneBox.y, height: paneBox.height }, 'list')
    const rows = list.getByRole('listitem')
    await expect(rows).toHaveCount(6)
    await expectComputed(rows.nth(2), {
      'background-color': c.accentSoft,
      'border-top-color': c.stepLine,
      'border-top-width': '1px',
      'border-radius': '4px',
      'padding-top': '8px',
      'padding-left': '10px',
      color: c.text,
    })
    await expectComputed(rows.nth(0), { color: c.sub, 'padding-top': '8px', 'padding-left': '10px' })
    await expectComputed(rows.nth(3), { color: c.faint })
  })

  test('state (B-Blocks2:27-49)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'state')
    await expect(captionOf(figure)).toHaveText('สถานะของ request / 5 states / 5 transitions')
    const node = (id: string) => figure.locator(`[data-state-node="${id}"]`)
    const recv = node('recv')
    // B-Blocks2:31-40: 160 x 56 nodes, 256 apart in a row, 160 apart down.
    for (const [id, col, row] of [
      ['recv', 0, 0],
      ['token', 1, 0],
      ['fwd', 2, 0],
      ['done', 3, 0],
      ['limited', 0, 1],
    ] as const) {
      expectNear(await rel(node(id), recv), { x: 256 * col, y: 160 * row, width: 160, height: 56 }, id)
    }
    await expectComputed(recv, { 'border-top-width': '2px', 'border-top-color': c.accentLine, 'border-radius': '6px' })
    await expectComputed(node('token'), {
      'border-top-width': '1px',
      'border-top-color': c.line2,
      'background-color': c.elev,
      'font-size': '13px',
    })
    await expectComputed(node('done'), {
      'border-top-width': '3px',
      'border-top-style': 'double',
      'border-top-color': c.good,
      'background-color': c.goodSoft,
    })

    // B-Blocks2:41-43: a row label is mono 12, centered in the gap, its top at the node top.
    const tokenOk = figure.getByText('token ok', { exact: true })
    const box = await rel(tokenOk, recv)
    expectNear({ x: box.x + box.width / 2, y: box.y }, { x: 160 + 48, y: 0 }, 'token ok')
    await expectComputed(tokenOk, { 'font-size': '12px', color: c.sub })
    await expect(tokenOk).toHaveCSS('font-family', /Geist Mono/)
    await expectComputed(figure.getByText('200', { exact: true }), { color: c.good })
    // B-Blocks2:44-45: a vertical label sits 12 off its line, beside the node's
    // third; the loop back is warn.
    const retry = figure.getByText('retry หลัง 30 วิ', { exact: true })
    expectNear({ x: (await rel(retry, recv)).x }, { x: 2 * (160 / 3) + 12 }, 'retry label', 2)
    await expectComputed(retry, { color: c.warn, 'font-size': '12px' })

    // B-Blocks2:48: the footer, 12px sub on a line rule.
    const footer = figure.locator(':scope > div').last()
    await expect(footer).toHaveText(
      'Hover a state dims everything not connected to it.Initial lime border. Final double border.Loop back dashed.',
    )
    await expectComputed(footer, {
      'font-size': '12px',
      color: c.sub,
      'padding-top': '8px',
      'padding-left': '12px',
      'border-top-color': c.line,
    })
  })

  test('layers (B-Blocks2:51-78)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'layers')
    await expect(captionOf(figure)).toHaveText('สถาปัตยกรรมหลังใส่ limiter / 3 layers / 5 nodes')
    const bands = figure.locator('[data-band]')
    const first = bands.first()
    // B-Blocks2:56-58: bands 1040 x 120, 150 apart, code-bg on a grid-line rule, radius 4.
    for (let i = 0; i < 3; i++) expectNear(await rel(bands.nth(i), first), { x: 0, y: 150 * i, width: 1040, height: 120 }, `band ${i}`)
    await expectComputed(first, {
      'background-color': c.codeBg,
      'border-top-color': c.gridLine,
      'border-radius': '4px',
    })
    // B-Blocks2:59-61: the band label at 16/12, mono 11 caps, .06em, faint.
    const label = first.locator('span')
    await expect(label).toHaveText('edge')
    expectNear(await rel(label, first), { x: 16, y: 12 }, 'band label')
    await expectComputed(label, { 'font-size': '11px', 'letter-spacing': '0.66px', 'text-transform': 'uppercase', color: c.faint })
    // B-Blocks2:67-69: 180 x 52 nodes from x 220, 300 apart, 34 into their band.
    const node = (id: string) => figure.locator(`[data-layer-node="${id}"]`)
    expectNear(await rel(node('client'), first), { x: 220, y: 34, width: 180, height: 52 }, 'Client')
    expectNear(await rel(node('worker'), first), { x: 520, y: 34, width: 180, height: 52 }, 'Edge Worker')
    expectNear(await rel(node('limiter'), first), { x: 220, y: 184, width: 180, height: 52 }, 'Limiter')
    await expectComputed(node('client'), {
      'background-color': c.elev,
      'border-top-color': c.line2,
      'border-radius': '6px',
      'font-size': '13px',
    })
    // B-Blocks2:72: an edge label is mono 12 sub.
    await expectComputed(figure.getByText('HTTPS', { exact: true }), { 'font-size': '12px', color: c.sub })
  })

  test('erd (B-Blocks2:80-94)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'erd')
    await expect(captionOf(figure)).toHaveText('ตารางที่เกี่ยวกับ limit / 3 tables / 2 relations')
    const table = (name: string) => figure.locator(`[data-table="${name}"]`)
    const canvas = table('rate_limit_rules').locator('..')
    // B-Blocks2:84: a 1100 x 250 canvas; B-Blocks2:86-88: tables 260 wide from (60, 40), 360 apart.
    expectNear(await rel(canvas, canvas), { width: 1100, height: 250 }, 'canvas')
    expectNear(await rel(table('rate_limit_rules'), canvas), { x: 60, y: 40, width: 260, height: 132 }, 'rate_limit_rules')
    expectNear(await rel(table('customers'), canvas), { x: 420, y: 40, width: 260, height: 132 }, 'customers')
    expectNear(await rel(table('api_keys'), canvas), { x: 780, y: 40, width: 260, height: 160 }, 'api_keys')
    await expectComputed(table('api_keys'), {
      'background-color': c.elev,
      'border-top-color': c.line2,
      'border-radius': '6px',
    })
    const header = table('api_keys').locator(':scope > span').first()
    expectNear(await rel(header, table('api_keys')), { height: 36 }, 'header', 0.5)
    await expectComputed(header, { 'background-color': c.chip, 'font-weight': '500', 'font-size': '13px' })
    const row = table('api_keys').locator('[data-column="customer_id"]')
    expectNear(await rel(row, table('api_keys')), { y: 36 + 28, height: 28 }, 'row', 1.5)
    await expectComputed(row, { 'font-size': '12px', 'padding-left': '12px', 'column-gap': '8px' })
    await expectComputed(row.getByText('FK', { exact: true }), { color: c.info, width: '20px' })
    await expectComputed(table('api_keys').getByText('PK', { exact: true }), { color: c.accentText })
    await expectComputed(row.getByText('uuid', { exact: true }), { color: c.faint })
    // B-Blocks2:89-90: the FK name sits 12 under its edge, mono 11, cyan, centered in the gap.
    const plan = canvas.locator(':scope > div').filter({ hasText: /^plan$/ })
    const box = await rel(plan, canvas)
    expectNear({ x: box.x + box.width / 2, y: box.y }, { x: 370.5, y: 70 }, 'plan label')
    await expectComputed(plan, { 'font-size': '11px', color: c.info })
    // B-Blocks2:93.
    await expect(figure.locator(':scope > div').last()).toHaveText(
      'PK lime, FK cyan. Hovering an FK row highlights its target row and the connector.',
    )
  })

  test('mermaid (B-Blocks2:96-104)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'mermaid')
    await expect(captionOf(figure)).toHaveText('flowchart LR')
    // B-Blocks2:98: the view toggle, 2 inside a line rule, 26 high buttons padded 0/8.
    const toggle = figure.getByRole('group', { name: 'View' })
    await expectComputed(toggle, { 'padding-top': '2px', 'column-gap': '2px', 'border-top-color': c.line, 'border-radius': '4px' })
    const diagram = toggle.getByRole('button', { name: 'diagram' })
    await expect(diagram).toHaveAttribute('aria-pressed', 'true')
    await expectComputed(diagram, { 'min-height': '26px', 'padding-left': '8px', 'border-radius': '3px', 'background-color': c.chip })
    // B-Blocks2:102-103: padded 20; a left-to-right flowchart draws in 200.
    const box = figure.locator('svg[id^="mm-"]').locator('../..')
    await expect(figure.locator('svg[id^="mm-"]')).toBeVisible()
    expectNear(await rel(box, box), { height: 200 }, 'diagram box')
    await expectComputed(box.locator('..'), { 'padding-top': '20px', 'padding-left': '20px' })
    await expect(figure.locator('svg[id^="mm-"]')).toHaveCSS('font-size', '13px')
  })

  test('charts: bigo, heatmap, histogram, scatter, plot3d bodies (B-Blocks:127-131, :179-187; B-Blocks2:132-182)', async ({
    page,
    theme,
  }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const chartOf = (figure: Locator) => figure.locator('canvas').first().locator('../..')

    // B-Blocks:129-130: padded 12, the plot 540:200.
    const bigo = card(page, 'bigo')
    await expect(bigo.locator('canvas').first()).toBeVisible()
    const bigoBox = await rel(chartOf(bigo), chartOf(bigo))
    expect(Math.abs(bigoBox.width / bigoBox.height - 540 / 200)).toBeLessThan(0.01)
    await expectComputed(chartOf(bigo).locator('..'), { 'padding-top': '12px', 'padding-left': '12px' })

    // B-Blocks:180-185: four rows of 18 with 3 between, under a 12 pad, labels below.
    const heatmap = card(page, 'heatmap')
    await expect(heatmap.locator('canvas').first()).toBeVisible()
    expectNear(await rel(chartOf(heatmap), chartOf(heatmap)), { height: 4 * 18 + 3 * 3 + 18 }, 'heatmap')
    await expectComputed(chartOf(heatmap).locator('..'), { 'padding-top': '12px', 'padding-left': '12px' })

    // B-Blocks2:134-145: padded 16/16/10, a 200 plot and its labels under it.
    const histogram = card(page, 'histogram')
    await expect(captionOf(histogram)).toHaveText('latency ช่วง burst / 8 bins')
    await expect(histogram.locator('canvas').first()).toBeVisible()
    await expectComputed(chartOf(histogram).locator('..'), {
      'padding-top': '16px',
      'padding-left': '16px',
      'padding-bottom': '10px',
    })

    // B-Blocks2:153-155: padded 12/16, the plot 520:220, series named in the header.
    const scatter = card(page, 'scatter')
    await expect(captionOf(scatter)).toHaveText('RPS เทียบ latency / 2 series')
    await expect(headerOf(scatter)).toContainText('before')
    await expect(headerOf(scatter)).toContainText('after')
    const scatterBox = await rel(chartOf(scatter), chartOf(scatter))
    expect(Math.abs(scatterBox.width / scatterBox.height - 520 / 220)).toBeLessThan(0.01)
    await expectComputed(chartOf(scatter).locator('..'), { 'padding-top': '12px', 'padding-left': '16px' })

    // B-Blocks2:168-170: a code-bg pane padded 16; 36px zoom buttons 28 from
    // the left and 24 from the bottom, 6 apart.
    const plot3d = card(page, 'plot3d')
    const pane = plot3d.getByRole('button', { name: 'Zoom in' }).locator('../..')
    await expectComputed(pane, { 'background-color': c.codeBg, 'padding-top': '16px' })
    const zoomIn = plot3d.getByRole('button', { name: 'Zoom in' })
    const zoomOut = plot3d.getByRole('button', { name: 'Zoom out' })
    const paneBox = await rel(pane, pane)
    const inBox = await rel(zoomIn, pane)
    expectNear(inBox, { x: 28, width: 36, height: 36 }, 'plot3d zoom in')
    expectNear({ y: paneBox.height - inBox.y - inBox.height }, { y: 24 }, 'plot3d zoom bottom')
    expectNear({ x: (await rel(zoomOut, pane)).x }, { x: 28 + 36 + 6 }, 'plot3d zoom out')
    await expectComputed(zoomIn, { 'background-color': c.elev, 'border-top-color': c.line2, 'border-radius': '4px' })
  })

  test('the diagram viewer (B-Overlays:146-170)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'seq')
    await figure.getByRole('group', { name: 'Sequence steps' }).press('ArrowRight')
    await figure.getByRole('button', { name: 'Open diagram full screen' }).click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expect(viewer).toBeVisible()
    await expectComputed(viewer, { 'background-color': c.viewerCanvas })

    // B-Overlays:147: the bar is 56 high, topbar fill on a grid-line rule.
    const bar = viewer.locator(':scope > div').first()
    expectNear(await rel(bar, viewer), { y: 0, height: 56 }, 'top bar')
    await expectComputed(bar, { 'background-color': c.topbar, 'border-bottom-color': c.gridLine })
    // B-Overlays:148: the kind tag 16 from the edge, the title 14/600.
    const tag = viewer.getByText('seq', { exact: true })
    expectNear({ x: (await rel(tag, viewer)).x }, { x: 16 }, 'kind tag')
    await expectComputed(tag, { 'font-size': '11px', color: c.faint, 'border-top-color': c.line2 })
    await expectComputed(viewer.getByText('เส้นทางของ request', { exact: true }), { 'font-size': '14px', 'font-weight': '600' })

    // B-Overlays:149-150: each group padded 2 in a line rule, 36px buttons, labels 56 and 52 wide.
    for (const name of ['Steps', 'Zoom']) {
      const group = viewer.getByRole('group', { name })
      await expectComputed(group, { 'padding-top': '2px', 'column-gap': '2px', 'border-top-color': c.line, 'border-radius': '4px' })
    }
    const next = viewer.getByRole('group', { name: 'Steps' }).getByRole('button', { name: 'Next step' })
    expectNear(await rel(next, next), { width: 36, height: 36 }, 'step button')
    await expectComputed(next, { 'background-color': c.elev, 'border-radius': '3px' })
    await expectComputed(viewer.getByRole('group', { name: 'Steps' }).getByText('1 / 6'), { 'min-width': '56px', color: c.sub })
    await expectComputed(viewer.getByRole('group', { name: 'Zoom' }).getByText(/^\d+%$/), { 'min-width': '52px', 'font-size': '12px' })

    // B-Overlays:151: Close 40 high, padded 0/12, line2 rule, 13px, the Esc key in mono 10.
    const close = viewer.getByRole('button', { name: 'Close viewer' })
    expectNear(await rel(close, close), { height: 40 }, 'Close')
    await expectComputed(close, { 'padding-left': '12px', 'border-top-color': c.line2, 'font-size': '13px', 'column-gap': '8px' })
    await expectComputed(close.locator('kbd'), { 'font-size': '10px', 'padding-left': '4px', 'border-top-color': c.line2 })
    expectNear({ x: (await rel(close, viewer)).x + (await rel(close, close)).width }, { x: 1440 - 12 }, 'Close right edge')

    // B-Overlays:153: the canvas between the bars, a 16px dot grid.
    const surface = viewer.locator('[data-panzoom-content]').locator('..')
    expectNear(await rel(surface, viewer), { y: 56, height: 900 - 56 - 72 }, 'canvas')
    await expectComputed(surface, { 'background-size': '16px 16px' })

    // B-Overlays:166-168: a 72 bar with the step label, the step text and the key hints.
    const footer = viewer.locator(':scope > div').last()
    expectNear(await rel(footer, viewer), { y: 900 - 72, height: 72 }, 'footer')
    await expectComputed(footer, { 'padding-left': '16px', 'column-gap': '16px', 'border-top-color': c.gridLine })
    await expectComputed(footer.locator('span').first(), { 'font-size': '12px', color: c.accentText })
    const text = footer.locator('[aria-live="polite"]')
    await expect(text).toHaveText('Client → Edge Worker: GET /orders')
    await expectComputed(text, { 'font-size': '14px', 'line-height': '20px' })
    await expect(footer).toContainText('← → step+ − zoom0 fitdrag to pan')
  })
})

test.describe('at the phone width', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT)
  })

  test('seq is a step list (B-Mobile:35-41)', async ({ page, theme }) => {
    const c = COLORS[theme]
    await openDiagrams(page)
    const figure = card(page, 'seq')
    const next = figure.getByRole('button', { name: 'Next step' })
    const prev = figure.getByRole('button', { name: 'Previous step' })
    // B-Mobile:35 draws 40; the settled touch floor is 44.
    expectNear(await rel(next, next), { width: 44, height: 44 }, 'Next')
    expectNear(await rel(prev, prev), { width: 44, height: 44 }, 'Previous')
    for (let i = 0; i < 3; i++) await next.click()
    await expect(headerOf(figure).getByText('step 3 of 6', { exact: true })).toBeVisible()
    await expect(figure.locator('[data-actor]').first()).toBeHidden()

    // B-Mobile:36-40: padded 12, 6 between rows, 13px; the current row padded 6/8.
    const list = figure.getByRole('list')
    await expectComputed(list, { 'padding-top': '12px', 'row-gap': '6px', 'font-size': '13px' })
    const rows = list.getByRole('listitem')
    await expect(rows.first()).toHaveText(/^1\s*Client → Edge Worker: GET \/orders$/)
    await expectComputed(rows.nth(2), {
      'background-color': c.accentSoft,
      'border-top-color': c.stepLine,
      'padding-top': '6px',
      'padding-left': '8px',
      'border-radius': '4px',
    })
    await expectComputed(rows.nth(0), { color: c.sub, 'padding-top': '0px', 'column-gap': '8px' })
    await expectComputed(rows.nth(3), { color: c.faint })
  })

  test('the viewer moves both groups to a bottom bar with 44px buttons (B-Overlays:171)', async ({ page }) => {
    await openDiagrams(page)
    const figure = card(page, 'seq')
    await figure.getByRole('button', { name: 'Next step' }).click()
    await figure.getByRole('button', { name: 'Open diagram full screen' }).click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expect(viewer).toBeVisible()
    const steps = viewer.getByRole('group', { name: 'Steps' })
    const text = viewer.locator('[aria-live="polite"]')
    const stepsBox = await rel(steps, viewer)
    const textBox = await rel(text, viewer)
    expect(stepsBox.y, 'the groups sit below the step text').toBeGreaterThan(textBox.y)
    expect(stepsBox.y + stepsBox.height).toBeGreaterThan(PHONE_VIEWPORT.height - 80)
    for (const name of ['Previous step', 'Next step', 'Zoom out', 'Zoom in']) {
      expectNear(await rel(viewer.getByRole('button', { name }), viewer.getByRole('button', { name })), { height: 44 }, name)
    }
    expectNear(await rel(viewer.getByRole('button', { name: 'Close viewer' }), viewer.getByRole('button', { name: 'Close viewer' })), { height: 44 }, 'Close')
  })

  test('wide diagrams scroll inside their card; the page never scrolls sideways', async ({ page }) => {
    await openDiagrams(page)
    for (const kind of ['state', 'layers', 'erd']) {
      const figure = card(page, kind)
      const scroller = figure.locator(':scope > div:nth-child(2)')
      await expect(scroller).toHaveCSS('overflow-x', 'auto')
      const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
      expect(scrollWidth, `${kind} scrolls`).toBeGreaterThan(clientWidth)
    }
    const pageWidth = await page.evaluate(() => document.scrollingElement!.scrollWidth)
    expect(pageWidth).toBeLessThanOrEqual(PHONE_VIEWPORT.width)
  })
})
