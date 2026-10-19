import type { Locator, Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const CODE = [
  'export async function handle(req, env) {',
  '  const key = resolveKey(req)',
  '  const { success } = await env.LIMITER.limit({ key })',
  '  if (!success) return tooMany(30)',
  '  return fetch(origin(req))',
  '}',
].join('\n')
const XSS = '<img src=x onerror="window.__xss=1">'

const payload: Payload = {
  meta: { title: 'Code notes' },
  sections: [
    {
      id: 'notes',
      no: 1,
      title: 'Notes',
      blocks: [
        {
          type: 'code',
          language: 'typescript',
          code: CODE,
          notes: [
            { from: 2, text: 'API key first, IP only as a fallback' },
            { from: 3, to: 4, text: 'Out of tokens answers 429 without touching origin' },
            { from: 7, text: 'past the last line' },
            { from: 5, to: 2, text: 'backwards range' },
            { from: 6, text: XSS },
          ],
        },
        {
          type: 'ba',
          language: 'typescript',
          before: 'export async function handle(req) {\n  return fetch(req.url)\n}',
          after: CODE,
          notes: [{ side: 'after', from: 2, text: 'env carries the binding' }],
        },
      ],
    },
  ],
  decisions: [],
}

function code(page: Page): Locator {
  return page.locator('section#notes figure').first()
}

function diamond(page: Page, range: string): Locator {
  return code(page).locator(`button[data-code-note="${range}"]`)
}

function leaf(page: Page, line: number): Locator {
  return code(page).locator(`[data-hl][data-path="code.${line}"]`)
}

async function selectAll(page: Page) {
  await code(page)
    .locator('pre code')
    .evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(range)
    })
  await page.keyboard.press('ControlOrMeta+c')
  return page.evaluate(() => navigator.clipboard.readText())
}

async function charPoint(line: Locator, index: number) {
  const length = ((await line.textContent()) ?? '').length
  const box = await line.boundingBox()
  if (!box) throw new Error('code line is not laid out')
  return { x: box.x + (box.width / length) * index + 1, y: box.y + box.height / 2 }
}

test.describe('agent notes on code', () => {
  test.beforeEach(async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    await expect(code(page).locator('pre.shiki')).toHaveCount(1)
  })

  test('a diamond ends each noted line and invalid notes draw nothing', async ({ page }) => {
    await expect(code(page).locator('button[data-code-note]')).toHaveCount(3)
    await expect(diamond(page, 'L2').locator('span[aria-hidden]')).toHaveText('\u25C6')
    await expect(diamond(page, 'L3-4')).toBeVisible()
    await expect(page.getByText('past the last line')).toHaveCount(0)
    await expect(page.getByText('backwards range')).toHaveCount(0)
    const row = diamond(page, 'L3-4').locator('xpath=..')
    await expect(row.locator('[data-path="code.3"]')).toHaveCount(1)
  })

  test('hovering the line shows the note as ghost text', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is a pointer gesture; a tap pins instead')
    const ghost = diamond(page, 'L2').locator('[data-code-note-ghost]')
    await expect(ghost).toBeHidden()
    await leaf(page, 1).hover()
    await expect(ghost).toBeVisible()
    await expect(ghost).toHaveText('API key first, IP only as a fallback')
  })

  test('a click pins the note under the line and a second click unpins it', async ({ page }) => {
    const button = diamond(page, 'L3-4')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(button.locator('span[aria-hidden]')).toHaveText('\u25C6 note')
    const pinned = code(page).locator('[data-code-note-pinned="L3-4"]')
    await expect(pinned).toHaveText('AGENT / L3-4Out of tokens answers 429 without touching origin')
    // The note enters with console-pop, which starts 6px high: measure it once it settles.
    await pinned.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const rowBox = await button.locator('xpath=..').boundingBox()
    const pinnedBox = await pinned.boundingBox()
    expect(pinnedBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height)
    await button.click()
    await expect(pinned).toHaveCount(0)
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('Tab reaches the diamond, focus shows the ghost, Enter pins and Escape unpins', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Tab and Escape are keyboard gestures')
    await code(page).locator('pre').focus()
    await page.keyboard.press('Tab')
    const button = diamond(page, 'L2')
    await expect(button).toBeFocused()
    await expect(button.locator('[data-code-note-ghost]')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(code(page).locator('[data-code-note-pinned="L2"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(code(page).locator('[data-code-note-pinned="L2"]')).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test('note text renders as text only', async ({ page }) => {
    await diamond(page, 'L6').click()
    await expect(code(page).locator('[data-code-note-pinned="L6"]')).toContainText(XSS)
    await expect(code(page).locator('img')).toHaveCount(0)
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
  })

  test('a before/after note sits on its own side', async ({ page }) => {
    const ba = page.locator('section#notes figure').nth(1)
    const button = ba.locator('button[data-code-note="L2"]')
    await expect(button).toHaveCount(1)
    await expect(button.locator('xpath=..').locator('[data-path="after.1"]')).toHaveCount(1)
    await button.click()
    await expect(ba.locator('[data-code-note-pinned="L2"]')).toContainText('env carries the binding')
  })
})

test.describe('agent notes on code, reader marks and copy', () => {
  test.beforeEach(async ({ page, createSession, isMobile }) => {
    test.skip(isMobile, 'a mouse drag and Ctrl+C are desktop gestures')
    const { id } = await createSession(payload)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/s/${id}`)
    await expect(code(page).locator('pre.shiki')).toHaveCount(1)
  })

  test('copying the code gives the code exactly, with notes pinned and hovered', async ({ page }) => {
    await diamond(page, 'L3-4').click()
    await diamond(page, 'L6').click()
    await leaf(page, 1).hover()
    expect(await selectAll(page)).toBe(CODE)
  })

  test('a highlight and a reader note on a noted line mark the selected characters', async ({
    page,
  }) => {
    const line = leaf(page, 1)
    await page.mouse.move(0, 0)
    const from = await charPoint(line, 8)
    const to = await charPoint(line, 11)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 10 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Note', exact: true }).click()
    await page.getByPlaceholder('Write a short note…').fill('why the key')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    const mark = line.locator('mark')
    await expect(mark).toHaveAttribute('data-marker', 'note')
    expect(await mark.textContent()).toBe('key')
    await diamond(page, 'L2').click()
    expect(await mark.textContent()).toBe('key')
    expect(await selectAll(page)).toBe(CODE)
  })
})

test('at 388 a tap on the line above a diamond lands on that line, not on the diamond', async ({
  page,
  createSession,
}) => {
  // d127: the 44 px chip's -my-2.5 reaches 10 px into the row above, so this fails today.
  // shortcut: remove test.fail when the board settles taller rows or a smaller target under 880.
  test.fail()
  await page.setViewportSize({ width: 388, height: 900 })
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  const chip = diamond(page, 'L2')
  await chip.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = (await chip.boundingBox())!
  const above = (await leaf(page, 0).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  // The probe is the bottom pixel of the row above, under the chip's centre.
  const probe = { x: box.x + box.width / 2, y: above.y + above.height - 1 }
  const inChip = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('button[data-code-note]'),
    probe,
  )
  expect(inChip).toBe(false)
})
