import { expect, openReader, samplePayload, sessionEnvelope, test, SESSION_ID } from '../lib/session'
import { clipOf } from '../lib/regions'
import { VISUAL_API_URL, VISUAL_WEB_URL } from '../visual.config'

// B-Overlays:37-45. The Share field shows the page's host, so this file serves
// the app as brief.algoryth.me (Chromium maps the name to the visual server)
// and the session carries the board's "v3": the crop needs no mask.
test.use({
  baseURL: 'http://brief.algoryth.me',
  launchOptions: { args: [`--host-resolver-rules=MAP brief.algoryth.me ${new URL(VISUAL_WEB_URL).host}`] },
})

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS', 'access-control-allow-headers': 'content-type' }

test('Share against the board', async ({ page, theme }) => {
  const sample = samplePayload as { meta: object }
  const v3 = { ...sample, meta: { ...sample.meta, version: 'v3' } }
  await page.route(`${new URL(VISUAL_API_URL).origin}/api/session/${SESSION_ID}`, (route) =>
    route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ...sessionEnvelope(), payload: JSON.stringify(v3) }) }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await openReader(page)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Share this doc' })
  await expect(dialog).toBeVisible()
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

  await expect(dialog.locator('[data-share-url]')).toHaveText(`brief.algoryth.me/s/${SESSION_ID}`)
  await expect(dialog).toContainText(`session ${SESSION_ID}v3expires 2026-11-13`)
  await expect(dialog.getByRole('button', { name: 'Copy link' })).toBeFocused()
  if (theme === 'dark') await expect(page).toHaveScreenshot('crop-overlays-share-dialog.png', { clip: await clipOf(dialog) })
})
