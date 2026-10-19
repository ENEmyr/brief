import { test, expect } from './fixtures'

// d094 class: 110% zoom on an 879 css window gives a fractional 879.09 viewport,
// which a Playwright viewport cannot express. The JS breakpoint (useIsNarrow)
// and the CSS max-[880px] rules must agree there: no half-narrow, half-wide page.
for (const { window, narrow } of [
  { window: 879, narrow: true },
  { window: 967, narrow: false },
]) {
  test(`at window ${window} and scale 1.1 the reader is ${narrow ? 'narrow' : 'wide'} in both JS and CSS`, async ({
    playwright,
    baseURL,
    createSession,
    isMobile,
  }) => {
    test.skip(isMobile, 'the window size and scale come from browser flags, not the device profile')
    const browser = await playwright.chromium.launch({
      args: ['--force-device-scale-factor=1.1', `--window-size=${window},900`],
    })
    try {
      const page = await (await browser.newContext({ baseURL, viewport: null, deviceScaleFactor: undefined })).newPage()
      const { id } = await createSession()
      await page.goto(`/s/${id}`)
      await expect(page.locator('h1')).toBeVisible()
      // 879.09 and 967.27: a real fractional viewport, not a rounded one.
      expect(await page.evaluate(() => visualViewport!.width % 1)).toBeGreaterThan(0)
      // "Open dock" exists only when JS says narrow; the dock is fixed only when CSS says narrow.
      await expect(page.getByRole('button', { name: 'Open dock' })).toHaveCount(narrow ? 1 : 0)
      await expect(page.locator('#dock')).toHaveCSS('position', narrow ? 'fixed' : 'static')
      if (narrow) await expect(page.getByRole('button', { name: 'Open dock' })).toBeVisible()
    } finally {
      await browser.close()
    }
  })
}
