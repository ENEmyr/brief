import { PHONE_SCREEN, PHONE_VIEWPORT } from '../lib/regions'
import { expect, openReader, test } from '../lib/session'

// The B-Mobile phone screen: the viewport is the whole screen below the status
// bar, so bottom-anchored elements sit where the frame puts them; only the
// part above the frame's rounded corners is compared (PHONE_SCREEN).
test.use({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true })

test('mobile reading screen', async ({ page, theme }) => {
  await openReader(page)
  await expect(page).toHaveScreenshot(`mobile-${theme}-reading.png`, {
    clip: { x: 0, y: 0, width: PHONE_SCREEN.width, height: PHONE_SCREEN.height },
  })
})
