import type { Locator, Page } from '@playwright/test'
import { expectBox, expectComputed } from '../lib/geometry'
import { clipOf, type Theme } from '../lib/regions'
import { SESSION_ID, expect, openReader, samplePayload, sessionEnvelope, test } from '../lib/session'
import { VISUAL_API_URL, VISUAL_WEB_URL } from '../visual.config'

// The boards are dark only, so pixel crops run in dark.
type Palette = Record<
  | 'page' | 'card' | 'chip' | 'line' | 'line2' | 'text' | 'sub' | 'faint' | 'accent' | 'accentLine'
  | 'accentSoft' | 'onAccent' | 'bad' | 'badLine' | 'warn' | 'warnLine' | 'warnSoft' | 'warnCallout' | 'warnFill' | 'inverseSub'
  | 'scrim' | 'overlayShadow' | 'toastShadow',
  string
>
const C: Record<Theme, Palette> = {
  dark: {
    page: 'rgb(11, 13, 15)',
    card: 'rgb(17, 20, 23)',
    chip: 'rgb(27, 32, 36)',
    line: 'rgb(35, 41, 46)',
    line2: 'rgb(49, 57, 64)',
    text: 'rgb(232, 236, 238)',
    sub: 'rgb(161, 170, 178)',
    faint: 'rgb(124, 134, 143)',
    accent: 'rgb(197, 240, 90)',
    accentLine: 'rgb(197, 240, 90)',
    accentSoft: 'rgb(30, 38, 18)',
    onAccent: 'rgb(11, 13, 15)',
    bad: 'rgb(255, 107, 107)',
    badLine: 'rgb(90, 35, 40)',
    warn: 'rgb(244, 183, 64)',
    warnLine: 'rgb(74, 58, 22)',
    warnSoft: 'rgb(42, 34, 19)',
    warnCallout: 'rgb(26, 23, 16)',
    warnFill: 'rgb(244, 183, 64)',
    inverseSub: 'rgb(76, 85, 93)',
    scrim: 'rgba(0, 0, 0, 0.55)',
    overlayShadow: 'rgba(0, 0, 0, 0.5) 0px 16px 48px 0px',
    toastShadow: 'rgba(0, 0, 0, 0.4) 0px 8px 24px 0px',
  },
  light: {
    page: 'rgb(244, 245, 246)',
    card: 'rgb(255, 255, 255)',
    chip: 'rgb(238, 240, 242)',
    line: 'rgb(225, 228, 231)',
    line2: 'rgb(205, 210, 215)',
    text: 'rgb(15, 18, 20)',
    sub: 'rgb(76, 85, 93)',
    faint: 'rgb(104, 113, 121)',
    accent: 'rgb(197, 240, 90)',
    accentLine: 'rgb(94, 140, 16)',
    accentSoft: 'rgb(238, 248, 217)',
    onAccent: 'rgb(15, 18, 20)',
    bad: 'rgb(192, 50, 45)',
    badLine: 'rgb(240, 184, 181)',
    warn: 'rgb(143, 90, 0)',
    warnLine: 'rgb(235, 203, 138)',
    warnSoft: 'rgb(251, 240, 218)',
    warnCallout: 'rgb(251, 240, 218)',
    warnFill: 'rgb(184, 122, 10)',
    inverseSub: 'rgb(161, 170, 178)',
    scrim: 'rgba(15, 18, 20, 0.35)',
    overlayShadow: 'rgba(15, 18, 20, 0.12) 0px 16px 48px 0px',
    toastShadow: 'rgba(15, 18, 20, 0.12) 0px 8px 24px 0px',
  },
}

const API_ORIGIN = new URL(VISUAL_API_URL).origin
const SESSION_URL = `${API_ORIGIN}/api/session/${SESSION_ID}`
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS', 'access-control-allow-headers': 'content-type' }
const PHONE = { width: 390, height: 844 } as const

/** Answers the session GET instead of the fixture (routes registered later win). */
async function routeSession(page: Page, answer: { status: number; body?: unknown } | 'hang'): Promise<void> {
  await page.route(SESSION_URL, (route) =>
    answer === 'hang'
      ? undefined
      : route.fulfill({ status: answer.status, headers: CORS, contentType: 'application/json', body: JSON.stringify(answer.body ?? {}) }),
  )
}

async function routeSave(page: Page, status: number): Promise<void> {
  await page.route(`${SESSION_URL}/save`, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status, headers: CORS, contentType: 'application/json', body: status === 200 ? '{"saved":true,"encrypted":false,"expiresAt":1}' : '{}' }),
  )
}

async function stubClipboard(page: Page, works: boolean): Promise<void> {
  await page.addInitScript((works) => {
    document.execCommand = () => works
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => (works ? Promise.resolve() : Promise.reject(new Error('blocked'))) },
    })
  }, works)
}

async function openFromBar(page: Page, name: 'Share' | 'Archive'): Promise<Locator> {
  const button = page.getByRole('button', { name, exact: true })
  if (await button.isVisible()) await button.click()
  else {
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name }).click()
  }
  return afterEnterAnimation(page.getByRole('dialog', { name: name === 'Share' ? 'Share this doc' : 'Archive this doc' }))
}

async function afterEnterAnimation(locator: Locator): Promise<Locator> {
  await expect(locator).toBeVisible()
  await locator.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  return locator
}

/** The painted shadow: Tailwind lists four transparent ring shadows before the token's. */
const shadowOf = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => !s.startsWith('rgba(0, 0, 0, 0) ')).join(', '))

async function crop(page: Page, locator: Locator, name: string, visibleHeight?: number): Promise<void> {
  await expect(locator).toBeVisible()
  const clip = await clipOf(locator)
  if (visibleHeight !== undefined) clip.height = Math.min(clip.height, visibleHeight)
  await expect(page).toHaveScreenshot(name, { clip })
}

test.describe('dialogs at 1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('shell geometry and colors (B-Overlays SHELL)', async ({ page, theme }) => {
    const c = C[theme]
    await openReader(page)
    const dialog = await openFromBar(page, 'Share')

    await expectBox(dialog, { x: 499, y: 64, width: 442, height: 230 })
    await expectComputed(dialog, {
      'background-color': c.card,
      'border-top-color': c.line2,
      'border-top-left-radius': '8px',
    })
    expect(await shadowOf(dialog)).toBe(c.overlayShadow)
    await expectComputed(dialog.locator('..'), { 'background-color': c.scrim, 'z-index': '95' })
    const titleRow = dialog.locator(':scope > div').first()
    await expectBox(titleRow, { width: 440, height: 53 })
    await expectComputed(titleRow, { 'border-bottom-color': c.line })
    await expectComputed(dialog.getByText('Share this doc'), { 'font-size': '15px', 'font-weight': '600', color: c.text })
    await expectBox(dialog.getByRole('button', { name: 'Close' }), { width: 32, height: 32 })
    await expectComputed(dialog.getByRole('button', { name: 'Close' }), { color: c.sub })
    await expectComputed(dialog.locator('[data-share-url]').locator('..'), {
      'background-color': c.page,
      'border-top-color': c.line2,
      'font-size': '13px',
      height: '38px',
    })
    await expectComputed(dialog.getByRole('button', { name: 'Copy link' }), {
      'background-color': c.accent,
      color: c.onAccent,
      height: '38px',
    })
    await expectComputed(dialog.getByText(`session ${SESSION_ID}`), { 'border-top-color': c.line, color: c.faint, height: '20px' })
    await expectComputed(dialog.locator('kbd').first(), { 'border-top-color': c.line2, color: c.sub })
    await expectBox(dialog.locator('kbd').first(), { height: 18 })
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  })

  test('Archive with a mismatched password (B-Overlays:54-71)', async ({ page, theme }) => {
    const c = C[theme]
    await openReader(page)
    const dialog = await openFromBar(page, 'Archive')
    const plain = dialog.getByRole('radio', { name: 'Archive', exact: true })
    const encrypt = dialog.getByRole('radio', { name: 'Archive with password' })

    await expect(plain).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(encrypt).toHaveAttribute('aria-checked', 'true')
    await expect(encrypt).toBeFocused()
    await dialog.getByLabel('Password', { exact: true }).fill('hunter2hunter')
    await dialog.getByLabel('Confirm password').fill('hunter2hunt')
    await dialog.getByLabel('Confirm password').blur()

    await expectBox(dialog, { width: 442, height: 481 })
    await expectBox(encrypt, { height: 47 })
    await expectComputed(encrypt, { 'border-top-color': c.accentLine, 'background-color': c.accentSoft })
    await expectComputed(plain, { 'border-top-color': c.line2, 'background-color': c.card })
    await expectComputed(plain.locator('span').first(), { 'border-top-color': c.faint, width: '14px' })
    await expectComputed(encrypt.getByText('Encrypted on this device before upload.'), { color: c.faint, 'font-size': '12px' })
    await expectComputed(dialog.getByLabel('Confirm password'), { 'border-top-color': c.bad, height: '38px', 'font-size': '16px' })
    await expect(dialog.getByLabel('Confirm password')).toHaveAccessibleDescription('Passwords do not match')
    await expectComputed(dialog.getByText('Passwords do not match'), { color: c.bad, 'font-size': '12px' })
    await expectComputed(dialog.locator('aside'), {
      'border-left-width': '3px',
      'border-left-color': c.warn,
      'border-top-color': c.warnLine,
      'background-color': c.warnCallout,
    })
    await expectComputed(dialog.getByRole('button', { name: 'Archive', exact: true }), { opacity: '1', 'background-color': c.accent })
    // The board's frame shows the top 446 rows of this dialog (crops.json visibleHeight).
    if (theme === 'dark') await crop(page, dialog, 'crop-overlays-archive-dialog.png', 446)
  })

  test('copy fallback over Share (B-Overlays:97-109)', async ({ page, theme }) => {
    const c = C[theme]
    await stubClipboard(page, false)
    await openReader(page)
    const share = await openFromBar(page, 'Share')
    await share.getByRole('button', { name: 'Copy link' }).click()
    const dialog = await afterEnterAnimation(page.getByRole('dialog', { name: 'Copy manually' }))

    await expectBox(dialog, { x: 499, y: 64, width: 442, height: 353 })
    await expectComputed(dialog.locator('..'), { 'z-index': '120' })
    const text = dialog.getByRole('textbox', { name: 'Text to copy' })
    await expect(text).toBeFocused()
    expect(await text.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.value.length])).toEqual([
      0,
      `${VISUAL_WEB_URL}/s/${SESSION_ID}`.length,
      `${VISUAL_WEB_URL}/s/${SESSION_ID}`.length,
    ])
    await expectComputed(text, { height: '172px', 'font-size': '12px', 'line-height': '18px', 'border-top-color': c.line2 })
    if (theme === 'dark') {
      await crop(page, dialog.locator(':scope > div').first(), 'crop-overlays-copy-title.png')
      await crop(page, dialog.locator('p'), 'crop-overlays-copy-help.png')
      await crop(page, dialog.getByRole('button', { name: 'Try copy again' }).locator('..'), 'crop-overlays-copy-actions.png')
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(share).toBeVisible()
  })

  test('Unlock in its error state (B-Overlays:79-89)', async ({ page, theme }) => {
    const c = C[theme]
    const salt = 'AAAAAAAAAAAAAAAAAAAAAA=='
    await routeSession(page, {
      status: 200,
      body: { ...sessionEnvelope(), encrypted: true, encParams: { salt, iv: 'AAAAAAAAAAAAAAAA', iterations: 100_000 }, payload: 'AAAAAAAAAAAAAAAAAAAAAAAA' },
    })
    await page.goto(`/s/${SESSION_ID}`, { waitUntil: 'networkidle' })
    await page.getByLabel('Password').fill('wrong password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Wrong password or corrupted data.' })).toBeVisible()
    await page.getByLabel('Password').blur()
    const card = page.locator('form')

    await expectBox(card, { x: 517, width: 406, height: 280 })
    await expectComputed(card, { 'background-color': c.card, 'border-top-color': c.line, 'border-top-left-radius': '8px' })
    await expectComputed(page.getByLabel('Password'), { 'border-top-color': c.bad, height: '42px' })
    await expectComputed(page.getByRole('button', { name: 'Unlock' }), { 'background-color': c.accent, opacity: '1', height: '44px' })
    await expectBox(page.getByText(`/s/${SESSION_ID}`).locator('..'), { y: 0, height: 45 })
    if (theme === 'dark') await crop(page, card, 'crop-overlays-unlock.png')
  })
})

test.describe('toasts (B-States sync)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('Copied, bottom center, gone after 1.6s', async ({ page, theme }) => {
    await stubClipboard(page, true)
    await openReader(page)
    const share = await openFromBar(page, 'Share')
    await share.getByRole('button', { name: 'Copy link' }).click()
    const toast = await afterEnterAnimation(page.getByRole('status').filter({ hasText: /^Copied$/ }))

    await expect(share.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expectBox(toast, { x: (1440 - 97) / 2, y: 900 - 24 - 42, width: 97, height: 42 })
    await expectComputed(toast, { 'background-color': C[theme].chip, 'border-top-color': C[theme].line2, 'z-index': '110' })
    expect(await shadowOf(toast)).toBe(C[theme].toastShadow)
    if (theme === 'dark') await crop(page, toast, 'crop-states-toast-copied.png')
    await expect(toast).toBeHidden({ timeout: 2_500 })
    await expect(share.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })

  test('Archived, then a failed archive with Retry', async ({ page, theme }) => {
    const c = C[theme]
    await routeSave(page, 200)
    await openReader(page)
    let dialog = await openFromBar(page, 'Archive')
    await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
    const archived = await afterEnterAnimation(page.getByRole('status').filter({ hasText: 'Archived. Kept 90 days from last open.' }))

    await expectBox(archived, { width: 285, height: 42 })
    if (theme === 'dark') await crop(page, archived, 'crop-states-toast-archived.png')

    await routeSave(page, 500)
    await page.getByRole('button', { name: 'Archived', exact: true }).click()
    dialog = await afterEnterAnimation(page.getByRole('dialog', { name: 'Archive this doc' }))
    await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
    const failed = page.getByRole('alert').filter({ hasText: 'Could not archive. Nothing was changed.' })
    await expect(failed).toBeVisible()
    await expect(dialog).toBeVisible()
    await expectComputed(failed, { 'border-top-color': c.badLine, 'background-color': c.chip, 'min-height': '42px' })
    await expectComputed(failed.getByRole('button', { name: 'Retry' }), { height: '32px', 'font-weight': '600' })
    await page.waitForTimeout(1_800)
    await expect(failed).toBeVisible()
    await failed.getByRole('button', { name: 'Dismiss' }).click()
    await expect(failed).toBeHidden()
  })
})

test.describe('page states (B-States)', () => {
  const blocks: [string, { status: number; body?: unknown }, string, string, string][] = [
    ['not found', { status: 404 }, `404 / ${SESSION_ID}`, 'Session not found or expired.', 'faint'],
    ['load error', { status: 500 }, 'load failed', 'Something went wrong loading this session.', 'bad'],
    [
      'corrupt',
      { status: 200, body: { ...sessionEnvelope(), encrypted: true, encParams: null, payload: 'x' } },
      'protected',
      'Protected session data is corrupted.',
      'warn',
    ],
  ]
  for (const [name, answer, line, title, tone] of blocks) {
    for (const viewport of [{ width: 1440, height: 900 }, PHONE]) {
      test(`${name} at ${viewport.width}`, async ({ page, theme }) => {
        const c = C[theme]
        await page.setViewportSize(viewport)
        await routeSession(page, answer)
        await page.goto(`/s/${SESSION_ID}`, { waitUntil: 'networkidle' })
        const heading = page.getByRole('heading', { level: 1, name: title })

        await expect(page.locator('header')).toHaveCount(0)
        await expectComputed(heading, { 'font-size': '18px', 'line-height': '24px', 'font-weight': '600', color: c.text })
        await expectComputed(page.getByText(line, { exact: true }), {
          'font-size': '12px',
          color: c[tone as 'faint' | 'bad' | 'warn'],
        })
        await expectBox(heading.locator('..'), { width: Math.min(360, viewport.width - 40) })
        const action = page.getByRole(name === 'not found' ? 'link' : 'button', { name: name === 'not found' ? 'Go to brief home' : 'Retry' })
        if (name === 'corrupt') await expect(page.getByRole('button')).toHaveCount(0)
        else await expectComputed(action, { 'background-color': c.accent, color: c.onAccent, height: viewport === PHONE ? '44px' : '36px' })
      })
    }
  }
})

test.describe('skeleton (B-States:33-40)', () => {
  test('mirrors the three columns, waits 300ms, shimmers 1.6s', async ({ page, theme }) => {
    await page.setViewportSize({ width: 1166, height: 420 })
    await routeSession(page, 'hang')
    await page.goto(`/s/${SESSION_ID}`)
    const skeleton = page.getByRole('status', { name: 'Loading session' })
    await expect(skeleton).toBeVisible()

    expect(await skeleton.evaluate((el) => el.getAnimations().map((a) => (a.effect as KeyframeEffect).getTiming().delay))).toEqual([300])
    const bars = skeleton.locator('.sk')
    await expectComputed(bars.first(), { 'animation-duration': '1.6s', 'border-top-left-radius': '3px' })
    const columns = skeleton.locator(':scope > div').nth(1).locator(':scope > div')
    await expectBox(columns.nth(0), { x: 0, width: 236 })
    await expectBox(columns.nth(2), { x: 1166 - 340, width: 340 })
    if (theme === 'dark') {
      await crop(page, skeleton.locator(':scope > div').nth(0), 'crop-states-skeleton-bar.png')
      await crop(page, skeleton.locator(':scope > div').nth(1), 'crop-states-skeleton-columns.png')
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expectComputed(bars.first(), { 'animation-name': 'none' })
  })
})

test.describe('empty states (B-States:113-135)', () => {
  test('no decisions and no notes', async ({ page, theme }) => {
    const c = C[theme]
    await page.setViewportSize({ width: 1440, height: 900 })
    await routeSession(page, {
      status: 200,
      body: { ...sessionEnvelope(), payload: JSON.stringify({ ...(samplePayload as object), decisions: [] }) },
    })
    await openReader(page, null)

    await expect(page.getByRole('complementary', { name: 'Decision dock' })).toHaveCount(0)
    const note = page.getByText('This brief asks nothing.', { exact: false })
    await expect(note).toHaveText(
      'This brief asks nothing. Read it, highlight what matters, then copy your notes back with Edit > Copy edit prompt.',
    )
    await expectComputed(note.locator('..'), { 'background-color': c.card, 'border-top-color': c.line, padding: '14px' })
    await expectComputed(page.getByText('DECISIONS', { exact: true }), { 'font-size': '11px', 'letter-spacing': '0.66px', color: c.faint })
    const outline = page.getByRole('navigation', { name: 'Outline' })
    await expect(outline.getByText('NOTES 0')).toBeVisible()
    const card = outline.getByText('NOTES 0').locator('..')
    await expectComputed(card, {
      'background-color': c.card,
      'border-top-color': c.line,
      'border-top-left-radius': '6px',
      padding: '14px',
      gap: '8px',
    })
    await expectComputed(outline.getByText('NOTES 0'), { 'font-size': '11px', color: c.faint })
    await expectComputed(outline.getByText('Select any text to highlight it, add a note, or ask the agent about it.'), {
      'font-size': '13px',
      'line-height': '20px',
      color: c.sub,
    })
  })
})

test.describe('selection toolbar (B-Components:146-151)', () => {
  test('inverted bar with H, N and A, which act on the selection', async ({ page, theme }) => {
    const c = C[theme]
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page, null)
    const paragraph = page.locator('main [data-hl]').filter({ hasText: /\S/ }).nth(1)
    const box = (await paragraph.boundingBox())!
    await page.mouse.move(box.x + 4, box.y + 8)
    await page.mouse.down()
    await page.mouse.move(box.x + 160, box.y + 8, { steps: 5 })
    await page.mouse.up()
    const bar = await afterEnterAnimation(page.locator('[data-seltoolbar]'))

    await expectBox(bar, { width: 272, height: 36 })
    await expectComputed(bar, { 'background-color': c.text, 'border-top-left-radius': '6px' })
    await expectComputed(bar.locator('kbd').first(), { color: c.inverseSub, 'font-size': '10px' })
    await expectComputed(bar.getByRole('button', { name: 'Highlight' }).locator('span'), { 'background-color': c.warnFill })
    if (theme === 'dark') await crop(page, bar, 'crop-components-selection-toolbar.png')

    await page.keyboard.press('n')
    await expect(page.locator('[data-popover]')).toBeVisible()
    await expect(page.locator('[data-popover] textarea')).toBeFocused()
    await expect(page.locator('[data-popover] textarea')).toHaveValue('')
    await expect(bar).toHaveCount(0)
  })
})

// interactions.md breakpoints: "under 640 | dialogs become bottom sheets".
test.describe('the 640 boundary', () => {
  for (const [width, sheet] of [
    [640, false],
    [639, true],
  ] as const) {
    test(`Share at ${width} is ${sheet ? 'a bottom sheet' : 'the centered dialog'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openReader(page)
      const share = await openFromBar(page, 'Share')

      await expectBox(share, sheet ? { x: 0, width } : { x: (width - 442) / 2, y: 64, width: 442, height: 248 })
      const box = (await share.boundingBox())!
      if (sheet) expect(Math.round(box.y + box.height)).toBe(900)
      await expectComputed(share, {
        'border-top-left-radius': sheet ? '10px' : '8px',
        'border-bottom-left-radius': sheet ? '0px' : '8px',
        'animation-name': sheet ? 'console-sheet' : 'console-enter',
      })
      await expect(share.locator(':scope > span').first()).toBeVisible({ visible: sheet })
    })
  }
})

test.describe('error toast over a bottom sheet', () => {
  for (const width of [390, 639]) {
    test(`stays clear of the Archive sheet at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await routeSave(page, 500)
      await openReader(page)
      const archive = await openFromBar(page, 'Archive')
      const primary = archive.getByRole('button', { name: 'Archive', exact: true })
      await primary.click()
      const failed = await afterEnterAnimation(page.getByRole('alert').filter({ hasText: 'Could not archive. Nothing was changed.' }))

      const toast = (await failed.boundingBox())!
      const sheet = (await archive.boundingBox())!
      const button = (await primary.boundingBox())!
      expect(toast.y + toast.height, 'toast bottom above the sheet top').toBeLessThanOrEqual(sheet.y)
      expect(toast.y, 'toast inside the viewport').toBeGreaterThanOrEqual(0)
      expect(toast.y + toast.height).toBeLessThanOrEqual(button.y)
      await failed.getByRole('button', { name: 'Dismiss' }).click()
    })
  }
})

test.describe('dialogs as bottom sheets at 390', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true })

  test('Share and Archive slide up from the bottom edge', async ({ page, theme }) => {
    const c = C[theme]
    await openReader(page)
    const share = await openFromBar(page, 'Share')
    const shareBox = (await share.boundingBox())!
    expect(shareBox.x).toBe(0)
    expect(shareBox.width).toBe(PHONE.width)
    expect(Math.round(shareBox.y + shareBox.height)).toBe(PHONE.height)
    await expectComputed(share, {
      'border-top-left-radius': '10px',
      'border-bottom-left-radius': '0px',
      'border-left-width': '0px',
      'border-top-color': c.line2,
      'animation-name': 'console-sheet',
    })
    await expectBox(share.locator(':scope > span').first(), { width: 36, height: 4 })
    await page.keyboard.press('Escape')

    const archive = await openFromBar(page, 'Archive')
    for (const name of ['Cancel', 'Archive']) {
      await expectBox(archive.getByRole('button', { name, exact: true }), { x: 18, width: PHONE.width - 36, height: 44 })
    }
  })
})
