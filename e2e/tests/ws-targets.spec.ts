import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Under 880 every control is at least 44 px and is the hit target at its centre.

async function expectTarget(page: Page, control: Locator) {
  // Overlays open with a scale animation, so poll until the box settles.
  const shortSide = async () => {
    const { width, height } = (await control.boundingBox())!
    return Math.min(width, height)
  }
  await expect.poll(shortSide).toBeGreaterThanOrEqual(44)
  const box = (await control.boundingBox())!
  const hit = await control.evaluate((el, { x, y }) => el === document.elementFromPoint(x, y), {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  })
  expect(hit).toBe(true)
}

for (const width of [388, 879]) {
  test(`the diagram viewer Fit button is a 44 px target at ${width}`, async ({ page, createSession }) => {
    await page.setViewportSize({ width, height: 900 })
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await page.getByRole('button', { name: 'Open diagram full screen' }).first().click()
    const viewer = page.getByRole('dialog', { name: 'Diagram viewer' })
    await expectTarget(page, viewer.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Fit' }))
  })

  test(`the command palette search input is a 44 px target at ${width}`, async ({ page, createSession }) => {
    await page.setViewportSize({ width, height: 900 })
    const { id } = await createSession()
    await page.goto(`/s/${id}`)
    await expect(page.locator('h1')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await expectTarget(page, page.getByRole('dialog', { name: 'Command palette' }).locator('input'))
  })
}

test('the unlock card password input is a 44 px target at 388', async ({ page, createSession }) => {
  // Archive on a wide screen, where the Archive button sits in the top bar.
  await page.setViewportSize({ width: 1440, height: 900 })
  const { id } = await createSession()
  await page.goto(`/s/${id}`)
  await page.getByRole('button', { name: 'Archive' }).click()
  const dialog = page.getByRole('dialog', { name: 'Archive this doc' })
  await dialog.getByRole('radio', { name: 'Archive with password' }).click()
  await dialog.getByLabel('Password', { exact: true }).fill('test-pass-123')
  await dialog.getByLabel('Confirm password').fill('test-pass-123')
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(dialog).not.toBeVisible()

  await page.setViewportSize({ width: 388, height: 900 })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Protected session' })).toBeVisible()
  await expectTarget(page, page.getByLabel('Password'))
})
