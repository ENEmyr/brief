import type { Page } from '@playwright/test'
import type { Payload } from '@brief/schema'
import { test, expect } from './fixtures'

const XSS = '<img src=x onerror="window.__xss=1">'
const FIRST = 'ระบบใช้ token bucket แทน fixed window. A second token bucket stays plain, and `p95` in code is not a term.'
const HOW = 'Each bucket (an alias) is per key.'
const FILLER = Array.from({ length: 12 }, (_, i) => ({ type: 'p' as const, text: `Filler paragraph ${i + 1} keeps the next section below the fold.` }))

const payload: Payload = {
  meta: { title: 'Glossary' },
  sections: [
    { id: 'why', no: 1, title: 'Why', blocks: [{ type: 'p', text: FIRST }, { type: 'p', text: 'Latency at p95 rose to 2.4 s.' }, ...FILLER] },
    { id: 'how', no: 2, title: 'How', blocks: [{ type: 'p', text: HOW }] },
    { id: 'xss', no: 3, title: 'Unsafe', blocks: [{ type: 'p', text: `The ${XSS} term renders as text.` }] },
  ],
  decisions: [
    { id: 'D1', q: 'Keep the token bucket?', multi: false, opts: [{ id: 'a', label: 'Yes' }, { id: 'b', label: 'No' }] },
  ],
  glossary: [
    { term: 'token bucket', def: 'A counter that refills at a fixed rate.', aliases: ['bucket'] },
    { term: 'p95', def: 'The 95th percentile.' },
    { term: XSS, def: '<script>window.__xss=2</script>' },
  ],
}

const FIRST_P = '[data-hl][data-sid="0"][data-bid="0"]'
const HOW_P = '[data-hl][data-sid="1"][data-bid="0"]'

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

for (const theme of ['dark', 'light'] as const) {
  test(`first use per section is underlined dashed in the info color (${theme})`, async ({ page, createSession }) => {
    await page.addInitScript((t) => localStorage.setItem('idocs:theme', t), theme)
    const { id } = await createSession(payload)
    await page.goto(`/s/${id}`)
    const first = page.locator(FIRST_P)
    await expect(first).toHaveJSProperty('textContent', FIRST)
    await expect(first.locator('[data-term]')).toHaveText(['token bucket'])
    await expect(page.locator('[data-hl][data-sid="0"][data-bid="1"] [data-term]')).toHaveText(['p95'])
    await expect(page.locator(HOW_P).locator('[data-term]')).toHaveText(['bucket'])
    const style = await first.locator('[data-term]').evaluate((el) => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--c-info)'
      document.body.append(probe)
      const info = getComputedStyle(probe).color
      probe.remove()
      const s = getComputedStyle(el)
      return { style: s.borderBottomStyle, width: s.borderBottomWidth, color: s.borderBottomColor, info }
    })
    expect(style).toEqual({ style: 'dashed', width: '1px', color: style.info, info: style.info })
  })
}

test('hover and keyboard focus show the definition and its uses; links jump', async ({ page, createSession, isMobile }) => {
  test.skip(isMobile, 'hover and Tab are desktop input')
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  const term = page.locator(FIRST_P).locator('[data-term="1"]')
  await term.hover()
  const tip = page.locator('[data-glossary-tip="1"]')
  await expect(tip).toHaveText('token bucket§01§02D1A counter that refills at a fixed rate.')
  await page.mouse.move(0, 0)
  await expect(tip).toHaveCount(0)

  await term.focus()
  await expect(tip).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(tip.getByRole('button', { name: '§01' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(tip).toHaveCount(0)
  await expect(term).toBeFocused()

  await term.click()
  await tip.getByRole('button', { name: '§02' }).click()
  await expect(tip).toHaveCount(0)
  await expect(page.locator('main [data-section="how"]')).toBeInViewport()
})

test('tap opens the definition and a second tap closes it', async ({ page, createSession, isMobile }) => {
  test.skip(!isMobile, 'touch input')
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  const term = page.locator(FIRST_P).locator('[data-term="1"]')
  await term.tap()
  const tip = page.locator('[data-glossary-tip="1"]')
  await expect(tip).toBeVisible()
  const box = await tip.boundingBox()
  expect(box && box.x >= 16 && box.x + box.width <= (page.viewportSize()?.width ?? 0) - 16).toBe(true)
  await term.tap()
  await expect(tip).toHaveCount(0)
})

test('a highlight across a term draws on the selection, survives reload, and copy gives the visible text', async ({
  page,
  createSession,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse drag selection')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  const how = page.locator(HOW_P)

  await dragBetween(page, HOW_P, 'Each', 'alias')
  await page.keyboard.press('ControlOrMeta+c')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Each bucket (an alias')
  // A press inside a live selection drags it instead of starting a new one.
  await page.evaluate(() => window.getSelection()?.removeAllRanges())

  await dragBetween(page, HOW_P, 'Each', 'bucket')
  await page.getByRole('button', { name: 'Note' }).click()
  await page.getByPlaceholder('Write a short note…').fill('across a term')
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  const check = async () => {
    await expect(how).toHaveJSProperty('textContent', HOW)
    const noted = await how.locator('mark[data-marker="note"]').getAttribute('data-mark-id')
    await expect(how.locator(`mark[data-mark-id="${noted}"]`)).toHaveText(['Each ', 'bucket'])
    await expect(how.locator('[data-term] mark[data-marker="note"]')).toHaveText('bucket')
  }
  await check()
  await page.reload()
  await check()
})

test('payload text in a term and its definition stays text', async ({ page, createSession, isMobile }) => {
  test.skip(isMobile, 'same render on both projects')
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  const term = page.locator('[data-hl][data-sid="2"][data-bid="0"] [data-term="3"]')
  await expect(term).toHaveText(XSS)
  await term.click()
  await expect(page.locator('[data-glossary-tip="3"]')).toContainText('<script>window.__xss=2</script>')
  await expect(page.locator('main img, [data-glossary-tip] script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
})

test('print numbers each term and lists the Terms', async ({ page, createSession, isMobile }) => {
  test.skip(isMobile, 'print is one layout')
  const { id } = await createSession(payload)
  await page.goto(`/s/${id}`)
  await page.emulateMedia({ media: 'print' })
  const term = page.locator(FIRST_P).locator('[data-term="1"]')
  expect(await term.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"1"')
  expect(await term.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')
  const terms = page.locator('[data-print-terms]')
  await expect(terms.getByRole('heading', { name: 'Terms' })).toBeVisible()
  await expect(terms.locator('dt')).toHaveText(['1 token bucket', '2 p95', `3 ${XSS}`])
})
