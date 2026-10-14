import type { Page } from '@playwright/test'
import { APP_FONTS, assertFontsLoaded } from '../lib/fonts'
import { LANDING_REGIONS, LANDING_WIDTHS, clipOfRegion } from '../lib/regions'
import { expect, test } from '../lib/session'

async function openLanding(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()
  await assertFontsLoaded(page, APP_FONTS, 'landing')
}

test('landing full page at 1440', async ({ page, theme }) => {
  await openLanding(page, 1440)
  await expect(page).toHaveScreenshot(`landing-${theme}.png`, { fullPage: true })
})

for (const width of LANDING_WIDTHS) {
  for (const [name, region] of Object.entries(LANDING_REGIONS)) {
    test(`landing ${name} at ${width}`, async ({ page, theme }) => {
      await openLanding(page, width)
      const landmark = page.locator(region.selector, { hasText: region.hasText }).first()
      await expect(landmark, `landmark not found: ${region.selector}`).toBeVisible()
      const clip = await clipOfRegion(page, region)
      await expect(page).toHaveScreenshot(`landing-${theme}-${width}-${name}.png`, { fullPage: true, clip })
    })
  }
}
