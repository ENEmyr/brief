import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect, API_URL } from './fixtures'

const PARAGRAPH =
  'Run `npm ci` before **every deploy** so *nothing* drifts, and a lone `tick stays.'
const CALLOUT_TITLE = 'Pin `bun`'
const CALLOUT_TEXT = 'Use **bun 1.3.6** with `--frozen-lockfile` in CI.'
const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'
const XSS_TEXT = `${XSS} \`${XSS}\` **${XSS}** *${XSS}* \`${XSS} **${XSS}`

const payload: Payload = {
  meta: { title: 'Inline markdown', author: 'QA Bot', version: 'v1' },
  sections: [
    {
      id: 'md',
      no: 1,
      title: 'Markdown',
      blocks: [
        { type: 'p', text: PARAGRAPH },
        { type: 'note', title: CALLOUT_TITLE, text: CALLOUT_TEXT },
        { type: 'p', text: XSS_TEXT },
      ],
    },
  ],
  decisions: [],
}

const P = '[data-hl][data-sid="0"][data-bid="0"]'
const CALLOUT = '[data-hl][data-sid="0"][data-bid="1"][data-path="text"]'

/** Drags from the start of `from` to the end of `to`; the two may sit in
 * different text nodes, which is how a selection crosses a run. */
async function dragBetween(page: Page, selector: string, from: string, to: string): Promise<void> {
  const leaf = page.locator(selector)
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

function stored(page: Page, id: string) {
  return page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      highlights?: {
        start: number
        end: number
        text: string
        note: string | null
        question?: string
      }[]
    }
    return (s.highlights ?? []).map(({ start, end, text, note, question }) => ({
      start,
      end,
      text,
      note,
      question,
    }))
  }, `idocs:${id}`)
}

test.describe('inline markdown', () => {
  test('prose and callouts render code, bold and italic; the rest stays literal text', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const p = page.locator(P)
    await expect(p.locator('code')).toHaveText('`npm ci`')
    await expect(p.locator('strong')).toHaveText('**every deploy**')
    await expect(p.locator('em')).toHaveText('*nothing*')
    await expect(p).toHaveJSProperty(
      'innerText',
      'Run npm ci before every deploy so nothing drifts, and a lone `tick stays.',
    )

    await expect(page.locator('[data-hl][data-bid="1"][data-path="title"] code')).toHaveJSProperty(
      'innerText',
      'bun',
    )
    await expect(page.locator(CALLOUT).locator('strong')).toHaveJSProperty('innerText', 'bun 1.3.6')
    await expect(page.locator(CALLOUT).locator('code')).toHaveJSProperty(
      'innerText',
      '--frozen-lockfile',
    )

    const xss = page.locator('[data-hl][data-sid="0"][data-bid="2"]')
    await expect(xss).toHaveJSProperty('textContent', XSS_TEXT)
    await expect(xss.locator('img, script')).toHaveCount(0)
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
  })

  test('highlight, note and ask inside and across runs draw on the selection and survive reload', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const p = page.locator(P)

    await dragBetween(page, P, 'npm', 'npm')
    await page.getByRole('button', { name: 'Highlight' }).click()

    await dragBetween(page, P, 'before', 'every')
    await page.getByRole('button', { name: 'Note' }).click()
    await page.getByPlaceholder('Write a short note…').fill('across bold')
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    await dragBetween(page, CALLOUT, 'with', 'frozen')
    await page.getByRole('button', { name: 'Ask' }).click()
    await page.getByPlaceholder('Type a question about this part…').fill('why frozen')
    await page.keyboard.press('Escape')

    const expected = [
      { start: 5, end: 8, text: 'npm', note: null, question: undefined },
      { start: 13, end: 27, text: 'before **every', note: 'across bold', question: undefined },
      { start: 18, end: 32, text: 'with `--frozen', note: null, question: 'why frozen' },
    ]
    const check = async () => {
      await expect(p.locator('code mark')).toHaveText('npm')
      await expect(p.locator('mark[data-marker="note"]')).toHaveText('every')
      const noted = await p.locator('mark[data-marker="note"]').getAttribute('data-mark-id')
      await expect(p.locator(`mark[data-mark-id="${noted}"]`)).toHaveText(['before ', 'every'])
      await expect(page.locator(CALLOUT).locator('mark')).toHaveText(['with ', '--frozen'])
      await expect(page.locator(CALLOUT).locator('code mark')).toHaveText('--frozen')
    }
    await check()
    await expect.poll(() => stored(page, id)).toEqual(expected)
    await page.reload()
    await check()
  })

  test('a highlight stored before markdown rendered still draws on its characters', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession(payload)
    // Written when the leaf showed its source, so offsets count the backticks.
    await page.addInitScript((key) => {
      if (localStorage.getItem(key)) return
      localStorage.setItem(
        key,
        JSON.stringify({
          highlights: [
            {
              id: 'h-old',
              sid: 0,
              bid: 0,
              path: 'text',
              start: 4,
              end: 12,
              text: '`npm ci`',
              note: null,
            },
          ],
          dsel: {},
          dnote: {},
        }),
      )
    }, `idocs:${id}`)
    await page.goto(`/s/${id}`)
    await expect(page.locator(P).locator('code mark[data-mark-id="h-old"]')).toHaveText('npm ci')
  })

  test('copy gives the visible text and /raw keeps the source', async ({
    page,
    createSession,
    request,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)

    await dragBetween(page, P, 'Run', 'deploy')
    await page.keyboard.press('ControlOrMeta+c')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Run npm ci before every deploy')

    await page.evaluate(() => navigator.clipboard.writeText(''))
    await page.getByRole('button', { name: 'Copy' }).click()
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Run npm ci before every deploy')

    const raw = await (await request.get(`${API_URL}/api/session/${id}/raw`)).text()
    expect(raw).toContain(PARAGRAPH)
    expect(raw).toContain(CALLOUT_TEXT)
  })
})
