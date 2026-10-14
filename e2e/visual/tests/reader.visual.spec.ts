import { READER_REGIONS, READER_WIDTHS, clipOf } from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// Full-page reader against B-Reader / B-Reader-Light rendered at the same width.
// Expected to fail until the Console shell lands: the app still has the old design.
for (const width of READER_WIDTHS) {
  test(`reader full page at ${width}`, async ({ page, theme }) => {
    await page.setViewportSize({ width, height: 900 })
    await openReader(page)
    await expect(page).toHaveScreenshot(`reader-${theme}-${width}.png`, { fullPage: true })
  })
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
      const clip = await clipOf(page.locator(selector).first())
      await expect(page).toHaveScreenshot(`region-dark-${region}.png`, { fullPage: true, clip })
    })
  }
})
