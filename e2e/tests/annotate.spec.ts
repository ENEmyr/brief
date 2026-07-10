import { test, expect, selectFirstParagraphText, FIRST_PARAGRAPH_SELECTOR } from './fixtures'

test.describe('annotate', () => {
  test('selecting text shows the toolbar and Highlight adds a mark', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    const selected = await selectFirstParagraphText(page)
    expect(selected.length).toBeGreaterThan(0)

    const highlightButton = page.getByRole('button', { name: 'Highlight' })
    await expect(highlightButton).toBeVisible()
    await highlightButton.click()

    // The mark must contain exactly the selected characters -- a mark
    // rendered at drifted offsets (an off-by-one in the Range -> start/end
    // offset mapping) would still pass a bare visibility check. A plain
    // highlight renders no <sup> badge (that is note/ask-only), so the
    // mark's text is exactly the highlighted segment.
    const mark = page.locator(FIRST_PARAGRAPH_SELECTOR).locator('mark')
    await expect(mark).toBeVisible()
    await expect(mark).toHaveText(selected)
  })
})
