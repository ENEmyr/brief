import { test, expect, testPayload } from './fixtures'

// bug-088: under 880px the outline column is hidden, so the contents have to
// come from the top bar's drawer. bug-089: the drawer's items keep a 44px touch
// target (`min-h-11`).
const DRAWER_ITEM_MIN_HEIGHT = 44

test.describe('outline drawer under 880px', () => {
  test('opens from the top bar and every item is at least 44px tall', async ({
    page,
    createSession,
    isMobile,
  }) => {
    test.skip(!isMobile, 'covered on the mobile project; the desktop project is 1280 wide')
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    await expect(page.getByRole('navigation', { name: 'Table of contents' })).toBeHidden()
    await page.getByRole('button', { name: 'Open contents' }).click()

    const drawer = page.getByRole('dialog', { name: 'Table of contents' })
    await expect(drawer).toBeVisible()
    const items = drawer.getByRole('button')
    await expect(items.first()).toBeVisible()
    // One item per section, plus whatever extra entries the shell adds (today: Decisions).
    expect(await items.count()).toBeGreaterThanOrEqual(testPayload.sections.length)
    for (const item of await items.all()) {
      const box = await item.boundingBox()
      expect(box, 'drawer item has no box').not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(DRAWER_ITEM_MIN_HEIGHT)
    }
  })

  test('the drawer trigger exists at 879px and the sidebar takes over at 880px', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.setViewportSize({ width: 879, height: 900 })
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('button', { name: 'Open contents' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Table of contents' })).toBeHidden()

    await page.setViewportSize({ width: 880, height: 900 })
    await expect(page.getByRole('button', { name: 'Open contents' })).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Table of contents' })).toBeVisible()
  })
})
