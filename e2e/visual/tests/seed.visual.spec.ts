import { expect, openReader, test } from '../lib/session'

// Not a pixel check: proves the fixture and the reader-state seed reach the
// app, so a red pixel diff is about the design and not about missing data.
// Passes today and has to keep passing.
test.describe('fixture and seed reach the reader', () => {
  test.beforeEach(({ theme }) => {
    test.skip(theme !== 'dark', 'data check, no theme dependence')
  })

  test('sample brief loads, seeded highlight is painted, no page error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page)

    await expect(page.locator('h1').first()).toHaveText('Rate limiting สำหรับ public API')
    for (const id of ['s1', 's2', 's3', 's4']) await expect(page.locator(`#${id}`)).toHaveCount(1)
    await expect(page.locator('mark').filter({ hasText: 'ล้มทั้งแถบ' }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a blank state paints no highlight', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openReader(page, null)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('mark')).toHaveCount(0)
  })
})
