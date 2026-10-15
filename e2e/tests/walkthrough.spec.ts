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
              { id: 'deny', label: 'Reply 429', kind: 'end' },
              { id: 'fwd', label: 'Forward to origin', kind: 'end' },
            ],
            edges: [
              { from: 'req', to: 'key' },
              { from: 'key', to: 'ok' },
              { from: 'ok', to: 'deny', label: 'no' },
              { from: 'ok', to: 'fwd', label: 'yes' },
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
    await expect(block(page).getByRole('button', { name: 'Next hunk' })).toBeDisabled()
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
})
