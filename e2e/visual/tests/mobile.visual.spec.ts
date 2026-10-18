import { PHONE_SCREEN, PHONE_VIEWPORT, READER_REGIONS, SECTION_HEADERS } from '../lib/regions'
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
  // R-V5 (like R-V1): blocks carry the B-Blocks card header on mobile too, so
  // B-Mobile's bare seq block cannot match. Compared: the section header row
  // and the peek bar, down to the rows above the frame's corners. The top
  // bar's Open outline button is not on B-Mobile; shell.visual checks its geometry.
  const header = page.locator(SECTION_HEADERS['s2-header'])
  const peek = page.locator(READER_REGIONS.dock)
  // The header row is cut after the title (render-references.ts phone screens).
  const parts = { 's2-header': { box: header, end: header.locator('h2') }, peek: { box: peek, end: peek } }
  for (const [part, { box: boxOf, end }] of Object.entries(parts)) {
    const box = (await boxOf.boundingBox())!
    const endBox = (await end.boundingBox())!
    const x = Math.round(box.x)
    const y = Math.round(box.y)
    await expect(page).toHaveScreenshot(`mobile-${theme}-reading-${part}.png`, {
      clip: {
        x,
        y,
        width: Math.round(endBox.x + endBox.width) - x,
        height: Math.round(Math.min(box.y + box.height, PHONE_SCREEN.height)) - y,
      },
    })
  }
})
