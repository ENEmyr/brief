import type { Page } from '@playwright/test'
import { APP_FONTS, assertFontsLoaded } from '../lib/fonts'
import { LANDING_REGIONS, LANDING_WIDTHS, clipOfRegion } from '../lib/regions'
import { expect, test } from '../lib/session'

// The landing page against B-Landing (dark) and its lightify.py version
// (light), region by region at 1440 and 390. Known differences, each with a
// cut that leaves it out: 14-character example ids (findings.md F3) lengthen
// the hero's prompt panel (`hero-copy`); the board's runtime drops the blank
// line before "# Pull the schema again" in the skill snippet (`usage-tabs`);
// the preview shows three view tabs (owner ruling D2, `preview-body`); the
// blocks table has no "Agent work" row until those types exist (`blocks-rows`).

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
