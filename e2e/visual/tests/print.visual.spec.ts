import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expectComputed } from '../lib/geometry'
import { clipOf, snapToPixelRow } from '../lib/regions'
import { SESSION_ID, expect, openReader, serveSession, test } from '../lib/session'

// The printed brief against B-Print. The fixture mirrors the board's sample
// (title, section 01, decisions D1 to D4 with an Other answer and an open
// question, a highlight with a note). Print is always light, so both theme
// projects compare with the same crops. The page is 650 wide, B-Print's text
// width (794 less 72 a side); on A4 the @page margin of 15mm gives 680.

const fixture = (file: string): unknown =>
  JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'fixtures', file), 'utf8'))
const printPayload = fixture('print-sample.payload.json')
const printSeed = fixture('print-state.seed.json')

/** 2026-10-14T09:30:00Z, the time on B-Print's printed line. */
const PRINTED_AT = Date.UTC(2026, 9, 14, 9, 30, 0)
const INK = 'rgb(15, 18, 20)'

async function openPrinted(page: Page): Promise<void> {
  await page.clock.setFixedTime(PRINTED_AT)
  await serveSession(page, printPayload)
  await page.setViewportSize({ width: 650, height: 900 })
  await openReader(page, printSeed)
  await page.emulateMedia({ media: 'print' })
  // emulateMedia does not fire the print events; a real print and page.pdf() do.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await expect(page.locator('[data-print-answers]')).toBeVisible()
}

const CROPS: [string, string][] = [
  ['print-title', '[data-print-sheet] h1'],
  ['print-session-line', '[data-print-sheet] p >> nth=0'],
  ['print-section-heading', 'section#s1 > div:first-child'],
  ['print-note', '[data-print-note]'],
  ['print-answers-heading', '[data-print-answers] h2'],
  ['print-answers-intro', '[data-print-answers] p'],
  ['print-answers-rows', '[data-print-answers] tbody'],
]

for (const [name, selector] of CROPS) {
  test(`print ${name.replace('print-', '')}`, async ({ page }) => {
    await openPrinted(page)
    const el = page.locator(selector).first()
    await expect(el, `not found: ${selector}`).toBeVisible()
    await snapToPixelRow(el)
    await expect(page).toHaveScreenshot(`crop-${name}.png`, { fullPage: true, clip: await clipOf(el) })
  })
}

test('print rules', async ({ page }) => {
  await openPrinted(page)

  // Always light, whatever the screen theme.
  await expectComputed(page.locator('body'), { 'background-color': 'rgb(255, 255, 255)' })
  await expectComputed(page.locator('[data-print-sheet] h1'), { color: INK })

  // The line under the title.
  await expect(page.locator('[data-print-sheet] p').nth(0)).toHaveText(
    `session ${SESSION_ID} / 4 sections / 4 decisions, 3 answered`,
  )
  const host = new URL(page.url()).host
  await expect(page.locator('[data-print-sheet] p').nth(1)).toHaveText(
    `printed 2026-10-14 09:30 UTC from ${host}/s/${SESSION_ID}`,
  )

  // Highlights underline, keep mark in the color-adjust rule, and print their note.
  await expectComputed(page.locator('mark').first(), {
    'text-decoration-line': 'underline',
    'text-decoration-thickness': '2px',
    'text-underline-offset': '3px',
    'background-color': 'rgba(0, 0, 0, 0)',
    'print-color-adjust': 'exact',
  })
  await expect(page.locator('section#s1 p [data-print-note]')).toHaveText('Note: ตัวเลขนี้มาจาก staging หรือ prod?')

  // Code panels: light, a 1px rule, no exact-color override.
  const code = page.locator('pre.shiki').first()
  await expect(code).toBeVisible()
  await expectComputed(code, { 'print-color-adjust': 'economy', 'background-color': 'rgba(0, 0, 0, 0)' })
  const panel = page.locator('div:has(> pre.shiki)').first()
  await expectComputed(panel, {
    'border-top-width': '1px',
    'border-top-style': 'solid',
    'border-top-color': INK,
  })
  await expectComputed(code, { 'white-space': 'pre-wrap' })
  // A highlighted line keeps its light accent tint.
  await expectComputed(code.locator('.hl-line').first(), {
    'background-color': 'rgb(238, 248, 217)',
    'print-color-adjust': 'exact',
  })
  // A note on a code highlight follows the listing.
  await expect(panel.locator('xpath=following-sibling::*[1]')).toHaveText('Note: สอง request พร้อมกันอาจหักซ้ำ')

  // No app chrome: top bar, header card and dock stay off paper.
  await expect(page.locator('header').first()).toBeHidden()
  await expect(page.locator('[data-dock]')).toBeHidden()
  await expect(page.locator('main h1')).toBeHidden()

  // Your answers, with the Other answer and the open question.
  const cells = await page
    .locator('[data-print-answers] tbody tr')
    .evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent)))
  expect(cells).toEqual([
    ['D1', 'วาง limiter ไว้ที่ไหน', 'Edge Worker', 'ใกล้ผู้ใช้ ตัด request ก่อนถึง origin'],
    ['D2', 'จำกัดกี่ครั้งต่อนาที', 'Other: 300 ครั้ง / นาที สำหรับ free tier', 'free tier ใช้จริงไม่เกิน 120'],
    ['D3', 'ใช้อะไรเป็น key', 'API key; User ID', ''],
    ['D4', 'ส่ง header อะไรกลับ', '(not answered)', ''],
  ])
})

test('the copy-back prompt is not printed', async ({ page }) => {
  await page.clock.setFixedTime(PRINTED_AT)
  await serveSession(page, printPayload)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openReader(page, printSeed)
  await page.getByRole('button', { name: /Copy prompt for agent/ }).click()
  const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
  await expect(review).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(review).toBeHidden()
})

test('page.pdf() prints the sheet on A4 and cleans up after', async ({ page, theme }, testInfo) => {
  test.skip(theme === 'light', 'one PDF is enough; print is always light')
  await page.clock.setFixedTime(PRINTED_AT)
  await serveSession(page, printPayload)
  await openReader(page, printSeed)
  await page.evaluate(() => {
    const w = window as unknown as { printEvents: string[] }
    w.printEvents = []
    for (const type of ['beforeprint', 'afterprint']) window.addEventListener(type, () => w.printEvents.push(type))
  })
  const pdf = await page.pdf({ format: 'A4', path: testInfo.outputPath('print.pdf') })
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect(await page.evaluate(() => (window as unknown as { printEvents: string[] }).printEvents)).toEqual([
    'beforeprint',
    'afterprint',
  ])
  // The print-only parts left again with afterprint.
  await expect(page.locator('[data-print-answers], [data-print-sheet], [data-print-note]')).toHaveCount(0)
})
