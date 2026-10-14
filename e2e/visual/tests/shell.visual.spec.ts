import { expectBox, expectComputed } from '../lib/geometry'
import type { Theme } from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// Values measured on B-Reader / B-Reader-Light (1440, 1100, 880) and B-Mobile
// with getBoundingClientRect and getComputedStyle. Board spans are content-box,
// so the save chip is 28 plus its 1px border (30), the outline 236 plus padding
// and border (250), the dock 340 plus border (342).
type Palette = Record<
  | 'card' | 'elev' | 'chip' | 'line' | 'line2' | 'text' | 'sub' | 'faint'
  | 'accent' | 'accentText' | 'onAccent' | 'shareText' | 'transparent',
  string
>
const C: Record<Theme, Palette> = {
  dark: {
    card: 'rgb(17, 20, 23)',
    elev: 'rgb(23, 27, 31)',
    chip: 'rgb(27, 32, 36)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    text: 'rgb(232, 236, 238)',
    sub: 'rgb(161, 170, 178)',
    faint: 'rgb(124, 134, 143)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(197, 240, 90)',
    onAccent: 'rgb(11, 13, 15)',
    shareText: 'rgb(11, 13, 15)',
    transparent: 'rgba(0, 0, 0, 0)',
  },
  light: {
    card: 'rgb(255, 255, 255)',
    elev: 'rgb(249, 250, 250)',
    chip: 'rgb(238, 240, 242)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    text: 'rgb(15, 18, 20)',
    sub: 'rgb(76, 85, 93)',
    faint: 'rgb(106, 115, 123)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(77, 122, 0)',
    onAccent: 'rgb(15, 18, 20)',
    // B-Reader-Light:59 draws Share as text fill with white text (card), not page.
    shareText: 'rgb(255, 255, 255)',
    transparent: 'rgba(0, 0, 0, 0)',
  },
}

test.describe('shell at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
  })

  test('top bar: logo, session id, title', async ({ page, theme }) => {
    const row = page.locator('header > :first-child')
    const logo = row.getByText('b', { exact: true })
    await expectBox(logo, { x: 14, y: 15, width: 22, height: 22 })
    await expectComputed(logo, {
      'background-color': C[theme].accent,
      color: C[theme].onAccent,
      'border-radius': '4px',
      'font-size': '13px',
      'font-weight': '600',
    })
    const id = row.getByText(/^k2p9x4Qm7Zr1Ta \/$/)
    await expectBox(id, { x: 46, height: 17 })
    await expectComputed(id, { color: C[theme].faint, 'font-size': '13px' })
    const title = row.getByText('Rate limiting สำหรับ public API', { exact: true })
    await expectComputed(title, { color: C[theme].text, 'font-size': '14px', 'font-weight': '500' })
  })

  test('view tabs: Document, Diagrams, Raw', async ({ page, theme }) => {
    const tablist = page.getByRole('tablist', { name: 'View' })
    await expect(tablist.getByRole('tab')).toHaveText(['Document', 'Diagrams', 'Raw'])
    await expectBox(tablist, { y: 8, height: 36 })
    await expectComputed(tablist, {
      'background-color': C[theme].card,
      'border-top-color': C[theme].line,
      'border-top-left-radius': '6px',
    })
    const selected = tablist.getByRole('tab', { name: 'Document' })
    await expect(selected).toHaveAttribute('aria-selected', 'true')
    await expectBox(selected, { height: 30 })
    await expectComputed(selected, {
      'background-color': C[theme].chip,
      color: C[theme].text,
      'font-size': '13px',
      'border-top-left-radius': '4px',
    })
    await expectComputed(tablist.getByRole('tab', { name: 'Diagrams' }), {
      'background-color': C[theme].transparent,
      color: C[theme].faint,
    })
  })

  test('palette field, save chip, icon buttons and Share', async ({ page, theme }) => {
    const row = page.locator('header > :first-child')
    const field = row.getByRole('button', { name: /Jump to\.\.\./ })
    await expectBox(field, { y: 10, height: 32 })
    expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(170)
    await expectComputed(field, {
      'background-color': C[theme].card,
      'border-top-color': C[theme].line2,
      color: C[theme].faint,
      'font-size': '13px',
      'border-top-left-radius': '4px',
    })

    const chip = row.getByText('saved', { exact: true })
    await expectBox(chip, { y: 11, height: 30 })
    await expectComputed(chip, {
      'border-top-color': C[theme].line,
      color: C[theme].sub,
      'font-size': '12px',
      'border-top-left-radius': '4px',
    })

    const toggleName = theme === 'dark' ? 'Theme: dark. Switch to light' : 'Theme: light. Switch to dark'
    for (const name of ['Edit', 'Download', 'Archive', toggleName]) {
      const button = row.getByRole('button', { name, exact: true })
      await expectBox(button, { y: 10, width: 32, height: 32 })
      await expectComputed(button, {
        'background-color': C[theme].transparent,
        color: C[theme].sub,
        'border-top-left-radius': '4px',
      })
    }

    const share = row.getByRole('button', { name: 'Share', exact: true })
    await expectBox(share, { y: 10, height: 32 })
    expect((await share.boundingBox())!.x + (await share.boundingBox())!.width).toBeCloseTo(1432, 0)
    await expectComputed(share, {
      'background-color': C[theme].text,
      color: C[theme].shareText,
      'font-size': '13px',
      'font-weight': '600',
    })
  })

  test('progress line: 2px elev track with an accent fill under the 52px row', async ({ page, theme }) => {
    const bar = page.getByRole('progressbar', { name: 'Reading progress' })
    await expectBox(bar, { x: 0, y: 52, width: 1440, height: 2 })
    await expectComputed(bar, { 'background-color': C[theme].elev })
    await expectComputed(bar.locator(':scope > div'), { 'background-color': C[theme].accent })
  })

  test('outline rows: heading, current row, idle row', async ({ page, theme }) => {
    const outline = page.locator('nav[aria-label="Outline"]')
    // The board's heading row is the OUTLINE label alone; the app adds the
    // collapse toggle (owner ruling D5) on the same 236 x 25 row.
    const heading = outline.getByText('OUTLINE', { exact: true })
    await expectBox(heading.locator('..'), { x: 23, y: 78, width: 236, height: 25 }, 1.5)
    await expectBox(heading, { x: 23, height: 25 }, 1.5)
    await expectComputed(heading, { color: C[theme].faint, 'font-size': '10px' })

    const rows = outline.locator('a[href^="#s"]')
    await expect(rows.first()).toBeVisible()
    const first = rows.first()
    await expectBox(first, { x: 23, y: 103, width: 236, height: 32 })
    await expectComputed(first, { 'font-size': '13px', 'border-top-left-radius': '4px' })

    const current = outline.locator('a[aria-current="true"]')
    await expect(current).toHaveCount(1)
    await expectComputed(current, {
      'background-color': C[theme].chip,
      color: C[theme].text,
      'font-weight': '500',
    })
    await expectComputed(current.locator('span').first(), {
      color: C[theme].accentText,
      'font-size': '11px',
      width: '18px',
    })
    const idle = outline.locator('a[href^="#s"]:not([aria-current="true"])').first()
    await expectComputed(idle, { color: C[theme].sub, 'background-color': C[theme].transparent })
    await expectComputed(idle.locator('span').first(), { color: C[theme].faint })
  })

  test('your marks lists the seeded highlight by its text', async ({ page, theme }) => {
    const outline = page.locator('nav[aria-label="Outline"]')
    await expectComputed(outline.getByText('YOUR MARKS', { exact: true }), { color: C[theme].faint, 'font-size': '10px' })
    const mark = outline.getByRole('link', { name: 'ล้มทั้งแถบ' })
    await expectBox(mark, { width: 236, height: 32 })
    await expectComputed(mark, { color: C[theme].sub })
  })

  test('header card and section card shells', async ({ page, theme }) => {
    const hero = page.locator('main > :first-child')
    await expectBox(hero, { x: 282, y: 71, width: 784, height: 152 }, 1.5)
    await expectComputed(hero, {
      'background-color': C[theme].card,
      'border-top-color': C[theme].line,
      'border-top-left-radius': '6px',
      'padding-top': '20px',
      'padding-left': '20px',
    })
    const chip = hero.getByText('Claude Code', { exact: true })
    await expectBox(chip, { x: 303, y: 92, height: 20 }, 1.5)
    await expectComputed(chip, {
      color: C[theme].sub,
      'border-top-color': C[theme].line2,
      'font-size': '11px',
      'border-top-left-radius': '3px',
    })
    await expect(hero.getByRole('link', { name: 'acme/api-gateway' })).toBeVisible()
    await expectComputed(page.locator('h1'), {
      'font-size': '30px',
      'line-height': '36px',
      'font-weight': '600',
      color: C[theme].text,
    })

    const s1 = page.locator('section#s1')
    await expectBox(s1, { x: 282, y: 239, width: 784 }, 1.5)
    await expectComputed(s1, { 'scroll-margin-top': '72px' })
    const head = s1.locator(':scope > :first-child')
    await expectBox(head, { x: 283, y: 240, width: 782, height: 51 }, 1.5)
    await expectComputed(head, { 'border-bottom-color': C[theme].line, 'padding-top': '12px', 'padding-left': '16px' })
    await expectComputed(head.locator('span').first(), { color: C[theme].accentText, 'font-size': '12px' })
    await expectComputed(head.locator('h2'), {
      'font-size': '18px',
      'line-height': '26px',
      'font-weight': '600',
      color: C[theme].text,
    })
  })
})

test('at 1100 the dock moves under the document at full width', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 })
  await openReader(page)
  const outline = page.locator('nav[aria-label="Outline"]')
  await expectBox(outline, { x: 16, y: 71, width: 250 })
  await expectComputed(outline, { position: 'static' })
  const main = page.locator('main').first()
  await expectBox(main, { x: 282, y: 71, width: 802 })
  const dock = page.locator('aside[aria-label="Decision dock"]')
  await expectBox(dock, { x: 16, width: 1068 })
  await expectComputed(dock, { position: 'static' })
  const mainBox = (await main.boundingBox())!
  expect((await dock.boundingBox())!.y).toBeCloseTo(mainBox.y + mainBox.height + 16, 0)
})

test('at 880 the outline stays and the dock is under the document', async ({ page }) => {
  await page.setViewportSize({ width: 880, height: 900 })
  await openReader(page)
  await expectBox(page.locator('nav[aria-label="Outline"]'), { x: 16, y: 71, width: 250 })
  await expectBox(page.locator('main').first(), { x: 282, y: 71, width: 582 })
  await expectBox(page.locator('aside[aria-label="Decision dock"]'), { x: 16, width: 848 })
  await expectBox(page.locator('header > :first-child'), { height: 52 })
})

test.describe('under 880 (B-Mobile)', () => {
  test.use({ viewport: { width: 388, height: 763 }, isMobile: true, hasTouch: true })

  test('top bar is 48 high with the section counter and 44px buttons', async ({ page, theme }) => {
    await openReader(page)
    const row = page.locator('header > :first-child')
    await expectBox(row, { x: 0, y: 0, width: 388, height: 48 })
    const counter = row.getByText(/^§\d{2} \/ \d{2}$/)
    await expect(counter).toBeVisible()
    await expectComputed(counter, { color: C[theme].faint, 'font-size': '12px' })
    for (const name of ['Open outline', 'Search', 'More actions']) {
      await expectBox(row.getByRole('button', { name, exact: true }), { width: 44, height: 44 })
    }
    await expect(page.getByRole('tablist', { name: 'View' })).toBeHidden()
    await expect(page.locator('nav[aria-label="Outline"]')).toBeHidden()
    await expectBox(page.getByRole('progressbar', { name: 'Reading progress' }), { y: 48, height: 2 })
  })

  test('the dock is a bottom sheet with a peek bar', async ({ page, theme }) => {
    await openReader(page)
    const dock = page.locator('aside[aria-label="Decision dock"]')
    await expectComputed(dock, {
      position: 'fixed',
      'background-color': C[theme].card,
      'border-top-color': C[theme].line2,
      'border-top-left-radius': '14px',
    })
    const box = (await dock.boundingBox())!
    expect(box.x).toBe(0)
    expect(box.width).toBe(388)
    expect(box.y + box.height).toBeCloseTo(763, 0)
    const open = dock.getByRole('button', { name: 'Open dock' })
    await expectBox(open, { height: 44 })
    await expectComputed(open, { 'background-color': C[theme].accent, color: C[theme].onAccent })
    await expect(dock.getByText(/^\d of \d(, next D\d)?$/)).toBeVisible()

    await open.click()
    await expect(dock).toHaveAttribute('role', 'dialog')
    await expectComputed(dock, { 'border-top-left-radius': '16px' })
    // The sheet slides up (260ms); measure where it comes to rest.
    await expect.poll(async () => Math.round((await dock.boundingBox())!.y)).toBe(106)
    await expect(dock.getByRole('button', { name: 'Close dock' })).toBeVisible()
  })
})
