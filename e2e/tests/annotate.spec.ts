import { test, expect } from './fixtures'

const PARAGRAPH_SELECTOR = '[data-hl][data-sid="0"][data-bid="0"]'

test.describe('annotate', () => {
  test('selecting text shows the toolbar and Highlight adds a mark', async ({ page, createSession }) => {
    const { id } = await createSession()
    await page.goto(`/s/${id}`)

    const paragraph = page.locator(PARAGRAPH_SELECTOR)
    await expect(paragraph).toBeVisible()

    // Selection Range trick: build a Range over the paragraph's first text
    // node directly in the page, then fire the mouseup SelectionToolbar
    // listens for on `document` (see SelectionToolbar.tsx) -- Playwright has
    // no native "select this substring of text" API, so the component's own
    // selectionchange-free, mouseup-driven contract is reproduced by hand.
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      const textNode = el?.firstChild
      if (!textNode) throw new Error('paragraph text node not found')
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 20)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }, PARAGRAPH_SELECTOR)
    await paragraph.dispatchEvent('mouseup')

    const highlightButton = page.getByRole('button', { name: 'Highlight' })
    await expect(highlightButton).toBeVisible()
    await highlightButton.click()

    await expect(paragraph.locator('mark')).toBeVisible()
  })
})
