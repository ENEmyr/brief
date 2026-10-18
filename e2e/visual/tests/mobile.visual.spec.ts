import { PHONE_SCREEN, PHONE_VIEWPORT } from '../lib/regions'
import { expect, mobilePayload, mobileSeed, openReader, serveSession, test } from '../lib/session'

// The B-Mobile phone screen: the viewport is the whole screen below the status
// bar, so bottom-anchored elements sit where the frame puts them; only the
// part above the frame's rounded corners is compared (PHONE_SCREEN).
test.use({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true })

test('mobile reading screen', async ({ page, theme }) => {
  await serveSession(page, mobilePayload)
  await openReader(page, mobileSeed)
  // C7 (vt-b triage): B-Mobile is drawn mid-read, at section 02 ("§02 / 04")
  // with the sequence on step 3 of 6.
  await page.locator('section#s2').evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
  const next = page.getByRole('button', { name: 'Next step' }).first()
  for (let i = 0; i < 3; i++) await next.click()
  await expect(page.getByText('§02 / 04')).toBeVisible()
  await expect(page).toHaveScreenshot(`mobile-${theme}-reading.png`, {
    clip: { x: 0, y: 0, width: PHONE_SCREEN.width, height: PHONE_SCREEN.height },
  })
})
