import { READER_REGIONS, READER_WIDTHS, type ReaderRegion } from '../lib/regions'
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

// Region references exist for the dark board at 1440 only.
test.describe('regions at 1440', () => {
  test.beforeEach(({ theme }) => {
    test.skip(theme !== 'dark', 'region references are rendered from the dark board only')
  })
  for (const region of Object.keys(READER_REGIONS) as ReaderRegion[]) {
    test(`region ${region}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await openReader(page)
      await expect(page.locator(READER_REGIONS[region]).first()).toHaveScreenshot(`region-dark-${region}.png`)
    })
  }
})
