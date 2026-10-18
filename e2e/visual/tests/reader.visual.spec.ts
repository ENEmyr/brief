import type { Page } from '@playwright/test'
import {
  BOARD_PROGRESS,
  DOCK_VISIBLE_HEIGHT,
  READER_REGIONS,
  READER_WIDTHS,
  SECTION_HEADERS,
  clipOf,
  sectionChromeClip,
} from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// R-V1: each section's header row against B-Reader / B-Reader-Light at the
// same width. These replace the full-page comparisons: the blocks between the
// headers follow the B-Blocks cards (text-blocks and diagrams specs).
for (const width of READER_WIDTHS) {
  for (const [name, selector] of Object.entries(SECTION_HEADERS)) {
    test(`reader ${name} at ${width}`, async ({ page, theme }) => {
      await page.setViewportSize({ width, height: 900 })
      await openReader(page)
      const header = page.locator(selector).first()
      await expect(header, `landmark not found: ${selector}`).toBeVisible()
      const clip = await clipOf(header)
      await expect(page).toHaveScreenshot(`reader-${theme}-${width}-${name}.png`, {
        fullPage: true,
        clip,
      })
    })
  }
}

/** C7 (lib/regions.ts BOARD_PROGRESS): the board's mid-read state before the topbar and outline are cut. */
const BOARD_STATE: Partial<Record<keyof typeof READER_REGIONS, (page: Page) => Promise<void>>> = {
  topbar: (page) =>
    page.evaluate((fraction) => {
      const { scrollHeight, clientHeight } = document.documentElement
      window.scrollTo({
        top: Math.round(fraction * (scrollHeight - clientHeight)),
        behavior: 'instant',
      })
    }, BOARD_PROGRESS),
  outline: (page) =>
    page.locator('section#s2').evaluate((el) => el.scrollIntoView({ behavior: 'instant' })),
}

// Region references exist for the dark board at 1440 only. Cut out of the full
// page at the box measured at scroll 0, the way the renderer cuts them.
test.describe('regions at 1440', () => {
  test.beforeEach(({ theme }) => {
    test.skip(theme !== 'dark', 'region references are rendered from the dark board only')
  })
  for (const [region, selector] of Object.entries(READER_REGIONS)) {
    test(`region ${region}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await openReader(page)
      const landmark = page.locator(selector).first()
      await expect(landmark, `landmark not found: ${selector}`).toBeVisible()
      const setState = BOARD_STATE[region as keyof typeof READER_REGIONS]
      if (setState) {
        // Sticky landmarks: cut the viewport at the box they hold once scrolled.
        await setState(page)
        const box = (await landmark.boundingBox())!
        const clip = {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
        await expect(page).toHaveScreenshot(`region-dark-${region}.png`, { clip })
        return
      }
      const clip = region === 's2' ? await sectionChromeClip(landmark) : await clipOf(landmark)
      if (region === 'dock')
        expect(clip.height, 'C8: app dock height the reference is cut at').toBe(DOCK_VISIBLE_HEIGHT)
      await expect(page).toHaveScreenshot(`region-dark-${region}.png`, { fullPage: true, clip })
    })
  }
})
