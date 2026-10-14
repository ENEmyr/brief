import { PHONE_SCREEN } from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// The B-Mobile phone screen: 388 wide (390 frame minus its 1px border), below
// the 44px status-bar offset; the bottom 35px (frame corners) is not compared.
test.use({
  viewport: { width: PHONE_SCREEN.width, height: PHONE_SCREEN.height },
  isMobile: true,
  hasTouch: true,
})

test('mobile reading screen', async ({ page, theme }) => {
  await openReader(page)
  await expect(page).toHaveScreenshot(`mobile-${theme}-reading.png`)
})
