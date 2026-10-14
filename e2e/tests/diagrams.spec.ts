import type { Locator, Page } from '@playwright/test'
import type { Block, Payload } from '@brief/schema'
import { test, expect } from './fixtures'

// Phase 4b: the diagram and chart blocks on the Console boards. Seq playback
// (features.md B4), the full-screen viewer (B5), failures inside the card (B6),
// the owner's D5 removals, bug-402 and the print rule for step diagrams.

const HOSTILE = '<img src=x onerror="window.__xss=1">'

const seq: Block = {
  type: 'seq',
  title: 'Request path',
  actors: ['Client', 'Edge', 'Limiter'],
  steps: [
    { from: 'Client', to: 'Edge', label: 'GET /orders' },
    { from: 'Edge', to: 'Limiter', label: 'take(key, 1)', note: 'one token per request' },
    { from: 'Limiter', to: 'Edge', label: 'ok' },
    { from: 'Edge', to: 'Client', label: '200 OK' },
  ],
}

const payload: Payload = {
  meta: { title: 'Diagram blocks' },
  sections: [
    { id: 'flow', no: 1, title: 'Flow', blocks: [seq] },
    {
      id: 'states',
      no: 2,
      title: 'States',
      blocks: [
        {
          type: 'state',
          title: 'Lifecycle',
          initial: 'a',
          states: [
            { id: 'a', label: 'รอการอนุมัติจากผู้อำนวยการสำนักบริหารทรัพยากรบุคคล' },
            { id: 'b', label: 'Waiting for the regional director to approve the request' },
            { id: 'c', label: 'Done' },
          ],
          transitions: [
            { from: 'a', to: 'b', label: 'submit' },
            { from: 'b', to: 'c', label: 'approve' },
          ],
        },
        {
          type: 'layers',
          title: 'Stack',
          layers: [
            { id: 'edge', label: 'edge', nodes: [{ id: 'w', label: 'Worker' }], edges: [] },
            { id: 'data', label: 'data', nodes: [{ id: 'kv', label: 'KV' }], edges: [{ from: 'w', to: 'kv' }] },
          ],
        },
        {
          type: 'erd',
          title: 'Tables',
          tables: [
            { name: 'users', columns: [{ name: 'id', type: 'uuid', pk: true }] },
            {
              name: 'orders',
              columns: [
                { name: 'id', type: 'uuid', pk: true },
                { name: 'user_id', type: 'uuid', fk: { table: 'users', column: 'id' } },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'mermaid',
      no: 3,
      title: 'Mermaid',
      blocks: [
        { type: 'mermaid', title: 'gate', code: 'flowchart LR\n  A[request] --> B{tokens > 0}\n  B -- yes --> C[serve]' },
        { type: 'mermaid', title: 'broken', code: 'flowchart LR\n  A[request] --> B{tokens}\n  B -- yes --> C[serve' },
      ],
    },
    {
      id: 'charts',
      no: 4,
      title: 'Charts',
      blocks: [
        {
          type: 'bigo',
          title: 'cost',
          series: [
            { label: 'O(n)', curve: 'n' },
            { label: 'O(log n)', curve: 'logn' },
            { label: 'O(1)', curve: '1' },
          ],
        },
        { type: 'heatmap', title: 'hostile', xLabels: [HOSTILE], yLabels: ['row'], values: [[3]] },
        { type: 'heatmap', title: 'broken rows', xLabels: ['a', 'b'], yLabels: ['x', 'y'], values: [[1, 2], [3]] },
      ],
    },
  ],
  decisions: [],
}

function card(page: Page, kind: string, title: string): Locator {
  return page.locator('figure').filter({ has: page.locator('[data-kind-tag]', { hasText: new RegExp(`^${kind}$`) }) }).filter({ hasText: title })
}

const edgeStates = (figure: Locator) =>
  figure.locator('[data-edge]').evaluateAll((edges) => edges.map((e) => e.getAttribute('data-state')))

async function openSession(page: Page, createSession: (p?: Payload) => Promise<{ id: string }>) {
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  await expect(page.locator('figure').first()).toBeVisible()
}

test.describe('seq playback (B4)', () => {
  test('plays, steps and pauses by mouse on a wide screen', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'the wide header is checked on the desktop project; the phone list has its own test')
    await openSession(page, createSession)
    const figure = card(page, 'seq', 'Request path')
    await expect.poll(() => edgeStates(figure)).toEqual(['rest', 'rest', 'rest', 'rest'])

    await figure.getByRole('button', { name: 'Play sequence' }).click()
    await expect(figure.getByText('step 1 / 4')).toBeVisible()
    await figure.getByRole('button', { name: 'Pause' }).click()
    await figure.getByRole('button', { name: 'Next step' }).click()
    await expect.poll(() => edgeStates(figure)).toEqual(['past', 'current', 'future', 'future'])
    await expect(figure.getByRole('listitem').nth(1)).toContainText('one token per request')
    await figure.getByRole('button', { name: 'Previous step' }).click()
    await expect(figure.getByText('step 1 / 4')).toBeVisible()
  })

  test('steps with the arrow keys and plays with Space', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const figure = card(page, 'seq', 'Request path')
    const steps = figure.getByRole('group', { name: 'Sequence steps' })
    await steps.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => edgeStates(figure)).toEqual(['past', 'current', 'future', 'future'])
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => edgeStates(figure)).toEqual(['current', 'future', 'future', 'future'])
    await page.keyboard.press(' ')
    await expect.poll(() => edgeStates(figure), { timeout: 5_000 }).toEqual(['past', 'current', 'future', 'future'])
  })

  test('on a phone the diagram is the step list, stepped by touch', async ({ page, createSession, isMobile }) => {
    test.skip(!isMobile, 'the phone list shows under 880px only')
    await openSession(page, createSession)
    const figure = card(page, 'seq', 'Request path')
    const rows = figure.getByRole('listitem')
    await expect(rows).toHaveText([
      /^1\s*Client → Edge: GET \/orders$/,
      /^2\s*Edge → Limiter: take\(key, 1\)/,
      /^3\s*Limiter → Edge: ok$/,
      /^4\s*Edge → Client: 200 OK$/,
    ])
    await expect(figure.locator('[data-actor]').first()).toBeHidden()
    // Measured before the taps: a pressed button scales to .97 while :active.
    const next = await figure.getByRole('button', { name: 'Next step' }).boundingBox()
    expect(next!.height).toBeGreaterThanOrEqual(44)
    await figure.getByRole('button', { name: 'Next step' }).tap()
    await figure.getByRole('button', { name: 'Next step' }).tap()
    await expect(figure.getByText('step 2 of 4', { exact: true })).toBeVisible()
    await expect(rows.nth(1)).toHaveAttribute('aria-current', 'step')
  })

  test('prints every step, numbered, with the list left out', async ({ page, createSession }) => {
    await openSession(page, createSession)
    await page.emulateMedia({ media: 'print' })
    const figure = card(page, 'seq', 'Request path')
    const labels = figure.locator('[data-seq-label]')
    await expect(labels).toHaveText(['1 GET /orders', '2 take(key, 1)', '3 ok', '4 200 OK'])
    for (const label of await labels.all()) await expect(label).toBeVisible()
    await expect(figure.getByRole('list')).toBeHidden()
    await expect(figure.getByRole('button', { name: 'Next step' })).toBeHidden()
  })
})

test.describe('diagram viewer (B5)', () => {
  const zoomLevel = (viewer: Locator) => viewer.getByRole('group', { name: 'Zoom' }).getByText(/^\d+%$/)

  test('every gesture has a button, Esc closes and focus goes back', async ({ page, createSession, isMobile }) => {
    await openSession(page, createSession)
    const figure = card(page, 'seq', 'Request path')
    const open = figure.getByRole('button', { name: 'Open diagram full screen' })
    await open.click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expect(viewer).toBeVisible()
    await expect(viewer.getByText('Request path')).toBeVisible()

    const zoom = viewer.getByRole('group', { name: 'Zoom' })
    const start = Number((await zoomLevel(viewer).textContent())!.replace('%', ''))
    const press = (name: string) => (isMobile ? zoom.getByRole('button', { name }).tap() : zoom.getByRole('button', { name }).click())
    await press('Zoom in')
    const up = Math.floor(start / 25) * 25 + 25
    await expect(zoomLevel(viewer)).toHaveText(`${up}%`)
    await press('Zoom out')
    await press('Zoom out')
    await expect(zoomLevel(viewer)).toHaveText(`${up - 50}%`)
    await press('Fit')
    await expect(zoomLevel(viewer)).not.toHaveText(`${up - 50}%`)

    const steps = viewer.getByRole('group', { name: 'Steps' })
    await steps.getByRole('button', { name: 'Next step' }).click()
    await expect(steps).toContainText('1 / 4')
    await expect(viewer.getByText('Client → Edge: GET /orders')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(viewer.getByText('Edge → Limiter: take(key, 1)')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
    await expect(open).toBeFocused()
    await expect.poll(() => edgeStates(figure)).toEqual(['past', 'current', 'future', 'future'])
  })

  test('zooms with + and -, fits with 0, and keeps 0.3 to 6', async ({ page, createSession }) => {
    await openSession(page, createSession)
    await card(page, 'state', 'Lifecycle').getByRole('button', { name: 'Open diagram full screen' }).click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expect(viewer).toBeVisible()
    for (let i = 0; i < 40; i++) await page.keyboard.press('+')
    await expect(zoomLevel(viewer)).toHaveText('600%')
    for (let i = 0; i < 40; i++) await page.keyboard.press('-')
    await expect(zoomLevel(viewer)).toHaveText('30%')
    await page.keyboard.press('0')
    await expect(zoomLevel(viewer)).not.toHaveText('30%')
  })

  test('a cancelled touch does not haunt the next open: one finger still pans (bug-121)', async ({
    page,
    createSession,
  }) => {
    await openSession(page, createSession)
    const open = card(page, 'seq', 'Request path').getByRole('button', { name: 'Open diagram full screen' })
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    const content = viewer.locator('[data-panzoom-content]')
    const surface = content.locator('..')
    const pointer = (type: string, pointerId: number, x: number, y: number) =>
      surface.dispatchEvent(type, { pointerId, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true })

    await open.click()
    await expect(viewer).toBeVisible()
    await pointer('pointerdown', 1, 200, 300)
    await pointer('pointercancel', 1, 200, 300)
    await viewer.getByRole('button', { name: 'Close viewer' }).click()
    await expect(viewer).toBeHidden()

    await open.click()
    await expect(viewer).toBeVisible()
    const before = await content.evaluate((el) => (el as HTMLElement).style.transform)
    await pointer('pointerdown', 2, 200, 300)
    await pointer('pointermove', 2, 250, 330)
    await pointer('pointerup', 2, 250, 330)
    const after = await content.evaluate((el) => (el as HTMLElement).style.transform)
    const scale = (t: string) => /scale\(([\d.]+)\)/.exec(t)?.[1]
    const translate = (t: string) => (/translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(t) ?? []).slice(1).map(Number)
    expect(scale(after)).toBe(scale(before))
    const [x0 = 0, y0 = 0] = translate(before)
    expect(translate(after)).toEqual([x0 + 50, y0 + 30])
  })
})

test.describe('D5 removals and kept interactions', () => {
  test('state has no event buttons; hovering a state dims the unconnected ones', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'hover needs a mouse')
    await openSession(page, createSession)
    const figure = card(page, 'state', 'Lifecycle')
    await expect(figure.getByRole('button')).toHaveText([''])
    const nodes = figure.locator('[data-state-node]')
    await nodes.nth(2).hover()
    await expect(nodes.nth(0)).toHaveClass(/opacity-45/)
    await expect(nodes.nth(1)).not.toHaveClass(/opacity-45/)
  })

  test('state labels fit their nodes, Thai and English', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const nodes = card(page, 'state', 'Lifecycle').locator('[data-state-node]')
    await expect(nodes).toHaveCount(3)
    for (const node of await nodes.all()) {
      const fit = await node.evaluate((el) => ({
        w: el.scrollWidth <= el.clientWidth,
        h: el.scrollHeight <= el.clientHeight,
      }))
      expect(fit).toEqual({ w: true, h: true })
    }
  })

  test('layers shows every layer with no toggles; erd tables do not move and nothing is stored', async ({
    page,
    createSession,
    isMobile,
  }) => {
    test.skip(isMobile, 'dragging is checked with a mouse')
    await openSession(page, createSession)
    const layers = card(page, 'layers', 'Stack')
    await expect(layers.locator('[data-band]')).toHaveCount(2)
    await expect(layers.getByRole('button')).toHaveCount(1)

    const erd = card(page, 'erd', 'Tables')
    await expect(erd.getByRole('button', { name: 'Reset layout' })).toHaveCount(0)
    const table = erd.locator('[data-table="orders"]')
    await table.scrollIntoViewIfNeeded()
    const before = await table.boundingBox()
    await page.mouse.move(before!.x + 20, before!.y + 10)
    await page.mouse.down()
    await page.mouse.move(before!.x + 140, before!.y + 90, { steps: 5 })
    await page.mouse.up()
    expect(await table.boundingBox()).toEqual(before)
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('idocs:layout')))
    expect(stored).toEqual([])
  })

  test('erd: hovering an FK row lights its target row and the connector', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'hover needs a mouse')
    await openSession(page, createSession)
    const erd = card(page, 'erd', 'Tables')
    await erd.locator('[data-table="orders"] [data-column="user_id"]').hover()
    await expect(erd.locator('[data-table="users"] [data-column="id"]')).toHaveClass(/c-row-hover/)
    await expect(erd.locator('[data-edge]')).toHaveAttribute('data-state', 'active')
  })

  test('bigo keeps its n slider and its full-screen button', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const figure = card(page, 'bigo', 'cost')
    const slider = figure.getByRole('slider', { name: 'n (log scale)' })
    const readout = figure.getByText(/^O\(n\) ≈/)
    await expect(readout).toHaveText('O(n) ≈ 10.0k')
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(readout).not.toHaveText('O(n) ≈ 10.0k')
    const open = figure.getByRole('button', { name: 'Open diagram full screen' })
    await expect(open).toBeEnabled()
    await open.click()
    await expect(page.getByRole('dialog', { name: 'Diagram viewer' }).locator('img')).toBeVisible()
  })

  test('the bigo n slider keeps a usable width at every viewport', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'each width is set on the desktop project')
    const { id } = await createSession(payload)
    for (const width of [388, 881, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/s/${id}`)
      const figure = card(page, 'bigo', 'cost')
      const slider = figure.getByRole('slider', { name: 'n (log scale)' })
      await slider.scrollIntoViewIfNeeded()
      const box = (await slider.boundingBox())!
      const cardBox = (await figure.boundingBox())!
      expect.soft(box.width, `slider width at ${width} in a ${cardBox.width} card`).toBeGreaterThanOrEqual(cardBox.width / 2)
      // Touch targets are 44 under 880 (settled rule).
      if (width < 880) expect.soft(box.height, `slider height at ${width}`).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('mermaid (bug-402) and failures in the card (B6)', () => {
  test('a bare > in a label renders', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const svg = card(page, 'mermaid', 'gate').locator('svg[id^="mm-"]')
    await expect(svg).toBeVisible()
    await expect.poll(() => svg.evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' '))).toContain('tokens > 0')
  })

  test('a mermaid parse error fails in its card with the bad line marked and no trace', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const figure = card(page, 'mermaid', 'broken')
    await expect(figure.getByRole('alert')).toHaveText('Diagram could not be drawn. Parse error on line 3.')
    await expect(figure.locator('[data-bad-line]')).toContainText('B -- yes --> C[serve')
    await expect(figure).not.toContainText(/Error:|Expecting|_next|\.js/)
  })

  test('a heatmap whose rows do not match fails in its card with the row marked', async ({ page, createSession }) => {
    await openSession(page, createSession)
    const figure = card(page, 'heatmap', 'broken rows')
    await expect(figure.getByRole('alert')).toHaveText('Chart could not be drawn.')
    await expect(figure.locator('[data-bad-line]')).toContainText('[3]')
    await expect(figure.getByRole('button', { name: 'Open diagram full screen' })).toHaveCount(0)
  })

  test('when echarts cannot load, every chart says so instead of loading forever', async ({ page, createSession }) => {
    // echarts' chunk names carry content hashes, so it is found by what it holds.
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await fetch(route.request().url())
      const body = await response.text()
      if (body.includes('registerPreprocessor')) return route.abort('failed')
      return route.fulfill({ status: response.status, contentType: 'application/javascript', body })
    })
    await openSession(page, createSession)
    const bigo = card(page, 'bigo', 'cost')
    await expect(bigo.getByRole('alert')).toHaveText('Chart could not be drawn.')
    await expect(card(page, 'heatmap', 'hostile').getByRole('alert')).toHaveText('Chart could not be drawn.')
    await expect(page.getByText('loading chart')).toHaveCount(0)
  })

  test('a hostile label shows as text in the chart tooltip and runs nothing', async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'the tooltip follows a hovering mouse')
    await openSession(page, createSession)
    const figure = card(page, 'heatmap', 'hostile')
    const chart = figure.locator('canvas').first()
    await chart.scrollIntoViewIfNeeded()
    await expect(chart).toBeVisible()
    const box = (await chart.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.6, box.y + 8)
    await expect(figure.getByText(`row ${HOSTILE} / 3`)).toBeVisible()
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
    await expect(figure.locator('img[src="x"]')).toHaveCount(0)
  })
})
