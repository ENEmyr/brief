import type { Locator, Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const FUNCTION = 'def f():\n    x = 1\n\n\n    return x\n'
/** Blank lines inside, before and after the code. */
const CODES = [FUNCTION, 'a\n\n\nb', '\n\nlead', 'x\n\n']

const payload: Payload = {
  meta: { title: 'Code copy' },
  sections: [
    {
      id: 'code',
      no: 1,
      title: 'Code',
      blocks: CODES.map((code) => ({ type: 'code', language: 'python', code })),
    },
  ],
  decisions: [],
}

function leaf(page: Page, bid: number, line: number): Locator {
  return page.locator(`section#code [data-bid="${bid}"][data-path="code.${line}"]`)
}

async function copySelection(page: Page): Promise<string> {
  await page.keyboard.press('ControlOrMeta+c')
  return page.evaluate(() => navigator.clipboard.readText())
}

/** Where character `index` of a code line starts; the code font is monospace. */
async function charPoint(line: Locator, index: number) {
  const length = ((await line.textContent()) ?? '').length
  const box = await line.boundingBox()
  if (!box) throw new Error('code line is not laid out')
  return { x: box.x + (box.width / length) * index + 1, y: box.y + box.height / 2 }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
}

test.describe('copying code', () => {
  test.beforeEach(async ({ page, createSession, isMobile }) => {
    test.skip(
      isMobile,
      'a mouse drag and Ctrl+C are desktop gestures; a phone renders the same rows',
    )
    const { id } = await createSession(payload)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/s/${id}`)
    await expect(page.locator('section#code pre.shiki')).toHaveCount(CODES.length)
  })

  test('a range over every row copies the code exactly, blank lines included', async ({ page }) => {
    const panels = page.locator('section#code pre code')
    for (const [i, code] of CODES.entries()) {
      await panels.nth(i).evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        getSelection()?.removeAllRanges()
        getSelection()?.addRange(range)
      })
      expect(await copySelection(page)).toBe(code)
    }
  })

  test('a mouse drag across blank rows copies what it covers', async ({ page }) => {
    await drag(page, await charPoint(leaf(page, 0, 1), 4), await charPoint(leaf(page, 0, 4), 10))
    expect(await copySelection(page)).toBe('x = 1\n\n\n    return')

    await page.evaluate(() => getSelection()?.removeAllRanges())
    await drag(page, await charPoint(leaf(page, 1, 0), 0), await charPoint(leaf(page, 1, 3), 1))
    expect(await copySelection(page)).toBe('a\n\n\nb')
  })

  test('a highlight and a note on rows after blank lines mark the selected characters', async ({
    page,
  }) => {
    const ret = leaf(page, 0, 4)
    await drag(page, await charPoint(ret, 4), await charPoint(ret, 12))
    await page.getByRole('button', { name: 'Highlight' }).click()
    await expect(ret.locator('mark')).toHaveText('return x')

    const assign = leaf(page, 0, 1)
    await drag(page, await charPoint(assign, 4), await charPoint(assign, 9))
    await page.getByRole('button', { name: 'Note' }).click()
    await page.getByPlaceholder('Write a short note…').fill('why one')
    await page.getByRole('button', { name: 'Done' }).click()
    const mark = assign.locator('mark')
    await expect(mark.locator('sup')).toHaveCount(1)
    expect(
      await mark.evaluate((m) =>
        [...m.childNodes]
          .filter((n) => n.nodeName !== 'SUP')
          .map((n) => n.textContent)
          .join(''),
      ),
    ).toBe('x = 1')
  })
})
