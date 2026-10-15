import type { Locator, Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const STEPS = ['Read the bucket for this key', 'Take one token', 'Forward the request']
const RISKS = ['Batch webhooks may hit 429 during a burst', 'If the limiter fails, pick fail open or fail closed']
const XSS = '<img src=x onerror="window.__xss=1">'

const payload: Payload = {
  meta: { title: 'Lists' },
  sections: [
    {
      id: 'lists',
      no: 1,
      title: 'Lists',
      blocks: [
        { type: 'list', ordered: true, caption: 'Rollout', items: STEPS },
        { type: 'list', items: RISKS },
        { type: 'list', caption: XSS, items: [XSS] },
      ],
    },
  ],
  decisions: [],
}

function item(page: Page, bid: number, index: number): Locator {
  return page.locator(`section#lists li[data-bid="${bid}"][data-path="items.${index}"]`)
}

/** SelectionToolbar opens on a document mouseup over a live selection. */
async function selectChars(leaf: Locator, start: number, end: number): Promise<string> {
  const selected = await leaf.evaluate(
    (el, [from, to]) => {
      const text = el.firstChild
      if (!text) throw new Error('item text node not found')
      const range = document.createRange()
      range.setStart(text, from)
      range.setEnd(text, to)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(range)
      return getSelection()?.toString() ?? ''
    },
    [start, end] as const,
  )
  await leaf.dispatchEvent('mouseup')
  return selected
}

test.describe('list block', () => {
  test.beforeEach(async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    await expect(page.locator('section#lists figure ol, section#lists figure ul')).toHaveCount(3)
  })

  test('draws numbered and bulleted lists in block cards, and prints their markers', async ({ page }) => {
    const ordered = page.locator('section#lists figure ol')
    const bulleted = page.locator('section#lists figure ul').first()
    await expect(ordered.locator('li')).toHaveText(STEPS)
    await expect(bulleted.locator('li')).toHaveText(RISKS)
    await expect(page.locator('section#lists figure').first().locator('[data-kind-tag]')).toHaveText('list')
    await expect(page.locator('section#lists figure').first()).toContainText('Rollout')

    await page.emulateMedia({ media: 'print' })
    const markers = await page.evaluate(() =>
      [...document.querySelectorAll('section#lists figure :is(ol, ul)')].map((list) => ({
        tag: list.tagName,
        marker: getComputedStyle(list).listStyleType,
        item: getComputedStyle(list.querySelector('li')!).display,
      })),
    )
    expect(markers).toEqual([
      { tag: 'OL', marker: 'decimal', item: 'list-item' },
      { tag: 'UL', marker: 'disc', item: 'list-item' },
      { tag: 'UL', marker: 'disc', item: 'list-item' },
    ])
  })

  test('prints markup in a caption or an item as text', async ({ page }) => {
    const figure = page.locator('section#lists figure').nth(2)
    await expect(figure.locator('li')).toHaveText(XSS)
    await expect(figure).toContainText(XSS)
    await expect(figure.locator('img')).toHaveCount(0)
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
  })

  test('an item takes a highlight and a note like paragraph text', async ({ page }) => {
    const first = item(page, 0, 1)
    const selected = await selectChars(first, 5, 10)
    expect(selected).toBe('one t')
    await page.getByRole('button', { name: 'Highlight' }).click()
    await expect(first.locator('mark')).toHaveText('one t')

    const risk = item(page, 1, 0)
    await selectChars(risk, 0, 14)
    await page.getByRole('button', { name: 'Note' }).click()
    await page.getByPlaceholder('Write a short note…').fill('which clients')
    await page.getByRole('button', { name: 'Done' }).click()
    const mark = risk.locator('mark')
    await expect(mark.locator('sup')).toHaveCount(1)
    expect(
      await mark.evaluate((m) =>
        [...m.childNodes]
          .filter((n) => n.nodeName !== 'SUP')
          .map((n) => n.textContent)
          .join(''),
      ),
    ).toBe('Batch webhooks')
  })

  test('copying a whole list gives its items as plain text', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Ctrl+C is a desktop gesture; a phone renders the same items')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const copies: string[] = []
    for (const list of await page.locator('section#lists figure :is(ol, ul)').all()) {
      await list.evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        getSelection()?.removeAllRanges()
        getSelection()?.addRange(range)
      })
      await page.keyboard.press('ControlOrMeta+c')
      copies.push(await page.evaluate(() => navigator.clipboard.readText()))
    }
    expect(copies).toEqual([STEPS.join('\n'), RISKS.join('\n'), XSS])
  })
})
