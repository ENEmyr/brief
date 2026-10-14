import { test, expect, testPayload } from './fixtures'

// bug-088: under 880px the outline column is hidden, so the contents have to
// come from the top bar's drawer. bug-089: the drawer's items keep a 44px touch
// target (`min-h-11`). The names follow B-Reader: "Open outline" and "Outline"
// (they were "Open contents" and "Table of contents"), and the rows are links.
const TOUCH_TARGET = 44

test.describe('outline drawer under 880px', () => {
  test('opens from the top bar and every item is at least 44px tall', async ({
    page,
    createSession,
    isMobile,
  }) => {
    test.skip(!isMobile, 'covered on the mobile project; the desktop project is 1280 wide')
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    await expect(page.getByRole('navigation', { name: 'Outline' })).toBeHidden()
    await page.getByRole('button', { name: 'Open outline' }).click()

    const drawer = page.getByRole('dialog', { name: 'Outline' })
    await expect(drawer).toBeVisible()
    const items = drawer.getByRole('link')
    await expect(items.first()).toBeVisible()
    // One row per section, plus one per reader mark.
    expect(await items.count()).toBeGreaterThanOrEqual(testPayload.sections.length)
    for (const item of await items.all()) {
      const box = await item.boundingBox()
      expect(box, 'drawer item has no box').not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET)
    }
  })

  test('the drawer trigger exists at 879px and the sidebar takes over at 880px', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.setViewportSize({ width: 879, height: 900 })
    await page.goto(`/s/${id}`)
    await expect(page.getByRole('button', { name: 'Open outline' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Outline' })).toBeHidden()

    await page.setViewportSize({ width: 880, height: 900 })
    await expect(page.getByRole('button', { name: 'Open outline' })).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Outline' })).toBeVisible()
  })
})

test.describe('the 880 breakpoint', () => {
  // Tailwind compiles `max-[879px]:` to `not all and (min-width: 879px)`, which
  // leaves exactly 879 to neither side of `min-[880px]:`.
  test('touch targets are 44px at 879px and back to their board size at 880px', async ({
    page,
    createSession,
  }) => {
    const { id } = await createSession()
    await page.setViewportSize({ width: 879, height: 900 })
    await page.goto(`/s/${id}`)
    // Was the seq block's "‹ Prev" row button. Phase 4b moved seq's controls
    // into its card header, where Prev hides at rest on a wide screen, so the
    // card's full-screen button, present on both sides of 880, carries the check.
    const button = page.getByRole('button', { name: 'Open diagram full screen' }).first()
    await expect(button).toBeVisible()
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(TOUCH_TARGET)

    await page.setViewportSize({ width: 880, height: 900 })
    await expect.poll(async () => (await button.boundingBox())!.height).toBeLessThan(TOUCH_TARGET)
  })
})
