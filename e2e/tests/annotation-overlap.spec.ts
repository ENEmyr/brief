import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const PARAGRAPH = 'Run `npm ci` before **every deploy** so *nothing* drifts.'
const ITEM = 'Pin **bun** and run `bun ci` *first*'

const payload: Payload = {
  meta: { title: 'Annotation overlap', author: 'QA Bot', version: 'v1' },
  sections: [
    {
      id: 'ov',
      no: 1,
      title: 'Overlap',
      blocks: [
        { type: 'p', text: PARAGRAPH },
        { type: 'list', items: [ITEM] },
      ],
    },
  ],
  decisions: [],
}

const P = '[data-hl][data-sid="0"][data-bid="0"]'

/** Drags from the start of `from` to the end of `to` with the mouse. */
async function dragBetween(page: Page, from: string, to: string): Promise<void> {
  const leaf = page.locator(P)
  await leaf.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = await leaf.evaluate(
    (el, [a, b]) => {
      const rectOf = (needle: string, edge: 'left' | 'right') => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement?.closest('[hidden]')) continue
          const at = node.textContent?.indexOf(needle) ?? -1
          if (at < 0) continue
          const range = document.createRange()
          range.setStart(node, at)
          range.setEnd(node, at + needle.length)
          const rect = range.getBoundingClientRect()
          return { x: rect[edge], y: (rect.top + rect.bottom) / 2 }
        }
        throw new Error(`"${needle}" is not in the leaf`)
      }
      return { start: rectOf(a, 'left'), end: rectOf(b, 'right') }
    },
    [from, to] as const,
  )
  await page.mouse.move(box.start.x + 1, box.start.y)
  await page.mouse.down()
  await page.mouse.move(box.end.x - 1, box.end.y, { steps: 10 })
  await page.mouse.up()
}

async function addNote(page: Page, note: string): Promise<void> {
  await page.getByRole('button', { name: 'Note' }).click()
  await page.getByPlaceholder('Write a short note…').fill(note)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
}

test.describe('nested and overlapping annotations', () => {
  test('a highlight and a note inside an earlier highlight keep their own marks after reload', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const p = page.locator(P)

    await dragBetween(page, 'before', 'drifts')
    await page.getByRole('button', { name: 'Highlight', exact: true }).click()
    await expect(p.locator('mark')).not.toHaveCount(0)

    await dragBetween(page, 'deploy', 'deploy')
    await addNote(page, 'inner note')
    await dragBetween(page, 'nothing', 'nothing')
    await page.getByRole('button', { name: 'Highlight', exact: true }).click()

    const check = async () => {
      await expect(p.locator('mark[data-marker="note"]')).toHaveText('deploy')
      const ids = await p
        .locator('mark')
        .evaluateAll((marks) => [...new Set(marks.map((m) => m.getAttribute('data-mark-id')))])
      expect(ids).toHaveLength(3)
      await expect(p.locator('em mark')).toHaveText('nothing')
      const inner = await p.locator('em mark').getAttribute('data-mark-id')
      expect(ids.indexOf(inner)).toBe(2)
      await expect(p).toHaveJSProperty('textContent', PARAGRAPH)
    }
    await check()
    await page.reload()
    await check()
  })

  test('a stored highlight on a lone marker character still draws', async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await page.addInitScript((key) => {
      if (localStorage.getItem(key)) return
      localStorage.setItem(
        key,
        JSON.stringify({
          highlights: [
            { id: 'h-tick', sid: 0, bid: 0, path: 'text', start: 4, end: 5, text: '`', note: 'tick' },
          ],
          dsel: {},
          dnote: {},
        }),
      )
    }, `idocs:${id}`)
    await page.goto(`/s/${id}`)
    const mark = page.locator(P).locator('mark[data-mark-id="h-tick"]')
    await expect(mark).toBeVisible()
    await expect(mark).toHaveText('`')
    await expect(mark).toHaveAttribute('data-marker', 'note')
    await expect(page.locator(P)).toHaveJSProperty('textContent', PARAGRAPH)
  })

  test('copy across a note mark carries no marker glyph', async ({ page, createSession }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)

    await dragBetween(page, 'before', 'every')
    await addNote(page, 'across bold')
    await expect(page.locator(P).locator('mark[data-marker="note"]')).toHaveText('every')

    await dragBetween(page, 'Run', 'drifts')
    await page.keyboard.press('ControlOrMeta+c')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Run npm ci before every deploy so nothing drifts')
  })

  test('list items render inline markdown and keep source offsets', async ({ page, createSession }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const li = page.locator('section#ov li[data-bid="1"][data-path="items.0"]')
    await expect(li.locator('strong')).toHaveJSProperty('innerText', 'bun')
    await expect(li.locator('code')).toHaveJSProperty('innerText', 'bun ci')
    await expect(li.locator('em')).toHaveJSProperty('innerText', 'first')
    await expect(li).toHaveJSProperty('innerText', 'Pin bun and run bun ci first')
    await expect(li).toHaveJSProperty('textContent', ITEM)
  })
})
