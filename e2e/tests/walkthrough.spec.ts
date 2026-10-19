import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const CODE =
  'export async function handle(req, env) {\n  const key = resolveKey(req)\n\n  const { success } = await env.LIMITER.limit({ key })\n  if (!success) return tooMany(30)\n  return fetch(origin(req))\n}'

const payload: Payload = {
  meta: { title: 'Walkthrough' },
  sections: [
    {
      id: 'walk',
      no: 1,
      title: 'Walkthrough',
      blocks: [
        {
          type: 'walkthrough',
          language: 'ts',
          filename: 'src/limiter.ts',
          title: 'handle()',
          code: CODE,
          flow: {
            nodes: [
              { id: 'req', label: 'Request in', kind: 'start' },
              { id: 'key', label: 'Find the key' },
              { id: 'ok', label: 'Token left?', kind: 'decision' },
              { id: 'deny', label: 'Reply 429', kind: 'end', tone: 'bad' },
              { id: 'fwd', label: 'Forward to origin', kind: 'end' },
            ],
            edges: [
              { from: 'req', to: 'key' },
              { from: 'key', to: 'ok' },
              { from: 'ok', to: 'deny', label: 'no', tone: 'bad' },
              { from: 'ok', to: 'fwd', label: 'yes', tone: 'good' },
            ],
          },
          steps: [
            { from: 1, to: 3, title: 'Take the request and find the key', nodes: ['req', 'key'] },
            { from: 4, title: 'Ask for one token', nodes: ['ok'] },
            { from: 5, title: 'Out of tokens, reply 429', nodes: ['deny'] },
            { from: 6, to: 7, title: 'Passed, forward to origin', nodes: ['fwd'] },
          ],
        },
      ],
    },
  ],
  decisions: [],
}

const block = (page: Page) => page.locator('section#walk figure')
const hunk = (page: Page, name: string) => block(page).getByRole('button', { name })
const shownNodes = (page: Page) =>
  block(page)
    .locator('[data-node]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-node')))

test.describe('walkthrough block', () => {
  test.beforeEach(async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    await expect(block(page).locator('pre.shiki')).toHaveCount(1)
  })

  test('a step, Enter on a step, and Next and Previous draw the flow up to that step', async ({
    page,
  }) => {
    await expect(block(page)).toContainText('src/limiter.ts / handle()')
    await expect(block(page)).toContainText('hunk 1 / 4')
    expect(await shownNodes(page)).toEqual(['req', 'key'])

    await hunk(page, '02 Ask for one token').click()
    await expect(hunk(page, '02 Ask for one token')).toHaveAttribute('aria-pressed', 'true')
    await expect(block(page)).toContainText('hunk 2 / 4')
    expect(await shownNodes(page)).toEqual(['req', 'key', 'ok'])

    await hunk(page, '03 Out of tokens, reply 429').focus()
    await page.keyboard.press('Enter')
    await expect(block(page)).toContainText('hunk 3 / 4')
    expect(await shownNodes(page)).toEqual(['req', 'key', 'ok', 'deny'])

    await block(page).getByRole('button', { name: 'Next hunk' }).click()
    await expect(block(page)).toContainText('hunk 4 / 4')
    await expect(block(page).getByRole('button', { name: 'Next hunk' })).toBeEnabled()
    await block(page).getByRole('button', { name: 'Next hunk' }).click()
    await expect(block(page)).toContainText('hunk 4 / 4')
    expect(await shownNodes(page)).toEqual(['req', 'key', 'ok', 'deny', 'fwd'])

    await block(page).getByRole('button', { name: 'Previous hunk' }).click()
    await expect(block(page)).toContainText('hunk 3 / 4')
  })

  test('code and flow sit side by side from 880 and stack below it', async ({ page, isMobile }) => {
    const code = await block(page).locator('pre').boundingBox()
    const flow = await block(page).locator('[data-flow]').boundingBox()
    if (!code || !flow) throw new Error('walkthrough panes are not laid out')
    if (isMobile) {
      expect(flow.y).toBeGreaterThanOrEqual(code.y + code.height)
      for (const name of ['Previous hunk', 'Next hunk']) {
        const box = await block(page).getByRole('button', { name }).boundingBox()
        expect(box?.width).toBe(44)
        expect(box?.height).toBe(44)
      }
    } else {
      expect(flow.x).toBeGreaterThanOrEqual(code.x + code.width)
      expect(Math.abs(flow.y - code.y)).toBeLessThan(40)
    }
  })

  test('the listing copies exactly, blank line included and captions left out', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'a selection and Ctrl+C are desktop gestures; a phone renders the same rows')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await block(page)
      .locator('pre code')
      .evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        getSelection()?.removeAllRanges()
        getSelection()?.addRange(range)
      })
    await page.keyboard.press('ControlOrMeta+c')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE)
  })

  test('a node pops in and an edge draws in, and reduced motion drops both', async ({ page }) => {
    const animation = (selector: string) =>
      block(page)
        .locator(selector)
        .first()
        .evaluate((el) => getComputedStyle(el).animationName)
    expect(await animation('[data-node="key"]')).toBe('wt-pop')
    expect(await animation('[data-edge]')).toBe('console-in')
    expect(await animation('[data-edge] > path:first-child')).toBe('wt-dash')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await hunk(page, '02 Ask for one token').click()
    expect(await animation('[data-node="ok"]')).toBe('none')
    expect(await animation('[data-edge] > path:first-child')).toBe('none')
  })

  test('the flow fits its pane on desktop and a step scrolls its node into view on a phone', async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 })
    await hunk(page, '03 Out of tokens, reply 429').click()
    const pane = block(page).locator('[data-flow]').locator('..')
    const fit = await pane.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    const deny = await block(page).locator('[data-node="deny"]').boundingBox()
    const paneBox = await pane.boundingBox()
    if (!deny || !paneBox) throw new Error('flow is not laid out')
    if (isMobile) {
      expect(deny.x).toBeGreaterThanOrEqual(paneBox.x)
      expect(deny.x + deny.width).toBeLessThanOrEqual(paneBox.x + paneBox.width)
    } else {
      expect(fit.scroll).toBeLessThanOrEqual(fit.client)
      // Layout units, not boundingBox: the node pop scales the box while it plays.
      const [gap, width] = await block(page)
        .locator('[data-node="deny"]')
        .evaluate((el) => [
          (el as HTMLElement).offsetLeft - (el.parentElement!.querySelector('[data-node="ok"]') as HTMLElement).offsetLeft,
          (el as HTMLElement).offsetWidth,
        ])
      expect(gap).toBe(290)
      expect(width).toBe(170)
    }
  })

  test('a toned branch draws its edge, label and node in the tone and an untoned edge stays faint', async ({
    page,
  }) => {
    await hunk(page, '03 Out of tokens, reply 429').click()
    const token = (name: string) =>
      page.evaluate((v) => {
        const probe = document.body.appendChild(document.createElement('i'))
        probe.style.color = `var(${v})`
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      }, name)
    const edge = (i: number) =>
      block(page)
        .locator('[data-edge]')
        .nth(i)
        .evaluate((el) => [getComputedStyle(el.children[0]!).stroke, getComputedStyle(el.children[1]!).fill])
    const bad = await token('--c-bad')
    const faint = await token('--c-faint')
    expect(bad).not.toBe(faint)
    expect(await edge(2)).toEqual([bad, bad])
    expect(await edge(0)).toEqual([faint, faint])
    await expect(block(page).locator('[data-flow] > span', { hasText: /^no$/ })).toHaveCSS('color', bad)
    await expect(block(page).locator('[data-node="deny"]')).toHaveCSS('background-color', bad)
  })

  test('print draws the whole flow, not only the steps up to the current one', async ({ page }) => {
    const drawn = () =>
      block(page)
        .locator('[data-flow] > div, [data-flow] > span, [data-flow] [data-edge]')
        .evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== 'none').length)
    // Screen: 2 nodes and 1 edge. Print: 5 nodes, 2 edge labels and 4 edges.
    expect(await drawn()).toBe(3)
    await page.emulateMedia({ media: 'print' })
    expect(await drawn()).toBe(11)
  })
})

for (const width of [388, 879]) {
  test(`at ${width}x700 Previous hunk and Next hunk are the hit target at their centre`, async ({
    page,
    createSession,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    await expect(block(page).locator('pre.shiki')).toHaveCount(1)
    for (const name of ['Previous hunk', 'Next hunk']) {
      const button = hunk(page, name)
      await button.scrollIntoViewIfNeeded()
      const box = (await button.boundingBox())!
      const hit = await button.evaluate((el, { x, y }) => el.contains(document.elementFromPoint(x, y)), {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      })
      expect(hit).toBe(true)
    }
  })
}
