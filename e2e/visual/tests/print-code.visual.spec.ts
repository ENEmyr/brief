import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { VISUAL_API_URL } from '../visual.config'
import { expectComputed } from '../lib/geometry'
import { expect, openReader, serveSession, test } from '../lib/session'

// Print and screen geometry of code listings, code notes, lists and images
// (B-Print:53-82). Computed-style and box assertions, no reference images.
const fixture = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'fixtures', file), 'utf8'))
const printSeed = fixture('print-state.seed.json')

const CODE = [
  'export async function take(key: string) {',
  '  const b = await bucket(key)',
  '  if (b.tokens < 1) return deny(b.resetAt)',
  '  b.tokens -= 1',
  '  return allow(b.tokens) // ' + 'a long trailing comment '.repeat(8),
  '}',
].join('\n')

const payload = {
  ...fixture('print-sample.payload.json'),
  sections: [
    {
      id: 's1',
      no: 1,
      title: 'Code',
      blocks: [
        {
          type: 'code',
          language: 'ts',
          filename: 'src/limiter.ts',
          code: CODE,
          highlight: [4],
          notes: [
            { from: 2, text: 'Read the bucket.' },
            { from: 4, text: 'Take one token.' },
          ],
        },
        { type: 'code', language: 'ts', code: 'const a = 1\nconst b = 2' },
        { type: 'list', items: ['First risk', 'Second risk'] },
        { type: 'list', caption: 'Risks', items: ['First risk', 'Second risk'] },
        { type: 'image', imageId: 'img_4f9Kq2xZ7bN1', alt: 'one pixel', width: 40, height: 20 },
        { type: 'image', imageId: 'img_4f9Kq2xZ7bN1', alt: 'one pixel', caption: 'Figure 1', width: 40, height: 20 },
        {
          type: 'ba',
          language: 'ts',
          filename: 'a.ts',
          before: 'let a = 1',
          after: 'const a = 1',
          notes: [{ side: 'after', from: 1, text: 'Never reassigned.' }],
        },
      ],
    },
  ],
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function open(page: Page, width: number, media: 'print' | 'screen'): Promise<void> {
  await serveSession(page, payload)
  await page.route(`${new URL(VISUAL_API_URL).origin}/api/image/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }),
  )
  await page.setViewportSize({ width, height: 900 })
  await openReader(page, printSeed)
  await expect(page.locator('[data-image-body]')).toHaveCount(2)
  if (media === 'print') {
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
    await expect(page.locator('[data-print-answers]')).toBeVisible()
  }
}

test.describe('print', () => {
  test.beforeEach(async ({ page }) => open(page, 650, 'print'))

  test('code listing prints 12.5px mono with the filename alone in the header', async ({ page }) => {
    const figure = page.locator('figure:has(> pre.shiki)').first()
    await expectComputed(figure.locator('> pre'), { 'font-size': '12.5px', 'line-height': '20px' })
    await expect(figure.locator('> div:first-child [data-kind-tag]')).toBeHidden()
    await expect(figure.locator('> div:first-child')).toHaveText('src/limiter.ts', { useInnerText: true })
    const [head, listing] = await Promise.all([
      figure.locator('> div:first-child').boundingBox(),
      figure.locator('> pre').boundingBox(),
    ])
    expect(head!.y, 'header above the listing').toBeLessThan(listing!.y)
  })

  // B-Print:55-64: the card's rule closes round the header and listing, and the
  // lettered list follows it with margin 8px 0 4px, flush with the card's left edge.
  for (const [name, card] of [
    ['code', 'figure:has(> pre.shiki)'],
    ['before/after', 'figure:has([data-kind-tag]:text-is("ba"))'],
  ] as const) {
    test(`a ${name} note list prints 8px under the card's rule`, async ({ page }) => {
      const figure = page.locator(card).first()
      const notes = figure.locator('xpath=following-sibling::*[1]')
      await expect(notes).toHaveAttribute('data-print-notes', '')
      await expect(figure.locator('[data-print-notes]')).toHaveCount(0)
      const [box, list] = await Promise.all([figure.boundingBox(), notes.boundingBox()])
      expect(list!.y, 'list top vs card bottom').toBeGreaterThanOrEqual(box!.y + box!.height)
      expect(list!.y - (box!.y + box!.height), 'gap under the card').toBeCloseTo(8, 0)
      expect(list!.x, 'list left vs card left').toBeCloseTo(box!.x, 0)
    })
  }

  test('note letters line up in one column and the list follows the listing', async ({ page }) => {
    const letters = page.locator('figure:has(> pre.shiki) [data-print-letter]')
    await expect(letters).toHaveCount(2)
    const lefts = await letters.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))
    expect(lefts[0], `letters at x ${lefts.join(', ')}`).toBe(lefts[1])
    const lineRights = await page
      .locator('figure:has(> pre.shiki) [data-hl]')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))
    expect(lefts[0]).toBeGreaterThanOrEqual(Math.max(...lineRights) - 1)
  })

  test('a list prints with no card, 14/22, 22px indent', async ({ page }) => {
    const figure = page.locator('figure:has(> ul)').first()
    await expectComputed(figure, { 'border-top-width': '0px' })
    expect((await figure.boundingBox())!.height, 'no header row above the items').toBeCloseTo(
      (await figure.locator('> ul').boundingBox())!.height,
      0,
    )
    await expectComputed(figure.locator('> ul'), {
      'font-size': '14px',
      'line-height': '22px',
      'padding-left': '22px',
    })
  })

  test('a captioned list keeps its caption under the items', async ({ page }) => {
    const figure = page.locator('figure:has(> ul)').nth(1)
    await expect(figure.locator('> div:first-child')).toHaveText('Risks', { useInnerText: true })
    const [head, body] = await Promise.all([
      figure.locator('> div:first-child').boundingBox(),
      figure.locator('> ul').boundingBox(),
    ])
    expect(head!.y).toBeGreaterThanOrEqual(body!.y + body!.height - 1)
  })

  test('an image with no caption prints no header row', async ({ page }) => {
    const bare = page.locator('figure:has(> [data-image-body])').first()
    const [figure, body] = await Promise.all([bare.boundingBox(), bare.locator('> [data-image-body]').boundingBox()])
    expect(figure!.height, 'figure height vs image body height').toBeCloseTo(body!.height, 0)
    const capt = page.locator('figure:has(> [data-image-body])').nth(1)
    await expect(capt.locator('> div:first-child')).toHaveText('Figure 1', { useInnerText: true })
  })

  test('before and after panes print inside a rule', async ({ page }) => {
    const ba = page.locator('figure:has([data-kind-tag]:text-is("ba"))')
    await expectComputed(ba, { 'border-top-width': '1px', 'border-top-color': 'rgb(15, 18, 20)' })
  })
})

test.describe('screen', () => {
  test('a noted code row is as tall as a plain one', async ({ page }) => {
    await open(page, 1440, 'screen')
    const rows = await page
      .locator('figure:has(> pre.shiki) pre > code > span')
      .first()
      .evaluate((first) =>
        [...first.parentElement!.children].map((row) => Math.round(row.getBoundingClientRect().height * 10) / 10),
      )
    expect(rows, 'row heights').toEqual([24, 24, 24, 24, 24, 24])
  })

  test('at 388 a pinned note stays inside the visible listing', async ({ page }) => {
    await open(page, 388, 'screen')
    const code = page.locator('figure:has(> pre.shiki)').first()
    await code.locator('[data-code-note]').first().click()
    const note = code.locator('[data-code-note-pinned]')
    await expect(note).toBeVisible()
    const [pre, box] = await Promise.all([
      code.locator('> pre').evaluate((el) => el.getBoundingClientRect().width),
      note.boundingBox(),
    ])
    expect(box!.width, 'pinned note width vs listing width').toBeLessThanOrEqual(pre)
  })
})
