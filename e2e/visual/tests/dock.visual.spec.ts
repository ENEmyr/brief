import { expect as baseExpect, type Locator, type Page } from '@playwright/test'
import { expectBox, expectComputed } from '../lib/geometry'
import { PHONE_VIEWPORT, clipOf, type Theme } from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// Phase 3: the decision dock (B-Reader:205-231), the B-Mobile sheet and the
// B-Overlays prompt review sheet. Numbers were measured on the boards with
// getBoundingClientRect and getComputedStyle, relative to the dock (or sheet)
// box, with the board fonts fetched as the reference renderer fetches them (the
// app's next/font files). The boards size kbd and input elements as content
// boxes, so a "height: 18px" kbd renders 20 and a "min-height: 32px" input 34.
type Palette = Record<
  | 'page'
  | 'card'
  | 'codeBg'
  | 'line'
  | 'line2'
  | 'text'
  | 'sub'
  | 'faint'
  | 'accent'
  | 'accentText'
  | 'accentLine'
  | 'accentSoft'
  | 'onAccent'
  | 'good'
  | 'goodSoft'
  | 'warn'
  | 'warnSoft'
  | 'warnFill'
  | 'dockCurrent'
  | 'transparent',
  string
>
const C: Record<Theme, Palette> = {
  dark: {
    page: 'rgb(11, 13, 15)',
    card: 'rgb(17, 20, 23)',
    codeBg: 'rgb(14, 17, 19)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    text: 'rgb(232, 236, 238)',
    sub: 'rgb(161, 170, 178)',
    faint: 'rgb(124, 134, 143)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(197, 240, 90)',
    accentLine: 'rgb(197, 240, 90)',
    accentSoft: 'rgb(30, 38, 18)',
    onAccent: 'rgb(11, 13, 15)',
    good: 'rgb(79, 211, 154)',
    goodSoft: 'rgb(19, 38, 31)',
    warn: 'rgb(244, 183, 64)',
    warnSoft: 'rgb(42, 34, 19)',
    warnFill: 'rgb(244, 183, 64)',
    dockCurrent: 'rgb(20, 26, 18)',
    transparent: 'rgba(0, 0, 0, 0)',
  },
  light: {
    page: 'rgb(244, 245, 246)',
    card: 'rgb(255, 255, 255)',
    codeBg: 'rgb(249, 250, 250)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    text: 'rgb(15, 18, 20)',
    sub: 'rgb(76, 85, 93)',
    faint: 'rgb(106, 115, 123)',
    accent: 'rgb(197, 240, 90)',
    accentText: 'rgb(77, 122, 0)',
    accentLine: 'rgb(94, 140, 16)',
    accentSoft: 'rgb(238, 248, 217)',
    onAccent: 'rgb(15, 18, 20)',
    good: 'rgb(19, 120, 74)',
    goodSoft: 'rgb(227, 243, 234)',
    warn: 'rgb(143, 90, 0)',
    warnSoft: 'rgb(251, 240, 218)',
    warnFill: 'rgb(184, 122, 10)',
    dockCurrent: 'rgb(245, 250, 236)',
    transparent: 'rgba(0, 0, 0, 0)',
  },
}

/** Each B-Reader decision has a context-chip row (26 plus the 8 gap) that waits on decision.refs (P1). */
const CHIPS = 34
/**
 * B-Reader draws the dock 1297 high in flow. The app caps it at the viewport
 * less 64 (sticky top) and 16 (page padding) so its list scrolls, which puts
 * the footer at the dock's bottom edge: 900 - 80 high at 1440x900.
 */
const DOCK_H = 900 - 80
const BOARD_DOCK_H = 1297
/** Reset (owner ruling D5, no board) under the includes line: 36 plus the 8 gap. */
const RESET = 44

interface Rel {
  x?: number
  y?: number
  width?: number
  height?: number
}

/** Asserts a box relative to `origin`'s top-left, each edge within 1 px. */
async function expectRel(locator: Locator, origin: Locator, expected: Rel): Promise<void> {
  await baseExpect(locator).toBeVisible()
  const o = (await origin.boundingBox())!
  const b = (await locator.boundingBox())!
  const got = { x: b.x - o.x, y: b.y - o.y, width: b.width, height: b.height }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const want = expected[key]
    if (want === undefined) continue
    baseExpect(
      Math.abs(got[key] - want),
      `${key}: got ${got[key]}, board has ${want}`,
    ).toBeLessThanOrEqual(1)
  }
}

/** The boards draw the Apple key glyphs; pin the platform so the app draws them too. */
async function asApple(page: Page): Promise<void> {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }),
  )
}

test.describe('dock at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await asApple(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
  })

  const dockOf = (page: Page) => page.locator('aside[aria-label="Decision dock"]')
  const row = (page: Page, id: string) =>
    dockOf(page).getByRole('group', { name: `Question ${id}` })

  test('header: DECISIONS, the count and one segment per decision', async ({ page, theme }) => {
    const dock = dockOf(page)
    const label = dock.getByText('DECISIONS', { exact: true })
    const header = label.locator('xpath=../..')
    await expectRel(header, dock, { x: 1, y: 1, width: 340, height: 53 })
    await expectComputed(header, {
      'padding-top': '12px',
      'padding-left': '14px',
      'border-bottom-color': C[theme].line,
    })
    await expectRel(label, dock, { x: 15, y: 14, height: 14 })
    await expectComputed(label, {
      'font-size': '11px',
      'letter-spacing': '0.66px',
      color: C[theme].faint,
    })
    const count = dock.getByText('3/4', { exact: true })
    await expectRel(count, dock, { x: 306, y: 13 })
    await expectComputed(count, { 'font-size': '12px', color: C[theme].accentText })

    const segments = header.locator(':scope > :last-child > span')
    await expect(segments).toHaveCount(4)
    const tones = [C[theme].accent, C[theme].accent, C[theme].accent, C[theme].warnFill]
    for (const [i, tone] of tones.entries()) {
      await expectRel(segments.nth(i), dock, { y: 37, height: 4, width: 75.75 })
      await expectComputed(segments.nth(i), {
        'background-color': tone,
        'border-top-left-radius': '2px',
      })
    }
  })

  test('decision rows: id, question, state word; the first open one on the highlight fill', async ({
    page,
    theme,
  }) => {
    const dock = dockOf(page)
    const d1 = row(page, 'D1')
    await expectRel(d1, dock, { x: 1, y: 54, width: 340, height: 277 - CHIPS })
    await expectComputed(d1, {
      'padding-top': '12px',
      'padding-left': '14px',
      'background-color': C[theme].transparent,
      'border-bottom-color': C[theme].line,
    })
    const id = d1.getByText('D1', { exact: true })
    await expectRel(id, dock, { x: 15, y: 70 })
    await expectComputed(id, { 'font-size': '11px', color: C[theme].accentText })
    const question = d1.getByText('ใช้ตัวจำกัดอัตราแบบไหน', { exact: true })
    await expectRel(question, dock, { x: 37, y: 66, height: 20 })
    await expectComputed(question, {
      'font-size': '14px',
      'line-height': '20px',
      'font-weight': '600',
      color: C[theme].text,
    })
    const done = d1.getByText('done', { exact: true })
    await expectRel(done, dock, { x: 303, y: 71 })
    await expectComputed(done, { 'font-size': '10px', color: C[theme].good })

    const d4 = row(page, 'D4')
    await expectComputed(d4, { 'background-color': C[theme].dockCurrent })
    await expectComputed(d4.getByText('open', { exact: true }), { color: C[theme].warn })
    for (const id of ['D2', 'D3'])
      await expectComputed(row(page, id), { 'background-color': C[theme].transparent })
  })

  test('options: 34 high, numbered kbd 20, picked and idle states, then the reason field', async ({
    page,
    theme,
  }) => {
    const dock = dockOf(page)
    const options = row(page, 'D1').getByRole('radio')
    await expect(options).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      await expectRel(options.nth(i), dock, {
        x: 15,
        y: 128 - CHIPS + 38 * i,
        width: 312,
        height: 34,
      })
    }
    const picked = options.nth(0)
    await expect(picked).toHaveAttribute('aria-checked', 'true')
    await expectComputed(picked, {
      'background-color': C[theme].accentSoft,
      'border-top-color': C[theme].accentLine,
      color: C[theme].text,
      'font-size': '13px',
      'border-top-left-radius': '4px',
      'padding-left': '8px',
    })
    await expectComputed(options.nth(1), {
      'background-color': C[theme].card,
      'border-top-color': C[theme].line,
      color: C[theme].sub,
    })
    const pickedKbd = picked.locator('kbd')
    await expectRel(pickedKbd, dock, { x: 24, y: 135 - CHIPS, width: 20, height: 20 })
    await expectComputed(pickedKbd, {
      'background-color': C[theme].accent,
      color: C[theme].onAccent,
      'border-top-color': C[theme].accentLine,
      'border-top-left-radius': '3px',
      'font-size': '11px',
    })
    await expectComputed(options.nth(1).locator('kbd'), {
      'background-color': C[theme].transparent,
      color: C[theme].sub,
      'border-top-color': C[theme].line2,
    })
    await expectRel(picked.locator(':scope > span'), dock, { x: 54 })

    const reason = row(page, 'D1').getByRole('textbox', { name: 'D1 Reason' })
    await expectRel(reason, dock, { x: 15, y: 284 - CHIPS, width: 312, height: 34 })
    await expectComputed(reason, {
      'background-color': C[theme].codeBg,
      'border-top-color': C[theme].line,
      'font-size': '16px',
      'border-top-left-radius': '4px',
    })
  })

  test('Other: last option, "Your answer" open under the group, multi uses checkboxes', async ({
    page,
    theme,
  }) => {
    const dock = dockOf(page)
    const d2 = row(page, 'D2')
    await expectRel(d2, dock, { y: 331 - CHIPS })
    const other = d2.getByRole('radio', { name: 'Other, type your own' })
    await expect(other).toHaveAttribute('aria-checked', 'true')
    await expect(other.locator('kbd')).toHaveText('4')
    const field = d2.getByRole('textbox', { name: 'D2 Your answer' })
    await expect(field).toHaveAttribute('placeholder', 'Your answer')
    await expectRel(field, dock, { x: 15, y: 561 - 2 * CHIPS, width: 312, height: 36 })
    await expectComputed(field, {
      'background-color': C[theme].page,
      'border-top-color': C[theme].accentLine,
      'font-size': '16px',
    })

    const d3 = row(page, 'D3')
    await expect(d3.getByRole('checkbox')).toHaveCount(4)
    await expect(d3.getByRole('checkbox', { name: 'API key' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(d3.getByRole('checkbox', { name: 'User ID' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('footer: Copy prompt for agent 40 with its key chip, and the includes line', async ({
    page,
    theme,
  }) => {
    const dock = dockOf(page)
    const copy = dock.getByRole('button', { name: /^Copy prompt for agent/ })
    await expectBox(dock, { height: DOCK_H })
    await expectRel(copy, dock, {
      x: 15,
      y: DOCK_H - (BOARD_DOCK_H - 1218) - RESET,
      width: 312,
      height: 40,
    })
    await expectComputed(copy, {
      'background-color': C[theme].accent,
      color: C[theme].onAccent,
      'font-size': '14px',
      'font-weight': '600',
      'border-top-left-radius': '4px',
    })
    const chip = copy.locator('kbd')
    await expect(chip).toHaveText('⌘↵')
    await expectRel(chip, dock, { x: 246, width: 14 })
    await expectComputed(chip, { 'font-size': '11px', opacity: '0.7' })
    const line = dock.getByText('Includes answers, reasons and 0 notes', { exact: true })
    await expectRel(line, dock, {
      x: 15,
      y: DOCK_H - (BOARD_DOCK_H - 1266) - RESET,
      width: 312,
      height: 18,
    })
    await expectComputed(line, {
      'font-size': '12px',
      'line-height': '18px',
      color: C[theme].faint,
      'text-align': 'center',
    })
  })

  test('N and "Go to" focus a question below the fold, with Copy on screen', async ({ page }) => {
    const focusInView = () =>
      page.evaluate(() => {
        const box = document.activeElement!.getBoundingClientRect()
        return box.top >= 0 && box.bottom <= window.innerHeight
      })
    const copy = dockOf(page).getByRole('button', { name: /^Copy prompt for agent/ })
    const d4 = row(page, 'D4').getByRole('radio', { name: '429 + Retry-After' })
    const listTop = () =>
      page.evaluate(() => {
        document.querySelector('[data-decision="D1"]')!.parentElement!.scrollTop = 0
      })

    await expectBox(copy, { height: 40 })
    expect(
      await copy.evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight),
    ).toBe(true)

    await page.keyboard.press('n')
    await expect(d4).toBeFocused()
    expect(await focusInView()).toBe(true)

    await listTop()
    await copy.click()
    await page
      .getByRole('dialog', { name: 'Review prompt before copying' })
      .getByRole('button', { name: 'Go to D4' })
      .click()
    await expect(d4).toBeFocused()
    expect(await focusInView()).toBe(true)
  })

  // Pixel crops of the parts whose content matches the board: the header,
  // two option rows, a checkbox and the Copy button.
  for (const [crop, find] of [
    [
      'dock-header',
      (page: Page) => dockOf(page).getByText('DECISIONS', { exact: true }).locator('xpath=../..'),
    ],
    [
      'dock-option-picked',
      (page: Page) => row(page, 'D1').getByRole('radio', { name: 'Rate limiting binding' }),
    ],
    [
      'dock-option-idle',
      (page: Page) => row(page, 'D1').getByRole('radio', { name: 'KV counter' }),
    ],
    [
      'dock-checkbox-picked',
      (page: Page) => row(page, 'D3').getByRole('checkbox', { name: 'API key' }),
    ],
    [
      'dock-copy',
      (page: Page) => dockOf(page).getByRole('button', { name: /^Copy prompt for agent/ }),
    ],
  ] as const) {
    test(`crop ${crop}`, async ({ page, theme }) => {
      const locator = find(page)
      await expect(locator).toBeVisible()
      await expect(page).toHaveScreenshot(`crop-reader-${theme}-${crop}.png`, {
        fullPage: true,
        clip: await clipOf(locator),
      })
    })
  }
})

test.describe('prompt review sheet at 1440', () => {
  test('a 501 right sheet with title, chips, Go to, the text, Copy prompt and Rebuild', async ({
    page,
    theme,
  }) => {
    await asApple(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)
    await page.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Review prompt before copying' })
    // The sheet slides in from the right (260ms); measure where it comes to rest.
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.x)).toBe(939)
    await expectBox(sheet, { x: 939, y: 0, width: 501, height: 900 })
    await expectComputed(sheet, {
      'background-color': C[theme].card,
      'border-left-color': C[theme].line2,
      'border-left-width': '1px',
    })

    const title = sheet.getByText('Review prompt before copying', { exact: true })
    await expectRel(title, sheet, { x: 19, y: 12, height: 19 })
    await expectComputed(title, { 'font-size': '15px', 'font-weight': '600', color: C[theme].text })
    const sub = sheet.getByText('Edit freely. This text goes back to the agent.', { exact: true })
    await expectRel(sub, sheet, { x: 19, y: 33, height: 16 })
    await expectComputed(sub, { 'font-size': '12px', color: C[theme].sub })
    const close = sheet.getByRole('button', { name: 'Close prompt review' })
    await expectRel(close, sheet, { x: 459, y: 12, width: 32, height: 32 })
    await expectComputed(close, { color: C[theme].sub })

    const answered = sheet.getByText('3 answered', { exact: true })
    await expectRel(answered, sheet, { x: 19, y: 73, width: 82, height: 18 })
    await expectComputed(answered, {
      'background-color': C[theme].goodSoft,
      color: C[theme].good,
      'font-size': '11px',
      'border-top-left-radius': '3px',
    })
    const open = sheet.getByText('1 open', { exact: true })
    await expectRel(open, sheet, { x: 107, y: 73, width: 54, height: 18 })
    await expectComputed(open, { 'background-color': C[theme].warnSoft, color: C[theme].warn })
    const notes = sheet.getByText('0 notes', { exact: true })
    await expectRel(notes, sheet, { x: 167, y: 72, width: 63, height: 20 })
    await expectComputed(notes, { color: C[theme].sub, 'border-top-color': C[theme].line })
    const goTo = sheet.getByRole('button', { name: 'Go to D4' })
    await expectRel(goTo, sheet, { x: 433, y: 74, width: 50, height: 16 })
    await expectComputed(goTo, { 'font-size': '12px', color: C[theme].accentText })

    const text = sheet.getByRole('textbox', { name: 'Prompt text' })
    await expectRel(text, sheet, { x: 19, y: 115, width: 464 })
    await expectComputed(text, {
      'background-color': C[theme].codeBg,
      'border-top-color': C[theme].line2,
      'font-size': '12.5px',
      'line-height': '20px',
      'padding-top': '12px',
      'padding-left': '14px',
      'border-top-left-radius': '4px',
    })

    const copy = sheet.getByRole('button', { name: /^Copy prompt/ })
    await expectRel(copy, sheet, { x: 19, y: 900 - 64 + 12, width: 171, height: 36 })
    await expectComputed(copy, {
      'background-color': C[theme].accent,
      color: C[theme].onAccent,
      'font-size': '13px',
      'font-weight': '600',
    })
    const chip = copy.locator('kbd')
    await expect(chip).toHaveText('⌘ Enter')
    await expectRel(chip, sheet, { width: 52, height: 15 })
    const rebuild = sheet.getByRole('button', { name: 'Rebuild from answers' })
    await expectRel(rebuild, sheet, { x: 198, width: 159, height: 36 })
    await expectComputed(rebuild, {
      color: C[theme].text,
      'border-top-color': C[theme].line2,
      'font-size': '13px',
    })
    await expectComputed(sheet.getByText(/^\d+ chars$/), {
      'font-size': '11px',
      color: C[theme].faint,
    })
  })
})

test.describe('phone sheet', () => {
  test.use({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true })

  // B-Mobile's own answers: D1 binding, D3 api. The sheet opens on D2, the first open one.
  const mobileSeed = {
    dsel: { D1: ['binding'], D3: ['api'] },
    dnote: {},
    dother: {},
    highlights: [],
  }

  async function openSheet(page: Page) {
    await openReader(page, mobileSeed)
    await page.getByRole('button', { name: 'Open dock' }).click()
    const sheet = page.getByRole('dialog', { name: 'Decision dock' })
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(106)
    return sheet
  }

  test('chips, the current question, 48 options, the reason field and the footer', async ({
    page,
    theme,
  }) => {
    const sheet = await openSheet(page)
    await expect(sheet.getByText('DECISIONS / 2/4', { exact: true })).toBeVisible()
    // Touch targets under 880 are 44: the board's 36 chips grow by 8.
    const chips = ['D1', 'D2', 'D3', 'D4'].map((id) =>
      sheet.getByRole('button', { name: `Question ${id}` }),
    )
    for (const chip of chips) {
      await expectRel(chip, sheet, { y: 88, height: 44 })
      await expectComputed(chip, { 'border-top-left-radius': '999px', 'font-size': '12px' })
    }
    await expect(chips[1]!).toHaveAttribute('aria-pressed', 'true')
    await expectComputed(chips[1]!, {
      'background-color': C[theme].accentSoft,
      'border-top-color': C[theme].accentLine,
      color: C[theme].accentText,
    })
    await expectComputed(chips[0]!, { color: C[theme].text, 'border-top-color': C[theme].line2 })
    await expectComputed(chips[3]!, { color: C[theme].sub })
    await expect(chips[0]!).toHaveText('D1 ✓')

    const question = sheet.getByText('ค่า default limit ต่อผู้ใช้', { exact: true })
    await expectRel(question, sheet, { x: 14, y: 140 + 8 })
    await expectComputed(question, {
      'font-size': '18px',
      'line-height': '26px',
      'font-weight': '600',
    })

    // B-Mobile has a context link (38 plus the 10 gap, less its -4 margin) above the options: refs are P1.
    const options = sheet.getByRole('group', { name: 'Question D2' }).getByRole('radio')
    await expect(options).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      await expectRel(options.nth(i), sheet, {
        x: 14,
        y: 220 + 8 - 44 + 54 * i,
        width: 360,
        height: 48,
      })
    }
    await expectComputed(options.nth(0), {
      'background-color': C[theme].codeBg,
      'border-top-color': C[theme].line,
      color: C[theme].sub,
      'font-size': '15px',
      'border-top-left-radius': '6px',
    })
    await expectRel(options.nth(0).locator('kbd'), sheet, { x: 27, width: 24, height: 24 })
    await expectComputed(options.nth(0).locator('kbd'), {
      'font-size': '12px',
      'border-top-left-radius': '4px',
    })
    await expectRel(options.nth(0).locator(':scope > span'), sheet, { x: 63 })

    const label = sheet.getByText('Reason / extra context', { exact: true })
    await expectComputed(label, { 'font-size': '13px', color: C[theme].sub })
    const reason = sheet.getByRole('textbox', { name: 'Reason / extra context' })
    await expectRel(reason, sheet, { x: 14, width: 360, height: 66 })
    await expectComputed(reason, {
      'background-color': C[theme].codeBg,
      'font-size': '16px',
      'line-height': '24px',
      'border-top-left-radius': '6px',
    })

    const copy = sheet.getByRole('button', { name: 'Copy prompt for agent' })
    await expectBox(copy, { x: 12, y: PHONE_VIEWPORT.height - 30 - 48, width: 364, height: 48 })
    await expectComputed(copy, {
      'background-color': C[theme].accent,
      color: C[theme].onAccent,
      'font-size': '15px',
      'font-weight': '600',
      'border-top-left-radius': '6px',
    })
    await expectBoxHeight(sheet.getByRole('button', { name: 'Close dock' }), 44)
  })

  test('picking Other opens "Your answer", 46 high, focused', async ({ page, theme }) => {
    const sheet = await openSheet(page)
    await sheet.getByRole('radio', { name: 'Other, type your own' }).click()
    const field = sheet.getByRole('textbox', { name: 'Your answer' })
    await expect(field).toBeFocused()
    await expectRel(field, sheet, { x: 14, width: 360, height: 46 })
    await expectComputed(field, { 'border-top-color': C[theme].accentLine, 'font-size': '16px' })
    await expectBoxHeight(sheet.getByRole('button', { name: 'Reset' }), 44)
  })

  test('the review sheet fills the phone width with 44 targets', async ({ page }) => {
    const sheet = await openSheet(page)
    await sheet.getByRole('button', { name: 'Copy prompt for agent' }).click()
    const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
    await expect.poll(async () => Math.round((await review.boundingBox())!.x)).toBe(0)
    await expectBox(review, { x: 0, width: 388 })
    for (const name of ['Close prompt review', 'Go to D2']) {
      await expectBoxHeight(review.getByRole('button', { name }), 44)
    }
    // One line each: a label that wraps would make the button taller than 44.
    await expectBox(review.getByRole('button', { name: 'Rebuild from answers' }), { height: 44 })
    await expectBox(review.getByRole('button', { name: /^Copy prompt/ }), { height: 44 })
  })

  test('sheet screen against B-Mobile', async ({ page, theme }) => {
    await openSheet(page)
    await expect(page).toHaveScreenshot(`mobile-${theme}-sheet.png`, {
      clip: { x: 0, y: 0, width: PHONE_VIEWPORT.width, height: 768 },
    })
  })
})

async function expectBoxHeight(locator: Locator, min: number): Promise<void> {
  await baseExpect(locator).toBeVisible()
  baseExpect((await locator.boundingBox())!.height).toBeGreaterThanOrEqual(min)
}
