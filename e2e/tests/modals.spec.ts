import type { Page } from '@playwright/test'
import { test, expect, testPayload } from './fixtures'

// Headless Chromium hides scrollbars; a classic one is what shifts the page
// sideways when a lock takes it away, so this file shows them.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

const LEFT_OF_CENTERED_OR_RIGHT_PANEL = { x: 40, y: 400 }
const ABOVE_PHONE_DOCK_SHEET = { x: 195, y: 60 }
const PHONE_PAGE = { x: 195, y: 400 }

async function wheelOnScrim(page: Page, at = LEFT_OF_CENTERED_OR_RIGHT_PANEL): Promise<number> {
  await page.mouse.move(at.x, at.y)
  await page.mouse.wheel(0, 600)
  // A wheel that scrolls lands within a frame or two; give it several before reading.
  await page.evaluate(() => new Promise((done) => setTimeout(done, 300)))
  return scrollY(page)
}

/**
 * The body, not the root: Chrome's root clientWidth leaves out only a drawn
 * scrollbar, not a reserved gutter.
 */
const layoutWidth = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().width)

// interactions.md: "Body scroll locks."
test.describe('dialogs lock page scroll', () => {
  test.beforeEach(async ({ isMobile }) => {
    test.skip(isMobile, 'a mouse wheel is a desktop input')
  })

  test('the page stays put under the wheel, nested dialogs included, and is where it was after they close', async ({
    page,
    createSession,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('blocked')) },
      })
      document.execCommand = () => false
    })
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    const title = page.getByRole('heading', { level: 1, name: testPayload.meta.title })
    await expect(title).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(400)

    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBe(120)
    // Where scrollbars overlay the page (macOS) there is no gutter, and the width checks hold trivially.
    const width = await layoutWidth(page)

    await page.getByRole('button', { name: 'Share' }).click()
    const share = page.getByRole('dialog', { name: 'Share this doc' })
    await expect(share).toBeVisible()
    expect(await layoutWidth(page)).toBe(width)
    expect(await wheelOnScrim(page)).toBe(120)

    await share.getByRole('button', { name: 'Copy link' }).click()
    const fallback = page.getByRole('dialog', { name: 'Copy manually' })
    await expect(fallback).toBeVisible()
    expect(await wheelOnScrim(page)).toBe(120)

    await page.keyboard.press('Escape')
    await expect(fallback).toBeHidden()
    await expect(share).toBeVisible()
    expect(await wheelOnScrim(page)).toBe(120)

    await page.keyboard.press('Escape')
    await expect(share).toBeHidden()
    expect(await scrollY(page)).toBe(120)
    expect(await layoutWidth(page)).toBe(width)
    expect(await page.evaluate(() => [document.body.style.overflow, document.documentElement.style.scrollbarGutter])).toEqual(['', ''])
    expect(await wheelOnScrim(page)).toBeGreaterThan(120)
  })

  test('the palette and the ? sheet lock it too', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBe(120)

    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
    expect(await wheelOnScrim(page)).toBe(120)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden()

    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
    expect(await wheelOnScrim(page)).toBe(120)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden()
    expect(await wheelOnScrim(page)).toBeGreaterThan(120)
  })

  test('the prompt review sheet and the phone dock sheet lock it too', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: testPayload.meta.title })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBe(120)

    await page.getByRole('button', { name: /^Copy prompt for agent/ }).click()
    const review = page.getByRole('dialog', { name: 'Review prompt before copying' })
    await expect(review).toBeVisible()
    expect(await wheelOnScrim(page)).toBe(120)
    await page.keyboard.press('Escape')
    await expect(review).toBeHidden()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBe(120)
    await page.getByRole('button', { name: 'Open dock' }).click()
    const sheet = page.getByRole('dialog', { name: 'Decision dock' })
    await expect(sheet).toBeVisible()
    expect(await wheelOnScrim(page, ABOVE_PHONE_DOCK_SHEET)).toBe(120)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    expect(await wheelOnScrim(page, PHONE_PAGE)).toBeGreaterThan(120)
  })
})

test('Shift Tab from the first control of the phone dock sheet stays in the sheet', async ({ page, createSession }) => {
  const { id } = await createSession()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/s/${id}`)
  await page.getByRole('button', { name: 'Open dock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Decision dock' })
  await expect(sheet).toBeVisible()

  const focusedControl = () =>
    page.evaluate(() => {
      const el = document.activeElement
      return el && el.id !== 'dock' && el.closest('#dock') ? el.textContent : null
    })
  await page.keyboard.press('Tab')
  const first = await focusedControl()
  expect(first, 'Tab from the sheet lands on its first control').not.toBeNull()
  await page.keyboard.press('Shift+Tab')
  const last = await focusedControl()
  expect(last, 'Shift Tab from the first control wraps to the last one').not.toBeNull()
  expect(last).not.toBe(first)
  await page.keyboard.press('Tab')
  expect(await focusedControl()).toBe(first)
})
